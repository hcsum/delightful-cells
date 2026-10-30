# Limits and pricing

Every number here is enforced from `lib/limits.ts`. Change it there, not here —
this file explains the *why*, the code is the source of truth.

Last verified against production on 2026-09-06. Free metering moved from
actions to neurons on 2026-09-16; the measured-cost sections below are
unchanged by that.

---

## The metering units

Everything is counted in neurons. Only the presentation differs.

| Layer | Unit | Where |
|---|---|---|
| Free allowance | neurons/day | `TIER_LIMITS[tier].dailyCredits × 30` |
| Paid deduction | neurons | `credit_balance.balance_neurons` |
| Site-wide backstop | neurons | `SITE_NEURON_BUDGET[tier]` |
| Displayed / sold | credits | `NEURONS_PER_CREDIT = 30` |

**Free and paid are metered the same way**, in what Cloudflare actually billed
us (`x-usage-neurons`), never in a local estimate. Free used to be metered in
*actions* instead — so many chat turns, so many AI rows — on the theory that
whole numbers are easier to reason about. Two things were wrong with it. It
made the product answer a question nobody asks (is this a chat thing or a rows
thing? chatting about a sheet processes rows), and it made a free day and a
bought credit incomparable, so "what does signing in get me" had no answer in
the same unit as "what does $5 get me".

Neurons are the storage unit; credits are the only unit a user ever sees.
`floor(neurons / 30)` — a 50-row batch costs 17 neurons, i.e. 0.57 credits, and
rounding each call up to a whole credit would overcharge a 1,000-row job ~2x.

The final free call may overshoot its personal allowance. A D1 identity lock
allows only one in-flight call across `/api/chat`, `/api/chat/stream`, and
`/api/process`, so concurrency cannot multiply that last free turn.

### Atomic admission and settlement (2026-10-30)

Apply `migrations/0004_inference_guards.sql` before deploying this code. The
normal `pnpm cf` command applies remote migrations before building/deploying;
for a separate rollout use `pnpm exec wrangler d1 migrations apply delightful-cells --remote --env prod`.

- Free calls atomically reserve 2,048 neurons against both the personal D1
  allowance and the shared tier budget. The site must have the full reservation
  available; the personal allowance only needs a positive remainder. Actual
  measured usage replaces the reservation exactly once. Existing KV counts seed
  each D1 daily counter once; KV usage totals remain display-only thereafter.
- Paid calls atomically hold `min(balance, 2048)` neurons before inference,
  then refund the unused part after measured settlement. Credits are never
  released just because the browser disconnected. The final small balance can
  cover at most one call, rather than an arbitrary number of parallel calls.
- Known upstream HTTP rejections refund the hold/reservation. An unknown result
  (timeout, missing usage, crashed isolate) retains the conservative reservation
  or prepaid hold for reconciliation. Malformed extraction output with measured
  usage is charged for the inference, preventing deliberate parse-failure abuse.
- Locks expire after ten minutes, beyond the two-minute upstream timeout. An
  expired lock does **not** release its outstanding reservations. Orphaned rows
  can be inspected in `ai_budget_reservation` / `ai_credit_reservation` (where
  `settled = 0`) and reconciled against Worker usage before any manual refund.
- D1 errors fail closed. The 2,048-neuron reservation is a conservative admission
  bound, not a Cloudflare billing limit; re-evaluate it when changing models,
  input bounds (24k characters), or output-token limits (1,024/2,048).

Rows are a *derived* figure now, not a limit: `rowsAffordable(neurons)` inverts
the measured cost model for the surfaces that can only speak in rows (`/tools`,
the import hint, `limits.maxRowsPerRun`). It is exact for short text only, so
every surface that renders it says "about".

---

## Tiers

| | Anonymous | Signed in | With credits |
|---|---|---|---|
| Free credits / day | 15 (450 neurons) | 30 (900 neurons) | metered |
| ≈ chat turns / day | ~4 | ~9 | metered |
| ≈ AI rows / day, short text | ~1,406 | ~2,812 | metered |
| Site neuron budget / day | 25,000 | 100,000 | not bucketed |
| Import (whole workbook) | 10,000 rows / 20 MB | same | same |
| Filter, replace, compute, delete | unlimited | same | same |

The two free rows are sized by what they are *for*, and they are sized on the
**chat** side, because chat is where the product proves itself. 450 neurons is
about four turns; 900 is about nine.

> **These were 8 and 20 for exactly one day.** Shipped 2026-09-16 sized against
> "one turn ≈ 28 neurons" — the per-call figure wearing a per-turn label, see
> above. At the real 3.3 calls a turn that handed an anonymous visitor about
> **two** turns against the old six, which is not enough to see the thing work.
> Re-sized to 20/40 on 2026-09-17 against the corrected numbers.
> Changed to 15/30 on 2026-09-20.
>
> The row equivalents that fall out are much wider than the old row caps —
> ~1,406 and ~2,812 against 200 and 1,000. That is what sizing on chat costs,
> and it is the right way round: running out of rows reads as "I finished
> something and want to do the next one", running out of turns reads as
> broken.

**Anonymous is a demo.** Enough to watch it work, not to get work done. The
demo sheet is 60 rows, so 15 credits can run it several times — but that is
still only about four multi-step conversations.

**Signed in is light real use that ends.** 30 credits gets a real file
processed, and then the day is over.

Signing in buys two things: the 100k site budget instead of the shared
anonymous 25k, and 15 → 30 credits a day.

> There is no separate row cap on top of the credit allowance. One bucket is
> the whole point.

Import and the mechanical tools run entirely in the browser
(`lib/cells/workbook.ts`, `lib/cells/table-ops.ts`). They cost nothing to
serve, so they are the same at every tier — truncating them would only make
the homepage showcase look broken. The 10,000-row cap is a browser-memory
budget shared across every sheet in the workbook, not a per-sheet cap.

### Order of checks

Both `/api/chat` and `/api/process` resolve it the same way:

1. **site budget for the identity tier** — if exhausted and the user has a
   balance, go straight to paid; otherwise refuse
2. today's free allowance (`billFreeCall`) — if already spent and there is a
   balance, go to paid; otherwise refuse with `dailyCreditsExhausted`
3. call llm-worker with `x-tier`
4. settle the measured cost: `chargeNeurons` against the balance when the call
   is paid, `commitFreeNeurons` against today's counter when it is free

Step 1 sits before step 2 on purpose. If the shared budget is gone, credits
are the only way through, and there is no sense burning free allowance on a
call that is going to be billed anyway.

There is no longer a per-turn call cap, and the client no longer sends
`x-turn-id`. Both existed to make "one turn spends one unit" enforceable
against a forged id. Now every call spends what it costs, so a forged id buys
nothing.

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
| `/cells` usage meter | `me.daily.creditsLeft`, in credits |
| `/cells` drop zone and file bar | `me.limits.maxRowsPerRun` from `/api/me`, anon floor until it answers |
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
free users it is `rowsAffordable(daily.neuronsLeft)` — today's remaining
allowance, converted at the measured rate — capped at `MAX_IMPORT_ROWS`; for
users with credits it is `MAX_IMPORT_ROWS`, currently 10,000 rows.
`/api/process` caps one *request* at `AI_BATCH_ROWS`, because that is the size
the worker's output-token budget can actually answer: a larger request would
come back truncated rather than refused. The run as a whole is controlled by
`billFreeCall` refusing the next batch once the allowance is spent.

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

One chat **call** ≈ **28-30 neurons** (~1 credit). Measured twice and they
agree: the eval suite over 96 calls of glm-5.3-flash came to ~28, and
production's counter read 271 neurons over 9 calls on 2026-09-17.

**A turn is not a call, and this was written down wrong for a long time.** The
line here used to read "one chat *turn* ≈ 28 neurons, 10,000 neurons ran about
360 turns". Those 360 were *requests* — the site counter counts calls — so the
per-turn figure was really the per-call figure wearing the wrong label. While
the free allowance was metered in turns, one turn cost one unit no matter how
many calls it made, so nothing ever read the difference. Metering in neurons
reads it everywhere.

The agent loop makes several calls per user message: plan, act, look again,
report. Counted off the 16 turns in `.dev-trace`: **53 calls, mean 3.3, median
3, max 6** (`MEASURED_CALLS_PER_TURN`). So a turn costs about **100 neurons,
i.e. ~3.3 credits**, not one.

> That trace is the multi-step 核对 work the eval suite was built from — the
> heavy end. A one-line question is 1-2 calls. 3.3 is the pessimistic figure;
> `turnsAffordable()` uses it, and every surface says "about".

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

| Pack | AI calls | Chat turns | AI rows (short input) |
|---|---|---|---|
| $5 | ~1,070 | ~300 | ~88,000 |
| $12 | ~3,200 | ~900 | ~265,000 |
| $30 | ~10,700 | ~3,030 | ~880,000 |

The turns column is the calls column divided by 3.3. The old version of this
table had the calls figure under a "Chat turns" heading, which overstated what
a pack buys by about 3x; `/pricing` printed the same wrong number until
2026-09-17.

> The plan's table listed 93% margin for the $5 pack. That figure ignores the
> Stripe fee, which is proportionally largest on the smallest pack. The $12 and
> $30 rows in the plan match this table.

Credits never expire, are one-time purchases with no subscription, and are not
transferable (see `/terms` §5).

---

## Free exposure

Worst case, both site buckets fully drained every day:

`(25,000 + 100,000) neurons × $0.011/1k = $1.38/day ≈ $41/month`

The anonymous bucket went 10,000 → 25,000 on 2026-09-17 with the allowance.
At the current 450 neurons per visitor, it supports 55 fully-drained visitors.

The signed-in bucket was deliberately left at 100,000. At the current
allowance it supports 111 fully-drained users a day, and at current traffic
(single-digit requests a day) that is still enormous. Raising it would
increase the worst-case bill to buy capacity nobody is using.

The buckets are per tier so a flood of anonymous traffic cannot spend what
signed-in users depend on.

**They are a bill cap, not an anti-abuse device.** A single identity can
extract at most about $0.005 (anonymous) or $0.010 (signed in) of inference in
a day, so no one farms accounts for it. Read each number as "the most I am
willing to pay for this tier on any one day", set it high enough that an
ordinary day never reaches it, and treat a hit as an alarm —
`isFreeTierExhausted` logs `[site-budget] exhausted` for exactly that reason.

The anonymous bucket is deliberately the small one, and not only to save
money: when it runs out the visitor is asked to sign in, which turns overflow
traffic into sign-ups instead of into cost. At the current numbers that wall
arrives after roughly 80 typical visitors a day (3 chat turns at ~100 neurons
each plus one 60-row demo run ≈ 320 neurons). That estimate used to read "95
visitors at 105 neurons each", which was built on the same per-call/per-turn
confusion — a turn is ~100 neurons, not ~28.

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

- **The neuron switch does not migrate the old counters.** The allowance now
  lives under `neurons:<quotaKey>`, a key nothing wrote before. The old
  `<quotaKey>` (rows) and `chat:<quotaKey>` (turns) counters are simply
  abandoned, so on the day of deploy everyone starts the neuron bucket at zero
  no matter what they had already spent — one free day, once. The stale keys
  expire at UTC midnight on their own.
- **An earlier counter switch, for the log archaeology.** Before that,
  `chat:<key>` counted model calls against a limit of 100 and then counted
  turns against 10. Same KV key, so anyone with ≥10 calls recorded on the day
  of that deploy was locked out of chat until midnight.
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
