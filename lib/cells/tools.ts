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
  // Where each column made this session came from. Absent for the user's own
  // columns. The 核对 bug lives here: a model that re-extracts 金额 from 金额
  // and subtracts the two gets a column of zeros and reads it as proof. The
  // sheet cannot tell it otherwise unless something remembers that 金额_核对
  // is a copy of 金额 — this is that memory. Optional so grids built before
  // it existed (probes, minted cases) still type-check.
  lineage?: Record<string, ColumnLineage>;
};

export type ColumnLineage = {
  tool: "transform_column" | "compute_column";
  from: string[]; // the columns it was read or computed from
  how: string; // the instruction or the formula
};

// Every column the given one descends from, nearest first: for 差异 =
// [金额] - [金额_核对] where 金额_核对 came from 金额 and 金额 from 原始记录,
// that is 金额, 金额_核对, 原始记录.
export function ancestorsOf(grid: GridState, column: string): string[] {
  const out: string[] = [];
  const queue = [...(grid.lineage?.[column]?.from ?? [])];
  while (queue.length) {
    const c = queue.shift()!;
    if (c === column || out.includes(c)) continue;
    out.push(c);
    queue.push(...(grid.lineage?.[c]?.from ?? []));
  }
  return out;
}

export function withLineage(grid: GridState, column: string, entry: ColumnLineage): GridState {
  return { ...grid, lineage: { ...(grid.lineage ?? {}), [column]: entry } };
}

function dropLineage(grid: GridState, columns: string[]): GridState["lineage"] {
  if (!grid.lineage) return grid.lineage;
  const next = { ...grid.lineage };
  for (const c of columns) delete next[c];
  return Object.keys(next).length ? next : undefined;
}

// The prompt's account of the derived columns, so the model deciding what to
// read next knows 金额 was made from 原始记录 three turns ago. Without this the
// only record is a TOOL_RESULT far back in the history, and the recorded bug
// is the model re-extracting 金额 from 金额 to "check it against the source".
export function describeLineage(grid: GridState): string | null {
  const entries = Object.entries(grid.lineage ?? {}).filter(([c]) => grid.headers.includes(c));
  if (!entries.length) return null;
  const lines = entries.map(([c, l]) => {
    const how = l.tool === "transform_column" ? `transform_column over "${l.from[0]}"` : `compute_column ${l.how}`;
    const copy = l.tool === "transform_column" && grid.lineage?.[l.from[0]] ? ` — a copy of a copy; "${l.from[0]}" is itself derived` : "";
    return `  "${c}" = ${how}${copy}`;
  });
  return [
    "Derived columns (made this session by tools, NOT the user's original data):",
    ...lines,
    "To check a derived column against its source, derive a FRESH column from the",
    "SOURCE and compare those two. Re-deriving from the derived column itself, or",
    "subtracting a column from its own copy, compares a copy with itself: a",
    "difference of 0 there proves nothing about the data.",
  ].join("\n");
}

// The root a derived column ultimately traces back to — the user's own data.
function rootOf(grid: GridState, column: string): string {
  const anc = ancestorsOf(grid, column);
  return anc.find((c) => !grid.lineage?.[c]) ?? anc[anc.length - 1] ?? column;
}

// The sentences a TOOL_RESULT carries about a derived column, so the model
// reading the result knows what it is looking at. Two facts matter and both
// are stated only when true: what the column was made from, and whether that
// source was itself derived — because then the column is a copy of a copy and
// agreement between the two proves nothing about the original.
export function lineageNote(grid: GridState, column: string): string | null {
  const l = grid.lineage?.[column];
  if (!l) return null;
  const q = (c: string) => `"${c}"`;
  if (l.tool === "transform_column") {
    const src = l.from[0];
    let note = `${q(column)} is derived data, not the user's own: transform_column read ${q(src)} and nothing else, one cell per row.`;
    if (grid.lineage?.[src]) {
      const root = rootOf(grid, src);
      note += ` And ${q(src)} is itself derived from ${q(root)}, so ${q(column)} is a copy of a copy. Comparing ${q(column)} with ${q(src)} can only show whether the two copies agree; it says nothing about whether ${q(src)} matches ${q(root)}. To check ${q(src)}, derive a fresh column from ${q(root)} and compare against that.`;
    }
    return note;
  }
  // compute_column: name the inputs, and warn when one input is a copy of another.
  let note = `${q(column)} is derived data: ${l.how}, computed from ${l.from.map(q).join(" and ")}.`;
  const circular = circularPair(grid, l.from);
  if (circular) {
    const [orig, copy] = circular;
    const root = rootOf(grid, orig);
    note += ` WARNING: ${q(copy)} was derived from ${q(orig)}, so this formula relates a column to its own copy. Zeros or agreement here show only that the copy matches what it was copied from; they are NOT evidence that ${q(orig)} is correct${root !== orig ? ` or that it matches ${q(root)}` : ""}. To check ${q(orig)}${root !== orig ? ` against ${q(root)}, derive a fresh column from ${q(root)} and compare with that` : ", compare it with a column derived from the original data it should match"} instead.`;
  }
  return note;
}

// Among a formula's inputs, an (original, copy) pair where copy descends from
// original. That is the one relation that makes a difference of zero worthless.
export function circularPair(grid: GridState, columns: string[]): [string, string] | null {
  for (const a of columns) {
    for (const b of columns) {
      if (a !== b && ancestorsOf(grid, b).includes(a)) return [a, b];
    }
  }
  return null;
}

// The result payload transform_column hands back about provenance. Built here
// rather than in the React layer so the eval's recorded payloads and the app's
// live ones come out of the same text.
export function transformProvenance(
  gridAfter: GridState,
  newColumn: string,
): { sourceColumn: string; outcome: string } {
  const l = gridAfter.lineage?.[newColumn];
  return {
    sourceColumn: l?.from[0] ?? "",
    outcome: lineageNote(gridAfter, newColumn) ?? "",
  };
}

/**
 * The column index a transform_column run should fill in place, or null to
 * take the ordinary append path.
 *
 * A retry is not a second concept: it is an ordinary run whose rows happen to
 * be the ones that failed and whose target column happens to already exist.
 * What was missing was a writer, so `runTransform` always appended and
 * `uniquifyHeader` renamed the target to "关键词 (2)" — the answers all existed
 * and were split across two columns, which is the user's problem to merge.
 *
 * Three conditions, each guarding something different, and a failure of any
 * one degrades to exactly today's append:
 *
 * 1. A column by that name already exists. A first run never matches.
 * 2. Its lineage records transform_column from the SAME source column with the
 *    SAME instruction. Without this a sheet that arrives with its own column
 *    called 关键词 would have AI output written into the user's data; a column
 *    the user has since renamed loses its lineage entry and appends.
 * 3. Every target row is empty there. The model picks `rows` and may well send
 *    `"scope":"all"` when the user says "redo it" — a rows-only rule would
 *    overwrite ten answers already paid for, plus any cell hand-edited since.
 *
 * No partial fills: one non-empty target row means this is not a gap-fill.
 * Writing some rows and skipping others produces a result nobody can explain.
 *
 * Matching on the name alone is deliberately not enough. Today uniquifyHeader
 * guarantees a fresh column, so running the same transform twice can never
 * lose anything; a name-only rule would turn that into a destructive op.
 */
export function fillsOwnGaps(
  grid: GridState,
  newColumnName: string,
  sourceColumn: string,
  instruction: string,
  targets: number[],
): number | null {
  if (!targets.length) return null;
  const colIdx = findColumnIndex(grid.headers, newColumnName);
  if (colIdx === -1) return null;
  const lineage = grid.lineage?.[grid.headers[colIdx]];
  if (!lineage || lineage.tool !== "transform_column") return null;
  if (lineage.from[0] !== sourceColumn || lineage.how !== instruction) return null;
  for (const row of targets) {
    if ((grid.rows[row]?.[colIdx] ?? "").trim() !== "") return null;
  }
  return colIdx;
}

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

export type ToolCall = (
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
    }
) & { then?: boolean };

export type ToolResult = {
  ok: boolean;
  summary: string; // short human-readable badge for the tool card
  data: unknown; // structured payload sent back to the model
  // The tool landed, but its result still needs the model to explain a
  // shortfall or interruption before the turn can safely end.
  //
  // A tool that legally did nothing sets it too — nothing matched, nothing was
  // replaced, some rows fell out. The card can say "0 replacements", and that
  // is true, but only the model can say why: the word was spelled differently,
  // the column holds text where the formula wanted numbers. Ending the turn on
  // a bare zero answers a request the user made with a number they did not ask
  // for.
  requiresFollowup?: boolean;
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

// Tools whose effect is not free to replay: they rewrite cell data, delete
// columns, or spend neurons. The agent loop uses this to decide whether an
// unparseable reply is worth retrying — once one of these has run, retrying
// can only do the work a second time. Display-only tools (filter_rows,
// highlight_rows, summarize_column) are deliberately absent: replaying those
// costs nothing and changes no data.
// Spreadsheet semantics: when rows are selected and the model doesn't say
// otherwise, these work on the selection (like Excel does). Filters still
// default to the whole sheet because they *create* the selection.
//
// buildSystemPrompt reads this same list to tell the model what omitting
// "scope" means on this turn. Keep it the single source: the prompt claiming
// one default while this decides another is exactly the bug that made a
// "for all rows" transform quietly hit 100 of 154.
export const ACTS_ON_SELECTION: readonly ToolCall["tool"][] = [
  "find_replace",
  "transform_column",
  "compute_column",
  "summarize_column",
  "highlight_rows",
];

export const IRREVERSIBLE_TOOLS: ReadonlySet<string> = new Set([
  "find_replace",
  "transform_column",
  "compute_column",
  "remove_column",
  "filter_rows_ai",
]);

export const TERMINAL_TOOLS: ReadonlySet<string> = new Set([
  "find_replace",
  "filter_rows",
  "highlight_rows",
  "remove_column",
  "compute_column",
  "transform_column",
  "filter_rows_ai",
]);

// The two tools that spend a model call per row. Everything else is local
// arithmetic, so repeating it costs nothing worth guarding.
export const ROW_RUN_TOOLS: ReadonlySet<string> = new Set(["transform_column", "filter_rows_ai"]);

/**
 * Same tool, same column, same question — a re-run, whatever rows it names.
 *
 * Naming fewer rows is the case this exists for: after a partial run the model
 * is handed the list of rows that got no answer, and six times in eight (
 * glm-5.3-flash, `report-unjudged-rows`) it pastes them straight back into a
 * fresh call. Rewording retryHint moved that to about one in three, which is
 * not a fix — a prompt cannot be the only thing standing between a user and a
 * 54-row charge they already declined.
 */
export function repeatsRowRun(spent: ToolCall, next: ToolCall): boolean {
  if (spent.tool !== next.tool) return false;
  if (!("column" in spent) || !("column" in next) || spent.column !== next.column) return false;
  const question = (c: ToolCall) =>
    c.tool === "transform_column" ? c.instruction : c.tool === "filter_rows_ai" ? c.criteria : null;
  const q = question(spent);
  return q != null && q === question(next);
}

export function shouldEndTurnAfterTool(
  call: ToolCall,
  result: ToolResult,
  enabled: boolean,
): boolean {
  return enabled && call.then === true && result.ok && !result.requiresFollowup;
}

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
  const finish = (call: ToolCall): { call: ToolCall } => ({
    call:
      raw.then === true && TERMINAL_TOOLS.has(call.tool)
        ? { ...call, then: true }
        : call,
  });
  const scope: ToolScope = TOOL_SCOPES.includes(raw.scope as ToolScope)
    ? (raw.scope as ToolScope)
    : raw.scope == null && ACTS_ON_SELECTION.includes(tool as ToolCall["tool"]) && sets.selectedRows?.size
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
    return finish({ tool: "highlight_rows", scope, rows, color, clear });
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
    return finish({ tool: "remove_column", columns: resolved });
  }
  if (tool === "compute_column") {
    const formula = String(raw.formula ?? "").trim();
    if (!formula) return { error: '"formula" must be a non-empty string.' };
    const compiled = compileFormula(formula, headers);
    if (!compiled.ok) return { error: compiled.error };
    const newColumnName = String(raw.newColumnName ?? "").trim() || "Computed";
    return finish({ tool: "compute_column", formula, newColumnName, scope, rows });
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
    return finish({
        tool: "filter_rows",
        column,
        op,
        value: String(raw.value ?? ""),
        mode,
        scope,
        rows,
        highlight: parseHighlight(raw.highlight),
    });
  }
  if (tool === "find_replace") {
    const find = String(raw.find ?? "");
    const replace = String(raw.replace ?? "");
    // Empty find AND empty replace erases the cells it reaches, which is never
    // what anyone wants on purpose. It shows up when the model wants to READ a
    // row: find_replace is the only tool whose example takes "rows", so it gets
    // reached for as a getter and silently wipes the cell instead.
    if (find === "" && replace === "") {
      return {
        error:
          'find_replace with both "find" and "replace" empty would erase those cells, and it is not a way to read them. To READ specific rows, call summarize_column with "rows":[46] — its sampleValues holds those cells\' values. To SET a value, put it in "replace".',
      };
    }
    // Empty "find" rewrites every cell it reaches, so a call that never said
    // where to aim is sloppy rather than intentional: make the model name the
    // target. Note what this message does NOT offer — a way out via
    // "scope":"all". A gate the model can satisfy by itself is not a gate,
    // and the model is the party whose mistake this is meant to catch. It can
    // still ask for the whole column; destructiveWarning() then puts that
    // question to the user, who is the only one able to answer it.
    if (find === "" && !rows && raw.scope == null && scope === "all") {
      return {
        error:
          'Empty "find" overwrites whole cells, so it needs an explicit target. Name the rows with "rows":[46], or use "scope":"selection"/"visible".',
      };
    }
    return finish({
        tool: "find_replace",
        column,
        find,
        replace,
        matchCase: raw.matchCase === true,
        scope,
        rows,
    });
  }
  if (tool === "summarize_column") {
    return finish({ tool: "summarize_column", column, scope, rows });
  }
  if (tool === "filter_rows_ai") {
    const criteria = String(raw.criteria ?? "").trim();
    if (!criteria) return { error: '"criteria" must be a non-empty string.' };
    // The judge sees one cell of `column` and nothing else, so a criteria that
    // names another column is a question it cannot answer — and it answers
    // anyway, YES for every row, which reads back as a clean audit. Naming
    // another column is the reliable tell: a real semantic test ("sounds
    // angry") describes the cell's own content and needs no column names.
    // Deliberately NOT applied to transform_column, whose instruction names
    // another header for a legitimate reason ("提取金额数字" run over 原始记录).
    const foreign = headers.find(
      (h) => h !== column && h.trim().length >= 2 && criteria.toLowerCase().includes(h.trim().toLowerCase()),
    );
    if (foreign) {
      return {
        error:
          `filter_rows_ai judges "${column}" one cell at a time and cannot see "${foreign}", so it would answer this test blindly for every row. To compare two columns: transform_column to pull the comparable value out of "${foreign}" into a new column, then compute_column to subtract the two, then filter_rows on that difference. If the test really is about "${column}" alone, restate it without naming another column.`,
      };
    }
    const mode = raw.mode === "filter" ? "filter" : "select";
    return finish({ tool: "filter_rows_ai", column, criteria, mode, scope, rows, highlight: parseHighlight(raw.highlight) });
  }
  if (tool === "transform_column") {
    const instruction = String(raw.instruction ?? "").trim();
    if (!instruction) return { error: '"instruction" must be a non-empty string.' };
    const newColumnName =
      String(raw.newColumnName ?? "").trim() || `${column} (AI)`;
    return finish({ tool: "transform_column", column, instruction, newColumnName, scope, rows });
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
      nextGrid: { ...grid, headers: next.headers, rows: next.rows, lineage: dropLineage(grid, call.columns) },
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
        result: {
          ok: true,
          summary: `${removed} highlight${removed === 1 ? "" : "s"} cleared`,
          data: { cleared: removed },
          requiresFollowup: removed === 0, // there was nothing to clear
        },
        nextGrid: { ...grid, highlightedRows: next },
      };
    }
    const targets = only ? [...only] : grid.rows.map((_, i) => i);
    const painted = paintRows(grid, targets, call.color);
    return {
      result: {
        ok: true,
        summary: `${targets.length} row${targets.length === 1 ? "" : "s"} highlighted ${call.color}`,
        requiresFollowup: targets.length === 0, // the scope was empty
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
    const inputs = compiled.compiled.colIndexes.map((i) => grid.headers[i]);
    const nextGrid = withLineage(
      { ...grid, headers: next.headers, rows: next.rows },
      name,
      { tool: "compute_column", from: inputs, how: call.formula },
    );
    const circular = circularPair(grid, inputs);
    return {
      result: {
        ok: true,
        summary: `${computed}/${total} rows → "${name}"`,
        // Blank rows in a new column are the same shortfall the AI tools flag:
        // the user sees gaps and the card cannot say the inputs were not numbers.
        requiresFollowup: computed < total,
        data: {
          newColumn: name,
          formula: call.formula,
          inputs,
          rowsComputed: computed,
          rowsSkipped: total - computed,
          // A copy-of-itself formula is the one shape whose zeros mean nothing,
          // and the model reads them as proof. Name it in a field as well as in
          // the prose so it cannot be missed.
          ...(circular ? { comparesColumnWithItsOwnCopy: { original: circular[0], copy: circular[1] } } : {}),
          outcome: `Column "${name}" added: ${call.formula} computed for ${computed} of ${total} rows${scopeNote} (rows with non-numeric inputs left blank). ${lineageNote(nextGrid, name)}`,
          sampleOutputs: outputs.filter((o) => o !== "").slice(0, 3),
        },
      },
      nextGrid,
    };
  }

  const colIdx = findColumnIndex(grid.headers, call.column);

  if (call.tool === "filter_rows") {
    const matched = matchRows(grid.rows, colIdx, call.op, call.value).filter(
      (i) => !only || only.has(i),
    );
    const selection = nextSelection(grid, call, matched);
    let nextGrid: GridState =
      call.mode === "select"
        ? { ...grid, selectedRows: selection }
        : { ...grid, filterKept: matched };
    if (call.highlight && matched.length) nextGrid = paintRows(nextGrid, matched, call.highlight);
    const verb = call.mode === "select" ? "selected" : "kept";
    const alsoSelected = (selection?.size ?? 0) - matched.length;
    return {
      result: {
        ok: true,
        summary: `${matched.length} of ${grid.rows.length} rows ${verb}`,
        // matchOutcome's zero branch is an instruction written for the model —
        // "Do not tell the user that rows were selected". Someone has to read it.
        requiresFollowup: matched.length === 0,
        data: {
          rowsMatched: matched.length,
          rowsTotal: grid.rows.length,
          outcome: matchOutcome({
            matched: matched.length,
            outOf: `${only ? only.size : grid.rows.length} rows${scopeNote}`,
            test: `(${call.column} ${call.op} ${call.value})`,
            mode: call.mode,
            highlight: call.highlight,
            alsoSelected,
          }),
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
        requiresFollowup: replacements === 0, // the text was never there to replace
        data: { replacements, rowsAffected, column: call.column, scope: call.scope },
      },
      nextGrid: { ...grid, rows },
    };
  }

  const scopedRows = only ? grid.rows.filter((_, i) => only.has(i)) : grid.rows;
  const rawStats = summarizeColumn(scopedRows, colIdx, call.column);
  // A survey of a derived column is where the false "all correct" gets said:
  // the model summarizes 差异, sees zeros, and reports the data verified. Say
  // what the column is right where the zeros are read.
  const origin = lineageNote(grid, call.column);
  const stats = origin ? { ...rawStats, outcome: `${rawStats.outcome} ${origin}` } : rawStats;
  // Named rows are a read, not a survey: "what does row 24 say" arrives here
  // because summarize_column is the only reader, and a distinct-value count is
  // not an answer to it. Pair each row number with its cell so the model can
  // quote it back, and say so ahead of the whole-column wording in outcome.
  if (call.rows?.length) {
    const cells = call.rows
      .filter((n) => n >= 1 && n <= grid.rows.length)
      .map((n) => ({ row: n, value: (grid.rows[n - 1][colIdx] ?? "").trim() }));
    const quoted = cells.map((c) => `row ${c.row} = "${c.value}"`).join("; ");
    return {
      result: {
        ok: true,
        summary: `read ${cells.length} row${cells.length === 1 ? "" : "s"} of "${call.column}"`,
        data: {
          ...stats,
          scope: call.scope,
          cells,
          outcome: `Read of "${call.column}" at the rows asked for: ${quoted}. These are the cells themselves, unchanged — answer the user with these values. ${stats.outcome}`,
        },
      },
      nextGrid: grid,
    };
  }
  return {
    result: {
      ok: true,
      summary: `${stats.nonEmpty} values, ${stats.distinct} distinct${scopeNote}`,
      data: { ...stats, scope: call.scope },
    },
    nextGrid: grid,
  };
}

/** Below this many rows, a whole-cell overwrite is precision, not a sweep. */
export const CONFIRM_OVERWRITE_ROWS = 20;

/**
 * The plain-language question to put to the *user* before a call that would
 * wipe or delete data wholesale — or null when there is nothing to ask.
 *
 * This is the half of the guard the model cannot reach. validateToolCall can
 * only make the model be explicit about what it intends; it can never tell a
 * deliberate whole-column overwrite ("set every row to 是") apart from the
 * model mistaking rows it never checked for rows it did. Both arrive as the
 * same legal call. Only the person who asked knows which one they meant, so
 * the confirmation has to reach them.
 */
export function destructiveWarning(call: ToolCall, grid: GridState): string | null {
  if (call.tool === "remove_column") {
    const names = call.columns.join('", "');
    return `Delete the column "${names}" and all ${grid.rows.length} values in it?\n\nThis cannot be undone from the chat.`;
  }
  if (call.tool === "find_replace" && call.find === "") {
    // Only a sweep across rows the user never picked. "selection" and
    // "visible" are sets they can see on screen and chose themselves, and
    // explicit "rows" are the model being precise — which is what we asked it
    // for. Confirming those too would fire on the happy path, and a dialog
    // that appears when nothing is wrong stops being read.
    if (resolveScope(grid, call) !== null) return null;
    if (grid.rows.length <= CONFIRM_OVERWRITE_ROWS) return null;
    return `Overwrite "${call.column}" in all ${grid.rows.length} rows with "${call.replace}"?\n\nEvery existing value in that column is replaced, including rows outside anything you selected. If some of them were never actually checked, they get marked as though they were.`;
  }
  return null;
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
    ...(describeLineage(grid) ? [describeLineage(grid)!] : []),
    `Sample rows (tab-separated, ONLY the first 5 of ${grid.rows.length} — a tiny preview, NOT the whole data):`,
    sampleTsv,
    "",
    "Reply with EXACTLY ONE JSON object and nothing else. No prose outside JSON.",
    'Either a tool call (every tool accepts optional "scope":"all"|"selection"|"visible", and/or "rows":[46,47] — 1-based row numbers from the # column — to aim at specific rows; what omitting "scope" means right now is stated in CURRENT TABLE STATE above):',
    '  {"type":"tool_call","tool":"filter_rows","column":"<exact column name>","op":"contains|equals|not_equals|gt|lt|empty|not_empty","value":"...","mode":"select|filter","highlight":"yellow|green|pink|blue (optional: also paint the matches)"}',
    '  {"type":"tool_call","tool":"find_replace","column":"<exact column name>","find":"...","replace":"...","matchCase":false,"scope":"all|selection|visible"}',
    '  {"type":"tool_call","tool":"filter_rows_ai","column":"<exact column name>","criteria":"a semantic yes/no test for each cell, e.g. sounds angry","mode":"select|filter","highlight":"yellow (optional)"}',
    '  {"type":"tool_call","tool":"summarize_column","column":"<exact column name>","scope":"all|selection|visible","rows":[46]}   ("rows" READS those cells: their values come back in sampleValues)',
    '  {"type":"tool_call","tool":"transform_column","column":"<exact column name>","instruction":"what to produce from each cell, e.g. extract the main keyword","newColumnName":"...","scope":"all|selection|visible"}',
    '  {"type":"tool_call","tool":"compute_column","formula":"[Column A] / [Column B]","newColumnName":"...","scope":"all|selection|visible"}',
    '  {"type":"tool_call","tool":"remove_column","columns":["<exact column name>", "..."]}   (deletes those columns from the sheet)',
    '  {"type":"tool_call","tool":"highlight_rows","scope":"selection","color":"yellow|green|pink|blue"}   (or "rows":[3,7] for specific row numbers; "clear":true to remove highlights)',
    "Or a final answer to the user:",
    '  {"type":"final","message":"..."}',
    'That same shape — never a tool call — is also how you turn down what no tool above can do (sorting or reordering rows, adding or deleting rows, charts). Answer in the language the user wrote in, and name the closest thing you can do:',
    '  {"type":"final","message":"还不能给表格排序 —— 我可以帮你筛选或高亮这些行。"}',
    '  {"type":"final","message":"I can\'t draw a chart yet — I can summarize that column for you instead."}',
    '  {"type":"final","message":"删掉整行我还做不到 —— 我可以帮你把那一行选中或高亮出来。"}   (emptying a cell with find_replace is NOT deleting a row)',
    'Pick ONE of the objects above and send only that: a tool call OR a final, never both in the same reply.',
    '- If you need to read the result before you can answer — including anything',
    '  about what the data says, any summarize_column call, or any request needing',
    '  another tool afterward — send the tool call without "then" and wait for TOOL_RESULT.',
    '- If this tool call is the whole answer — you are changing the sheet and the',
    '  user can see the change — add "then":true. The turn ends after the tool runs.',
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
    '  the number is known) → pass "rows":[46]. To READ those cells: summarize_column with',
    '  "rows":[46]. To SET one: find_replace with "find":"","replace":"<new value>","rows":[46].',
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
    "- If the request needs something none of the tools above can do (sort/reorder",
    "  rows, add or delete rows, charts, live formulas), do NOT improvise and do NOT",
    "  call a tool that does something else instead — filtering or selecting is not",
    '  sorting. Reply {"type":"final","message":"I can\'t do that yet — ..."} and name',
    "  the closest thing you can do.",
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
  // What omitting "scope" actually does, in this turn's numbers. Stated here
  // rather than as a general rule because the answer changes turn to turn, and
  // a model that has to derive it from a rule gets it wrong: one run asked to
  // set a column "for all rows", left "scope" out, and silently wrote 100 of
  // 154. Naming the row counts makes the mistake visible before it is made.
  const acting = ACTS_ON_SELECTION.join(", ");
  const defaultNote = grid.selectedRows?.size
    ? `Omitting "scope" on ${acting} RIGHT NOW means the ${grid.selectedRows.size} selected rows, NOT all ${grid.rows.length}. To act on the whole sheet you must pass "scope":"all" explicitly. Every other tool still defaults to all ${grid.rows.length} rows.`
    : `Omitting "scope" right now means all ${grid.rows.length} rows, for every tool.`;
  return [
    "CURRENT TABLE STATE (authoritative — this reflects the table right now and",
    "supersedes anything claimed earlier in this chat, including your own TOOL_RESULTs):",
    `Row sets you can target with "scope": ${parts.join("; ")}.${parts.length === 1 ? " No selection or filter exists right now." : ""}`,
    defaultNote,
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

export function processResultCounts(
  results: Array<{ output: string | null }>,
  failedIndices: number[],
): { filled: number; empty: number; failed: number } {
  const failedSet = new Set(failedIndices);
  let filled = 0;
  let empty = 0;
  results.forEach((result, index) => {
    if (failedSet.has(index)) return;
    if (result.output == null || result.output.trim() === "") empty++;
    else filled++;
  });
  return { filled, empty, failed: failedSet.size };
}

/**
 * "10 got no answer and 20 more came back empty" — naming only the buckets
 * that actually have rows in them, for a caller that has already said how many
 * rows there were. A sentence opening with "0 of 60 rows got no answer" spends
 * its first clause on something that did not happen.
 */
export function shortfallPhrase(failed: number, empty: number): string {
  if (failed && empty) return `${failed} got no answer and ${empty} more came back empty`;
  if (failed) return `${failed} got no answer`;
  return `${empty} came back empty`;
}

export function rowRunRequiresFollowup(
  counts: { empty: number; failed: number },
  stopped: unknown,
  keptPartial: boolean,
): boolean {
  return counts.empty > 0 || counts.failed > 0 || Boolean(stopped) || keptPartial;
}

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
 * Calling the tool again cannot stand in for it, and re-billing every row in
 * the scope is the part that does not get undone. Offering a rerun here is
 * what put the user in a loop — the rerun fails the same way and asks again.
 *
 * (Two of the three ways a rerun used to go wrong have since been fixed in the
 * executors: transform_column fills its own blank cells instead of appending a
 * second column (`fillsOwnGaps`), and filter_rows_ai adds to the selection
 * instead of replacing it (`nextSelection`). The charge remains, so this hint
 * remains.)
 *
 * How it is worded, measured 2026-09-20 on glm-5.3-flash over `report-
 * unjudged-rows` at 8 runs: the previous version scored 1-2/8. It opened with
 * the unanswered rows spelled out one by one — "101, 102, 103, …" — which is
 * `rows:[101,102,103,…]` with the punctuation changed, and then told the model
 * not to use it. It copied the list and ignored the prohibition six times in
 * eight. So: say what the next reply IS before saying what it is not, and
 * collapse the numbers into ranges, which are the right shape for a sentence to
 * a human and the wrong shape to paste into a tool call. The ranges are also a
 * lot cheaper than 54 integers.
 */
export function retryHint(failedRows: number[] | null): string {
  const which = failedRows
    ? `The unanswered rows are ${rowRanges(failedRows)}.`
    : "There are too many to list individually.";
  return `Your next reply is the answer to the user, not another tool call. This run is finished and reporting it is all that is left to do. ${which} Name them and say they were never checked. Calling this tool again — even on only those rows — charges for every row in the scope again, and spends the run the user just declined when they chose to keep what worked. If they ask for another attempt, say that it starts a fresh run over the rows they name.`;
}

/** [101,102,103,107] → "101–103, 107". A sentence to a human, not an argument. */
export function rowRanges(rows: number[]): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return out.join(", ");
}

/**
 * What actually happened to the selection, worded the same way for the
 * mechanical and the AI filter. Zero matches is the case that used to lie: no
 * rows get painted, select mode clears the selection instead of setting one,
 * and "scope":"selection" would then mean the whole sheet — so an empty result
 * must not promise a highlight, and must not invite the next call to reuse the
 * selection.
 */
export function matchOutcome(a: {
  matched: number;
  /** The denominator, already worded: "154 rows", "100 rows judged", ... */
  outOf: string;
  /** The test that was applied, e.g. `(金额 gt 100)`. */
  test: string;
  mode: "filter" | "select";
  highlight: HighlightColor | null;
  /**
   * Rows that were already selected, were outside this call's rows, and are
   * therefore still selected. Only nextSelection's additive path produces
   * them, and the two sentences below are wrong without it: "nothing is
   * selected" and "the selection is now cleared" would both be false.
   */
  alsoSelected?: number;
}): string {
  const verb = a.mode === "select" ? "selected" : "kept";
  const carried = a.mode === "select" ? (a.alsoSelected ?? 0) : 0;
  if (a.matched === 0) {
    return `None of ${a.outOf} matched ${a.test}. Nothing new is ${verb}${
      a.highlight ? " and nothing was highlighted" : ""
    }${
      a.mode === "select"
        ? carried > 0
          ? `; the ${carried} rows selected before this call are untouched and still selected`
          : "; the selection the user had is now cleared"
        : ""
    }. Do not tell the user that these rows were ${verb}${a.highlight ? " or highlighted" : ""}.`;
  }
  return `${a.matched} of ${a.outOf} matched ${a.test} and are now ${verb}${
    a.highlight ? ` and highlighted ${a.highlight}` : ""
  } in the user's table${
    carried > 0 ? `, alongside the ${carried} rows that were already selected and that this call did not look at` : ""
  }. ${scopeHint(a.mode)}`;
}

export function scopeHint(mode: "filter" | "select"): string {
  return mode === "select"
    ? 'These rows are now the selection: another tool can target them with "scope":"selection".'
    : 'These rows can now be targeted by another tool with "scope":"visible".';
}

/**
 * The rows a "select" filter should leave selected — the additive counterpart
 * to replacing the set outright.
 *
 * Replacing is right when the filter swept the whole sheet, or narrowed a set
 * that already existed: every row it did not match, it did look at and reject.
 *
 * A call aimed at explicit "rows" is the other case, and it is the one the
 * model sends after a partial run — the rows that came back unanswered. The
 * rows outside that list were never in question. Replacing there drops the
 * matches the first run already paid for, and when the retried rows match
 * nothing it clears the selection altogether: the user loses a set they can
 * see, to a call that only ever asked about five rows.
 *
 * So: re-decide exactly the rows this call examined, and leave the rest of the
 * selection as it was.
 *
 * "filter" mode is deliberately not treated this way. Its result is what the
 * user can see, and "show me only these rows" is a fair reading of a call that
 * names rows one by one.
 */
export function nextSelection(
  grid: GridState,
  call: { scope: ToolScope; rows: number[] | null },
  matched: number[],
): Set<number> | null {
  if (!call.rows?.length) return matched.length ? new Set(matched) : null;
  const next = new Set(grid.selectedRows ?? []);
  for (const i of resolveScope(grid, call) ?? []) next.delete(i);
  for (const i of matched) next.add(i);
  return next.size ? next : null;
}

export function paintRows(grid: GridState, rows: number[], color: HighlightColor): GridState {
  const next = new Map(grid.highlightedRows ?? []);
  for (const i of rows) next.set(i, color);
  return { ...grid, highlightedRows: next };
}
