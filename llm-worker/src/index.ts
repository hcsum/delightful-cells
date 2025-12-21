// Minimal ambient types to make Next.js type-check pass without Cloudflare types installed.
type Ai = any;
type ExportedHandler<TEnv = any> = {
  fetch: (request: Request, env: TEnv) => Promise<Response> | Response;
};

export interface Env {
  AI: Ai;
}

type ProcessRequest = {
  rows: string[];
  promptType: 'predefined' | 'custom';
  promptTemplate: string;
};

type ProcessResultItem = { input: string; output: string | null };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const rid = request.headers.get('x-request-id') || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const action = request.headers.get('x-action') || 'preview';
    const t0 = Date.now();
    const log = (...args: any[]) => { try { console.log('[cf-worker]', rid, action, ...args); } catch {} };
    const origin = request.headers.get('Origin') || '';
    // CORS preflight first
    if (request.method === 'OPTIONS') {
      log('preflight');
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    // Health check endpoint: allow GET to return a simple status
    if (request.method === 'GET') {
      return json({ status: 'ok', ts: new Date().toISOString(), note: 'llm-worker' }, 200, origin);
    }
    if (request.method !== 'POST') {
      log('method-not-allowed', request.method);
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders(origin) });
    }

    // Rate limit using Cloudflare Rate Limiting binding configured in wrangler (MY_RATE_LIMITER).
    // See https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
    try {
      const limiter: any = (env as any).MY_RATE_LIMITER;
      if (limiter && typeof limiter.limit === 'function') {
        // Use client IP, falling back to pathname as key if missing.
        const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-real-ip') || '';
        const { pathname } = new URL(request.url);
        const key = ip || pathname || 'anonymous';
        const res = await limiter.limit({ key });
        log('rl', { key, ...(res || {}) });
        if (!res?.success) {
          const extra: Record<string, string> = {};
          if (res.limit != null) extra['X-RateLimit-Limit'] = String(res.limit);
          if (res.remaining != null) extra['X-RateLimit-Remaining'] = String(res.remaining);
          if (res.reset != null) extra['X-RateLimit-Reset'] = String(res.reset);
          // Compute a Retry-After seconds hint for clients
          const nowSec = Math.floor(Date.now() / 1000);
          const retryAfterSec = res?.reset ? Math.max(1, Number(res.reset) - nowSec) : 60;
          extra['Retry-After'] = String(retryAfterSec);
          // Return a friendly, display-ready message along with a machine-readable code
          return json(
            {
              error: 'rate_limited',
              message: `Rate limit exceeded: max 20 requests per minute per IP. Try again in ${retryAfterSec}s.`,
              retryAfterSeconds: retryAfterSec,
            },
            429,
            origin,
            extra,
          );
        }
      }
    } catch (e) {
      log('rl-error', String(e));
    }

    let payload: ProcessRequest;
    try { payload = await request.json(); }
    catch (e) { log('bad-json', String(e)); return json({ error: 'Invalid JSON' }, 400, origin); }

    const rows = Array.isArray(payload.rows) ? payload.rows.map(String) : [];
    const promptTemplate = String(payload.promptTemplate || '').trim();
    if (!rows.length || !promptTemplate) { log('bad-input', { rows: rows.length, promptTemplateLen: promptTemplate.length }); return json({ error: 'rows and promptTemplate are required' }, 400, origin); }

    // Build messages for LLM
    const system = 'You extract structured values from text. Reply strictly as JSON. Preferred format: [{"input":"...","output":"...|null"}, ...] with one item per input row, preserving order. Alternate acceptable format: an object with numeric string keys ("1", "2", ...) mapping to outputs (string or null). No extra text.';
    const user = buildUserPrompt(rows, promptTemplate);

    // Call Workers AI with minimal retries for JSON validity
    let result: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      // Use a small, fast model for extraction tasks
      result = await env.AI.run('@cf/meta/llama-3.2-1b-instruct', {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 512,
        temperature: 0.2,
      });
      const parsed = tryParseFlexible(result?.response, rows.length);
      if (parsed) {
        log('ok', { ms: Date.now() - t0, attempt, out: parsed.length });
        return json({ results: alignResults(rows, parsed) }, 200, origin);
      }
      log('retry', { attempt, ms: Date.now() - t0, modelRespLen: (result?.response||'').length });
    }
    log('invalid-json', { ms: Date.now() - t0, resp: (result?.response||'').slice(0,256) });
    return json({ error: 'LLM returned invalid JSON' }, 502, origin);
  },
} satisfies ExportedHandler<Env>;

function buildUserPrompt(rows: string[], promptTemplate: string): string {
  // Provide explicit JSON response format instructions and echo inputs by index.
  const instructions = `Task: ${promptTemplate}\n\nRespond ONLY with JSON. Preferred: an array like [{"input":"original","output":"value or null"}] (one per input, in order). Alternate: an object like {"1":"value or null", "2":"value or null", ...}.`;
  const lines = rows.map((r, i) => `#${i+1}: ${r}`);
  return `${instructions}\n\nInputs by line:\n${lines.join('\n')}`;
}

function tryParseFlexible(raw: any, expected: number): ProcessResultItem[] | null {
  if (!raw || typeof raw !== 'string') return null;
  const tryJSON = (s: string): any | null => { try { return JSON.parse(s); } catch { return null; } };
  let data = tryJSON(raw);
  if (data == null) {
    // attempt to extract a JSON-looking substring
    const m = raw.match(/[\[{][\s\S]*[\]}]/);
    if (m) data = tryJSON(m[0]);
  }
  if (data == null) return null;

  // Case 1: preferred array shape
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    // Elements may be objects with {input, output}, or strings/nulls
    return data.map((x: any) => {
      if (x && typeof x === 'object' && ('output' in x || 'input' in x)) {
        return { input: String(x?.input ?? ''), output: (x?.output ?? null) } as ProcessResultItem;
      }
      // string or primitive -> treat as the output
      return { input: '', output: x == null ? null : String(x) } as ProcessResultItem;
    });
  }

  // Case 2: object mapping numeric keys to value
  if (data && typeof data === 'object') {
    const out: ProcessResultItem[] = [];
    for (let i = 1; i <= expected; i++) {
      const k = String(i);
      const v = (data as any)[k];
      out.push({ input: '', output: v == null ? null : String(v) });
    }
    return out;
  }

  return null;
}

function alignResults(rows: string[], items: ProcessResultItem[]): ProcessResultItem[] {
  if (items.length === rows.length) return items;
  const out: ProcessResultItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    out.push({ input: rows[i], output: items[i]?.output ?? null });
  }
  return out;
}

function json(body: any, status = 200, origin = '', extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(origin), ...(extraHeaders || {}) },
  });
}

function corsHeaders(origin: string) {
  const allowed = new Set<string>([
    'https://extract-excel-app-llm-worker.sumtsui.workers.dev',
    'https://extractfromexcel.com',
  ]);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-request-id, x-action, x-app',
    'Vary': 'Origin',
  };
  if (origin && allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
