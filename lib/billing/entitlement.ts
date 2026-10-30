// Who is asking, what they are allowed today, and whether this particular call
// is paid for by the daily free allowance or by their credit balance.
//
// The order is always: identity → free allowance → credits. A signed-in user
// with credits still burns the free allowance first, so a purchase always adds
// to what they had rather than replacing it.

import { NEURONS_PER_CREDIT, TIER_LIMITS, type Tier } from "@/lib/limits";
import { addRowsToDailyQuota, getRowsUsedToday } from "@/lib/quota";
import { getQuotaKeyFromRequest, getUserIdFromRequest } from "@/lib/auth/session";
import { getBalanceNeurons } from "@/lib/billing/credits";

export type Entitlement = {
  /** Who they are: anon or a signed-in free user. Never "paid" — see `tier`. */
  baseTier: "anon" | "free";
  /** How THIS request is billed. "paid" only once the free allowance is gone. */
  tier: Tier;
  userId: string | null;
  quotaKey: string;
  balanceNeurons: number;
  limits: (typeof TIER_LIMITS)[Tier];
};

export type Billing =
  | { mode: "free" }
  | { mode: "paid" }
  | { mode: "exceeded"; reason: "daily" };

// Our own accounts, so a load test on production is not fought by the daily
// allowance. Comma-separated emails in UNLIMITED_ACCOUNTS, matched against the
// quota key (which is the signed-in user's lowercased email). Unset means the
// set is empty and nothing changes — never let this default to open.
//
// It lifts the free allowance ONLY. The site neuron budget still applies, so
// an internal account cannot quietly run up the bill, and nothing is deducted
// from credits because the tier stays `free`.
function isUnlimitedAccount(quotaKey: string, signedIn: boolean): boolean {
  if (!signedIn) return false;
  const raw = process.env.UNLIMITED_ACCOUNTS;
  if (!raw) return false;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(quotaKey.toLowerCase());
}

export async function resolveEntitlement(req: Request): Promise<Entitlement> {
  const userId = await getUserIdFromRequest(req);
  const quotaKey = await getQuotaKeyFromRequest(req);
  const baseTier: "anon" | "free" = userId ? "free" : "anon";
  const unlimited = isUnlimitedAccount(quotaKey, userId !== null);
  // Only signed-in users can hold a balance; anonymous visitors have no row to
  // read, so don't touch D1 for them.
  let balanceNeurons = 0;
  if (userId) {
    try {
      balanceNeurons = await getBalanceNeurons(userId);
    } catch {
      // A D1 hiccup must not take AI down for free users; it only means this
      // request cannot be billed to credits.
      balanceNeurons = 0;
    }
  }
  return {
    baseTier,
    tier: baseTier,
    userId,
    quotaKey,
    balanceNeurons,
    // TIER_LIMITS.paid is Infinity per day, which every caller already handles:
    // billFreeCall compares against it and always passes, remainingDaily
    // reports null, and the UI renders that as "unlimited".
    limits: unlimited ? TIER_LIMITS.paid : TIER_LIMITS[baseTier],
  };
}

/** The entitlement as it looks once this request is billed to credits. */
export function asPaid(ent: Entitlement): Entitlement {
  return { ...ent, tier: "paid", limits: TIER_LIMITS.paid };
}

/**
 * The daily free allowance, for one model call — chat or rows, they are the
 * same bucket now. Called BEFORE the worker, so all it can do is check the
 * counter; what the call actually cost is only known afterwards and lands via
 * `commitFreeNeurons`.
 *
 * The D1 inference guard serializes each identity and reserves both the site
 * and personal budget before inference. The final free call may still overshoot
 * its personal allowance, but concurrent calls cannot all spend that last turn.
 * Paid calls prepay a hold instead; see lib/billing/guard.ts.
 */
export async function billFreeCall(ent: Entitlement): Promise<Billing> {
  const limit = allowanceNeurons(ent);
  const used = await getRowsUsedToday(neuronKey(ent));
  if (used < limit) return { mode: "free" };
  if (ent.balanceNeurons > 0) return { mode: "paid" };
  return { mode: "exceeded", reason: "daily" };
}

/**
 * Mirror measured free usage into the legacy KV counter. The authoritative D1
 * allowance was already settled atomically by the inference guard. The amount is
 * llm-worker's `x-usage-neurons`, i.e. Cloudflare's own bill — never a local
 * estimate, so a chat turn and a 100-row batch are compared on the same scale.
 *
 * No limit is passed: `billFreeCall` already decided this call was allowed, and
 * a counter that refuses to record an overshoot would make the allowance look
 * untouched the moment someone crossed it.
 */
export async function commitFreeNeurons(
  ent: Entitlement,
  neurons: number,
): Promise<void> {
  if (neurons <= 0) return;
  await addRowsToDailyQuota(neuronKey(ent), neurons, Infinity);
}

function neuronKey(ent: Entitlement): string {
  return `neurons:${ent.quotaKey}`;
}

// Read off `ent.limits`, not the tier: an UNLIMITED_ACCOUNTS address keeps the
// `free` tier and carries the paid (Infinity) allowance, and reading the tier
// would quietly put it back on the 20-credit bucket.
function allowanceNeurons(ent: Entitlement): number {
  return ent.limits.dailyCredits * NEURONS_PER_CREDIT;
}

/** Today's free allowance still left, for /api/me. Infinity → null (unbounded). */
export async function remainingDaily(ent: Entitlement) {
  const neuronsUsed = await getRowsUsedToday(neuronKey(ent));
  const limit = allowanceNeurons(ent);
  const neuronsLeft = Number.isFinite(limit)
    ? Math.max(0, limit - neuronsUsed)
    : null;
  return {
    neuronsUsed,
    neuronsLeft,
    // Floored, because a partial credit is not something anyone can spend and
    // rounding up would promise a call that may not fit.
    creditsLeft:
      neuronsLeft === null ? null : Math.floor(neuronsLeft / NEURONS_PER_CREDIT),
  };
}
