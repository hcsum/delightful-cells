// Everything the client needs to render limits in one round trip: who you are,
// what tier that puts you in, what's left of today's free allowance, your
// credit balance, and the site-wide meter. Supersedes GET /api/quota and
// /api/usage for the Cells UI.

import { MAX_IMPORT_ROWS, NEURONS_PER_CREDIT, SITE_NEURON_BUDGET } from "@/lib/limits";
import { remainingDaily, resolveEntitlement } from "@/lib/billing/entitlement";
import { creditsFromNeurons } from "@/lib/billing/credits";
import { getUsageToday, neuronsFor } from "@/lib/usage";
import { getAuth } from "@/lib/auth/server";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ent = await resolveEntitlement(request);
  const [daily, siteAll, siteTier] = await Promise.all([
    remainingDaily(ent),
    getUsageToday(),
    getUsageToday(ent.baseTier),
  ]);

  let user: { name: string | null; email: string | null; image: string | null } | null = null;
  if (ent.userId) {
    try {
      const auth = await getAuth();
      const session = await auth.api.getSession({ headers: headers() });
      if (session?.user) {
        user = {
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          image: session.user.image ?? null,
        };
      }
    } catch {}
  }

  return new Response(
    JSON.stringify({
      tier: ent.baseTier,
      // True once the free allowance is gone and calls start costing credits.
      billingToCredits:
        ent.balanceNeurons > 0 &&
        (daily.turnsLeft === 0 || daily.rowsLeft === 0),
      user,
      credits: {
        neurons: ent.balanceNeurons,
        credits: creditsFromNeurons(ent.balanceNeurons),
        neuronsPerCredit: NEURONS_PER_CREDIT,
      },
      daily,
      limits: {
        // Infinity does not survive JSON; null means "no limit".
        chatTurns: finite(ent.limits.chatTurns),
        rowsPerDay: finite(ent.limits.rowsPerDay),
        maxRowsPerRun:
          ent.balanceNeurons > 0 || daily.rowsLeft === null
            ? MAX_IMPORT_ROWS
            : daily.rowsLeft,
      },
      site: {
        date: new Date().toISOString().slice(0, 10),
        neurons: Math.round(neuronsFor(siteAll)),
        requests: siteAll.calls,
        inputTokens: siteAll.inputTokens,
        outputTokens: siteAll.outputTokens,
        tierNeurons: Math.round(neuronsFor(siteTier)),
        tierBudget: SITE_NEURON_BUDGET[ent.baseTier],
      },
    }),
    { headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}

function finite(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}
