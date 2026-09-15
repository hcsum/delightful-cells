// Does handing GLM a plan stop it binding transform_column to the wrong column?
//
// The failure being probed is a PARAMETER BINDING error, not a planning error:
// GLM's own instruction said "extract from the original record text" while its
// column said 金额. So the question is which half of a planner/executor split
// has to do the binding for the split to help.
//
//   control — no plan at all (should reproduce the bug)
//   A       — abstract plan: the steps, no column names (what a planner emits
//             if it is NOT already doing the hard part)
//   B       — concrete plan: tool + column spelled out (the planner has done
//             the binding; the executor only transcribes)

import { readFile } from 'node:fs/promises';

const ACCT = 'b31e99dd0f0eb76a87392404bc636490';
const MODEL = '@cf/zai-org/glm-4.7-flash';
const RUNS = Number(process.argv[2] ?? 8);
const ROOT = '/Users/sum/Codes/excel-extract-column-app';

const PLANS = {
  control: null,
  A: `以下是规划模型给出的执行计划，请按计划执行下一步：
1. 从原始记录中提取出金额数字，写入一个新列
2. 计算提取出的金额与表格金额之间的差额
3. 汇总差额，判断是否全部为 0
现在执行第 1 步。`,
  B: `以下是规划模型给出的执行计划，请按计划执行下一步：
1. transform_column: column="原始记录", newColumnName="金额_提取", instruction="提取出金额数字"
2. compute_column: formula="[金额] - [金额_提取]", newColumnName="差额"
3. summarize_column: column="差额"
现在执行第 1 步。`,
};

const mod = await import(`file://${ROOT}/.eval-build/tools.js`);
const c = JSON.parse(await readFile(`${ROOT}/evals/transform-reads-source-column.json`, 'utf8'));
const g = c.grid;
const rows = [];
for (let i = 0; i < g.rowCount; i++) rows.push(g.sampleRows[i] ?? g.headers.map(() => ''));
const system = mod.buildSystemPrompt(
  { headers: g.headers, rows, selectedRows: null, filterKept: null, highlightedRows: null },
  g.sheetName,
);

function parse(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0].replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
}

let neurons = 0;
for (const [name, plan] of Object.entries(PLANS)) {
  const messages = [{ role: 'system', content: system }, ...c.messages];
  if (plan) messages.push({ role: 'user', content: plan });
  const cols = [];
  for (let i = 0; i < RUNS; i++) {
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
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const p = parse(text);
    cols.push(p?.tool === 'transform_column' ? (p.column ?? '?') : `(${p?.tool ?? 'unparsed'})`);
  }
  const good = cols.filter((x) => x === '原始记录').length;
  const bad = cols.filter((x) => x === '金额').length;
  console.log(`${name.padEnd(8)} 原始记录(对) ${good}/${RUNS}   金额(bug) ${bad}/${RUNS}   ${JSON.stringify(cols)}`);
}
console.log(`\nneurons: ${neurons.toFixed(1)}`);
