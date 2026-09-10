import type { Metadata } from "next";
import { headers } from "next/headers";
import PricingClient from "@/components/billing/PricingClient";
import { DEFAULT_LOCALE, isAppLocale } from "@/lib/locale-routing";

export const metadata: Metadata = {
  title: "Credits — Delightful Cells",
  description:
    "Buy credits for Delightful Cells. One-time payment, never expires, roughly one credit per chat turn.",
};

export default function PricingPage() {
  const localeHeader = headers().get("x-locale");
  const locale = isAppLocale(localeHeader) ? localeHeader : DEFAULT_LOCALE;
  return <PricingClient initialLocale={locale} />;
}
