"use client";

import { useCallback, useRef, useState } from "react";
import type { SVGProps } from "react";
import { useForm } from "react-hook-form";
import { processRows } from "@/lib/process";
import type { ProcessResultItem, ProcessStop } from "@/lib/process";
import { AI_BATCH_ROWS, dailyNeurons, rowsAffordable } from "@/lib/limits";
import PartialResultDialog from "@/components/PartialResultDialog";
import FilePicker from "@/components/tools/FilePicker";
import SheetSelect from "@/components/tools/SheetSelect";
import ColumnSelect from "@/components/tools/ColumnSelect";
import { useT } from "@/lib/cells/locale";
import {
  parseToolFile,
  downloadSheet,
  findColumnIndex,
  kindLabel,
  truncationNote,
  WorkbookError,
  type ToolWorkbook,
} from "@/lib/tools/workbook";

type FormValues = {
  target: string;
  source: string;
};

/**
 * A finished run that has not been downloaded yet, because it came back with
 * holes. `results` is index-aligned with `inputs`, so a retry of the failed
 * rows can be merged straight back in.
 */
type PendingRun = {
  inputs: string[];
  results: ProcessResultItem[];
  failedIndices: number[];
  stopped?: ProcessStop;
  finalLabel: string;
};

const PREVIEW_ROWS = 3;

// Flow: upload first (no prerequisites), see your columns, pick the source
// column from a dropdown, say what to extract, preview 3 rows, process.
export default function CustomToolClient({
  initialTarget = "",
  initialSource = "",
}: {
  initialTarget?: string;
  initialSource?: string;
}) {
  const form = useForm<FormValues>({
    defaultValues: { target: initialTarget, source: initialSource },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });
  const { register, watch, setValue } = form;
  const t = useT();

  const target = watch("target");
  const source = watch("source");

  const [workbook, setWorkbook] = useState<ToolWorkbook | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<
    { input: string; output: string | null }[]
  >([]);
  const [previewInputsSnap, setPreviewInputsSnap] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [completedCount, setCompletedCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  // A run that came back with holes. Held here instead of downloaded, so the
  // user decides whether to retry the failed rows or take what worked.
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(null);
  const [retrying, setRetrying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sheet = workbook?.sheets[sheetIndex];
  const headers = sheet?.headers ?? [];
  const dataRows = sheet?.rows ?? [];
  const dataRowCount = dataRows.length;
  const sourceIdx = findColumnIndex(headers, source || "");
  const canProcess =
    dataRowCount > 0 && (target || "").trim() !== "" && sourceIdx >= 0;
  const outputKind = workbook?.kind ?? "xlsx";

  const clearResults = useCallback(() => {
    setProcessError(null);
    setPreviewResults([]);
    setPreviewInputsSnap([]);
    setPreviewError(null);
    setPreviewFailed(false);
  }, []);

  // Keep a prefilled source column if the file happens to have it; otherwise
  // fall back to the first column so the dropdown always holds a valid pick.
  const ensureValidSource = useCallback(
    (nextHeaders: string[]) => {
      if (findColumnIndex(nextHeaders, source || "") < 0) {
        setValue("source", nextHeaders[0] ?? "");
      }
    },
    [source, setValue],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      clearResults();
      try {
        const wb = await parseToolFile(file);
        setWorkbook(wb);
        setSheetIndex(0);
        ensureValidSource(wb.sheets[0]?.headers ?? []);
      } catch (e) {
        setWorkbook(null);
        setUploadError(
          e instanceof WorkbookError
            ? e.message
            : `Couldn't read that file: ${String((e as any)?.message || e)}`,
        );
      }
    },
    [clearResults, ensureValidSource],
  );

  const onSheetChange = useCallback(
    (index: number) => {
      setSheetIndex(index);
      clearResults();
      ensureValidSource(workbook?.sheets[index]?.headers ?? []);
    },
    [workbook, clearResults, ensureValidSource],
  );

  const runPreviewFromUpload = useCallback(() => {
    setPreviewResults([]);
    setPreviewError(null);
    setPreviewFailed(false);
    if (!canProcess) return;
    const inputs = dataRows
      .slice(0, PREVIEW_ROWS)
      .map((r) => (r?.[sourceIdx] ?? "").toString());
    setPreviewInputsSnap(inputs);
    if (inputs.length === 0) return;
    setPreviewLoading(true);
    processRows(inputs, (target || "").trim(), (source || "").trim(), 5, undefined, {
      action: "preview",
    })
      .then((res) => {
        // A preview is three rows: anything short of all three is a failure
        // worth showing, not a partial result worth keeping.
        if (res.stopped || res.failedIndices.length > 0) {
          setPreviewError(res.stopped?.message || t("ctRequestFailed"));
          setPreviewFailed(true);
          return;
        }
        setPreviewResults(res.results);
        setPreviewFailed(false);
      })
      .catch((e) => {
        setPreviewError(String((e as any)?.message || t("ctRequestFailed")));
        setPreviewFailed(true);
      })
      .finally(() => setPreviewLoading(false));
  }, [canProcess, dataRows, sourceIdx, source, target, t]);

  const downloadRun = useCallback(
    async (run: PendingRun) => {
      if (!workbook || !sheet) return;
      // Bounded by the file, NOT by how many rows the AI got to. A run capped
      // by the daily allowance, or cut short by a failure, still has to hand
      // back every original row — dropping them turns a partial extraction into
      // data loss.
      const outRows = dataRows.map((r, i) => [
        ...r,
        run.results[i]?.output ?? "",
      ]);
      try {
        await downloadSheet(
          workbook,
          sheet.name,
          [...headers, run.finalLabel],
          outRows,
          run.finalLabel,
        );
      } catch (e) {
        setProcessError(
          `Couldn't write the file: ${String((e as any)?.message || e)}`,
        );
      }
    },
    [workbook, sheet, dataRows, headers],
  );

  const onDownload = useCallback(async () => {
    if (!canProcess) return;
    setDownloading(true);
    setUploadError(null);
    setProcessError(null);

    // Ask the server what this visitor is allowed right now. For free users
    // this is today's remaining allowance; for credits it is the import cap.
    const total = dataRowCount;
    // Fall back to the anonymous daily floor: if /api/me is unreachable we
    // would rather truncate the run than have the server reject it.
    let maxRows: number = rowsAffordable(dailyNeurons("anon"));
    let allowedRows = Math.min(total, maxRows);
    try {
      const meRes = await fetch("/api/me");
      if (meRes.ok) {
        const me = await meRes.json();
        maxRows = Number(me?.limits?.maxRowsPerRun) || maxRows;
        allowedRows = Math.max(0, Math.min(total, maxRows));
        if (allowedRows === 0) {
          setProcessError(
            me?.tier === "anon"
              ? t("ctDailyLimitAnon")
              : t("ctDailyLimitFree"),
          );
          setDownloading(false);
          return;
        }
        if (allowedRows < total) {
          const ok2 = window.confirm(
            t("ctPartialRunConfirm", { allowed: allowedRows, total }),
          );
          if (!ok2) {
            setDownloading(false);
            return;
          }
        }
      }
    } catch {}

    setCompletedCount(0);
    setTotalCount(allowedRows);

    const desiredLabel = (target || "").trim() || t("ctDefaultColumn");
    const finalLabel = uniquifyHeaderLabel(headers, desiredLabel);
    const inputs = dataRows
      .slice(0, allowedRows)
      .map((r) => (r?.[sourceIdx] ?? "").toString());

    const ac = new AbortController();
    abortRef.current = ac;
    let outcome;
    try {
      outcome = await processRows(
        inputs,
        (target || "").trim(),
        (source || "").trim(),
        AI_BATCH_ROWS,
        ac.signal,
        {
          action: "download",
          onProgress: (completed) => {
            setCompletedCount(completed);
            setTotalCount(allowedRows);
          },
        },
      );
    } catch (e) {
      setDownloading(false);
      setCompletedCount(null);
      setTotalCount(null);
      setProcessError(String((e as any)?.message || t("ctRequestFailed")));
      return;
    } finally {
      abortRef.current = null;
    }

    setDownloading(false);
    setCompletedCount(null);
    setTotalCount(null);

    const run: PendingRun = {
      inputs,
      results: outcome.results,
      failedIndices: outcome.failedIndices,
      stopped: outcome.stopped,
      finalLabel,
    };
    // A clean run downloads without asking. Anything else is the user's call.
    if (!run.stopped && run.failedIndices.length === 0) void downloadRun(run);
    else setPendingRun(run);
  }, [canProcess, dataRowCount, headers, dataRows, sourceIdx, source, target, downloadRun, t]);

  const onCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const onRetryFailed = useCallback(async () => {
    const run = pendingRun;
    if (!run || run.failedIndices.length === 0) return;
    setRetrying(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const idx = run.failedIndices;
    let outcome;
    try {
      outcome = await processRows(
        idx.map((i) => run.inputs[i]),
        (target || "").trim(),
        (source || "").trim(),
        AI_BATCH_ROWS,
        ac.signal,
        { action: "download" },
      );
    } catch (e) {
      setRetrying(false);
      setProcessError(String((e as any)?.message || t("ctRequestFailed")));
      return;
    } finally {
      abortRef.current = null;
      setRetrying(false);
    }
    // Merge back at the original positions; the retry only ever saw a subset.
    const results = run.results.slice();
    outcome.results.forEach((r, j) => { results[idx[j]] = r; });
    const next: PendingRun = {
      ...run,
      results,
      failedIndices: outcome.failedIndices.map((j) => idx[j]),
      stopped: outcome.stopped,
    };
    if (!next.stopped && next.failedIndices.length === 0) {
      setPendingRun(null);
      void downloadRun(next);
    } else {
      setPendingRun(next);
    }
  }, [pendingRun, source, target, downloadRun, t]);

  const onApplyPartial = useCallback(() => {
    if (!pendingRun) return;
    void downloadRun(pendingRun);
    setPendingRun(null);
  }, [pendingRun, downloadRun]);

  const pill =
    "rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const field =
    "rounded-full border !border-black/15 bg-white px-4 py-2 text-sm text-black placeholder:text-black/35 focus:!border-black/40 focus:outline-none disabled:opacity-60";
  const truncated = truncationNote(sheet);

  return (
    <div className="space-y-6 mt-4 md:mt-6">
      {/* 1. Upload — no prerequisites */}
      <section className="rounded-[28px] border !border-black/10 bg-[#fffaf0] p-5">
        <h3 className="text-lg font-extrabold">{t("ctUploadStep")}</h3>
        <p className="mt-1 text-sm text-black/55">{t("ctUploadDesc")}</p>
        <div className="mt-3">
          <FilePicker
            onFile={handleFile}
            info={
              workbook && sheet
                ? t("ctFileInfo", {
                    name: workbook.fileName,
                    rows: dataRowCount.toLocaleString(),
                    cols: headers.length,
                  })
                : null
            }
          />
        </div>
        {workbook && workbook.sheets.length > 1 && (
          <div className="mt-3">
            <SheetSelect
              sheetNames={workbook.sheets.map((s) => s.name)}
              value={sheetIndex}
              onChange={onSheetChange}
              className={field}
              labelClassName="text-sm font-bold"
            />
          </div>
        )}
        {truncated && (
          <p className="mt-3 text-xs text-black/45">{truncated}</p>
        )}
        {uploadError && (
          <p className="mt-3 rounded-2xl bg-[#ffe6ef] px-4 py-2 text-sm font-semibold text-[#b3003c]">
            {uploadError}
          </p>
        )}
      </section>

      {/* 2. What to extract — column picker appears once we know the columns */}
      <section className="rounded-[28px] border !border-black/10 bg-[#fffaf0] p-5">
        <h3 className="text-lg font-extrabold">{t("ctExtractStep")}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-bold">{t("ctExtractLabel")}</label>
          <input
            {...register("target")}
            className={field}
            placeholder={t("ctTargetPlaceholder")}
          />
          <label className="text-sm font-bold">{t("ctFromColumn")}</label>
          <ColumnSelect
            headers={headers}
            value={source || ""}
            onChange={(v) => setValue("source", v)}
            className={field}
            emptyLabel={t("ctPickColumnEmpty")}
          />
        </div>
        {headers.length === 0 && (
          <p className="mt-2 text-xs text-black/45">{t("ctColumnHint")}</p>
        )}
      </section>

      {/* 3. Preview & process */}
      <section className="rounded-[28px] border !border-black/10 bg-[#fffaf0] p-5">
        <h3 className="text-lg font-extrabold">{t("ctRunStep")}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className={`${pill} bg-[#fff3d6] text-black hover:bg-[#ffe89a] inline-flex items-center gap-2`}
            onClick={runPreviewFromUpload}
            disabled={previewLoading || !canProcess}
          >
            {previewLoading ? <SpinnerIcon className="h-4 w-4" /> : null}
            <span>{previewFailed ? t("ctRetryPreview") : t("ctPreviewBtn")}</span>
          </button>
          <button
            className={`${pill} bg-black text-[#fffdf8] hover:opacity-80 inline-flex items-center gap-2`}
            onClick={onDownload}
            disabled={downloading || !canProcess}
          >
            {downloading ? <SpinnerIcon className="h-4 w-4" /> : null}
            <span>
              {downloading
                ? t("ctProcessing")
                : t("ctProcessDownload", { kind: kindLabel(outputKind) })}
            </span>
          </button>
          {downloading && (
            <button
              className={`${pill} border !border-black/15 bg-white text-black hover:bg-black/5`}
              onClick={onCancel}
            >
              {t("ctCancel")}
            </button>
          )}
          {!canProcess && (
            <span className="text-xs text-black/45">
              {dataRowCount === 0
                ? t("ctNeedFile")
                : !(target || "").trim()
                  ? t("ctNeedTarget")
                  : t("ctNeedColumn")}
            </span>
          )}
        </div>

        {previewError && (
          <p className="mt-3 text-sm font-semibold text-[#b3003c]">{previewError}</p>
        )}
        {previewInputsSnap.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-2xl border !border-black/10 bg-white">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="border-b !border-black/10 bg-[#fff3d6] text-left p-2 font-bold">
                    {t("ctOriginalValue")}
                  </th>
                  <th className="border-b !border-black/10 bg-[#fff3d6] text-left p-2 font-bold">
                    {t("ctExtractedValue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewInputsSnap.map((value, idx) => (
                  <tr key={idx} className={idx % 2 === 1 ? "bg-[#fffaf0]" : ""}>
                    <td className="align-top p-2 whitespace-pre-wrap text-black/80">
                      {value}
                    </td>
                    <td className="align-top p-2 whitespace-pre-wrap text-black/80">
                      {previewLoading ? (
                        <Skeleton className="w-28" />
                      ) : (
                        (previewResults[idx]?.output ?? "null")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {downloading && (
          <div className="mt-3 space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width:
                    totalCount && completedCount != null
                      ? `${Math.round((completedCount / totalCount) * 100)}%`
                      : "10%",
                  background:
                    "linear-gradient(90deg,#ff0080,#ff8c00,#ffd500,#00c853,#00b0ff,#7c4dff)",
                }}
              />
            </div>
            <div className="text-xs text-black/55">
              {totalCount != null && completedCount != null
                ? t("ctProgressRows", { d: completedCount, t: totalCount })
                : t("ctProcessing")}
            </div>
            <div className="text-[11px] font-medium text-black/40">
              {t("processingBatchHint")}
            </div>
          </div>
        )}
        {processError && (
          <p className="mt-3 text-sm font-semibold text-[#b3003c]">{processError}</p>
        )}
        <p className="mt-3 text-xs text-black/45">
          {t("ctDownloadNote", {
            anon: rowsAffordable(dailyNeurons("anon")).toLocaleString(),
            free: rowsAffordable(dailyNeurons("free")).toLocaleString(),
          })}
        </p>
      </section>
      <PartialResultDialog
        open={pendingRun != null}
        total={pendingRun?.inputs.length ?? 0}
        succeeded={
          (pendingRun?.inputs.length ?? 0) - (pendingRun?.failedIndices.length ?? 0)
        }
        failed={pendingRun?.failedIndices.length ?? 0}
        stopped={pendingRun?.stopped}
        busy={retrying}
        onRetryFailed={onRetryFailed}
        onApplyPartial={onApplyPartial}
      />
    </div>
  );
}

function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" strokeWidth="4" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 rounded bg-black/10 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

function uniquifyHeaderLabel(header: string[], desired: string): string {
  const exists = new Set(header.map((h) => (h || "").trim().toLowerCase()));
  if (exists.has(desired.trim().toLowerCase())) {
    const alt1 = `Extracted ${desired}`;
    if (!exists.has(alt1.trim().toLowerCase())) return alt1;
    const alt2 = `${desired} (Extracted)`;
    if (!exists.has(alt2.trim().toLowerCase())) return alt2;
    let i = 2;
    while (exists.has(`${desired} (Extracted ${i})`.toLowerCase())) i++;
    return `${desired} (Extracted ${i})`;
  }
  return desired;
}
