"use client";

import { useT } from "@/lib/cells/locale";
import { TIER_LIMITS } from "@/lib/limits";
import type { Me } from "@/lib/billing/useMe";

// What this shows depends on who you are:
//  - free or anonymous → what's left of *your* own allowance today, in credits
//  - on credits        → your balance, because the allowance is already spent
//
// Anonymous used to be shown the site-wide budget instead, on the grounds that
// the shared bucket is what cuts them off. It is the rarer of the two walls and
// the harder to act on — "the site is busy" is not something a visitor can do
// anything about, while "you have 3 credits left" is. So both free tiers now
// read the same meter, and the site budget only surfaces once it is actually
// spent, as the `usagePaused` line.
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

  const credits = me.daily.creditsLeft;
  // The bar tracks the user's OWN bucket. `limits.dailyCredits` is null for an
  // unlimited account, in which case there is no bar to draw.
  const total = me.limits.dailyCredits;
  const sitePaused = me.site.tierNeurons >= me.site.tierBudget;
  return (
    <div className={box} title={t("usageHover", { c: me.site.requests })}>
      <div className="flex items-center justify-between font-semibold">
        <span>{t("meterFreeTitle")}</span>
        <span className="text-black/80">
          {credits === null
            ? t("meterFreeUnlimited")
            : t("meterFreeDetail", { n: credits.toLocaleString() })}
        </span>
      </div>
      {total !== null && (
        <Bar used={me.daily.neuronsUsed} total={total * me.credits.neuronsPerCredit} />
      )}
      {/* Two different walls, and only one of them is the user's own doing.
          The shared budget outranks the sign-in nudge: signing in is pointless
          advice while the tier's whole bucket is spent. */}
      {sitePaused ? (
        <div className="mt-1 text-[11px] font-semibold text-[#b3003c]">
          {t("usagePaused")}
        </div>
      ) : me.tier === "anon" ? (
        <div className="mt-1 text-[11px] text-black/45">
          {t("meterSignInHint", { n: TIER_LIMITS.free.dailyCredits })}
        </div>
      ) : null}
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
