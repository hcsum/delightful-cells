"use client";

import { useT } from "@/lib/cells/locale";
import type { Me } from "@/lib/billing/useMe";

// What this shows depends on who you are:
//  - anonymous  → the site-wide free budget, i.e. the old public meter
//  - signed in  → what's left of *your* allowance today
//  - on credits → your balance, because the allowance is already spent
export default function UsageMeter({ me }: { me: Me | null }) {
  const t = useT();
  if (!me) return null;

  const box =
    "mb-3 rounded-2xl border !border-black/10 bg-white px-4 py-2.5 text-xs text-black/60";

  if (me.billingToCredits) {
    return (
      <div className={box}>
        <div className="flex items-center justify-between font-semibold">
          <span>{t("meterCreditsTitle")}</span>
          <span className="text-black/80">
            {t("creditsBalanceLong", { n: me.credits.credits.toLocaleString() })}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-black/45">{t("meterCreditsDetail")}</div>
      </div>
    );
  }

  if (me.tier === "free") {
    const turns = me.daily.turnsLeft;
    const rows = me.daily.rowsLeft;
    const unl = t("meterFreeUnlimited");
    return (
      <div className={box}>
        <div className="flex items-center justify-between font-semibold">
          <span>{t("meterFreeTitle")}</span>
          <span className="text-black/80">
            {t("meterFreeDetail", {
              turns: turns === null ? unl : turns.toLocaleString(),
              rows: rows === null ? unl : rows.toLocaleString(),
            })}
          </span>
        </div>
        <Bar used={me.site.tierNeurons} total={me.site.tierBudget} />
      </div>
    );
  }

  // Anonymous: the shared budget is the thing that can cut them off, so keep
  // showing it — plus what signing in would change.
  const used = me.site.tierNeurons;
  const free = me.site.tierBudget;
  // A share of the budget, not a raw neuron count: an anonymous visitor has no
  // credits, so neurons would be a unit they can neither spend nor buy.
  const left = free > 0 ? Math.max(0, Math.round(((free - used) / free) * 100)) : 0;
  return (
    <div className={box} title={t("usageHover", { c: me.site.requests })}>
      <div className="flex items-center justify-between font-semibold">
        <span>{t("usageTitle")}</span>
        <span className="text-black/80">{t("usageFree", { p: left })}</span>
      </div>
      <Bar used={used} total={free} />
      <div className="mt-1 text-[11px] text-black/45">
        {used >= free ? (
          <span className="font-semibold text-[#b3003c]">{t("usagePaused")}</span>
        ) : (
          t("meterSignInHint")
        )}
      </div>
    </div>
  );
}

function Bar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, total > 0 ? (used / total) * 100 : 0);
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/5">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(pct, 1)}%`,
          background:
            "linear-gradient(90deg,#ff0080,#ff8c00,#ffd500,#00c853,#00b0ff,#7c4dff)",
        }}
      />
    </div>
  );
}
