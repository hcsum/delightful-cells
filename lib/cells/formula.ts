// Tiny arithmetic formula engine for compute_column. Deterministic, no LLM:
// the model plans "[Revenue] / [Units Sold]", this code runs it on every row.
// Supports numbers, column refs ([Name] or bare header names), + - * / % and
// parentheses. Anything else is a parse error, never eval().

export type CompiledFormula = {
  colIndexes: number[];
  evaluate: (row: string[]) => number | null;
};

type Token =
  | { kind: "num"; value: number }
  | { kind: "col"; index: number }
  | { kind: "op"; op: string };

export function compileFormula(
  formula: string,
  headers: string[],
): { ok: true; compiled: CompiledFormula } | { ok: false; error: string } {
  // Longest headers first so "Units Sold" wins over a hypothetical "Units".
  const byLength = headers
    .map((h, i) => ({ h, i }))
    .sort((a, b) => b.h.length - a.h.length);

  const tokens: Token[] = [];
  const src = formula.trim();
  let pos = 0;
  const used = new Set<number>();
  while (pos < src.length) {
    const ch = src[pos];
    if (/\s/.test(ch)) { pos++; continue; }
    if ("+-*/%()".includes(ch)) { tokens.push({ kind: "op", op: ch }); pos++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = src.slice(pos).match(/^\d*\.?\d+/);
      if (!m) return { ok: false, error: `Bad number at "${src.slice(pos, pos + 10)}"` };
      tokens.push({ kind: "num", value: Number(m[0]) });
      pos += m[0].length;
      continue;
    }
    if (ch === "[") {
      const end = src.indexOf("]", pos);
      if (end === -1) return { ok: false, error: "Unclosed [column] reference" };
      const name = src.slice(pos + 1, end).trim().toLowerCase();
      const idx = headers.findIndex((h) => h.trim().toLowerCase() === name);
      if (idx === -1) return { ok: false, error: `Unknown column "${src.slice(pos + 1, end)}". Available: ${headers.join(" | ")}` };
      tokens.push({ kind: "col", index: idx });
      used.add(idx);
      pos = end + 1;
      continue;
    }
    // Bare column name (longest match, case-insensitive)
    const rest = src.slice(pos).toLowerCase();
    const hit = byLength.find(({ h }) => rest.startsWith(h.trim().toLowerCase()));
    if (hit) {
      tokens.push({ kind: "col", index: hit.i });
      used.add(hit.i);
      pos += hit.h.trim().length;
      continue;
    }
    return { ok: false, error: `Cannot parse formula at "${src.slice(pos, pos + 15)}". Use numbers, + - * / % ( ) and [column name] references.` };
  }
  if (!tokens.length) return { ok: false, error: "Empty formula" };

  // Recursive descent: expr := term (('+'|'-') term)*; term := unary (('*'|'/'|'%') unary)*
  let ti = 0;
  const peek = () => tokens[ti];
  const take = () => tokens[ti++];
  type Node = (vals: number[]) => number;
  function parseExpr(): Node | string {
    let left = parseTerm();
    if (typeof left === "string") return left;
    while (peek()?.kind === "op" && ((peek() as any).op === "+" || (peek() as any).op === "-")) {
      const op = (take() as any).op;
      const right = parseTerm();
      if (typeof right === "string") return right;
      const l: Node = left;
      const r: Node = right;
      left = op === "+" ? (v) => l(v) + r(v) : (v) => l(v) - r(v);
    }
    return left;
  }
  function parseTerm(): Node | string {
    let left = parseUnary();
    if (typeof left === "string") return left;
    while (peek()?.kind === "op" && "*/%".includes((peek() as any).op)) {
      const op = (take() as any).op;
      const right = parseUnary();
      if (typeof right === "string") return right;
      const l: Node = left;
      const r: Node = right;
      left =
        op === "*" ? (v) => l(v) * r(v)
        : op === "/" ? (v) => l(v) / r(v)
        : (v) => l(v) % r(v);
    }
    return left;
  }
  function parseUnary(): Node | string {
    const t = peek();
    if (t?.kind === "op" && t.op === "-") { take(); const inner = parseUnary(); if (typeof inner === "string") return inner; return (v) => -inner(v); }
    if (t?.kind === "op" && t.op === "(") {
      take();
      const inner = parseExpr();
      if (typeof inner === "string") return inner;
      const close = take();
      if (!close || close.kind !== "op" || close.op !== ")") return "Missing closing parenthesis";
      return inner;
    }
    if (t?.kind === "num") { take(); return () => t.value; }
    if (t?.kind === "col") { take(); const list = [...used].sort((a, b) => a - b); const vi = list.indexOf(t.index); return (v) => v[vi]; }
    return `Unexpected ${t ? ("op" in t ? `"${(t as any).op}"` : "token") : "end of formula"}`;
  }
  const root = parseExpr();
  if (typeof root === "string") return { ok: false, error: root };
  if (ti !== tokens.length) return { ok: false, error: "Trailing characters in formula" };

  const colIndexes = [...used].sort((a, b) => a - b);
  return {
    ok: true,
    compiled: {
      colIndexes,
      evaluate: (row) => {
        const vals: number[] = [];
        for (const ci of colIndexes) {
          // An empty cell is a missing input, not a zero. Number("") is 0, so
          // without this the row still computes and the blank silently becomes
          // a real term: [Amount] - [Extracted] on a row where the extraction
          // found nothing reported the full amount as a discrepancy.
          const text = String(row[ci] ?? "").replace(/[$,\s]/g, "");
          if (text === "") return null;
          const n = Number(text);
          if (!Number.isFinite(n)) return null;
          vals.push(n);
        }
        const out = root(vals);
        return Number.isFinite(out) ? out : null;
      },
    },
  };
}

// "4028 / 212" → "19", "19.000000004" → "19", "19.129999" → "19.13"
export function formatComputed(n: number): string {
  const rounded = Math.round(n * 10_000) / 10_000;
  return String(rounded);
}
