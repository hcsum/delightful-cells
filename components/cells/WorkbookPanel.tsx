"use client";

import { useRef } from "react";
import { MAX_ROWS, type ParsedWorkbook } from "@/lib/cells/workbook";
import { DAILY_ROWS_LIMIT } from "@/lib/limits";
import type { GridState } from "@/lib/cells/tools";
import DataTable from "./DataTable";
import { useT } from "@/lib/cells/locale";
import { makeDemoFile } from "@/lib/cells/demo";

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
  onEditCell,
  onSelectRow,
  onClearSelection,
  onSelectSheet,
  onClearHighlights,
  onShowAllRows,
  onReset,
  onDownload,
  onDownloadXlsx,
}: {
  state: WorkbookState;
  onFile: (file: File) => void;
  onEditCell: (rowIdx: number, colIdx: number, value: string) => void;
  onSelectRow: (rowIdx: number, mods: { shift: boolean; meta: boolean }) => void;
  onClearSelection: () => void;
  onSelectSheet: (index: number) => void;
  onClearHighlights: () => void;
  onShowAllRows: () => void;
  onReset: () => void;
  onDownload: () => void;
  onDownloadXlsx: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();

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
              {t("opening", { name: state.fileName })}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-6xl">🐣</div>
            <h2 className="mt-4 text-xl font-extrabold text-black">
              {t("dropTitle")}
            </h2>
            <p className="mt-1 text-sm text-black/55">
              {t("dropDesc1")}
              <br />
              {t("dropDesc2")}
            </p>
            <p className="mt-3 text-xs font-semibold text-black/45">
              {t("limitsHint", { r: MAX_ROWS.toLocaleString(), d: DAILY_ROWS_LIMIT.toLocaleString() })}
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
              {t("chooseFile")}
            </button>
            <p className="mt-3 text-sm text-black/55">
              {t("or")}{" "}
              <button
                onClick={async () => onFile(await makeDemoFile())}
                className="font-bold underline decoration-2 underline-offset-2 hover:text-black"
              >
                {t("tryDemo")}
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
          {t("rowsCols", { r: grid.rows.length, c: grid.headers.length })}
        </span>
        <span className="text-xs text-black/35">
          {t("limitsHint", { r: MAX_ROWS.toLocaleString(), d: DAILY_ROWS_LIMIT.toLocaleString() })}
        </span>
        <button
          onClick={() => inputRef.current?.click()}
          className={`${pill} bg-black text-[#fffdf8] hover:opacity-80`}
        >
          {t("newFile")}
        </button>
        <div className="grow" />
        {grid.selectedRows && (
          <button onClick={onClearSelection} className={`${pill} bg-[#dbeafe] text-black hover:bg-[#c7dcfa]`}>
            {t("selectedClear", { n: grid.selectedRows.size })}
          </button>
        )}
        {grid.highlightedRows && (
          <button onClick={onClearHighlights} className={`${pill} bg-[#fff3b0] text-black hover:bg-[#ffe89a]`}>
            {t("clearHighlights")}
          </button>
        )}
        {grid.filterKept && (
          <button onClick={onShowAllRows} className={`${pill} bg-[#d6f0ff] text-black hover:bg-[#c2e8ff]`}>
            {t("showAllRows")}
          </button>
        )}
        <button onClick={onReset} className={`${pill} bg-white text-black/70 border !border-black/15 hover:bg-[#ffe6ef]`}>
          {t("resetData")}
        </button>
        <button onClick={onDownloadXlsx} className={`${pill} bg-[#e8ffe8] text-black border !border-black/15 hover:bg-[#d4f7d4]`}>
          {t("downloadExcel")}
        </button>
        <button onClick={onDownload} className={`${pill} bg-white text-black/70 border !border-black/15 hover:bg-[#e8ffe8]`}>
          {t("downloadCsv")}
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
          {sheet.truncatedRows && `Truncated to the first ${MAX_ROWS.toLocaleString()} rows. `}
          {sheet.truncatedCols && "Truncated to the first 60 columns."}
        </p>
      )}

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <DataTable grid={grid} onEditCell={onEditCell} onSelectRow={onSelectRow} />
      </div>
    </section>
  );
}
