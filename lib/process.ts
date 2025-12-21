// Generic client for calling the Cloudflare Worker to process extractions.
// The Worker is expected to implement POST {CF_URL}
// with payload: { rows: string[], promptType: 'predefined'|'custom', promptTemplate: string }
// and response: { results: { input: string, output: string|null }[] }

export type PromptType = 'predefined' | 'custom';

export type ProcessRequest = {
  rows: string[];
  promptType: PromptType;
  promptTemplate: string;
};

export type ProcessResultItem = { input: string; output: string | null };

export type ProcessResponse = {
  results: ProcessResultItem[];
};

export async function processRows(
  rows: string[],
  promptType: PromptType,
  promptTemplate: string,
  batchSize = 10,
  signal?: AbortSignal,
  meta?: { action?: 'preview' | 'download' }
): Promise<ProcessResultItem[]> {
  // Call LLM worker directly from the browser. Requires NEXT_PUBLIC_ URL at build time.
  // Fallback to the server proxy if configured.
  const base =
    process.env.NEXT_PUBLIC_CF_WORKER_URL ||
    // optional alias if used
    (process as any).env?.NEXT_PUBLIC_LLM_WORKER_URL ||
    (process as any).env?.CF_LLM_WORKER_URL ||
    '/api/process';
  const out: ProcessResultItem[] = [];
  const rid = genRequestId();
  const action = meta?.action ?? 'preview';
  const started = nowMs();
  // eslint-disable-next-line no-console
  console.debug('[processRows] begin', { rid, action, total: rows.length, batchSize, base });
  for (let i = 0; i < rows.length; i += batchSize) {
    const t0 = nowMs();
    const chunk = rows.slice(i, i + batchSize);
    const payload: ProcessRequest = { rows: chunk, promptType, promptTemplate };
    let res: Response | null = null;
    try {
      res = await fetch(base, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': rid,
          'x-action': action,
          'x-app': 'excel-extract-column-app',
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[processRows] fetch error', { rid, action, idx: i, err: String(e) });
      throw e;
    }
    const dt = (nowMs() - t0).toFixed(0);
    if (!res.ok) {
      let errText = '';
      let errJson: any = null;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          errJson = await res.json();
        } else {
          errText = await res.text();
        }
      } catch {}
      const msg = (errJson && (errJson.message || errJson.error)) || snippet(errText) || `Worker error ${res.status}`;
      // eslint-disable-next-line no-console
      console.warn('[processRows] non-OK', { rid, action, status: res.status, dt, msg });
      const e = new Error(String(msg));
      (e as any).status = res.status;
      (e as any).code = errJson?.error;
      (e as any).retryAfterSeconds = Number(res.headers.get('Retry-After') || errJson?.retryAfterSeconds || 0) || undefined;
      throw e;
    }
    let json: ProcessResponse | null = null;
    try {
      json = (await res.json()) as ProcessResponse;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[processRows] bad JSON', { rid, action, err: String(e) });
      throw e;
    }
    if (!json || !Array.isArray(json.results)) {
      // eslint-disable-next-line no-console
      console.error('[processRows] invalid response shape', { rid, action, json });
      throw new Error('Invalid worker response');
    }
    // Preserve input order within each chunk
    out.push(...json.results.map((r) => ({ input: String(r.input ?? ''), output: r.output ?? null })));
    // eslint-disable-next-line no-console
    console.debug('[processRows] batch ok', { rid, action, idx: i, count: chunk.length, dt });
  }
  // eslint-disable-next-line no-console
  console.debug('[processRows] done', { rid, action, total: rows.length, ms: (nowMs() - started).toFixed(0) });
  return out;
}

function nowMs(): number { try { return performance.now(); } catch { return Date.now(); } }
function genRequestId(): string { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function snippet(s: string, n = 256): string { return (s || '').slice(0, n); }
