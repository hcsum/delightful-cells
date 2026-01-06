"use client";

import Papa from "papaparse";
import { useCallback, useMemo, useRef, useState } from "react";

type Row = string[];

const HARD_LIMITS = {
  maxFileBytes: 20 * 1024 * 1024, // 20 MB
  maxRows: 5001, // 5000 data rows + 1 header row
} as const;

export default function DuplicateFinderClient() {
  // Inputs
  const [columnName, setColumnName] = useState("");
  // Align with compare-two-columns UI: expose a "Case sensitive" toggle (default off)
  const [caseSensitive, setCaseSensitive] = useState(false);

  // Upload state
  const [uploadRows, setUploadRows] = useState<Row[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canProcess = useMemo(() => {
    if (!uploadRows.length) return false;
    const header = uploadRows[0] || [];
    const idx = findColumnIndex(header, columnName);
    return idx >= 0;
  }, [uploadRows, columnName]);

  const handleFile = useCallback(
    (file: File) => {
      setUploadError(null);
      if (!columnName.trim()) {
        setUploadError(
          "Please fill the column name before selecting a CSV file.",
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const nameOK = file.name.toLowerCase().endsWith(".csv");
      const typeOK = !file.type || file.type.includes("csv");
      if (!(nameOK || typeOK)) {
        setUploadError("Please upload a .csv file.");
        return;
      }
      if (file.size > HARD_LIMITS.maxFileBytes) {
        setUploadError("File too large. Max 20 MB.");
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
          if (sanitized.length === 0) {
            setUploadError("CSV appears empty.");
            setUploadRows([]);
            return;
          }
          if (sanitized.length > HARD_LIMITS.maxRows) {
            setUploadError(
              `Too many rows. Max supported is ${HARD_LIMITS.maxRows - 1} data rows plus 1 header row.`,
            );
            setUploadRows([]);
            return;
          }
          const header = sanitized[0] || [];
          const idx = findColumnIndex(header, columnName);
          if (idx < 0) {
            const list = header.join(", ") || "(none)";
            setUploadError(
              `Column not found. Available columns: ${list}. Ensure the column name matches the CSV header exactly (case-insensitive).`,
            );
            setUploadRows([]);
            return;
          }
          setUploadRows(sanitized);
        },
        error: (err) => {
          setUploadError(`Failed to parse CSV: ${err.message || String(err)}`);
        },
      });
    },
    [columnName],
  );

  const onDownload = useCallback(() => {
    if (!canProcess) return;
    const header = uploadRows[0] || [];
    const rows = uploadRows.slice(1);
    const idx = findColumnIndex(header, columnName);
    if (idx < 0) return;

    const norm = (v: unknown) => {
      const s = (v ?? "").toString().trim();
      return caseSensitive ? s : s.toLowerCase();
    };

    // Count normalized, non-empty values in the target column
    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = norm(r?.[idx] ?? "");
      if (k === "") continue; // ignore empty/null-like
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    const newHeader = `duplicates_${(columnName || "").trim()}`;
    const out: string[][] = [];
    out.push([...header, newHeader]);
    for (const r of rows) {
      const k = norm(r?.[idx] ?? "");
      const mark = k !== "" && (counts.get(k) || 0) > 1 ? "True" : "";
      out.push([...r, mark]);
    }

    const csv = Papa.unparse(out);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = (uploadedFileName || "download.csv").replace(/\.csv$/i, "");
    a.href = url;
    a.download = `${base}-with-${kebab(newHeader)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }, [canProcess, uploadRows, columnName, uploadedFileName, caseSensitive]);

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <section className="space-y-2 mt-4 md:mt-6">
        <div className="flex flex-wrap gap-3 md:gap-4 items-center">
          <label className="text-base md:text-lg font-medium">Find duplicates in</label>
          <input
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            className="bg-transparent border border-white/10 rounded px-3 py-2 text-base md:text-lg"
            placeholder="Column name (header)"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <input
            id="caseSensitiveDupToggle"
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          <label htmlFor="caseSensitiveDupToggle" className="text-sm md:text-base">Case sensitive</label>
        </div>
        {uploadError ? (
          <p className="text-sm text-red-400">{uploadError}</p>
        ) : null}
      </section>

      {/* Upload CSV */}
      <section className="space-y-2 pt-2">
        <h3 className="text-lg font-semibold">Upload CSV</h3>
        <div className="text-sm text-white/90 space-y-1">
          <div>1. Export or save your Excel file as CSV.</div>
          <div>2. Select the CSV file.</div>
          <div>All processing happens in your browser. No data is sent to a server.</div>
        </div>
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onClick={(e) => {
              (e.currentTarget as HTMLInputElement).value = "";
            }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <p className="text-xs text-white/60">CSV only. Max 20 MB. Max 5000 data rows.</p>
        </div>
      </section>

      {/* Process / Download */}
      {uploadRows.length > 0 && canProcess ? (
        <section className="space-y-3">
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-3">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-black font-semibold shadow-md hover:bg-white/90 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                onClick={onDownload}
              >
                <span>Process CSV</span>
              </button>
              <span className="text-xs text-white/60">
                Download includes all original columns plus one new duplicates column.
              </span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

// Helper: case-insensitive exact header match (trimmed)
function findColumnIndex(header: string[], name: string): number {
  if (!name) return -1;
  const norm = (s: string) => s?.toString().trim().toLowerCase();
  const target = norm(name);
  for (let i = 0; i < header.length; i++) {
    if (norm(header[i]) === target) return i;
  }
  return -1;
}

function kebab(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
