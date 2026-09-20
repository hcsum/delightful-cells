import assert from "node:assert/strict";
import test from "node:test";

import { loadTableOps, loadTools } from "../scripts/build-tools.mjs";

// A sheet after a partial run: 关键词 was made by transform_column from 客户反馈,
// and rows 3 and 4 (0-based) came back with nothing.
const partialGrid = () => ({
  headers: ["客户反馈", "关键词"],
  rows: [
    ["包装破损", "包装破损"],
    ["客服态度差", "客服态度"],
    ["很好用", "好用"],
    ["会回购", ""],
    ["推荐给朋友", ""],
  ],
  selectedRows: null,
  filterKept: null,
  highlightedRows: null,
  lineage: {
    关键词: { tool: "transform_column", from: ["客户反馈"], how: "提取关键词" },
  },
});

test("fillCells writes only the rows it is given", async () => {
  const { fillCells } = await loadTableOps();
  const rows = partialGrid().rows;
  const next = fillCells(rows, 1, new Map([[3, "回购"], [4, "推荐"]]));

  assert.deepEqual(next[3], ["会回购", "回购"]);
  assert.deepEqual(next[4], ["推荐给朋友", "推荐"]);
  // Untouched rows come back by identity — copy-on-write, like findReplace.
  assert.equal(next[0], rows[0]);
  assert.equal(next[2], rows[2]);
  assert.notEqual(next[3], rows[3]);
  assert.equal(fillCells(rows, 1, new Map()), rows);
});

test("a retry into our own blank cells fills in place", async () => {
  const { fillsOwnGaps } = await loadTools();
  assert.equal(fillsOwnGaps(partialGrid(), "关键词", "客户反馈", "提取关键词", [3, 4]), 1);
});

test("everything else falls back to appending a column", async () => {
  const { fillsOwnGaps } = await loadTools();
  const grid = partialGrid();
  const gate = (name, source, how, targets) => fillsOwnGaps(grid, name, source, how, targets);

  // 1. The column does not exist yet: a first run always appends.
  assert.equal(gate("情感", "客户反馈", "提取关键词", [3, 4]), null);
  // 2a. A column of the user's own that happens to share the name.
  const userColumn = { ...grid, lineage: undefined };
  assert.equal(fillsOwnGaps(userColumn, "关键词", "客户反馈", "提取关键词", [3, 4]), null);
  // 2b. Renamed by the user: the lineage entry no longer matches the header.
  const renamed = { ...grid, headers: ["客户反馈", "关键字"] };
  assert.equal(fillsOwnGaps(renamed, "关键字", "客户反馈", "提取关键词", [3, 4]), null);
  // 2c. Same column name, different source column or different instruction —
  // a genuinely different question that deserves its own column.
  assert.equal(gate("关键词", "备注", "提取关键词", [3, 4]), null);
  assert.equal(gate("关键词", "客户反馈", "判断情感", [3, 4]), null);
  // 2d. Made by a different tool.
  const computed = {
    ...grid,
    lineage: { 关键词: { tool: "compute_column", from: ["客户反馈"], how: "[客户反馈]" } },
  };
  assert.equal(fillsOwnGaps(computed, "关键词", "客户反馈", "提取关键词", [3, 4]), null);
  // 3. Any overlap with an answer already paid for, or a hand edit. This is
  // the "redo it" case, where the model sends scope "all".
  assert.equal(gate("关键词", "客户反馈", "提取关键词", [0, 1, 2, 3, 4]), null);
  assert.equal(gate("关键词", "客户反馈", "提取关键词", [2, 3]), null);
  // No rows to write is not a fill either.
  assert.equal(gate("关键词", "客户反馈", "提取关键词", []), null);
});

test("two runs end with one full column, not 关键词 (2)", async () => {
  const { fillsOwnGaps, withLineage } = await loadTools();
  const { appendColumn, fillCells, findColumnIndex, uniquifyHeader } = await loadTableOps();
  const instruction = "提取关键词";

  // Run 1, the append path: 5 rows, the last two came back with no answer and
  // the user chose to keep the three that worked.
  const start = {
    headers: ["客户反馈"],
    rows: [["包装破损"], ["客服态度差"], ["很好用"], ["会回购"], ["推荐给朋友"]],
    selectedRows: null,
    filterKept: null,
    highlightedRows: null,
  };
  const name1 = uniquifyHeader(start.headers, "关键词");
  const appended = appendColumn(start.headers, start.rows, name1, [
    "包装破损", "客服态度", "好用", "", "",
  ]);
  const afterRun1 = withLineage(
    { ...start, headers: appended.headers, rows: appended.rows },
    name1,
    { tool: "transform_column", from: ["客户反馈"], how: instruction },
  );

  // Run 2: the user asks for rows 4-5 again. Same source column, same
  // instruction, both target cells blank — so it fills rather than appends.
  const targets = [3, 4];
  const colIdx = fillsOwnGaps(afterRun1, "关键词", "客户反馈", instruction, targets);
  assert.equal(colIdx, findColumnIndex(afterRun1.headers, "关键词"));

  const fills = new Map([[3, "回购"], [4, "推荐"]]);
  const afterRun2 = { ...afterRun1, rows: fillCells(afterRun1.rows, colIdx, fills) };

  assert.deepEqual(afterRun2.headers, ["客户反馈", "关键词"]);
  assert.deepEqual(
    afterRun2.rows.map((r) => r[colIdx]),
    ["包装破损", "客服态度", "好用", "回购", "推荐"],
  );
  // The negative case from the same sheet: a different question still appends.
  assert.equal(fillsOwnGaps(afterRun2, "关键词", "客户反馈", "判断情感", targets), null);
  assert.equal(uniquifyHeader(afterRun2.headers, "关键词"), "关键词 (2)");
});
