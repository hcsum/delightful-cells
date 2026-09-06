// The single source of truth for pricing, shared by the pricing page, the
// checkout route and the webhook. Amounts here are display-only: Stripe holds
// the authoritative price, so changing a number below never changes what a
// customer is charged.

import { NEURONS_PER_CREDIT } from "@/lib/limits";

export type PackId = "starter" | "plus" | "pro";

export type Pack = {
  id: PackId;
  credits: number;
  /** Display price in cents, matching the Stripe Price it points at. */
  amountCents: number;
  /** Env var holding the Stripe Price id. */
  priceEnv: string;
};

export const PACKS: Record<PackId, Pack> = {
  starter: { id: "starter", credits: 1_000, amountCents: 500, priceEnv: "STRIPE_PRICE_STARTER" },
  plus: { id: "plus", credits: 3_000, amountCents: 1_200, priceEnv: "STRIPE_PRICE_PLUS" },
  pro: { id: "pro", credits: 10_000, amountCents: 3_000, priceEnv: "STRIPE_PRICE_PRO" },
};

export const PACK_ORDER: PackId[] = ["starter", "plus", "pro"];

export function isPackId(v: unknown): v is PackId {
  return typeof v === "string" && v in PACKS;
}

export function neuronsFor(pack: Pack): number {
  return pack.credits * NEURONS_PER_CREDIT;
}
