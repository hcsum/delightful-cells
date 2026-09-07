// Generic client for calling the Next.js API route to process extractions.
// The API route (/api/process) proxies requests to the Cloudflare Worker.
// Expected payload: { rows: string[], toBeExtracted: string, extractFrom: string }
// Expected response: { results: { input: string, output: string|null }[] }
//
// A run is a sequential loop of batch-sized POSTs, and it is the ONLY place a
// run exists — there is no server-side job record. So this file owns the whole
// story of what happens when one batch of a long run fails:
//
//   retry with backoff → split into smaller batches → give up on those rows and
//   keep going → hand back everything that did succeed.
//
// It never throws for a batch failure. Batches are billed individually and only
// on success (app/api/process/route.ts), so throwing away completed batches
// throws away rows the user already paid for. Callers get a ProcessOutcome and
// decide what to do with the holes.

import { AI_RETRY_SPLIT_ROWS } from '@/lib/limits';

export type ProcessRequest = {
  rows: string[];
  toBeExtracted: string;
  extractFrom: string;
};

export type ProcessResultItem = { input: string; output: string | null };

export type ProcessResponse = {
  results: ProcessResultItem[];
  /**
   * Indices within THIS request whose row the worker never answered for, as
   * opposed to answered with a null. A 200 can still be short: the worker caps
   * output tokens, and a long reply is cut off mid-list. Without this the
   * truncated rows would look like "the model found nothing" and never be
   * retried — which is exactly the failure the splitting below exists for.
   */
  missing?: number[];
};

/** Why a run ended before every row was attempted. */
export type ProcessStop = {
  reason: 'fatal' | 'aborted';
  message: string;
  code?: string;
};

export type ProcessOutcome = {
  /** Always rows.length long, in input order. No answer → output is null. */
  results: ProcessResultItem[];
  /** Indices with no answer after retries, splitting, or an early stop. */
  failedIndices: number[];
  /** Set when the run stopped early; every unattempted row is in failedIndices. */
  stopped?: ProcessStop;
};

type ProcessMeta = {
  action?: 'preview' | 'download';
  userKey?: string;
  locale?: 'en' | 'zh';
  onProgress?: (completed: number, total: number) => void;
};

// Retrying cannot fix these: the allowance is spent, or the request itself is
// malformed. Stop and tell the user, rather than burning three more calls.
const FATAL_CODES = new Set([
  'quota_exceeded',
  'site_quota_exceeded',
  'rows_per_run_exceeded',
]);

// Backoff before retry 1 and retry 2 of a full-size batch.
const RETRY_DELAYS_MS = [1000, 3000];
// A server's Retry-After is honoured up to a minute. The worker's rate limiter
// counts requests per minute, so its hint is at most 60s and coming back any
// earlier just burns a retry on a window that has not reset yet. Anything
// longer than this is some other server's idea of "later" and not worth the
// stall — we spend a retry and let the row fail if it fails.
const MAX_RETRY_AFTER_MS = 60_000;

type BatchError = {
  message: string;
  code?: string;
  status?: number;
  fatal: boolean;
  aborted: boolean;
  retryAfterMs?: number;
};

export async function processRows(
  rows: string[],
  toBeExtracted: string,
  extractFrom: string,
  batchSize: number,
  signal?: AbortSignal,
  meta?: ProcessMeta
): Promise<ProcessOutcome> {
  const rid = genRequestId();
  const action = meta?.action ?? 'preview';
  const started = nowMs();
  // Pre-filled so a partial result needs no merging: every slot already holds
  // the right input, and a successful batch just overwrites its own outputs.
  const results: ProcessResultItem[] = rows.map((r) => ({ input: String(r ?? ''), output: null }));
  // A null output can mean two different things — the model had no answer, or
  // we never got an answer out of the server. Only the second is a "failed"
  // row, so track it rather than inferring it from the output.
  const answered: boolean[] = new Array(rows.length).fill(false);
  let done = 0;
  let stopped: ProcessStop | undefined;

  const report = () => { try { meta?.onProgress?.(done, rows.length); } catch {} };

  // eslint-disable-next-line no-console
  console.debug('[processRows] begin', { rid, action, total: rows.length, batchSize });

  for (let i = 0; i < rows.length; i += batchSize) {
    if (signal?.aborted) {
      stopped = { reason: 'aborted', message: 'Canceled' };
      break;
    }
    const end = Math.min(i + batchSize, rows.length);
    const batchIndex = Math.floor(i / batchSize);
    // Rows are addressed by index from here down, not by range: recovery re-runs
    // whichever rows are still unanswered, and those need not be contiguous.
    const indices: number[] = [];
    for (let k = i; k < end; k++) indices.push(k);
    const stop = await runBatchWithRetries(
      rows, indices, batchIndex, toBeExtracted, extractFrom, signal, meta, rid, action, results, answered
    );
    if (stop) {
      stopped = stop;
      break;
    }
    done = end;
    report();
  }

  // Anything still unanswered is a hole: rows we gave up on, and — after an
  // early stop — every row the run never reached. The caller shouldn't have to
  // reconstruct either set.
  const failedIndices: number[] = [];
  for (let i = 0; i < rows.length; i++) if (!answered[i]) failedIndices.push(i);
  if (stopped) { done = rows.length - failedIndices.length; report(); }

  // eslint-disable-next-line no-console
  console.debug('[processRows] done', {
    rid, action, total: rows.length, failed: failedIndices.length,
    stopped: stopped?.reason, ms: (nowMs() - started).toFixed(0),
  });
  return { results, failedIndices, ...(stopped ? { stopped } : {}) };
}

/**
 * One batch, with the full ladder: two backoff retries at full size, then the
 * same rows split into AI_RETRY_SPLIT_ROWS-sized pieces with one retry each.
 *
 * Splitting is not just a second chance. The worker caps output tokens, so a
 * batch that is too wordy for the cap fails the same way every time at full
 * size and succeeds once it is cut up.
 */
async function runBatchWithRetries(
  rows: string[], indices: number[], batchIndex: number,
  toBeExtracted: string, extractFrom: string,
  signal: AbortSignal | undefined, meta: ProcessMeta | undefined,
  rid: string, action: string,
  results: ProcessResultItem[],
  answered: boolean[],
): Promise<ProcessStop | undefined> {
  let lastErr: BatchError | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      const wait = lastErr?.retryAfterMs ?? RETRY_DELAYS_MS[attempt - 1];
      // eslint-disable-next-line no-console
      console.warn('[processRows] retrying batch', { rid, action, batchIndex, attempt, wait, err: lastErr?.message });
      const slept = await sleep(wait, signal);
      if (!slept) return { reason: 'aborted', message: 'Canceled' };
    }
    const err = await attemptRows(rows, indices, batchIndex, toBeExtracted, extractFrom, signal, meta, rid, action, results, answered);
    if (!err) {
      // A 200 is not the same as a complete answer. When the reply was cut off
      // at the worker's output-token cap, /api/process says which rows never
      // came back; pick up exactly those, small enough to fit under the cap.
      // Only they are re-sent, so the rows we already have are not paid for twice.
      const missing = indices.filter((i) => !answered[i]);
      if (missing.length === 0) return undefined;
      // eslint-disable-next-line no-console
      console.warn('[processRows] partial batch', { rid, action, batchIndex, missing: missing.length });
      return runSplit(rows, missing, batchIndex, toBeExtracted, extractFrom, signal, meta, rid, action, results, answered);
    }
    if (err.aborted) return { reason: 'aborted', message: err.message };
    if (err.fatal) return { reason: 'fatal', message: err.message, code: err.code };
    lastErr = err;
  }

  // Full size is hopeless. Cut it up: most of these rows are still recoverable.
  // eslint-disable-next-line no-console
  console.warn('[processRows] splitting batch', { rid, action, batchIndex, size: indices.length, err: lastErr?.message });
  return runSplit(rows, indices, batchIndex, toBeExtracted, extractFrom, signal, meta, rid, action, results, answered);
}

/**
 * Last resort for a set of rows: AI_RETRY_SPLIT_ROWS at a time, one retry each.
 * Rows still unanswered when this returns stay that way — the run goes on and
 * the caller reports them, rather than paying for a fourth and fifth round.
 */
async function runSplit(
  rows: string[], indices: number[], batchIndex: number,
  toBeExtracted: string, extractFrom: string,
  signal: AbortSignal | undefined, meta: ProcessMeta | undefined,
  rid: string, action: string,
  results: ProcessResultItem[],
  answered: boolean[],
): Promise<ProcessStop | undefined> {
  for (let s = 0; s < indices.length; s += AI_RETRY_SPLIT_ROWS) {
    const piece = indices.slice(s, s + AI_RETRY_SPLIT_ROWS);
    let subErr = await attemptRows(rows, piece, batchIndex, toBeExtracted, extractFrom, signal, meta, rid, action, results, answered);
    if (subErr && !subErr.aborted && !subErr.fatal) {
      const slept = await sleep(subErr.retryAfterMs ?? RETRY_DELAYS_MS[0], signal);
      if (!slept) return { reason: 'aborted', message: 'Canceled' };
      subErr = await attemptRows(rows, piece, batchIndex, toBeExtracted, extractFrom, signal, meta, rid, action, results, answered);
    }
    if (!subErr) continue;
    if (subErr.aborted) return { reason: 'aborted', message: subErr.message };
    if (subErr.fatal) return { reason: 'fatal', message: subErr.message, code: subErr.code };
    // Out of moves for these rows. They stay unanswered and the run goes on.
  }
  return undefined;
}

/** One POST for the given row indices. Writes outputs in place; null on success. */
async function attemptRows(
  rows: string[], indices: number[], batchIndex: number,
  toBeExtracted: string, extractFrom: string,
  signal: AbortSignal | undefined, meta: ProcessMeta | undefined,
  rid: string, action: string,
  results: ProcessResultItem[],
  answered: boolean[],
): Promise<BatchError | null> {
  const start = indices[0] ?? 0;
  const chunk = indices.map((i) => rows[i]);
  const payload: ProcessRequest = { rows: chunk, toBeExtracted, extractFrom };
  const t0 = nowMs();

  const injected = injectedFailure(batchIndex);
  if (injected) return injected;

  let res: Response;
  try {
    res = await fetch('/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': rid,
        'x-action': action,
        'x-app': 'excel-extract-column-app',
        // Quota refusals come back as server-written prose; tell it the language.
        'x-locale': meta?.locale ?? 'en',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    const aborted = (e as any)?.name === 'AbortError';
    // eslint-disable-next-line no-console
    console.error('[processRows] fetch error', { rid, action, start, aborted, err: String(e) });
    return { message: String((e as any)?.message || e), fatal: false, aborted };
  }

  if (!res.ok) {
    let errText = '';
    let errJson: any = null;
    try {
      if ((res.headers.get('content-type') || '').includes('application/json')) errJson = await res.json();
      else errText = await res.text();
    } catch {}
    const code = errJson?.error as string | undefined;
    const message = (errJson && (errJson.message || errJson.error)) || snippet(errText) || `API error ${res.status}`;
    const retryAfter = Number(res.headers.get('Retry-After') || errJson?.retryAfterSeconds || 0) || 0;
    // eslint-disable-next-line no-console
    console.warn('[processRows] non-OK', { rid, action, status: res.status, code, dt: (nowMs() - t0).toFixed(0), message });
    return {
      message: String(message),
      code,
      status: res.status,
      // A 429 from the worker's rate limiter is a "come back later", not a
      // refusal — only the quota codes below are actually terminal.
      fatal: isFatal(res.status, code),
      aborted: false,
      retryAfterMs: retryAfter > 0 ? Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS) : undefined,
    };
  }

  let json: ProcessResponse | null = null;
  try {
    json = (await res.json()) as ProcessResponse;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[processRows] bad JSON', { rid, action, err: String(e) });
    return { message: 'Invalid API response', fatal: false, aborted: false };
  }
  if (!json || !Array.isArray(json.results)) {
    // eslint-disable-next-line no-console
    console.error('[processRows] invalid response shape', { rid, action });
    return { message: 'Invalid API response', fatal: false, aborted: false };
  }

  // Truncated replies come back as a 200 with holes in them. A row the server
  // lists as missing keeps its null and stays unanswered, so the recovery pass
  // above sees it; a row answered with a null is finished and does not.
  const missing = new Set(Array.isArray(json.missing) ? json.missing : []);
  for (let k = 0; k < chunk.length; k++) {
    const r = json.results[k];
    results[indices[k]] = {
      input: String(r?.input ?? chunk[k] ?? ''),
      output: r?.output ?? null,
    };
    answered[indices[k]] = !missing.has(k);
  }
  // eslint-disable-next-line no-console
  console.debug('[processRows] batch ok', { rid, action, start, count: chunk.length, dt: (nowMs() - t0).toFixed(0) });
  return null;
}

function isFatal(status: number, code?: string): boolean {
  if (code && FATAL_CODES.has(code)) return true;
  return status === 400 || status === 401 || status === 403;
}

/** Resolves false if the wait was cut short by an abort. */
function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { cleanup(); resolve(true); }, ms);
    const onAbort = () => { clearTimeout(timer); cleanup(); resolve(false); };
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    signal?.addEventListener('abort', onAbort);
  });
}

/**
 * Dev-only fault injection. There is no test framework here, and a failure that
 * only happens on batch 37 of a nine-minute run is otherwise unreproducible.
 *
 *   localStorage.__failBatches = '3,5'   // batch indices, 0-based
 *   localStorage.__failMode    = '500' | 'toon' | 'network' | 'quota'
 *   localStorage.__failTimes   = '2'     // fail this many attempts, then pass
 *                                        // (omit for "always", which is what
 *                                        //  exercises the split-and-give-up path)
 */
const injectedAttempts = new Map<number, number>();

function injectedFailure(batchIndex: number): BatchError | null {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const raw = window.localStorage.getItem('__failBatches');
    if (!raw) return null;
    const hit = raw.split(',').map((s) => Number(s.trim())).includes(batchIndex);
    if (!hit) return null;
    const limit = Number(window.localStorage.getItem('__failTimes') || 0);
    const seen = (injectedAttempts.get(batchIndex) ?? 0) + 1;
    injectedAttempts.set(batchIndex, seen);
    if (limit > 0 && seen > limit) return null;
    const mode = window.localStorage.getItem('__failMode') || '500';
    // eslint-disable-next-line no-console
    console.warn('[processRows] INJECTED FAILURE', { batchIndex, mode, attempt: seen });
    if (mode === 'network') return { message: 'Injected network error', fatal: false, aborted: false };
    if (mode === 'toon') return { message: 'Worker returned invalid TOON', code: 'invalid_toon', status: 502, fatal: false, aborted: false };
    if (mode === 'quota') return { message: 'Daily row limit reached', code: 'quota_exceeded', status: 429, fatal: true, aborted: false };
    return { message: 'Injected API error 500', status: 500, fatal: false, aborted: false };
  } catch {
    return null;
  }
}

function nowMs(): number { try { return performance.now(); } catch { return Date.now(); } }
function genRequestId(): string { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function snippet(s: string, n = 256): string { return (s || '').slice(0, n); }
