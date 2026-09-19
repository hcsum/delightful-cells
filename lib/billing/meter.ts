// Turn what a call actually cost into a deduction from the user's balance.
//
// The amount comes from llm-worker's x-usage-neurons header, i.e. what
// Cloudflare billed us, never from a local estimate. That is why balances are
// stored in neurons: a 50-row batch costs a fraction of a credit and rounding
// each call up to a whole credit would overcharge several times over.

import { spendNeurons, type LedgerReason } from "@/lib/billing/credits";
import { getDb } from "@/lib/billing/db";
import { commitFreeNeurons, type Entitlement } from "@/lib/billing/entitlement";
import { recordMeasuredUsage, recordUsageFromHeaders } from "@/lib/usage";

export type MeasuredUsage = {
  inputTokens: number;
  outputTokens: number;
  neurons: number;
};

/**
 * What this call cost us, recorded against the site-wide budget. Always do this
 * once the worker has answered, even if the answer turns out to be unusable:
 * Cloudflare charged us for the inference either way, and the site budget is
 * the only thing standing between a misbehaving worker and an open-ended bill.
 * Returns the neurons the call cost (0 when unmetered).
 */
export async function recordSiteUsage(
  headers: Headers,
  ent: Entitlement,
): Promise<number> {
  return recordUsageFromHeaders(headers, ent.tier);
}

/**
 * Deduct an already-measured cost from the user's balance. Split out from
 * `meterAndCharge` so a caller that can only tell success from failure *after*
 * reading the body can record the site cost immediately and charge the user
 * last. Returns the neurons deducted (0 when the call was free).
 */
export async function chargeNeurons(
  ent: Entitlement,
  neurons: number,
  reason: LedgerReason,
  ref: string,
): Promise<number> {
  if (ent.tier !== "paid" || !ent.userId || neurons <= 0) return 0;
  try {
    return await spendNeurons(ent.userId, neurons, reason, ref);
  } catch {
    // Losing a deduction is better than failing a call the user already got the
    // result of; the site-wide meter still recorded the spend.
    return 0;
  }
}

/**
 * Record site usage and settle what the call cost: against the credit balance
 * when this call is paid, against today's free allowance when it is not.
 * Both halves read the same measured number, which is the whole point of
 * metering free in neurons — a free day and a paid day are the same arithmetic.
 * Returns the neurons deducted from the balance (0 when the call was free).
 */
export async function meterAndCharge(
  headers: Headers,
  ent: Entitlement,
  reason: LedgerReason,
  ref: string,
  settlementClaimed = false,
): Promise<number> {
  if (!settlementClaimed) {
    const claim = await reserveSettlement(ref, reason);
    if (claim === "duplicate") return 0;
  }
  const neurons = await recordSiteUsage(headers, ent);
  const charged = await chargeNeurons(ent, neurons, reason, ref);
  if (ent.tier !== "paid") await commitFreeNeurons(ent, neurons);
  return charged;
}

export async function meterAndChargeUsage(
  usage: MeasuredUsage,
  ent: Entitlement,
  reason: LedgerReason,
  ref: string,
  settlementClaimed = false,
): Promise<number> {
  if (!settlementClaimed) {
    const claim = await reserveSettlement(ref, reason);
    if (claim === "duplicate") return 0;
  }
  const neurons = await recordMeasuredUsage(usage, ent.tier);
  const charged = await chargeNeurons(ent, neurons, reason, ref);
  if (ent.tier !== "paid") await commitFreeNeurons(ent, neurons);
  return charged;
}

/** Reserve idempotent settlement before starting a billable inference. */
export async function reserveSettlement(
  ref: string,
  reason: LedgerReason,
): Promise<"claimed" | "duplicate"> {
  const claim = await claimSettlement(ref, reason);
  if (claim === "unavailable") throw new Error("Billing settlement is unavailable");
  return claim;
}

async function claimSettlement(
  ref: string,
  reason: LedgerReason,
): Promise<"claimed" | "duplicate" | "unavailable"> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db
        .prepare("INSERT OR IGNORE INTO ai_settlement (ref, reason, created_at) VALUES (?, ?, ?)")
        .bind(ref, reason, Date.now())
        .run();
      return result.meta.changes > 0 ? "claimed" : "duplicate";
    } catch (error) {
      // Fail closed when persistent idempotency is unavailable: the user can
      // still receive an already-generated result, but it must not be charged
      // twice by falling back to an isolate-local marker.
      console.error("[ALERT][billing] settlement claim failed", { ref, reason, error: String(error) });
      return "unavailable";
    }
  }
  const global = globalThis as typeof globalThis & { __aiSettlements?: Set<string> };
  global.__aiSettlements ||= new Set<string>();
  const key = `${reason}:${ref}`;
  if (global.__aiSettlements.has(key)) return "duplicate";
  global.__aiSettlements.add(key);
  return "claimed";
}
