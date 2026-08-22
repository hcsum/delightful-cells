# Delightful Cells ✨

**Chat with your spreadsheet.** Upload an `.xlsx` / `.csv`, see it instantly,
then just say what you want:

> "highlight rows containing refund"
> "replace N/A with unknown in Status"
> "summarize each row of Customer Feedback into a keyword column"

## The model plans, your browser acts

The LLM never touches your data. It emits one small JSON tool call per step;
the browser validates and executes it locally, then reports back. The whole
loop is ~150 lines, no framework (`lib/cells/agent.ts`).

```
browser (SheetJS parse + tools run here) ── headers + 5 sample rows ──▶ LLM
        ◀──────────────── one JSON tool call ──────────────────────────┘
```

Why bulk edits are stable:

- **Mechanical ops are code, not generation.** Replacing across 5,000 rows is
  one deterministic function — the model only picks the parameters. No
  hallucinated cell values, no tokens spent on data.
- **Per-row AI fills are batched and fenced.** `transform_column` streams rows
  through the LLM 50 at a time in [TOON](https://github.com/toon-format/toon)
  (tab-separated, id-keyed — far fewer tokens than JSON). IDs re-map dropped
  or reordered rows, repair parsers fix malformed output, one bad batch never
  kills the run. Temperature 0.
- **Cheap context.** The model only ever sees column names, 5 sample rows,
  and tool results — never the table.

Add a tool: schema in `lib/cells/tools.ts`, pure function in
`lib/cells/table-ops.ts`, one line in the system prompt.

## Run locally

```bash
# zero-setup: offline mock model, no accounts
pnpm install
printf 'NEXT_PUBLIC_SITE_URL=http://localhost:3000\nMOCK_LLM=true\n' >> .env.local
pnpm dev
```

Real model (Cloudflare Workers AI):

```bash
cd llm-worker && echo 'LLM_API_KEY=devkey' > .dev.vars && npx wrangler dev --port 8787
# .env.local: LLM_WORKER_URL=http://localhost:8787  LLM_API_KEY=devkey
pnpm dev
```

## Deploy

```bash
pnpm cf                                # app (OpenNext → Cloudflare Workers)
cd llm-worker && npx wrangler deploy   # worker; set LLM_API_KEY as a secret
```

MIT. Fork ideas: per-op undo · sort tool · virtualized table · streaming ·
swap in any model in `llm-worker/src/index.ts`.
