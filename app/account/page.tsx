import type { Metadata } from "next";
import { getUserIdFromRequest } from "@/lib/auth/session";
import {
  getBalanceNeurons,
  listLedger,
  type LedgerEntry,
} from "@/lib/billing/credits";
import { getDb } from "@/lib/billing/db";
import AccountClient, {
  type PurchaseRow,
} from "@/components/billing/AccountClient";
import { serverLocale } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Signed-in only, so there is nothing here to index in either language.
export function generateMetadata(): Metadata {
  const locale = serverLocale();
  const title = {
    en: "Account — Delightful Cells",
    zh: "我的账户 —— Delightful Cells",
    ja: "アカウント — Delightful Cells",
  }[locale];
  return {
    title,
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage() {
  const locale = serverLocale();
  const userId = await getUserIdFromRequest();
  if (!userId) return <AccountClient signedIn={false} initialLocale={locale} />;

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
      initialLocale={locale}
      balanceNeurons={balanceNeurons}
      ledger={ledger}
      purchases={purchases}
    />
  );
}
