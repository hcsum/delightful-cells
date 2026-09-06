"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LocaleContext, useStoredLocale } from "@/lib/cells/locale";
import { t } from "@/lib/cells/i18n";
import { NEURONS_PER_CREDIT } from "@/lib/limits";
import type { LedgerEntry } from "@/lib/billing/credits";
import { useAuth } from "@/lib/auth/useAuth";
import { currentPath } from "@/components/billing/AuthPill";

export type PurchaseRow = {
  id: string;
  pack: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: number;
};

export default function AccountClient(props: {
  signedIn: boolean;
  balanceNeurons?: number;
  ledger?: LedgerEntry[];
  purchases?: PurchaseRow[];
}) {
  return (
    <Suspense fallback={null}>
      <AccountBody {...props} />
    </Suspense>
  );
}

function AccountBody({
  signedIn,
  balanceNeurons = 0,
  ledger = [],
  purchases = [],
}: {
  signedIn: boolean;
  balanceNeurons?: number;
  ledger?: LedgerEntry[];
  purchases?: PurchaseRow[];
}) {
  const [locale, setLocale] = useStoredLocale();
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, k, v);
  const { signInWithGoogle, signOut } = useAuth();
  const justPaid = useSearchParams().get("purchase") === "success";

  if (!signedIn) {
    return (
      <LocaleContext.Provider value={locale}>
        <div className="py-16 text-center">
          <h1 className="text-2xl font-extrabold">{tr("accountTitle")}</h1>
          <p className="mt-2 text-sm text-black/60">{tr("accountSignInFirst")}</p>
          <button
            onClick={() => signInWithGoogle(currentPath())}
            className="mt-5 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-[#fffdf8] hover:opacity-85"
          >
            {tr("signInGoogle")}
          </button>
        </div>
      </LocaleContext.Provider>
    );
  }

  // Balance is stored in neurons and shown in credits; a fractional credit is
  // real spend, so round down rather than flattering the number.
  const credits = Math.floor(balanceNeurons / NEURONS_PER_CREDIT);
  const date = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
  const reasonLabel = (r: string) =>
    tr(
      { purchase: "reasonPurchase", chat: "reasonChat", process: "reasonProcess", refund: "reasonRefund" }[
        r
      ] ?? "reasonAdjust",
    );

  return (
    <LocaleContext.Provider value={locale}>
      <div className="py-10">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-extrabold">{tr("accountTitle")}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
              className="rounded-full border !border-black/15 bg-white px-3 py-1.5 text-xs font-semibold !text-black/70 hover:bg-[#fff3d6]"
            >
              {locale === "zh" ? "EN" : "中文"}
            </button>
            <button
              onClick={() => void signOut()}
              className="rounded-full border !border-black/15 bg-white px-3 py-1.5 text-xs font-semibold !text-black/70 hover:bg-[#fff3d6]"
            >
              {tr("signOut")}
            </button>
          </div>
        </div>

        {justPaid && (
          <p className="mt-4 rounded-2xl bg-[#e8ffe8] px-4 py-2.5 text-sm font-semibold text-[#0b6b2f]">
            {tr("accountPurchaseOk")}
          </p>
        )}

        <div className="mt-6 rounded-3xl border !border-black/10 bg-[#fffaf0] p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-black/45">
            {tr("accountBalance")}
          </div>
          <div className="mt-1 text-4xl font-extrabold">
            {credits.toLocaleString()}
          </div>
          {/* Credits are the only unit a user ever sees. Neurons are how the
              balance is stored so sub-credit calls can be charged honestly —
              showing both just asked the reader to do the division. */}
          <div className="mt-1 text-xs text-black/45">
            {tr("pricingPerCredit", { n: credits.toLocaleString() })}
          </div>
          <Link
            href="/pricing"
            className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-sm font-bold !text-[#fffdf8] hover:opacity-85"
          >
            {tr("buyCredits")}
          </Link>
        </div>

        <h2 className="mt-10 text-lg font-extrabold">{tr("accountPurchases")}</h2>
        {purchases.length === 0 ? (
          <p className="mt-2 text-sm text-black/50">{tr("accountEmpty")}</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-sm">
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t border-black/10">
                  <td className="py-2.5 pr-4 text-black/50">{date(p.created_at)}</td>
                  <td className="py-2.5 pr-4 font-semibold">{p.pack}</td>
                  <td className="py-2.5 pr-4">+{p.credits.toLocaleString()}</td>
                  <td className="py-2.5 text-black/60">
                    {(p.amount_cents / 100).toFixed(2)} {p.currency.toUpperCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 className="mt-10 text-lg font-extrabold">{tr("accountHistory")}</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-black/50">{tr("accountEmpty")}</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-sm">
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id} className="border-t border-black/10">
                  <td className="py-2.5 pr-4 text-black/50">{date(l.created_at)}</td>
                  <td className="py-2.5 pr-4 font-semibold">{reasonLabel(l.reason)}</td>
                  <td
                    className={`py-2.5 pr-4 tabular-nums ${l.delta < 0 ? "text-[#b3003c]" : "text-[#0b6b2f]"}`}
                  >
                    {l.delta > 0 ? "+" : ""}
                    {tr("creditsAmount", { n: creditsLabel(l.delta) })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </LocaleContext.Provider>
  );
}

// One line of the ledger, in credits. A chat turn costs about 0.93 credits, so
// rounding to whole numbers would print "0" next to real spend; two decimals
// keep small charges visible without inventing a second unit for them. The
// smallest charge that can be recorded is one neuron, which lands at 0.03.
function creditsLabel(deltaNeurons: number): string {
  return (deltaNeurons / NEURONS_PER_CREDIT).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}
