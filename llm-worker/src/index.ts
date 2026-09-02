// Minimal ambient types to make Next.js type-check pass without Cloudflare types installed.
type Ai = any;
type ExportedHandler<TEnv = any> = {
  fetch: (request: Request, env: TEnv) => Promise<Response> | Response;
};

export interface Env {
  AI: Ai;
  LLM_API_KEY?: string;
}

type ProcessRequest = {
  rows: string[];
  toBeExtracted: string;
  extractFrom: string;
};

type ChatMessage = { role: string; content: string };
type ChatRequest = { messages: ChatMessage[] };

// Workers AI answers in two shapes: the older models return { response },
// the OpenAI-schema ones (glm, gpt-oss, …) return { choices: [{ message }] }.
// Reasoning models also put their thinking in reasoning_content, or inline it
// in a <think> block — neither belongs in the answer we hand back.
function extractText(result: any): string {
  const raw =
    result?.response ??
    result?.choices?.[0]?.message?.content ??
    result?.choices?.[0]?.text ??
    '';
  const text = typeof raw === 'string' ? raw : raw != null ? JSON.stringify(raw) : '';
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim();
}

// One model for both endpoints. Alternatives: @cf/meta/llama-4-scout-17b-16e-instruct,
// @cf/openai/gpt-oss-20b, @cf/zai-org/glm-5.3-flash (needs a paid billing method).
const MODEL = '@cf/zai-org/glm-4.7-flash';

const CHAT_ROLES = new Set(['system', 'user', 'assistant']);
const CHAT_MAX_MESSAGES = 30;
const CHAT_MAX_TOTAL_CHARS = 24000;


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

    // Verify shared API key
    const key = request.headers.get('x-api-key') || '';
    const expected = (env as any).LLM_API_KEY || '';
    if (!expected || key !== expected) {
      // Return 401 with no body (unauthorized with no message)
      return new Response('', { status: 401, headers: corsHeaders(origin) });
    }

    // Chat endpoint for Delightful.cells (/cells). Rate limiting and the
    // x-api-key check above already ran; this branch never touches TOON.
    const { pathname } = new URL(request.url);
    if (pathname === '/chat') {
      let chatPayload: ChatRequest;
      try { chatPayload = await request.json(); }
      catch (e) { log('chat-bad-json', String(e)); return json({ error: 'invalid_json', message: 'Invalid JSON' }, 400, origin); }
      const messages = Array.isArray(chatPayload?.messages) ? chatPayload.messages : [];
      if (!messages.length || messages.length > CHAT_MAX_MESSAGES) {
        return json({ error: 'bad_messages', message: `messages must contain 1-${CHAT_MAX_MESSAGES} items` }, 400, origin);
      }
      let totalChars = 0;
      for (const m of messages) {
        if (!m || !CHAT_ROLES.has(String(m.role)) || typeof m.content !== 'string') {
          return json({ error: 'bad_messages', message: 'Each message needs a valid role and string content' }, 400, origin);
        }
        totalChars += m.content.length;
      }
      if (totalChars > CHAT_MAX_TOTAL_CHARS) {
        return json({ error: 'too_large', message: 'Conversation too large' }, 400, origin);
      }
      const chatResult = await env.AI.run(MODEL, {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 1024,
        temperature: 0,
        // GLM thinks out loud by default: ~10x the output tokens for the same
        // answer, and its <think> text breaks our one-JSON-object contract.
        chat_template_kwargs: { enable_thinking: false },
      } as any);
      const chatText = extractText(chatResult);
      log('chat-ok', { ms: Date.now() - t0, bytes: chatText.length, messages: messages.length });
      return json({ response: chatText }, 200, origin, usageHeaders(chatResult));
    }

    let payload: ProcessRequest;
    try { payload = await request.json(); }
    catch (e) { log('bad-json', String(e)); return json({ error: 'Invalid JSON' }, 400, origin); }

    const rows = Array.isArray(payload.rows) ? payload.rows.map(String) : [];
    const toBeExtracted = String(payload.toBeExtracted || '').trim();
    const extractFrom = String(payload.extractFrom || '').trim();
    if (!rows.length || !toBeExtracted || !extractFrom) { log('bad-input', { rows: rows.length, toBeExtracted, extractFrom }); return json({ error: 'rows, toBeExtracted, and extractFrom are required' }, 400, origin); }

    // Construct prompts

    // Build messages for LLM using TOON format for both input and output.
    // We use tab (\t) as delimiter to avoid quoting issues with commas.
    const system = [
      'You extract structured values from text. You will be given input data encoded in TOON (Token-Oriented Object Notation).',
      'Respond ONLY with a single fenced code block labeled "toon" that contains valid TOON.',
      'Output requirements:',
      '- Header must be: results[N\t]{id\toutput}: where N equals the number of inputs.',
      '- Use a tab (\\t) as delimiter and 2-space indentation for each row.',
      '- Emit exactly one row per input id:  "  <id>\t<extracted-value>" or "  <id>\tnull" if not found.',
      '- Do NOT echo the inputs block. No commentary before or after the code block.',
    ].join(' ');
    // Require caller-provided TOON input; do not fallback to building it here.
    const toonInput = typeof (payload as any).toon === 'string' ? (payload as any).toon : '';
    if (!toonInput.trim()) {
      log('missing-toon', { rows: rows.length });
      return json({ error: 'toon_required', message: 'TOON input is required in request body as "toon"' }, 400, origin);
    }
    const user = [
      'Data is in TOON format (tab-separated).',
      '```toon',
      toonInput,
      '```',
      `Task: For each input, extract ${toBeExtracted} from the ${extractFrom}.`,
      'Return ONLY a single TOON code block. Use header: results[N\t]{id\toutput}: where N matches the input count. Emit exactly one row per id in ascending order. Set output to null when not found. Do NOT echo the inputs block.',
      'Example output:',
      '```toon',
      'results[2\t]{id\toutput}:',
      '  1\tSpringfield',
      '  2\tnull',
      '```',
    ].join('\n');
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 2048,
      temperature: 0,
      // Same as /chat: thinking would eat the token budget before the model
      // ever emits the TOON block.
      chat_template_kwargs: { enable_thinking: false },
    } as any);
    const text = extractText(result);
    log('ok', { ms: Date.now() - t0, bytes: text.length });
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(origin), ...usageHeaders(result) },
    });
  },
} satisfies ExportedHandler<Env>;

// Token usage reported by Workers AI, passed to the app so it can meter itself.
function usageHeaders(result: any): Record<string, string> {
  const u = result?.usage || {};
  const inTok = Number(u.prompt_tokens) || 0;
  const outTok = Number(u.completion_tokens) || 0;
  // Workers AI reports what the call actually cost. Forward it so callers never
  // have to re-derive neurons from a price table that goes stale on model swaps.
  const neurons = Number(u.neurons) || 0;
  if (!inTok && !outTok) return {};
  return {
    'x-usage-in': String(inTok),
    'x-usage-out': String(outTok),
    ...(neurons ? { 'x-usage-neurons': String(neurons) } : {}),
  };
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
    'https://delightfulcells.com',
    'https://www.delightfulcells.com',
    'https://extractfromexcel.com',
    'https://www.extractfromexcel.com',
    'http://localhost:3000',
  ]);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-request-id, x-action, x-app',
    'Vary': 'Origin',
  };
  if (origin && allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
