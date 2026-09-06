// Legacy quota endpoint for the /tools pages (QuotaBanner, CompareColumns…).
// Kept for those callers only — the Cells UI reads /api/me instead. Both now
// answer per tier, so an anonymous visitor is not told they have the
// signed-in allowance.

import { remainingDaily, resolveEntitlement } from "@/lib/billing/entitlement";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function readQuota(request: Request) {
  const ent = await resolveEntitlement(request);
  const daily = await remainingDaily(ent);
  // rowsLeft is null when the tier has no daily cap; the legacy callers expect
  // numbers, so report the balance as headroom in that case.
  const limit = Number.isFinite(ent.limits.rowsPerDay)
    ? ent.limits.rowsPerDay
    : Number.MAX_SAFE_INTEGER;
  const remaining = daily.rowsLeft ?? Number.MAX_SAFE_INTEGER;
  return { limit, used: daily.rowsUsed, remaining };
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
