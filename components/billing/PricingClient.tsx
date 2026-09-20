"use client";

import { useState } from "react";
import { LocaleContext, useStoredLocale } from "@/lib/cells/locale";
import { t, type Locale } from "@/lib/cells/i18n";
import { PACKS, PACK_ORDER, type PackId } from "@/lib/billing/packs";
import {
  NEURONS_PER_CREDIT,
  minCreditsForRows,
  turnsAffordable,
} from "@/lib/limits";
import { useAuth } from "@/lib/auth/useAuth";
import LoginPromptDialog from "@/components/LoginPromptDialog";
import { currentPath } from "@/components/billing/AuthPill";

export default function PricingClient({ initialLocale = "en" }: { initialLocale?: Locale }) {
  const [locale] = useStoredLocale(initialLocale);
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, k, v);
  const { isAuthenticated, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState<PackId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askSignIn, setAskSignIn] = useState(false);

  async function buy(pack: PackId) {
    if (!isAuthenticated) {
      setAskSignIn(true);
      return;
    }
    setBusy(pack);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 401) {
        setAskSignIn(true);
        return;
      }
      if (!res.ok || !body?.url) {
        setError(body?.message || tr("genericError"));
        return;
      }
      window.location.href = body.url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("genericError"));
    } finally {
      setBusy(null);
    }
  }

  const money = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <LocaleContext.Provider value={locale}>
      <div className="py-14 sm:py-16">
        {/* No language toggle here: AppShell's header already carries one, and
            two on the same screen read as two different settings. */}
        <div>
          <h1 className="text-3xl font-extrabold">{tr("pricingTitle")}</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-black/60">
            {tr("pricingSubtitle")}
          </p>
          <p className="mt-5 max-w-xl text-sm leading-6 text-black/45">
            {tr("pricingSupportCopy")}
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {PACK_ORDER.map((id) => {
            const p = PACKS[id];
            return (
              <div
                key={id}
                className="rounded-3xl border !border-black/10 bg-[#fffaf0] p-6"
              >
                <div className="text-3xl font-extrabold">{money(p.amountCents)}</div>
                <div className="mt-1 text-sm font-bold text-black/70">
                  {tr("pricingCredits", { n: p.credits.toLocaleString() })}
                </div>
                <div className="mt-1 text-xs text-black/45">
                  {/* Turns, not credits. One credit is about one model CALL,
                      and a turn averages 3.3 of them — this line used to print
                      the credit count, which overstated it ~3x. */}
                  {tr("pricingPerCredit", {
                    n: turnsAffordable(p.credits * NEURONS_PER_CREDIT).toLocaleString(),
                  })}
                </div>
                <button
                  onClick={() => void buy(id)}
                  disabled={busy !== null}
                  className="mt-5 w-full rounded-full bg-black px-4 py-2.5 text-sm font-bold text-[#fffdf8] hover:opacity-85 disabled:opacity-50"
                >
                  {busy === id ? tr("pricingBusy") : tr("pricingBuy")}
                </button>
              </div>
            );
          })}
        </div>
        {error && (
          <p className="mt-3 text-sm font-semibold text-[#b3003c]">{error}</p>
        )}

        <div className="mt-8 grid w-full gap-3 rounded-3xl border border-black/10 bg-black/[0.025] px-6 py-6 sm:grid-cols-[180px_1fr] sm:gap-10 sm:px-7">
          <h2 className="text-sm font-bold leading-6">{tr("pricingUsageTitle")}</h2>
          <p className="text-sm leading-6 text-black/60">
            {tr("pricingRowCost", { c: Math.round(minCreditsForRows(1000)) })}
          </p>
        </div>
        <LoginPromptDialog
          open={askSignIn}
          onClose={() => setAskSignIn(false)}
          onSignIn={() => signInWithGoogle(currentPath())}
        />
      </div>
    </LocaleContext.Provider>
  );
}
