import assert from "node:assert/strict";
import test from "node:test";

import { loadTools } from "../scripts/build-tools.mjs";

test("empty row answers are separate from missing answers", async () => {
  const { processResultCounts } = await loadTools();
  const counts = processResultCounts(
    [
      { output: "positive" },
      { output: "" },
      { output: "   " },
      { output: null },
      { output: null },
    ],
    [3],
  );

  assert.deepEqual(counts, { filled: 1, empty: 3, failed: 1 });
  assert.equal(counts.filled + counts.empty + counts.failed, 5);
});

test("row run shortfalls require a follow-up", async () => {
  const { rowRunRequiresFollowup } = await loadTools();

  assert.equal(rowRunRequiresFollowup({ empty: 1, failed: 0 }, undefined, false), true);
  assert.equal(rowRunRequiresFollowup({ empty: 0, failed: 1 }, undefined, false), true);
  assert.equal(rowRunRequiresFollowup({ empty: 0, failed: 0 }, { reason: "quota" }, false), true);
  assert.equal(rowRunRequiresFollowup({ empty: 0, failed: 0 }, undefined, true), true);
  assert.equal(rowRunRequiresFollowup({ empty: 0, failed: 0 }, undefined, false), false);
});

test("validator only honors literal true on terminal tools", async () => {
  const { validateToolCall } = await loadTools();
  const base = { type: "tool_call", tool: "filter_rows", column: "Status", op: "equals", value: "open" };

  assert.equal(validateToolCall({ ...base, then: true }, ["Status"]).call.then, true);
  assert.equal(validateToolCall({ ...base, then: "true" }, ["Status"]).call.then, undefined);
  assert.equal(validateToolCall({ ...base, then: 1 }, ["Status"]).call.then, undefined);

  const summarize = validateToolCall(
    { type: "tool_call", tool: "summarize_column", column: "Status", then: true },
    ["Status"],
  );
  assert.equal(summarize.call.then, undefined);
});

test("terminal calls stop only after a clean successful result", async () => {
  const { shouldEndTurnAfterTool } = await loadTools();
  const call = { tool: "remove_column", columns: ["Notes"], then: true };

  assert.equal(shouldEndTurnAfterTool(call, { ok: true, summary: "done", data: {} }, true), true);
  assert.equal(shouldEndTurnAfterTool(call, { ok: false, summary: "declined", data: {} }, true), false);
  assert.equal(
    shouldEndTurnAfterTool(call, { ok: true, summary: "partial", data: {}, requiresFollowup: true }, true),
    false,
  );
  assert.equal(shouldEndTurnAfterTool(call, { ok: true, summary: "done", data: {} }, false), false);
});

test("the shortfall sentence names only the buckets that happened", async () => {
  const { shortfallPhrase } = await loadTools();

  assert.equal(shortfallPhrase(10, 20), "10 got no answer and 20 more came back empty");
  assert.equal(shortfallPhrase(10, 0), "10 got no answer");
  assert.equal(shortfallPhrase(0, 20), "20 came back empty");
});

test("a deterministic tool that did nothing asks for the model", async () => {
  const { dispatchTool, validateToolCall } = await loadTools();
  const grid = {
    headers: ["Status"],
    rows: [["open"], ["open"]],
    selectedRows: null,
    filterKept: null,
    highlightedRows: null,
  };
  const run = (raw) => dispatchTool(validateToolCall(raw, grid.headers, grid).call, grid).result;

  const missed = run({ tool: "find_replace", column: "Status", find: "closed", replace: "done" });
  assert.equal(missed.requiresFollowup, true);
  const hit = run({ tool: "find_replace", column: "Status", find: "open", replace: "done" });
  assert.equal(hit.requiresFollowup, false);

  const noMatch = run({ tool: "filter_rows", column: "Status", op: "equals", value: "closed" });
  assert.equal(noMatch.requiresFollowup, true);
  const match = run({ tool: "filter_rows", column: "Status", op: "equals", value: "open" });
  assert.equal(match.requiresFollowup, false);
});

test("a spent row run cannot be re-run inside the same turn", async () => {
  const { repeatsRowRun } = await loadTools();
  const spent = { tool: "filter_rows_ai", column: "Notes", criteria: "mentions a refund", mode: "select", rows: null };

  // The real shape of the failure: the same question, aimed at the rows that
  // came back unanswered.
  assert.equal(repeatsRowRun(spent, { ...spent, rows: [101, 102] }), true);
  assert.equal(repeatsRowRun(spent, { ...spent, criteria: "mentions a delay" }), false);
  assert.equal(repeatsRowRun(spent, { ...spent, column: "Comments" }), false);
  assert.equal(repeatsRowRun(spent, { tool: "filter_rows", column: "Notes", op: "equals", value: "x" }), false);

  const transform = { tool: "transform_column", column: "Notes", instruction: "classify", newColumnName: "Kind" };
  assert.equal(repeatsRowRun(transform, { ...transform, newColumnName: "Kind 2" }), true);
  assert.equal(repeatsRowRun(transform, { ...transform, instruction: "summarize" }), false);
  // Different tools never collide, even on the same column.
  assert.equal(repeatsRowRun(transform, { ...spent, column: "Notes" }), false);
});
