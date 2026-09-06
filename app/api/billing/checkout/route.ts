// Start a Stripe Checkout session for one credit pack. Sign-in required: a
// balance needs a user to belong to.

import { getUserIdFromRequest } from "@/lib/auth/session";
import { isPackId, neuronsFor, PACKS } from "@/lib/billing/packs";
import { getStripe } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return json({ error: "unauthorized", message: "Sign in to buy credits." }, 401);
  }

  let pack: unknown;
  try {
    pack = (await request.json())?.pack;
  } catch {
    return json({ error: "invalid_json", message: "Invalid JSON body" }, 400);
  }
  if (!isPackId(pack)) {
    return json({ error: "bad_pack", message: "Unknown credit pack" }, 400);
  }

  const priceId = process.env[PACKS[pack].priceEnv] || "";
  if (!priceId) {
    return json(
      { error: "not_configured", message: `${PACKS[pack].priceEnv} is not set` },
      500,
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    new URL(request.url).origin;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      managed_payments: { enabled: false },
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      // The webhook credits the account from this metadata, never from
      // anything the browser sends.
      metadata: {
        userId,
        pack,
        neurons: String(neuronsFor(PACKS[pack])),
        credits: String(PACKS[pack].credits),
      },
      success_url: `${origin}/account?purchase=success`,
      cancel_url: `${origin}/pricing`,
    });
    if (!session.url) {
      return json({ error: "stripe_error", message: "Checkout session has no URL" }, 502);
    }
    return json({ url: session.url });
  } catch (e) {
    console.error("[api/billing/checkout]", e);
    return json(
      { error: "stripe_error", message: e instanceof Error ? e.message : "Checkout failed" },
      502,
    );
  }
}
