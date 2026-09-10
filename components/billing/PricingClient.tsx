"use client";

import { useState } from "react";
import { LocaleContext, useStoredLocale } from "@/lib/cells/locale";
import { t, type Locale } from "@/lib/cells/i18n";
import { PACKS, PACK_ORDER, type PackId } from "@/lib/billing/packs";
import {
  MAX_FILE_BYTES,
  MAX_IMPORT_ROWS,
  TIER_LIMITS,
  minCreditsForRows,
} from "@/lib/limits";
import { useAuth } from "@/lib/auth/useAuth";
import LoginPromptDialog from "@/components/LoginPromptDialog";
import { currentPath } from "@/components/billing/AuthPill";

export default function PricingClient({ initialLocale = "en" }: { initialLocale?: Locale }) {
  const [locale, setLocale] = useStoredLocale(initialLocale);
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
      <div className="py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">{tr("pricingTitle")}</h1>
            <p className="mt-2 max-w-xl text-sm text-black/60">
              {tr("pricingSubtitle")}
            </p>
          </div>
          <button
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            className="rounded-full border !border-black/15 bg-white px-3 py-1.5 text-xs font-semibold !text-black/70 hover:bg-[#fff3d6]"
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
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
                  {tr("pricingPerCredit", { n: p.credits.toLocaleString() })}
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
        <p className="mt-3 text-xs text-black/45">{tr("pricingNoExpiry")}</p>
        {/* Rows are the part people mis-estimate, and the measured cost came
            in 3x the original planning figure. State the floor and say it is a
            floor, rather than quoting a number long columns will blow past. */}
        <p className="mt-2 max-w-2xl text-xs text-black/45">
          {tr("pricingRowCost", { c: Math.round(minCreditsForRows(1000)) })}
        </p>
        {error && (
          <p className="mt-3 text-sm font-semibold text-[#b3003c]">{error}</p>
        )}

        <h2 className="mt-12 text-xl font-extrabold">{tr("pricingCompare")}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-black/45">
                <th className="py-2 pr-4 font-semibold"> </th>
                <th className="py-2 pr-4 font-semibold">{tr("pricingColAnon")}</th>
                <th className="py-2 pr-4 font-semibold">{tr("pricingColFree")}</th>
                <th className="py-2 font-semibold">{tr("pricingColPaid")}</th>
              </tr>
            </thead>
            <tbody>
              <Row
                label={tr("rowChatTurns")}
                anon={TIER_LIMITS.anon.chatTurns.toLocaleString()}
                free={TIER_LIMITS.free.chatTurns.toLocaleString()}
                paid={tr("valMetered")}
              />
              <Row
                label={tr("rowRowsPerDay")}
                anon={TIER_LIMITS.anon.rowsPerDay.toLocaleString()}
                free={TIER_LIMITS.free.rowsPerDay.toLocaleString()}
                paid={tr("valMetered")}
              />
              {/* Import and the mechanical tools run entirely in the browser,
                  so they cost us nothing and are the same at every tier. */}
              <Row
                label={tr("rowImport")}
                anon={tr("valSameForAll", {
                  r: MAX_IMPORT_ROWS.toLocaleString(),
                  m: Math.round(MAX_FILE_BYTES / 1024 / 1024),
                })}
                free="—"
                paid="—"
                span
              />
              <Row
                label={tr("rowMechanical")}
                anon={tr("valUnlimited")}
                free="—"
                paid="—"
                span
              />
            </tbody>
          </table>
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

function Row({
  label,
  anon,
  free,
  paid,
  span,
}: {
  label: string;
  anon: string;
  free: string;
  paid: string;
  span?: boolean;
}) {
  return (
    <tr className="border-t border-black/10">
      <td className="py-2.5 pr-4 font-semibold text-black/70">{label}</td>
      {span ? (
        <td className="py-2.5 pr-4 text-black/70" colSpan={3}>
          {anon}
        </td>
      ) : (
        <>
          <td className="py-2.5 pr-4 text-black/70">{anon}</td>
          <td className="py-2.5 pr-4 text-black/70">{free}</td>
          <td className="py-2.5 text-black/70">{paid}</td>
        </>
      )}
    </tr>
  );
}
