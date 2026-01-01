import { decode, encode } from '@toon-format/toon'
import { addRowsToDailyQuota, getRowsUsedToday } from '@/lib/quota'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import { getLoggedInUserKeyFromRequest } from '@/lib/auth/session'

// Allow local/dev usage without sign-in when explicitly enabled via env.
// Use either NEXT_PUBLIC_BYPASS_AUTH (for simplicity) or BYPASS_AUTH (server-only).
const BYPASS_AUTH = (process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') || (process.env.BYPASS_AUTH === 'true');

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-request-id, x-action, x-app',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET() {
  const body = JSON.stringify({ status: 'ok', ts: new Date().toISOString(), note: 'api-process' });
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  // Get worker URL and shared API key from environment variables
  const workerUrl = process.env.LLM_WORKER_URL;
  const apiKey = process.env.LLM_API_KEY || '';
  
  if (!workerUrl) {
    return new Response(
      JSON.stringify({ 
        error: 'LLM_WORKER_URL not configured',
        message: 'Server configuration error: LLM worker URL is not set' 
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      }
    );
  }

  try {
    // Get request headers to forward
    const requestId = request.headers.get('x-request-id') || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const action = request.headers.get('x-action') || 'preview';
    const rid = request.headers.get('x-request-id') || '';
    const app = request.headers.get('x-app') || 'excel-extract-column-app';
    const origin = request.headers.get('Origin') || request.headers.get('origin') || '';
    const t0 = Date.now();

    // Get request body
    const body = await request.json();
    // Debug: log inbound request payload (truncated)
    try {
      const bodyStr = JSON.stringify(body);
      // Optional: preview inputs encoded as TOON (tab-delimited)
      let toonPreview: string | undefined;
      try {
        const rows = Array.isArray(body?.rows) ? body.rows.map((r: any) => ({ input: String(r) })) : [];
        if (rows.length) {
          const toon = encode({ inputs: rows }, { delimiter: '\t' });
          toonPreview = String(toon).slice(0, 512);
        }
      } catch {}
      console.debug('[api/process] request', {
        rid: requestId,
        action,
        rows: Array.isArray(body?.rows) ? body.rows.length : 0,
        bodyBytes: bodyStr.length,
        bodyPreview: bodyStr.slice(0, 1024),
        toonPreview,
      });
    } catch {}

    // Prepare TOON input (tab-delimited) to send along to the worker
    let toonForWorker: string | undefined;
    try {
      const rowsArr = Array.isArray(body?.rows) ? body.rows.map((r: any, i: number) => ({ id: i + 1, input: String(r) })) : [];
      if (rowsArr.length) toonForWorker = encode({ inputs: rowsArr }, { delimiter: '\t' });
    } catch {}

    // Enforce per-user daily quota measured in rows for ALL actions.
    // Require sign-in and count the actual rows we are about to process.
    const rowsCount = Array.isArray((body as any)?.rows) ? (body as any).rows.length : 0;
    const userKey = BYPASS_AUTH ? 'dev-local' : await getLoggedInUserKeyFromRequest(request);
    if (!userKey) {
      console.error('[api/process] auth required', { rid: requestId, action });
      return new Response(JSON.stringify({ error: 'auth_required', message: 'Sign in required' }), { status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    // Pre-check remaining quota before contacting the worker (optimistic; do not mutate state yet)
    if (rowsCount > 0) {
      try {
        const used = await getRowsUsedToday(userKey);
        if (used + rowsCount > DAILY_ROWS_LIMIT) {
          return new Response(JSON.stringify({ error: 'quota_exceeded', message: `Daily row limit reached (${DAILY_ROWS_LIMIT} rows per day)` }), { status: 429, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
        }
      } catch {}
    }

    // Forward request to LLM worker (include pre-encoded TOON)
    const workerResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': requestId,
        'x-action': action,
        'x-app': app,
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
        ...(origin ? { 'Origin': origin } : {}),
      },
      body: JSON.stringify({ ...body, ...(toonForWorker ? { toon: toonForWorker } : {}) }),
    });

    // Get response body
    const responseBody = await workerResponse.text();
    // Debug: log response from worker (truncated)
    try {
      const ct = workerResponse.headers.get('content-type') || '';
      const dt = Date.now() - t0;
      console.debug('[api/process] response', {
        rid: requestId,
        action,
        status: workerResponse.status,
        ct,
        dt,
        respBytes: responseBody.length,
        respPreview: responseBody.slice(0, 1024),
      });
    } catch {}
    // If worker responded OK, now charge quota and then extract results
    if (workerResponse.ok) {
      if (rowsCount > 0) {
        const ok2 = await addRowsToDailyQuota(userKey, rowsCount);
        if (!ok2) {
          return new Response(JSON.stringify({ error: 'quota_exceeded', message: `Daily row limit reached (${DAILY_ROWS_LIMIT} rows per day)` }), { status: 429, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
        }
      }
      const expected = Array.isArray(body?.rows) ? body.rows.length : 0;
      let decoded: any = null;
      try {
        const toonRaw = extractResultsToonBlock(responseBody)
          ?? extractUnfencedResultsSegment(responseBody)
          ?? responseBody;
        // First, repair missing tab separators between id/input and output, then normalize
        const toonText = normalizeResultsToon(fixMissingTabSeparator(toonRaw));
        decoded = decode(toonText, { strict: true });
      } catch (e) {
        console.warn('[api/process] decode failed (TOON)', { rid: requestId, action, err: String(e), respPreview: responseBody.slice(0, 512) });
        return new Response(
          JSON.stringify({ error: 'invalid_toon', message: 'Worker returned invalid TOON' }),
          { status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
        );
      }
      const items: any[] | null = Array.isArray((decoded as any)?.results) ? (decoded as any).results : null;
      if (!items) {
        console.warn('[api/process] no results array decoded', { rid: requestId, action });
        return new Response(
          JSON.stringify({ error: 'invalid_toon', message: 'Decoded TOON missing results' }),
          { status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
        );
      }
      let results: { input: string; output: string | null }[] = [];
      const hasId = items.some((x) => x && Object.prototype.hasOwnProperty.call(x, 'id'));
      if (hasId) {
        // Map by id -> original input, fill missing with nulls
        results = new Array(expected);
        for (let i = 0; i < expected; i++) {
          results[i] = { input: String(body.rows[i] ?? ''), output: null };
        }
        for (const it of items) {
          const idNum = Number(it?.id);
          if (!Number.isFinite(idNum)) continue;
          const idx = idNum - 1;
          if (idx < 0 || idx >= expected) continue;
          results[idx] = { input: String(body.rows[idx] ?? ''), output: it?.output == null ? null : String(it.output) };
        }
      } else {
        // Positional mapping; pad/truncate to expected
        results = new Array(expected);
        for (let i = 0; i < expected; i++) {
          const it = items[i];
          const out = it?.output == null ? null : String(it.output);
          const input = String((it?.input ?? body.rows[i] ?? ''));
          results[i] = { input, output: out };
        }
      }
      const jsonBody = JSON.stringify({ results });
      return new Response(jsonBody, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }

    // Non-OK: forward error body and relevant headers
    const headers: Record<string, string> = {
      'content-type': workerResponse.headers.get('content-type') || 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    };
    const rateLimitHeaders = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'];
    rateLimitHeaders.forEach(headerName => {
      const value = workerResponse.headers.get(headerName);
      if (value) headers[headerName] = value;
    });
    return new Response(responseBody, { status: workerResponse.status, statusText: workerResponse.statusText, headers });
  } catch (error) {
    console.error('[api/process] Error proxying to worker:', error);
    return new Response(
      JSON.stringify({ 
        error: 'proxy_error',
        message: error instanceof Error ? error.message : 'Failed to proxy request to LLM worker' 
      }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      }
    );
  }
}

// Some models may echo the input TOON block and then place the results block after it.
// This helper finds the last fenced ```toon block that begins with a results header and returns its content.
function extractResultsToonBlock(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const re = /```toon\s*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  let candidate: string | null = null;
  let lastAny: string | null = null;
  while ((m = re.exec(raw)) !== null) {
    const block = m[1].trim();
    lastAny = block;
    // Accept headers with tab, comma, or even missing delimiter between field names; normalize later
    if (/^results\[\d+(?:\t|,)?\]\{\s*(?:id|input)(?:\t|,|\s*)output\s*\}:/.test(block)) {
      candidate = block; // pick the last matching block
    }
  }
  // Fallback to last fenced toon block if none matched the strict header
  return candidate ?? lastAny;
}

// Fallback for unfenced responses: find the first results header and take from there to the end
function extractUnfencedResultsSegment(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/results\[\d+(?:\t|,)?\]\{\s*(?:id|input)(?:\t|,|\s*)output\s*\}:[\s\S]*$/);
  return m ? m[0] : null;
}

// Some models may omit the tab between field names in the header, e.g. {inputoutput}
// This normalizer attempts to repair the header to {input\toutput} while leaving other parts intact.
function normalizeResultsToon(raw: string): string {
  try {
    // Replace literal backslash-t with a real tab everywhere
    let out = raw.replace(/\\t/g, '\t');
    // Normalize header fields to tab-delimited exactly once (support id or input)
    out = out.replace(/\{\s*input\s*(?:,|\t|\s*)\s*output\s*\}/, '{input\toutput}');
    out = out.replace(/\{\s*id\s*(?:,|\t|\s*)\s*output\s*\}/, '{id\toutput}');
    // If missing delimiter after [N], inject a tab
    out = out.replace(/^results\[(\d+)\](?=\{)/m, 'results[$1\t]');
    // Normalize line endings
    out = out.replace(/\r\n/g, '\n');
    // Collapse multiple tabs in data rows, fill missing outputs, drop blank rows, and fix header count
    let lines = out.split('\n');
    const headerIdx = lines.findIndex((ln) => /^results\[\d+(?:\t|,)?\]\{\s*(?:id|input)(?:\t|,|\s*)output\s*\}:\s*$/.test((ln || '').trim()));
    if (headerIdx >= 0) {
      const head = lines[headerIdx];
      const data: string[] = [];
      for (let i = headerIdx + 1; i < lines.length; i++) {
        let ln = lines[i] || '';
        if (!ln.trim()) continue; // drop empty rows
        if (!/^\s{2}/.test(ln)) continue; // only keep indented data rows
        // collapse multiple tabs
        ln = ln.replace(/\t{2,}/g, '\t');
        // if line has no tab, append a null output; if ends with a tab, also append null
        if (!ln.includes('\t') || /\t\s*$/.test(ln)) ln = ln.replace(/\s*$/, '') + '\tnull';
        data.push(ln);
      }
      // Fix header count to actual data rows
      const newCount = data.length;
      const fixedHead = head
        .replace(/^(results\[)\d+((?:\t|,)?\]\{.*)/, `$1${newCount}$2`)
        .replace(/^results\[(\d+)\](?=\{)/, 'results[$1\t]');
      lines = [fixedHead, ...data];
    }
    return lines.join('\n');
  } catch {
    return raw;
  }
}

// Repair rows missing a tab between id/input and output, e.g. "  2 null" -> "  2\tnull"
function fixMissingTabSeparator(raw: string): string {
  try {
    const lines = (raw || '').split('\n');
    const headerRe = /^results\[\d+(?:\t|,)?\]\{\s*(?:id|input)(?:\t|,|\s*)output\s*\}:\s*$/;
    const headerIdx = lines.findIndex((ln) => headerRe.test((ln || '').trim()));
    if (headerIdx < 0) return raw;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const ln = lines[i] || '';
      if (!/^\s{2}/.test(ln)) continue; // data rows usually start with two spaces
      if (ln.includes('\t')) continue; // already has a tab
      // Insert a single tab between the first number (id) and the rest, or between first token and rest
      const fixed = ln.replace(/^\s{2}(\d+)\s+(.+)$/, '  $1\t$2')
                      .replace(/^\s{2}([^\t]+?)\s+(.+)$/, '  $1\t$2');
      lines[i] = fixed;
    }
    return lines.join('\n');
  } catch {
    return raw;
  }
}
