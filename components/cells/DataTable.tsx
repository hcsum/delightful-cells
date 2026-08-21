"use client";

import type { GridState } from "@/lib/cells/tools";

const MAX_RENDERED_ROWS = 200;

// Truncated DOM table: renders at most 200 rows. Tools always operate on the
// full in-memory data — only the rendering is capped.
export default function DataTable({ grid }: { grid: GridState }) {
  const visibleIndexes = grid.filterKept ?? grid.rows.map((_, i) => i);
  const rendered = visibleIndexes.slice(0, MAX_RENDERED_ROWS);
  const hiddenByFilter = grid.filterKept
    ? grid.rows.length - grid.filterKept.length
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border !border-black/10 bg-white">
        <table className="w-full border-collapse text-sm">
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
              return (
                <tr
                  key={rowIdx}
                  className={
                    highlighted
                      ? "bg-[#fff3b0]"
                      : rowIdx % 2 === 1
                        ? "bg-[#fffaf0]"
                        : "bg-white"
                  }
                >
                  <td className="whitespace-nowrap px-3 py-1.5 text-black/35 tabular-nums">
                    {rowIdx + 1}
                  </td>
                  {grid.rows[rowIdx].map((cell, ci) => (
                    <td
                      key={ci}
                      className="max-w-[280px] truncate whitespace-nowrap px-3 py-1.5 text-black/80"
                      title={cell}
                    >
                      {cell}
                    </td>
                  ))}
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
      </div>
    </div>
  );
}
