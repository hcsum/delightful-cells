// Shared app limits (importable by both server and client code)

// --- Credits ---------------------------------------------------------------
// Balances are stored in neurons and displayed in credits. A round trip of the
// agent loop measured ~28 neurons, so one credit ≈ one turn.
export const NEURONS_PER_CREDIT = 30;

export type Tier = "anon" | "free" | "paid";

// Everything metered against Cloudflare's AI bill. `paid` spends neurons out of
// a purchased balance instead of a daily allowance, so its per-day cap is
// unbounded. The workbook import cap keeps one runaway job finite.
//
// Free and paid now use the SAME unit. There used to be two free buckets — so
// many chat turns, so many AI rows — and they made the product answer a
// question nobody asks: is this a chat thing or a rows thing? Chatting about a
// sheet processes rows, and processing rows happens through chat. One bucket,
// counted in the thing that actually costs us money, is both simpler to
// explain and honest about what a request is worth.
//
// The numbers are sized to what the old pair delivered in practice:
//
//   anon — see that it works. 8 credits = 240 neurons ≈ the measured total of
//   the old 6 turns plus 200 rows. The demo sheet is 60 rows, so that is the
//   four demo presets plus a few questions of the visitor's own, or the demo
//   several times over.
//
//   free — light real use that ends. 20 credits = 600 neurons ≈ the old 10
//   turns plus 1,000 rows. A real file gets processed, and then the day is
//   done.
//
// Sized in credits, not neurons, because credits are what the UI shows and
// what a purchase is denominated in: a free day and a bought credit have to be
// readable against each other.
export const TIER_LIMITS = {
  anon: { dailyCredits: 8 },
  free: { dailyCredits: 20 },
  paid: { dailyCredits: Infinity },
} as const satisfies Record<Tier, { dailyCredits: number }>;

/** Today's free allowance in neurons — the unit the counter is actually kept in. */
export function dailyNeurons(tier: Tier): number {
  return TIER_LIMITS[tier].dailyCredits * NEURONS_PER_CREDIT;
}

// Site-wide daily neuron budget per free tier, so anonymous traffic can never
// starve signed-in users. Paid traffic is not bucketed — it pays its own way.
//
// This is a bill cap, not an anti-abuse device: a single identity can extract
// well under a cent of inference, so nobody farms accounts for it. Read each
// number as "the most I am willing to pay for this tier on any one day":
// 10,000 + 100,000 neurons = $1.21/day at $0.011 per 1k, about $36/month.
//
// The anonymous bucket is deliberately the small one. When it runs out the
// visitor is asked to sign in, which turns the overflow into a conversion
// prompt rather than a bill — see siteQuotaMessage() in lib/usage.ts.
export const SITE_NEURON_BUDGET = { anon: 10_000, free: 100_000 } as const;

// --- Batching and measured cost --------------------------------------------
// Rows per request to /api/process. Measured at 50 vs 100 on production
// (2026-09-06, 200 rows each, identical input): cost fell 68 -> 64 neurons,
// only 6%, but wall time fell 28.1s -> 17.4s, 38%. Per-call latency barely
// moves with row count, so halving the number of calls nearly halves the
// wait. Speed is the reason this is 100, not the cost.
//
// What it costs: a failed batch loses 100 rows of work instead of 50, and the
// progress bar advances half as often — at ~9s per call it still moves about
// every 9 seconds, which is why this was worth doing.
export const AI_BATCH_ROWS = 100;

// When a batch fails every retry at full size, processRows cuts it into pieces
// this big and tries again. Two different failures are being answered here:
// a transient one gets a third and fourth chance, and a batch whose answer was
// simply too long for the worker's output-token cap only ever succeeds once it
// is smaller — retrying at 100 would fail identically forever. 20 is small
// enough to be well under the cap for any realistic column, and large enough
// that recovering one bad batch costs five calls, not a hundred.
export const AI_RETRY_SPLIT_ROWS = 20;

// Measured on production 2026-09-06 against ~35-character addresses, read back
// from the `x-usage-neurons` header Cloudflare actually billed: 10 rows cost 5
// neurons, 50 rows cost 17 (twice, identically). That fits a fixed cost per
// call plus a cost per row. See docs/limits-and-pricing.md.
export const MEASURED_NEURONS_PER_CALL = 2;
export const MEASURED_NEURONS_PER_ROW = 0.3;

// A FLOOR, not a quote. It is what short inputs cost; comment and description
// columns run higher, because the bill follows input length. Anything shown to
// a user from this has to be worded as "at least" / "about, on short text".
export function minCreditsForRows(rows: number): number {
  const calls = Math.ceil(rows / AI_BATCH_ROWS);
  const neurons =
    calls * MEASURED_NEURONS_PER_CALL + rows * MEASURED_NEURONS_PER_ROW;
  return neurons / NEURONS_PER_CREDIT;
}

// The inverse: how many rows a neuron allowance buys, for turning "what's left
// today" into the only number a user of the row tools can act on. Assumes full
// batches, so the per-call overhead is amortised over AI_BATCH_ROWS rows.
//
// Inherits the floor caveat from minCreditsForRows and makes it worse: this is
// the count for SHORT text, and long columns get fewer rows out of the same
// allowance. Every surface that renders it says "about".
export function rowsAffordable(neurons: number): number {
  if (!Number.isFinite(neurons)) return MAX_IMPORT_ROWS;
  const perRow =
    MEASURED_NEURONS_PER_ROW + MEASURED_NEURONS_PER_CALL / AI_BATCH_ROWS;
  return Math.max(0, Math.floor(neurons / perRow));
}

// --- Client-side parsing limits --------------------------------------------
// These bound browser memory, not our AI bill, so they are the same for every
// tier: truncating them saves nothing and only makes the showcase look broken.
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Budget for the WHOLE workbook, not per sheet: a 20 MB file can hold a dozen
// sheets, and it is the total that decides whether the tab survives.
export const MAX_IMPORT_ROWS = 10_000;
// exceljs builds a styled object per cell; past this a highlighted export OOMs.
export const MAX_STYLED_EXPORT_ROWS = 20_000;

// The single-use tools get their own, much larger budget. They render no grid —
// the file goes in, one column is appended, the file comes back out — so the
// only thing bounding them is browser memory, and MAX_FILE_BYTES already does
// that. This is deliberately high rather than absent so a pathological file
// still fails loudly instead of hanging the tab. It is NOT an AI allowance:
// how many rows the model actually processes is decided per tier, server-side.
export const MAX_TOOL_IMPORT_ROWS = 100_000;
export const MAX_TOOL_COLS = 1_000;
