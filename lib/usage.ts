// Site-wide daily AI usage counter (tokens in/out, calls) so the homepage can
// show "today's usage" without any Cloudflare analytics token. Storage mirrors
// lib/quota.ts: KV → edge cache → in-memory (dev). Not atomic; display only.

import { secondsUntilNextUtcDay } from "@/lib/date";

export type DailyUsage = { inputTokens: number; outputTokens: number; calls: number };

// Workers AI bills in "neurons" ($0.011 per 1k). Per-token coefficients for the
// model llm-worker uses, derived from its list price ($0.27 / $0.85 per 1M):
export const NEURONS_PER_INPUT_TOKEN = 0.27 / 1_000_000 / 0.011 * 1000;
export const NEURONS_PER_OUTPUT_TOKEN = 0.85 / 1_000_000 / 0.011 * 1000;
export const FREE_NEURONS_PER_DAY = 10_000;

// Hard stop before the free tier runs out. Cloudflare bills anything above
// 10k neurons/day, so the site refuses new AI calls once today's estimate hits it.
export async function isFreeTierExhausted(): Promise<boolean> {
  return neuronsFor(await getUsageToday()) >= FREE_NEURONS_PER_DAY;
}

export function neuronsFor(u: DailyUsage): number {
  return u.inputTokens * NEURONS_PER_INPUT_TOKEN + u.outputTokens * NEURONS_PER_OUTPUT_TOKEN;
}

const ZERO: DailyUsage = { inputTokens: 0, outputTokens: 0, calls: 0 };
const key = () => `usage:${new Date().toISOString().slice(0, 10)}`;

function parse(raw: string | null | undefined): DailyUsage {
  try {
    const j = raw ? JSON.parse(raw) : null;
    return j && typeof j === "object"
      ? {
          inputTokens: Number(j.inputTokens) || 0,
          outputTokens: Number(j.outputTokens) || 0,
          calls: Number(j.calls) || 0,
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

export async function getUsageToday(): Promise<DailyUsage> {
  const k = key();
  const kv = await kvBinding();
  if (kv) return parse(await kv.get(k));
  const cache = edgeCache();
  if (cache) {
    const hit = await cache.match(new Request("https://usage.example/" + k));
    return parse(hit ? await hit.text() : null);
  }
  const g: any = globalThis as any;
  return g.__usage?.day === k ? g.__usage.value : { ...ZERO };
}

// Read from upstream headers set by llm-worker; no-op when absent (e.g. mock).
export async function recordUsageFromHeaders(headers: Headers): Promise<void> {
  const inTok = Number(headers.get("x-usage-in")) || 0;
  const outTok = Number(headers.get("x-usage-out")) || 0;
  if (!inTok && !outTok) return;
  try {
    const cur = await getUsageToday();
    const next: DailyUsage = {
      inputTokens: cur.inputTokens + inTok,
      outputTokens: cur.outputTokens + outTok,
      calls: cur.calls + 1,
    };
    const k = key();
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
    (globalThis as any).__usage = { day: k, value: next };
  } catch {}
}
