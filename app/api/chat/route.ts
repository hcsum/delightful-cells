// Chat proxy for Delightful Cells (/cells).
// Browser → here → llm-worker /chat (hides the shared x-api-key).
// Billing order per request: site budget for the tier → today's free turns →
// credit balance. MOCK_LLM=true answers locally with a scripted model so the
// whole agent loop runs without a Cloudflare account.

import {
  asPaid,
  billChatTurn,
  guardTurnCalls,
  resolveEntitlement,
} from "@/lib/billing/entitlement";
import { meterAndCharge } from "@/lib/billing/meter";
import { isFreeTierExhausted, localeFromRequest, siteQuotaMessage } from "@/lib/usage";
import { getClientIp } from "@/lib/client-ip";

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

  let ent = await resolveEntitlement(request);

  // A turn id groups the up-to-MAX_STEPS calls one user message produces; the
  // allowance is spent once per turn, not once per call. The per-turn cap is
  // the backstop against a forged id being reused to make the allowance look
  // untouched, so it applies to paid calls too.
  const turnId = request.headers.get("x-turn-id") || requestIdFor(request);
  if (!(await guardTurnCalls(turnId))) {
    return json(
      {
        error: "quota_exceeded",
        message: "That turn made too many AI calls. Start a new message.",
      },
      429,
    );
  }

  // Site budget before the free allowance: when the shared budget for this
  // tier is gone, credits are the way through, and there is no sense spending
  // a free turn on a call that will be billed anyway.
  if (await isFreeTierExhausted(ent.baseTier)) {
    if (ent.balanceNeurons > 0) ent = asPaid(ent);
    else
      return json(
        {
          error: "site_quota_exceeded",
          // What unblocks them differs by tier: sign in, or buy credits.
          action: ent.baseTier === "anon" ? "sign_in" : "buy_credits",
          message: siteQuotaMessage(ent.baseTier, localeFromRequest(request)),
        },
        429,
      );
  }

  if (ent.tier !== "paid") {
    const billing = await billChatTurn(ent, turnId);
    if (billing.mode === "exceeded") {
      return json(
        {
          error: "quota_exceeded",
          message: `Daily chat limit reached (${ent.limits.chatTurns} turns per day). Sign in or top up credits to keep going.`,
        },
        429,
      );
    }
    if (billing.mode === "paid") ent = asPaid(ent);
  }

  // Mocked *after* billing on purpose: the tier and quota logic is the part
  // worth exercising offline, and the mock reports no usage so nothing is spent.
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

  const requestId = requestIdFor(request);

  const upstream = await fetch(`${workerUrl.replace(/\/$/, "")}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-request-id": requestId,
      "x-app": "delightful-cells",
      // Trusted by the worker because x-api-key already proves this is us.
      "x-client-ip": getClientIp(request),
      "x-tier": ent.tier,
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

  const charged = await meterAndCharge(upstream.headers, ent, "chat", requestId);
  const data = (await upstream.json()) as { response?: string };
  return json(
    { response: String(data?.response ?? "") },
    200,
    // The client shows a one-time notice the first time a call is billed to
    // credits rather than to the free allowance.
    ent.tier === "paid" ? { "x-billed-neurons": String(charged) } : undefined,
  );
}

function requestIdFor(request: Request): string {
  return (
    request.headers.get("x-request-id") ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
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
  const scope =
    /selected rows: the user has selected/i.test(system) && /\b(these|selected|picked)\b/.test(lower)
      ? "selection"
      : "all";

  // Step 2 of the loop: a tool result came back → produce a final answer.
  if (lastUser.startsWith("TOOL_RESULT")) {
    const firstAsk = messages.find((m) => m.role === "user")?.content.toLowerCase() || "";
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

  if (lower.includes("sounds") || lower.includes("angry") || lower.includes("negative")) {
    return JSON.stringify({
      type: "tool_call",
      tool: "filter_rows_ai",
      scope,
      column,
      criteria: "sounds angry",
      mode: lower.includes("filter") || lower.includes("show") ? "filter" : "select",
    });
  }

  const divideMatch = lastUser.match(/(\S[^,]*?)\s+divided by\s+([^,\.]+)/i);
  if (divideMatch) {
    return JSON.stringify({
      type: "tool_call",
      tool: "compute_column",
      scope,
      formula: `[${divideMatch[1].trim()}] / [${divideMatch[2].trim()}]`,
      newColumnName: "Computed",
    });
  }

  if (lower.includes("each") || lower.includes("new column") || lower.includes("every row")) {
    return JSON.stringify({
      type: "tool_call",
      tool: "transform_column",
      scope,
      column,
      instruction: "the main keyword",
      newColumnName: `${column} keyword`,
    });
  }

  if (lower.includes("summar") || lower.includes("keyword")) {
    return JSON.stringify({ type: "tool_call", tool: "summarize_column", column, scope });
  }

  const replaceMatch = lastUser.match(/replace\s+"?([^"]+?)"?\s+with\s+"?([^"]+?)"?(?:\s+in\b|$)/i);
  if (replaceMatch) {
    return JSON.stringify({
      type: "tool_call",
      tool: "find_replace",
      scope,
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
      scope,
      column,
      op: containsMatch ? "contains" : "not_empty",
      value: containsMatch ? containsMatch[1] : "",
      mode: lower.includes("filter") || lower.includes("show") ? "filter" : "select",
      highlight: lower.includes("highlight") ? "yellow" : undefined,
    });
  }

  return JSON.stringify({
    type: "final",
    message:
      '(mock) I\'m the offline mock model. Try: "summarize <column>", "highlight rows containing \\"x\\"", or "replace a with b".',
  });
}
