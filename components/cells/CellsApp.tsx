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
  destructiveWarning,
  dispatchTool,
  failedRowNumbers,
  HIGHLIGHT_HEX,
  matchOutcome,
  paintRows,
  resolveScope,
  retryHint,
  scopeLabel,
  transformProvenance,
  withLineage,
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
import type { ProcessResultItem, ProcessStop } from "@/lib/process";
import PartialResultDialog from "@/components/PartialResultDialog";
import {
  nextMessageId,
  runAgentTurn,
  type AgentPhase,
  type ChatMessage,
} from "@/lib/cells/agent";
import WorkbookPanel, { type WorkbookState } from "./WorkbookPanel";
import ChatPanel from "./ChatPanel";
import UsageMeter from "./UsageMeter";
import { LocaleContext, useStoredLocale } from "@/lib/cells/locale";
import { describeUserChanges, snapshotGrid, type GridSnapshot } from "@/lib/cells/state-diff";
import { presetsFor } from "@/lib/cells/demo";
import { t, type Locale } from "@/lib/cells/i18n";
import {
  AI_BATCH_ROWS,
  MAX_IMPORT_ROWS,
  dailyNeurons,
  minCreditsForRows,
  rowsAffordable,
} from "@/lib/limits";
import { useMe } from "@/lib/billing/useMe";
import AuthPill from "@/components/billing/AuthPill";
import CreditsBadge from "@/components/billing/CreditsBadge";

// Rounded system font stack — no build-time font download, fork-friendly.
const ROUNDED_FONT =
  'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Nunito", "Comic Neue", "Arial Rounded MT Bold", system-ui, sans-serif';
const LARGE_AI_RUN_ROWS = 1000;
const MEASURED_SECONDS_PER_BATCH = 10.5;

function gridFromSheet(sheet: ParsedSheet): GridState {
  return {
    headers: sheet.headers,
    rows: sheet.rows,
    highlightedRows: null,
    filterKept: null,
    selectedRows: null,
  };
}

export default function CellsApp({ initialLocale = "en" }: { initialLocale?: Locale }) {
  const [locale, switchLocale] = useStoredLocale(initialLocale);

  const [workbookState, setWorkbookState] = useState<WorkbookState>({
    status: "idle",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usageRefresh, setUsageRefresh] = useState(0);
  // Tier, allowance and balance. Re-read after every turn so the meter and the
  // row cap follow a sign-in or a top-up without a reload.
  const { me } = useMe(usageRefresh);
  // The "you're on credits now" note is shown once per session, not per call.
  const creditsNoticeShownRef = useRef(false);
  const [agent, setAgent] = useState<{
    phase: AgentPhase;
    step: number;
    progress: { done: number; total: number } | null;
  }>({ phase: "idle", step: 1, progress: null });

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
  const anonRowFloor = rowsAffordable(dailyNeurons("anon"));
  const maxRowsRef = useRef<number>(anonRowFloor);
  maxRowsRef.current = me?.limits.maxRowsPerRun ?? anonRowFloor;
  const meRef = useRef(me);
  meRef.current = me;

  // True while an AI run is in flight or its result dialog is open. Read
  // through a ref because the edit handler is memoized.
  const aiBusyRef = useRef(false);

  const maxRowsError = useCallback((requested: number) => {
    const cap = maxRowsRef.current;
    const me = meRef.current;
    const tier = me?.tier ?? "anon";
    if ((me?.credits.neurons ?? 0) > 0 || me?.daily.neuronsLeft === null)
      return t(localeRef.current, "maxRowsWorkbookError", {
        n: requested.toLocaleString(),
        m: MAX_IMPORT_ROWS.toLocaleString(),
      });
    return tier === "anon"
      ? t(localeRef.current, "maxRowsAnonDailyError", {
          n: requested.toLocaleString(),
          m: cap.toLocaleString(),
        })
      : t(localeRef.current, "maxRowsFreeDailyError", {
          n: requested.toLocaleString(),
          m: cap.toLocaleString(),
        });
  }, []);

  const confirmLargeAiRun = useCallback((rows: number) => {
    if (rows <= LARGE_AI_RUN_ROWS) return true;
    const seconds = Math.ceil(Math.ceil(rows / AI_BATCH_ROWS) * MEASURED_SECONDS_PER_BATCH);
    const minutes = Math.ceil(seconds / 60);
    return window.confirm(
      t(localeRef.current, "largeRunConfirm", {
        c: Math.ceil(minCreditsForRows(rows)).toLocaleString(),
        m: minutes.toLocaleString(),
        s: seconds.toLocaleString(),
      }),
    );
  }, []);

  // A run that came back with holes stops here instead of landing in the sheet:
  // the user decides whether to retry the rows that failed or take what worked.
  // Nothing is written to the grid until that choice is made.
  const [partialPrompt, setPartialPrompt] = useState<{
    total: number;
    failed: number;
    stopped?: ProcessStop;
  } | null>(null);
  const partialResolverRef = useRef<((d: "retry" | "apply") => void) | null>(null);
  const aiBusy = agent.phase !== "idle" || partialPrompt != null;
  aiBusyRef.current = aiBusy;

  const resolvePartial = useCallback((decision: "retry" | "apply") => {
    const resolve = partialResolverRef.current;
    partialResolverRef.current = null;
    setPartialPrompt(null);
    resolve?.(decision);
  }, []);

  const awaitPartialDecision = useCallback(
    (prompt: { total: number; failed: number; stopped?: ProcessStop }) =>
      new Promise<"retry" | "apply">((resolve) => {
        partialResolverRef.current = resolve;
        setPartialPrompt(prompt);
      }),
    [],
  );

  /**
   * Run rows through the AI and, if any come back empty, ask the user before
   * touching the sheet. Retries loop back through the same dialog, so a run can
   * be nursed to completion without re-billing the rows that already worked.
   *
   * Shared by transform_column and filter_rows_ai — the recovery story is the
   * same for both; only what they do with the answers differs.
   */
  const runRowsWithRecovery = useCallback(
    async (
      values: string[],
      instruction: string,
      column: string,
    ): Promise<{ results: ProcessResultItem[]; failedIndices: number[]; stopped?: ProcessStop }> => {
      const onProgress = (done: number, total: number) =>
        setAgent((prev) => ({ ...prev, phase: "processing_rows", progress: { done, total } }));
      const run = (rows: string[]) => {
        onProgress(0, rows.length);
        return processRows(rows, instruction, column, AI_BATCH_ROWS, undefined, {
          action: "download",
          locale: localeRef.current as "en" | "zh",
          onProgress,
        });
      };

      const first = await run(values);
      let results = first.results;
      let failed = first.failedIndices;
      let stopped = first.stopped;

      while (failed.length > 0 || stopped) {
        const decision = await awaitPartialDecision({
          total: values.length,
          failed: failed.length,
          stopped,
        });
        // "apply" is also the only option the dialog offers once the allowance
        // is gone, so this loop always terminates.
        if (decision === "apply") break;
        const idx = failed;
        const retry = await run(idx.map((i) => values[i]));
        results = results.slice();
        retry.results.forEach((r, j) => {
          results[idx[j]] = r;
        });
        failed = retry.failedIndices.map((j) => idx[j]);
        stopped = retry.stopped;
      }
      return { results, failedIndices: failed, stopped };
    },
    [awaitPartialDecision],
  );

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
    resolvePartial("apply"); // settle a dangling result dialog, if any
    lastTurnSnapshotRef.current = null;
    userEditsRef.current = 0;
    setAgent({ phase: "idle", step: 1, progress: null });
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
    resolvePartial("apply");
    lastTurnSnapshotRef.current = null;
    userEditsRef.current = 0;
    setAgent({ phase: "idle", step: 1, progress: null });
    setWorkbookState((prev) => {
      if (prev.status !== "ready" || !prev.workbook.sheets[index]) return prev;
      const grid = gridFromSheet(prev.workbook.sheets[index]);
      gridRef.current = grid;
      return { ...prev, activeSheet: index, grid };
    });
  }, [resolvePartial]);

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
      // Belt to the braces of hiding the affordance below: an AI run computes
      // its target rows before the await and writes them back after, so an edit
      // landing in between would put the outputs on the wrong rows.
      if (aiBusyRef.current) return;
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
      if (values.length > maxRowsRef.current) {
        return {
          ok: false,
          summary: "too many rows",
          data: { error: maxRowsError(values.length) },
        };
      }
      if (!confirmLargeAiRun(values.length)) {
        return {
          ok: false,
          summary: "canceled",
          data: { error: t(localeRef.current, "largeRunCanceled") },
        };
      }
      // `targets` was computed from THIS grid. An AI run takes minutes and now
      // ends in a dialog the user has to think about, so check the sheet is
      // still the same one before writing row-indexed outputs back into it.
      const gridAtStart = grid;
      try {
        const { results, failedIndices } = await runRowsWithRecovery(
          values,
          call.instruction,
          call.column,
        );
        if (gridRef.current !== gridAtStart) {
          return {
            ok: false,
            summary: "sheet changed",
            data: { error: t(localeRef.current, "sheetChangedDuringRun") },
          };
        }
        const current = gridAtStart;
        const name = uniquifyHeader(current.headers, call.newColumnName);
        const outputs = new Array<string>(current.rows.length).fill("");
        targets.forEach((rowIdx, j) => (outputs[rowIdx] = results[j]?.output ?? ""));
        const next = appendColumn(current.headers, current.rows, name, outputs);
        // Remember what the new column was read from. The result below and
        // every later prompt say so, which is the only way the model can know
        // a column is a copy when it later tries to check it "against the source".
        const nextGrid = withLineage(
          { ...current, headers: next.headers, rows: next.rows },
          name,
          { tool: "transform_column", from: [call.column], how: call.instruction },
        );
        setGrid(nextGrid);
        const provenance = transformProvenance(nextGrid, name);
        // Three different empties, and the model needs to tell them apart: a
        // row the AI answered with nothing, a row we never got an answer for,
        // and a row outside the scope.
        const failed = failedIndices.length;
        const failedRows = failedRowNumbers(targets, failedIndices);
        const filled = results.filter((r) => r.output != null).length;
        return {
          ok: true,
          summary:
            failed > 0
              ? `${filled}/${results.length} rows → "${name}" (${failed} failed)`
              : `${filled}/${results.length} rows → "${name}"`,
          data: {
            newColumn: name,
            sourceColumn: provenance.sourceColumn,
            rowsProcessed: results.length,
            rowsFailed: failed,
            scope: call.scope,
            sampleOutputs: results.slice(0, 3).map((r) => r.output),
            ...(failed > 0 && failedRows ? { failedRows } : {}),
            outcome:
              failed > 0
                ? `${failed} of ${results.length} rows could not be processed and were left blank in "${name}"; the user chose to keep the ${filled} rows that worked. Say so. ${retryHint(failedRows)} ${provenance.outcome}`
                : provenance.outcome,
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
    [confirmLargeAiRun, maxRowsError, setGrid, runRowsWithRecovery],
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
      if (values.length > maxRowsRef.current) {
        return {
          ok: false,
          summary: "too many rows",
          data: { error: maxRowsError(values.length) },
        };
      }
      if (!confirmLargeAiRun(values.length)) {
        return {
          ok: false,
          summary: "canceled",
          data: { error: t(localeRef.current, "largeRunCanceled") },
        };
      }
      const gridAtStart = grid;
      try {
        const { results, failedIndices } = await runRowsWithRecovery(
          values,
          `Answer only YES or NO: does this text match the test "${call.criteria}"?`,
          call.column,
        );
        if (gridRef.current !== gridAtStart) {
          return {
            ok: false,
            summary: "sheet changed",
            data: { error: t(localeRef.current, "sheetChangedDuringRun") },
          };
        }
        const matched: number[] = [];
        results.forEach((r, j) => {
          if (/^\s*yes\b/i.test(r.output ?? "")) matched.push(targets[j]);
        });
        const current = gridAtStart;
        let next: GridState =
          call.mode === "select"
            ? { ...current, selectedRows: matched.length ? new Set(matched) : null }
            : { ...current, filterKept: matched };
        if (call.highlight && matched.length) next = paintRows(next, matched, call.highlight);
        setGrid(next);
        const verb = call.mode === "select" ? "selected" : "kept";
        // A row we never got an answer for is not a NO. It falls out of the
        // match set either way, so the model has to say it was undecided
        // rather than reporting it as "did not match".
        const failed = failedIndices.length;
        const judged = results.length - failed;
        const failedRows = failedRowNumbers(targets, failedIndices);
        const scopeNote = only ? ` (within the ${scopeLabel(call)} rows)` : "";
        return {
          ok: true,
          summary:
            failed > 0
              ? `${matched.length} of ${judged} judged rows ${verb} (${failed} undecided)`
              : `${matched.length} of ${results.length} rows ${verb}`,
          data: {
            rowsMatched: matched.length,
            rowsJudged: judged,
            rowsTotal: results.length,
            rowsFailed: failed,
            ...(failedRows ? { failedRows } : {}),
            // The denominator is the rows that actually got an answer, never
            // the rows we set out with: a run that judged 100 of 154 must not
            // read as "154 rows checked".
            outcome:
              (failed > 0
                ? `Only ${judged} of the ${results.length} rows${scopeNote} could be judged; ${failed} rows got no answer at all. `
                : "") +
              matchOutcome({
                matched: matched.length,
                outOf: failed > 0 ? `${judged} judged rows` : `${results.length} rows${scopeNote}`,
                test: `"${call.criteria}" (judged by AI on ${call.column})`,
                mode: call.mode,
                highlight: call.highlight,
              }) +
              (failed > 0
                ? ` The ${failed} unjudged rows were NOT ${verb}, and that is not the same as not matching — they are unchecked, so never report them as verified or as agreeing with the test. Tell the user. ${retryHint(failedRows)}`
                : ""),
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
    [confirmLargeAiRun, maxRowsError, setGrid, runRowsWithRecovery],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (workbookState.status !== "ready" || agent.phase !== "idle") return;
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
      setAgent({ phase: "connecting", step: 1, progress: null });

      try {
        await runAgentTurn({
          history,
          sheetName,
          locale: localeRef.current,
          getGrid: () => gridRef.current!,
          applyTool: (call: ToolCall) => {
            // A wholesale overwrite or a column deletion is put to the user
            // before it lands. The model already had its chance to be precise
            // in validateToolCall; this asks the one party who knows whether
            // the sweep is what they meant.
            const warning = destructiveWarning(call, gridRef.current!);
            if (warning && !window.confirm(warning)) {
              return {
                ok: false,
                summary: t(localeRef.current, "declinedByUser"),
                data: {
                  error:
                    "The user was asked to confirm this change and declined. Do not retry it and do not reach the same result another way. Tell them it was not applied and ask what they want instead.",
                },
              };
            }
            if (call.tool === "transform_column") return runTransform(call);
            if (call.tool === "filter_rows_ai") return runAiFilter(call);
            const { result, nextGrid } = dispatchTool(call, gridRef.current!);
            setGrid(nextGrid);
            return result;
          },
          isStale: () => turnIdRef.current !== turnId,
          emit: (message) => setMessages((prev) => [...prev, message]),
          onStep: (step) => setAgent((prev) => ({
            ...prev,
            phase: process.env.NEXT_PUBLIC_CHAT_STREAMING !== "false"
              ? (step === 1 ? "connecting" : "checking_result")
              : (step === 1 ? "analyzing" : "checking_result"),
            step,
          })),
          onPhase: (phase) => setAgent((prev) => ({ ...prev, phase })),
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
          setAgent({ phase: "idle", step: 1, progress: null });
          if (gridRef.current) {
            lastTurnSnapshotRef.current = snapshotGrid(gridRef.current, userEditsRef.current);
          }
        }
        setUsageRefresh((n) => n + 1);
      }
    },
    [workbookState, agent.phase, messages, setGrid, runTransform, runAiFilter],
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
        <select
          value={locale}
          onChange={(event) => switchLocale(event.target.value as Locale)}
          aria-label={locale === "zh" ? "语言" : locale === "ja" ? "言語" : "Language"}
          className="inline-flex items-center rounded-full border !border-black/15 bg-white px-3 py-1.5 text-xs font-semibold !text-black/70 hover:bg-[#fff3d6]"
        >
          <option value="en">English</option>
          <option value="zh">中文</option>
          <option value="ja">日本語</option>
        </select>
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
            onFile={handleFile}
            onEditCell={aiBusy ? undefined : handleEditCell}
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
            phase={agent.phase}
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
      <PartialResultDialog
        open={partialPrompt != null}
        locale={locale}
        total={partialPrompt?.total ?? 0}
        succeeded={(partialPrompt?.total ?? 0) - (partialPrompt?.failed ?? 0)}
        failed={partialPrompt?.failed ?? 0}
        stopped={partialPrompt?.stopped}
        onRetryFailed={() => resolvePartial("retry")}
        onApplyPartial={() => resolvePartial("apply")}
      />
    </div>
    </LocaleContext.Provider>
  );
}
