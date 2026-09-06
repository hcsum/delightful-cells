// Stripe on Workers: no Node http stack and no node:crypto, so the SDK has to
// be told to use fetch and WebCrypto. Signature verification must use the
// async API for the same reason.

import Stripe from "stripe";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

export async function constructEvent(
  raw: string,
  signature: string,
): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return getStripe().webhooks.constructEventAsync(
    raw,
    signature,
    secret,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}
