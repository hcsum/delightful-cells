/**
 * Dev-only trace of one agent turn, end to end: the system prompt that went to
 * the model, the flattened history, the raw reply, the tool call parsed out of
 * it, the result the tool handed back, and every row batch underneath.
 *
 * It exists because the failures worth debugging here are never in one
 * function — they are in what the model was told and what it did with it. A
 * `console.log` at the crash site cannot show that, and the interesting run is
 * always the one that already scrolled past.
 *
 * Two readers, same events: the browser console (grouped, live) and
 * .dev-trace/<day>.jsonl on disk (grep-able afterwards, and readable by
 * whoever is helping you debug). Off unless NEXT_PUBLIC_DEBUG_TRACE=1, and the
 * sink route refuses to exist in production.
 */

export const TRACE_ON =
  process.env.NEXT_PUBLIC_DEBUG_TRACE === '1' &&
  process.env.NODE_ENV !== 'production';

type Data = Record<string, unknown>;

let currentTurn = '-';
let seq = 0;

/** Starts a new turn: every event after this one is filed under it. */
export function traceTurn(turnId: string, user: string): void {
  if (!TRACE_ON) return;
  currentTurn = turnId;
  seq = 0;
  trace('turn', { user });
}

export function trace(kind: string, data: Data): void {
  if (!TRACE_ON) return;
  const event = { t: new Date().toISOString(), turn: currentTurn, seq: ++seq, kind, ...data };
  toConsole(kind, event);
  // Fire and forget: a dev sink that is down must never change how the app
  // behaves. keepalive so the last event of a turn survives a reload.
  try {
    void fetch('/api/dev/trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

// Long strings (a 4KB system prompt) get their own line inside the group so
// the console shows them whole instead of as a one-line preview.
const LONG = new Set(['system', 'text', 'user', 'message', 'outcome']);

function toConsole(kind: string, event: Data): void {
  /* eslint-disable no-console */
  const { t, turn, seq: n, kind: _k, ...rest } = event;
  console.groupCollapsed(
    `%c[trace ${String(turn).slice(0, 6)}·${n}] ${kind}%c ${headline(kind, rest)}`,
    'color:#7c3aed;font-weight:600',
    'color:inherit',
  );
  for (const [key, value] of Object.entries(rest)) {
    if (LONG.has(key) && typeof value === 'string') console.log(`%c${key}:\n%c${value}`, 'color:#888', 'color:inherit');
    else console.log(`%c${key}:`, 'color:#888', value);
  }
  console.groupEnd();
  /* eslint-enable no-console */
}

function headline(kind: string, rest: Data): string {
  if (kind === 'prompt') return `step ${rest.step} · ${(rest.messages as unknown[])?.length ?? 0} messages · ${rest.chars} chars`;
  if (kind === 'reply') return `step ${rest.step} · ${String(rest.text ?? '').length} chars`;
  if (kind === 'call') return `step ${rest.step} · ${(rest.call as Data)?.tool}`;
  if (kind === 'result') return `${rest.tool} · ${rest.summary}`;
  if (kind === 'batch') return `${rest.status} · rows ${rest.start}–${Number(rest.start) + Number(rest.count) - 1} · ${rest.ms}ms`;
  if (kind === 'turn') return String(rest.user ?? '').slice(0, 60);
  if (kind === 'final') return String(rest.message ?? '').slice(0, 60);
  return '';
}
