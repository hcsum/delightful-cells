import { getQuotaKeyFromRequest, getUserIdFromRequest } from "@/lib/auth/session";
import { requireDb } from "@/lib/billing/db";
import type { Entitlement } from "@/lib/billing/entitlement";
import { NEURONS_PER_CREDIT, SITE_NEURON_BUDGET } from "@/lib/limits";
import { getRowsUsedToday } from "@/lib/quota";
import { getUsageToday } from "@/lib/usage";

// Conservative reservation for a bounded 24k-character input / 2048-token output.
// Actual usage replaces it on settlement. Unknown outcomes retain this cost so
// disconnects, missing usage and upstream failures cannot reset the circuit breaker.
const CALL_RESERVATION = 2048;
const day = () => new Date().toISOString().slice(0, 10);
const siteKey = (tier: string) => `site:${day()}:${tier}`;
export const userBudgetKey = (quotaKey: string) => `user:${day()}:neurons:${quotaKey}`;

function unavailable() {
  return Response.json({ error: "billing_unavailable", message: "Billing is temporarily unavailable." }, { status: 503 });
}

export function withInferenceLock(handler: (request: Request, ref: string) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const ref = crypto.randomUUID();
    try {
      const db = await requireDb();
      const userId = await getUserIdFromRequest(request);
      const identity = userId ? `user:${userId}` : await getQuotaKeyFromRequest(request);
      await db.batch([
        db.prepare("DELETE FROM ai_identity_lock WHERE identity = ? AND expires_at < ?").bind(identity, Date.now()),
        db.prepare("INSERT OR IGNORE INTO ai_identity_lock (identity, ref, expires_at) VALUES (?, ?, ?)")
          .bind(identity, ref, Date.now() + 600_000),
      ]);
      const claim = await db.prepare("SELECT ref FROM ai_identity_lock WHERE ref = ?").bind(ref).first();
      if (!claim) return Response.json(
        { error: "request_in_progress", message: "Wait for your current AI request to finish." },
        { status: 429, headers: { "Retry-After": "2", "Cache-Control": "no-store" } },
      );
      try {
        const response = await handler(request, ref);
        // Streaming owns the lock until its background pump has settled, even
        // when the browser disconnects. Early JSON errors are released here.
        if (!response.headers.get("content-type")?.startsWith("text/event-stream")) await finishInference(ref);
        return response;
      } catch (error) {
        await finishInference(ref);
        throw error;
      }
    } catch (error) {
      console.error("[billing] inference guard failed", String(error));
      return unavailable();
    }
  };
}

export async function reserveInferenceBudget(ent: Entitlement, ref: string, reason: "chat" | "process" = "chat"): Promise<boolean> {
  if (ent.tier === "paid") {
    if (!ent.userId) throw new Error("Paid inference requires a user");
    const db = await requireDb();
    await db.batch([
      db.prepare(`INSERT INTO ai_credit_reservation (ref, user_id, amount)
        SELECT ?, user_id, MIN(balance_neurons, ?) FROM credit_balance
        WHERE user_id = ? AND balance_neurons > 0`).bind(ref, CALL_RESERVATION, ent.userId),
      db.prepare(`UPDATE credit_balance SET balance_neurons = balance_neurons -
        (SELECT amount FROM ai_credit_reservation WHERE ref = ?), updated_at = ?
        WHERE user_id = ? AND EXISTS (SELECT 1 FROM ai_credit_reservation WHERE ref = ?)`)
        .bind(ref, Date.now(), ent.userId, ref),
      db.prepare(`INSERT INTO credit_ledger (id, user_id, delta, reason, ref, created_at)
        SELECT ?, user_id, -amount, ?, ?, ? FROM ai_credit_reservation WHERE ref = ?`)
        .bind(crypto.randomUUID(), reason, `${ref}:hold`, Date.now(), ref),
    ]);
    const hold = await db.prepare("SELECT amount FROM ai_credit_reservation WHERE ref = ?").bind(ref).first();
    if (!hold) throw new Error("Credit balance was exhausted before reservation");
    return true;
  }
  const db = await requireDb();
  const site = siteKey(ent.baseTier);
  const user = userBudgetKey(ent.quotaKey);
  const [legacySite, legacyUser] = await Promise.all([
    getUsageToday(ent.baseTier), getRowsUsedToday(`neurons:${ent.quotaKey}`),
  ]);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO ai_budget (key, used) VALUES (?, ?)").bind(site, legacySite.neurons),
    db.prepare("INSERT OR IGNORE INTO ai_budget (key, used) VALUES (?, ?)").bind(user, legacyUser),
    db.prepare(`UPDATE ai_budget SET reserved = reserved + ?
      WHERE key = ? AND used + reserved + ? <= ?
      AND (SELECT used + reserved FROM ai_budget WHERE key = ?) < ?`)
      .bind(CALL_RESERVATION, site, CALL_RESERVATION, SITE_NEURON_BUDGET[ent.baseTier], user,
        Number.isFinite(ent.limits.dailyCredits) ? ent.limits.dailyCredits * NEURONS_PER_CREDIT : Number.MAX_SAFE_INTEGER),
    db.prepare(`INSERT INTO ai_budget_reservation (ref, site_key, user_key, amount)
      SELECT ?, ?, ?, ? WHERE changes() = 1`).bind(ref, site, user, CALL_RESERVATION),
    db.prepare(`UPDATE ai_budget SET reserved = reserved + ? WHERE key = ?
      AND EXISTS (SELECT 1 FROM ai_budget_reservation WHERE ref = ?)`)
      .bind(CALL_RESERVATION, user, ref),
  ]);
  return !!await db.prepare("SELECT ref FROM ai_budget_reservation WHERE ref = ?").bind(ref).first();
}

export async function settleInferenceBudget(ref: string, neurons: number | null): Promise<void> {
  const db = await requireDb();
  const cost = neurons !== null && Number.isFinite(neurons) && neurons >= 0 ? neurons : CALL_RESERVATION;
  // D1 batch is transactional. The settled marker protects both counters from
  // retries; unlike KV, concurrent visitors cannot overwrite one another.
  await db.batch([
    db.prepare(`UPDATE ai_budget SET used = used + ?, reserved = reserved -
      (SELECT amount FROM ai_budget_reservation WHERE ref = ?)
      WHERE key = (SELECT site_key FROM ai_budget_reservation WHERE ref = ? AND settled = 0)`)
      .bind(cost, ref, ref),
    db.prepare(`UPDATE ai_budget SET used = used + ?, reserved = reserved -
      (SELECT amount FROM ai_budget_reservation WHERE ref = ?)
      WHERE key = (SELECT user_key FROM ai_budget_reservation WHERE ref = ? AND settled = 0)`)
      .bind(cost, ref, ref),
    db.prepare("UPDATE ai_budget_reservation SET settled = 1 WHERE ref = ? AND settled = 0").bind(ref),
  ]);
}

export async function finishInference(ref: string): Promise<void> {
  await settleInferenceBudget(ref, null);
  const db = await requireDb();
  await db.prepare("DELETE FROM ai_identity_lock WHERE ref = ?").bind(ref).run();
}

// A paid inference is prepaid, then its unused hold is returned atomically.
// Unknown outcomes keep the hold; they cannot be retried indefinitely for free.
export async function settleCreditReservation(ref: string, neurons: number): Promise<number> {
  const db = await requireDb();
  const row = await db.prepare("SELECT amount, settled FROM ai_credit_reservation WHERE ref = ?")
    .bind(ref).first<{ amount: number; settled: number }>();
  if (!row) throw new Error("Missing credit reservation");
  if (row.settled) return 0;
  if (!Number.isFinite(neurons) || neurons < 0) throw new Error("Invalid measured usage");
  const charged = Math.min(row.amount, Math.ceil(neurons));
  const refund = row.amount - charged;
  await db.batch([
    db.prepare(`UPDATE credit_balance SET balance_neurons = balance_neurons + ?, updated_at = ?
      WHERE user_id = (SELECT user_id FROM ai_credit_reservation WHERE ref = ? AND settled = 0)`)
      .bind(refund, Date.now(), ref),
    db.prepare(`INSERT INTO credit_ledger (id, user_id, delta, reason, ref, created_at)
      SELECT ?, user_id, ?, 'refund', ?, ? FROM ai_credit_reservation WHERE ref = ? AND settled = 0 AND ? > 0`)
      .bind(crypto.randomUUID(), refund, `${ref}:release`, Date.now(), ref, refund),
    db.prepare("UPDATE ai_credit_reservation SET settled = 1 WHERE ref = ? AND settled = 0").bind(ref),
  ]);
  return charged;
}

export async function refundRejectedInference(ref: string): Promise<void> {
  await settleInferenceBudget(ref, 0);
  const db = await requireDb();
  if (await db.prepare("SELECT ref FROM ai_credit_reservation WHERE ref = ?").bind(ref).first()) {
    await settleCreditReservation(ref, 0);
  }
}

export async function readSiteBudget(tier: string): Promise<number> {
  const db = await requireDb();
  const row = await db.prepare("SELECT used + reserved AS total FROM ai_budget WHERE key = ?")
    .bind(siteKey(tier)).first<{ total: number }>();
  return row?.total ?? (await getUsageToday(tier as Entitlement["baseTier"])).neurons;
}
