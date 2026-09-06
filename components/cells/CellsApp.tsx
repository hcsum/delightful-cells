"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  downloadWorkbookXlsx,
  ExportTooLargeError,
  parseWorkbookFile,
  toCsv,
  WorkbookError,
  type ParsedSheet,
} from "@/lib/cells/workbook";
import {
  dispatchTool,
  HIGHLIGHT_HEX,
  paintRows,
  resolveScope,
  scopeHint,
  scopeLabel,
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
import { describeUserChanges, snapshotGrid, type GridSnapshot } from "@/lib/cells/state-diff";
import { presetsFor } from "@/lib/cells/demo";
import { t, type Locale } from "@/lib/cells/i18n";
import { AI_BATCH_ROWS, TIER_LIMITS } from "@/lib/limits";
import { useMe } from "@/lib/billing/useMe";
import AuthPill from "@/components/billing/AuthPill";
import CreditsBadge from "@/components/billing/CreditsBadge";

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
  // Tier, allowance and balance. Re-read after every turn so the meter and the
  // per-run cap follow a sign-in or a top-up without a reload.
  const { me } = useMe(usageRefresh);
  // The "you're on credits now" note is shown once per session, not per call.
  const creditsNoticeShownRef = useRef(false);
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
  // What the table looked like when the last agent turn ended, plus a running
  // count of hand edits — diffed at the start of the next turn (state-diff.ts).
  const lastTurnSnapshotRef = useRef<GridSnapshot | null>(null);
  const userEditsRef = useRef(0);
  const turnIdRef = useRef(0);

  // Read through refs: the agent loop's callbacks are memoized and must see
  // the current cap, not the one captured when they were created.
  // Before /api/me answers, assume the anonymous floor: over-guessing means
  // sending a run the server will reject outright.
  const rowsPerRunRef = useRef<number>(TIER_LIMITS.anon.aiRowsPerRun);
  rowsPerRunRef.current = me?.limits.aiRowsPerRun ?? TIER_LIMITS.anon.aiRowsPerRun;
  const meRef = useRef(me);
  meRef.current = me;

  // Hitting the per-run cap is the main reason to sign in or top up, so say
  // what the next tier up would allow instead of just refusing.
  const rowsPerRunError = useCallback(() => {
    const cap = rowsPerRunRef.current;
    const tier = meRef.current?.tier ?? "anon";
    return tier === "anon"
      ? t(localeRef.current, "rowsPerRunAnon", { n: cap, m: TIER_LIMITS.free.aiRowsPerRun })
      : t(localeRef.current, "rowsPerRunFree", {
          n: cap,
          m: meRef.current?.limits.paidAiRowsPerRun ?? TIER_LIMITS.paid.aiRowsPerRun,
        });
  }, []);

  // First time a call is billed to credits instead of the free allowance, say
  // so once. Silent after that — the balance in the header is the ongoing cue.
  useEffect(() => {
    if (!me?.billingToCredits || creditsNoticeShownRef.current) return;
    creditsNoticeShownRef.current = true;
    setMessages((prev) => [
      ...prev,
      {
        id: nextMessageId(),
        role: "note",
        content: t(localeRef.current, "switchedToCredits"),
      },
    ]);
  }, [me?.billingToCredits]);

  const setGrid = useCallback((grid: GridState) => {
    gridRef.current = grid;
    setWorkbookState((prev) =>
      prev.status === "ready" ? { ...prev, grid } : prev,
    );
  }, []);

  const handleFile = useCallback((file: File) => {
    turnIdRef.current++; // cancel any in-flight agent turn
    lastTurnSnapshotRef.current = null;
    userEditsRef.current = 0;
    setAgent({ thinking: false, step: 1, progress: null });
    // XLSX.read is synchronous: a big file freezes the tab for seconds, so say
    // so up front rather than looking hung.
    setWorkbookState({
      status: "parsing",
      fileName: file.name,
      big: file.size > 5 * 1024 * 1024,
    });
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
    lastTurnSnapshotRef.current = null;
    userEditsRef.current = 0;
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
      userEditsRef.current++;
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
              ? new Map(
                  kept.flatMap((k, j) => {
                    const c = grid.highlightedRows!.get(k);
                    return c ? [[j, HIGHLIGHT_HEX[c]] as [number, string]] : [];
                  }),
                )
              : null,
          }
        : { name: s.name, headers: s.headers, rows: s.rows },
    );
    const fileName =
      workbookState.workbook.fileName.replace(/\.[^.]+$/, "") + "-cells.xlsx";
    void downloadWorkbookXlsx(fileName, sheets).catch((e) => {
      // The styled writer refuses past MAX_STYLED_EXPORT_ROWS; the CSV and
      // unhighlighted paths still work, so say which way out is available.
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: "note",
          content:
            e instanceof ExportTooLargeError
              ? t(localeRef.current, "exportTooLarge", {
                  n: Number(e.message).toLocaleString(),
                })
              : t(localeRef.current, "genericError"),
        },
      ]);
    });
  }, [workbookState]);

  // transform_column: run the instruction on every row via the batched LLM
  // pipeline (/api/process), then append the outputs as a new column.
  const runTransform = useCallback(
    async (
      call: Extract<ToolCall, { tool: "transform_column" }>,
    ): Promise<ToolResult> => {
      const grid = gridRef.current!;
      const colIdx = findColumnIndex(grid.headers, call.column);
      const only = resolveScope(grid, call);
      const targets = grid.rows.map((_, i) => i).filter((i) => !only || only.has(i));
      const values = targets.map((i) => grid.rows[i][colIdx] ?? "");
      if (values.length > rowsPerRunRef.current) {
        return {
          ok: false,
          summary: "too many rows",
          data: { error: rowsPerRunError() },
        };
      }
      setAgent((prev) => ({ ...prev, progress: { done: 0, total: values.length } }));
      try {
        const results = await processRows(
          values,
          call.instruction,
          call.column,
          AI_BATCH_ROWS,
          undefined,
          {
            action: "download",
            locale: localeRef.current,
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
  // then select / keep the YES rows. Mechanical filters never touch the LLM.
  const runAiFilter = useCallback(
    async (
      call: Extract<ToolCall, { tool: "filter_rows_ai" }>,
    ): Promise<ToolResult> => {
      const grid = gridRef.current!;
      const colIdx = findColumnIndex(grid.headers, call.column);
      const only = resolveScope(grid, call);
      const targets = grid.rows.map((_, i) => i).filter((i) => !only || only.has(i));
      const values = targets.map((i) => grid.rows[i][colIdx] ?? "");
      if (values.length > rowsPerRunRef.current) {
        return {
          ok: false,
          summary: "too many rows",
          data: { error: rowsPerRunError() },
        };
      }
      setAgent((prev) => ({ ...prev, progress: { done: 0, total: values.length } }));
      try {
        const results = await processRows(
          values,
          `Answer only YES or NO: does this text match the test "${call.criteria}"?`,
          call.column,
          AI_BATCH_ROWS,
          undefined,
          {
            action: "download",
            locale: localeRef.current,
            onProgress: (done, total) =>
              setAgent((prev) => ({ ...prev, progress: { done, total } })),
          },
        );
        const matched: number[] = [];
        results.forEach((r, j) => {
          if (/^\s*yes\b/i.test(r.output ?? "")) matched.push(targets[j]);
        });
        const current = gridRef.current!;
        let next: GridState =
          call.mode === "select"
            ? { ...current, selectedRows: matched.length ? new Set(matched) : null }
            : { ...current, filterKept: matched };
        if (call.highlight && matched.length) next = paintRows(next, matched, call.highlight);
        setGrid(next);
        const verb = call.mode === "select" ? "selected" : "kept";
        return {
          ok: true,
          summary: `${matched.length} of ${results.length} rows ${verb}`,
          data: {
            rowsMatched: matched.length,
            rowsTotal: results.length,
            outcome: `${matched.length} of ${results.length} rows${only ? ` (within the ${scopeLabel(call)} rows)` : ""} matched "${call.criteria}" (judged by AI on ${call.column}) and are now ${verb}${call.highlight ? ` and highlighted ${call.highlight}` : ""} in the user's table. ${scopeHint(call.mode)}`,
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
      // Anything the user did by hand since the last turn becomes a note the
      // model reads before the new request (and a gray line in the chat).
      const prevSnap = lastTurnSnapshotRef.current;
      const note = prevSnap
        ? describeUserChanges(prevSnap, snapshotGrid(gridRef.current!, userEditsRef.current))
        : null;
      const history: ChatMessage[] = [
        ...messages,
        ...(note ? [{ id: nextMessageId(), role: "note" as const, content: note }] : []),
        userMessage,
      ];
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
        if (turnIdRef.current === turnId) {
          setAgent({ thinking: false, step: 1, progress: null });
          if (gridRef.current) {
            lastTurnSnapshotRef.current = snapshotGrid(gridRef.current, userEditsRef.current);
          }
        }
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
        {/* AppShell early-returns on "/", so the homepage carries its own
            header controls rather than inheriting the site chrome. */}
        <CreditsBadge me={me} />
        <AuthPill />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:[grid-template-rows:minmax(0,1fr)]">
        <div className="flex min-h-[50vh] max-h-[85vh] flex-col lg:min-h-0 lg:max-h-none">
          <WorkbookPanel
            state={workbookState}
            limits={me?.limits}
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
        <div className="flex min-h-[50vh] max-h-[85vh] flex-col lg:min-h-0 lg:max-h-none">
          <UsageMeter me={me} />
          <ChatPanel
            messages={messages}
            thinking={agent.thinking}
            thinkingStep={agent.step}
            progress={agent.progress}
            ready={workbookState.status === "ready"}
            presets={
              workbookState.status === "ready"
                ? presetsFor(
                    workbookState.workbook.fileName,
                    workbookState.workbook.sheets[workbookState.activeSheet].name,
                    workbookState.grid.headers,
                    locale,
                  )
                : []
            }
            onSend={handleSend}
          />
        </div>
      </div>
    </div>
    </LocaleContext.Provider>
  );
}
