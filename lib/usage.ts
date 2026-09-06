// Site-wide daily AI usage counter (tokens in/out, calls) so the homepage can
// show "today's usage" without any Cloudflare analytics token. Storage mirrors
// lib/quota.ts: KV → edge cache → in-memory (dev). Not atomic; display only.

import { secondsUntilNextUtcDay } from "@/lib/date";
import { SITE_NEURON_BUDGET, type Tier } from "@/lib/limits";

export type DailyUsage = { inputTokens: number; outputTokens: number; calls: number; neurons: number };

// Workers AI bills in "neurons" ($0.011 per 1k) and reports how many each call
// actually cost; llm-worker forwards that as x-usage-neurons and we add it up.
// Nothing here derives neurons from a price table — swapping the model needs no
// change on this side.
export const FREE_NEURONS_PER_DAY = SITE_NEURON_BUDGET.anon;

// Site-wide backstop, bucketed per tier so a flood of anonymous traffic cannot
// spend the budget signed-in users depend on. Paid calls are never bucketed:
// they draw on a balance the user already paid for.
export async function isFreeTierExhausted(tier: Tier = "anon"): Promise<boolean> {
  if (tier === "paid") return false;
  return neuronsFor(await getUsageToday(tier)) >= SITE_NEURON_BUDGET[tier];
}

export function neuronsFor(u: DailyUsage): number {
  return u.neurons;
}

const ZERO: DailyUsage = { inputTokens: 0, outputTokens: 0, calls: 0, neurons: 0 };
const today = () => new Date().toISOString().slice(0, 10);
// One bucket per tier. `usage:<date>` (no tier) stays the aggregate the public
// meter reads, so the homepage total survives the split.
const key = (tier?: Tier) =>
  tier ? `usage:${today()}:${tier}` : `usage:${today()}`;

function parse(raw: string | null | undefined): DailyUsage {
  try {
    const j = raw ? JSON.parse(raw) : null;
    return j && typeof j === "object"
      ? {
          inputTokens: Number(j.inputTokens) || 0,
          outputTokens: Number(j.outputTokens) || 0,
          calls: Number(j.calls) || 0,
          neurons: Number(j.neurons) || 0,
        }
      : { ...ZERO };
  } catch {
    return { ...ZERO };
  }
}

async function kvBinding(): Promise<any | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const kv: any = (mod.getCloudflareContext?.()?.env as any)?.UPLOAD_QUOTA;
    return kv && typeof kv.get === "function" && typeof kv.put === "function" ? kv : null;
  } catch {
    return null;
  }
}

function edgeCache(): any | null {
  const cache: any = (globalThis as any).caches?.default;
  return cache && typeof cache.match === "function" && typeof cache.put === "function" ? cache : null;
}

export async function getUsageToday(tier?: Tier): Promise<DailyUsage> {
  return readUsage(key(tier));
}

async function readUsage(k: string): Promise<DailyUsage> {
  const kv = await kvBinding();
  if (kv) return parse(await kv.get(k));
  const cache = edgeCache();
  if (cache) {
    const hit = await cache.match(new Request("https://usage.example/" + k));
    return parse(hit ? await hit.text() : null);
  }
  const g: any = globalThis as any;
  return g.__usage?.[k] ?? { ...ZERO };
}

// Read from upstream headers set by llm-worker; no-op when absent (e.g. mock).
export async function recordUsageFromHeaders(
  headers: Headers,
  tier: Tier = "anon",
): Promise<number> {
  const inTok = Number(headers.get("x-usage-in")) || 0;
  const outTok = Number(headers.get("x-usage-out")) || 0;
  const neurons = Number(headers.get("x-usage-neurons")) || 0;
  if (!inTok && !outTok) return 0;
  const delta = { inputTokens: inTok, outputTokens: outTok, calls: 1, neurons };
  // Written twice: the tier bucket gates that tier, the untiered key is the
  // all-visitors total the public meter shows.
  await addUsage(key(tier), delta);
  await addUsage(key(), delta);
  return neurons;
}

async function addUsage(k: string, delta: DailyUsage): Promise<void> {
  try {
    const cur = await readUsage(k);
    const next: DailyUsage = {
      inputTokens: cur.inputTokens + delta.inputTokens,
      outputTokens: cur.outputTokens + delta.outputTokens,
      calls: cur.calls + delta.calls,
      neurons: cur.neurons + delta.neurons,
    };
    const body = JSON.stringify(next);
    const kv = await kvBinding();
    if (kv) return void (await kv.put(k, body, { expirationTtl: secondsUntilNextUtcDay() }));
    const cache = edgeCache();
    if (cache) {
      return void (await cache.put(
        new Request("https://usage.example/" + k),
        new Response(body, { headers: { "Cache-Control": `max-age=${secondsUntilNextUtcDay()}` } }),
      ));
    }
    const g: any = globalThis as any;
    g.__usage ||= {};
    g.__usage[k] = next;
  } catch {}
}
