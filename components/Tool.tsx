"use client";

import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { processRows } from "@/lib/process";

type Extractor = (input: string) => string | null;

export type ToolProps = {
  title?: string; // for display on the widget
  mode: "predefined" | "custom";
  promptTemplate: string; // display only (system prompt preview)
  toBeExtracted: string; // what to extract (passed to worker)
  extractFrom: string; // what to extract from (passed to worker)
  extractor: Extractor; // local preview extractor (placeholder for AI)
  outputLabel?: string; // base name for the appended column in downloads, e.g. "State"
  validatePrompt?: (ctx?: { headers?: string[]; action: 'preview' | 'download' }) => boolean; // optional validation for placeholders and header match
  sourceHeader?: string; // desired source column header from the "from" field
};

type Row = string[];

const HARD_LIMITS = {
  maxFileBytes: 2 * 1024 * 1024, // 2MB
  maxRows: 1000,
  maxCols: 20,
  previewRows: 10,
};

const PASTE_MAX_ROWS = 4; // including header

export default function Tool({ title, mode, promptTemplate, toBeExtracted, extractFrom, extractor, outputLabel, validatePrompt, sourceHeader }: ToolProps) {
  // Paste flow state
  const [pasted, setPasted] = useState<string>("");
  const [pasteRows, setPasteRows] = useState<Row[]>([]);
  const [pasteColumns, setPasteColumns] = useState<number>(0);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Upload flow state
  const [uploadRows, setUploadRows] = useState<Row[]>([]);
  const [uploadColumns, setUploadColumns] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadErrorRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    uploadErrorRef.current = uploadError;
  }, [uploadError]);

  // Check if Process CSV button should be shown
  const canProcess = useMemo(() => {
    if (uploadRows.length === 0) return false;
    if (uploadError) return false;
    
    const extractFromTrimmed = (extractFrom || '').trim();
    const toBeExtractedTrimmed = (toBeExtracted || '').trim();
    
    // In custom mode, both fields must be filled
    if (mode === 'custom' && (!extractFromTrimmed || !toBeExtractedTrimmed)) {
      return false;
    }
    
    // Check if column exists in headers
    const header = uploadRows[0] || [];
    const columnName = mode === 'custom' ? (sourceHeader || '') : extractFrom;
    const columnNameTrimmed = (columnName || '').trim();
    if (!columnNameTrimmed) {
      return false;
    }
    
    const idx = findColumnIndex(header, columnNameTrimmed);
    return idx >= 0;
  }, [uploadRows, uploadError, mode, extractFrom, toBeExtracted, sourceHeader]);

  // Preview state (calls real worker; no heuristic). Runs only when user clicks Load Preview.
  const [previewResults, setPreviewResults] = useState<{ input: string; output: string | null }[]>([]);
  const [previewInputsSnap, setPreviewInputsSnap] = useState<string[]>([]); // snapshot of inputs used for last preview run
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pasteInfo, setPasteInfo] = useState<string | null>(null);

  // Log the prompt in console (no UI display per requirement)
  useEffect(() => {
    if (promptTemplate) {
      // eslint-disable-next-line no-console
      console.log('[Tool] Prompt template:', promptTemplate, 'mode:', mode);
    }
  }, [promptTemplate, mode]);

  // Clear error when fields become valid in custom mode
  useEffect(() => {
    if (mode === 'custom') {
      const extractFromTrimmed = (extractFrom || '').trim();
      const toBeExtractedTrimmed = (toBeExtracted || '').trim();
      // If both fields are now filled and there's an error about missing fields, clear it
      if (extractFromTrimmed && toBeExtractedTrimmed && uploadError?.includes("Please fill in both")) {
        setUploadError(null);
      }
    }
  }, [mode, extractFrom, toBeExtracted, uploadError]);

  // Re-validate headers when extractFrom changes and a file is already loaded
  useEffect(() => {
    // Re-validate if there's a file loaded
    if (uploadRows.length > 0) {
      const header = uploadRows[0] || [];
      const columnName = mode === 'custom' ? (sourceHeader || '') : extractFrom;
      const columnNameTrimmed = (columnName || '').trim();
      if (columnNameTrimmed) {
        const idx = findColumnIndex(header, columnNameTrimmed);
        
        if (idx >= 0) {
          // Column is found, clear column-related errors
          const currentError = uploadErrorRef.current;
          if (currentError && typeof currentError === 'string' && currentError.includes("Column") && currentError.includes("not found")) {
            setUploadError(null);
          }
        } else {
          // Column not found, set/update error message
          const expectedError = `Column "${columnNameTrimmed}" not found in CSV headers. Available columns: ${header.join(', ') || '(none)'}`;
          setUploadError(expectedError);
        }
      }
      // If column name is empty, keep existing "Column not found" error (don't clear it)
    }
  }, [mode, extractFrom, sourceHeader, uploadRows]);

  const clearPaste = useCallback(() => {
    setPasteRows([]);
    setPasteColumns(0);
    setPasteError(null);
    setPasted("");
    setPasteInfo(null);
    setPreviewResults([]);
    setPreviewInputsSnap([]);
    setPreviewError(null);
    setPreviewFailed(false);
    setPreviewLoading(false);
  }, []);

  const clearUpload = useCallback(() => {
    setUploadRows([]);
    setUploadColumns(0);
    setUploadError(null);
    setUploadedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFile = useCallback((file: File) => {
    setUploadError(null);
    
    // In custom mode, require both extractFrom and toBeExtracted to be set
    if (mode === 'custom') {
      const extractFromTrimmed = (extractFrom || '').trim();
      const toBeExtractedTrimmed = (toBeExtracted || '').trim();
      if (!extractFromTrimmed || !toBeExtractedTrimmed) {
        setUploadError("Please fill in both 'Extract' and 'From' fields before selecting a CSV file.");
        // Clear file input so the same file can be selected again after filling fields
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }
    
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
        const sanitized = raw
          .slice(0, HARD_LIMITS.maxRows)
          .map((r) => (Array.isArray(r) ? r.slice(0, HARD_LIMITS.maxCols) : []));
        const maxCols = sanitized.reduce((m, r) => Math.max(m, r.length), 0);
        
        // Always set uploadRows so re-validation can run when column name changes
        setUploadRows(sanitized);
        setUploadColumns(maxCols);
        
        // Validate headers - check if required column exists
        if (sanitized.length > 0) {
          const header = sanitized[0] || [];
          const columnName = mode === 'custom' ? (sourceHeader || '') : extractFrom;
          const idx = findColumnIndex(header, columnName);
          if (idx < 0) {
            setUploadError(`Column "${columnName}" not found in CSV headers. Available columns: ${header.join(', ') || '(none)'}`);
            return;
          }
          // Column found, clear any column-related errors
          setUploadError((prevError) => {
            if (prevError && typeof prevError === 'string' && prevError.includes("Column") && prevError.includes("not found")) {
              return null;
            }
            return prevError;
          });
        }
      },
      error: (err) => {
        setUploadError(`Failed to parse CSV: ${err.message || String(err)}`);
      },
    });
  }, [mode, sourceHeader, extractFrom, toBeExtracted]);

  const loadPaste = useCallback(() => {
    setPasteError(null);
    // Clear previous preview immediately when user initiates a new run
    setPreviewResults([]);
    setPreviewError(null);
    setPreviewFailed(false);
    // Trigger prompt validation even before parsing, so empty fields show errors below inputs.
    if (validatePrompt) {
      const ok0 = validatePrompt({ action: 'preview' });
      if (!ok0) {
        // Do not proceed to call worker if basic placeholders are invalid
        return;
      }
    }
    const trimmed = pasted.trim();
    if (!trimmed) {
      setPasteError("Please paste up to 4 CSV rows, with the first row as headers.");
      return;
    }
    const parsed = Papa.parse<string[]>(trimmed, {
      delimiter: ",",
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    const data = (parsed.data as unknown as string[][]) || [];
    if (data.length === 0) {
      setPasteError("No rows detected. Include a header row.");
      return;
    }
    const sanitized = data.map((r) => (Array.isArray(r) ? r.slice(0, HARD_LIMITS.maxCols) : []));
    const truncated = sanitized.length > PASTE_MAX_ROWS;
    const used = truncated ? sanitized.slice(0, PASTE_MAX_ROWS) : sanitized;
    const maxCols = used.reduce((m, r) => Math.max(m, r.length), 0);
    setPasteRows(used);
    setPasteColumns(maxCols);
    setPasteInfo(truncated ? `Pasted ${sanitized.length} rows; showing first ${PASTE_MAX_ROWS} (header included).` : null);
    let ok = true;
    if (validatePrompt) {
      const header = used[0] || [];
      ok = validatePrompt({ headers: header, action: 'preview' });
      if (!ok) {
        setPreviewResults([]);
        setPreviewInputsSnap([]);
        return;
      }
    }
    // Build preview inputs snapshot
    const header = used[0] || [];
    const dataRows = used.slice(1);
    const sample = dataRows.slice(0, HARD_LIMITS.previewRows);
    const columnName = mode === 'custom' ? (sourceHeader || '') : extractFrom;
    const idx = findColumnIndex(header, columnName);
    if (idx < 0) {
      setPasteError(`Column "${columnName}" not found in CSV headers. Available columns: ${header.join(', ') || '(none)'}`);
      setPreviewResults([]);
      setPreviewInputsSnap([]);
      return;
    }
    const inputs = sample.map((r) => (r?.[idx] ?? "").toString());
    setPreviewInputsSnap(inputs);
    // Only run the worker when user clicks button; this handler is the click.
    if (inputs.length === 0) {
      setPreviewResults([]);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    processRows(inputs, toBeExtracted, extractFrom, 10, undefined, { action: 'preview' })
      .then((res) => {
        setPreviewResults(res);
        setPreviewFailed(false);
      })
      .catch((e) => {
        if ((e as any)?.name === 'AbortError') {
          // ignore
        } else {
          const ee: any = e || {};
          const isRateLimited = ee?.status === 429 && (ee?.code === 'rate_limited' || /rate limit/i.test(String(ee?.message || '')));
          const msg = isRateLimited ? String(ee?.message || 'Rate limit exceeded. Please try again soon.') : 'Something went wrong. Please try again.';
          setPreviewError(msg);
          setPreviewFailed(true);
        }
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  }, [pasted, mode, sourceHeader, extractFrom, promptTemplate, validatePrompt]);

  // Column selectors removed; keep counts for internal layout if needed.

  const onDownload = useCallback(async () => {
    if (validatePrompt) {
      const header0 = uploadRows[0] || [];
      const ok = validatePrompt({ headers: header0, action: 'download' });
      if (!ok) return;
    }
    if (!uploadRows.length) return;
    setDownloading(true);
    setUploadError(null);
    // Assume first row is header for download construction.
    const header = uploadRows[0] ?? [];
    const desiredLabel = (outputLabel || inferDefaultLabelFromPrompt(promptTemplate)).trim() || 'Extracted';
    const finalLabel = uniquifyHeaderLabel(header, desiredLabel);

    const outRows: string[][] = [];
    outRows.push([...header, finalLabel]);

    // Build inputs and call generic CF Worker function
    const columnName = mode === 'custom' ? (sourceHeader || '') : extractFrom;
    const idx = findColumnIndex(header, columnName);
    if (idx < 0) {
      setDownloading(false);
      setUploadError(`Column "${columnName}" not found in CSV headers. Available columns: ${header.join(', ') || '(none)'}`);
      return;
    }
    const inputs = uploadRows.slice(1).map((r) => (r?.[idx] ?? '').toString());
    // Use API response only; do not fallback to client extraction on failure
    let results: { input: string; output: string | null }[];
    try {
      results = await processRows(inputs, toBeExtracted, extractFrom, 10, undefined, { action: 'download' });
    } catch (e) {
      setDownloading(false);
      const ee: any = e || {};
      const isRateLimited = ee?.status === 429 && (ee?.code === 'rate_limited' || /rate limit/i.test(String(ee?.message || '')));
      const msg = isRateLimited ? String(ee?.message || 'Rate limit exceeded. Please try again soon.') : 'Something went wrong. Please try again.';
      setUploadError(msg);
      return;
    }

    for (let i = 0; i < results.length; i++) {
      const orig = uploadRows[i + 1] || [];
      const extracted = results[i]?.output ?? '';
      outRows.push([...orig, extracted]);
    }

    const csv = Papa.unparse(outRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = (uploadedFileName || 'download.csv').replace(/\.csv$/i, '');
    a.href = url;
    a.download = `${base}-with-${kebab(finalLabel)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    setDownloading(false);
  }, [uploadRows, extractor, outputLabel, promptTemplate, uploadedFileName, mode, validatePrompt, sourceHeader, extractFrom]);

function findColumnIndex(header: string[], name: string): number {
  if (!name) return -1;
  const norm = (s: string) => s?.toString().trim().toLowerCase();
  const target = norm(name);
  for (let i = 0; i < header.length; i++) {
    if (norm(header[i]) === target) return i;
  }
  return -1;
}

  return (
    <div className="space-y-6">
      {/* Title prop intentionally removed from UI per request */}

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Paste Sample Rows</h3>
        <div className="text-sm text-white/90 space-y-1">
          <div>1. Export your Excel file as CSV.</div>
          <div>2. Open the CSV with a plain text editor.</div>
          <div>3. Copy the first few lines and paste below.</div>
        </div>
        <p className="text-xs text-white/60">Paste up to 4 CSV rows (first row is headers), extra rows will be ignored. This helps you verify extraction quality before uploading a file.</p>
        <div className="space-y-2">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={5}
            className="w-full rounded border border-white/10 bg-transparent p-2"
            placeholder="Paste up to 4 CSV rows (first row is headers)"
          />
          {null}
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded bg-white/10 disabled:opacity-60 inline-flex items-center gap-2"
              onClick={loadPaste}
              disabled={previewLoading}
            >
              {previewLoading ? <SpinnerIcon className="h-4 w-4" /> : null}
              <span>{previewLoading ? '' : (previewFailed ? 'Retry' : 'Preview')}</span>
            </button>
            <button className="px-3 py-1 rounded bg-white/10" onClick={clearPaste}>Clear</button>
          </div>
        </div>

        {pasteError ? <p className="text-sm text-red-400">{pasteError}</p> : null}

        {pasteRows.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              {/* Removed extra helper lines per request */}
              {/* Loading text removed; the button shows spinner and cells show skeletons while loading */}
              {previewError && <div className="text-sm text-red-400">{previewError}</div>}
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
                        <td className="align-top p-2 whitespace-pre-wrap">
                          {previewLoading ? <Skeleton className="w-28" /> : (previewResults[idx]?.output ?? 'null')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2 pt-6">
        <h3 className="text-lg font-semibold">Upload CSV</h3>
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <p className="text-xs text-white/60">CSV only. Max size 2 MB. Up to 1,000 rows and 20 columns.</p>
        </div>
      </section>

      {uploadError && uploadRows.length === 0 ? <p className="text-sm text-red-400">{uploadError}</p> : null}

      {(uploadRows.length > 0) && (
        <section className="space-y-3">
          {uploadError ? (
            <div className="text-sm text-red-400">{uploadError}</div>
          ) : canProcess ? (
            <div className="flex items-center gap-3 pt-2">
              <button className="px-3 py-1 rounded bg-white/10 text-sm disabled:opacity-60" onClick={onDownload} disabled={downloading}>
                {downloading ? 'Processing…' : 'Process CSV'}
              </button>
              <span className="text-xs text-white/60">Download includes all original columns plus a new extracted column.</span>
            </div>
          ) : null}
      </section>
    )}
  </div>
  );
}

function SpinnerIcon(props: React.SVGProps<SVGSVGElement>) {
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

function safeExtract(fn: Extractor, value: string): string | null {
  try {
    const out = fn(value ?? "");
    return out ?? null;
  } catch {
    return null;
  }
}

function inferDefaultLabelFromPrompt(promptTemplate: string): string {
  // Very small heuristic; not critical because pages pass outputLabel.
  const lower = (promptTemplate || '').toLowerCase();
  if (lower.includes('state')) return 'State';
  if (lower.includes('city')) return 'City';
  if (lower.includes('number')) return 'Numbers';
  if (lower.includes('text')) return 'Text';
  return 'Extracted';
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
