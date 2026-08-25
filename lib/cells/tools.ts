// Tool schema, validation, dispatch, and the system prompt for the
// Delightful Cells agent. Everything here is pure — the React layer applies
// the returned GridState.

import {
  findColumnIndex,
  findReplace,
  matchRows,
  summarizeColumn,
  type FilterOp,
} from "./table-ops";

export type GridState = {
  headers: string[];
  rows: string[][];
  highlightedRows: Set<number> | null;
  filterKept: number[] | null;
  // Rows the user picked by clicking row numbers. Tools with scope "selection"
  // operate on these only.
  selectedRows: Set<number> | null;
};

export type ToolScope = "all" | "selection";

export type ToolCall =
  | {
      tool: "filter_rows";
      column: string;
      op: FilterOp;
      value: string;
      mode: "filter" | "highlight";
      scope: ToolScope;
    }
  | {
      tool: "find_replace";
      column: string;
      find: string;
      replace: string;
      matchCase: boolean;
      scope: ToolScope;
    }
  | { tool: "summarize_column"; column: string; scope: ToolScope }
  | {
      tool: "filter_rows_ai";
      column: string;
      criteria: string;
      mode: "filter" | "highlight";
      scope: ToolScope;
    }
  | {
      tool: "transform_column";
      column: string;
      instruction: string;
      newColumnName: string;
      scope: ToolScope;
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
];

export function validateToolCall(
  raw: Record<string, unknown>,
  headers: string[],
  hasSelection = false,
): { call: ToolCall } | { error: string; unknownTool?: string } {
  const tool = String(raw.tool ?? "");
  if (!KNOWN_TOOLS.includes(tool as ToolCall["tool"])) {
    return {
      error: `Unknown tool "${tool}". Use ${KNOWN_TOOLS.join(", ")}.`,
      unknownTool: tool || "(none)",
    };
  }
  const scope: ToolScope = raw.scope === "selection" ? "selection" : "all";
  if (scope === "selection" && !hasSelection) {
    return { error: 'scope "selection" requested but the user has no rows selected. Use scope "all".' };
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
    const mode = raw.mode === "filter" ? "filter" : "highlight";
    return {
      call: { tool: "filter_rows", column, op, value: String(raw.value ?? ""), mode, scope },
    };
  }
  if (tool === "find_replace") {
    const find = String(raw.find ?? "");
    if (find === "") return { error: '"find" must be a non-empty string.' };
    return {
      call: {
        tool: "find_replace",
        column,
        find,
        replace: String(raw.replace ?? ""),
        matchCase: raw.matchCase === true,
        scope,
      },
    };
  }
  if (tool === "summarize_column") {
    return { call: { tool: "summarize_column", column, scope } };
  }
  if (tool === "filter_rows_ai") {
    const criteria = String(raw.criteria ?? "").trim();
    if (!criteria) return { error: '"criteria" must be a non-empty string.' };
    const mode = raw.mode === "filter" ? "filter" : "highlight";
    return { call: { tool: "filter_rows_ai", column, criteria, mode, scope } };
  }
  if (tool === "transform_column") {
    const instruction = String(raw.instruction ?? "").trim();
    if (!instruction) return { error: '"instruction" must be a non-empty string.' };
    const newColumnName =
      String(raw.newColumnName ?? "").trim() || `${column} (AI)`;
    return {
      call: { tool: "transform_column", column, instruction, newColumnName, scope },
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
  const colIdx = findColumnIndex(grid.headers, call.column);
  const only = call.scope === "selection" ? grid.selectedRows : null;
  const scopeNote = only ? ` within the ${only.size} selected rows` : "";

  if (call.tool === "filter_rows") {
    const matched = matchRows(grid.rows, colIdx, call.op, call.value).filter(
      (i) => !only || only.has(i),
    );
    const nextGrid: GridState =
      call.mode === "highlight"
        ? { ...grid, highlightedRows: matched.length ? new Set(matched) : null }
        : { ...grid, filterKept: matched };
    const verb = call.mode === "highlight" ? "highlighted" : "kept";
    return {
      result: {
        ok: true,
        summary: `${matched.length} of ${grid.rows.length} rows ${verb}`,
        data: {
          rowsMatched: matched.length,
          rowsTotal: grid.rows.length,
          outcome: `${matched.length} of ${only ? only.size : grid.rows.length} rows${scopeNote} matched (${call.column} ${call.op} ${call.value}) and are now ${verb} in the user's table.`,
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
    grid.selectedRows?.size
      ? `Selected rows: the user has selected ${grid.selectedRows.size} row(s) (row numbers ${describeSelection(grid.selectedRows)}). When they say "these", "selected", or "the rows I picked", add "scope":"selection" to the tool call so it only touches those rows.`
      : "Selected rows: none. Do not use scope \"selection\".",
    `Sample rows (tab-separated, ONLY the first 5 of ${grid.rows.length} — a tiny preview, NOT the whole data):`,
    sampleTsv,
    "",
    "Reply with EXACTLY ONE JSON object and nothing else. No prose outside JSON.",
    'Either a tool call (every tool also accepts optional "scope":"all"|"selection", default all):',
    '  {"type":"tool_call","tool":"filter_rows","column":"<exact column name>","op":"contains|equals|not_equals|gt|lt|empty|not_empty","value":"...","mode":"filter|highlight"}',
    '  {"type":"tool_call","tool":"find_replace","column":"<exact column name>","find":"...","replace":"...","matchCase":false}',
    '  {"type":"tool_call","tool":"filter_rows_ai","column":"<exact column name>","criteria":"a semantic yes/no test for each cell, e.g. sounds angry","mode":"filter|highlight"}',
    '  {"type":"tool_call","tool":"summarize_column","column":"<exact column name>"}',
    '  {"type":"tool_call","tool":"transform_column","column":"<exact column name>","instruction":"what to produce from each cell, e.g. extract the main keyword","newColumnName":"..."}',
    "Or a final answer to the user:",
    '  {"type":"final","message":"..."}',
    "",
    "Rules:",
    "- column must be one of the exact column names listed above.",
    "- Use mode \"highlight\" to mark matching rows, \"filter\" to hide the rest.",
    "- gt/lt compare numerically.",
    "- find_replace matches literal text (no regex, no \"a|b\"). To set every",
    "  value of a column, call find_replace once per distinct current value.",
    "- filter_rows is for mechanical tests (text/number match). filter_rows_ai",
    "  is for tests that need understanding the meaning of each cell (tone,",
    "  sentiment, topic, \"sounds angry\", \"mentions shipping\"). Never fake a",
    "  semantic test with contains.",
    "- summarize_column gives ONE overview of the whole column in chat.",
    "- transform_column runs the instruction on EVERY row and writes the results",
    "  into a new column (use it for per-row summarize/extract/classify asks).",
    "- After a TOOL_RESULT, either call another tool or reply {\"type\":\"final\",...}",
    "  telling the user what happened in one or two friendly sentences.",
    "- Your final answer MUST be based on the TOOL_RESULT numbers, never on the",
    "  sample rows above — the sample is only the first 5 rows of the sheet.",
    "- If the user asks something unrelated to the spreadsheet, answer with",
    '  {"type":"final","message":"..."} directly.',
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

