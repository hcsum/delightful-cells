# Terminal Tool Call Plan

Revised after review. Three of the reviewer's four objections stand and have
reshaped the design: the closing line is no longer written by the model, the
empty-output hole is now a blocking prerequisite, and Phase 4 grew a state
model instead of an early `idle`. The fourth objection — that the test and
rollout plumbing does not exist — is half right, and the half that is wrong is
noted where it matters.

**Status**

| Phase | State |
| --- | --- |
| 0 — empty-output accounting | complete |
| 1–3 — `then` contract, validator, loop | complete |
| 4 — unlock the input | complete |
| 5 — UI and i18n | complete |
| 6 — tests | complete — 3/3 terminal cases at 8/8; full suite 26/27, 2026-09-20 |
| 7 — rollout | code complete, flag still off; one browser check, then the preview flip |

Eight phases, 0 through 7. Phase 6's evals were the gate on Phase 7 and are
green. The second gate — the gap-fill, thread 1 below — has since landed, so
what is left is the browser end-to-end that `docs/fill-gaps-in-place-plan.md`
lists as not yet done, and then turning the flag on in preview.

The SSE migration this plan was written against has landed (`d14700c`), so line
numbers here are current as of that commit and Phase 4 is no longer waiting on
it.

## Goal

Remove the second model call from the common single-tool turn. Today a request
like "classify each Customer Feedback into a new column" costs two model calls:
one to pick the tool, one to look at the TOOL_RESULT and say "Done! I classified
all 60 entries." The second call produces no information the tool card and the
grid do not already show, but the user waits for a full round trip and we pay
for it.

The mechanism is a `then` flag on the tool call. The model declares, at the
moment it emits the tool call, that this tool ends the turn. The browser
executes the tool and, unless something went wrong, leaves the authoritative
tool card as the final item and stops.

```text
Today                          After
-----                          -----
model -> tool_call             model -> tool_call + "then": true
browser executes tool          browser executes tool
model -> final                 browser ends at the tool card
(2 calls)                      (1 call)
```

## Non-goals

- Do not remove multi-step turns. `MAX_STEPS = 8` stays. A tool call without
  `then` behaves exactly as it does now.
- Do not let the model pre-write prose about a result it has not seen.
- Do not change the tool set, the validator's existing checks, or billing.

## Why now

- **Cost.** On glm-5.3-flash a call is ~28 neurons. A single-tool turn is ~56
  neurons today; this halves it. That lands directly on the free daily
  allowance and on paid credit balances.
- **Latency.** The grid is already updated and the tool card already rendered
  when the second call starts. The spinner that follows is dead time.
- **Nothing guards it anyway.** The eval suite asserts which tool the model
  picks on the *next* reply; it does not judge the closing sentence. That line
  has never had a quality gate.

## Current behavior

`lib/cells/agent.ts:237` — the loop:

1. `postChatStream` / `postChat` → model reply.
2. `extractToolJson` → `{"type":"tool_call",...}`.
3. `validateToolCall` (`lib/cells/tools.ts:306`).
4. `opts.applyTool(call)` (`components/cells/CellsApp.tsx:658`) runs the tool
   locally, updates the grid, returns a `ToolResult`.
5. The tool card is emitted, `TOOL_RESULT` is pushed into `history`.
6. Next iteration: a second model call, which returns `{"type":"final",...}`.

Step 6 is what this plan removes for the tools where it is safe.

## Phase 0 (prerequisite): honest empty-output accounting

**Done**, in the working tree: `processResultCounts` and
`rowRunRequiresFollowup` in `lib/cells/tools.ts`, applied by both AI tools,
plus `tests/process-result-counts.test.mjs`. Kept here because it is the
rationale the rest of the plan rests on.

This was a bug we had regardless of this plan.

`components/cells/CellsApp.tsx:492`:

```ts
const filled = results.filter((r) => r.output != null).length;
```

`ProcessResultItem.output` is `null` only when no answer came back. A row the
model answered with `""` counts as filled. So a transform where 20 of 60 rows
came back empty currently produces:

- card: `60/60 rows → "Sentiment"`
- `data.rowsFailed: 0`
- `data.outcome`: the clean, no-failure sentence

The second model call cannot catch this either, because the TOOL_RESULT it
reads says zero rows failed. The code comment three lines above names exactly
this case — "a row the AI answered with nothing" — and then the arithmetic
below does not distinguish it.

This matters twice over for this plan. It breaks the veto list, and it breaks
the premise the whole design leans on: that the tool card's counts are always
true because they come from the real result. Until this is fixed, they are not.

What this required, all of it now landed:

- Count `r.output != null && r.output !== ""` as filled. Report empty answers
  as their own number, separate from `rowsFailed`.
- Add an explicit `ToolResult.requiresFollowup?: boolean`, set by `runTransform`
  and `runAiFilter`, rather than having the agent loop re-derive trouble from
  `failedIndices`. The loop should not be reverse-engineering row-pipeline
  state.
- Say the shortfall in `summary` and in `data.outcome`, so today's two-call
  path also stops claiming 60/60. Both branches currently hang off
  `failed > 0`, so a run where every shortfall is an empty answer takes the
  clean branch and says nothing at all.
- Make the mixed case add up. With 60 rows, 10 unanswered and 20 answered
  empty, the outcome sentence reads "10 of 60 rows could not be processed …
  the user chose to keep the 30 rows that worked". 10 + 30 = 40; the other 20
  are missing from a sentence whose whole job is to account for them. It now
  reads "Of the 60 rows, 10 got no answer and 20 more came back empty; all 30
  were left blank …", and the clause about what the user chose is written only
  when they were actually asked — the dialog opens for unanswered rows, never
  for empty ones, so a run whose whole shortfall is empty answers used to
  report a decision nobody made.

Then the same three things in `filter_rows_ai`, which has the identical bug and
was not part of the one-line fix. `judged = results.length - failed` counts a
row answered with `""` as judged, and `/^\s*yes\b/` then files it as a NO. The
comment directly above says a row we never got an answer for is not a NO; a row
answered with nothing is not a NO either, and `rowsJudged` overstates by
exactly that many.

Ship Phase 0 on its own. It is a correctness fix with no flag.

### Defensive accounting

`processResultCounts` also treats an in-range `output: null` that is absent
from `failedIndices` as empty. Its unit test asserts that the three counts sum
to the input length, so drift cannot silently lose a row again.

### What Phase 3 needs back from it

Phase 0 is worth doing for its own sake, but the later phases consume one
specific thing from it, so it should not be left implicit:

**A single boolean on `ToolResult` that means "a second model call is
warranted", decided by the code that ran the pipeline.** Name it
`requiresFollowup`. It must be true when any of these happened:

- rows got no answer (`failedIndices`),
- rows were answered with an empty string,
- the run was cut short (`stopped`),
- the partial-result dialog was shown and the user chose to keep what worked.

Phase 3's veto is then `result.ok && !result.requiresFollowup`, and nothing in
`lib/cells/agent.ts` has to know what a row pipeline is. If Phase 0 instead
lands three separate counters and leaves the judgement to the caller, Phase 3
has to re-derive it — which is the thing the reviewer objected to in the first
place.

The reverse is also worth stating: `requiresFollowup` is not the same as "the
card should look alarming". A transform with 3 empty rows out of 60 is a
successful edit the user can see, and the card should say so precisely; the
flag only decides whether the model gets a turn to explain it.

## Design

### The `then` flag

```jsonc
{
  "type": "tool_call",
  "tool": "transform_column",
  "column": "Customer Feedback",
  "instruction": "...",
  "newColumnName": "Sentiment",
  "then": true
}
```

`then` is optional and boolean. Present and true means: *this tool call ends
the turn*. Absent keeps today's behavior, which is what the model must do
whenever it needs to read the result before answering.

### Why the model does not write the closing line

The first draft had the model supply `then.say` with a "no numbers" rule
enforced by `/\d/`. That guard does not hold. It catches `60` and misses
`一百`, `%`, `all of them`, `已全部替换`, and any confident claim of success
phrased without a digit — which is the exact failure mode that matters, because
a pre-written line has not seen the result it is describing.

So the model decides *whether* the turn ends; the client decides *what is
said*. The closing line is rendered from the `ToolResult` the tool actually
produced.

This costs almost nothing to build, because the rendered line already exists:
`ToolResult.summary` is a per-tool human string built from real numbers
(`60/60 rows → "Sentiment"`), and `data.outcome` is a full sentence. The
closing line should be produced by the same code that builds them, so there is
one source of truth for what happened.

Open sub-question for Phase 3: whether to emit a chat bubble at all. The card
is already on screen and already carries the counts. "User message → tool card
→ done" may read better than a templated sentence restating the card. Try the
no-bubble version first; it is strictly cheaper and cannot lie.

### Tool allowlist

`then` is only honored for tools whose result is fully described by their own
card:

| Tool | `then` allowed | Why |
| --- | --- | --- |
| `find_replace` | yes, with vetoes | Deterministic, local. |
| `filter_rows` | yes, with vetoes | Deterministic. |
| `highlight_rows` | yes, with vetoes | Pure display. |
| `remove_column` | yes | Deterministic, and it always removes what it named. |
| `compute_column` | yes, with vetoes | Deterministic. |
| `transform_column` | yes, with vetoes | AI row pipeline — see below. |
| `filter_rows_ai` | yes, with vetoes | Same. |
| `summarize_column` | **no** | Its entire purpose is to hand `topValues` and an overview back to the model to interpret. Ending the turn here answers the user's question with silence. |

A `then` on `summarize_column` is dropped by the validator, not treated as an
error: the turn just costs two calls, as it does today.

### Client-side vetoes

Even on an allowlisted tool, the browser ignores `then` and falls through to a
second model call when the result is not a clean success:

- `result.ok === false`. Covers the destructive-confirm decline path at
  `components/cells/CellsApp.tsx:663`, where the user said no.
- `result.requiresFollowup === true` (Phase 0). Covers unanswered rows, empty
  answers, a `stopped` reason, and the partial-result dialog — all decided by
  the code that ran the pipeline, not inferred by the loop.
- `result.requiresFollowup === true` on a deterministic tool that legally did
  nothing: nothing matched, nothing was replaced, nothing was highlighted or
  cleared, or `compute_column` left rows blank. This was missed in the first
  pass of the allowlist, which took "deterministic" to mean "the card is the
  whole story". It is not. `0 replacements in 0 rows` is a true card and a
  useless answer — the user asked for a replacement and the reason it did not
  happen (a different spelling, the wrong column) is exactly what the model is
  for. `matchOutcome`'s zero branch is already a sentence written *to* the
  model — "Do not tell the user that rows were selected" — so ending the turn
  there throws away an instruction someone has to read.

When a veto fires, the loop continues exactly as today: the model gets the
TOOL_RESULT and writes an accurate final answer. The expensive path is the
uncommon one.

## Phase 1: prompt contract

**Done.** `lib/cells/tools.ts` `buildSystemPrompt`.

One line in the prompt contradicted this design and was rewritten:

> Pick ONE of the objects above and send only that: a tool call OR a final,
> never both in the same reply. After a tool call, wait for its TOOL_RESULT
> before you say anything to the user.

The second sentence is gone; the first stayed. In its place, two rules that
distinguish the cases:

- If you need to read the result before you can answer — anything about what
  the data *says*, anything using `summarize_column`, anything needing a second
  tool — send the tool call alone and wait for the TOOL_RESULT.
- If the tool call itself is the whole answer — you are changing the sheet and
  the user can see the change — add `"then": true` and the turn ends there.

Since `then` is now a boolean, the prompt gets smaller, and the model's job is
a single yes/no rather than a yes/no plus constrained prose. That should also
make the evals in Phase 6 cleaner to read.

## Phase 2: validator

**Done.** `lib/cells/tools.ts` `validateToolCall`.

- `then?: boolean` on the `ToolCall` type.
- `TERMINAL_TOOLS` (`lib/cells/tools.ts:310`), seven tools, `summarize_column`
  deliberately absent.
- A `finish()` wrapper honors `then` only when `raw.then === true` and the tool
  is in `TERMINAL_TOOLS`, and drops it silently otherwise.

Dropping rather than erroring matters: an invalid `then` must never cost the
user a turn or trigger the self-correction path.

## Phase 3: agent loop

**Done.** `lib/cells/agent.ts`, after the tool card is emitted.

The veto lives in `shouldEndTurnAfterTool` (`lib/cells/tools.ts:320`) rather
than in the loop, so the loop never inspects pipeline state:

```ts
enabled && call.then === true && result.ok && !result.requiresFollowup
```

**The no-bubble option won.** The loop returns straight after emitting the tool
card; no closing line is rendered at all. A turn now reads: user message → tool
card → done. There was nothing for a templated sentence to add that the card
does not already say, and a line that is never written can never be wrong.

## Phase 4: unlock the input without lying about the turn

**Done.** `components/cells/CellsApp.tsx` and `components/cells/ChatPanel.tsx`.

The first draft said "set the phase back to `idle` once the tool has run". That
is wrong, and the review is right about why. `agent.phase === "idle"` currently
means three things at once: the composer is enabled (`CellsApp.tsx:630`), no
model call is in flight, and the turn's bookkeeping is settled. Flipping it
early breaks the third.

Concretely, `lastTurnSnapshotRef` is written only in the turn's `finally`
(`CellsApp.tsx:706`), and only when the turn is still current. If the user
sends a new message while the trailing model call is running:

- `handleSend` diffs the grid against a snapshot taken *before* the previous
  turn, so `describeUserChanges` attributes the tool's own edits — the new
  Sentiment column — to the user as a hand edit, and tells the model so.
- `turnIdRef.current++` marks the old turn stale, but nothing aborts the
  in-flight request. `postChatStream` already accepts a `signal`; the loop
  never passes one.

So Phase 4 needs three things, not one, and all three landed:

1. **Split the state.** `agent.toolLanded` is set the moment a tool returns,
   and `inputLocked` is derived from it rather than from the phase:
   `(phase !== "idle" && !toolLanded) || toolRunning || partialPrompt != null`.
   `ChatPanel` takes `inputLocked` as its own prop; its `thinking` indicator
   still follows the phase, so the dots keep moving while the composer is
   open — the turn is not over and the UI does not pretend it is. `aiBusy`,
   which blocks hand edits to cells, is deliberately left on the phase: the
   composer reopening is not a reason to reopen the grid mid-turn.
2. **Snapshot per tool, not per turn.** `lastTurnSnapshotRef` is written in the
   `applyTool` wrapper right after the tool returns, for every tool and
   whatever the result. The turn's `finally` still writes it too, which is what
   covers a turn that never called a tool.
3. **Abort the stale request.** `supersedeTurn()` bumps `turnIdRef` and aborts
   the turn's `AbortController` in one place; `handleSend`, `handleFile` and
   `handleSelectSheet` all go through it. The signal is threaded through
   `runAgentTurn` into both `postChatStream` and `postChat`. An aborted fetch
   rejects into `handleSend`'s catch, which is already guarded by the turn id,
   so nothing is shown for a turn the user replaced.

One accuracy note on (3): aborting stops a stale reply from landing and frees
the browser, but it does **not** avoid the charge. `app/api/chat/stream/route.ts`
pumps under `waitUntil` and settles billing on completion regardless of whether
the browser is still listening. Cancelling the upstream on client disconnect is
a separate piece of work; do not claim this one as a cost saving.

Consequence to accept deliberately: if the user sends a new message before a
trailing non-terminal reply lands, it is discarded. That is the right trade.

The SSE branch this phase used to wait on has landed (`d14700c`), so the
`AgentPhase` machine in `lib/cells/agent.ts:39` is stable and this phase can
start whenever. It is independent of Phase 0 and of the `then` work.

## Phase 5: UI and i18n

**Done.** `lib/cells/i18n.ts`, `components/cells/ToolCallCard.tsx`.

- `thinkingAnalyzing` removed from all three locales. It was dead after
  `d14700c`: step 1 maps to the `analyzing` phase, which `ChatPanel` renders as
  `phaseAnalyzing`.
- The card is now the only place the counts appear, and it needed one fix to
  earn that: it renders every key of the call as a parameter row, so `then`
  arrived as a `param_then` line reading "true" — `t()` falls back to the key
  itself, so it would have shipped that literal string in all three locales.
  `then` is filtered out. The counts themselves come from `result.summary`,
  which Phase 0 made honest.

## Phase 6: tests

**Done.** `node scripts/eval.mjs --case terminal --runs 8` against the
production worker (glm-5.3-flash), 2026-09-20:

```text
✅ no-terminal-before-a-second-tool  8/8
✅ no-terminal-on-a-question         8/8
✅ terminal-on-a-sheet-edit          8/8
```

N/N on all three, which is the bar this harness sets.

The other 24 cases were then run one at a time, same settings: 23 at 8/8, and
`report-unjudged-rows` at 2/8. That one is not a regression from the Phase 1
prompt edit — the same case on `d14700c`, with the old prompt and no `then` in
the tree at all, scores 1/8. Its recorded baseline of 8/8 was measured on
glm-4.7-flash on 2026-09-15; it has been red since the switch to
glm-5.3-flash, and this plan neither caused it nor fixes it.

What it fails at: after a `filter_rows_ai` run that left 54 of 154 rows
unjudged, the model is supposed to answer the user and say so. Six or seven
times in eight it calls `filter_rows_ai` again instead, on exactly the rows the
result listed as unanswered. Phase 3's veto is what keeps this case two calls
long in the first place — `requiresFollowup` is true here, so `then` could not
have ended that turn even if the model had asked for it.

Fixed since, outside this plan, in two parts:

- `retryHint` was handing the model `101, 102, 103, …` — a `rows:` array with
  the punctuation changed — and then telling it not to use one. It now leads
  with what the next reply is rather than what it must not be, and collapses
  the numbers to `101–154`. That moved the case from 1-2/8 to 11/16 over two
  runs of 8, which spread 7/8 and 4/8. Wording alone does not get there.
- `repeatsRowRun` (`lib/cells/agent.ts`) refuses a second run of the same
  question on the same column inside one turn, and hands the model an error to
  answer from. One model call instead of 54 rows of billing, whatever the model
  decides to do. The eval still scores the model's choice, because a case
  judges one reply and cannot see the loop.

The review said the harness lacks the assertions and the project has no way to
unit-test TypeScript. The first is true and cheap; the second was not true.

**Evals.** `scripts/eval.mjs` now includes `requireThen` and `forbidThen`, with
three generated cases:

- `terminal-on-a-sheet-edit` — "replace X with Y in Status" → `then: true`.
- `no-terminal-on-a-question` — "which region appears most" → `summarize_column`
  with no `then`.
- `no-terminal-before-a-second-tool` — a request needing two tools must not
  close after the first.

Run at `--runs 8` minimum and treat anything short of N/N as a failure, per the
harness's own note.

**Unit tests — done.** `scripts/build-tools.mjs` already compiles
`lib/cells/tools.ts` to `.eval-build/` and exports `loadTools()`, which
`scripts/eval.mjs` and `scripts/mint-cases.mjs` use to call the real
`validateToolCall`; `tests/process-result-counts.test.mjs` does the same.
Covered:

- `then` dropped on `summarize_column`, and honored only for literal `true`.
- Veto on `ok: false` and on `requiresFollowup: true`.
- Empty and missing outputs are counted separately, the buckets cover every
  result, and either kind of shortfall requires follow-up.

**Why the evals are not optional.** The unit tests prove the client handles
`then` correctly once the model sends it. They cannot prove the model sends it
when it should and withholds it when it should not — which is the entire risk
this feature introduces, and the one thing only a sampled eval can measure. The
three cases above are the gate on Phase 7, not a nice-to-have after it.

## Phase 7: rollout

Gated on `NEXT_PUBLIC_TERMINAL_TOOL_CALL`, checked as `=== "true"`, defaulting
**off**. The first draft said "the same shape as `NEXT_PUBLIC_CHAT_STREAMING`",
which now reads `!== "false"` and therefore defaults **on** — not what a new
behavior with a money and correctness surface should do.

The flag is documented in `.env.example` and defaults off.

Order:

1. ~~Phase 0, unflagged.~~ Done.
2. ~~Validator + loop behind the flag, off. No behavior change.~~ Done.
3. ~~Prompt contract.~~ Done. A model emitting `then` into a client that
   ignores it is exactly today's two-call behavior, which is why this was safe
   to ship before the flag flips.
4. ~~Evals green (Phase 6). **This is the gate.**~~ Done, 3/3 at 8/8.
5. Flag on in preview; check calls-per-turn in the trace output. **Next.**
6. Flag on in production.

Rollback is flipping the flag; the prompt can stay.

## Open threads, 2026-09-20

Threads 1 and 3–6 have since been closed; each is struck through with what was
done. Thread 2 is settled as a documented known-red rather than fixed.


Everything below outlived the session that wrote this plan. Nothing here is
blocking the phases above; all of it is a decision someone still has to make.

1. ~~**The flag is still off, and should stay off until the gap-fill lands.**~~
   The gap-fill landed: `fillsOwnGaps` + `fillCells` make a retry write into
   the blank cells of the column it already made, so there is no second column
   and no sentence for `then` to delete. What is still outstanding is the
   browser end-to-end in that plan's Verification section, which has not been
   run — the predicate and the writer are unit-tested, the React wiring around
   them is not. Rollout steps 5 and 6 are deploy actions and are still untaken.

2. **`report-unjudged-rows` is red and the suite is 26/27.** Settled the first
   way: accepted as a documented known-red. The case carries a `knownRed` field
   holding the reason, and `scripts/eval.mjs` prints it with `⚠️` and its real
   score but leaves it out of the pass count and the exit code. A known-red
   that starts passing says so in the output, so the annotation cannot quietly
   rot. The score itself is unchanged — nothing here makes the model better.

3. ~~**`forbidThen` judges the raw reply, not the validated call.**~~ It now
   runs the reply through the real `validateToolCall` and fails only if the
   client would actually have ended the turn. The prompt-compliance half did
   not deserve to be thrown away, so it is a second check under its own name,
   `forbidRawThen`, and `no-terminal-on-a-question` asserts that one — nobody
   reading a red there can mistake it for a turn that ends early.
   `no-terminal-before-a-second-tool` keeps `forbidThen`, which is the real
   gate: `filter_rows` is in `TERMINAL_TOOLS`, so a `then` there survives
   validation and would genuinely stop the turn one tool short.

4. ~~**`filter_rows_ai` replaces the selection on a re-run.**~~ Fixed with
   `nextSelection` (`lib/cells/tools.ts`), used by both `filter_rows` and
   `filter_rows_ai` so the two filters cannot drift. A call that swept the
   sheet, or narrowed an existing set, still replaces: every row it did not
   match, it did look at. A call aimed at explicit `"rows"` re-decides only
   those rows and leaves the rest of the selection alone — which is the retry
   shape, where the rows outside the list were never in question. `matchOutcome`
   grew an `alsoSelected` count so the zero branch stops saying the selection
   was cleared when it was not. `"filter"` mode is deliberately unchanged.

5. ~~**`retryHint` has two stacked docstrings.**~~ Merged. The body needed a
   correction too: it told the model a rerun "does not merge with what is
   already applied", which threads 1 and 4 have just made false in both tools.
   The charge is what does not get undone, so that is what the sentence says
   now. The recorded `report-unjudged-rows` payload was re-frozen to match, and
   its `why` says the 11/16 measurement predates this wording.

6. ~~**Nothing here is committed.**~~ The pricing-page rework —
   `components/AppShell.tsx`, `components/billing/PricingClient.tsx` and the
   pricing half of `lib/cells/i18n.ts` — went in as its own commit first, and
   this work followed.

### Reproducing a partial run locally

Set `NEXT_PUBLIC_MOCK_BATCH_FAILURE=1` in `.env.local` (`lib/process.ts:361`
documents it: one shot per page load, kills the last batch, re-arm by
reloading). The demo sheet is 60 rows against `AI_BATCH_ROWS = 100`, which is a
single batch, so the injection wipes the whole run instead of part of it. For a
partial, either use a sheet over 100 rows or drop `AI_BATCH_ROWS` to 10 for the
session — the client chunks and the `/api/process` per-request cap read the same
constant, so lowering it keeps both sides consistent. A 15-row fixture is at
`~/Downloads/feedback-15.csv`. Both knobs were reverted when this was written.

## Acceptance criteria

- A single-tool sheet edit completes in one model call, end to end.
- A question that needs `summarize_column` still takes two.
- A `transform_column` where rows come back empty still takes two, and the
  follow-up answer reports the shortfall — which requires Phase 0.
- A declined destructive confirm still takes two, and does not claim the edit
  landed.
- Sending a message mid-turn does not produce a "the user changed the sheet by
  hand" note describing the agent's own edit.
- Median neurons per single-tool turn drops by roughly half.

## Open questions

- ~~**Closing bubble or no bubble.**~~ Settled in Phase 3: no bubble. Revisit
  only if the turn reads as abrupt once the flag is on with real users.
- **Does `then` belong on the tool call or in a separate reply type?** On the
  call keeps one JSON object per reply, which the prompt already insists on. A
  separate `{"type":"tool_call_final",...}` is more explicit but doubles the
  shapes the validator accepts.
- **Client disconnect should cancel the upstream.** Out of scope here, but
  Phase 4 makes abandoned turns more common, so it gets worse if ignored.
- **Interaction with `touchedTheSheet`.** The parse-fail branch at
  `lib/cells/agent.ts:271` already treats prose-after-an-edit as a report and
  stops. Once `then` exists, that branch and this one are two answers to the
  same question and should be described together in the code comment.
