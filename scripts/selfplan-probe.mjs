// Can GLM plan for itself? Two calls to the same cheap model: one to produce a
// plan, one to execute step 1 of it. If this lands where the hand-written
// plans landed (8/8), the second model in a planner/executor split buys
// nothing — and two GLM calls (~42 neurons) still undercut one llama-4-scout
// call (~85).
//
// Prints the plans it writes, because a plan that already names the wrong
// column would poison the executor and has to be seen, not assumed away.

import { readFile } from 'node:fs/promises';

const ACCT = 'b31e99dd0f0eb76a87392404bc636490';
const MODEL = '@cf/zai-org/glm-4.7-flash';
const RUNS = Number(process.argv[2] ?? 8);
const ROOT = '/Users/sum/Codes/excel-extract-column-app';

const ASK_PLAN = `先不要调用任何工具。请用 2-4 个步骤列出你打算怎么完成用户的请求，每步一句话。只输出计划文本，不要输出 JSON。`;
const ASK_EXEC = `现在按上面的计划执行第 1 步。`;

const mod = await import(`file://${ROOT}/.eval-build/tools.js`);
const c = JSON.parse(await readFile(`${ROOT}/evals/transform-reads-source-column.json`, 'utf8'));
const g = c.grid;
const rows = [];
for (let i = 0; i < g.rowCount; i++) rows.push(g.sampleRows[i] ?? g.headers.map(() => ''));
const system = mod.buildSystemPrompt(
  { headers: g.headers, rows, selectedRows: null, filterKept: null, highlightedRows: null },
  g.sheetName,
);

let neurons = 0;
async function ask(messages) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
    body: JSON.stringify({
      messages, max_tokens: 1024, temperature: 0,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  const { result } = await res.json();
  neurons += Number(result?.usage?.neurons) || 0;
  const raw = result?.response ?? result?.choices?.[0]?.message?.content ?? '';
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
}

function parse(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0].replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
}

const base = [{ role: 'system', content: system }, ...c.messages];
const cols = [];
const plans = [];
for (let i = 0; i < RUNS; i++) {
  const plan = await ask([...base, { role: 'user', content: ASK_PLAN }]);
  plans.push(plan);
  const exec = await ask([
    ...base,
    { role: 'user', content: ASK_PLAN },
    { role: 'assistant', content: plan },
    { role: 'user', content: ASK_EXEC },
  ]);
  const p = parse(exec);
  cols.push(p?.tool === 'transform_column' ? (p.column ?? '?') : `(${p?.tool ?? 'unparsed'})`);
}

const good = cols.filter((x) => x === '原始记录').length;
const bad = cols.filter((x) => x === '金额').length;
console.log(`self-plan  原始记录(对) ${good}/${RUNS}   金额(bug) ${bad}/${RUNS}`);
console.log(JSON.stringify(cols));
console.log(`\nneurons total ${neurons.toFixed(1)}  (${(neurons / RUNS).toFixed(1)} per completed turn, 2 calls each)\n`);
console.log('--- plan 1 ---\n' + plans[0].slice(0, 500));
console.log('\n--- plan 2 ---\n' + (plans[1] ?? '').slice(0, 500));
