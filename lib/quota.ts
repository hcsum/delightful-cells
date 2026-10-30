// Soft per-user daily quota using Cloudflare KV when available (no DB).
// Falls back to edge cache or in-memory for local dev.

import { secondsUntilNextUtcDay } from "@/lib/date";
import { dailyNeurons } from "@/lib/limits";
import { getDb } from "@/lib/billing/db";

// Try Cloudflare KV first (stores cumulative rows used for the day)
async function checkAndConsumeRowsKV(
  userKey: string,
  amount: number,
  limit: number,
): Promise<boolean | null> {
  try {
    // Access KV binding via OpenNext Cloudflare context if available
    // Use dynamic import to avoid require() ESM issues in node scripts
    const mod = await import("@opennextjs/cloudflare");
    const ctx: any = mod.getCloudflareContext?.();
    const kv: any = ctx?.env?.UPLOAD_QUOTA;
    if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function")
      return null;

    const day = new Date().toISOString().slice(0, 10);
    const key = `quota:${day}:${userKey}`;

    const curStr = await kv.get(key);
    const cur = Number(curStr || "0") || 0;
    if (cur + amount > limit) return false;
    const next = String(cur + amount);
    const ttl = secondsUntilNextUtcDay();
    await kv.put(key, next, { expirationTtl: ttl });
    return true;
  } catch {
    return null;
  }
}

// Edge cache fallback (best effort)
async function checkAndConsumeRowsEdgeCache(
  userKey: string,
  amount: number,
  limit: number,
): Promise<boolean | null> {
  try {
    const cachesAny: any = (globalThis as any).caches;
    const cache: any = cachesAny?.default;
    if (
      !cache ||
      typeof cache.match !== "function" ||
      typeof cache.put !== "function"
    )
      return null;
    const day = new Date().toISOString().slice(0, 10);
    const key = `quota:${day}:${userKey}`;
    const req = new Request("https://quota.example/" + key);
    const hit = await cache.match(req);
    const cur = hit ? Number(await hit.text()) || 0 : 0;
    if (cur + amount > limit) return false;
    await cache.put(
      req,
      new Response(String(cur + amount), {
        headers: { "Cache-Control": `max-age=${secondsUntilNextUtcDay()}` },
      }),
    );
    return true;
  } catch {
    return null;
  }
}

// In-memory last resort (dev only, per-process)
function checkAndConsumeRowsMemory(
  userKey: string,
  amount: number,
  limit: number,
): boolean {
  const g: any = globalThis as any;
  g.__quota ||= new Map<string, { day: string; count: number }>();
  const day = new Date().toISOString().slice(0, 10);
  const rec = g.__quota.get(userKey);
  if (!rec || rec.day !== day) {
    g.__quota.set(userKey, { day, count: amount });
    return true;
  }
  if (rec.count + amount > limit) return false;
  rec.count += amount;
  g.__quota.set(userKey, rec);
  return true;
}

export async function addRowsToDailyQuota(
  userKey: string,
  amount: number,
  limit: number = dailyNeurons("anon"),
): Promise<boolean> {
  const kv = await checkAndConsumeRowsKV(userKey, amount, limit);
  if (kv != null) return kv;
  const edge = await checkAndConsumeRowsEdgeCache(userKey, amount, limit);
  if (edge != null) return edge;
  return checkAndConsumeRowsMemory(userKey, amount, limit);
}

// Read current used rows for the day without mutating state.
export async function getRowsUsedToday(userKey: string): Promise<number> {
  if (userKey.startsWith("neurons:")) {
    const db = await getDb();
    if (db) {
      const key = `user:${new Date().toISOString().slice(0, 10)}:${userKey}`;
      const row = await db.prepare("SELECT used + reserved AS used FROM ai_budget WHERE key = ?").bind(key).first<{ used: number }>();
      if (row) return row.used;
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("D1 quota storage unavailable");
    }
  }
  // Try KV
  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx: any = mod.getCloudflareContext?.();
    const kv: any = ctx?.env?.UPLOAD_QUOTA;
    if (kv && typeof kv.get === "function") {
      const day = new Date().toISOString().slice(0, 10);
      const key = `quota:${day}:${userKey}`;
      const curStr = await kv.get(key);
      const cur = Number(curStr || "0") || 0;
      console.log("kv found", key, cur);
      return cur;
    }
  } catch {}
  // Try edge cache
  try {
    const g: any = globalThis as any;
    const rec = g.__quota?.get?.(userKey);
    const day = new Date().toISOString().slice(0, 10);
    if (rec && rec.day === day) return Number(rec.count || 0) || 0;
  } catch {}
  return 0;
}
