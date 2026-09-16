// Legacy quota endpoint for the /tools pages (QuotaBanner, CompareColumns…).
// Kept for those callers only — the Cells UI reads /api/me instead. Both now
// answer per tier, so an anonymous visitor is not told they have the
// signed-in allowance.

import { remainingDaily, resolveEntitlement } from "@/lib/billing/entitlement";
import { NEURONS_PER_CREDIT, rowsAffordable } from "@/lib/limits";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function readQuota(request: Request) {
  const ent = await resolveEntitlement(request);
  const daily = await remainingDaily(ent);
  // The allowance is kept in neurons now, but these callers only ever talk
  // about rows, so convert at the measured rate. The result is approximate —
  // it is exact only for short text — and `ctDownloadNote` / `quotaRemaining`
  // say "about" for that reason. `used` is derived by subtraction rather than
  // converted separately, so the three numbers always add up on screen.
  // A null `neuronsLeft` means the tier has no daily cap; the legacy callers
  // expect numbers, so both figures become the sentinel they already read as
  // "metered, no cap".
  if (daily.neuronsLeft === null) {
    return {
      limit: Number.MAX_SAFE_INTEGER,
      used: 0,
      remaining: Number.MAX_SAFE_INTEGER,
    };
  }
  const limit = rowsAffordable(ent.limits.dailyCredits * NEURONS_PER_CREDIT);
  const remaining = rowsAffordable(daily.neuronsLeft);
  const used = Math.max(0, limit - remaining);
  return { limit, used, remaining };
}

export async function GET(request: Request) {
  return json(await readQuota(request));
}

export async function POST(request: Request) {
  const q = await readQuota(request);
  let requested = 0;
  try {
    const body = await request.json();
    requested =
      Number(body?.requested ?? body?.total ?? body?.totalRows ?? 0) || 0;
  } catch {}
  const allowed = Math.max(0, Math.min(q.remaining, requested));
  return json({ ...q, requested, allowed, exceeds: requested > q.remaining });
}
