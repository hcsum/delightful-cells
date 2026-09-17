import PricingClient from "@/components/billing/PricingClient";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/pricing";

const COPY = {
  en: {
    title: "Credits — Delightful Cells",
    description:
      "Buy credits for Delightful Cells. One-time payment, never expires, roughly one credit per AI call.",
  },
  zh: {
    title: "点数 —— Delightful Cells",
    description:
      "购买 Delightful Cells 的点数。一次性付款，永不过期，1 点大约够一次 AI 调用。",
  },
};

export function generateMetadata() {
  const c = COPY[serverLocale()];
  return localizedMetadata(PATH, COPY, {
    openGraph: { title: c.title, description: c.description, type: "website" },
  });
}

export default function PricingPage() {
  return <PricingClient initialLocale={serverLocale()} />;
}
