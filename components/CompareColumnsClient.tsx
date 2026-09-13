"use client";

import { useCallback, useMemo, useState } from "react";
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

type Mode = "duplicates" | "missing" | "matches";

// Upload first, then pick both columns from the file's own headers.
export default function CompareColumnsClient() {
  const t = useT();
  const [colA, setColA] = useState("");
  const [colB, setColB] = useState("");
  const [mode, setMode] = useState<Mode>("duplicates");
  const [caseSensitive, setCaseSensitive] = useState(false); // default off

  const [workbook, setWorkbook] = useState<ToolWorkbook | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const sheet = workbook?.sheets[sheetIndex];
  const headers = useMemo(() => sheet?.headers ?? [], [sheet]);
  const rows = useMemo(() => sheet?.rows ?? [], [sheet]);
  const iA = findColumnIndex(headers, colA);
  const iB = findColumnIndex(headers, colB);
  const canProcess = rows.length > 0 && iA >= 0 && iB >= 0;

  // Two columns are being compared, so default to the first two the file has.
  const pickDefaults = useCallback((nextHeaders: string[]) => {
    setColA(nextHeaders[0] ?? "");
    setColB(nextHeaders[1] ?? nextHeaders[0] ?? "");
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setDownloadError(null);
      try {
        const wb = await parseToolFile(file);
        setWorkbook(wb);
        setSheetIndex(0);
        pickDefaults(wb.sheets[0]?.headers ?? []);
      } catch (e) {
        setWorkbook(null);
        setUploadError(
          e instanceof WorkbookError
            ? e.message
            : `Couldn't read that file: ${String((e as any)?.message || e)}`,
        );
      }
    },
    [pickDefaults],
  );

  const onSheetChange = useCallback(
    (index: number) => {
      setSheetIndex(index);
      setDownloadError(null);
      pickDefaults(workbook?.sheets[index]?.headers ?? []);
    },
    [workbook, pickDefaults],
  );

  const onDownload = useCallback(async () => {
    if (!canProcess || !workbook || !sheet) return;
    setDownloadError(null);

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
      bCounts.set(v, (bCounts.get(v) || 0) + 1);
    }

    const newHeaderLabel = makeNewHeaderLabel(mode, colA.trim(), colB.trim());
    const out = rows.map((r) => {
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
      return [...r, mark];
    });

    try {
      await downloadSheet(
        workbook,
        sheet.name,
        [...headers, newHeaderLabel],
        out,
        newHeaderLabel,
      );
    } catch (e) {
      setDownloadError(
        t("ctWriteFailed", { msg: String((e as any)?.message || e) }),
      );
    }
  }, [canProcess, workbook, sheet, rows, headers, iA, iB, colA, colB, mode, caseSensitive, t]);

  const field =
    "bg-transparent border border-white/10 rounded px-3 py-2 text-base md:text-lg disabled:opacity-60";
  const truncated = truncationNote(sheet);

  return (
    <div className="space-y-6">
      {/* Upload first */}
      <section className="space-y-2 mt-4 md:mt-6">
        <h3 className="text-lg font-semibold">{t("ctUploadTitle")}</h3>
        <div className="text-sm text-white/90 space-y-1">
          <div>{t("ctUploadDropLine")}</div>
          <div>{t("ctUploadLocalLine")}</div>
        </div>
        <FilePicker
          tone="dark"
          onFile={handleFile}
          hint={t("ctUploadHint")}
          info={
            workbook && sheet
              ? t("ctFileInfo", {
                  name: workbook.fileName,
                  rows: rows.length.toLocaleString(),
                  cols: headers.length,
                })
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

      {/* Then: Compare [A] to [B] for [Type] */}
      <section className="space-y-2 pt-2">
        <div className="flex flex-wrap gap-3 md:gap-4 items-center">
          <label className="text-base md:text-lg font-medium">{t("ccCompare")}</label>
          <ColumnSelect
            headers={headers}
            value={colA}
            onChange={setColA}
            className={field}
            emptyLabel={t("ctPickColumnEmpty")}
          />
          <label className="text-base md:text-lg font-medium">{t("ccTo")}</label>
          <ColumnSelect
            headers={headers}
            value={colB}
            onChange={setColB}
            className={field}
            emptyLabel={t("ctPickColumnEmpty")}
          />
          <label className="text-base md:text-lg font-medium">{t("ccFor")}</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className={field}
          >
            <option value="duplicates">{t("ccModeDuplicates")}</option>
            <option value="matches">{t("ccModeMatches")}</option>
            <option value="missing">{t("ccModeMissing")}</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <input
            id="caseSensitiveToggle"
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          <label htmlFor="caseSensitiveToggle" className="text-sm md:text-base">{t("ctCaseSensitive")}</label>
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
                <span>{t("ctProcessDownload", { kind: kindLabel(workbook!.kind) })}</span>
              </button>
              <span className="text-xs text-white/60">
                {t("ccDownloadNote")}
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

function makeNewHeaderLabel(m: Mode, a: string, b: string): string {
  if (m === "missing") return `missing_items_${a}_${b}`;
  if (m === "matches") return `matches_${a}_${b}`;
  return `duplicates_${a}_${b}`;
}
