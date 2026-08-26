"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  downloadWorkbookXlsx,
  parseWorkbookFile,
  toCsv,
  WorkbookError,
  type ParsedSheet,
} from "@/lib/cells/workbook";
import {
  dispatchTool,
  type GridState,
  type ToolCall,
  type ToolResult,
} from "@/lib/cells/tools";
import {
  appendColumn,
  findColumnIndex,
  uniquifyHeader,
} from "@/lib/cells/table-ops";
import { processRows } from "@/lib/process";
import {
  nextMessageId,
  runAgentTurn,
  type ChatMessage,
} from "@/lib/cells/agent";
import WorkbookPanel, { type WorkbookState } from "./WorkbookPanel";
import ChatPanel from "./ChatPanel";
import UsageMeter from "./UsageMeter";
import { LocaleContext } from "@/lib/cells/locale";
import { t, type Locale } from "@/lib/cells/i18n";

// Rounded system font stack — no build-time font download, fork-friendly.
const ROUNDED_FONT =
  'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Nunito", "Comic Neue", "Arial Rounded MT Bold", system-ui, sans-serif';

function gridFromSheet(sheet: ParsedSheet): GridState {
  return {
    headers: sheet.headers,
    rows: sheet.rows,
    highlightedRows: null,
    filterKept: null,
    selectedRows: null,
  };
}

export default function CellsApp() {
  // Locale: saved choice wins, otherwise follow the browser's language.
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("cells-locale"); } catch {}
    if (saved === "zh" || saved === "en") setLocale(saved);
    else if (navigator.language?.toLowerCase().startsWith("zh")) setLocale("zh");
  }, []);
  const switchLocale = (next: Locale) => {
    setLocale(next);
    try { localStorage.setItem("cells-locale", next); } catch {}
  };

  const [workbookState, setWorkbookState] = useState<WorkbookState>({
    status: "idle",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usageRefresh, setUsageRefresh] = useState(0);
  const [agent, setAgent] = useState<{
    thinking: boolean;
    step: number;
    progress: { done: number; total: number } | null;
  }>({ thinking: false, step: 1, progress: null });

  // The agent loop reads/writes the grid through refs so mid-turn tool calls
  // always see the latest data, independent of React's async state updates.
  const gridRef = useRef<GridState | null>(null);
  const localeRef = useRef<Locale>("en");
  localeRef.current = locale;
  const turnIdRef = useRef(0);

  const setGrid = useCallback((grid: GridState) => {
    gridRef.current = grid;
    setWorkbookState((prev) =>
      prev.status === "ready" ? { ...prev, grid } : prev,
    );
  }, []);

  const handleFile = useCallback((file: File) => {
    turnIdRef.current++; // cancel any in-flight agent turn
    setAgent({ thinking: false, step: 1, progress: null });
    setWorkbookState({ status: "parsing", fileName: file.name });
    // Let the "parsing" frame paint before the (synchronous) parse work.
    window.setTimeout(async () => {
      try {
        const workbook = await parseWorkbookFile(file);
        const grid = gridFromSheet(workbook.sheets[0]);
        gridRef.current = grid;
        setWorkbookState({ status: "ready", workbook, activeSheet: 0, grid });
        setMessages([]);
      } catch (e) {
        setWorkbookState({
          status: "error",
          message:
            e instanceof WorkbookError
              ? e.message
              : t(localeRef.current, "openError"),
        });
      }
    }, 0);
  }, []);

  const handleSelectSheet = useCallback((index: number) => {
    turnIdRef.current++;
    setAgent({ thinking: false, step: 1, progress: null });
    setWorkbookState((prev) => {
      if (prev.status !== "ready" || !prev.workbook.sheets[index]) return prev;
      const grid = gridFromSheet(prev.workbook.sheets[index]);
      gridRef.current = grid;
      return { ...prev, activeSheet: index, grid };
    });
  }, []);

  const handleReset = useCallback(() => {
    setWorkbookState((prev) => {
      if (prev.status !== "ready") return prev;
      const grid = gridFromSheet(prev.workbook.sheets[prev.activeSheet]);
      gridRef.current = grid;
      return { ...prev, grid };
    });
  }, []);

  // Row selection: click a row number; Shift extends from the last click,
  // Cmd/Ctrl toggles. The agent sees the selection in its system prompt.
  const selectionAnchorRef = useRef<number | null>(null);
  const handleSelectRow = useCallback(
    (rowIdx: number, mods: { shift: boolean; meta: boolean }) => {
      const grid = gridRef.current;
      if (!grid) return;
      const cur = new Set(grid.selectedRows ?? []);
      if (mods.shift && selectionAnchorRef.current != null) {
        const [a, b] = [selectionAnchorRef.current, rowIdx].sort((x, y) => x - y);
        for (let i = a; i <= b; i++) cur.add(i);
      } else if (mods.meta) {
        cur.has(rowIdx) ? cur.delete(rowIdx) : cur.add(rowIdx);
        selectionAnchorRef.current = rowIdx;
      } else {
        const solo = cur.size === 1 && cur.has(rowIdx);
        cur.clear();
        if (!solo) cur.add(rowIdx);
        selectionAnchorRef.current = rowIdx;
      }
      setGrid({ ...grid, selectedRows: cur.size ? cur : null });
    },
    [setGrid],
  );

  const handleClearSelection = useCallback(() => {
    if (gridRef.current) setGrid({ ...gridRef.current, selectedRows: null });
  }, [setGrid]);

  const handleClearHighlights = useCallback(() => {
    if (gridRef.current) setGrid({ ...gridRef.current, highlightedRows: null });
  }, [setGrid]);

  const handleShowAllRows = useCallback(() => {
    if (gridRef.current) setGrid({ ...gridRef.current, filterKept: null });
  }, [setGrid]);

  const handleEditCell = useCallback(
    (rowIdx: number, colIdx: number, value: string) => {
      const grid = gridRef.current;
      if (!grid) return;
      const rows = grid.rows.slice();
      const row = rows[rowIdx].slice();
      row[colIdx] = value;
      rows[rowIdx] = row;
      setGrid({ ...grid, rows });
    },
    [setGrid],
  );

  const handleDownload = useCallback(() => {
    const grid = gridRef.current;
    if (!grid || workbookState.status !== "ready") return;
    const kept = grid.filterKept ?? grid.rows.map((_, i) => i);
    const csv = toCsv(
      grid.headers,
      kept.map((i) => grid.rows[i]),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = workbookState.workbook.fileName.replace(/\.[^.]+$/, "") + "-cells.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [workbookState]);

  // Export the whole workbook as .xlsx: the active sheet gets the edited grid
  // (respecting the current filter, same as the CSV export) with highlights as
  // yellow fills, other sheets as uploaded.
  const handleDownloadXlsx = useCallback(() => {
    const grid = gridRef.current;
    if (!grid || workbookState.status !== "ready") return;
    const kept = grid.filterKept ?? grid.rows.map((_, i) => i);
    const sheets = workbookState.workbook.sheets.map((s, i) =>
      i === workbookState.activeSheet
        ? {
            name: s.name,
            headers: grid.headers,
            rows: kept.map((k) => grid.rows[k]),
            // Re-index highlights against the exported (possibly filtered) rows.
            highlightedRows: grid.highlightedRows
              ? new Set(
                  kept
                    .map((k, j) => (grid.highlightedRows!.has(k) ? j : -1))
                    .filter((j) => j !== -1),
                )
              : null,
          }
        : { name: s.name, headers: s.headers, rows: s.rows },
    );
    const fileName =
      workbookState.workbook.fileName.replace(/\.[^.]+$/, "") + "-cells.xlsx";
    void downloadWorkbookXlsx(fileName, sheets);
  }, [workbookState]);

  // transform_column: run the instruction on every row via the batched LLM
  // pipeline (/api/process), then append the outputs as a new column.
  const runTransform = useCallback(
    async (
      call: Extract<ToolCall, { tool: "transform_column" }>,
    ): Promise<ToolResult> => {
      const grid = gridRef.current!;
      const colIdx = findColumnIndex(grid.headers, call.column);
      const only = call.scope === "selection" ? grid.selectedRows : null;
      const targets = grid.rows.map((_, i) => i).filter((i) => !only || only.has(i));
      const values = targets.map((i) => grid.rows[i][colIdx] ?? "");
      setAgent((prev) => ({ ...prev, progress: { done: 0, total: values.length } }));
      try {
        const results = await processRows(
          values,
          call.instruction,
          call.column,
          50,
          undefined,
          {
            action: "download",
            onProgress: (done, total) =>
              setAgent((prev) => ({ ...prev, progress: { done, total } })),
          },
        );
        const current = gridRef.current!;
        const name = uniquifyHeader(current.headers, call.newColumnName);
        const outputs = new Array<string>(current.rows.length).fill("");
        targets.forEach((rowIdx, j) => (outputs[rowIdx] = results[j]?.output ?? ""));
        const next = appendColumn(current.headers, current.rows, name, outputs);
        setGrid({ ...current, headers: next.headers, rows: next.rows });
        const filled = results.filter((r) => r.output != null).length;
        return {
          ok: true,
          summary: `${filled}/${results.length} rows → "${name}"`,
          data: {
            newColumn: name,
            rowsProcessed: results.length,
            scope: call.scope,
            sampleOutputs: results.slice(0, 3).map((r) => r.output),
          },
        };
      } catch (e) {
        return {
          ok: false,
          summary: "transform failed",
          data: { error: e instanceof Error ? e.message : String(e) },
        };
      } finally {
        setAgent((prev) => ({ ...prev, progress: null }));
      }
    },
    [setGrid],
  );

  // filter_rows_ai: ask the model YES/NO per row via the same batched pipeline,
  // then highlight / keep the YES rows. Mechanical filters never touch the LLM.
  const runAiFilter = useCallback(
    async (
      call: Extract<ToolCall, { tool: "filter_rows_ai" }>,
    ): Promise<ToolResult> => {
      const grid = gridRef.current!;
      const colIdx = findColumnIndex(grid.headers, call.column);
      const only = call.scope === "selection" ? grid.selectedRows : null;
      const targets = grid.rows.map((_, i) => i).filter((i) => !only || only.has(i));
      const values = targets.map((i) => grid.rows[i][colIdx] ?? "");
      setAgent((prev) => ({ ...prev, progress: { done: 0, total: values.length } }));
      try {
        const results = await processRows(
          values,
          `Answer only YES or NO: does this text match the test "${call.criteria}"?`,
          call.column,
          50,
          undefined,
          {
            action: "download",
            onProgress: (done, total) =>
              setAgent((prev) => ({ ...prev, progress: { done, total } })),
          },
        );
        const matched: number[] = [];
        results.forEach((r, j) => {
          if (/^\s*yes\b/i.test(r.output ?? "")) matched.push(targets[j]);
        });
        const current = gridRef.current!;
        setGrid(
          call.mode === "highlight"
            ? { ...current, highlightedRows: matched.length ? new Set(matched) : null }
            : { ...current, filterKept: matched },
        );
        const verb = call.mode === "highlight" ? "highlighted" : "kept";
        return {
          ok: true,
          summary: `${matched.length} of ${results.length} rows ${verb}`,
          data: {
            rowsMatched: matched.length,
            rowsTotal: results.length,
            outcome: `${matched.length} of ${results.length} rows${only ? " (within the selection)" : ""} matched "${call.criteria}" (judged by AI on ${call.column}) and are now ${verb} in the user's table.`,
          },
        };
      } catch (e) {
        return {
          ok: false,
          summary: "AI filter failed",
          data: { error: e instanceof Error ? e.message : String(e) },
        };
      } finally {
        setAgent((prev) => ({ ...prev, progress: null }));
      }
    },
    [setGrid],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (workbookState.status !== "ready" || agent.thinking) return;
      const sheetName = workbookState.workbook.sheets[workbookState.activeSheet].name;
      const userMessage: ChatMessage = {
        id: nextMessageId(),
        role: "user",
        content: text,
      };
      const history = [...messages, userMessage];
      setMessages(history);
      const turnId = ++turnIdRef.current;
      setAgent({ thinking: true, step: 1, progress: null });

      try {
        await runAgentTurn({
          history,
          sheetName,
          locale: localeRef.current,
          getGrid: () => gridRef.current!,
          applyTool: (call: ToolCall) => {
            if (call.tool === "transform_column") return runTransform(call);
            if (call.tool === "filter_rows_ai") return runAiFilter(call);
            const { result, nextGrid } = dispatchTool(call, gridRef.current!);
            setGrid(nextGrid);
            return result;
          },
          isStale: () => turnIdRef.current !== turnId,
          emit: (message) => setMessages((prev) => [...prev, message]),
          onStep: (step) => setAgent((prev) => ({ ...prev, thinking: true, step })),
        });
      } catch (e) {
        if (turnIdRef.current === turnId) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextMessageId(),
              role: "assistant",
              content: `😵 ${e instanceof Error ? e.message : t(locale, "genericError")}`,
            },
          ]);
        }
      } finally {
        if (turnIdRef.current === turnId) setAgent({ thinking: false, step: 1, progress: null });
        setUsageRefresh((n) => n + 1);
      }
    },
    [workbookState, agent.thinking, messages, setGrid, runTransform, runAiFilter],
  );

  return (
    <LocaleContext.Provider value={locale}>
    <div
      className="flex min-h-screen flex-col bg-[#fffdf8] text-black lg:h-screen"
      style={{ fontFamily: ROUNDED_FONT }}
    >
      <header className="flex items-center justify-between px-6 pt-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Delightful{" "}
            <span className="bg-gradient-to-r from-[#ff0080] via-[#ff8c00] to-[#7c4dff] bg-clip-text text-transparent">
              Cells
            </span>
          </h1>
          <p className="text-xs font-semibold text-black/45">
            {t(locale, "subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => switchLocale(locale === "zh" ? "en" : "zh")}
          className="inline-flex items-center rounded-full border !border-black/15 bg-white px-3 py-1.5 text-xs font-semibold !text-black/70 hover:bg-[#fff3d6]"
        >
          {locale === "zh" ? "EN" : "中文"}
        </button>
        <a
          href="https://github.com/hcsum/delightful-cells"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border !border-black/15 bg-white px-4 py-1.5 text-xs font-semibold !text-black/70 hover:bg-[#fff3d6]"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:[grid-template-rows:minmax(0,1fr)]">
        <div className="flex min-h-[50vh] flex-col lg:min-h-0">
          <WorkbookPanel
            state={workbookState}
            onFile={handleFile}
            onEditCell={handleEditCell}
            onSelectRow={handleSelectRow}
            onClearSelection={handleClearSelection}
            onSelectSheet={handleSelectSheet}
            onClearHighlights={handleClearHighlights}
            onShowAllRows={handleShowAllRows}
            onReset={handleReset}
            onDownload={handleDownload}
            onDownloadXlsx={handleDownloadXlsx}
          />
        </div>
        <div className="flex min-h-[50vh] flex-col lg:min-h-0">
          <UsageMeter refreshKey={usageRefresh} />
          <ChatPanel
            messages={messages}
            thinking={agent.thinking}
            thinkingStep={agent.step}
            progress={agent.progress}
            ready={workbookState.status === "ready"}
            onSend={handleSend}
          />
        </div>
      </div>
    </div>
    </LocaleContext.Provider>
  );
}
