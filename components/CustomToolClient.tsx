"use client";

import Papa from "papaparse";
import { useAuth } from "@/lib/auth/useAuth";
import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import type { SVGProps } from "react";
import { useForm } from "react-hook-form";
import { processRows } from "@/lib/process";
import LoginPromptDialog from "@/components/LoginPromptDialog";
//

type FormValues = {
  target: string;
  source: string;
};

type Row = string[];
const HARD_LIMITS = { maxFileBytes: 2 * 1024 * 1024, previewRows: 3 } as const;

export default function CustomToolClient({ initialTarget = "", initialSource = "" }: { initialTarget?: string; initialSource?: string }) {
  const { isAuthenticated, isLoading, signInWithGoogle, user } = useAuth();
  const form = useForm<FormValues>({
    defaultValues: { target: initialTarget, source: initialSource },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });
  const { register, watch, setError, clearErrors, formState: { errors }, getValues } = form;

  const target = watch('target');
  const source = watch('source');

  const promptTemplate = useMemo(() => {
    if (!target || !source) return '';
    return `From the following ${source} text, extract ${target}.\nIf not found, return null.`;
  }, [target, source]);

  const validatePrompt = (ctx?: { headers?: string[]; action: 'preview'|'download' }) => {
    const { target: tgtRaw, source: srcRaw } = getValues();
    const tgt = (tgtRaw || '').trim();
    const src = (srcRaw || '').trim();
    let ok = true;
    if (!tgt || !src) {
      setError('target', { message: 'Please fill both fields (Extract … from …)' });
      setError('source', { message: 'Please fill both fields (Extract … from …)' });
      ok = false;
    }
    if (ok && ctx?.headers) {
      const headers = ctx.headers.map((h) => h?.toString().trim().toLowerCase());
      const idx = headers.indexOf(src.toLowerCase());
      if (idx < 0) {
        setError('source', { message: `Column "${src}" not found in headers.` });
        ok = false;
      }
    }
    if (ok) clearErrors();
    return ok;
  };

  // --- Merged Tool logic begins ---
  const mode = 'custom' as const;
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  // Upload flow state
  const [uploadRows, setUploadRows] = useState<Row[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadErrorRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  // Preview / processing
  const [previewResults, setPreviewResults] = useState<{ input: string; output: string | null }[]>([]);
  const [previewInputsSnap, setPreviewInputsSnap] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [completedCount, setCompletedCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => { uploadErrorRef.current = uploadError; }, [uploadError]);

  const canProcess = useMemo(() => {
    if (uploadRows.length === 0) return false;
    if (uploadError) return false;
    const extractFromTrimmed = (source || '').trim();
    const toBeExtractedTrimmed = (target || '').trim();
    if (mode === 'custom' && (!extractFromTrimmed || !toBeExtractedTrimmed)) return false;
    const header = uploadRows[0] || [];
    const columnNameTrimmed = (source || '').trim();
    if (!columnNameTrimmed) return false;
    const idx = findColumnIndex(header, columnNameTrimmed);
    return idx >= 0;
  }, [uploadRows, uploadError, source, target]);

  useEffect(() => {
    const extractFromTrimmed = (source || '').trim();
    const toBeExtractedTrimmed = (target || '').trim();
    if (extractFromTrimmed && toBeExtractedTrimmed && uploadError?.includes("Please fill in both")) setUploadError(null);
  }, [source, target, uploadError]);

  useEffect(() => {
    if (uploadRows.length > 0) {
      const header = uploadRows[0] || [];
      const columnNameTrimmed = (source || '').trim();
      if (columnNameTrimmed) {
        const idx = findColumnIndex(header, columnNameTrimmed);
        if (idx >= 0) {
          const currentError = uploadErrorRef.current;
          if (currentError && typeof currentError === 'string' && currentError.includes("Column") && currentError.includes("not found")) setUploadError(null);
        } else {
          const expectedError = `Column "${columnNameTrimmed}" not found in CSV headers. Available columns: ${header.join(', ') || '(none)'}`;
          setUploadError(expectedError);
        }
      }
    }
  }, [source, uploadRows]);

  const handleFile = useCallback((file: File) => {
    if (!isAuthenticated) { setShowLoginPrompt(true); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    setUploadError(null); setProcessError(null);
    const extractFromTrimmed = (source || '').trim();
    const toBeExtractedTrimmed = (target || '').trim();
    if (!extractFromTrimmed || !toBeExtractedTrimmed) { setUploadError("Please fill in both 'Extract' and 'From' fields before selecting a CSV file."); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    const nameOK = file.name.toLowerCase().endsWith(".csv");
    const typeOK = !file.type || file.type.includes("csv");
    if (!(nameOK || typeOK)) { setUploadError("Please upload a .csv file."); return; }
    if (file.size > HARD_LIMITS.maxFileBytes) { setUploadError("File too large. Max 2 MB."); return; }
    setUploadedFileName(file.name);
    setPreviewResults([]); setPreviewInputsSnap([]); setPreviewError(null); setPreviewFailed(false);
    Papa.parse<string[]>(file, {
      delimiter: ",",
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (res) => {
        const raw = (res.data as unknown as string[][]) || [];
        const sanitized = raw.map((r) => (Array.isArray(r) ? r : []));
        setUploadRows(sanitized);
        if (sanitized.length > 0) {
          const header = sanitized[0] || [];
          const idx = findColumnIndex(header, source || '');
          if (idx < 0) { setUploadError(`Column "${source || ''}" not found in CSV headers. Available columns: ${header.join(', ') || '(none)'}`); return; }
          setUploadError((prevError) => { if (prevError && typeof prevError === 'string' && prevError.includes("Column") && prevError.includes("not found")) return null; return prevError; });
        }
      },
      error: (err) => { setUploadError(`Failed to parse CSV: ${err.message || String(err)}`); },
    });
  }, [isAuthenticated, source, target]);

  const runPreviewFromUpload = useCallback(() => {
    setPreviewResults([]); setPreviewError(null); setPreviewFailed(false);
    if (!isAuthenticated) { setShowLoginPrompt(true); return; }
    if (uploadRows.length === 0) { setPreviewError('Please upload a CSV first.'); return; }
    if (validatePrompt) { const header0 = uploadRows[0] || []; const ok0 = validatePrompt({ headers: header0, action: 'preview' }); if (!ok0) { setPreviewResults([]); setPreviewInputsSnap([]); return; } }
    const header = uploadRows[0] || [];
    const dataRows = uploadRows.slice(1);
    const sample = dataRows.slice(0, HARD_LIMITS.previewRows);
    const idx = findColumnIndex(header, source || '');
    if (idx < 0) { setUploadError(`Column "${source || ''}" not found in CSV headers. Available columns: ${header.join(', ') || '(none)'}`); setPreviewResults([]); setPreviewInputsSnap([]); return; }
    const inputs = sample.map((r) => (r?.[idx] ?? '').toString());
    setPreviewInputsSnap(inputs);
    if (inputs.length === 0) { setPreviewResults([]); return; }
    setPreviewLoading(true); setPreviewError(null);
    processRows(inputs, target || '', source || '', 5, undefined, { action: 'preview', userKey: user?.email || undefined })
      .then((res) => { setPreviewResults(res); setPreviewFailed(false); })
      .catch((e) => { if ((e as any)?.name === 'AbortError') return; setPreviewError(String((e as any)?.message || 'Request failed')); setPreviewFailed(true); })
      .finally(() => { setPreviewLoading(false); });
  }, [uploadRows, isAuthenticated, validatePrompt, source, target, user?.email]);

  const onDownload = useCallback(async () => {
    if (validatePrompt) { const header0 = uploadRows[0] || []; const ok = validatePrompt({ headers: header0, action: 'download' }); if (!ok) return; }
    if (!uploadRows.length) return;
    setDownloading(true);
    try {
      const header0 = uploadRows[0] ?? [];
      const idx0 = findColumnIndex(header0, source || '');
      const total = Math.max(0, uploadRows.length - 1);
      let allowedRows = total;
      try {
        const qRes = await fetch('/api/quota', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requested: total }) });
        if (qRes.status === 401) { setShowLoginPrompt(true); setDownloading(false); setPendingCount(null); setCompletedCount(null); setTotalCount(null); return; }
        if (qRes.ok) {
          const q = await qRes.json().catch(() => null as any);
          const remaining = Number(q?.remaining ?? 0) || 0;
          const requested = Number(q?.requested ?? total) || total;
          const calcAllowed = Math.max(0, Math.min(remaining, requested));
          if (Number.isFinite(calcAllowed)) allowedRows = calcAllowed;
          if (allowedRows === 0) { setProcessError(`Daily row limit reached. Try again tomorrow.`); setDownloading(false); setPendingCount(null); setCompletedCount(null); setTotalCount(null); return; }
          if (allowedRows < total) { const ok2 = window.confirm(`You have ${remaining} rows remaining today, but this file has ${total} rows. Process the first ${allowedRows} rows now?`); if (!ok2) { setDownloading(false); setPendingCount(null); setCompletedCount(null); setTotalCount(null); return; } }
        }
      } catch {}
      if (idx0 >= 0 && total > 0) { setPendingCount(allowedRows); setCompletedCount(0); setTotalCount(allowedRows); }
    } catch { setPendingCount(null); }
    setUploadError(null); setProcessError(null);
    const header = uploadRows[0] ?? [];
    const desiredLabel = (target || inferDefaultLabelFromPrompt(promptTemplate)).trim() || 'Extracted';
    const finalLabel = uniquifyHeaderLabel(header, desiredLabel);
    const outRows: string[][] = []; outRows.push([...header, finalLabel]);
    const idx = findColumnIndex(header, source || '');
    if (idx < 0) { setDownloading(false); setUploadError(`Column "${source || ''}" not found in CSV headers. Available columns: ${header.join(', ') || '(none)'}`); return; }
    const inputsAll = uploadRows.slice(1).map((r) => (r?.[idx] ?? '').toString());
    let allowedNow = typeof (window as any).__allowedRowsTmp === 'number' ? Number((window as any).__allowedRowsTmp) : undefined;
    if (!Number.isFinite(allowedNow)) allowedNow = Number(pendingCount ?? inputsAll.length);
    const inputs = Array.isArray(inputsAll) ? inputsAll.slice(0, Math.max(0, Math.min(inputsAll.length, Number(allowedNow)))) : [];
    let results: { input: string; output: string | null }[];
    try {
      const batchSize = 50;
      results = await processRows(inputs, target || '', source || '', batchSize, undefined, { action: 'download', userKey: user?.email || undefined, onProgress: (completed, total) => { setPendingCount(total - completed); setCompletedCount(completed); setTotalCount(total); } });
    } catch (e) { setDownloading(false); setPendingCount(null); setCompletedCount(null); setTotalCount(null); setProcessError(String((e as any)?.message || 'Request failed')); return; }
    for (let i = 0; i < results.length; i++) { const orig = uploadRows[i + 1] || []; const extracted = results[i]?.output ?? ''; outRows.push([...orig, extracted]); }
    const csv = Papa.unparse(outRows); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); const base = (uploadedFileName || 'download.csv').replace(/\.csv$/i, ''); a.href = url; a.download = `${base}-with-${kebab(finalLabel)}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    setDownloading(false); setPendingCount(null); setCompletedCount(null); setTotalCount(null);
  }, [uploadRows, source, target, promptTemplate, uploadedFileName, validatePrompt, user?.email, pendingCount]);

  // Render UI
  return (
    <>
      {isAuthenticated && (
        <section className="space-y-2 mt-4 md:mt-6">
          <div className="flex flex-wrap gap-3 md:gap-4 items-center">
            <label className="text-base md:text-lg font-medium">Extract</label>
            <input
              {...register('target')}
              className="bg-transparent border border-white/10 rounded px-3 py-2 text-base md:text-lg"
              placeholder="TARGET (e.g., state, SKU, email)"
            />
            <label className="text-base md:text-lg font-medium">From</label>
            <input
              {...register('source')}
              className="bg-transparent border border-white/10 rounded px-3 py-2 text-base md:text-lg"
              placeholder="SOURCE (e.g., address, text, description)"
            />
          </div>
          {errors.target?.message || errors.source?.message ? (
            <p className="text-sm text-red-400">{errors.source?.message || errors.target?.message}</p>
          ) : null}
        </section>
      )}
      <div className="space-y-6">
        <section className="space-y-2 pt-6">
          <h3 className="text-lg font-semibold">Upload CSV</h3>
          <div className="text-sm text-white/90 space-y-1">
            <div>1. Export or save your Excel file as CSV.</div>
            <div>2. Select the CSV file.</div>
            <div>We don't store your file. The file is sent anonymously to the AI model for processing.</div>
          </div>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <p className="text-xs text-white/60">CSV only. Max size 2 MB.</p>
          </div>
          <div className="space-y-2 pt-2">
            <button className="px-3 py-1 rounded bg-white/10 disabled:opacity-60 inline-flex items-center gap-2" onClick={runPreviewFromUpload} disabled={previewLoading || !canProcess}>
              {previewLoading ? <SpinnerIcon className="h-4 w-4" /> : null}
              <span>{previewLoading ? '' : (previewFailed ? 'Retry Preview' : 'Preview')}</span>
            </button>
            {previewError && <div className="text-sm text-red-400">{previewError}</div>}
            {previewInputsSnap.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="text-white/80">
                    <tr>
                      <th className="border-b border-white/10 text-left p-2">Original value</th>
                      <th className="border-b border-white/10 text-left p-2">Extracted value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewInputsSnap.map((value, idx) => (
                      <tr key={idx} className="odd:bg-white/5">
                        <td className="align-top p-2 whitespace-pre-wrap">{value}</td>
                        <td className="align-top p-2 whitespace-pre-wrap">{previewLoading ? <Skeleton className="w-28" /> : (previewResults[idx]?.output ?? 'null')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {uploadError && uploadRows.length === 0 ? <p className="text-sm text-red-400">{uploadError}</p> : null}

        {(uploadRows.length > 0) && (
          <section className="space-y-3">
            {uploadError ? (
              <div className="text-sm text-red-400">{uploadError}</div>
            ) : canProcess ? (
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-3">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-black font-semibold shadow-md hover:bg-white/90 disabled:opacity-70 disabled:cursor-not-allowed transition-colors" onClick={onDownload} disabled={downloading}>
                    {downloading ? <SpinnerIcon className="h-4 w-4" /> : null}
                    <span>{downloading ? 'Processing…' : 'Process CSV'}</span>
                  </button>
                  <span className="text-xs text-white/60">Download includes all original columns plus a new extracted column.</span>
                </div>
                {downloading ? (
                  <div className="w-full space-y-1">
                    <div className="h-1 w-full rounded bg-white/10 overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-white/10 via-white/70 to-white/10 animate-pulse" />
                    </div>
                    <div className="text-xs text-white/60">{totalCount != null && completedCount != null ? `Processing ${completedCount}/${totalCount} rows…` : (pendingCount != null ? `Processing ${Math.max(0, (totalCount ?? 0) - pendingCount)}/${totalCount ?? '…'} rows…` : 'Processing…')}</div>
                  </div>
                ) : null}
                {processError && (<div className="text-sm text-red-400">{processError}</div>)}
              </div>
            ) : null}
          </section>
        )}
      </div>
    </>
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

// Helper: produce a default label from the prompt if none is provided
function inferDefaultLabelFromPrompt(promptTemplate: string): string {
  const lower = (promptTemplate || '').toLowerCase();
  if (lower.includes('state')) return 'State';
  if (lower.includes('city')) return 'City';
  if (lower.includes('number')) return 'Numbers';
  if (lower.includes('text')) return 'Text';
  return 'Extracted';
}

function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" strokeWidth="4" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 rounded bg-white/10 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

function uniquifyHeaderLabel(header: string[], desired: string): string {
  const exists = new Set(header.map((h) => (h || '').trim().toLowerCase()));
  let label = desired;
  if (exists.has(desired.trim().toLowerCase())) {
    const alt1 = `Extracted ${desired}`;
    if (!exists.has(alt1.trim().toLowerCase())) return alt1;
    const alt2 = `${desired} (Extracted)`;
    if (!exists.has(alt2.trim().toLowerCase())) return alt2;
    let i = 2;
    while (exists.has(`${desired} (Extracted ${i})`.toLowerCase())) i++;
    return `${desired} (Extracted ${i})`;
  }
  return label;
}

function kebab(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}
