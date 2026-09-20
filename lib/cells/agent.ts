// The agent runtime: a small while-loop. The model plans, the browser acts.
// One user message = one agent turn = up to MAX_STEPS model calls.

import { t, type Locale } from "./i18n";
import { readSse } from "./sse";
import { trace, traceTurn } from "../trace";
import {
  buildSystemPrompt,
  IRREVERSIBLE_TOOLS,
  repeatsRowRun,
  ROW_RUN_TOOLS,
  shouldEndTurnAfterTool,
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

// Raised from 6 after reading a trace: one turn in sixteen hit the ceiling and
// four more reached step 5. Checking work is naturally 4-5 steps — look, act,
// look again, report — so 6 cut off the careful answers first. The old reason
// to keep it tight is gone: a turn no longer costs a fixed slice of the daily
// allowance, so a longer turn now costs exactly the neurons it uses. What the
// ceiling still buys is a stop for a model looping on its own output.
export const MAX_STEPS = 8;

let idCounter = 0;
export function nextMessageId(): string {
  return `m${++idCounter}-${Date.now().toString(36)}`;
}

type FlatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AgentPhase =
  | "idle"
  | "connecting"
  | "accepted"
  | "analyzing"
  | "generating"
  | "executing_tool"
  | "processing_rows"
  | "checking_result";

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

// One id per turn. Kept for the trace, which groups a turn's calls under it;
// the server no longer sees it, because the allowance is spent per call in
// measured neurons rather than once per turn.
function newTurnId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function postChat(
  messages: FlatMessage[],
  locale: Locale,
  signal?: AbortSignal,
): Promise<string> {
  const requestId = crypto.randomUUID();
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Refusals (quota, site budget) are written server-side, so the server
      // has to be told which language the user is reading.
      "x-locale": locale,
      "x-request-id": requestId,
    },
    body: JSON.stringify({ messages }),
    signal,
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

class StreamingUnavailableError extends Error {}

export async function postChatStream(
  messages: FlatMessage[],
  locale: Locale,
  options: { onStatus?: (phase: AgentPhase) => void; signal?: AbortSignal } = {},
): Promise<string> {
  const requestId = crypto.randomUUID();
  options.onStatus?.("connecting");
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-locale": locale,
      "x-request-id": requestId,
    },
    body: JSON.stringify({ messages }),
    signal: options.signal,
  });
  if (!res.ok) {
    let message = `Chat request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.message) message = String(body.message);
    } catch {}
    if (res.status === 404) throw new StreamingUnavailableError(message);
    throw new Error(message);
  }
  if (!res.body) throw new Error("Chat stream has no response body.");

  let result: string | null = null;
  let done = false;
  let lastSeq = 0;
  await readSse(res.body, (event) => {
    if (event.requestId !== requestId || !Number.isInteger(event.seq) || event.seq <= lastSeq) {
      throw new Error("Malformed chat stream sequence.");
    }
    lastSeq = event.seq;
    if (event.type === "accepted") options.onStatus?.("accepted");
    else if (event.type === "model_started") options.onStatus?.("analyzing");
    else if (event.type === "activity") options.onStatus?.("generating");
    else if (event.type === "result") result = String((event.data as { response?: unknown })?.response ?? "");
    else if (event.type === "error") {
      throw new Error(String((event.data as { message?: unknown })?.message || "The model response was interrupted."));
    } else if (event.type === "done") done = true;
  });
  if (!done || result === null) throw new Error("Chat stream ended before completion.");
  return result;
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
  onPhase?: (phase: AgentPhase) => void;
  // Aborted when a newer turn supersedes this one. `isStale` alone only stops
  // the loop once the request has come back; this stops waiting for it.
  signal?: AbortSignal;
};

export async function runAgentTurn(opts: AgentTurnOptions): Promise<void> {
  const history = [...opts.history];
  const turnId = newTurnId();
  let correctedOnce = false;
  // Set once a tool has rewritten data, dropped a column, or spent neurons.
  // From that point the loop stops re-prompting: see the parse-fail branch.
  let touchedTheSheet = false;
  // A per-row AI run that came back incomplete. The turn is allowed to do other
  // things after it, but not to run that same question again: the rows cost
  // real money, the partial-result dialog already asked the user whether to
  // retry, and a second run replaces the selection they are looking at.
  let spentRowRun: ToolCall | null = null;

  const lastUser = [...opts.history].reverse().find((m) => m.role === "user");
  traceTurn(turnId, lastUser && "content" in lastUser ? lastUser.content : "");

  for (let step = 1; step <= MAX_STEPS; step++) {
    opts.onStep?.(step);
    const system = buildSystemPrompt(opts.getGrid(), opts.sheetName);
    const messages = flatten(system, history);
    trace("prompt", {
      step,
      system,
      chars: messages.reduce((n, m) => n + m.content.length, 0),
      messages: messages.slice(1),
    });
    let text: string;
    if (process.env.NEXT_PUBLIC_CHAT_STREAMING !== "false") {
      try {
        text = await postChatStream(messages, opts.locale ?? "en", {
          onStatus: opts.onPhase,
          signal: opts.signal,
        });
      } catch (error) {
        if (!(error instanceof StreamingUnavailableError)) throw error;
        text = await postChat(messages, opts.locale ?? "en", opts.signal);
      }
    } else {
      text = await postChat(messages, opts.locale ?? "en", opts.signal);
    }
    if (opts.isStale()) return;
    trace("reply", { step, text });

    const parsed = extractToolJson(text);

    if (!parsed || typeof parsed.type !== "string") {
      trace("parse-fail", { step, corrected: correctedOnce, touchedTheSheet });
      // Prose once the sheet has already been changed is a report, not a
      // botched tool call: the work is done and the model is describing it.
      // Re-prompting there is the dangerous direction — it pushes the model
      // to do the same job a second time, by some other route, over some
      // other set of rows. In a loop with side effects the safe failure is to
      // stop, so a reply we cannot parse becomes the final answer.
      // This is the same judgement `then` makes, reached the other way round:
      // there the model says up front that the tool call ends the turn, here
      // the loop decides after the fact that an unreadable reply does. Both
      // end at "the edit already happened, stop touching the sheet".
      if (touchedTheSheet || correctedOnce) {
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
      trace("final", { step, message: String(parsed.message ?? "") });
      opts.emit({
        id: nextMessageId(),
        role: "assistant",
        content: String(parsed.message ?? "Done!"),
      });
      return;
    }

    const grid = opts.getGrid();
    const validated = validateToolCall(parsed, grid.headers, grid);
    if ("error" in validated) trace("invalid", { step, error: validated.error, unknownTool: validated.unknownTool ?? null });
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

    if (spentRowRun && repeatsRowRun(spentRowRun, validated.call)) {
      trace("repeat-row-run", { step, tool: validated.call.tool });
      history.push({ id: nextMessageId(), role: "assistant", content: text });
      history.push({
        id: nextMessageId(),
        role: "user",
        content: `TOOL_RESULT error: ${JSON.stringify({
          error:
            "That run already happened in this turn and came back incomplete. It was not run again: re-running charges for every row in the scope a second time and replaces the result the user is looking at. Answer the user now — say which rows were not answered — and let them ask for another attempt if they want one.",
        })}`,
      });
      continue;
    }

    trace("call", { step, call: validated.call });
    if (IRREVERSIBLE_TOOLS.has(validated.call.tool)) touchedTheSheet = true;
    opts.onPhase?.("executing_tool");
    const result = await opts.applyTool(validated.call);
    if (opts.isStale()) return;
    trace("result", {
      step,
      tool: validated.call.tool,
      ok: result.ok,
      summary: result.summary,
      // The one string the model actually reads back — worth seeing verbatim.
      outcome: (result.data as { outcome?: string } | null)?.outcome,
      data: result.data,
    });
    const toolMessage: ChatMessage = {
      id: nextMessageId(),
      role: "tool",
      call: validated.call,
      result,
    };
    opts.emit(toolMessage);
    if (result.requiresFollowup && ROW_RUN_TOOLS.has(validated.call.tool)) spentRowRun = validated.call;
    // A terminal call has already answered through the visible tool card. The
    // result vetoes this fast path whenever the edit failed or needs explaining.
    if (shouldEndTurnAfterTool(
      validated.call,
      result,
      process.env.NEXT_PUBLIC_TERMINAL_TOOL_CALL === "true",
    )) {
      trace("terminal", { step, tool: validated.call.tool });
      return;
    }
    history.push(toolMessage);
  }

  opts.emit({
    id: nextMessageId(),
    role: "assistant",
    content: "I hit the maximum number of tool steps for one request — try breaking it into smaller asks.",
  });
}
