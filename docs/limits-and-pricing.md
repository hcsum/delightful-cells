# Limits and pricing

Every number here is enforced from `lib/limits.ts`. Change it there, not here —
this file explains the *why*, the code is the source of truth.

Last verified against production on 2026-09-06.

---

## The four metering units

They are deliberately different, and mixing them up is the easiest way to
overcharge someone.

| Layer | Unit | Where |
|---|---|---|
| Free allowance, chat | turns | `TIER_LIMITS[tier].chatTurns` |
| Free allowance, AI rows | rows | `TIER_LIMITS[tier].rowsPerDay` / `.aiRowsPerRun` |
| Paid deduction | neurons | `credit_balance.balance_neurons` |
| Site-wide backstop | neurons | `SITE_NEURON_BUDGET[tier]` |
| Displayed / sold | credits | `NEURONS_PER_CREDIT = 30` |

**Free is metered in actions, paid is metered in compute.** A free allowance is
a coarse gate and whole numbers are what a user can reason about. Money is not:
a 50-row batch costs 17 neurons, i.e. 0.57 credits. Storing balances in credits
and rounding each call up to 1 would overcharge a 1000-row job by ~2x. So the
balance is stored in neurons and only *displayed* as `floor(neurons / 30)`.

A "turn" is one user message, not one model call. The agent loop fires up to
`MAX_STEPS` calls per turn and the server cannot tell them apart, so the client
sends `x-turn-id` and only the first call carrying that id spends the
allowance. `MAX_CALLS_PER_TURN = 8` bounds a forged id.

---

## Tiers

| | Anonymous | Signed in | With credits |
|---|---|---|---|
| Chat turns / day | 10 | 10 | metered |
| AI rows / day | 500 | 3,000 | metered |
| AI rows / run | 100 | 1,000 | 5,000 |
| Site neuron budget / day | 10,000 | 50,000 | not bucketed |
| Import (whole workbook) | 10,000 rows / 20 MB | same | same |
| Filter, replace, compute, delete | unlimited | same | same |

Signing in does **not** buy more chat turns. It buys three things: your own
50k site budget instead of the shared anonymous 10k, 500 → 3,000 rows a day,
and 100 → 1,000 rows per run.

Import and the mechanical tools run entirely in the browser
(`lib/cells/workbook.ts`, `lib/cells/table-ops.ts`). They cost nothing to
serve, so they are the same at every tier — truncating them would only make
the homepage showcase look broken. The 10,000-row cap is a browser-memory
budget shared across every sheet in the workbook, not a per-sheet cap.

### Order of checks

Both `/api/chat` and `/api/process` resolve it the same way:

1. per-turn call cap (chat only)
2. **site budget for the identity tier** — if exhausted and the user has a
   balance, go straight to paid; otherwise refuse
3. today's free allowance — if exhausted and there is a balance, go to paid
4. call llm-worker with `x-tier`
5. `meterAndCharge` — record site usage, and deduct neurons if this call is paid

Step 2 sits before step 3 on purpose. If the shared budget is gone, credits
are the only way through, and there is no sense burning a free turn on a call
that is going to be billed anyway.

---

## Measured cost

Run on production, 2026-09-06, extracting a city from ~35-character addresses.
Read from `x-usage-neurons`, which is what Cloudflare actually billed.

| Batch | Neurons |
|---|---|
| 10 rows | 5 |
| 50 rows | 17 (measured twice, identical) |

That fits `2 + 0.30 × rows` per call: about **2 neurons of fixed prompt
overhead per request, plus 0.30 neurons per row**. `lib/process.ts` batches at
50 rows, so:

| Rows | Calls | Neurons | Credits |
|---|---|---|---|
| 500 | 10 | 170 | 5.7 |
| 1,000 | 20 | 340 | 11.3 |
| 3,000 | 60 | 1,020 | 34 |
| 5,000 | 100 | 1,700 | 57 |

One chat turn ≈ **28 neurons** (~0.9 credits), measured earlier: 10,000 free
neurons ran about 360 turns.

> **These row numbers are 3x the planning estimate.** The plan assumed ~6
> neurons per 50-row batch and therefore "1,000 rows ≈ 4 credits". It is
> actually ~11. Nothing in the code depends on the old figure — deduction reads
> the real header — but any user-facing claim about rows per dollar has to use
> the numbers above.

Cost is sensitive to input length. These addresses are short; comment or
description columns will run higher per row.

---

## Packs

`lib/billing/packs.ts`. Prices live in Stripe; the amounts below are display
only, so editing them does not change what anyone is charged.

| Pack | Price | Credits | Neurons | CF cost | Stripe fee | Net | Margin |
|---|---|---|---|---|---|---|---|
| starter | $5 | 1,000 | 30,000 | $0.33 | $0.45 | $4.22 | 84% |
| plus | $12 | 3,000 | 90,000 | $0.99 | $0.65 | $10.36 | 86% |
| pro | $30 | 10,000 | 300,000 | $3.30 | $1.17 | $25.53 | 85% |

Cloudflare bills $0.011 per 1k neurons (`lib/usage.ts`). Stripe is 2.9% + $0.30.

What a pack actually buys, at measured rates:

| Pack | Chat turns | AI rows (short input) |
|---|---|---|
| $5 | ~1,070 | ~88,000 |
| $12 | ~3,200 | ~265,000 |
| $30 | ~10,700 | ~880,000 |

> The plan's table listed 93% margin for the $5 pack. That figure ignores the
> Stripe fee, which is proportionally largest on the smallest pack. The $12 and
> $30 rows in the plan match this table.

Credits never expire, are one-time purchases with no subscription, and are not
transferable (see `/terms` §5).

---

## Free exposure

Worst case, both site buckets fully drained every day:

`(10,000 + 50,000) neurons × $0.011/1k = $0.66/day ≈ $20/month`

The buckets are per tier so a flood of anonymous traffic cannot spend what
signed-in users depend on.

---

## Known gaps

- **Batch size is 50 and untuned.** At 2 neurons fixed overhead per call, going
  to 100 rows per batch would cut cost per row by roughly 15%. Untested; it
  also doubles the payload per request and halves the progress-bar resolution.
- **The counter switch is not migrated.** Before this change, `chat:<key>`
  counted model calls against a limit of 100. It now counts turns against 10.
  Same KV key, so on the day of deploy anyone with ≥10 calls already recorded
  was locked out of chat until UTC midnight. Self-healing; noted in case it
  shows up in old logs.
- **`MAX_STYLED_EXPORT_ROWS` (20,000) is currently unreachable** because import
  caps the workbook at 10,000 rows. Kept as a backstop if the import cap is
  ever raised.
- **Export memory.** Measured in Node at 50k × 20 columns: SheetJS plain write
  peaks ~1.5 GB, exceljs styled ~1.4 GB, exceljs at 20k ~281 MB, CSV ~77 MB.
  At the current 10k cap none of this bites, but the plain-export path has no
  row cap of its own if the import cap moves.
