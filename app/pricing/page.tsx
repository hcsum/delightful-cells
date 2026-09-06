import type { Metadata } from "next";
import PricingClient from "@/components/billing/PricingClient";

export const metadata: Metadata = {
  title: "Credits — Delightful Cells",
  description:
    "Buy credits for Delightful Cells. One-time payment, never expires, roughly one credit per chat turn.",
};

export default function PricingPage() {
  return <PricingClient />;
}
