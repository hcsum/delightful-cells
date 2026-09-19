// Credit balance and ledger. Balances live in neurons (see migrations/0002).
//
// Spending is a single conditional UPDATE so concurrent calls cannot both read
// the same balance and both spend it. KV (lib/quota.ts) is read-modify-write
// and fine for soft quotas, but not for money.

import { NEURONS_PER_CREDIT } from "@/lib/limits";
import { requireDb, type D1, type D1Statement } from "@/lib/billing/db";

export type LedgerReason = "purchase" | "chat" | "process" | "refund" | "adjust";

export type LedgerEntry = {
  id: string;
  delta: number;
  reason: LedgerReason;
  ref: string | null;
  created_at: number;
};

export function creditsFromNeurons(neurons: number): number {
  return Math.floor(neurons / NEURONS_PER_CREDIT);
}

function ledgerId(): string {
  return `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getBalanceNeurons(userId: string): Promise<number> {
  const db = await requireDb();
  const row = await db
    .prepare("SELECT balance_neurons FROM credit_balance WHERE user_id = ?")
    .bind(userId)
    .first<{ balance_neurons: number }>();
  return Number(row?.balance_neurons ?? 0) || 0;
}

/**
 * Deduct `neurons`, clamped so the balance never goes negative, and record what
 * was actually taken. Returns the amount deducted (0 when the balance was
 * already empty). Overdraft is bounded by one in-flight call — worth at most a
 * credit or so — which is cheaper than serializing every request.
 */
export async function spendNeurons(
  userId: string,
  neurons: number,
  reason: LedgerReason,
  ref?: string | null,
): Promise<number> {
  if (!(neurons > 0)) return 0;
  const db = await requireDb();
  const now = Date.now();
  const before = await getBalanceNeurons(userId);
  if (before <= 0) return 0;
  const spent = Math.min(before, Math.round(neurons));
  if (ref) {
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO credit_ledger (id, user_id, delta, reason, ref, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(ledgerId(), userId, -spent, reason, ref, now),
        db
          .prepare(
            `UPDATE credit_balance
               SET balance_neurons = MAX(0, balance_neurons - ?), updated_at = ?
             WHERE user_id = ?`,
          )
          .bind(spent, now, userId),
      ]);
      return spent;
    } catch {
      // A duplicate (reason, ref) rolls the batch back, including the balance
      // update, so replaying the same request is a no-op.
      return 0;
    }
  }
  const res = await db
    .prepare(
      `UPDATE credit_balance
         SET balance_neurons = MAX(0, balance_neurons - ?), updated_at = ?
       WHERE user_id = ?`,
    )
    .bind(spent, now, userId)
    .run();
  if (!res.meta.changes) return 0;
  await insertLedger(db, userId, -spent, reason, null, now);
  return spent;
}

/** Add neurons and record the entry. Used by the Stripe webhook and by refunds. */
export async function grantNeurons(
  userId: string,
  neurons: number,
  reason: LedgerReason,
  ref?: string | null,
): Promise<void> {
  const db = await requireDb();
  const now = Date.now();
  await db.batch(grantStatements(db, userId, Math.round(neurons), reason, ref ?? null, now));
}

/**
 * The statements a top-up needs, so the webhook can run them inside one batch
 * together with its own idempotency insert.
 */
export function grantStatements(
  db: D1,
  userId: string,
  neurons: number,
  reason: LedgerReason,
  ref: string | null,
  now: number,
): D1Statement[] {
  return [
    db
      .prepare(
        `INSERT INTO credit_balance (user_id, balance_neurons, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE
           SET balance_neurons = balance_neurons + excluded.balance_neurons,
               updated_at = excluded.updated_at`,
      )
      .bind(userId, neurons, now),
    db
      .prepare(
        `INSERT INTO credit_ledger (id, user_id, delta, reason, ref, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(ledgerId(), userId, neurons, reason, ref, now),
  ];
}

async function insertLedger(
  db: D1,
  userId: string,
  delta: number,
  reason: LedgerReason,
  ref: string | null,
  now: number,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO credit_ledger (id, user_id, delta, reason, ref, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(ledgerId(), userId, delta, reason, ref, now)
      .run();
  } catch {
    // idx_ledger_ref makes a retry of the same (reason, ref) a no-op. The
    // balance change already happened, so swallowing this keeps the two in step.
  }
}

export async function listLedger(userId: string, limit = 50): Promise<LedgerEntry[]> {
  const db = await requireDb();
  const { results } = await db
    .prepare(
      `SELECT id, delta, reason, ref, created_at
         FROM credit_ledger
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
    )
    .bind(userId, limit)
    .all<LedgerEntry>();
  return results ?? [];
}
