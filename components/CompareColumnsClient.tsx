"use client";

import Papa from "papaparse";
import { useCallback, useMemo, useRef, useState } from "react";
import { MAX_FILE_BYTES } from "@/lib/limits";

type Row = string[];

const HARD_LIMITS = {
  maxFileBytes: MAX_FILE_BYTES,
  maxRows: 5001, // 5000 data rows + 1 header row
} as const;

type Mode = "duplicates" | "missing" | "matches";

export default function CompareColumnsClient() {
  // Form controls
  const [colA, setColA] = useState("");
  const [colB, setColB] = useState("");
  const [mode, setMode] = useState<Mode>("duplicates");
  const [caseSensitive, setCaseSensitive] = useState(false); // default off

  // Upload/parse state
  const [uploadRows, setUploadRows] = useState<Row[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helpers
  const canProcess = useMemo(() => {
    if (!uploadRows.length) return false;
    if (!colA.trim() || !colB.trim()) return false;
    const header = uploadRows[0] || [];
    const iA = findColumnIndex(header, colA);
    const iB = findColumnIndex(header, colB);
    return iA >= 0 && iB >= 0;
  }, [uploadRows, colA, colB]);

  const handleFile = useCallback(
    (file: File) => {
      setUploadError(null);
      if (!colA.trim() || !colB.trim()) {
        setUploadError(
          "Please fill 'Column A', 'Column B', and 'Comparison Type' before selecting a CSV file.",
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
          const iA = findColumnIndex(header, colA);
          const iB = findColumnIndex(header, colB);
          if (iA < 0 || iB < 0) {
            const list = header.join(", ") || "(none)";
            setUploadError(
              `Column not found. Available columns: ${list}. Ensure both column names match the CSV header exactly (case-insensitive).`,
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
    [colA, colB],
  );

  const onDownload = useCallback(() => {
    if (!canProcess) return;
    const header = uploadRows[0] || [];
    const rows = uploadRows.slice(1);
    const iA = findColumnIndex(header, colA);
    const iB = findColumnIndex(header, colB);
    if (iA < 0 || iB < 0) return;

    // Normalizer: trim and optionally lowercase depending on case sensitivity
    const norm = (v: unknown) => {
      const s = (v ?? "").toString().trim();
      return caseSensitive ? s : s.toLowerCase();
    };

    // Build lookup of Column B values -> count
    const bCounts = new Map<string, number>();
    for (const r of rows) {
      const v = norm(r?.[iB] ?? "");
      if (v === "") continue; // ignore empty values in Column B for comparisons
      if (!bCounts.has(v)) bCounts.set(v, 1);
      else bCounts.set(v, (bCounts.get(v) || 0) + 1);
    }

    const newHeaderLabel = makeNewHeaderLabel(mode, colA.trim(), colB.trim());
    const out: string[][] = [];
    out.push([...header, newHeaderLabel]);

    for (const r of rows) {
      const aVal = norm(r?.[iA] ?? "");
      let mark = "";
      if (mode === "missing") {
        const count = bCounts.get(aVal) || 0;
        if (count === 0) mark = "True"; // value from A not present in B
      } else if (mode === "matches") {
        // matches: same-row equality between Column A and Column B (with case toggle)
        const bVal = norm(r?.[iB] ?? "");
        if (aVal === bVal && bVal !== "") mark = "True";
      } else {
        // duplicates: mark True when value from A exists in B (>= 1 occurrence)
        const count = bCounts.get(aVal) || 0;
        if (count >= 1) mark = "True";
      }
      out.push([...r, mark]);
    }

    const csv = Papa.unparse(out);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = (uploadedFileName || "download.csv").replace(/\.csv$/i, "");
    a.href = url;
    a.download = `${base}-with-${kebab(newHeaderLabel)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }, [canProcess, uploadRows, colA, colB, mode, uploadedFileName, caseSensitive]);


  return (
    <div className="space-y-6">
      {/* Input pattern: Compare [A] to [B] for [Type] */}
      <section className="space-y-2 mt-4 md:mt-6">
        <div className="flex flex-wrap gap-3 md:gap-4 items-center">
          <label className="text-base md:text-lg font-medium">Compare</label>
          <input
            value={colA}
            onChange={(e) => setColA(e.target.value)}
            className="bg-transparent border border-white/10 rounded px-3 py-2 text-base md:text-lg"
            placeholder="Column A (header name)"
          />
          <label className="text-base md:text-lg font-medium">to</label>
          <input
            value={colB}
            onChange={(e) => setColB(e.target.value)}
            className="bg-transparent border border-white/10 rounded px-3 py-2 text-base md:text-lg"
            placeholder="Column B (header name)"
          />
          <label className="text-base md:text-lg font-medium">for</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="bg-transparent border border-white/10 rounded px-3 py-2 text-base md:text-lg"
          >
            <option value="duplicates">duplicates</option>
            <option value="matches">matches</option>
            <option value="missing">missing items</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <input
            id="caseSensitiveToggle"
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          <label htmlFor="caseSensitiveToggle" className="text-sm md:text-base">Case sensitive</label>
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
                Download includes all original columns plus one new comparison column.
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

function makeNewHeaderLabel(m: Mode, a: string, b: string): string {
  if (m === "missing") return `missing_items_${a}_${b}`;
  if (m === "matches") return `matches_${a}_${b}`;
  return `duplicates_${a}_${b}`;
}

function kebab(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
