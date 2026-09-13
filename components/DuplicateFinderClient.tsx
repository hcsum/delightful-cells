"use client";

import { useCallback, useMemo, useState } from "react";
import FilePicker from "@/components/tools/FilePicker";
import SheetSelect from "@/components/tools/SheetSelect";
import ColumnSelect from "@/components/tools/ColumnSelect";
import {
  parseToolFile,
  downloadSheet,
  findColumnIndex,
  kindLabel,
  truncationNote,
  WorkbookError,
  type ToolWorkbook,
} from "@/lib/tools/workbook";

// Upload first, then pick the column from the file's own headers. Asking for a
// column name before the file is uploaded means guessing at a header we are
// about to read anyway.
export default function DuplicateFinderClient() {
  const [columnName, setColumnName] = useState("");
  // Align with compare-two-columns UI: expose a "Case sensitive" toggle (default off)
  const [caseSensitive, setCaseSensitive] = useState(false);

  const [workbook, setWorkbook] = useState<ToolWorkbook | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const sheet = workbook?.sheets[sheetIndex];
  const headers = useMemo(() => sheet?.headers ?? [], [sheet]);
  const rows = useMemo(() => sheet?.rows ?? [], [sheet]);
  const idx = findColumnIndex(headers, columnName);
  const canProcess = rows.length > 0 && idx >= 0;

  const handleFile = useCallback(async (file: File) => {
    setUploadError(null);
    setDownloadError(null);
    try {
      const wb = await parseToolFile(file);
      setWorkbook(wb);
      setSheetIndex(0);
      setColumnName(wb.sheets[0]?.headers[0] ?? "");
    } catch (e) {
      setWorkbook(null);
      setUploadError(
        e instanceof WorkbookError
          ? e.message
          : `Couldn't read that file: ${String((e as any)?.message || e)}`,
      );
    }
  }, []);

  const onSheetChange = useCallback(
    (index: number) => {
      setSheetIndex(index);
      setDownloadError(null);
      setColumnName(workbook?.sheets[index]?.headers[0] ?? "");
    },
    [workbook],
  );

  const onDownload = useCallback(async () => {
    if (!canProcess || !workbook || !sheet) return;
    setDownloadError(null);

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
    const out = rows.map((r) => {
      const k = norm(r?.[idx] ?? "");
      return [...r, k !== "" && (counts.get(k) || 0) > 1 ? "True" : ""];
    });

    try {
      await downloadSheet(
        workbook,
        sheet.name,
        [...headers, newHeader],
        out,
        newHeader,
      );
    } catch (e) {
      setDownloadError(
        `Couldn't write the file: ${String((e as any)?.message || e)}`,
      );
    }
  }, [canProcess, workbook, sheet, rows, headers, idx, columnName, caseSensitive]);

  const field =
    "bg-transparent border border-white/10 rounded px-3 py-2 text-base md:text-lg disabled:opacity-60";
  const truncated = truncationNote(sheet);

  return (
    <div className="space-y-6">
      {/* Upload first */}
      <section className="space-y-2 mt-4 md:mt-6">
        <h3 className="text-lg font-semibold">Upload your Excel file</h3>
        <div className="text-sm text-white/90 space-y-1">
          <div>Drop in an .xlsx, .xls, or .csv — no converting needed.</div>
          <div>All processing happens in your browser. No data is sent to a server.</div>
        </div>
        <FilePicker
          tone="dark"
          onFile={handleFile}
          hint="Excel or CSV. Max 20 MB."
          info={
            workbook && sheet
              ? `${workbook.fileName} · ${rows.length.toLocaleString()} rows · ${headers.length} columns`
              : null
          }
        />
        {workbook && workbook.sheets.length > 1 ? (
          <div className="pt-2">
            <SheetSelect
              sheetNames={workbook.sheets.map((s) => s.name)}
              value={sheetIndex}
              onChange={onSheetChange}
              className={field}
              labelClassName="text-base md:text-lg font-medium"
            />
          </div>
        ) : null}
        {truncated ? <p className="text-xs text-white/60">{truncated}</p> : null}
        {uploadError ? (
          <p className="text-sm text-red-400">{uploadError}</p>
        ) : null}
      </section>

      {/* Then pick the column */}
      <section className="space-y-2 pt-2">
        <div className="flex flex-wrap gap-3 md:gap-4 items-center">
          <label className="text-base md:text-lg font-medium">
            Find duplicates in
          </label>
          <ColumnSelect
            headers={headers}
            value={columnName}
            onChange={setColumnName}
            className={field}
            emptyLabel="upload a file to pick a column"
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
      </section>

      {/* Process / Download */}
      {canProcess ? (
        <section className="space-y-3">
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-3">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-black font-semibold shadow-md hover:bg-white/90 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                onClick={onDownload}
              >
                <span>Process &amp; download {kindLabel(workbook!.kind)}</span>
              </button>
              <span className="text-xs text-white/60">
                Download includes all original columns plus one new duplicates column.
              </span>
            </div>
            {downloadError ? (
              <p className="text-sm text-red-400">{downloadError}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
