// Today's site-wide Workers AI usage, metered by us from the token counts the
// llm-worker reports on every call (see lib/usage.ts). No Cloudflare API token
// needed; neurons are derived from the model's list price.

import { FREE_NEURONS_PER_DAY, getUsageToday, neuronsFor } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await getUsageToday();
  return new Response(
    JSON.stringify({
      available: true,
      date: new Date().toISOString().slice(0, 10),
      neurons: Math.round(neuronsFor(u)),
      freeNeurons: FREE_NEURONS_PER_DAY,
      requests: u.calls,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
    }),
    { headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}
