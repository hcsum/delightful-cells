import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test, { beforeEach, afterEach } from "node:test";
import ts from "typescript";

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const limits = dataModule(ts.transpileModule(
  await readFile(new URL("../lib/limits.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText);
const mocks = {
  "@/lib/auth/session": dataModule(`
    export async function getUserIdFromRequest(r) { return r.headers.get('x-test-user'); }
    export async function getQuotaKeyFromRequest(r) { return r.headers.get('x-test-identity') || 'ip:test'; }
  `),
  "@/lib/billing/db": dataModule(`export async function requireDb() {
    if (!globalThis.__guardDb) throw new Error('D1 unavailable');
    return globalThis.__guardDb;
  }
  export async function getDb() { return globalThis.__guardDb; }`),
  "@/lib/limits": limits,
  "@/lib/quota": dataModule(`export async function getRowsUsedToday(k) {
    const day = new Date().toISOString().slice(0, 10);
    const row = await globalThis.__guardDb.prepare('SELECT used FROM ai_budget WHERE key = ?').bind('user:' + day + ':' + k).first();
    return row?.used ?? (globalThis.__legacyUser || 0);
  }`),
  "@/lib/usage": dataModule(`
    export async function getUsageToday() { return { neurons: globalThis.__legacySite || 0 }; }
    export async function recordUsageFromHeaders(h) { return Number(h.get('x-usage-neurons')) || 0; }
    export async function recordMeasuredUsage(u) { return u.neurons; }
    export async function isFreeTierExhausted() { return false; }
    export function localeFromRequest() { return 'en'; }
    export function siteQuotaMessage() { return 'exhausted'; }
  `),
};
let source = ts.transpileModule(
  await readFile(new URL("../lib/billing/guard.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
for (const [name, replacement] of Object.entries(mocks)) source = source.replaceAll(`"${name}"`, `"${replacement}"`);
const guard = await import(dataModule(source));
mocks["@/lib/billing/guard"] = dataModule(source);
mocks["@/lib/billing/entitlement"] = dataModule(`
  export async function resolveEntitlement(r) {
    const userId = r.headers.get('x-test-user');
    const row = userId ? await globalThis.__guardDb.prepare('SELECT balance_neurons FROM credit_balance WHERE user_id = ?').bind(userId).first() : null;
    return { userId, quotaKey: r.headers.get('x-test-identity') || 'ip:test', baseTier: userId ? 'free' : 'anon', tier: userId ? 'free' : 'anon', balanceNeurons: row?.balance_neurons || 0, limits: { dailyCredits: 15 } };
  }
  export function asPaid(e) { return { ...e, tier: 'paid' }; }
  export async function billFreeCall(e) { return globalThis.__forcePaid ? { mode: 'paid' } : { mode: 'free' }; }
  export async function commitFreeNeurons() {}
`);
mocks["@/lib/client-ip"] = dataModule(`export function getClientIp() { return 'test-ip'; }`);
mocks["@/lib/cells/i18n"] = dataModule(`export function t(_locale, key) { return key; }`);
mocks["@toon-format/toon"] = import.meta.resolve("@toon-format/toon");
async function compiledModule(path) {
  let js = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [name, replacement] of Object.entries(mocks)) js = js.replaceAll(`"${name}"`, `"${replacement}"`);
  return dataModule(js);
}
mocks["@/lib/billing/meter"] = await compiledModule("../lib/billing/meter.ts");
mocks["@/lib/cells/sse"] = await compiledModule("../lib/cells/sse.ts");
const chatRoute = await import(await compiledModule("../app/api/chat/route.ts"));
const streamRoute = await import(await compiledModule("../app/api/chat/stream/route.ts"));
const processRoute = await import(await compiledModule("../app/api/process/route.ts"));
let sqlite;
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

// Use real SQLite statements and transactional batches, matching D1 semantics.
// No SQL logic is reimplemented in the test doubles.
beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(await readFile(new URL("../migrations/0002_billing.sql", import.meta.url), "utf8"));
  sqlite.exec(await readFile(new URL("../migrations/0003_ai_settlement.sql", import.meta.url), "utf8"));
  sqlite.exec(await readFile(new URL("../migrations/0004_inference_guards.sql", import.meta.url), "utf8"));
  globalThis.__legacyUser = 0;
  globalThis.__legacySite = 0;
  globalThis.__forcePaid = false;
  globalThis.__guardDb = {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        execute() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; },
        async run() { return this.execute(); },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((s) => s.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
});
afterEach(() => {
  sqlite.close();
  delete globalThis.__guardDb;
  globalThis.fetch = originalFetch;
  for (const key of ["MOCK_LLM", "LLM_WORKER_URL", "MOCK_STREAM_DELAY_MS", "MOCK_STREAM_MISSING_USAGE", "CHAT_STREAMING_ENABLED"]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

const ent = (key = "ip:test", tier = "anon") => ({
  quotaKey: key, baseTier: "anon", tier, userId: tier === "paid" ? "paid-user" : null,
  balanceNeurons: tier === "paid" ? 100 : 0, limits: { dailyCredits: 15 },
});
const request = (identity = "ip:test", user = null) => new Request("https://example.com/api/chat", {
  headers: { "x-test-identity": identity, ...(user ? { "x-test-user": user } : {}) },
});
const balance = () => sqlite.prepare("SELECT balance_neurons FROM credit_balance WHERE user_id = 'paid-user'").get().balance_neurons;

test("concurrent requests for the same identity admit only one inference", async () => {
  let unblock;
  const waiting = new Promise((resolve) => { unblock = resolve; });
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const post = guard.withInferenceLock(async () => { entered(); await waiting; return Response.json({ ok: true }); });
  const first = post(request());
  await started;
  const rejected = await Promise.all(Array.from({ length: 20 }, () => post(request())));
  assert.ok(rejected.every((r) => r.status === 429));
  unblock();
  assert.equal((await first).status, 200);
  assert.equal((await post(request())).status, 200);
});

test("paid identity lock uses stable user id even when the quota identity changes", async () => {
  let ref;
  const post = guard.withInferenceLock(async (_request, id) => {
    ref = id;
    return new Response("", { headers: { "content-type": "text/event-stream" } });
  });
  assert.equal((await post(request("old@email.test", "u1"))).status, 200);
  assert.equal((await post(request("new@email.test", "u1"))).status, 429);
  await guard.finishInference(ref);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM ai_identity_lock").get().n, 0);
});

test("site reservations prevent different visitors from racing the shared budget", async () => {
  globalThis.__legacySite = 22_000;
  const admitted = await Promise.all(Array.from({ length: 20 }, (_, i) => guard.reserveInferenceBudget(ent(`ip:${i}`), `r${i}`)));
  assert.equal(admitted.filter(Boolean).length, 1);
  assert.equal(await guard.readSiteBudget("anon"), 24_048);
  const ref = `r${admitted.indexOf(true)}`;
  await guard.settleInferenceBudget(ref, 20);
  assert.equal(await guard.readSiteBudget("anon"), 22_020);
  assert.equal(await guard.reserveInferenceBudget(ent("ip:next"), "next"), true);
});

test("settlement is atomic and idempotent across both site and personal counters", async () => {
  globalThis.__legacyUser = 449;
  assert.equal(await guard.reserveInferenceBudget(ent(), "r"), true);
  await Promise.all(Array.from({ length: 10 }, () => guard.settleInferenceBudget("r", 25)));
  const row = sqlite.prepare("SELECT used FROM ai_budget WHERE key = ?").get(guard.userBudgetKey("ip:test"));
  assert.equal(row.used, 474);
  assert.equal(await guard.readSiteBudget("anon"), 25);
  assert.equal(await guard.reserveInferenceBudget(ent(), "next"), false);
});

test("failed calls retain conservative usage while known rejections refund reservations", async () => {
  await guard.reserveInferenceBudget(ent(), "unknown");
  await guard.finishInference("unknown");
  assert.equal(await guard.readSiteBudget("anon"), 2048);
  await guard.reserveInferenceBudget(ent("ip:other"), "rejected");
  await guard.refundRejectedInference("rejected");
  await guard.finishInference("rejected");
  assert.equal(await guard.readSiteBudget("anon"), 2048);
});

test("an abandoned free call reserves its personal allowance as well as the site budget", async () => {
  assert.equal(await guard.reserveInferenceBudget(ent(), "abandoned"), true);
  assert.equal(await guard.reserveInferenceBudget(ent(), "retry-after-expiry"), false);
  await guard.refundRejectedInference("abandoned");
  assert.equal(await guard.reserveInferenceBudget(ent(), "retry-after-refund"), true);
});

test("paid calls prepay atomically and refund only the unused hold exactly once", async () => {
  sqlite.exec("INSERT INTO credit_balance VALUES ('paid-user', 100, 0)");
  await guard.reserveInferenceBudget(ent("paid", "paid"), "paid-1");
  assert.equal(balance(), 0);
  await assert.rejects(() => guard.reserveInferenceBudget(ent("paid", "paid"), "paid-2"), /exhausted/);
  assert.equal(await guard.settleCreditReservation("paid-1", 20), 20);
  assert.equal(await guard.settleCreditReservation("paid-1", 20), 0);
  assert.equal(balance(), 80);
  assert.equal(sqlite.prepare("SELECT SUM(delta) AS total FROM credit_ledger").get().total, -20);
});

test("a confirmed upstream rejection restores prepaid credits", async () => {
  sqlite.exec("INSERT INTO credit_balance VALUES ('paid-user', 100, 0)");
  await guard.reserveInferenceBudget(ent("paid", "paid"), "paid-1");
  await guard.refundRejectedInference("paid-1");
  await guard.finishInference("paid-1");
  assert.equal(balance(), 100);
});

test("crashed streaming calls keep their prepaid hold when the lock expires", async () => {
  sqlite.exec("INSERT INTO credit_balance VALUES ('paid-user', 100, 0)");
  let abandonedRef;
  const post = guard.withInferenceLock(async (_request, ref) => {
    abandonedRef = ref;
    await guard.reserveInferenceBudget(ent("paid", "paid"), ref);
    return new Response("", { headers: { "content-type": "text/event-stream" } });
  });
  assert.equal((await post(request("paid", "paid-user"))).status, 200);
  assert.equal(balance(), 0);
  sqlite.exec("UPDATE ai_identity_lock SET expires_at = 0");
  const recovery = guard.withInferenceLock(async () => Response.json({ ok: true }));
  assert.equal((await recovery(request("paid", "paid-user"))).status, 200);
  assert.equal(balance(), 0);
  assert.equal(sqlite.prepare("SELECT settled FROM ai_credit_reservation WHERE ref = ?").get(abandonedRef).settled, 0);
});

test("D1 outages fail closed before running the model", async () => {
  globalThis.__guardDb = null;
  let ran = false;
  const post = guard.withInferenceLock(async () => { ran = true; return Response.json({}); });
  assert.equal((await post(request())).status, 503);
  assert.equal(ran, false);
});

function jsonRequest(path, body, user = null) {
  return new Request(`https://example.com/api/${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) },
    body: JSON.stringify(body),
  });
}
const messages = [{ role: "user", content: "Hello" }];

test("all three real AI routes settle prepaid holds and release their identity lock", async () => {
  process.env.MOCK_LLM = "true";
  process.env.MOCK_STREAM_DELAY_MS = "1";
  process.env.LLM_WORKER_URL = "https://worker.example";
  globalThis.__forcePaid = true;
  sqlite.exec("INSERT INTO credit_balance VALUES ('paid-user', 100, 0)");
  const chat = await chatRoute.POST(jsonRequest("chat", { messages }, "paid-user"));
  assert.equal(chat.status, 200);
  assert.equal(balance(), 80);
  const stream = await streamRoute.POST(jsonRequest("chat/stream", { messages }, "paid-user"));
  assert.equal(stream.status, 200);
  assert.match(await stream.text(), /"type":"done"/);
  assert.equal(balance(), 60);
  globalThis.fetch = async () => new Response("```toon\nresults[1\t]{id\toutput}:\n  1\tBoston\n```", {
    headers: { "x-usage-neurons": "10", "x-usage-in": "100", "x-usage-out": "10" },
  });
  const extracted = await processRoute.POST(jsonRequest("process", {
    rows: ["Boston, MA"], toBeExtracted: "city", extractFrom: "address",
  }, "paid-user"));
  assert.equal(extracted.status, 200);
  assert.deepEqual((await extracted.json()).results, [{ input: "Boston, MA", output: "Boston" }]);
  assert.equal(balance(), 50);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM ai_identity_lock").get().n, 0);
  assert.equal(sqlite.prepare("SELECT SUM(delta) AS total FROM credit_ledger").get().total, -50);
});

test("a real streaming request blocks the non-streaming endpoint until settlement", async () => {
  process.env.MOCK_LLM = "true";
  process.env.MOCK_STREAM_DELAY_MS = "5";
  const stream = await streamRoute.POST(jsonRequest("chat/stream", { messages }));
  const chat = await chatRoute.POST(jsonRequest("chat", { messages }));
  assert.equal(chat.status, 429);
  assert.equal((await chat.json()).error, "request_in_progress");
  await stream.text();
  assert.equal((await chatRoute.POST(jsonRequest("chat", { messages }))).status, 200);
});

test("missing stream usage keeps the prepaid hold and releases the lock", async () => {
  process.env.MOCK_LLM = "true";
  process.env.MOCK_STREAM_DELAY_MS = "1";
  process.env.MOCK_STREAM_MISSING_USAGE = "true";
  globalThis.__forcePaid = true;
  sqlite.exec("INSERT INTO credit_balance VALUES ('paid-user', 100, 0)");
  const response = await streamRoute.POST(jsonRequest("chat/stream", { messages }, "paid-user"));
  assert.match(await response.text(), /missing_usage/);
  assert.equal(balance(), 0);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM ai_identity_lock").get().n, 0);
});

test("malformed extraction results cannot be used to refund a completed paid inference", async () => {
  process.env.LLM_WORKER_URL = "https://worker.example";
  globalThis.__forcePaid = true;
  sqlite.exec("INSERT INTO credit_balance VALUES ('paid-user', 100, 0)");
  globalThis.fetch = async () => new Response("not a result", {
    headers: { "x-usage-neurons": "10", "x-usage-in": "100", "x-usage-out": "10" },
  });
  const response = await processRoute.POST(jsonRequest("process", {
    rows: ["Boston, MA"], toBeExtracted: "city", extractFrom: "address",
  }, "paid-user"));
  assert.equal(response.status, 502);
  assert.equal(balance(), 90);
});

test("an actual upstream HTTP rejection refunds the route's prepaid hold", async () => {
  process.env.MOCK_LLM = "false";
  process.env.LLM_WORKER_URL = "https://worker.example";
  globalThis.__forcePaid = true;
  sqlite.exec("INSERT INTO credit_balance VALUES ('paid-user', 100, 0)");
  globalThis.fetch = async () => Response.json({ message: "rate limited" }, { status: 429 });
  const response = await chatRoute.POST(jsonRequest("chat", { messages }, "paid-user"));
  assert.equal(response.status, 429);
  assert.equal(balance(), 100);
});
