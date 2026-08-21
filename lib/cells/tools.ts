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
};

export type ToolCall =
  | {
      tool: "filter_rows";
      column: string;
      op: FilterOp;
      value: string;
      mode: "filter" | "highlight";
    }
  | {
      tool: "find_replace";
      column: string;
      find: string;
      replace: string;
      matchCase: boolean;
    }
  | { tool: "summarize_column"; column: string }
  | {
      tool: "transform_column";
      column: string;
      instruction: string;
      newColumnName: string;
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
export function validateToolCall(
  raw: Record<string, unknown>,
  headers: string[],
): { call: ToolCall } | { error: string } {
  const tool = String(raw.tool ?? "");
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
      call: { tool: "filter_rows", column, op, value: String(raw.value ?? ""), mode },
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
      },
    };
  }
  if (tool === "summarize_column") {
    return { call: { tool: "summarize_column", column } };
  }
  if (tool === "transform_column") {
    const instruction = String(raw.instruction ?? "").trim();
    if (!instruction) return { error: '"instruction" must be a non-empty string.' };
    const newColumnName =
      String(raw.newColumnName ?? "").trim() || `${column} (AI)`;
    return {
      call: { tool: "transform_column", column, instruction, newColumnName },
    };
  }
  return {
    error: `Unknown tool "${tool}". Use filter_rows, find_replace, summarize_column, or transform_column.`,
  };
}

// Handles the three synchronous local tools. transform_column is async
// (batched LLM calls) and is executed by the UI layer before reaching here.
export function dispatchTool(
  call: ToolCall,
  grid: GridState,
): { result: ToolResult; nextGrid: GridState } {
  if (call.tool === "transform_column") {
    throw new Error("transform_column must be handled by the async tool runner");
  }
  const colIdx = findColumnIndex(grid.headers, call.column);

  if (call.tool === "filter_rows") {
    const matched = matchRows(grid.rows, colIdx, call.op, call.value);
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
          outcome: `${matched.length} of ${grid.rows.length} rows matched (${call.column} ${call.op} ${call.value}) and are now ${verb} in the user's table.`,
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
    );
    return {
      result: {
        ok: true,
        summary: `${replacements} replacement${replacements === 1 ? "" : "s"} in ${rowsAffected} row${rowsAffected === 1 ? "" : "s"}`,
        data: { replacements, rowsAffected, column: call.column },
      },
      nextGrid: { ...grid, rows },
    };
  }

  const stats = summarizeColumn(grid.rows, colIdx, call.column);
  return {
    result: {
      ok: true,
      summary: `${stats.nonEmpty} values, ${stats.distinct} distinct`,
      data: stats,
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
    `Sample rows (tab-separated, ONLY the first 5 of ${grid.rows.length} — a tiny preview, NOT the whole data):`,
    sampleTsv,
    "",
    "Reply with EXACTLY ONE JSON object and nothing else. No prose outside JSON.",
    "Either a tool call:",
    '  {"type":"tool_call","tool":"filter_rows","column":"<exact column name>","op":"contains|equals|not_equals|gt|lt|empty|not_empty","value":"...","mode":"filter|highlight"}',
    '  {"type":"tool_call","tool":"find_replace","column":"<exact column name>","find":"...","replace":"...","matchCase":false}',
    '  {"type":"tool_call","tool":"summarize_column","column":"<exact column name>"}',
    '  {"type":"tool_call","tool":"transform_column","column":"<exact column name>","instruction":"what to produce from each cell, e.g. extract the main keyword","newColumnName":"..."}',
    "Or a final answer to the user:",
    '  {"type":"final","message":"..."}',
    "",
    "Rules:",
    "- column must be one of the exact column names listed above.",
    "- Use mode \"highlight\" to mark matching rows, \"filter\" to hide the rest.",
    "- gt/lt compare numerically.",
    "- summarize_column gives ONE overview of the whole column in chat.",
    "- transform_column runs the instruction on EVERY row and writes the results",
    "  into a new column (use it for per-row summarize/extract/classify asks).",
    "- After a TOOL_RESULT, either call another tool or reply {\"type\":\"final\",...}",
    "  telling the user what happened in one or two friendly sentences.",
    "- Your final answer MUST be based on the TOOL_RESULT numbers, never on the",
    "  sample rows above — the sample is only the first 5 rows of the sheet.",
    "- If the user asks something unrelated to the spreadsheet, answer with",
    '  {"type":"final","message":"..."} directly.',
  ].join("\n");
}
