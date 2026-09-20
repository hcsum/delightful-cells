import assert from "node:assert/strict";
import test from "node:test";

import { loadTools } from "../scripts/build-tools.mjs";

// Five rows, the first two already selected by an earlier filter_rows_ai run.
const grid = (selected) => ({
  headers: ["Notes"],
  rows: [["refund"], ["refund"], ["delay"], ["refund"], ["delay"]],
  selectedRows: selected ? new Set(selected) : null,
  filterKept: null,
  highlightedRows: null,
});

const sweep = { scope: "all", rows: null };
const retry = { scope: "all", rows: [4, 5] }; // 1-based, as the model writes them

test("a sweep replaces the selection", async () => {
  const { nextSelection } = await loadTools();
  assert.deepEqual(nextSelection(grid([0, 1]), sweep, [2, 3]), new Set([2, 3]));
  assert.equal(nextSelection(grid([0, 1]), sweep, []), null);
});

test("a re-run on named rows adds to the selection", async () => {
  const { nextSelection } = await loadTools();
  // Rows 4-5 were retried; row 3 matched this time, row 4 did not. The two
  // rows the first run matched are outside this call and stay selected.
  assert.deepEqual(nextSelection(grid([0, 1]), retry, [3]), new Set([0, 1, 3]));
});

test("a re-run that matches nothing does not clear what was there", async () => {
  const { nextSelection } = await loadTools();
  assert.deepEqual(nextSelection(grid([0, 1]), retry, []), new Set([0, 1]));
  // With nothing selected beforehand there is nothing to carry, and an empty
  // result is still an empty selection rather than an empty Set.
  assert.equal(nextSelection(grid(null), retry, []), null);
});

test("named rows that stop matching are dropped", async () => {
  const { nextSelection } = await loadTools();
  // Row 4 (index 3) was selected before and is one of the rows this call
  // examined, so a non-match there really does deselect it.
  assert.deepEqual(nextSelection(grid([0, 3]), retry, []), new Set([0]));
});

test("the outcome sentence never claims a selection was cleared when it was not", async () => {
  const { matchOutcome } = await loadTools();
  const base = { outOf: "2 rows", test: "(x)", mode: "select", highlight: null };

  const cleared = matchOutcome({ ...base, matched: 0, alsoSelected: 0 });
  assert.match(cleared, /now cleared/);

  const carried = matchOutcome({ ...base, matched: 0, alsoSelected: 2 });
  assert.doesNotMatch(carried, /cleared/);
  assert.match(carried, /2 rows selected before this call are untouched/);

  const added = matchOutcome({ ...base, matched: 1, alsoSelected: 2 });
  assert.match(added, /alongside the 2 rows that were already selected/);
  // "filter" mode never carries anything: its result is the whole visible set.
  assert.doesNotMatch(
    matchOutcome({ ...base, mode: "filter", matched: 1, alsoSelected: 2 }),
    /alongside/,
  );
});
