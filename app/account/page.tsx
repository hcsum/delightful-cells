import type { Metadata } from "next";
import { getUserIdFromRequest } from "@/lib/auth/session";
import { getBalanceNeurons, listLedger, type LedgerEntry } from "@/lib/billing/credits";
import { getDb } from "@/lib/billing/db";
import AccountClient, { type PurchaseRow } from "@/components/billing/AccountClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account — Delightful Cells",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const userId = await getUserIdFromRequest();
  if (!userId) return <AccountClient signedIn={false} />;

  // Read the three tables directly: this page is server-rendered per request,
  // so there is nothing to gain from bouncing through an API route.
  let balanceNeurons = 0;
  let ledger: LedgerEntry[] = [];
  let purchases: PurchaseRow[] = [];
  try {
    balanceNeurons = await getBalanceNeurons(userId);
    ledger = await listLedger(userId, 50);
    const db = await getDb();
    if (db) {
      const { results } = await db
        .prepare(
          `SELECT id, pack, credits, amount_cents, currency, status, created_at
             FROM purchase WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
        )
        .bind(userId)
        .all<PurchaseRow>();
      purchases = results ?? [];
    }
  } catch {
    // D1 unavailable: still render the page rather than 500 on a signed-in user.
  }

  return (
    <AccountClient
      signedIn
      balanceNeurons={balanceNeurons}
      ledger={ledger}
      purchases={purchases}
    />
  );
}
