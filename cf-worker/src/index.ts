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
    // CORS preflight first
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });
    }

    let payload: ProcessRequest;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const rows = Array.isArray(payload.rows) ? payload.rows.map(String) : [];
    const promptTemplate = String(payload.promptTemplate || '').trim();
    if (!rows.length || !promptTemplate) {
      return json({ error: 'rows and promptTemplate are required' }, 400);
    }

    // Build messages for LLM
    const system = 'You extract structured values from text. Reply strictly as JSON: [{"input":"...","output":"...|null"}, ...] with one item per input row, preserving order.';
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
      const parsed = tryParseResults(result?.response);
      if (parsed) {
        return json({ results: alignResults(rows, parsed) }, 200);
      }
    }

    return json({ error: 'LLM returned invalid JSON' }, 502);
  },
} satisfies ExportedHandler<Env>;

function buildUserPrompt(rows: string[], promptTemplate: string): string {
  // Provide explicit JSON response format instructions and echo inputs by index.
  const instructions = `Task: ${promptTemplate}\n\nYou must respond ONLY with JSON array. Example: [{"input":"original","output":"value or null"}]. Preserve input order.`;
  const lines = rows.map((r, i) => `#${i+1}: ${r}`);
  return `${instructions}\n\nInputs by line:\n${lines.join('\n')}`;
}

function tryParseResults(raw: any): ProcessResultItem[] | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    return data.map((x) => ({ input: String(x?.input ?? ''), output: x?.output ?? null }));
  } catch {
    return null;
  }
}

function alignResults(rows: string[], items: ProcessResultItem[]): ProcessResultItem[] {
  if (items.length === rows.length) return items;
  const out: ProcessResultItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    out.push({ input: rows[i], output: items[i]?.output ?? null });
  }
  return out;
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  } as Record<string, string>;
}
