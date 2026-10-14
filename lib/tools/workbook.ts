// Shared upload/download layer for the single-use tools (the SEO landing pages).
//
// Everything here is a thin wrapper over lib/cells/workbook.ts — the Cells
// playground already reads .xlsx/.xls/.csv and writes both .xlsx and .csv, so
// the tools reuse that rather than keeping a second, CSV-only parser around.
//
// Excel workbooks are exported as .xlsx and CSV files remain .csv. The tools
// operate on one selected sheet and export its cell values with the result
// column; they do not round-trip formulas, formatting, or other sheets.

import {
  parseWorkbookFile,
  downloadWorkbookXlsx,
  toCsv,
  WorkbookError,
  type ParsedSheet,
} from "@/lib/cells/workbook";
import { MAX_TOOL_IMPORT_ROWS, MAX_TOOL_COLS } from "@/lib/limits";

export { WorkbookError };
export type { ParsedSheet };

export type ToolFileKind = "xlsx" | "csv";

export type ToolWorkbook = {
  fileName: string;
  /** Decided by extension, and it decides what the download is written as. */
  kind: ToolFileKind;
  sheets: ParsedSheet[];
};

export function fileKind(fileName: string): ToolFileKind {
  return /\.csv$/i.test(fileName) ? "csv" : "xlsx";
}

/** Human label for the format, for button text like "Download Excel". */
export function kindLabel(kind: ToolFileKind): string {
  return kind === "csv" ? "CSV" : "Excel";
}

export async function parseToolFile(file: File): Promise<ToolWorkbook> {
  const wb = await parseWorkbookFile(file, {
    maxRows: MAX_TOOL_IMPORT_ROWS,
    maxCols: MAX_TOOL_COLS,
  });
  return {
    fileName: wb.fileName,
    kind: fileKind(file.name),
    sheets: wb.sheets,
  };
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.(xlsx|xlsm|xls|csv)$/i, "");
}

/**
 * Write the selected sheet back out with the tool's extra column already
 * appended by the caller. CSV remains CSV; Excel workbooks are exported as XLSX.
 *
 * Only the sheet that was worked on is written. Carrying the untouched sheets
 * along would look tidier, but every one of them has been through the parser's
 * raw:false pass, so they would come back as the *text* of their cells with the
 * formulas and number formats gone — a silent downgrade of data nobody asked us
 * to touch.
 */
export async function downloadSheet(
  source: ToolWorkbook,
  sheetName: string,
  headers: string[],
  rows: string[][],
  suffix: string,
): Promise<void> {
  const base = stripExtension(source.fileName || "download");
  const name = `${base}-with-${kebab(suffix)}`;
  if (source.kind === "csv") {
    downloadBlob(
      // Excel uses the BOM to recognize Japanese UTF-8 text on direct open.
      new Blob(["\uFEFF", toCsv(headers, rows)], { type: "text/csv;charset=utf-8;" }),
      `${name}.csv`,
    );
    return;
  }
  await downloadWorkbookXlsx(`${name}.xlsx`, [
    { name: sheetName || "Sheet1", headers, rows },
  ]);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

/** Case-insensitive exact header match (trimmed). -1 when absent. */
export function findColumnIndex(headers: string[], name: string): number {
  if (!name) return -1;
  const norm = (s: string) => s?.toString().trim().toLowerCase();
  const target = norm(name);
  for (let i = 0; i < headers.length; i++) {
    if (norm(headers[i]) === target) return i;
  }
  return -1;
}

export function kebab(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/** Shown under the picker when the parser had to cut the file down. */
export function truncationNote(sheet: ParsedSheet | undefined): string | null {
  if (!sheet) return null;
  const parts: string[] = [];
  if (sheet.truncatedRows)
    parts.push(`the first ${sheet.rows.length.toLocaleString()} rows`);
  if (sheet.truncatedCols)
    parts.push(`the first ${sheet.headers.length.toLocaleString()} columns`);
  if (!parts.length) return null;
  return `That file is bigger than we can hold in the browser — only ${parts.join(" and ")} were loaded.`;
}
