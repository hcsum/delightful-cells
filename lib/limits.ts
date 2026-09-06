// Shared app limits (importable by both server and client code)

// --- Free-tier values, kept as named constants because the marketing pages
// and the legacy /tools flow quote them directly. TIER_LIMITS below is the
// source of truth for the app itself.
export const DAILY_ROWS_LIMIT = 3000;
export const AI_ROWS_PER_REQUEST_LIMIT = 1000;

// Delightful Cells chat: model calls per day, per email-or-IP identity.
export const CHAT_DAILY_MESSAGES_LIMIT = 100;

// --- Credits ---------------------------------------------------------------
// Balances are stored in neurons and displayed in credits. A round trip of the
// agent loop measured ~28 neurons, so one credit ≈ one turn.
export const NEURONS_PER_CREDIT = 30;

export type Tier = "anon" | "free" | "paid";

// Everything metered against Cloudflare's AI bill. `paid` spends neurons out of
// a purchased balance instead of a daily allowance, so its per-day caps are
// unbounded — only the per-run cap survives, to keep one runaway job finite.
export const TIER_LIMITS = {
  anon: { chatTurns: 10, rowsPerDay: 500, aiRowsPerRun: 100 },
  free: { chatTurns: 10, rowsPerDay: 3000, aiRowsPerRun: 1000 },
  paid: { chatTurns: Infinity, rowsPerDay: Infinity, aiRowsPerRun: 5000 },
} as const satisfies Record<Tier, { chatTurns: number; rowsPerDay: number; aiRowsPerRun: number }>;

// Site-wide daily neuron budget per free tier, so anonymous traffic can never
// starve signed-in users. Paid traffic is not bucketed — it pays its own way.
export const SITE_NEURON_BUDGET = { anon: 10_000, free: 50_000 } as const;

// --- Client-side parsing limits --------------------------------------------
// These bound browser memory, not our AI bill, so they are the same for every
// tier: truncating them saves nothing and only makes the showcase look broken.
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Budget for the WHOLE workbook, not per sheet: a 20 MB file can hold a dozen
// sheets, and it is the total that decides whether the tab survives.
export const MAX_IMPORT_ROWS = 10_000;
// exceljs builds a styled object per cell; past this a highlighted export OOMs.
export const MAX_STYLED_EXPORT_ROWS = 20_000;
