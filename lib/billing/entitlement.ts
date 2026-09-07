// Who is asking, what they are allowed today, and whether this particular call
// is paid for by the daily free allowance or by their credit balance.
//
// The order is always: identity → free allowance → credits. A signed-in user
// with credits still burns the free allowance first, so a purchase always adds
// to what they had rather than replacing it.

import { TIER_LIMITS, type Tier } from "@/lib/limits";
import {
  addRowsToDailyQuota,
  ensureSingleRowIncrement,
  getRowsUsedToday,
} from "@/lib/quota";
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
  | { mode: "exceeded"; reason: "daily" | "per_turn" };

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
    // billRows/billChatTurn compare against it and always pass, remainingDaily
    // reports null, and the UI renders that as "unlimited".
    limits: unlimited ? TIER_LIMITS.paid : TIER_LIMITS[baseTier],
  };
}

/** The entitlement as it looks once this request is billed to credits. */
export function asPaid(ent: Entitlement): Entitlement {
  return { ...ent, tier: "paid", limits: TIER_LIMITS.paid };
}

/**
 * One chat *turn*, not one model call: the agent loop fires up to MAX_STEPS
 * requests per turn and the server cannot tell them apart, so the client sends
 * a turn id and only its first request consumes the allowance.
 *
 * The per-turn call cap is the backstop against a forged turn id being reused
 * forever to make the allowance look untouched.
 */
export const MAX_CALLS_PER_TURN = 8;

export async function guardTurnCalls(turnId: string): Promise<boolean> {
  return addRowsToDailyQuota(`turn:${turnId}`, 1, MAX_CALLS_PER_TURN);
}

export async function billChatTurn(
  ent: Entitlement,
  turnId: string,
): Promise<Billing> {
  const withinDaily = await ensureSingleRowIncrement(
    `chat:${ent.quotaKey}`,
    `turn:${turnId}`,
    1,
    ent.limits.chatTurns,
  );
  if (withinDaily) return { mode: "free" };
  if (ent.balanceNeurons > 0) return { mode: "paid" };
  return { mode: "exceeded", reason: "daily" };
}

/**
 * Rows for one /api/process batch. Checked before calling the worker and
 * charged after it succeeds, so a worker error costs the user nothing —
 * `commitRows` is the second half.
 */
export async function billRows(
  ent: Entitlement,
  rows: number,
): Promise<Billing> {
  if (rows <= 0) return { mode: "free" };
  const used = await getRowsUsedToday(ent.quotaKey);
  if (used + rows <= ent.limits.rowsPerDay) return { mode: "free" };
  if (ent.balanceNeurons > 0) return { mode: "paid" };
  return { mode: "exceeded", reason: "daily" };
}

export async function commitRows(ent: Entitlement, rows: number): Promise<void> {
  if (rows <= 0) return;
  await addRowsToDailyQuota(ent.quotaKey, rows, ent.limits.rowsPerDay);
}

/** Today's free allowance still left, for /api/me. Infinity → null (unbounded). */
export async function remainingDaily(ent: Entitlement) {
  const [rowsUsed, turnsUsed] = await Promise.all([
    getRowsUsedToday(ent.quotaKey),
    getRowsUsedToday(`chat:${ent.quotaKey}`),
  ]);
  const left = (limit: number, used: number) =>
    Number.isFinite(limit) ? Math.max(0, limit - used) : null;
  return {
    rowsUsed,
    rowsLeft: left(ent.limits.rowsPerDay, rowsUsed),
    turnsUsed,
    turnsLeft: left(ent.limits.chatTurns, turnsUsed),
  };
}
