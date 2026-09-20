#!/usr/bin/env node
// Evals for the layer unit tests cannot reach: which tool the model picks.
//
// Every bug worth catching here looks the same in the code and different only
// in the model's choice — the sheet state was legal, the call was legal, the
// decision was wrong. So a case is a frozen conversation plus an assertion
// about the very next reply, and the only way to run it is to ask the model.
//
//   node scripts/eval.mjs                     run every case
//   node scripts/eval.mjs --case unjudged     run cases matching a substring
//   node scripts/eval.mjs --runs 20           sample each case 20 times (default 8)
//   node scripts/eval.mjs --show              print every raw reply as it arrives
//   node scripts/eval.mjs --model ollama:gemma4
//                                             ask a local model instead of the worker
//   node scripts/eval.mjs --model cf:@cf/meta/llama-4-scout-17b-16e-instruct
//                                             ask any Workers AI model directly
//   node scripts/eval.mjs --mint <turn> --step 5 --name my-case
//                                             cut a new case out of .dev-trace
//
// The model is sampled, not deterministic, so each case runs several times and
// reports k/N. Treat anything short of N/N as a failure: a rule the model
// follows four times in five is not a rule. The default of 8 is set by the
// first case in evals/ — it reproduces about one run in five, so three samples
// called it green more often than not.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { loadTools } from './build-tools.mjs';
import { argv, env, execPath, exit } from 'node:process';
import { spawnSync } from 'node:child_process';

// node's fetch ignores HTTP(S)_PROXY unless told to honour it, and the flag is
// read at startup — so re-exec ourselves once when a proxy is configured.
// Without this every call dies as a bare "fetch failed" behind a local proxy.
if ((env.HTTPS_PROXY || env.https_proxy) && !env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(execPath, [new URL(import.meta.url).pathname, ...argv.slice(2)], {
    stdio: 'inherit',
    env: { ...env, NODE_USE_ENV_PROXY: '1' },
  });
  exit(r.status ?? 1);
}

const EVAL_DIR = new URL('../evals/', import.meta.url);
const TRACE_DIR = new URL('../.dev-trace/', import.meta.url);

// ---------------------------------------------------------------------------
// Building the system prompt the way the app builds it.
//
// A case could just freeze the recorded system message, and for judging the
// model that would be enough. But half of what these cases catch lives in the
// prompt, and a frozen prompt can never show a prompt fix working — the case
// would keep failing against text the app no longer sends. So a case stores
// the *grid* and we re-render buildSystemPrompt from source on every run.

/**
 * A case stores only what the prompt actually shows — the headers, the first
 * few rows, and how many rows are in each set. Rows past the sample never
 * reach the model, so filling them with blanks renders a prompt identical to
 * the real one while keeping the case file small enough to read.
 */
function materializeGrid(spec) {
  const rows = [];
  for (let i = 0; i < spec.rowCount; i++) {
    rows.push(spec.sampleRows[i] ?? spec.headers.map(() => ''));
  }
  const range = (n) => new Set(Array.from({ length: n }, (_, i) => i));
  return {
    headers: spec.headers,
    rows,
    selectedRows: spec.selectedCount ? range(spec.selectedCount) : null,
    filterKept: spec.visibleCount ? [...range(spec.visibleCount)] : null,
    highlightedRows: spec.highlightedCount
      ? new Map([...range(spec.highlightedCount)].map((i) => [i, 'yellow']))
      : null,
    ...(spec.lineage ? { lineage: spec.lineage } : {}),
  };
}

async function messagesFor(c) {
  if (!c.grid) return c.messages; // frozen-prompt case: the system message is stored
  const { buildSystemPrompt } = await loadTools();
  const system = buildSystemPrompt(materializeGrid(c.grid), c.grid.sheetName ?? 'Sheet1');
  return [{ role: 'system', content: system }, ...c.messages];
}

const flag = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : (argv[i + 1] ?? '');
};

// ---------------------------------------------------------------------------
// Reading .env.local ourselves, so an eval run needs no dev server: it talks to
// the same worker the app talks to.

async function loadEnv() {
  const text = await readFile(new URL('../.env.local', import.meta.url), 'utf8').catch(() => '');
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

// Where the reply comes from. The default is the same worker the app calls
// (Workers AI, currently @cf/zai-org/glm-4.7-flash), and it is the only
// setting whose score says anything about production. "--model ollama:<name>"
// asks a locally served model the identical question instead — that is how you
// tell "this prompt is ambiguous to anyone" apart from "this one model
// misreads it", which decides whether a fix belongs in the prompt or the
// validator.
const MODEL_SPEC = flag('--model', 'worker');

// /api/chat rather than the OpenAI-shaped /v1 route, because only this one
// takes "think". A thinking model left on its own spends the whole budget
// reasoning and returns a truncated content — it looks like a wrong answer and
// is really a cut-off one. The worker turns GLM's thinking off for the same
// reason, so turning it off here keeps the two comparable.
async function askOllama(model, messages) {
  const base = (env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, think: false, options: { num_predict: 2048 } }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const msg = body?.message ?? {};
  const text = String(msg.content ?? '');
  // A model that ignored think:false still answers in the thinking field.
  return text.trim() ? text : String(msg.thinking ?? '');
}

// Workers AI straight over REST, so a model the deployed worker is not pinned
// to can still be asked the same question. It reproduces the worker's own call
// — max_tokens 1024, temperature 0 — because a scoring difference has to come
// from the model, not from the sampling settings. enable_thinking is GLM's
// flag and is sent only to GLM, matching what the worker does today and what
// it did when it ran llama-4-scout, which had no such argument.
const CF_ACCOUNT = 'b31e99dd0f0eb76a87392404bc636490';
let neuronsSpent = 0;

// How each model's thinking is switched off. Probed 2026-09-16 against the
// REST API with a one-line "reply with one JSON object" prompt:
//   glm-4.7-flash, qwen3, gemma-4: chat_template_kwargs.enable_thinking=false
//     works — reasoning_content empty, content is the JSON. (qwen3 then hands
//     the answer back in reasoning_content with content null; the fallback
//     below picks it up.)
//   glm-5.3-flash: enable_thinking=false is WORSE — the thinking leaks into
//     content, once with a stray </think> and a bash block. It cannot be turned
//     off; reasoning_effort "low" halves it (94 → 53 completion tokens) and
//     keeps content clean, so that is what it gets.
function thinkingOff(model) {
  if (model.includes('glm-5.3')) return { reasoning_effort: 'low' };
  if (/glm|qwen|gemma/.test(model)) return { chat_template_kwargs: { enable_thinking: false } };
  return {}; // llama and the rest: no such argument, keep the call as measured
}

async function askWorkersAI(model, messages) {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set; it needs the Workers AI Read permission.');
  const body = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: 1024,
    temperature: 0,
    ...thinkingOff(model),
  };
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`workers-ai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { result } = await res.json();
  neuronsSpent += Number(result?.usage?.neurons) || 0;
  // llama-4-scout hands back `response` as an already-parsed object when the
  // answer is pure JSON, so re-serialize rather than stringifying [object].
  const raw = result?.response ?? result?.choices?.[0]?.message?.content ?? '';
  const text = (typeof raw === 'string' ? raw : raw != null ? JSON.stringify(raw) : '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // gemma-4 spends the whole max_tokens budget in reasoning_content and returns
  // an empty content with finish_reason "length". Judging that empty string
  // scores the harness, not the model — it passes any check phrased as "must
  // not say X". Fall back to the reasoning so there is something real to judge.
  if (text) return text;
  return String(result?.choices?.[0]?.message?.reasoning_content ?? '').trim();
}

async function askModel(messages) {
  if (MODEL_SPEC.startsWith('ollama:')) return askOllama(MODEL_SPEC.slice('ollama:'.length), messages);
  if (MODEL_SPEC.startsWith('cf:')) return askWorkersAI(MODEL_SPEC.slice('cf:'.length), messages);
  const url = env.LLM_WORKER_URL;
  if (!url) throw new Error('LLM_WORKER_URL is not set (looked in the environment and .env.local).');
  const res = await fetch(`${url.replace(/\/$/, '')}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.LLM_API_KEY || '',
      'x-app': 'delightful-cells-eval',
      'x-tier': 'paid',
    },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`worker ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return String(body?.response ?? '');
}

// ---------------------------------------------------------------------------
// Assertions. Deliberately few: each one names a way the agent has actually
// gone wrong, not a general-purpose matcher language.

// The agent treats every reply that is not "final" as a tool call
// (lib/cells/agent.ts) — it never tests for the literal "tool_call". Checks
// that insisted on that exact string would skip a model whose type field reads
// "tool_calls", which is what llama-4-scout emits, and a wrong column would
// then sail through as a pass. Judge the same way the app dispatches.
const isToolCall = (reply) => reply.type !== 'final' && typeof reply.tool === 'string';

// One description of a call, used by both the forbidding and the requiring
// check so that "don't do X" and "do X" cannot drift apart. Every field the
// spec names has to match; fields it leaves out are not looked at.
//
// Defaults are applied the way validateToolCall applies them, because the
// question is always what the app would have run, not what the model typed.
// The exception is "scope": what an omitted scope means depends on whether a
// selection exists this turn, so a spec asking for a scope is asking about the
// scope the model actually wrote — use requireExplicitScope to demand one.
function callMatches(reply, spec) {
  const rows = Array.isArray(reply.rows) ? reply.rows : reply.row != null ? [reply.row] : null;
  const wanted = (v) => (Array.isArray(v) ? v : [v]);
  if (spec.tool && spec.tool !== reply.tool) return false;
  if (spec.scope && (reply.scope ?? 'all') !== spec.scope) return false;
  if (spec.column && !wanted(spec.column).includes(reply.column)) return false;
  if (spec.op && !wanted(spec.op).includes(reply.op)) return false;
  if (spec.mode && (reply.mode === 'filter' ? 'filter' : 'select') !== spec.mode) return false;
  if (spec.rows && String(rows) !== String(spec.rows)) return false;
  // Substrings the argument must contain: the column names a formula has to
  // reference, the value a find_replace has to write.
  for (const [field, needles] of Object.entries(spec.includes ?? {})) {
    const text = String(reply[field] ?? '');
    if (!wanted(needles).every((n) => text.includes(n))) return false;
  }
  return true;
}

// The ToolCall the app would actually run for this reply, or null if the
// validator refuses it. Frozen-prompt cases carry no grid spec, so there are no
// headers to validate against and the reply is handed back as written.
async function preloadValidator() {
  ({ validateToolCall: validator } = await loadTools());
}
let validator = null;

function validateReply(reply, c) {
  if (!validator || !c.grid) return reply;
  const grid = materializeGrid(c.grid);
  const out = validator({ ...reply }, grid.headers, grid);
  return out.call ?? null;
}

function describeCall(reply) {
  const parts = [`${reply.tool} on scope "${reply.scope ?? '(omitted)'}"`];
  if (reply.column) parts.push(`column "${reply.column}"`);
  if (reply.formula) parts.push(`formula "${reply.formula}"`);
  if (reply.rows ?? reply.row) parts.push(`rows ${JSON.stringify(reply.rows ?? reply.row)}`);
  return parts.join(' / ');
}

const CHECKS = {
  requireThen(reply) {
    if (!isToolCall(reply)) return "did not make a tool call";
    return reply.then === true ? null : `called ${reply.tool} without \"then\":true`;
  },
  // What the CLIENT would have done, not what the model typed. validateToolCall
  // drops "then" on summarize_column and on anything it rejects outright, so a
  // stray flag there can never end a turn early; failing the suite for it would
  // hold a correctness gate on a habit that cannot reach the user.
  //
  // Use this where an early stop would be a real bug — a first tool whose whole
  // job is to set up a second one. Use forbidRawThen for the prompt hygiene.
  forbidThen(reply, _spec, ctx) {
    if (!isToolCall(reply)) return null;
    const validated = ctx.validate(reply);
    return validated?.then === true ? `the client would run ${validated.tool} with \"then\":true` : null;
  },
  // The model wrote "then" where the prompt says not to. The validator already
  // throws it away, so nothing downstream breaks — this measures whether the
  // prompt contract still reads the way it is meant to, and is named so nobody
  // mistakes a red here for a turn that ends early.
  forbidRawThen(reply) {
    if (!isToolCall(reply)) return null;
    return reply.then === true ? `wrote \"then\":true on ${reply.tool}` : null;
  },
  // The reply must not call one of these tools, optionally only when it aims
  // at a given scope. This is the shape of most real failures: the right tool
  // pointed at the wrong rows.
  forbidCalls(reply, spec) {
    if (!isToolCall(reply)) return null;
    for (const bad of spec) {
      if (callMatches(reply, bad)) return `called ${describeCall(reply)}`;
    }
    return null;
  },
  // The ordinary path still works: the reply must be one of these calls.
  //
  // Every other check here asserts that a specific mistake did not happen, and
  // a suite made only of those can prove a bug was fixed while missing a model
  // that broke something which used to work. This is the check that says what
  // the model was supposed to DO. Several alternatives may be listed when more
  // than one call genuinely answers the request.
  // An entry { final: true } says a final answer is also an acceptable reply —
  // for the requests where telling the user something IS the right move (the
  // comparison they asked for is circular) and a tool call is the other one.
  requireCall(reply, spec) {
    const calls = spec.filter((s) => !s.final);
    if (!isToolCall(reply)) {
      if (spec.some((s) => s.final)) return null;
      return `replied ${reply.type ?? 'final'} instead of calling ${calls.map((s) => s.tool).join(' or ')}`;
    }
    if (calls.some((want) => callMatches(reply, want))) return null;
    return `called ${describeCall(reply)}, none of the ${spec.length} accepted call(s)`;
  },
  // The reply must be a final answer rather than another tool call.
  mustBeFinal(reply) {
    return isToolCall(reply) ? `replied with ${reply.type} (${reply.tool ?? '?'})` : null;
  },
  // Acting tools inherit the selection when "scope" is left out, so with a
  // selection on screen an omitted scope is an unstated guess. The model must
  // say which set it means. This is the assertion for the bug where a
  // transform whose own instruction read "for all rows" silently hit 100
  // of 154 because scope was absent.
  requireExplicitScope(reply, spec) {
    if (!isToolCall(reply)) return null;
    if (!spec.includes(reply.tool)) return null;
    if (reply.rows?.length) return null; // naming rows is explicit enough
    return reply.scope ? null : `called ${reply.tool} with no "scope" while a selection exists`;
  },
  // Every one of these must appear in the final message. Used for facts the
  // user has to be told — "54 rows were never checked" is not optional.
  mustMention(reply, spec) {
    const text = String(reply.message ?? reply.raw ?? '');
    const missing = spec.filter((s) => !text.includes(s));
    return missing.length ? `did not mention ${missing.map((s) => JSON.stringify(s)).join(', ')}` : null;
  },
  // At least one of these must appear in a final answer. For the case where
  // the honest reply is a QUALIFICATION — "the zeros show the copies agree, not
  // that the data is right" — and the false one is the same sentence with the
  // qualification missing. forbidMention alone cannot tell those apart: 完全一致
  // is true of two copies and false of the data, in the same characters. A tool
  // call is not judged here; going back to the source is a legitimate answer.
  mustMentionAny(reply, spec) {
    if (isToolCall(reply)) return null;
    const text = String(reply.message ?? reply.raw ?? '');
    return spec.some((s) => text.includes(s)) ? null : `said none of ${spec.map((s) => JSON.stringify(s)).join(', ')}`;
  },
  // mustMention inverted: these phrasings must NOT appear in the final answer.
  // For the failures where the model states a conclusion its own numbers
  // contradict — two amounts that differ, reported as identical.
  forbidMention(reply, spec) {
    const text = String(reply.message ?? reply.raw ?? '');
    const found = spec.filter((s) => text.includes(s));
    return found.length ? `said ${found.map((s) => JSON.stringify(s)).join(', ')}` : null;
  },
};

// Same extractor the app uses, kept small: last balanced {...} wins.
function parseReply(text) {
  const objects = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) { objects.push(text.slice(start, i + 1)); start = -1; }
      if (depth < 0) depth = 0;
    }
  }
  for (const candidate of objects.reverse()) {
    try {
      const parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // DIAGNOSTIC (2026-09-16, not in the app): gemma-4 writes the tool name
        // into "type" and omits "tool". Score what it meant, to see whether the
        // model or only its envelope is wrong.
        if (env.EVAL_LENIENT_TYPE && typeof parsed.type === 'string' && parsed.tool == null && parsed.type !== 'final') parsed.tool = parsed.type;
        return parsed;
      }
    } catch {}
  }
  // Prose is a legitimate reply shape, not a parse error — the agent now
  // treats it as a final answer, so the eval judges it as one too.
  return { type: 'final', message: text, prose: true };
}

// ---------------------------------------------------------------------------

async function readTrace() {
  const files = (await readdir(TRACE_DIR).catch(() => [])).filter((f) => f.endsWith('.jsonl')).sort();
  const events = [];
  for (const f of files) {
    for (const line of (await readFile(new URL(f, TRACE_DIR), 'utf8')).split('\n')) {
      if (line.trim()) try { events.push(JSON.parse(line)); } catch {}
    }
  }
  return events;
}

async function mint() {
  const turn = flag('--mint');
  const step = Number(flag('--step', '1'));
  const name = flag('--name') || `${turn}-step${step}`;
  const events = await readTrace();
  const prompt = events.find((e) => e.kind === 'prompt' && e.turn.startsWith(turn) && Number(e.step) === step);
  if (!prompt) {
    console.error(`No prompt event for turn ${turn} step ${step}. Try: node scripts/trace.mjs --list`);
    exit(1);
  }
  const reply = events.find((e) => e.kind === 'reply' && e.turn === prompt.turn && Number(e.step) === step);
  const file = new URL(`${name}.json`, EVAL_DIR);
  await writeFile(file, JSON.stringify({
    name,
    why: 'TODO: one line on what went wrong here and why the assertion is the right one.',
    from: { turn: prompt.turn, step },
    // What the model actually did when this was recorded. Kept for the reader,
    // never asserted on: the recorded reply is usually the bug.
    observed: reply?.text ?? null,
    assert: { forbidCalls: [{ tool: 'find_replace', scope: 'all' }] },
    messages: [{ role: 'system', content: prompt.system }, ...prompt.messages],
  }, null, 2) + '\n');
  console.log(`Wrote evals/${name}.json — edit "why" and "assert", then run node scripts/eval.mjs`);
}

async function run() {
  const only = flag('--case');
  const runs = Number(flag('--runs', '8')) || 8;
  // A score on its own has twice fooled us: an empty reply passes every "must
  // not say X", and a decline passes every "must not call X". Both look like a
  // green. --show puts the actual text next to the verdict.
  const show = argv.includes('--show');
  const files = (await readdir(EVAL_DIR).catch(() => []))
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !only || f.includes(only));
  if (!files.length) { console.error('No eval cases found in evals/.'); exit(1); }
  console.log(`model: ${MODEL_SPEC === 'worker' ? 'worker (Workers AI)' : MODEL_SPEC}  runs: ${runs}\n`);
  await preloadValidator();

  let failed = 0;
  let known = 0;
  for (const f of files) {
    const c = JSON.parse(await readFile(new URL(f, EVAL_DIR), 'utf8'));
    const failures = [];
    const ctx = { validate: (reply) => validateReply(reply, c) };
    for (let i = 0; i < runs; i++) {
      let reply;
      try {
        const text = await askModel(await messagesFor(c));
        if (show) console.log(`   · ${c.name} run ${i + 1}: ${text.replace(/\s+/g, ' ').slice(0, 400)}`);
        reply = parseReply(text);
      } catch (e) {
        failures.push(`run ${i + 1}: ${e.message}`);
        continue;
      }
      // An empty reply satisfies every "must not" check by saying nothing at
      // all. That is never a pass — it is a model that failed to answer.
      if (!String(reply.message ?? reply.raw ?? '').trim() && !isToolCall(reply)) {
        failures.push(`run ${i + 1}: empty — the model returned no usable reply`);
        continue;
      }
      for (const [check, spec] of Object.entries(c.assert ?? {})) {
        const why = CHECKS[check]?.(reply, spec, ctx);
        if (why) failures.push(`run ${i + 1}: ${check} — ${why}`);
      }
    }
    const passed = runs - new Set(failures.map((s) => s.split(':')[0])).size;
    const ok = failures.length === 0;
    // A case can be red for a reason that is written down and not being fixed
    // this week — a model regression the suite cannot fix, a behaviour a loop
    // guard already makes harmless. Scoring it is still worth doing; failing
    // the run on it is not, because then the exit code stops meaning anything.
    // "knownRed" holds the reason, and a case that goes green says so rather
    // than keeping the annotation quietly.
    if (!ok && c.knownRed) known++;
    else if (!ok) failed++;
    console.log(`${ok ? '✅' : c.knownRed ? '⚠️ ' : '❌'} ${c.name}  ${passed}/${runs}`);
    if (c.why) console.log(`   ${c.why}`);
    if (c.knownRed) {
      console.log(`   known-red: ${c.knownRed}`);
      if (ok) console.log('   🎉 it passed this time — re-measure, and drop "knownRed" if it holds.');
    }
    for (const line of failures) console.log(`   ↳ ${line}`);
  }
  console.log(`\n${files.length - failed - known}/${files.length - known} cases passed${known ? `, ${known} known-red not counted` : ''}.`);
  if (neuronsSpent) console.log(`neurons spent: ${neuronsSpent.toFixed(2)}`);
  exit(failed ? 1 : 0);
}

await loadEnv();
await (argv.includes('--mint') ? mint() : run());
