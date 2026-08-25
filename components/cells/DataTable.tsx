"use client";

import { useEffect, useRef, useState } from "react";
import type { GridState } from "@/lib/cells/tools";

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
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null);
  // Pattern-Maker-style crosshair: the hovered row and column light up as bands
  // and the cell gets an outline. Row band is plain CSS (tr:hover); the column
  // band is driven by a data attribute on the table so hovering never re-renders
  // the (up to 12k-cell) grid through React.
  const tableRef = useRef<HTMLTableElement>(null);
  const setHoverCol = (e: React.MouseEvent) => {
    const td = (e.target as HTMLElement).closest("td,th");
    const idx = td ? (td as HTMLTableCellElement).cellIndex : 0;
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
                    title={onSelectRow ? "Click to select row (Shift: range, ⌘/Ctrl: toggle)" : undefined}
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
                        title={onEditCell ? `${cell}\n(double-click to edit)` : cell}
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
                  No rows match the current filter. 🫥
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/45">
        {visibleIndexes.length > MAX_RENDERED_ROWS && (
          <span>
            Showing first {MAX_RENDERED_ROWS} of {visibleIndexes.length} rows —
            AI tools still work on all of them ✨
          </span>
        )}
        {hiddenByFilter > 0 && (
          <span>{hiddenByFilter} rows hidden by the current filter.</span>
        )}
        {grid.highlightedRows && (
          <span>{grid.highlightedRows.size} rows highlighted.</span>
        )}
        {grid.selectedRows && (
          <span>{grid.selectedRows.size} rows selected — say &ldquo;these rows&rdquo; in chat.</span>
        )}
        {onEditCell && rendered.length > 0 && (
          <span>Double-click any cell to edit it. Click a row number to select.</span>
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
    // Row band + row-number accent.
    `.cells-grid tbody tr:hover td{background-image:linear-gradient(${BAND},${BAND})}`,
    `.cells-grid tbody tr:hover td:first-child{color:#2f7cf6;font-weight:700}`,
    // Hovered cell outline.
    `.cells-grid tbody td:hover{box-shadow:inset 0 0 0 2px #2f7cf6;border-radius:6px}`,
  ];
  // Column band + header accent for every possible column (cellIndex 1..cols).
  for (let i = 1; i <= cols; i++) {
    rules.push(
      `.cells-grid[data-hc="${i}"] td:nth-child(${i + 1}){background-image:linear-gradient(${BAND},${BAND})}`,
      `.cells-grid[data-hc="${i}"] th:nth-child(${i + 1}){color:#2f7cf6;background-color:#e3eefc}`,
    );
  }
  return rules.join("\n");
}
