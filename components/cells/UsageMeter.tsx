"use client";

import { useT } from "@/lib/cells/locale";
import type { Me } from "@/lib/billing/useMe";
import { rowsAffordableWithChat } from "@/lib/limits";
import InfoPopover from "./InfoPopover";

// One balance card for everything the user can spend: today's remaining
// credits plus their purchased balance. The bar and the popover both use that
// combined amount, so a top-up is reflected everywhere in the card.
export default function UsageMeter({ me }: { me: Me | null }) {
  const t = useT();
  if (!me) return null;

  const box =
    "mb-3 rounded-2xl border !border-black/10 bg-white px-4 py-2.5 text-xs text-black/60";

  const dailyNeurons = me.daily.neuronsLeft;
  const balanceNeurons = me.credits.neurons;
  const totalNeurons = dailyNeurons === null ? null : dailyNeurons + balanceNeurons;
  const totalCredits =
    totalNeurons === null
      ? null
      : Math.floor(totalNeurons / me.credits.neuronsPerCredit);
  const estimatedRows =
    totalNeurons === null ? null : rowsAffordableWithChat(totalNeurons);
  const sitePaused = me.site.tierNeurons >= me.site.tierBudget;

  return (
    <div className={box} title={t("usageHover", { c: me.site.requests })}>
      <div className="flex items-center justify-between font-semibold">
        <span className="flex items-center gap-1.5">
          {t("meterAvailableTitle")}
          <InfoPopover label={t("creditsEstimateLabel")}>
            <span className="text-[11px]">
              {totalCredits === null || estimatedRows === null
                ? t("creditsEstimateUnlimited")
                : t("creditsEstimate", {
                    r: estimatedRows.toLocaleString(),
                  })}
            </span>
          </InfoPopover>
        </span>
        <span className="text-black/80">
          {totalCredits === null
            ? t("meterAvailableUnlimited")
            : t("meterAvailableTotal", { n: totalCredits.toLocaleString() })}
        </span>
      </div>
      {dailyNeurons !== null && me.limits.dailyCredits !== null && (
        <RemainingBar
          remaining={dailyNeurons + balanceNeurons}
          total={
            me.limits.dailyCredits * me.credits.neuronsPerCredit + balanceNeurons
          }
        />
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-black/45">
        {me.daily.creditsLeft !== null && (
          <span>{t("meterTodayCredits", { n: me.daily.creditsLeft.toLocaleString() })}</span>
        )}
      </div>
      {/* Two different walls, and only one of them is the user's own doing.
          The shared budget outranks the sign-in nudge: signing in is pointless
          advice while the tier's whole bucket is spent. */}
      {sitePaused ? (
        <div className="mt-1 text-[11px] font-semibold text-[#b3003c]">
          {t("usagePaused")}
        </div>
      ) : me.tier === "anon" ? (
        <div className="mt-1 text-[11px] text-black/45">
          {t("meterSignInHint")}
        </div>
      ) : null}
    </div>
  );
}

function RemainingBar({ remaining, total }: { remaining: number; total: number }) {
  const remainingPct = Math.min(100, total > 0 ? (remaining / total) * 100 : 0);
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#d8d2c8]">
      <div
        className="h-full rounded-full"
        style={{
          width: `${remainingPct}%`,
          background:
            "linear-gradient(90deg,#ff0080,#ff8c00,#ffd500,#00c853,#00b0ff,#7c4dff)",
        }}
      />
    </div>
  );
}
