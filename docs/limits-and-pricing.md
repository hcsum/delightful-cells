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
| Free allowance, AI rows | rows | `TIER_LIMITS[tier].rowsPerDay` |
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
| Chat turns / day | 6 | 10 | metered |
| AI rows / day | 200 | 1,000 | metered |
| Site neuron budget / day | 10,000 | 100,000 | not bucketed |
| Import (whole workbook) | 10,000 rows / 20 MB | same | same |
| Filter, replace, compute, delete | unlimited | same | same |

The two free rows are sized by what they are *for*.

**Anonymous is a demo.** Enough to watch it work, not to get work done. The
demo sheet is 60 rows. Six turns covers the four demo presets plus a couple of
the visitor's own questions; 200 rows a day is the demo three times, or one
small file of their own.

**Signed in is light real use that ends.** 1,000 rows a day gets a real file
processed, and then the day is over. Chat turns stay at 10 because turns are
where the product proves itself: cutting them reads as broken, while running
out of rows reads as "I finished something and want to do the next one."

Signing in buys three things: the 100k site budget instead of the shared
anonymous 10k, 200 → 1,000 rows a day, and 6 → 10 chat turns.

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

## What the UI is allowed to say

A number is only true for one tier, so copy written before the reader's tier is
known must quote **`TIER_LIMITS.anon`** — the floor everyone is guaranteed —
and then say what signing in adds. Quoting the signed-in numbers to everyone is
how the drop zone came to tell anonymous visitors they had 1,000 rows per run
when they had 100.

Where this is enforced:

| Surface | Source of numbers |
|---|---|
| `/cells` drop zone and file bar | `me.limits` from `/api/me`, anon floor until it answers |
| `/tools` landing pages (static) | `components/RowsLimitNote.tsx`, anon floor + what sign-in adds |
| `QuotaBanner` | `/api/quota` (tier-aware), anon floor until it answers |
| `/pricing` comparison table | `TIER_LIMITS`, all three columns shown side by side |

The same rule applies to client-side fallbacks, not just copy: when `/api/me`
is unreachable, `CustomToolClient` and `CellsApp` assume the anonymous daily
floor. Guessing high only produces a run the server rejects.

### Why there is no single-run row cap

The old single-run cap duplicated the daily allowance for free users: anonymous
visitors had 100 rows per run and 200 per day, while signed-in users had 500
per run and 1,000 per day. That forced users to reason about two numbers when
the real limit was simply today's remaining allowance.

Now `/api/me` reports one client-facing number: `limits.maxRowsPerRun`. For
free users it is `daily.rowsLeft`; for users with credits it is
`MAX_IMPORT_ROWS`, currently 10,000 rows. `/api/process` caps one *request* at
`AI_BATCH_ROWS`, because that is the size the worker's output-token budget can
actually answer: a larger request would come back truncated rather than
refused. The whole run is controlled by `billRows`, batch by batch.

Large paid runs are handled with a confirmation dialog instead of a hard stop.
The dialog appears over 1,000 selected rows and uses the measured production
median of 10.5 seconds per 100-row batch. A full 10,000-row workbook is about
100 calls, ~1,050 seconds (18 minutes when rounded up for the UI), and about
107 credits on short text.

Row *cost* gets the same treatment for a different reason: the bill follows
input length, so `minCreditsForRows()` in `lib/limits.ts` is a **floor**, valid
for short inputs. `/pricing` states it with the "short text" caveat attached.
Never quote it bare.

---

## Measured cost

Run on production, 2026-09-06, extracting a city from ~35-character addresses.
Read from `x-usage-neurons`, which is what Cloudflare actually billed.

| Batch | Neurons |
|---|---|
| 10 rows | 5 |
| 50 rows | 17 (measured twice, identical) |

That fits `2 + 0.30 × rows` per call: about **2 neurons of fixed prompt
overhead per request, plus 0.30 neurons per row** — confirmed to the neuron by
the batch-size test below. Both figures, and `AI_BATCH_ROWS`, live in
`lib/limits.ts`. At 100 rows a call:

| Rows | Calls | Neurons | Credits |
|---|---|---|---|
| 500 | 5 | 160 | 5.3 |
| 1,000 | 10 | 320 | 10.7 |
| 3,000 | 30 | 960 | 32 |
| 5,000 | 50 | 1,600 | 53 |
| 10,000 | 100 | 3,200 | 106.7 |

One chat turn ≈ **28 neurons** (~0.9 credits), measured earlier: 10,000 free
neurons ran about 360 turns.

> **These row numbers are 3x the planning estimate.** The plan assumed ~6
> neurons per 50-row batch and therefore "1,000 rows ≈ 4 credits". It is
> actually ~11 (10.7 at the current batch size). Nothing in the code depends on the old figure — deduction reads
> the real header — but any user-facing claim about rows per dollar has to use
> the numbers above.

Cost is sensitive to input length. These addresses are short; comment or
description columns will run higher per row.

---

## Measured latency

Ten sequential 50-row batches against production, 2026-09-06, signed-in tier,
extracting a city from ~35-character addresses:

| | Seconds per 50-row batch |
|---|---|
| Median | 7.4 |
| Fastest | 3.7 |
| Slowest | 22.6 |

**500 rows took 81 seconds end to end**, all ten calls returning 200 — no rate
limiting, which is the thing the per-IP fix was supposed to buy.

Then the same again at the current batch size, on an account in
`UNLIMITED_ACCOUNTS`:

| Run | Calls | Statuses | Rows back | Correct | Neurons | Wall clock |
|---|---|---|---|---|---|---|
| 1,000 rows @ 100 | 10 | all 200 | 1,000 | 1,000 | 321 | 105.8 s |

`2 × 10 + 0.30 × 1000` predicts 320 and the counter said 321, so the cost model
holds at scale, not just on a 200-row sample. Per call: 5.6 s fastest, 10.5 s
median, 19.2 s slowest.

**A 5,000-row run should therefore take about 9 minutes**, and the tab has to
stay open for all of it. The plan said 5.

Two calls out of ten took over 18 seconds — nearly twice the median. A progress
bar that sits still for 20 seconds is normal, not a hang, and the UI should say
so.

> No 5,000-row run has actually been made. What is measured is the *cadence*:
> ten calls in 106 seconds is about 5.7 a minute, and `RL_PAID` allows 120 a
> minute. Fifty calls arrive at that same cadence, so the margin is wide — but
> the 9-minute figure is still extrapolation from a run a fifth the size.

---

## Internal accounts

`UNLIMITED_ACCOUNTS` is a comma-separated list of emails, set as a Wrangler
secret on prod. A signed-in user whose email is in it gets `TIER_LIMITS.paid`
— no daily allowance — so a load test on production is not fought by the same
limits it is trying to measure.

Deliberately narrow:

- Unset means the list is empty. It never defaults to open.
- Anonymous requests are never matched, whatever the list says.
- It lifts the free allowance, nothing else. **The site neuron budget still
  applies**, so an internal account cannot quietly run up the bill.
- The tier stays `free`, so no credits are deducted and no ledger row is
  written. Usage still lands in the site counter, so a test run is visible in
  what the day cost.

Set or clear it with `wrangler secret put UNLIMITED_ACCOUNTS --env prod`. The
value is a real privilege grant: keep it to accounts you control.

---

## Batch size

`AI_BATCH_ROWS` is 100. Measured on production 2026-09-06, the same 200 rows
of addresses run twice, once at 50 rows per call and once at 100:

| Batch | Calls | Neurons | Time in calls | Correct |
|---|---|---|---|---|
| 50 | 4 | 68 | 28.1 s | 200/200 |
| 100 | 2 | 64 | 17.4 s | 200/200 |

Two things come out of this.

**The cost model is exact.** `2 × calls + 0.30 × rows` predicts 68 and 64; the
counter reported 68 and 64. The fixed overhead really is 2 neurons a call.

**But cost is not why to do it.** Doubling the batch saves 6%, not the 15% an
earlier note in this file claimed — that figure was simply wrong arithmetic.
The real win is time: 38% off the same work, because per-call latency hardly
moves with row count (a 100-row call took about as long as a 50-row one), so
halving the number of calls nearly halves the wait. A 5,000-row run goes from
roughly 13 minutes to roughly 9 (measured at 1,000 rows, see above).

The price is that a failed batch loses 100 rows of work instead of 50, and the
progress bar advances half as often — at ~9 s a call it still moves about every
9 seconds.

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

`(10,000 + 100,000) neurons × $0.011/1k = $1.21/day ≈ $36/month`

The buckets are per tier so a flood of anonymous traffic cannot spend what
signed-in users depend on.

**They are a bill cap, not an anti-abuse device.** A single identity can
extract at most about $0.003 (anonymous) or $0.007 (signed in) of inference in
a day, so no one farms accounts for it. Read each number as "the most I am
willing to pay for this tier on any one day", set it high enough that an
ordinary day never reaches it, and treat a hit as an alarm —
`isFreeTierExhausted` logs `[site-budget] exhausted` for exactly that reason.

The anonymous bucket is deliberately the small one, and not only to save
money: when it runs out the visitor is asked to sign in, which turns overflow
traffic into sign-ups instead of into cost. At the current numbers that wall
arrives after roughly 95 typical visitors a day (3 chat turns plus one 60-row
demo run ≈ 105 neurons each).

> The cost of keeping it that low is a timezone one: the bucket is a single
> UTC-day counter, so a busy American afternoon can leave later timezones
> hitting the wall on arrival, every day. Slicing the day into hourly
> allowances would fix it; nothing does that today.

When a bucket is spent, the refusal names the one step that actually works for
that tier — sign in (anonymous: the signed-in bucket is separate) or buy
credits (signed in: paid calls skip the bucket entirely). The text lives in
`lib/cells/i18n.ts` as `siteQuotaAnon` / `siteQuotaFree`, picked by
`siteQuotaMessage()`; the client sends `x-locale` so a server-written refusal
comes back in the language the user is reading.

---

## Known gaps

- **The counter switch is not migrated.** Before this change, `chat:<key>`
  counted model calls against a limit of 100. It now counts turns against 10.
  Same KV key, so on the day of deploy anyone with ≥10 calls already recorded
  was locked out of chat until UTC midnight. Self-healing; noted in case it
  shows up in old logs.
- **A 10,000-row import is verified, a 10,000-row *scroll* is not.** A 10k × 7
  sheet parses and renders on production with 30 rows in the DOM and a 28 MB
  JS heap, and row 10,000 renders correctly. Scroll smoothness was not
  measured: `requestAnimationFrame` is throttled in an automated background
  tab, so every frame timing collected was an artifact. Needs a human with the
  tab in front of them.
- **`MAX_STYLED_EXPORT_ROWS` (20,000) is currently unreachable** because import
  caps the workbook at 10,000 rows. Kept as a backstop if the import cap is
  ever raised.
- **Export memory.** Measured in Node at 50k × 20 columns: SheetJS plain write
  peaks ~1.5 GB, exceljs styled ~1.4 GB, exceljs at 20k ~281 MB, CSV ~77 MB.
  At the current 10k cap none of this bites, but the plain-export path has no
  row cap of its own if the import cap moves.
