// Soft per-user daily quota using Cloudflare KV when available (no DB).
// Falls back to edge cache or in-memory for local dev.

import { secondsUntilNextUtcDay } from '@/lib/date'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'

// Try Cloudflare KV first (stores cumulative rows used for the day)
async function checkAndConsumeRowsKV(userKey: string, amount: number): Promise<boolean | null> {
  try {
    // Access KV binding via OpenNext Cloudflare context if available
    // Use dynamic import to avoid require() ESM issues in node scripts
    const mod = await import('@opennextjs/cloudflare')
    const ctx: any = mod.getCloudflareContext?.()
    const kv: any = ctx?.env?.UPLOAD_QUOTA
    if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') return null

    const day = new Date().toISOString().slice(0, 10)
    const key = `quota:${day}:${userKey}`

    const curStr = await kv.get(key)
    const cur = Number(curStr || '0') || 0
    if (cur + amount > DAILY_ROWS_LIMIT) return false
    const next = String(cur + amount)
    const ttl = secondsUntilNextUtcDay()
    await kv.put(key, next, { expirationTtl: ttl })
    return true
  } catch {
    return null
  }
}

// Edge cache fallback (best effort)
async function checkAndConsumeRowsEdgeCache(userKey: string, amount: number): Promise<boolean | null> {
  try {
    const cachesAny: any = (globalThis as any).caches
    const cache: any = cachesAny?.default
    if (!cache || typeof cache.match !== 'function' || typeof cache.put !== 'function') return null
    const day = new Date().toISOString().slice(0, 10)
    const key = `quota:${day}:${userKey}`
    const req = new Request('https://quota.example/' + key)
    const hit = await cache.match(req)
    const cur = hit ? (Number(await hit.text()) || 0) : 0
    if (cur + amount > DAILY_ROWS_LIMIT) return false
    await cache.put(req, new Response(String(cur + amount), { headers: { 'Cache-Control': `max-age=${secondsUntilNextUtcDay()}` } }))
    return true
  } catch {
    return null
  }
}

// In-memory last resort (dev only, per-process)
function checkAndConsumeRowsMemory(userKey: string, amount: number): boolean {
  const g: any = globalThis as any
  g.__quota ||= new Map<string, { day: string; count: number }>()
  const day = new Date().toISOString().slice(0, 10)
  const rec = g.__quota.get(userKey)
  if (!rec || rec.day !== day) {
    g.__quota.set(userKey, { day, count: amount })
    return true
  }
  if (rec.count + amount > DAILY_ROWS_LIMIT) return false
  rec.count += amount
  g.__quota.set(userKey, rec)
  return true
}

export async function addRowsToDailyQuota(userKey: string, amount: number): Promise<boolean> {
  const kv = await checkAndConsumeRowsKV(userKey, amount)
  if (kv != null) return kv
  const edge = await checkAndConsumeRowsEdgeCache(userKey, amount)
  if (edge != null) return edge
  return checkAndConsumeRowsMemory(userKey, amount)
}

// Read current used rows for the day without mutating state.
export async function getRowsUsedToday(userKey: string): Promise<number> {
  // Try KV
  try {
    const mod = await import('@opennextjs/cloudflare')
    const ctx: any = mod.getCloudflareContext?.()
    const kv: any = ctx?.env?.UPLOAD_QUOTA
    if (kv && typeof kv.get === 'function') {
      const day = new Date().toISOString().slice(0, 10)
      const key = `quota:${day}:${userKey}`
      const curStr = await kv.get(key)
      const cur = Number(curStr || '0') || 0
      return cur
    }
  } catch {}
  // Try edge cache
  try {
    const cachesAny: any = (globalThis as any).caches
    const cache: any = cachesAny?.default
    if (cache && typeof cache.match === 'function') {
      const day = new Date().toISOString().slice(0, 10)
      const key = `quota:${day}:${userKey}`
      const req = new Request('https://quota.example/' + key)
      const hit = await cache.match(req)
      const cur = hit ? (Number(await hit.text()) || 0) : 0
      return cur
    }
  } catch {}
  // Memory fallback
  try {
    const g: any = globalThis as any
    const rec = g.__quota?.get?.(userKey)
    const day = new Date().toISOString().slice(0, 10)
    if (rec && rec.day === day) return Number(rec.count || 0) || 0
  } catch {}
  return 0
}

// Ensure we only count a single increment per logical request id (rid).
// This makes counting robust even if the client batches the download into multiple API calls.
export async function ensureSingleRowIncrement(userKey: string, rid: string, amount: number): Promise<boolean> {
  // 1) KV strategy
  try {
    const mod = await import('@opennextjs/cloudflare')
    const ctx: any = mod.getCloudflareContext?.()
    const kv: any = ctx?.env?.UPLOAD_QUOTA
    if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
      const ridKey = `rid:${rid}`
      const exists = await kv.get(ridKey)
      if (exists) return true // already counted for this rid
      const ok = await addRowsToDailyQuota(userKey, amount)
      if (!ok) return false
      // Short TTL; enough to cover the in-flight batch window
      await kv.put(ridKey, '1', { expirationTtl: 60 * 30 }) // 30 minutes
      return true
    }
  } catch {}

  // 2) Edge cache fallback
  try {
    const cachesAny: any = (globalThis as any).caches
    const cache: any = cachesAny?.default
    if (cache && typeof cache.match === 'function' && typeof cache.put === 'function') {
      const req = new Request('https://quota.example/rid/' + encodeURIComponent(rid))
      const hit = await cache.match(req)
      if (hit) return true
      const ok = await addRowsToDailyQuota(userKey, amount)
      if (!ok) return false
      await cache.put(req, new Response('1', { headers: { 'Cache-Control': 'max-age=1800' } }))
      return true
    }
  } catch {}

  // 3) Memory fallback (dev only)
  const g: any = globalThis as any
  g.__quota_rid ||= new Set<string>()
  if (g.__quota_rid.has(rid)) return true
  const ok = await addRowsToDailyQuota(userKey, amount)
  if (!ok) return false
  g.__quota_rid.add(rid)
  return true
}
