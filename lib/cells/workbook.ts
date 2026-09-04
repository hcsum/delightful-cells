// Client-side workbook parsing for Delightful Cells.
// SheetJS is imported dynamically so it never lands in the initial bundle
// (and never runs during SSR).

import { AI_ROWS_PER_REQUEST_LIMIT } from "@/lib/limits";

export type ParsedSheet = {
  name: string;
  headers: string[];
  rows: string[][];
  truncatedRows: boolean;
  truncatedCols: boolean;
};

export type ParsedWorkbook = {
  fileName: string;
  sheets: ParsedSheet[];
};

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ROWS = AI_ROWS_PER_REQUEST_LIMIT;
export const MAX_COLS = 60;

export class WorkbookError extends Error {}

function columnLetter(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export async function parseWorkbookFile(file: File): Promise<ParsedWorkbook> {
  if (file.size > MAX_FILE_BYTES) {
    throw new WorkbookError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the playground caps out at 20 MB. Try a smaller sheet!`,
    );
  }
  const XLSX = await import("xlsx");
  let wb: import("xlsx").WorkBook;
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  } catch {
    throw new WorkbookError(
      "Couldn't read that file. It should be an .xlsx, .xls, or .csv file.",
    );
  }

  const sheets: ParsedSheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    // raw:false keeps dates/numbers as their displayed text, which is what
    // both the table and the LLM should see.
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
    });
    if (!aoa.length) continue;

    const width = Math.max(...aoa.map((r) => r.length));
    if (width === 0) continue;
    const truncatedCols = width > MAX_COLS;
    const cols = Math.min(width, MAX_COLS);

    const headerRow = aoa[0].map((c) => String(c ?? "").trim());
    const headers = Array.from({ length: cols }, (_, i) =>
      headerRow[i] ? headerRow[i] : `Column ${columnLetter(i)}`,
    );

    const bodyRows = aoa.slice(1);
    const truncatedRows = bodyRows.length > MAX_ROWS;
    const rows = bodyRows
      .slice(0, MAX_ROWS)
      .map((r) => Array.from({ length: cols }, (_, i) => String(r[i] ?? "")));

    sheets.push({ name, headers, rows, truncatedRows, truncatedCols });
  }

  if (!sheets.length) {
    throw new WorkbookError("That workbook looks empty — no rows to show.");
  }
  return { fileName: file.name, sheets };
}

// Write sheets back to an .xlsx and trigger a browser download.
export type ExportSheet = {
  name: string;
  headers: string[];
  rows: string[][];
  // Row index (into `rows`) → fill color hex, mirroring the on-screen highlights.
  highlightedRows?: Map<number, string> | null;
};

// exceljs (MIT) instead of SheetJS for writing: the community SheetJS build
// cannot write cell fills, and keeping highlights in the file is the point.
export async function downloadWorkbookXlsx(
  fileName: string,
  sheets: ExportSheet[],
): Promise<void> {
  const ExcelJS = await import("exceljs/dist/exceljs.min.js");
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31)); // Excel's sheet-name limit
    ws.addRow(s.headers).font = { bold: true };
    s.rows.forEach((r, i) => {
      const row = ws.addRow(r);
      const hex = s.highlightedRows?.get(i);
      if (hex) {
        const argb = "FF" + hex.replace("#", "").toUpperCase();
        for (let c = 1; c <= s.headers.length; c++) {
          row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
        }
      }
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// Minimal CSV writer for the download button (quotes only when needed).
export function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) =>
    /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  return [headers, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
}
