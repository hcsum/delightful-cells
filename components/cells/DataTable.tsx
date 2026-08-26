"use client";

import { useEffect, useRef, useState } from "react";
import type { GridState } from "@/lib/cells/tools";
import { useT } from "@/lib/cells/locale";

const MAX_RENDERED_ROWS = 200;

// Truncated DOM table: renders at most 200 rows. Tools always operate on the
// full in-memory data — only the rendering is capped.
export default function DataTable({
  grid,
  onEditCell,
  onSelectRow,
}: {
  grid: GridState;
  onEditCell?: (rowIdx: number, colIdx: number, value: string) => void;
  onSelectRow?: (rowIdx: number, mods: { shift: boolean; meta: boolean }) => void;
}) {
  // Double-click a cell to edit it inline; Enter/blur commits, Esc cancels.
  const t = useT();
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null);
  // Hovering a column header lights up that column; hovering a row number
  // lights up that row (pure CSS via :has). Driven by a data attribute on the
  // table so hovering never re-renders the (up to 12k-cell) grid through React.
  const tableRef = useRef<HTMLTableElement>(null);
  const setHoverCol = (e: React.MouseEvent) => {
    const th = (e.target as HTMLElement).closest("th");
    const idx = th ? (th as HTMLTableCellElement).cellIndex : 0;
    if (tableRef.current) tableRef.current.dataset.hc = idx > 0 ? String(idx) : "";
  };
  const clearHoverCol = () => {
    if (tableRef.current) tableRef.current.dataset.hc = "";
  };
  const visibleIndexes = grid.filterKept ?? grid.rows.map((_, i) => i);
  const rendered = visibleIndexes.slice(0, MAX_RENDERED_ROWS);
  const hiddenByFilter = grid.filterKept
    ? grid.rows.length - grid.filterKept.length
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border !border-black/10 bg-white">
        <style>{crosshairCss(grid.headers.length)}</style>
        <table
          ref={tableRef}
          className="cells-grid w-full border-collapse text-sm"
          onMouseOver={setHoverCol}
          onMouseLeave={clearHoverCol}
        >
          <thead>
            <tr>
              <th className="sticky top-0 z-10 border-b !border-black/10 bg-[#fff3d6] px-3 py-2 text-left font-bold text-black/40">
                #
              </th>
              {grid.headers.map((h, i) => (
                <th
                  key={i}
                  className="sticky top-0 z-10 whitespace-nowrap border-b !border-black/10 bg-[#fff3d6] px-3 py-2 text-left font-bold text-black"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rendered.map((rowIdx) => {
              const highlighted = grid.highlightedRows?.has(rowIdx) ?? false;
              const selected = grid.selectedRows?.has(rowIdx) ?? false;
              return (
                <tr
                  key={rowIdx}
                  className={
                    highlighted
                      ? "bg-[#fff3b0]"
                      : selected
                        ? "bg-[#eaf3ff]"
                        : rowIdx % 2 === 1
                          ? "bg-[#fffaf0]"
                          : "bg-white"
                  }
                >
                  <td
                    className={`select-none whitespace-nowrap px-3 py-1.5 tabular-nums ${
                      selected ? "bg-[#2f7cf6] font-bold text-white" : "text-black/35"
                    } ${onSelectRow ? "cursor-pointer hover:bg-[#dbeafe]" : ""}`}
                    title={onSelectRow ? t("rowSelectTitle") : undefined}
                    onClick={(e) =>
                      onSelectRow?.(rowIdx, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })
                    }
                  >
                    {rowIdx + 1}
                  </td>
                  {grid.rows[rowIdx].map((cell, ci) =>
                    editing?.row === rowIdx && editing.col === ci ? (
                      <td key={ci} className="p-0">
                        <CellEditor
                          value={cell}
                          onCommit={(v) => {
                            if (v !== cell) onEditCell?.(rowIdx, ci, v);
                            setEditing(null);
                          }}
                          onCancel={() => setEditing(null)}
                        />
                      </td>
                    ) : (
                      <td
                        key={ci}
                        className="max-w-[280px] cursor-text truncate whitespace-nowrap px-3 py-1.5 text-black/80"
                        title={onEditCell ? `${cell}\n${t("dblclickEdit")}` : cell}
                        onDoubleClick={() => onEditCell && setEditing({ row: rowIdx, col: ci })}
                      >
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              );
            })}
            {rendered.length === 0 && (
              <tr>
                <td
                  colSpan={grid.headers.length + 1}
                  className="px-3 py-8 text-center text-black/40"
                >
                  {t("noMatch")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/45">
        {visibleIndexes.length > MAX_RENDERED_ROWS && (
          <span>{t("showingFirst", { n: MAX_RENDERED_ROWS, m: visibleIndexes.length })}</span>
        )}
        {hiddenByFilter > 0 && (
          <span>{t("hiddenByFilter", { n: hiddenByFilter })}</span>
        )}
        {grid.highlightedRows && (
          <span>{t("highlightedRows", { n: grid.highlightedRows.size })}</span>
        )}
        {grid.selectedRows && (
          <span>{t("selectedHint", { n: grid.selectedRows.size })}</span>
        )}
        {onEditCell && rendered.length > 0 && (
          <span>{t("editHint")}</span>
        )}
      </div>
    </div>
  );
}

function CellEditor({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      defaultValue={value}
      className="w-full min-w-[160px] bg-white px-3 py-1.5 text-sm text-black outline outline-2 outline-[#ff8c00]"
      onBlur={(e) => onCommit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(e.currentTarget.value);
        else if (e.key === "Escape") onCancel();
      }}
    />
  );
}

const BAND = "rgba(47,124,246,0.10)";
function crosshairCss(cols: number): string {
  const rules: string[] = [
    // Hovering the row number highlights the whole row.
    `.cells-grid tbody tr:has(td:first-child:hover) td{background-image:linear-gradient(${BAND},${BAND})}`,
    `.cells-grid tbody tr:has(td:first-child:hover) td:first-child{color:#2f7cf6;font-weight:700}`,
  ];
  // Hovering a column header highlights the whole column (cellIndex 1..cols).
  for (let i = 1; i <= cols; i++) {
    rules.push(
      `.cells-grid[data-hc="${i}"] td:nth-child(${i + 1}){background-image:linear-gradient(${BAND},${BAND})}`,
      `.cells-grid[data-hc="${i}"] th:nth-child(${i + 1}){color:#2f7cf6;background-color:#e3eefc}`,
    );
  }
  return rules.join("\n");
}
