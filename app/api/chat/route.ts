// Chat proxy for Delightful Cells (/cells).
// Browser → here → llm-worker /chat (hides the shared x-api-key).
// POC: no auth, no quota — the worker's per-IP rate limiter is the backstop.
// MOCK_LLM=true answers locally with a scripted model so the whole agent loop
// runs without a Cloudflare account.

type FlatMessage = { role: string; content: string };

const MAX_MESSAGES = 30;
const MAX_TOTAL_CHARS = 24_000;
const ROLES = new Set(["system", "user", "assistant"]);

function json(body: unknown, status = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...(extra || {}),
    },
  });
}

export async function GET() {
  return json({ status: "ok", note: "api-chat" });
}

export async function POST(request: Request) {
  let body: { messages?: FlatMessage[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Invalid JSON body" }, 400);
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length || messages.length > MAX_MESSAGES) {
    return json(
      { error: "bad_messages", message: `messages must contain 1–${MAX_MESSAGES} items` },
      400,
    );
  }
  let totalChars = 0;
  for (const m of messages) {
    if (!m || !ROLES.has(m.role) || typeof m.content !== "string") {
      return json({ error: "bad_messages", message: "Each message needs a valid role and string content" }, 400);
    }
    totalChars += m.content.length;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return json(
      { error: "too_large", message: "Conversation too large — start a fresh chat or upload a smaller sheet" },
      400,
    );
  }

  if (process.env.MOCK_LLM === "true") {
    return json({ response: mockRespond(messages) });
  }

  const workerUrl = process.env.LLM_WORKER_URL;
  const apiKey = process.env.LLM_API_KEY || "";
  if (!workerUrl) {
    return json(
      { error: "not_configured", message: "LLM_WORKER_URL is not set. For local dev without a worker, set MOCK_LLM=true." },
      500,
    );
  }

  const requestId =
    request.headers.get("x-request-id") ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const upstream = await fetch(`${workerUrl.replace(/\/$/, "")}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-request-id": requestId,
      "x-app": "delightful-cells",
    },
    body: JSON.stringify({ messages }),
  });

  if (!upstream.ok) {
    const retryAfter = upstream.headers.get("Retry-After") || undefined;
    let message = `LLM worker error (${upstream.status})`;
    try {
      const upstreamBody = (await upstream.json()) as { message?: string };
      if (upstreamBody?.message) message = upstreamBody.message;
    } catch {}
    return json(
      { error: "upstream_error", message },
      upstream.status,
      retryAfter ? { "Retry-After": retryAfter } : undefined,
    );
  }

  const data = (await upstream.json()) as { response?: string };
  return json({ response: String(data?.response ?? "") });
}

// ---------------------------------------------------------------------------
// Scripted mock model: enough to demo the full loop offline.
// It reads column names out of the system prompt and keyword-matches the
// latest user message. Deliberately dumb — swap in the real worker for magic.

function mockRespond(messages: FlatMessage[]): string {
  const system = messages.find((m) => m.role === "system")?.content || "";
  const columnsLine = system.split("\n").find((l) => l.startsWith("Columns: ")) || "";
  const columns = columnsLine
    .replace("Columns: ", "")
    .split(" | ")
    .map((c) => c.trim())
    .filter(Boolean);
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const lower = lastUser.toLowerCase();

  // Step 2 of the loop: a tool result came back → produce a final answer.
  if (lastUser.startsWith("TOOL_RESULT")) {
    const payload = lastUser.replace(/^TOOL_RESULT [a-z_]+:\s*/i, "");
    return JSON.stringify({
      type: "final",
      message: `(mock) Done! Tool reported: ${payload.slice(0, 300)}`,
    });
  }

  // Pick the column: first one mentioned by name, else the first column.
  const mentioned = columns.find((c) => lower.includes(c.toLowerCase()));
  const column = mentioned || columns[0] || "Column A";

  // Demo path for the malformed-JSON fallback: say "be chatty" to get prose.
  if (lower.includes("be chatty")) {
    return "Sure thing! Let me think about that without any JSON at all...";
  }

  if (lower.includes("each") || lower.includes("new column") || lower.includes("every row")) {
    return JSON.stringify({
      type: "tool_call",
      tool: "transform_column",
      column,
      instruction: "the main keyword",
      newColumnName: `${column} keyword`,
    });
  }

  if (lower.includes("summar") || lower.includes("keyword")) {
    return JSON.stringify({ type: "tool_call", tool: "summarize_column", column });
  }

  const replaceMatch = lastUser.match(/replace\s+"?([^"]+?)"?\s+with\s+"?([^"]+?)"?(?:\s+in\b|$)/i);
  if (replaceMatch) {
    return JSON.stringify({
      type: "tool_call",
      tool: "find_replace",
      column,
      find: replaceMatch[1].trim(),
      replace: replaceMatch[2].trim(),
      matchCase: false,
    });
  }

  if (lower.includes("highlight") || lower.includes("filter") || lower.includes("show")) {
    const containsMatch = lastUser.match(/(?:highlight|filter|show)[^"]*"([^"]+)"/i);
    return JSON.stringify({
      type: "tool_call",
      tool: "filter_rows",
      column,
      op: containsMatch ? "contains" : "not_empty",
      value: containsMatch ? containsMatch[1] : "",
      mode: lower.includes("filter") || lower.includes("show") ? "filter" : "highlight",
    });
  }

  return JSON.stringify({
    type: "final",
    message:
      '(mock) I\'m the offline mock model. Try: "summarize <column>", "highlight rows containing \\"x\\"", or "replace a with b".',
  });
}
