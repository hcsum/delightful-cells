// Tool schema, validation, dispatch, and the system prompt for the
// Delightful Cells agent. Everything here is pure — the React layer applies
// the returned GridState.

import {
  appendColumn,
  findColumnIndex,
  findReplace,
  matchRows,
  removeColumns,
  summarizeColumn,
  uniquifyHeader,
  type FilterOp,
} from "./table-ops";
import { compileFormula, formatComputed } from "./formula";

export type GridState = {
  headers: string[];
  rows: string[][];
  // Persistent visual marks (row → color). Output only — never a scope.
  highlightedRows: Map<number, HighlightColor> | null;
  filterKept: number[] | null;
  // The working set: rows the user clicked OR the model selected with
  // filter_rows / filter_rows_ai. This is what "scope":"selection" means.
  selectedRows: Set<number> | null;
};

export type HighlightColor = "yellow" | "green" | "pink" | "blue";
export const HIGHLIGHT_COLORS: HighlightColor[] = ["yellow", "green", "pink", "blue"];
export const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  yellow: "#fff3b0",
  green: "#d9f7d0",
  pink: "#ffd6e7",
  blue: "#d6ecff",
};

// A tool's scope is a set of rows: the working selection (user clicks or the
// model's last filter) or what survives the current filter. Highlights are
// deliberately NOT a scope — they are a display effect, not a selection.
export type ToolScope = "all" | "selection" | "visible";
export const TOOL_SCOPES: ToolScope[] = ["all", "selection", "visible"];

function parseHighlight(raw: unknown): HighlightColor | null {
  if (raw === true) return "yellow";
  return HIGHLIGHT_COLORS.includes(raw as HighlightColor) ? (raw as HighlightColor) : null;
}

// Every tool can be aimed at a set of rows: explicit 1-based "rows":[46]
// (wins), the selection, or the visible (filtered) rows. null = whole sheet.
export function resolveScope(
  grid: GridState,
  call: { scope: ToolScope; rows: number[] | null },
): Set<number> | null {
  if (call.rows?.length) {
    return new Set(call.rows.map((n) => n - 1).filter((i) => i >= 0 && i < grid.rows.length));
  }
  if (call.scope === "selection") return grid.selectedRows;
  if (call.scope === "visible") return grid.filterKept ? new Set(grid.filterKept) : null;
  return null;
}

export function scopeLabel(call: { scope: ToolScope; rows: number[] | null }): string {
  return call.rows?.length ? `given (${call.rows.length} rows)` : call.scope;
}

export type ToolCall =
  | {
      tool: "filter_rows";
      column: string;
      op: FilterOp;
      value: string;
      mode: "filter" | "select";
      scope: ToolScope;
      rows: number[] | null;
      // Convenience: also paint the matching rows (select + highlight in one
      // call — small models can't reliably chain the two).
      highlight: HighlightColor | null;
    }
  | {
      tool: "find_replace";
      column: string;
      find: string;
      replace: string;
      matchCase: boolean;
      scope: ToolScope;
      rows: number[] | null;
    }
  | { tool: "summarize_column"; column: string; scope: ToolScope; rows: number[] | null }
  | {
      tool: "filter_rows_ai";
      column: string;
      criteria: string;
      mode: "filter" | "select";
      scope: ToolScope;
      rows: number[] | null;
      highlight: HighlightColor | null;
    }
  | {
      tool: "transform_column";
      column: string;
      instruction: string;
      newColumnName: string;
      scope: ToolScope;
      rows: number[] | null;
    }
  | {
      tool: "compute_column";
      formula: string;
      newColumnName: string;
      scope: ToolScope;
      rows: number[] | null;
    }
  | {
      // Structural tool: drop whole columns. Rows/selection/filter are untouched.
      tool: "remove_column";
      columns: string[];
    }
  | {
      // Light UI tool: paint rows in the scope / given rows; clear:true removes marks.
      tool: "highlight_rows";
      scope: ToolScope;
      rows: number[] | null;
      color: HighlightColor;
      clear: boolean;
    };

export type ToolResult = {
  ok: boolean;
  summary: string; // short human-readable badge for the tool card
  data: unknown; // structured payload sent back to the model
};

const FILTER_OPS: FilterOp[] = [
  "contains",
  "equals",
  "not_equals",
  "gt",
  "lt",
  "empty",
  "not_empty",
];

// Narrow an arbitrary parsed JSON object into a ToolCall, or explain why not.
export const KNOWN_TOOLS: ToolCall["tool"][] = [
  "filter_rows",
  "filter_rows_ai",
  "find_replace",
  "summarize_column",
  "transform_column",
  "compute_column",
  "highlight_rows",
  "remove_column",
];

export function validateToolCall(
  raw: Record<string, unknown>,
  headers: string[],
  sets: Pick<GridState, "selectedRows" | "filterKept"> = {
    selectedRows: null,
    filterKept: null,
  },
): { call: ToolCall } | { error: string; unknownTool?: string } {
  const tool = String(raw.tool ?? "");
  if (!KNOWN_TOOLS.includes(tool as ToolCall["tool"])) {
    return {
      error: `Unknown tool "${tool}". Use ${KNOWN_TOOLS.join(", ")}.`,
      unknownTool: tool || "(none)",
    };
  }
  // Spreadsheet semantics: when rows are selected and the model doesn't say
  // otherwise, acting tools work on the selection (like Excel does). Filters
  // still default to the whole sheet because they *create* the selection.
  const ACTS_ON_SELECTION = new Set(["find_replace", "transform_column", "compute_column", "summarize_column", "highlight_rows"]);
  const scope: ToolScope = TOOL_SCOPES.includes(raw.scope as ToolScope)
    ? (raw.scope as ToolScope)
    : raw.scope == null && ACTS_ON_SELECTION.has(tool) && sets.selectedRows?.size
      ? "selection"
      : "all";
  // Explicit row numbers (1-based, as shown in the # column) — usable by every tool.
  const rowsRaw = Array.isArray(raw.rows) ? (raw.rows as unknown[]) : raw.row != null ? [raw.row] : null;
  const rows = rowsRaw
    ? rowsRaw.map(Number).filter((n) => Number.isInteger(n) && n >= 1)
    : null;
  if (rowsRaw && !rows?.length) {
    return { error: '"rows" must be a list of 1-based row numbers, e.g. "rows":[46].' };
  }
  const available =
    scope === "selection" ? !!sets.selectedRows?.size
    : scope === "visible" ? !!sets.filterKept
    : true;
  if (!available && !rows) {
    return { error: `scope "${scope}" requested but there are no ${scope} rows right now. Use scope "all", "rows":[…], or create that set first.` };
  }
  if (tool === "highlight_rows") {
    const color = HIGHLIGHT_COLORS.includes(raw.color as HighlightColor)
      ? (raw.color as HighlightColor)
      : "yellow";
    const clear = raw.clear === true;
    if (!clear && !rows && scope === "all") {
      return {
        error:
          'highlight_rows cannot paint the whole sheet. To highlight rows matching a condition, call filter_rows (or filter_rows_ai) with "mode":"select","highlight":"yellow" instead. For specific rows pass "rows":[3,7].',
      };
    }
    return { call: { tool: "highlight_rows", scope, rows, color, clear } };
  }
  if (tool === "remove_column") {
    // Accept both "column":"A" and "columns":["A","B"].
    const wanted = (Array.isArray(raw.columns) ? raw.columns : [raw.columns ?? raw.column])
      .map((c) => String(c ?? "").trim())
      .filter(Boolean);
    if (!wanted.length) return { error: '"columns" must list the column names to delete, e.g. "columns":["Notes"].' };
    const resolved: string[] = [];
    for (const name of wanted) {
      const idx = findColumnIndex(headers, name);
      if (idx === -1) {
        return { error: `Unknown column "${name}". Available columns: ${headers.join(" | ")}` };
      }
      if (!resolved.includes(headers[idx])) resolved.push(headers[idx]);
    }
    if (resolved.length >= headers.length) {
      return { error: "That would delete every column and leave an empty sheet. Keep at least one column." };
    }
    return { call: { tool: "remove_column", columns: resolved } };
  }
  if (tool === "compute_column") {
    const formula = String(raw.formula ?? "").trim();
    if (!formula) return { error: '"formula" must be a non-empty string.' };
    const compiled = compileFormula(formula, headers);
    if (!compiled.ok) return { error: compiled.error };
    const newColumnName = String(raw.newColumnName ?? "").trim() || "Computed";
    return { call: { tool: "compute_column", formula, newColumnName, scope, rows } };
  }
  const columnRaw = String(raw.column ?? "");
  const colIdx = findColumnIndex(headers, columnRaw);
  if (colIdx === -1) {
    return {
      error: `Unknown column "${columnRaw}". Available columns: ${headers.join(" | ")}`,
    };
  }
  const column = headers[colIdx];

  if (tool === "filter_rows") {
    const op = String(raw.op ?? "") as FilterOp;
    if (!FILTER_OPS.includes(op)) {
      return { error: `Invalid op "${raw.op}". Use one of: ${FILTER_OPS.join(", ")}` };
    }
    const mode = raw.mode === "filter" ? "filter" : "select";
    return {
      call: {
        tool: "filter_rows",
        column,
        op,
        value: String(raw.value ?? ""),
        mode,
        scope,
        rows,
        highlight: parseHighlight(raw.highlight),
      },
    };
  }
  if (tool === "find_replace") {
    const find = String(raw.find ?? "");
    if (find === "" && !rows && raw.scope == null && scope === "all") {
      return {
        error:
          'Empty "find" overwrites whole cells. Say which rows: "rows":[46] for specific rows, "scope":"selection"/"visible", or "scope":"all" explicitly if the user really wants the entire column overwritten.',
      };
    }
    return {
      call: {
        tool: "find_replace",
        column,
        find,
        replace: String(raw.replace ?? ""),
        matchCase: raw.matchCase === true,
        scope,
        rows,
      },
    };
  }
  if (tool === "summarize_column") {
    return { call: { tool: "summarize_column", column, scope, rows } };
  }
  if (tool === "filter_rows_ai") {
    const criteria = String(raw.criteria ?? "").trim();
    if (!criteria) return { error: '"criteria" must be a non-empty string.' };
    const mode = raw.mode === "filter" ? "filter" : "select";
    return {
      call: { tool: "filter_rows_ai", column, criteria, mode, scope, rows, highlight: parseHighlight(raw.highlight) },
    };
  }
  if (tool === "transform_column") {
    const instruction = String(raw.instruction ?? "").trim();
    if (!instruction) return { error: '"instruction" must be a non-empty string.' };
    const newColumnName =
      String(raw.newColumnName ?? "").trim() || `${column} (AI)`;
    return {
      call: { tool: "transform_column", column, instruction, newColumnName, scope, rows },
    };
  }
  return {
    error: `Unknown tool "${tool}". Use filter_rows, filter_rows_ai, find_replace, summarize_column, or transform_column.`,
  };
}

// Handles the synchronous local tools. transform_column and filter_rows_ai
// are async (batched LLM calls) and are executed by the UI layer instead.
export function dispatchTool(
  call: ToolCall,
  grid: GridState,
): { result: ToolResult; nextGrid: GridState } {
  if (call.tool === "transform_column" || call.tool === "filter_rows_ai") {
    throw new Error(`${call.tool} must be handled by the async tool runner`);
  }
  if (call.tool === "remove_column") {
    const drop = new Set(call.columns.map((c) => findColumnIndex(grid.headers, c)));
    const next = removeColumns(grid.headers, grid.rows, drop);
    const list = call.columns.map((c) => `"${c}"`).join(", ");
    return {
      result: {
        ok: true,
        summary: `${call.columns.length} column${call.columns.length === 1 ? "" : "s"} deleted`,
        data: {
          removed: call.columns,
          remainingColumns: next.headers,
          outcome: `Column${call.columns.length === 1 ? "" : "s"} ${list} deleted from the user's table. Remaining columns: ${next.headers.join(" | ")}.`,
        },
      },
      nextGrid: { ...grid, headers: next.headers, rows: next.rows },
    };
  }

  const only = resolveScope(grid, call);
  const scopeNote = only ? ` within the ${only.size} ${scopeLabel(call)} rows` : "";

  if (call.tool === "highlight_rows") {
    if (call.clear) {
      const targets = only ? [...only] : null;
      let next: Map<number, HighlightColor> | null = null;
      if (targets && grid.highlightedRows) {
        next = new Map(grid.highlightedRows);
        for (const i of targets) next.delete(i);
        if (!next.size) next = null;
      }
      const removed = (grid.highlightedRows?.size ?? 0) - (next?.size ?? 0);
      return {
        result: { ok: true, summary: `${removed} highlight${removed === 1 ? "" : "s"} cleared`, data: { cleared: removed } },
        nextGrid: { ...grid, highlightedRows: next },
      };
    }
    const targets = only ? [...only] : grid.rows.map((_, i) => i);
    const painted = paintRows(grid, targets, call.color);
    return {
      result: {
        ok: true,
        summary: `${targets.length} row${targets.length === 1 ? "" : "s"} highlighted ${call.color}`,
        data: {
          rowsHighlighted: targets.length,
          color: call.color,
          outcome: `${targets.length} rows are now highlighted ${call.color} in the user's table (display only; the selection is unchanged).`,
        },
      },
      nextGrid: painted,
    };
  }

  if (call.tool === "compute_column") {
    const compiled = compileFormula(call.formula, grid.headers);
    if (!compiled.ok) {
      return { result: { ok: false, summary: "bad formula", data: { error: compiled.error } }, nextGrid: grid };
    }
    let computed = 0;
    const outputs = grid.rows.map((row, i) => {
      if (only && !only.has(i)) return "";
      const n = compiled.compiled.evaluate(row);
      if (n == null) return "";
      computed++;
      return formatComputed(n);
    });
    if (computed === 0) {
      const total0 = only ? only.size : grid.rows.length;
      return {
        result: {
          ok: false,
          summary: `no numeric values — column not added`,
          data: {
            error: `The formula "${call.formula}" produced nothing: none of the ${total0} target rows had numeric values in every referenced column. Check that each column you referenced actually holds numbers (identifiers like an order ID are text, not quantities). No column was added.`,
          },
        },
        nextGrid: grid,
      };
    }
    const name = uniquifyHeader(grid.headers, call.newColumnName);
    const next = appendColumn(grid.headers, grid.rows, name, outputs);
    const total = only ? only.size : grid.rows.length;
    return {
      result: {
        ok: true,
        summary: `${computed}/${total} rows → "${name}"`,
        data: {
          newColumn: name,
          formula: call.formula,
          rowsComputed: computed,
          rowsSkipped: total - computed,
          outcome: `Column "${name}" added: ${call.formula} computed for ${computed} of ${total} rows${scopeNote} (rows with non-numeric inputs left blank).`,
          sampleOutputs: outputs.filter((o) => o !== "").slice(0, 3),
        },
      },
      nextGrid: { ...grid, headers: next.headers, rows: next.rows },
    };
  }

  const colIdx = findColumnIndex(grid.headers, call.column);

  if (call.tool === "filter_rows") {
    const matched = matchRows(grid.rows, colIdx, call.op, call.value).filter(
      (i) => !only || only.has(i),
    );
    let nextGrid: GridState =
      call.mode === "select"
        ? { ...grid, selectedRows: matched.length ? new Set(matched) : null }
        : { ...grid, filterKept: matched };
    if (call.highlight && matched.length) nextGrid = paintRows(nextGrid, matched, call.highlight);
    const verb = call.mode === "select" ? "selected" : "kept";
    return {
      result: {
        ok: true,
        summary: `${matched.length} of ${grid.rows.length} rows ${verb}`,
        data: {
          rowsMatched: matched.length,
          rowsTotal: grid.rows.length,
          outcome: `${matched.length} of ${only ? only.size : grid.rows.length} rows${scopeNote} matched (${call.column} ${call.op} ${call.value}) and are now ${verb}${call.highlight ? ` and highlighted ${call.highlight}` : ""} in the user's table. ${scopeHint(call.mode)}`,
        },
      },
      nextGrid,
    };
  }

  if (call.tool === "find_replace") {
    const { rows, replacements, rowsAffected } = findReplace(
      grid.rows,
      colIdx,
      call.find,
      call.replace,
      call.matchCase,
      only,
    );
    return {
      result: {
        ok: true,
        summary: `${replacements} replacement${replacements === 1 ? "" : "s"} in ${rowsAffected} row${rowsAffected === 1 ? "" : "s"}`,
        data: { replacements, rowsAffected, column: call.column, scope: call.scope },
      },
      nextGrid: { ...grid, rows },
    };
  }

  const scopedRows = only ? grid.rows.filter((_, i) => only.has(i)) : grid.rows;
  const stats = summarizeColumn(scopedRows, colIdx, call.column);
  return {
    result: {
      ok: true,
      summary: `${stats.nonEmpty} values, ${stats.distinct} distinct${scopeNote}`,
      data: { ...stats, scope: call.scope },
    },
    nextGrid: grid,
  };
}

export function buildSystemPrompt(grid: GridState, sheetName: string): string {
  const sampleRows = grid.rows.slice(0, 5);
  const sampleTsv = [
    grid.headers.join("\t"),
    ...sampleRows.map((r) => r.map((c) => (c.length > 60 ? c.slice(0, 60) + "…" : c)).join("\t")),
  ].join("\n");

  return [
    "You are Cells, a friendly spreadsheet assistant. You can ONLY interact with",
    "the spreadsheet by calling tools. The user's browser executes tools locally",
    "and sends you the result as a message starting with TOOL_RESULT.",
    "",
    `Spreadsheet: "${sheetName}" — ${grid.rows.length} rows × ${grid.headers.length} columns.`,
    `Columns: ${grid.headers.join(" | ")}`,
    describeScopes(grid),
    `Sample rows (tab-separated, ONLY the first 5 of ${grid.rows.length} — a tiny preview, NOT the whole data):`,
    sampleTsv,
    "",
    "Reply with EXACTLY ONE JSON object and nothing else. No prose outside JSON.",
    'Either a tool call (every tool accepts optional "scope":"all"|"selection"|"visible", default all, and/or "rows":[46,47] — 1-based row numbers from the # column — to aim at specific rows):',
    '  {"type":"tool_call","tool":"filter_rows","column":"<exact column name>","op":"contains|equals|not_equals|gt|lt|empty|not_empty","value":"...","mode":"select|filter","highlight":"yellow|green|pink|blue (optional: also paint the matches)"}',
    '  {"type":"tool_call","tool":"find_replace","column":"<exact column name>","find":"...","replace":"...","matchCase":false}',
    '  {"type":"tool_call","tool":"filter_rows_ai","column":"<exact column name>","criteria":"a semantic yes/no test for each cell, e.g. sounds angry","mode":"select|filter","highlight":"yellow (optional)"}',
    '  {"type":"tool_call","tool":"summarize_column","column":"<exact column name>"}',
    '  {"type":"tool_call","tool":"transform_column","column":"<exact column name>","instruction":"what to produce from each cell, e.g. extract the main keyword","newColumnName":"..."}',
    '  {"type":"tool_call","tool":"compute_column","formula":"[Column A] / [Column B]","newColumnName":"..."}',
    '  {"type":"tool_call","tool":"remove_column","columns":["<exact column name>", "..."]}   (deletes those columns from the sheet)',
    '  {"type":"tool_call","tool":"highlight_rows","scope":"selection","color":"yellow|green|pink|blue"}   (or "rows":[3,7] for specific row numbers; "clear":true to remove highlights)',
    "Or a final answer to the user:",
    '  {"type":"final","message":"..."}',
    "",
    "Rules:",
    "- column must be one of the exact column names listed above.",
    "- filter_rows / filter_rows_ai with mode \"select\" makes the matching rows the",
    "  current selection (blue row numbers); \"filter\" hides the rest instead.",
    "- To \"highlight rows where …\": call filter_rows / filter_rows_ai with",
    '  "mode":"select" AND "highlight":"yellow" — one call selects and paints.',
    "- highlight_rows is a pure display tool for rows you already have: the",
    '  current selection ("scope":"selection") or explicit "rows":[3,7]. It can',
    "  NOT take a condition and can NOT paint the whole sheet.",
    '- A request about specific rows ("row 46", "rows 3 and 7", "the last row" only if',
    '  the number is known) → pass "rows":[46]. To set one cell: find_replace with',
    '  "find":"","replace":"<new value>","rows":[46].',
    "- When rows are selected, acting tools (find_replace, transform_column,",
    "  compute_column, summarize_column, highlight_rows) default to the selection.",
    '  Pass "scope":"all" explicitly if the user really means the whole sheet.',
    "- gt/lt compare numerically.",
    "- find_replace matches literal text (no regex, no \"a|b\"). An EMPTY find",
    "  (\"find\":\"\") overwrites the whole cell — use that to SET a column's value,",
    "  usually together with a scope (e.g. set Status to closed for the selected rows).",
    "- filter_rows is for mechanical tests (text/number match). filter_rows_ai",
    "  is for tests that need understanding the meaning of each cell (tone,",
    "  sentiment, topic, \"sounds angry\", \"mentions shipping\"). Never fake a",
    "  semantic test with contains.",
    "- summarize_column gives ONE overview of the whole column in chat. Its",
    "  TOOL_RESULT includes topValues (most frequent values with counts) — use",
    "  it to answer \"which value appears most\" questions directly.",
    "- A \"rate\", \"share\", \"percentage\" or \"% of\" over a table is HOW MANY ROWS",
    "  meet a condition divided by how many rows there are — a count over a",
    "  count, never a sum over a count. Get the numerator with filter_rows and",
    "  read rowsMatched; the result must land between 0% and 100%. If the phrase",
    "  could mean something else (an average amount per row, say), compute the",
    "  row rate and say in one clause which reading you used.",
    "- Every number in your final answer must come from a TOOL_RESULT, and must",
    "  mean what that TOOL_RESULT says it means — read its \"outcome\" sentence,",
    "  never guess from a field name. Never assume a value you were not given",
    "  (an average price, a denominator, a row count). If the number you need is",
    "  missing, call another tool to get it.",
    "- transform_column runs the instruction on EVERY row and writes the results",
    "  into a new column (use it for per-row summarize/extract/classify asks).",
    "  It sees ONLY that one column's cell — it cannot use other columns.",
    "- compute_column is for ARITHMETIC across columns (price = revenue / units,",
    "  totals, percentages). formula supports numbers, + - * / % ( ) and [exact",
    "  column name] references, computed exactly. ALWAYS prefer it over",
    "  transform_column for math.",
    "- compute_column is PER-ROW only: each output cell uses that row's values.",
    "  It can NOT sum, average or count across rows, so a whole-sheet ratio",
    '  ("refund rate", "share of total") is NOT a compute_column. Get the parts',
    "  with summarize_column (its TOOL_RESULT has sum/count) and do the division",
    "  yourself in the final message. Never divide by an ID or any other",
    "  non-numeric column just to produce a number.",
    "- After a TOOL_RESULT, either call another tool or reply {\"type\":\"final\",...}",
    "  telling the user what happened in one or two friendly sentences.",
    "- Your final answer MUST be based on the TOOL_RESULT numbers, never on the",
    "  sample rows above — the sample is only the first 5 rows of the sheet.",
    "- If the user asks something unrelated to the spreadsheet, answer with",
    '  {"type":"final","message":"..."} directly.',
    "- CHAINING: when a request combines a condition with an action on the",
    "  matching rows (\"summarize the negative feedback\", \"translate the angry",
    "  ones\", \"set pending orders to closed\"), do it in two steps: first",
    "  filter_rows / filter_rows_ai with mode \"select\", then, after its",
    "  TOOL_RESULT, run the action with \"scope\":\"selection\". Never guess the",
    "  answer for the subset from the 5 sample rows.",
    "- If the request needs something none of the tools above can do (e.g. sort,",
    "  add/delete rows, charts, formulas, reading a specific row), do NOT improvise",
    '  a tool call. Reply {"type":"final","message":"I can\'t do that yet — ..."} and',
    "  name the closest thing you can do.",
  ].join("\n");
}

function describeSelection(sel: Set<number>): string {
  const nums = [...sel].sort((a, b) => a - b).map((i) => i + 1);
  return nums.length <= 12
    ? nums.join(", ")
    : `${nums.slice(0, 10).join(", ")} … and ${nums.length - 10} more`;
}


function describeScopes(grid: GridState): string {
  const parts: string[] = [`all (${grid.rows.length} rows)`];
  if (grid.selectedRows?.size) {
    parts.push(
      `selection (${grid.selectedRows.size} rows currently selected: #${describeSelection(grid.selectedRows)}) — use for "these"/"those"/"the selected/matching ones"`,
    );
  }
  if (grid.filterKept) {
    parts.push(`visible (${grid.filterKept.length} rows left after the current filter)`);
  }
  const marks = grid.highlightedRows?.size
    ? `Highlights: ${grid.highlightedRows.size} rows are highlighted (display only, not a scope).`
    : "Highlights: none.";
  return [
    "CURRENT TABLE STATE (authoritative — this reflects the table right now and",
    "supersedes anything claimed earlier in this chat, including your own TOOL_RESULTs):",
    `Row sets you can target with "scope": ${parts.join("; ")}.${parts.length === 1 ? " No selection or filter exists right now." : ""}`,
    marks,
  ].join("\n");
}

/**
 * Which rows came back unanswered, numbered the way the user sees them in the #
 * column, so the model can name them instead of only quoting a count. Past the
 * cap the list is longer than the answer it belongs in, and the model says how
 * many rather than which.
 */
export const MAX_FAILED_ROWS_LISTED = 200;

export function failedRowNumbers(
  targets: number[],
  failedIndices: number[],
): number[] | null {
  if (failedIndices.length === 0) return null;
  if (failedIndices.length > MAX_FAILED_ROWS_LISTED) return null;
  return failedIndices.map((i) => targets[i] + 1).filter((n) => n > 0);
}

/**
 * What to tell the model about the rows that failed. The only correct retry is
 * the one inside the run's own dialog, which merges the new answers into the
 * ones already paid for before anything reaches the sheet. By the time this
 * result exists the user has dismissed that dialog and the run is final.
 *
 * Calling the tool again cannot stand in for it: transform_column would append
 * a second column holding only the retried rows, filter_rows_ai would replace
 * the selection with only the rows matched this time, and both would re-bill
 * every row in whatever scope they were given. Offering a rerun here is what
 * put the user in a loop — the rerun fails the same way and asks again.
 */
export function retryHint(failedRows: number[] | null): string {
  const which = failedRows
    ? `The rows left unanswered are ${failedRows.join(", ")}.`
    : "There are too many to list individually.";
  return `${which} This run is finished: do NOT call this tool again to fix them. Re-running would charge for every row in the scope and would not merge with what is already applied. Report which rows are unanswered and let the user decide; if they want another attempt, say that it starts a fresh run over the rows they name.`;
}

export function scopeHint(mode: "filter" | "select"): string {
  return mode === "select"
    ? 'These rows are now the selection: another tool can target them with "scope":"selection".'
    : 'These rows can now be targeted by another tool with "scope":"visible".';
}

export function paintRows(grid: GridState, rows: number[], color: HighlightColor): GridState {
  const next = new Map(grid.highlightedRows ?? []);
  for (const i of rows) next.set(i, color);
  return { ...grid, highlightedRows: next };
}
