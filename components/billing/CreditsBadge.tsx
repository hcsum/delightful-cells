"use client";

import Link from "next/link";
import { useLocale, useT } from "@/lib/cells/locale";
import type { Me } from "@/lib/billing/useMe";
import { localizePath } from "@/lib/locale-routing";

// Balance pill + the way in to buying more. Shows "Get credits" until there is
// a balance to show, so the entry point exists before the first purchase.
export default function CreditsBadge({ me }: { me: Me | null }) {
  const locale = useLocale();
  const t = useT();
  const credits = me?.credits.credits ?? 0;
  const pill =
    "inline-flex items-center rounded-full border !border-black/15 bg-white px-3 py-1.5 text-xs font-semibold !text-black/70 hover:bg-[#fff3d6]";

  if (credits <= 0) {
    return (
      <Link href={localizePath("/pricing", locale)} className={pill}>
        {t("buyCredits")}
      </Link>
    );
  }
  return (
    <Link href={localizePath("/account", locale)} className={`${pill} !text-black`}>
      ⚡ {t("creditsBalance", { n: credits.toLocaleString() })}
    </Link>
  );
}
