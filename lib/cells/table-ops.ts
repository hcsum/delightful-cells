// Pure table operations — no DOM, no React. These are the "hands" of the
// agent: the model asks for an operation, the browser runs it here.

export type FilterOp =
  | "contains"
  | "equals"
  | "not_equals"
  | "gt"
  | "lt"
  | "empty"
  | "not_empty";

export function findColumnIndex(headers: string[], name: string): number {
  const wanted = name.trim().toLowerCase();
  return headers.findIndex((h) => h.trim().toLowerCase() === wanted);
}

export function matchRows(
  rows: string[][],
  colIdx: number,
  op: FilterOp,
  value: string,
): number[] {
  const needle = value.trim().toLowerCase();
  const num = Number(value);
  const out: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i][colIdx] ?? "";
    const lower = cell.trim().toLowerCase();
    let hit = false;
    switch (op) {
      case "contains":
        hit = needle !== "" && lower.includes(needle);
        break;
      case "equals":
        hit = lower === needle;
        break;
      case "not_equals":
        hit = lower !== needle;
        break;
      case "gt": {
        const n = Number(cell);
        hit = Number.isFinite(n) && Number.isFinite(num) && n > num;
        break;
      }
      case "lt": {
        const n = Number(cell);
        hit = Number.isFinite(n) && Number.isFinite(num) && n < num;
        break;
      }
      case "empty":
        hit = lower === "";
        break;
      case "not_empty":
        hit = lower !== "";
        break;
    }
    if (hit) out.push(i);
  }
  return out;
}

export function findReplace(
  rows: string[][],
  colIdx: number,
  find: string,
  replace: string,
  matchCase: boolean,
  only?: Set<number> | null,
): { rows: string[][]; replacements: number; rowsAffected: number } {
  let replacements = 0;
  let rowsAffected = 0;
  const next = rows.map((row, rowIdx) => {
    if (only && !only.has(rowIdx)) return row;
    const cell = row[colIdx] ?? "";
    let updated = cell;
    let count = 0;
    if (find === "") {
      // Empty `find` = overwrite the whole cell (the "set every value" case).
      if (cell !== replace) { updated = replace; count = 1; }
    } else {
      if (matchCase) {
        // Literal split/join — user input is never treated as a regex.
        count = cell.split(find).length - 1;
        if (count > 0) updated = cell.split(find).join(replace);
      } else {
        const lowerCell = cell.toLowerCase();
        const lowerFind = find.toLowerCase();
        let from = 0;
        let idx = lowerCell.indexOf(lowerFind);
        if (idx !== -1) {
          let result = "";
          while (idx !== -1) {
            result += cell.slice(from, idx) + replace;
            from = idx + find.length;
            count++;
            idx = lowerCell.indexOf(lowerFind, from);
          }
          updated = result + cell.slice(from);
        }
      }
    }
    if (count > 0) {
      replacements += count;
      rowsAffected++;
      const copy = row.slice();
      copy[colIdx] = updated;
      return copy;
    }
    return row;
  });
  return { rows: next, replacements, rowsAffected };
}

export function uniquifyHeader(headers: string[], desired: string): string {
  const taken = new Set(headers.map((h) => h.trim().toLowerCase()));
  if (!taken.has(desired.trim().toLowerCase())) return desired;
  for (let n = 2; ; n++) {
    const candidate = `${desired} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function appendColumn(
  headers: string[],
  rows: string[][],
  name: string,
  values: string[],
): { headers: string[]; rows: string[][] } {
  return {
    headers: [...headers, name],
    rows: rows.map((row, i) => [...row, values[i] ?? ""]),
  };
}

export type ColumnStats = {
  column: string;
  totalRows: number;
  nonEmpty: number;
  distinct: number;
  sampleValues: string[];
  // Most frequent values with counts, so "which X appears most?" is answerable.
  topValues?: { value: string; count: number }[];
  numeric?: { min: number; max: number; mean: number; sum: number; count: number };
  // Plain-English gloss of the numbers above, so the model reads them as what
  // they are instead of guessing from field names.
  outcome: string;
};

export function summarizeColumn(
  rows: string[][],
  colIdx: number,
  columnName: string,
  maxSamples = 40,
): ColumnStats {
  const values = rows.map((r) => (r[colIdx] ?? "").trim()).filter((v) => v !== "");
  const distinctValues = Array.from(new Set(values));

  // Evenly sample distinct values so long columns still give the model a
  // representative picture without blowing up the prompt.
  const step = Math.max(1, Math.ceil(distinctValues.length / maxSamples));
  const sampleValues = distinctValues
    .filter((_, i) => i % step === 0)
    .slice(0, maxSamples)
    .map((v) => (v.length > 80 ? v.slice(0, 80) + "…" : v));

  const freq = new Map<string, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
  const topValues =
    distinctValues.length <= Math.max(values.length * 0.9, 1)
      ? [...freq.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([value, count]) => ({
            value: value.length > 80 ? value.slice(0, 80) + "…" : value,
            count,
          }))
      : undefined; // mostly-unique columns: counts are noise

  const numbers = values.map(Number).filter((n) => Number.isFinite(n));
  const numeric =
    numbers.length > 0 && numbers.length >= values.length * 0.8
      ? {
          min: Math.min(...numbers),
          max: Math.max(...numbers),
          mean: Number(
            (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2),
          ),
          sum: Number(numbers.reduce((a, b) => a + b, 0).toFixed(2)),
          count: numbers.length,
        }
      : undefined;

  const outcome = [
    `Column "${columnName}" over ${rows.length} rows: ${values.length} non-empty cells holding ${distinctValues.length} different values`,
    `(distinct = how many different values exist, NOT how many rows meet any condition).`,
    numeric
      ? `Of those, ${numeric.count} parse as numbers: they add up to ${numeric.sum}, average ${numeric.mean}, ranging ${numeric.min}–${numeric.max}. These cover every non-empty cell that is a number, including zeros.`
      : `The values are not numeric, so there is no sum or average.`,
    topValues
      ? `topValues lists the most common values with how many rows hold each.`
      : `Values are nearly all unique, so no frequency counts are given.`,
    `sampleValues is a sample of the distinct values, not the full column.`,
    `This is a whole-column overview only. To count the rows meeting a condition, run filter_rows and read rowsMatched.`,
  ].join(" ");

  return {
    column: columnName,
    totalRows: rows.length,
    nonEmpty: values.length,
    distinct: distinctValues.length,
    sampleValues,
    ...(topValues ? { topValues } : {}),
    ...(numeric ? { numeric } : {}),
    outcome,
  };
}

// Drop whole columns (by index) from the header row and every data row.
export function removeColumns(
  headers: string[],
  rows: string[][],
  drop: Set<number>,
): { headers: string[]; rows: string[][] } {
  const keep = headers.map((_, i) => i).filter((i) => !drop.has(i));
  return {
    headers: keep.map((i) => headers[i]),
    rows: rows.map((row) => keep.map((i) => row[i] ?? "")),
  };
}
