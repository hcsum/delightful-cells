#!/usr/bin/env node
// The half of evals/ that is written rather than recorded.
//
//   node scripts/mint-cases.mjs          rewrite every generated case
//   node scripts/mint-cases.mjs --print  show the messages without writing
//
// Why a generator instead of hand-written JSON. A case is a frozen
// conversation, and in a multi-step one the conversation contains TOOL_RESULT
// payloads. Those payloads are not free text: dispatchTool words each
// "outcome" sentence carefully, and half of what the existing cases catch is
// the model misreading one. A hand-typed payload that looks plausible but is
// subtly off tests the model against something production never emits, and
// whatever it scores means nothing. So every TOOL_RESULT below comes out of
// the real dispatchTool, and every assistant turn is the real validateToolCall
// output — the same JSON lib/cells/agent.ts would have put in the history.
// Re-run this after changing a tool's wording and the cases follow.
//
// The sheets are invented, and deliberately not the one sheet the recorded
// cases came from: a suite built on a single spreadsheet measures how a model
// does on that spreadsheet.
//
// What this file cannot supply is WEIGHTING. Which of these scenarios is 80%
// of real use, and which is once a month, is a question about people, not
// about the tool surface — see docs/model-switch-handover.md.

import { writeFile } from 'node:fs/promises';
import { argv } from 'node:process';
import { loadTools } from './build-tools.mjs';

const EVAL_DIR = new URL('../evals/', import.meta.url);
const { validateToolCall, dispatchTool } = await loadTools();

const cycle = (list, i) => list[i % list.length];
const emptyGrid = (headers, rows) => ({
  headers,
  rows,
  selectedRows: null,
  filterKept: null,
  highlightedRows: null,
});

// ---------------------------------------------------------------------------
// The sheets.

// Orders. The status cycle is 8 long over 120 rows, so the counts are exact
// and each one answers a different question: 已退款 is 30 of 120, which is a
// refund rate of exactly 25% (a wrong answer cannot round into looking right),
// 待付款 is 30 rows to act on, and 已完成 at 45 is an unambiguous "most common".
function ordersGrid() {
  const 客户 = ['张伟', '李娜', '王强', '刘洋', '陈静', '赵磊', '孙悦', '周涛', '吴敏', '郑凯'];
  const 状态 = ['已完成', '待付款', '已完成', '已退款', '已发货', '已完成', '待付款', '已退款'];
  const 数量 = [3, 8, 1, 6, 2, 9, 4];
  const 单价 = [12.5, 88, 6.9, 45, 130, 23.5, 9.9, 260, 19.9];
  const rows = [];
  for (let i = 0; i < 120; i++) {
    rows.push([
      `SO-${1001 + i}`,
      cycle(客户, i),
      String(cycle(数量, i)),
      cycle(单价, i).toFixed(2),
      cycle(状态, i),
      i % 13 === 5 ? '客户要求改地址' : i % 17 === 3 ? '缺货' : '',
    ]);
  }
  return { sheetName: '订单表', grid: emptyGrid(['订单号', '客户', '数量', '单价', '状态', '备注'], rows) };
}

// Customer feedback: free text whose meaning only a reader can judge. This is
// the sheet where filter_rows_ai is the right tool and `contains` is a fake.
function feedbackGrid() {
  const 反馈 = [
    '东西收到了，包装很好，谢谢',
    '等了快两周还没发货，到底还发不发？太离谱了',
    '客服一直不回消息，已经第三次催了，非常失望',
    '价格比上次贵了一些，希望能给个说法',
    '用起来还行，就是说明书有点简单',
    '退款申请交了五天还没到账，这是什么意思',
    '配送小哥很热情，好评',
    '型号发错了，退换还要我自己出邮费？',
  ];
  const 客户 = ['张伟', '李娜', '王强', '刘洋', '陈静', '赵磊'];
  const rows = [];
  for (let i = 0; i < 80; i++) {
    rows.push([
      `F${201 + i}`,
      cycle(客户, i),
      cycle(['微信', '电话', '邮件', '小程序'], i),
      cycle(反馈, i),
      cycle(['小林', '小周', '小赵'], i),
    ]);
  }
  return { sheetName: '反馈表', grid: emptyGrid(['编号', '客户', '渠道', '反馈内容', '处理人'], rows) };
}

// The expense sheet the recorded cases run on, rebuilt. Its point is 原始记录:
// a raw text column that another column was derived from, which is where the
// transform_column bug lives. Only the first five rows ever reach the prompt.
function expenseGrid() {
  const seed = [
    ['1', '打车', '58.27', '差旅费', '市内交通', '', '打车58.27元'],
    ['1', '高铁', '40.00', '差旅费', '高铁', '', '高铁40元'],
    ['1', '办理CA', '260.00', '投标', 'CA证书', '', '办理CA 260元'],
    ['1', '办理CA', '800.00', '投标', 'CA证书', '', '办理CA 800元'],
    ['1', '胶装', '40.00', '投标', '胶装', '', '胶装40元'],
  ];
  const rows = [];
  for (let i = 0; i < 154; i++) rows.push(seed[i] ?? seed[i % seed.length].slice());
  return { sheetName: '明细表', grid: emptyGrid(['月份', '项目', '金额', '大类', '小类', '备注', '原始记录'], rows) };
}

const SHEETS = { orders: ordersGrid, feedback: feedbackGrid, expense: expenseGrid };

// ---------------------------------------------------------------------------
// The cases.
//
// `user` is what the person typed. `calls` are the steps that already ran
// before the moment being judged — written as raw JSON, then validated and
// dispatched for real, so a call this file gets wrong fails loudly here
// instead of quietly becoming a bad case. `assert` may be a function of the
// dispatched results, which is how a case asserts a number the tools actually
// produced rather than one guessed while writing it.

// ---------------------------------------------------------------------------
// What the candidate models scored the day these cases were written, from one
// full-suite run of 8 per case (`node scripts/eval.mjs --runs 8 --model cf:…`).
// This is the before-picture: add a model's line, never overwrite one, or the
// suite stops being able to show that something used to work.
//
// The two zeros are the finding. Every other case separates the two models or
// neither, which is what a suite minted from GLM's mistakes would predict —
// but declines-what-tools-cannot-do and read-row-does-not-overwrite fail
// 0/8 on BOTH, and fail the same way. Those are not a model's error book;
// they are the prompt and the tool surface, and no model swap fixes them.

const MEASURED = '2026-09-15, 8 runs each';
const BASELINES = {
  'plain-filter-selects': 'glm-4.7-flash 8/8, llama-4-scout 8/8',
  'plain-count-uses-filter': 'glm-4.7-flash 8/8, llama-4-scout 8/8',
  'most-common-value-uses-summarize': 'glm-4.7-flash 8/8, llama-4-scout 8/8',
  'semantic-filter-uses-ai': 'glm-4.7-flash 8/8, llama-4-scout 8/8',
  'transform-picks-the-named-column':
    'glm-4.7-flash 8/8, llama-4-scout 8/8 — worth reading next to transform-reads-source-column, '
    + 'which GLM passes 3/8 on the same sheet. Told which column to read, it reads it; '
    + 'left to work the column out, it takes its own output.',
  'arithmetic-uses-compute-column': 'glm-4.7-flash 8/8, llama-4-scout 8/8',
  'set-value-on-named-rows': 'glm-4.7-flash 8/8, llama-4-scout 8/8',
  'declines-what-tools-cannot-do':
    'glm-4.7-flash 0/8, llama-4-scout 0/8 — NEITHER model declines. GLM invents a tool that does not '
    + 'exist ({"tool":"sort_rows","column":"单价","direction":"desc"}) or reaches for summarize_column; '
    + 'llama calls filter_rows, every run. The prompt names sorting as an example of what to decline and '
    + 'it does not take. A validator rejects the invented tool, so the user sees a stall, not a sorted '
    + 'sheet — but nothing rejects a legal filter_rows standing in for a sort. '
    + 'AFTER the 2026-09-15 prompt fix (literal {"type":"final",…} decline templates next to the tool '
    + 'signatures): llama-4-scout 8/8. Prose stating the rule measured 2/8 on the same day — only the '
    + 'copyable template took.',
  'remove-column-deletes-the-named-column':
    '2026-09-15: llama-4-scout 8/8, every run {"tool":"remove_column","columns":["备注"]}. Minted after '
    + 'a real turn showed the tool had no coverage at all; it passes on the first measurement, which is '
    + 'the point of a positive case — it is the line that catches a model that stops doing this.',
  'declines-deleting-a-row':
    '2026-09-15, before the prompt fix: llama-4-scout 0/4 — it answered with '
    + '{"tool":"find_replace","column":"订单号","find":"SO-1005","replace":""}, blanking one cell of the '
    + 'row instead of deleting the row, every run. That call is legal, so nothing rejects it. '
    + 'After the fix: llama-4-scout 6/6.',
  'declines-a-chart-in-english':
    '2026-09-15, after the prompt fix: llama-4-scout 6/6, in English, naming 单价. Minted to check that '
    + 'the decline templates are adapted rather than copied: the templates are a Chinese sort and an '
    + 'English chart, and this case and declines-deleting-a-row are the two that would catch a model '
    + 'reciting one of them at the wrong request.',
  'read-row-does-not-overwrite':
    'glm-4.7-flash 0/8, llama-4-scout 0/8 — both emit the identical destructive getter, '
    + '{"tool":"find_replace","column":"原始记录","find":"","replace":"","rows":[24]}, on every run. '
    + 'validateToolCall refuses that exact shape, which is the only reason the cell survives; the guard '
    + 'is load-bearing on both models, not a belt-and-braces check for one. '
    + 'AFTER the 2026-09-15 prompt fix (summarize_column\'s signature line carries "rows":[46] and the '
    + 'row template names reading before writing): llama-4-scout 8/8, every run '
    + '{"tool":"summarize_column","column":"原始记录","rows":[24]}. The assertion was tightened at the '
    + 'same time — a decline no longer passes, because there is now a tool that answers.',
  'rate-is-counted-not-computed': 'glm-4.7-flash 8/8, llama-4-scout 8/8',
  'count-reports-the-matched-rows': 'glm-4.7-flash 8/8, llama-4-scout 8/8',
  'rate-reported-as-a-percentage': 'glm-4.7-flash 8/8, llama-4-scout 8/8 (with both counts in hand — see "why")',
  'most-common-value-reads-topvalues': 'glm-4.7-flash 8/8, llama-4-scout 8/8',
  'chain-acts-on-the-selection': 'glm-4.7-flash 8/8, llama-4-scout 8/8',
};

const CASES = [
  // --- the ordinary path, single step -------------------------------------
  {
    name: 'terminal-on-a-sheet-edit',
    sheet: 'orders',
    user: '把状态列里的已退款替换成退款完成',
    why: 'A visible, single-tool sheet edit is the terminal happy path: the card fully describes the completed replacement, so a second model call adds nothing.',
    assert: {
      requireCall: [{ tool: 'find_replace', column: '状态', includes: { replace: ['退款完成'] } }],
      requireThen: true,
    },
  },
  {
    name: 'no-terminal-on-a-question',
    sheet: 'orders',
    user: '哪个状态的订单最多？',
    why: 'summarize_column returns evidence for the model to interpret; ending at its tool card would leave the user question unanswered. The tool choice is the correctness half. The "then" half is prompt hygiene and is asserted as such: summarize_column is not in TERMINAL_TOOLS, so the validator drops the flag and no turn could have ended here however the model wrote the reply.',
    assert: {
      requireCall: [{ tool: 'summarize_column', column: '状态' }],
      forbidRawThen: true,
    },
  },
  {
    name: 'no-terminal-before-a-second-tool',
    sheet: 'orders',
    user: '把待付款的订单备注都写成「已催」',
    why: 'The first filter only creates the selection needed by the second write, so it must not terminate the turn. filter_rows IS terminal, so a "then" here survives validation and really would end the turn one tool short — this is the correctness gate the flag rests on.',
    assert: {
      requireCall: [{ tool: 'filter_rows', column: '状态', mode: 'select' }],
      forbidThen: true,
    },
  },
  {
    name: 'plain-filter-selects',
    sheet: 'orders',
    user: '把状态是已退款的行选出来',
    why: 'The plainest thing the tool surface does: one mechanical condition, one filter_rows, mode "select" because the user said 选出来. Nothing here is a trap — that is the point. Every other case asserts that a specific mistake did not happen, and a suite of only those cannot tell a model that fixed a bug from a model that broke the basics. equals and contains are both accepted: on this column they select the same 30 rows.',
    assert: { requireCall: [{ tool: 'filter_rows', column: '状态', op: ['equals', 'contains'], mode: 'select' }] },
  },
  {
    name: 'plain-count-uses-filter',
    sheet: 'orders',
    user: '数量大于 5 的订单有多少个？',
    why: 'Counting rows means filter_rows and reading rowsMatched. The tempting wrong turn is summarize_column, whose result carries distinct and count for the whole column and no answer to "how many rows are over 5" — the outcome sentence says so in as many words, and a model that reaches for it has to either guess or come back. gt is the only op that compares numerically.',
    assert: { requireCall: [{ tool: 'filter_rows', column: '数量', op: 'gt' }] },
  },
  {
    name: 'most-common-value-uses-summarize',
    sheet: 'orders',
    user: '哪个状态的订单最多？',
    why: 'The mirror of the case above: here summarize_column IS the right call, because its topValues holds every value with its count and answers the question in one step. A model that instead runs filter_rows once per status is not wrong so much as expensive, and it will usually stop after the first one and report that count as the winner.',
    assert: { requireCall: [{ tool: 'summarize_column', column: '状态' }] },
  },
  {
    name: 'semantic-filter-uses-ai',
    sheet: 'feedback',
    user: '把语气听起来很生气的反馈挑出来',
    why: 'A test no string match can stand in for: anger is in the wording, and none of these cells contains the word 生气. filter_rows with contains would return a tidy, wrong, cheap answer — and a zero-match filter reads as "no angry customers", which is worse than an error. This is also the one criteria shape the foreign-column guard must NOT block: it is about the cell it judges and names no other column.',
    assert: {
      requireCall: [{ tool: 'filter_rows_ai', column: '反馈内容' }],
      forbidCalls: [{ tool: 'filter_rows' }],
    },
  },
  {
    name: 'transform-picks-the-named-column',
    sheet: 'expense',
    user: '把原始记录里买的是什么东西提出来，单独放一列',
    why: 'The positive twin of transform-reads-source-column, on the same sheet. There the model pointed transform_column at the derived column and read its own output back out; here the user names the source column outright, so picking 原始记录 is the whole job. If this one fails, the problem is not a subtle source/target confusion — the model cannot follow an explicit column name.',
    assert: { requireCall: [{ tool: 'transform_column', column: '原始记录' }] },
  },
  {
    name: 'arithmetic-uses-compute-column',
    sheet: 'orders',
    user: '加一列金额，等于数量乘以单价',
    why: 'Arithmetic across two columns is compute_column and nothing else: the formula is evaluated exactly, per row. transform_column is the failure mode worth naming — it can only see one column, so an AI "multiply these" instruction would be working from half the inputs and inventing the rest, at a neuron cost per row. The formula must reference both source columns; the new column name is the user\'s to choose and is not asserted.',
    assert: {
      requireCall: [{ tool: 'compute_column', includes: { formula: ['数量', '单价'] } }],
      forbidCalls: [{ tool: 'transform_column' }],
    },
  },
  {
    name: 'set-value-on-named-rows',
    sheet: 'orders',
    user: '把第 7 行的状态改成已完成',
    why: 'Writing one cell: find_replace with an empty find, the new value in replace, and "rows":[7]. The row number the user typed is 1-based and reaches the tool unchanged. A call without "rows" is the one that matters — an empty find with no target overwrites the whole column, which validateToolCall refuses, but by then the model has already decided to sweep 120 rows.',
    assert: { requireCall: [{ tool: 'find_replace', column: '状态', rows: [7], includes: { replace: ['已完成'] } }] },
  },
  {
    name: 'declines-what-tools-cannot-do',
    sheet: 'orders',
    user: '帮我按单价从高到低排序',
    why: 'There is no sort tool. The prompt asks for a final answer naming the closest thing that exists, and the failure being guarded is improvisation: filter_rows with op gt and an invented threshold looks like progress and reorders nothing. Any tool call fails this case; what the decline says is not asserted, only that it is a decline.',
    assert: { mustBeFinal: true },
  },
  {
    name: 'remove-column-deletes-the-named-column',
    sheet: 'expense',
    user: '把备注这一列删了',
    why: 'remove_column had no case at all — it was missed when the scenarios were picked off the tool surface, and a real turn on 2026-09-15 ("把差异列删了") was the thing that noticed. It is the only structural tool and the only one whose mistake is unrecoverable from the chat, so the failure worth pinning is reaching for find_replace to blank the column instead, which looks the same on screen and leaves the header behind.',
    assert: {
      requireCall: [{ tool: 'remove_column', includes: { columns: ['备注'] } }],
      forbidCalls: [{ tool: 'find_replace' }, { tool: 'transform_column' }],
    },
  },
  {
    name: 'declines-deleting-a-row',
    sheet: 'orders',
    user: '把第 5 行删掉',
    why: 'No tool deletes rows, and the improvisation here is destructive rather than merely useless: find_replace on that row\'s 订单号 with an empty replace blanks a cell and leaves the row in place. That call is legal — a non-empty find with an empty replace is how you delete text — so no validator stands between it and the data. Any tool call fails this case.',
    assert: { mustBeFinal: true },
  },
  {
    name: 'declines-a-chart-in-english',
    sheet: 'orders',
    user: 'Can you make a bar chart of 单价?',
    why: 'The second half of the decline fix: the prompt teaches declining with two literal {"type":"final",…} templates, and literal templates get copied verbatim by these models. This case and declines-deleting-a-row exist to catch that — a different unsupported ask, in the other language, so a model reciting the sort template instead of answering the question shows up as wrong content rather than as a pass. Asserted only as a decline; the wording is read with --show.',
    assert: { mustBeFinal: true },
  },
  {
    name: 'read-row-does-not-overwrite',
    sheet: 'expense',
    user: '第 24 行的原始记录写的是什么？',
    why: 'Reading a cell. find_replace used to be the only tool whose example showed "rows", so it got reached for as a getter — and find_replace does not read, it writes: with both find and replace empty it erases the cell the user asked about. validateToolCall rejects that exact shape, so the cell survives, but the user gets a stall instead of an answer. Since 2026-09-15 summarize_column carries "rows" in its own signature line and returns the named cells in its result, so the case now asserts the read positively: a decline no longer passes, because there is a tool that answers.',
    assert: {
      requireCall: [{ tool: 'summarize_column', column: '原始记录', rows: [24] }],
      forbidCalls: [{ tool: 'find_replace' }],
    },
  },
  {
    name: 'rate-is-counted-not-computed',
    sheet: 'orders',
    user: '退款率是多少？',
    why: 'A rate over a table is rows-over-rows. The recorded failure class is compute_column, which is per-row and cannot divide a count by a count — asked for a share it produces a column of per-row ratios, often by dividing by whatever numeric column is nearest, and the model then reads one of those cells as the answer. Either counting route passes: filter_rows on 状态 (read rowsMatched) or summarize_column on 状态 (read topValues).',
    assert: {
      forbidCalls: [{ tool: 'compute_column' }],
      requireCall: [
        { tool: 'filter_rows', column: '状态' },
        { tool: 'summarize_column', column: '状态' },
      ],
    },
  },

  // --- the ordinary path, after a tool result -----------------------------
  {
    name: 'count-reports-the-matched-rows',
    sheet: 'orders',
    user: '数量大于 5 的订单有多少个？',
    calls: [{ tool: 'filter_rows', column: '数量', op: 'gt', value: '5', mode: 'select' }],
    why: 'The second half of a count: the number is back, and the job is to say it. rowsMatched is the answer; rowsTotal and the sheet\'s row count are the numbers it gets confused with, and the 5 sample rows in the prompt are the other place a number can be invented from. Asserting the digits appear in the final message is a low bar deliberately — this case exists to fail when a model stops calling tools and starts estimating.',
    assert: (results) => ({
      mustBeFinal: true,
      mustMention: [String(results[0].data.rowsMatched)],
    }),
  },
  {
    name: 'rate-reported-as-a-percentage',
    sheet: 'orders',
    user: '退款率是多少？',
    calls: [
      { tool: 'filter_rows', column: '状态', op: 'equals', value: '已退款', mode: 'select' },
      { tool: 'summarize_column', column: '状态', scope: 'all' },
    ],
    why: 'The division, once the counting is done: 30 已退款 out of 120 rows is 25%, exact, so a right answer cannot be a rounding coincidence and the wrong readings land nowhere near it. The history deliberately runs BOTH counting routes before the assertion — filter_rows and then summarize_column — even though either one alone carries the two numbers. Measured 2026-09-15: given only one of them, GLM never divides, it calls the other one (8/8 after filter_rows, 4/4 after summarize_column, every single reply a tool call). Given both, it answers 25% every time. So a one-step version of this case would score zero while testing nothing about arithmetic; what it would really be measuring is that the model keeps gathering while any tool is left uncalled. That behaviour costs a round trip and is worth knowing, but it is not this case. Note what is NOT asserted: the wording, or whether the model calls something else first.',
    assert: { mustBeFinal: true, mustMention: ['25'] },
  },
  {
    name: 'most-common-value-reads-topvalues',
    sheet: 'orders',
    user: '哪个状态的订单最多？',
    calls: [{ tool: 'summarize_column', column: '状态' }],
    why: 'topValues is sorted, so the answer is its first entry: 已完成, 45 rows. The failure this catches is reading the summary by field name instead of by its outcome sentence — distinct is 4, and "4 种状态" is a fluent answer to a question nobody asked. Both the winning value and its count must appear.',
    assert: (results) => ({
      mustBeFinal: true,
      mustMention: [results[0].data.topValues[0].value, String(results[0].data.topValues[0].count)],
    }),
  },
  {
    name: 'chain-acts-on-the-selection',
    sheet: 'orders',
    user: '把待付款的订单备注都写成「已催」',
    calls: [{ tool: 'filter_rows', column: '状态', op: 'equals', value: '待付款', mode: 'select' }],
    why: 'Condition plus action: filter first, then act on what the filter selected. Step two is the one being judged, and it is the step where the scope has to be named. The 30 matching rows are the selection now, so an omitted scope happens to hit them — which is why the assertion is not "did the right rows change" but "did the model say which rows it meant". The same silence over an empty selection would have written 「已催」 into all 120. "scope":"all" is the explicit version of the same mistake.',
    assert: {
      requireCall: [{ tool: 'find_replace', column: '备注', includes: { replace: ['已催'] } }],
      requireExplicitScope: ['find_replace'],
      forbidCalls: [{ tool: 'find_replace', scope: 'all' }],
    },
  },
];

// ---------------------------------------------------------------------------

function gridSpec(grid, sheetName) {
  const spec = {
    sheetName,
    headers: grid.headers,
    rowCount: grid.rows.length,
    sampleRows: grid.rows.slice(0, 5),
  };
  if (grid.selectedRows?.size) spec.selectedCount = grid.selectedRows.size;
  if (grid.filterKept) spec.visibleCount = grid.filterKept.length;
  if (grid.highlightedRows?.size) spec.highlightedCount = grid.highlightedRows.size;
  if (grid.lineage && Object.keys(grid.lineage).length) spec.lineage = grid.lineage;
  return spec;
}

function build(c) {
  const { sheetName, grid: start } = SHEETS[c.sheet]();
  let grid = start;
  const messages = [{ role: 'user', content: c.user }];
  const results = [];
  for (const raw of c.calls ?? []) {
    const v = validateToolCall(raw, grid.headers, grid);
    if (v.error) throw new Error(`${c.name}: the case's own call was rejected — ${v.error}`);
    const { result, nextGrid } = dispatchTool(v.call, grid);
    if (!result.ok) throw new Error(`${c.name}: the case's own call failed — ${JSON.stringify(result.data)}`);
    messages.push({ role: 'assistant', content: JSON.stringify({ type: 'tool_call', ...v.call }) });
    messages.push({ role: 'user', content: `TOOL_RESULT ${v.call.tool}: ${JSON.stringify(result.data)}` });
    results.push(result);
    grid = nextGrid;
  }
  return {
    name: c.name,
    why: c.why,
    baseline: BASELINES[c.name] ? `${MEASURED}: ${BASELINES[c.name]}` : 'not measured',
    generatedBy: 'scripts/mint-cases.mjs — edit the recipe there, not this file',
    assert: typeof c.assert === 'function' ? c.assert(results) : c.assert,
    messages,
    grid: gridSpec(grid, sheetName),
  };
}

for (const c of CASES) {
  const built = build(c);
  if (argv.includes('--print')) {
    console.log(`\n=== ${built.name} ===`);
    for (const m of built.messages) console.log(`[${m.role}] ${m.content}`);
    console.log(`assert: ${JSON.stringify(built.assert)}`);
    continue;
  }
  await writeFile(new URL(`${built.name}.json`, EVAL_DIR), JSON.stringify(built, null, 2) + '\n');
  console.log(`evals/${built.name}.json`);
}
