"use client";

import { useRef } from "react";
import type { ParsedWorkbook } from "@/lib/cells/workbook";
import type { GridState } from "@/lib/cells/tools";
import DataTable from "./DataTable";

export type WorkbookState =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | {
      status: "ready";
      workbook: ParsedWorkbook;
      activeSheet: number;
      grid: GridState;
    }
  | { status: "error"; message: string };

export default function WorkbookPanel({
  state,
  onFile,
  onSelectSheet,
  onClearHighlights,
  onShowAllRows,
  onReset,
  onDownload,
  onDownloadXlsx,
}: {
  state: WorkbookState;
  onFile: (file: File) => void;
  onSelectSheet: (index: number) => void;
  onClearHighlights: () => void;
  onShowAllRows: () => void;
  onReset: () => void;
  onDownload: () => void;
  onDownloadXlsx: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".xlsx,.xls,.csv"
      className="sr-only"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = "";
      }}
    />
  );

  if (state.status !== "ready") {
    return (
      <section
        className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[28px] border !border-black/10 bg-[#fffaf0] p-8"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        {fileInput}
        {state.status === "parsing" ? (
          <div className="text-center">
            <div className="animate-bounce text-5xl">📊</div>
            <p className="mt-4 text-sm font-semibold text-black/60">
              Opening {state.fileName}…
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-6xl">🐣</div>
            <h2 className="mt-4 text-xl font-extrabold text-black">
              Drop your spreadsheet here
            </h2>
            <p className="mt-1 text-sm text-black/55">
              .xlsx, .xls, or .csv — it opens instantly, right in your browser.
              <br />
              Nothing is uploaded until you talk to the AI.
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              className="mt-5 rounded-full px-6 py-3 text-sm font-bold text-black transition-transform hover:scale-105"
              style={{
                border: "3px solid transparent",
                background:
                  "linear-gradient(#fffaf0,#fffaf0) padding-box, linear-gradient(90deg,#ff0080,#ff8c00,#ffd500,#00c853,#00b0ff,#7c4dff,#ff0080) border-box",
              }}
            >
              Choose a file
            </button>
            <p className="mt-3 text-sm text-black/55">
              or{" "}
              <button
                onClick={async () => {
                  const res = await fetch("/demo/delightful-demo.xlsx");
                  const blob = await res.blob();
                  onFile(new File([blob], "delightful-demo.xlsx", { type: blob.type }));
                }}
                className="font-bold underline decoration-2 underline-offset-2 hover:text-black"
              >
                try with demo data
              </button>{" "}
              ✨
            </p>
            {state.status === "error" && (
              <p className="mt-4 rounded-2xl bg-[#ffe6ef] px-4 py-2 text-sm font-semibold text-[#b3003c]">
                {state.message}
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  const { workbook, activeSheet, grid } = state;
  const sheet = workbook.sheets[activeSheet];
  const pill =
    "rounded-full px-3 py-1 text-xs font-semibold transition-colors";

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[28px] border !border-black/10 bg-[#fffaf0] p-4">
      {fileInput}
      <div className="flex flex-wrap items-center gap-2">
        <span className="max-w-[240px] truncate text-sm font-extrabold text-black" title={workbook.fileName}>
          📄 {workbook.fileName}
        </span>
        <span className="text-xs text-black/40">
          {grid.rows.length} rows × {grid.headers.length} cols
        </span>
        <button
          onClick={() => inputRef.current?.click()}
          className={`${pill} bg-black text-[#fffdf8] hover:opacity-80`}
        >
          New file
        </button>
        <div className="grow" />
        {grid.highlightedRows && (
          <button onClick={onClearHighlights} className={`${pill} bg-[#fff3b0] text-black hover:bg-[#ffe89a]`}>
            Clear highlights
          </button>
        )}
        {grid.filterKept && (
          <button onClick={onShowAllRows} className={`${pill} bg-[#d6f0ff] text-black hover:bg-[#c2e8ff]`}>
            Show all rows
          </button>
        )}
        <button onClick={onReset} className={`${pill} bg-white text-black/70 border !border-black/15 hover:bg-[#ffe6ef]`}>
          Reset data
        </button>
        <button onClick={onDownloadXlsx} className={`${pill} bg-[#e8ffe8] text-black border !border-black/15 hover:bg-[#d4f7d4]`}>
          Download Excel
        </button>
        <button onClick={onDownload} className={`${pill} bg-white text-black/70 border !border-black/15 hover:bg-[#e8ffe8]`}>
          Download CSV
        </button>
      </div>

      {workbook.sheets.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {workbook.sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => onSelectSheet(i)}
              className={`${pill} ${
                i === activeSheet
                  ? "bg-black text-[#fffdf8]"
                  : "bg-white text-black/60 border !border-black/15 hover:bg-[#fff3d6]"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {(sheet.truncatedRows || sheet.truncatedCols) && (
        <p className="mt-3 rounded-full bg-[#ffe6ef] px-4 py-1.5 text-xs font-semibold text-[#b3003c]">
          {sheet.truncatedRows && "Truncated to the first 5,000 rows. "}
          {sheet.truncatedCols && "Truncated to the first 60 columns."}
        </p>
      )}

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <DataTable grid={grid} />
      </div>
    </section>
  );
}
