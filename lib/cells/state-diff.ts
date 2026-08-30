// Between two agent turns the user may click around: clear the selection,
// change highlights, edit cells, reset the data. The model only sees the chat
// history, where its own last TOOL_RESULT still claims "10 rows selected".
// We snapshot the grid when a turn ends and, at the start of the next one,
// turn the difference into one short note the model reads right before the
// new user message.

import type { GridState } from "./tools";

export type GridSnapshot = {
  selected: number[];
  highlighted: number;
  filterKept: number | null;
  rows: string[][]; // reference identity: any edit/reset replaces it
  edits: number;
};

export function snapshotGrid(grid: GridState, edits: number): GridSnapshot {
  return {
    selected: [...(grid.selectedRows ?? [])].sort((a, b) => a - b),
    highlighted: grid.highlightedRows?.size ?? 0,
    filterKept: grid.filterKept ? grid.filterKept.length : null,
    rows: grid.rows,
    edits,
  };
}

export function describeUserChanges(prev: GridSnapshot, next: GridSnapshot): string | null {
  const parts: string[] = [];
  const sameSel =
    prev.selected.length === next.selected.length &&
    prev.selected.every((v, i) => v === next.selected[i]);
  if (!sameSel) {
    parts.push(
      next.selected.length === 0
        ? "cleared the selection"
        : `changed the selection (now ${next.selected.length} rows)`,
    );
  }
  if (prev.highlighted !== next.highlighted) {
    parts.push(
      next.highlighted === 0
        ? "cleared all highlights"
        : `changed the highlights (now ${next.highlighted} rows)`,
    );
  }
  if (prev.filterKept !== next.filterKept) {
    parts.push(
      next.filterKept == null
        ? "removed the filter (all rows visible)"
        : `changed the filter (now ${next.filterKept} rows visible)`,
    );
  }
  const editCount = next.edits - prev.edits;
  if (editCount > 0) parts.push(`edited ${editCount} cell${editCount === 1 ? "" : "s"} by hand`);
  else if (prev.rows !== next.rows) parts.push("reset or otherwise changed the data");
  return parts.length ? `[Since your last reply the user ${parts.join("; ")}. Trust CURRENT TABLE STATE, not earlier TOOL_RESULTs.]` : null;
}
