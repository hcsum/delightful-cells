// The agent runtime: a small while-loop. The model plans, the browser acts.
// One user message = one agent turn = up to MAX_STEPS model calls.

import { t, type Locale } from "./i18n";
import {
  buildSystemPrompt,
  validateToolCall,
  type GridState,
  type ToolCall,
  type ToolResult,
} from "./tools";

export type ChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string }
  | { id: string; role: "tool"; call: ToolCall; result: ToolResult }
  // Out-of-band fact about what the user did between turns. Shown as gray
  // text in the chat; sent to the model glued onto the next user message.
  | { id: string; role: "note"; content: string };

export const MAX_STEPS = 6;

let idCounter = 0;
export function nextMessageId(): string {
  return `m${++idCounter}-${Date.now().toString(36)}`;
}

type FlatMessage = { role: "system" | "user" | "assistant"; content: string };

// Flatten rich chat history into what the model API accepts. Tool cards
// become user messages carrying the TOOL_RESULT payload (llama has no tool role).
function flatten(system: string, history: ChatMessage[]): FlatMessage[] {
  const out: FlatMessage[] = [{ role: "system", content: system }];
  let pendingNote = "";
  for (const m of history) {
    if (m.role === "note") {
      pendingNote += (pendingNote ? "\n" : "") + m.content;
      continue;
    }
    if (m.role === "user") {
      out.push({ role: "user", content: pendingNote ? `${pendingNote}\n\n${m.content}` : m.content });
      pendingNote = "";
      continue;
    }
    if (m.role === "tool") {
      out.push({
        role: "assistant",
        content: JSON.stringify({ type: "tool_call", ...m.call }),
      });
      out.push({
        role: "user",
        content: `TOOL_RESULT ${m.call.tool}: ${JSON.stringify(m.result.data)}`,
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

// Pull one JSON object out of model text: prefer the last fenced ```json
// block, fall back to a balanced-brace scan for the last top-level {...}.
export function extractToolJson(text: string): Record<string, unknown> | null {
  const candidates: string[] = [];
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/g;
  let fm: RegExpExecArray | null;
  while ((fm = fenceRe.exec(text))) candidates.push(fm[1]);

  // Balanced-brace scan over the raw text (last object wins).
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        candidates.push(text.slice(start, i + 1));
        start = -1;
      }
      if (depth < 0) depth = 0;
    }
  }

  for (const candidate of candidates.reverse()) {
    try {
      const cleaned = candidate.trim().replace(/,\s*([}\]])/g, "$1");
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function postChat(messages: FlatMessage[]): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    let message = `Chat request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.message) message = String(body.message);
    } catch {}
    throw new Error(message);
  }
  const body = await res.json();
  return String(body?.response ?? "");
}

export type AgentTurnOptions = {
  locale?: Locale;
  history: ChatMessage[]; // history BEFORE this turn, user message included
  sheetName: string;
  getGrid: () => GridState;
  applyTool: (call: ToolCall) => ToolResult | Promise<ToolResult>; // executes + updates React state (transform_column is async)
  isStale: () => boolean; // true → a newer turn superseded us, stop silently
  emit: (message: ChatMessage) => void; // stream tool cards / replies into the UI
  onStep?: (step: number) => void;
};

export async function runAgentTurn(opts: AgentTurnOptions): Promise<void> {
  const history = [...opts.history];
  let correctedOnce = false;

  for (let step = 1; step <= MAX_STEPS; step++) {
    opts.onStep?.(step);
    const system = buildSystemPrompt(opts.getGrid(), opts.sheetName);
    const text = await postChat(flatten(system, history));
    if (opts.isStale()) return;

    const parsed = extractToolJson(text);

    if (!parsed || typeof parsed.type !== "string") {
      if (correctedOnce) {
        // Give up on JSON — surface the raw text so the user still gets an answer.
        opts.emit({ id: nextMessageId(), role: "assistant", content: text.trim() || "…" });
        return;
      }
      correctedOnce = true;
      history.push({ id: nextMessageId(), role: "assistant", content: text });
      history.push({
        id: nextMessageId(),
        role: "user",
        content:
          "Your reply was not a single valid JSON object. Reply again with ONLY one JSON object.",
      });
      continue;
    }

    if (parsed.type === "final") {
      opts.emit({
        id: nextMessageId(),
        role: "assistant",
        content: String(parsed.message ?? "Done!"),
      });
      return;
    }

    const grid = opts.getGrid();
    const validated = validateToolCall(parsed, grid.headers, grid);
    if ("error" in validated && validated.unknownTool) {
      // The model invented a tool. Don't let it retry-and-invent again: answer
      // deterministically so the user learns what the app can't do yet.
      opts.emit({
        id: nextMessageId(),
        role: "assistant",
        content: t(opts.locale ?? "en", "unknownTool", { tool: validated.unknownTool }),
      });
      return;
    }
    if ("error" in validated) {
      // Feed the validation error back so the model can self-correct.
      history.push({ id: nextMessageId(), role: "assistant", content: text });
      history.push({
        id: nextMessageId(),
        role: "user",
        content: `TOOL_RESULT error: ${JSON.stringify({ error: validated.error })}`,
      });
      continue;
    }

    const result = await opts.applyTool(validated.call);
    if (opts.isStale()) return;
    const toolMessage: ChatMessage = {
      id: nextMessageId(),
      role: "tool",
      call: validated.call,
      result,
    };
    opts.emit(toolMessage);
    history.push(toolMessage);
  }

  opts.emit({
    id: nextMessageId(),
    role: "assistant",
    content: "I hit the maximum number of tool steps for one request — try breaking it into smaller asks.",
  });
}
