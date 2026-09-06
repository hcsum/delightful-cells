// Generic client for calling the Next.js API route to process extractions.
// The API route (/api/process) proxies requests to the Cloudflare Worker.
// Expected payload: { rows: string[], toBeExtracted: string, extractFrom: string }
// Expected response: { results: { input: string, output: string|null }[] }

export type ProcessRequest = {
  rows: string[];
  toBeExtracted: string;
  extractFrom: string;
};

export type ProcessResultItem = { input: string; output: string | null };

export type ProcessResponse = {
  results: ProcessResultItem[];
};

type ProcessMeta = { action?: 'preview' | 'download'; userKey?: string; locale?: 'en' | 'zh'; onProgress?: (completed: number, total: number) => void };

export async function processRows(
  rows: string[],
  toBeExtracted: string,
  extractFrom: string,
  batchSize: number,
  signal?: AbortSignal,
  meta?: ProcessMeta
): Promise<ProcessResultItem[]> {
  // Call Next.js API route which proxies to the Cloudflare Worker.
  const base = '/api/process';
  const out: ProcessResultItem[] = [];
  const rid = genRequestId();
  const action = meta?.action ?? 'preview';
  const started = nowMs();
  // eslint-disable-next-line no-console
  console.debug('[processRows] begin', { rid, action, total: rows.length, batchSize, base });
  for (let i = 0; i < rows.length; i += batchSize) {
    const t0 = nowMs();
    const chunk = rows.slice(i, i + batchSize);
    const payload: ProcessRequest = { rows: chunk, toBeExtracted, extractFrom };
    let res: Response | null = null;
    // Log request body for debugging (truncated)
    try {
      const bodyStr = JSON.stringify(payload);
      // eslint-disable-next-line no-console
      console.debug('[processRows] request', {
        rid,
        action,
        idx: i,
        count: chunk.length,
        bodyBytes: bodyStr.length,
        bodyPreview: snippet(bodyStr, 1024),
      });
    } catch {}
    try {
      // Quota refusals come back as server-written prose; tell it the language.
      const extraHeaders: Record<string, string> = { 'x-locale': meta?.locale ?? 'en' };
      res = await fetch(base, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': rid,
          'x-action': action,
          'x-app': 'excel-extract-column-app',
          ...extraHeaders,
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
    // Log response info and a truncated preview of the body
    try {
      const ct = res.headers.get('content-type') || '';
      const respText = await res.clone().text();
      // eslint-disable-next-line no-console
      console.debug('[processRows] response', {
        rid,
        action,
        idx: i,
        status: res.status,
        dt,
        ct,
        respPreview: snippet(respText, 1024),
      });
    } catch {}
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
      const msg = (errJson && (errJson.message || errJson.error)) || snippet(errText) || `API error ${res.status}`;
      // eslint-disable-next-line no-console
      console.warn('[processRows] non-OK', { rid, action, status: res.status, dt, msg, errJson, errText: snippet(errText, 1024) });
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
      throw new Error('Invalid API response');
    }
    // Preserve input order within each chunk
    out.push(...json.results.map((r) => ({ input: String(r.input ?? ''), output: r.output ?? null })));
    try { meta?.onProgress?.(out.length, rows.length); } catch {}
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
