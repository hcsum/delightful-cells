# Filling the gaps a partial run left, instead of appending a second column

**Status, 2026-09-20: implemented.** `fillCells` (`lib/cells/table-ops.ts`),
`fillsOwnGaps` (`lib/cells/tools.ts`), the branch and the forked outcome
sentence in `runTransform` (`components/cells/CellsApp.tsx`), and
`tests/fill-gaps.test.mjs`. `npx tsc --noEmit` is clean and `npm run test:sse`
is green. The browser end-to-end in **Verification** below has *not* been run —
see the note there.

The sibling bug this plan put out of scope — `filter_rows_ai` replacing the
selection on a re-run — was fixed alongside it after all, with `nextSelection`
in `lib/cells/tools.ts` and `tests/selection-union.test.mjs`. It is the same
shape of fix: an additive writer plus a gate that says when adding is right.

## Context

A `transform_column` run that comes back incomplete leaves holes. The user
dismisses the partial-result dialog with "keep the rows that worked", the column
lands with blanks in it, and the run is over. Asking for those rows again in a
later turn produces this, reproduced locally on 2026-09-20 with a 15-row sheet
and `NEXT_PUBLIC_MOCK_BATCH_FAILURE=1`:

```text
          客户反馈        关键词          关键词 (2)
row 1-10  …               包装破损,客服态度   (blank)
row 11-15 …               (blank)         好用,推荐
```

The answers all exist. They are in two columns, and merging them is the user's
problem.

**The model did nothing wrong.** It called `transform_column` with
`newColumnName: "关键词"` and `rows: [11,12,13,14,15]` — the right column, the
right rows, 5 rows of billing for 5 rows of work — and it told the user where
the results had landed. The executor is what overrode it: `runTransform` always
appends, so `uniquifyHeader` renamed the target to `关键词 (2)`.

That is why this is not a prompt problem. No wording could have produced a
single filled column, because the tool has no way to write one. The fix is to
make the executor obey the intent the model already states.

Two things this is **not**:

- Not the in-dialog retry. That one is correct: `runRowsWithRecovery` merges
  the new answers into the results array by index and nothing reaches the sheet
  until the whole run settles. It stays as it is.
- Not the `filter_rows_ai` sibling bug, where a second run replaces the
  selection instead of adding to it. That needs a set-union primitive and was
  out of scope here — it was done separately, as `nextSelection`, on the same
  principle: a call aimed at explicit `rows` re-decides only those rows and
  leaves the rest of the selection alone.

## The mechanism

A retry is an ordinary run whose rows happen to be the ones that failed and
whose target column happens to already exist. There is no second concept. What
is missing is a writer:

```ts
// lib/cells/table-ops.ts
export function fillCells(
  rows: string[][],
  colIdx: number,
  values: Map<number, string>,   // grid row index → cell value
): string[][]
```

Copy-on-write per touched row, same shape as `findReplace` (`table-ops.ts:63`),
which is already a row-scoped copy-on-write writer — it just computes its values
from the old cell instead of taking them from the caller. Nothing else in
`lib/cells/` writes cells by index; `appendColumn` only widens.

## The gate

`runTransform` fills in place only when all three hold, and takes today's append
path otherwise:

1. A column named `call.newColumnName` already exists.
2. `grid.lineage[name]` records `transform_column` from the **same source
   column** with the **same instruction** (`tools.ts:56`, `withLineage`).
3. Every target row is **empty** in that column.

Each condition guards something different:

- (1) and (2) keep us out of columns that are not ours. A sheet can arrive with
  a column already called 关键词; without the lineage check, a name collision
  would write AI output into the user's own data.
- (3) keeps us from destroying answers that already exist. The model picks
  `rows` and may well send `scope: "all"` when the user says "redo it" — under a
  rows-only rule that overwrites ten answers already paid for, plus any cell the
  user has since hand-edited.

**Every failing condition degrades to exactly today's code path**, which is the
property that makes this safe: a first run never matches (the column does not
exist yet), a renamed column loses its lineage entry and appends, a request that
overlaps filled cells appends.

Deliberately **not** doing it by name alone. Today `uniquifyHeader` guarantees a
fresh column, so running the same transform twice can never overwrite anything.
Matching on the name would turn a currently unloseable operation into a
destructive one.

No partial fills: if any named row already holds a value, this is not a
gap-fill, so it appends. Writing some rows and skipping others produces a result
nobody can explain.

## Changes

| File | Change |
| --- | --- |
| `lib/cells/table-ops.ts` | Add `fillCells`. |
| `lib/cells/tools.ts` | Add the gate as a pure predicate, e.g. `fillsOwnGaps(grid, name, sourceColumn, instruction, targets)`, so it is unit-testable without React. |
| `components/cells/CellsApp.tsx` | `runTransform`: branch on the predicate. Fill → `fillCells` + keep the existing header, skip `uniquifyHeader`. Append → unchanged. |
| `components/cells/CellsApp.tsx` | The `outcome` sentence forks: today it says a column was added, which is false for a fill. It has to say the rows were filled into the existing column and how many of its cells are still blank. |
| `tests/…` | The predicate's truth table, and `fillCells` itself. |

Untouched: the tool schema, `buildSystemPrompt`, `validateToolCall`, the evals.
The model already emits the call this needs, so there is no prompt change and no
prompt-regression risk.

The card's badge keeps its shape (`5/5 rows → "关键词"`), so no new i18n keys.

## Verification

- `npx tsc --noEmit` clean, `npm run test:sse` green.
- Unit: the predicate returns false for a fresh column, a renamed column, a
  different instruction, a different source column, and any overlap with a
  non-empty cell; true only for the gap-fill.
- **Not yet done.** End to end, with `NEXT_PUBLIC_MOCK_BATCH_FAILURE=1` and `AI_BATCH_ROWS`
  temporarily at 10 (see `docs/`-adjacent notes in the terminal-tool-call plan):
  a 15-row sheet, transform, "keep the 10 that worked", then ask for rows 11-15
  in a new turn. One column, no blanks, no `关键词 (2)`.
- **Not yet done.** The negative case in the same session: ask for a *different*
  instruction into the same column name and confirm a second column still appears.

Both browser steps are still open. What stands in for them today is
`tests/fill-gaps.test.mjs`, whose last case replays the two-run sequence
through the real `fillsOwnGaps` / `fillCells` / `appendColumn` and asserts one
full column at the end — the pure half of the path. What it cannot check is the
React wiring around it: that `runTransform` hands the predicate the right grid
and the right target rows. Do the browser run before the flag is turned on.

## Interaction with the terminal-tool-call flag

Worth settling before `NEXT_PUBLIC_TERMINAL_TOOL_CALL` is turned on. A gap-fill
run is a clean success — `ok`, no `requiresFollowup` — so with the flag on the
turn would end at the tool card. That is fine once the fix is in, because there
is nothing left to explain. It is not fine today: the sentence naming which
column the results landed in is the only thing telling the user their data is
split, and `then` would delete it.

With the fix in, that objection is settled and the flag is unblocked. The
remaining condition is the browser run above.
