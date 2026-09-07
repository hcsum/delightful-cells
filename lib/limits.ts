// Shared app limits (importable by both server and client code)

// --- Credits ---------------------------------------------------------------
// Balances are stored in neurons and displayed in credits. A round trip of the
// agent loop measured ~28 neurons, so one credit ≈ one turn.
export const NEURONS_PER_CREDIT = 30;

export type Tier = "anon" | "free" | "paid";

// Everything metered against Cloudflare's AI bill. `paid` spends neurons out of
// a purchased balance instead of a daily allowance, so its per-day caps are
// unbounded. The workbook import cap keeps one runaway job finite.
//
// The two free rows are sized by what they are FOR, not by what we can afford:
//
//   anon — see that it works. The demo sheet is 60 rows. 6 turns covers the
//   four demo presets plus a couple of the visitor's own questions, and 200
//   rows a day is the demo three times over, or one small file of their own.
//
//   free — light real use that ends. 1,000 rows a day means a real file gets
//   processed, and then the day is done. Chat turns stay at 10 because turns
//   are where the product proves itself; cutting them reads as broken rather
//   than limited, while running out of rows reads as "I finished something and
//   want to do the next one".
export const TIER_LIMITS = {
  anon: { chatTurns: 6, rowsPerDay: 200 },
  free: { chatTurns: 10, rowsPerDay: 1000 },
  paid: { chatTurns: Infinity, rowsPerDay: Infinity },
} as const satisfies Record<Tier, { chatTurns: number; rowsPerDay: number }>;

// --- Signed-in values, for code that needs a number before /api/me answers.
// Derived, not repeated: these drifted from TIER_LIMITS once already. Never
// render them as the reader's allowance — an anonymous visitor gets a
// fraction. Copy written before the tier is known must quote TIER_LIMITS.anon,
// the floor everyone is guaranteed.
export const DAILY_ROWS_LIMIT = TIER_LIMITS.free.rowsPerDay;

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

// --- Client-side parsing limits --------------------------------------------
// These bound browser memory, not our AI bill, so they are the same for every
// tier: truncating them saves nothing and only makes the showcase look broken.
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Budget for the WHOLE workbook, not per sheet: a 20 MB file can hold a dozen
// sheets, and it is the total that decides whether the tab survives.
export const MAX_IMPORT_ROWS = 10_000;
// exceljs builds a styled object per cell; past this a highlighted export OOMs.
export const MAX_STYLED_EXPORT_ROWS = 20_000;
