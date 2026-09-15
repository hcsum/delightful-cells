#!/usr/bin/env node
// Reads back what lib/trace.ts wrote. Default: replay the last turn in full.
//
//   node scripts/trace.mjs              last turn, every event
//   node scripts/trace.mjs --list       one line per turn, newest last
//   node scripts/trace.mjs --turn t8x9  a turn by id (prefix is enough)
//   node scripts/trace.mjs --last 3     the last 3 turns
//
// The .jsonl the sink writes is already grep-able; this is for reading a whole
// chain in order without stitching the lines together by hand.

import { readdir, readFile } from 'node:fs/promises';
import { argv } from 'node:process';

const DIR = new URL('../.dev-trace/', import.meta.url);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1] ?? '';
};

const files = (await readdir(DIR).catch(() => [])).filter((f) => f.endsWith('.jsonl')).sort();
if (!files.length) {
  console.error('No trace yet. Set NEXT_PUBLIC_DEBUG_TRACE=1 in .env.local, restart `pnpm dev`, and send one message.');
  process.exit(1);
}

const events = [];
for (const f of files) {
  const text = await readFile(new URL(f, DIR), 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch {}
  }
}

const turns = [];
const byTurn = new Map();
for (const e of events) {
  if (!byTurn.has(e.turn)) { byTurn.set(e.turn, []); turns.push(e.turn); }
  byTurn.get(e.turn).push(e);
}

if (argv.includes('--list')) {
  for (const id of turns) {
    const es = byTurn.get(id);
    const user = es.find((e) => e.kind === 'turn')?.user ?? '(unknown)';
    const tools = es.filter((e) => e.kind === 'call').map((e) => e.call.tool).join(', ') || '—';
    console.log(`${id}  ${es[0].t.slice(11, 19)}  ${es.length} events  [${tools}]  ${user.slice(0, 50)}`);
  }
  process.exit(0);
}

const wanted = flag('--turn');
const count = Number(flag('--last') ?? 1) || 1;
const picked = wanted
  ? turns.filter((id) => id.startsWith(wanted))
  : turns.slice(-count);

for (const id of picked) {
  console.log(`\n${'='.repeat(72)}\nTURN ${id}\n${'='.repeat(72)}`);
  for (const e of byTurn.get(id)) {
    const { t, turn, seq, kind, ...rest } = e;
    console.log(`\n── ${t.slice(11, 23)}  #${seq}  ${kind.toUpperCase()} ${'─'.repeat(Math.max(0, 48 - kind.length))}`);
    for (const [k, v] of Object.entries(rest)) {
      if (typeof v === 'string' && (v.includes('\n') || v.length > 120)) console.log(`${k}:\n${v}`);
      else console.log(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
  }
}
