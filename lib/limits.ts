// Shared app limits (importable by both server and client code)

// --- Credits ---------------------------------------------------------------
// Balances are stored in neurons and displayed in credits. One credit is about
// one MODEL CALL, which is not the same thing as one chat turn — see
// MEASURED_CALLS_PER_TURN below. This comment used to say "≈ one turn", which
// was wrong by about 3x and had been wrong since the number was first written
// down: the site counter counts requests, and "10,000 neurons ran ~360 turns"
// was really ~360 calls. Under the old turn-based free metering nothing read
// the difference, so it never surfaced.
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
// The numbers are sized so the CHAT side matches what the old turn-based pair
// delivered, because chat is where the product proves itself:
//
//   anon — see that it works. 20 credits = 600 neurons: about 6 chat turns,
//   or ~1,875 rows of short text, or a mix. The demo sheet is 60 rows.
//
//   free — light real use that ends. 40 credits = 1,200 neurons: about 12
//   chat turns, or ~3,750 rows.
//
// These were 8 and 20 for one day (2026-09-16), sized against "one turn ≈ 28
// neurons" — a per-CALL figure mislabelled as per-turn (see NEURONS_PER_CREDIT).
// At the real 3.3 calls a turn that gave an anonymous visitor about TWO turns
// against the old six, which is not enough to watch the thing work. Re-sized on
// the corrected numbers 2026-09-17. The row side is now far wider than the old
// 200/1,000 caps; that is the price of sizing on chat, and it is the right way
// round — running out of rows reads as "I finished something", running out of
// turns reads as broken.
//
// Sized in credits, not neurons, because credits are what the UI shows and
// what a purchase is denominated in: a free day and a bought credit have to be
// readable against each other.
export const TIER_LIMITS = {
  anon: { dailyCredits: 20 },
  free: { dailyCredits: 40 },
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
// 25,000 + 100,000 neurons = $1.38/day at $0.011 per 1k, about $41/month.
//
// The anonymous bucket went 10,000 -> 25,000 on 2026-09-17, alongside the
// allowance going 8 -> 20 credits. It had to: at 600 neurons a visitor, a
// 10,000 bucket is drained by SIXTEEN people, and then everyone after them
// hits "the site is busy" instead of their own allowance. That is the one
// refusal a visitor can do nothing about, so the shared bucket has to stay
// comfortably wider than the per-visitor one.
//
// The signed-in bucket is deliberately NOT raised to match. Doubling the
// allowance halves what it supports, 166 -> 83 users a day, and at current
// traffic (single-digit requests a day) that is still enormous headroom.
// Raising it would double the worst-case bill for capacity nobody is using.
//
// The anonymous bucket is still deliberately the smaller one. When it runs out
// the visitor is asked to sign in, which turns the overflow into a conversion
// prompt rather than a bill — see siteQuotaMessage() in lib/usage.ts.
export const SITE_NEURON_BUDGET = { anon: 25_000, free: 100_000 } as const;

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

// Chat does not decompose that way: a /chat call carries the sheet summary and
// the whole history, so its cost is roughly flat per call rather than per row.
// Measured twice on 2026-09-16/17, agreeing: the eval suite over 96 calls of
// glm-5.3-flash came to ~28 neurons a call, and production's own counter read
// 271 neurons over 9 calls (~30).
export const MEASURED_NEURONS_PER_CHAT_CALL = 30;

// ONE USER MESSAGE IS NOT ONE MODEL CALL. The agent loop plans, acts, looks
// again and reports, and every one of those steps is separately billed. Read
// off the 16 turns in .dev-trace: 53 calls, mean 3.3, median 3, max 6.
//
// That sample is the multi-step 核对 work the eval suite was built from, which
// is the heavy end of what people do. A one-line question is 1-2 calls. Treat
// this as the pessimistic figure it is, and never quote a turn count without
// "about".
export const MEASURED_CALLS_PER_TURN = 3.3;

// How many chat turns a neuron allowance buys. The counterpart to
// rowsAffordable(), and every bit as approximate — quote it with "about".
export function turnsAffordable(neurons: number): number {
  if (!Number.isFinite(neurons)) return Infinity;
  return Math.max(
    0,
    Math.floor(neurons / (MEASURED_NEURONS_PER_CHAT_CALL * MEASURED_CALLS_PER_TURN)),
  );
}

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

// A user-facing end-to-end estimate, including the chat calls needed to ask
// for, plan and report a row-processing job. Assume a typical instruction
// processes 1,000 rows; smaller jobs spend proportionally more on chat.
export function rowsAffordableWithChat(neurons: number): number {
  if (!Number.isFinite(neurons)) return MAX_IMPORT_ROWS;
  const typicalRowsPerTurn = 1_000;
  const rowCost =
    MEASURED_NEURONS_PER_ROW + MEASURED_NEURONS_PER_CALL / AI_BATCH_ROWS;
  const chatCostPerRow =
    (MEASURED_NEURONS_PER_CHAT_CALL * MEASURED_CALLS_PER_TURN) /
    typicalRowsPerTurn;
  return Math.max(0, Math.floor(neurons / (rowCost + chatCostPerRow)));
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
