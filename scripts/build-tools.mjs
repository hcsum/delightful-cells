// Compiling lib/cells/tools.ts so a node script can call it.
//
// Two scripts need the real module rather than a copy of what it emits:
// scripts/eval.mjs re-renders buildSystemPrompt for every case, and
// scripts/mint-cases.mjs replays dispatchTool to produce TOOL_RESULT payloads.
// Both would otherwise freeze text that the app is free to reword, and a case
// asserting against wording production no longer emits tests nothing.
//
// node cannot import .ts directly (it resolves extensionless relative imports
// as .js), so compile the handful of modules to a temp dir and patch the
// specifiers. tsc is already a devDependency; this costs a couple of seconds
// once per run.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const BUILD_DIR = new URL('../.eval-build/', import.meta.url);

let cached = null;

export async function loadTools() {
  if (cached) return cached;
  const r = spawnSync('npx', ['tsc', 'lib/cells/tools.ts', '--outDir', '.eval-build',
    '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'],
    { encoding: 'utf8' });
  const built = await readdir(BUILD_DIR).catch(() => []);
  if (!built.includes('tools.js')) {
    throw new Error(`could not compile lib/cells/tools.ts:\n${r.stdout || r.stderr}`);
  }
  // tsc keeps the extensionless specifiers the bundler resolves; node will not.
  for (const f of built.filter((f) => f.endsWith('.js'))) {
    const url = new URL(f, BUILD_DIR);
    const src = await readFile(url, 'utf8');
    await writeFile(url, src.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.js"'));
  }
  // Marks the build output as ESM; without it node re-parses every file and
  // warns about it on each run.
  await writeFile(new URL('package.json', BUILD_DIR), '{"type":"module"}\n');
  cached = await import(new URL('tools.js', BUILD_DIR).href);
  return cached;
}

// table-ops.ts is compiled alongside tools.ts as its dependency, so the pure
// writers are reachable by the same route — no second tsc run.
export async function loadTableOps() {
  await loadTools();
  return import(new URL('table-ops.js', BUILD_DIR).href);
}
