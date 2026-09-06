// Turn what a call actually cost into a deduction from the user's balance.
//
// The amount comes from llm-worker's x-usage-neurons header, i.e. what
// Cloudflare billed us, never from a local estimate. That is why balances are
// stored in neurons: a 50-row batch costs a fraction of a credit and rounding
// each call up to a whole credit would overcharge several times over.

import { spendNeurons, type LedgerReason } from "@/lib/billing/credits";
import type { Entitlement } from "@/lib/billing/entitlement";
import { recordUsageFromHeaders } from "@/lib/usage";

/**
 * Record site usage and, when this call is billed to credits, deduct it.
 * Returns the neurons deducted (0 when the call was free or unmetered).
 */
export async function meterAndCharge(
  headers: Headers,
  ent: Entitlement,
  reason: LedgerReason,
  ref: string,
): Promise<number> {
  const neurons = await recordUsageFromHeaders(headers, ent.tier);
  if (ent.tier !== "paid" || !ent.userId || neurons <= 0) return 0;
  try {
    return await spendNeurons(ent.userId, neurons, reason, ref);
  } catch {
    // Losing a deduction is better than failing a call the user already got the
    // result of; the site-wide meter above still recorded the spend.
    return 0;
  }
}
