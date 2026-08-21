"use client";

import Papa from "papaparse";
import { useCallback, useMemo, useRef, useState } from "react";
import type { SVGProps } from "react";
import { useForm } from "react-hook-form";
import { processRows } from "@/lib/process";

type FormValues = {
  target: string;
  source: string;
};

type Row = string[];
const HARD_LIMITS = { maxFileBytes: 2 * 1024 * 1024, previewRows: 3 } as const;

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

  const target = watch("target");
  const source = watch("source");

  const [uploadRows, setUploadRows] = useState<Row[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
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

  const headers = uploadRows[0] ?? [];
  const dataRowCount = Math.max(0, uploadRows.length - 1);
  const sourceIdx = findColumnIndex(headers, source || "");
  const canProcess =
    uploadRows.length > 1 &&
    (target || "").trim() !== "" &&
    sourceIdx >= 0;

  const handleFile = useCallback(
    (file: File) => {
      setUploadError(null);
      setProcessError(null);
      setPreviewResults([]);
      setPreviewInputsSnap([]);
      setPreviewError(null);
      setPreviewFailed(false);
      const nameOK = file.name.toLowerCase().endsWith(".csv");
      const typeOK = !file.type || file.type.includes("csv");
      if (!(nameOK || typeOK)) {
        setUploadError("Please upload a .csv file.");
        return;
      }
      if (file.size > HARD_LIMITS.maxFileBytes) {
        setUploadError("File too large. Max 2 MB.");
        return;
      }
      setUploadedFileName(file.name);
      Papa.parse<string[]>(file, {
        delimiter: ",",
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (res) => {
          const raw = (res.data as unknown as string[][]) || [];
          const sanitized = raw.map((r) => (Array.isArray(r) ? r : []));
          if (sanitized.length < 2) {
            setUploadError("That CSV looks empty — no data rows found.");
            return;
          }
          setUploadRows(sanitized);
          // Keep a prefilled source column if it exists; otherwise default
          // to the first column so the dropdown always holds a valid pick.
          const header = sanitized[0] ?? [];
          if (findColumnIndex(header, source || "") < 0) {
            setValue("source", header[0] ?? "");
          }
        },
        error: (err) => {
          setUploadError(`Failed to parse CSV: ${err.message || String(err)}`);
        },
      });
    },
    [source, setValue],
  );

  const runPreviewFromUpload = useCallback(() => {
    setPreviewResults([]);
    setPreviewError(null);
    setPreviewFailed(false);
    if (!canProcess) return;
    const sample = uploadRows.slice(1, 1 + HARD_LIMITS.previewRows);
    const inputs = sample.map((r) => (r?.[sourceIdx] ?? "").toString());
    setPreviewInputsSnap(inputs);
    if (inputs.length === 0) return;
    setPreviewLoading(true);
    processRows(inputs, (target || "").trim(), (source || "").trim(), 5, undefined, {
      action: "preview",
    })
      .then((res) => {
        setPreviewResults(res);
        setPreviewFailed(false);
      })
      .catch((e) => {
        if ((e as any)?.name === "AbortError") return;
        setPreviewError(String((e as any)?.message || "Request failed"));
        setPreviewFailed(true);
      })
      .finally(() => setPreviewLoading(false));
  }, [canProcess, uploadRows, sourceIdx, source, target]);

  const onDownload = useCallback(async () => {
    if (!canProcess) return;
    setDownloading(true);
    setUploadError(null);
    setProcessError(null);

    const total = dataRowCount;
    let allowedRows = total;
    try {
      const qRes = await fetch("/api/quota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requested: total }),
      });
      if (qRes.ok) {
        const q = await qRes.json().catch(() => null as any);
        const remaining = Number(q?.remaining ?? 0) || 0;
        const requested = Number(q?.requested ?? total) || total;
        const calcAllowed = Math.max(0, Math.min(remaining, requested));
        if (Number.isFinite(calcAllowed)) allowedRows = calcAllowed;
        if (allowedRows === 0) {
          setProcessError("Daily row limit reached. Try again tomorrow.");
          setDownloading(false);
          return;
        }
        if (allowedRows < total) {
          const ok2 = window.confirm(
            `You have ${remaining} rows remaining today, but this file has ${total} rows. Process the first ${allowedRows} rows now?`,
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

    const desiredLabel = (target || "").trim() || "Extracted";
    const finalLabel = uniquifyHeaderLabel(headers, desiredLabel);
    const inputs = uploadRows
      .slice(1, 1 + allowedRows)
      .map((r) => (r?.[sourceIdx] ?? "").toString());

    let results: { input: string; output: string | null }[];
    try {
      results = await processRows(
        inputs,
        (target || "").trim(),
        (source || "").trim(),
        50,
        undefined,
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
      setProcessError(String((e as any)?.message || "Request failed"));
      return;
    }

    const outRows: string[][] = [[...headers, finalLabel]];
    for (let i = 0; i < results.length; i++) {
      const orig = uploadRows[i + 1] || [];
      outRows.push([...orig, results[i]?.output ?? ""]);
    }
    const csv = Papa.unparse(outRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = (uploadedFileName || "download.csv").replace(/\.csv$/i, "");
    a.href = url;
    a.download = `${base}-with-${kebab(finalLabel)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    setDownloading(false);
    setCompletedCount(null);
    setTotalCount(null);
  }, [canProcess, dataRowCount, headers, uploadRows, sourceIdx, source, target, uploadedFileName]);

  const pill =
    "rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-6 mt-4 md:mt-6">
      {/* 1. Upload — no prerequisites */}
      <section className="rounded-[28px] border !border-black/10 bg-[#fffaf0] p-5">
        <h3 className="text-lg font-extrabold">1. Upload your CSV 📄</h3>
        <p className="mt-1 text-sm text-black/55">
          Export your Excel sheet as CSV, then drop it here. Max 2 MB. We don't
          store your file.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onClick={(e) => {
              (e.currentTarget as HTMLInputElement).value = "";
            }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`${pill} text-black`}
            style={{
              border: "3px solid transparent",
              background:
                "linear-gradient(#fffaf0,#fffaf0) padding-box, linear-gradient(90deg,#ff0080,#ff8c00,#ffd500,#00c853,#00b0ff,#7c4dff,#ff0080) border-box",
            }}
          >
            Choose a file
          </button>
          {uploadedFileName && uploadRows.length > 1 && (
            <span className="text-sm font-semibold text-black/70">
              {uploadedFileName} · {dataRowCount} rows · {headers.length} columns
            </span>
          )}
        </div>
        {uploadError && (
          <p className="mt-3 rounded-2xl bg-[#ffe6ef] px-4 py-2 text-sm font-semibold text-[#b3003c]">
            {uploadError}
          </p>
        )}
      </section>

      {/* 2. What to extract — column picker appears once we know the columns */}
      <section className="rounded-[28px] border !border-black/10 bg-[#fffaf0] p-5">
        <h3 className="text-lg font-extrabold">2. What should the AI extract? 🪄</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-bold">Extract</label>
          <input
            {...register("target")}
            className="rounded-full border !border-black/15 bg-white px-4 py-2 text-sm text-black placeholder:text-black/35 focus:!border-black/40 focus:outline-none"
            placeholder="e.g. state, SKU, email"
          />
          <label className="text-sm font-bold">from column</label>
          {uploadRows.length > 1 ? (
            <select
              {...register("source")}
              className="rounded-full border !border-black/15 bg-white px-4 py-2 text-sm text-black focus:!border-black/40 focus:outline-none"
            >
              {headers.map((h, i) => (
                <option key={i} value={h}>
                  {h || `(column ${i + 1})`}
                </option>
              ))}
            </select>
          ) : (
            <input
              {...register("source")}
              className="rounded-full border !border-black/15 bg-white px-4 py-2 text-sm text-black placeholder:text-black/35 focus:!border-black/40 focus:outline-none"
              placeholder="upload a file to pick a column"
            />
          )}
        </div>
        {uploadRows.length <= 1 && (
          <p className="mt-2 text-xs text-black/45">
            Upload a file above and this becomes a dropdown of your actual columns.
          </p>
        )}
      </section>

      {/* 3. Preview & process */}
      <section className="rounded-[28px] border !border-black/10 bg-[#fffaf0] p-5">
        <h3 className="text-lg font-extrabold">3. Preview, then run ✨</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className={`${pill} bg-[#fff3d6] text-black hover:bg-[#ffe89a] inline-flex items-center gap-2`}
            onClick={runPreviewFromUpload}
            disabled={previewLoading || !canProcess}
          >
            {previewLoading ? <SpinnerIcon className="h-4 w-4" /> : null}
            <span>{previewFailed ? "Retry preview" : "Preview first 3 rows"}</span>
          </button>
          <button
            className={`${pill} bg-black text-[#fffdf8] hover:opacity-80 inline-flex items-center gap-2`}
            onClick={onDownload}
            disabled={downloading || !canProcess}
          >
            {downloading ? <SpinnerIcon className="h-4 w-4" /> : null}
            <span>{downloading ? "Processing…" : "Process & download CSV"}</span>
          </button>
          {!canProcess && (
            <span className="text-xs text-black/45">
              {uploadRows.length <= 1
                ? "Upload a CSV to get started."
                : !(target || "").trim()
                  ? "Tell the AI what to extract."
                  : "Pick a source column."}
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
                    Original value
                  </th>
                  <th className="border-b !border-black/10 bg-[#fff3d6] text-left p-2 font-bold">
                    Extracted value
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
                ? `Processing ${completedCount}/${totalCount} rows…`
                : "Processing…"}
            </div>
          </div>
        )}
        {processError && (
          <p className="mt-3 text-sm font-semibold text-[#b3003c]">{processError}</p>
        )}
        <p className="mt-3 text-xs text-black/45">
          The download includes all original columns plus the new extracted
          column. Free tier: 300 rows per day.
        </p>
      </section>
    </div>
  );
}

// Helper: case-insensitive exact header match
function findColumnIndex(header: string[], name: string): number {
  if (!name) return -1;
  const norm = (s: string) => s?.toString().trim().toLowerCase();
  const target = norm(name);
  for (let i = 0; i < header.length; i++) {
    if (norm(header[i]) === target) return i;
  }
  return -1;
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

function kebab(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
