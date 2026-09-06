// Stripe → here. Credits land in the balance exactly once per event.
//
// Idempotency is the stripe_event primary key: it goes first in the batch, so a
// redelivered event fails the insert and rolls the whole batch back, leaving
// the balance untouched. We then answer 200 so Stripe stops retrying.

import { requireDb } from "@/lib/billing/db";
import { grantStatements } from "@/lib/billing/credits";
import { constructEvent } from "@/lib/billing/stripe";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature") || "";
  if (!signature) return json({ error: "no_signature" }, 400);

  // Must be the raw body: any re-serialization breaks the signature.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await constructEvent(raw, signature);
  } catch (e) {
    console.warn("[stripe/webhook] bad signature", String(e));
    return json({ error: "bad_signature" }, 400);
  }

  if (event.type !== "checkout.session.completed") {
    return json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return json({ received: true, ignored: "unpaid" });
  }

  const userId = session.metadata?.userId || session.client_reference_id || "";
  const neurons = Number(session.metadata?.neurons) || 0;
  const credits = Number(session.metadata?.credits) || 0;
  const pack = session.metadata?.pack || "unknown";
  if (!userId || neurons <= 0) {
    console.error("[stripe/webhook] paid session without usable metadata", session.id);
    // 200 on purpose: retrying cannot fix missing metadata, and this needs a
    // human to reconcile rather than an endless redelivery loop.
    return json({ received: true, error: "missing_metadata" });
  }

  const now = Date.now();
  const db = await requireDb();
  try {
    await db.batch([
      db
        .prepare("INSERT INTO stripe_event (id, type, created_at) VALUES (?, ?, ?)")
        .bind(event.id, event.type, now),
      db
        .prepare(
          `INSERT INTO purchase
             (id, user_id, pack, credits, amount_cents, currency, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          session.id,
          userId,
          pack,
          credits,
          session.amount_total ?? 0,
          session.currency ?? "usd",
          "paid",
          now,
        ),
      ...grantStatements(db, userId, neurons, "purchase", session.id, now),
    ]);
  } catch (e) {
    // Almost always the stripe_event or purchase primary key, i.e. a replay.
    console.warn("[stripe/webhook] batch rejected (likely replay)", event.id, String(e));
    return json({ received: true, duplicate: true });
  }

  return json({ received: true });
}
