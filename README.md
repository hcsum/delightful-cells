# Delightful Cells ✨ (+ the Excel extract tools it grew out of)

**Chat with your spreadsheet.** Upload an `.xlsx` / `.csv`, see it instantly,
then just say what you want:

> "summarize the Customer Feedback column"
> "highlight rows containing \"refund\""
> "replace N/A with an empty string in the Status column"

The interesting part: **the AI never edits your data directly.** The model
plans, your browser acts.

```
┌─ your browser ─────────────────────────────┐
│  SheetJS parses the file locally           │
│  tools (filter / replace / stats) run here │──── headers + samples ───┐
│  full table data never leaves the tab*     │                          ▼
└────────────────────────────────────────────┘        /api/chat → llm-worker
                    ▲                                  (Cloudflare Workers AI,
                    └────── one JSON tool call ─────── llama-4-scout)
```

\* only column headers, 5 sample rows, and per-column stats are sent to the model.

## How the agent loop works (the whole runtime is ~150 lines)

1. The system prompt describes the sheet (headers, size, 5 sample rows) and
   three tools, and demands **exactly one JSON object** per reply.
2. The model answers `{"type":"tool_call", ...}` or `{"type":"final", ...}`.
3. The browser validates the call (`lib/cells/tools.ts`), executes it as a pure
   function on the in-memory table (`lib/cells/table-ops.ts`), updates the UI,
   and feeds the result back as a `TOOL_RESULT` message.
4. Repeat, max 4 steps per user message. Malformed JSON gets one correction
   retry, then degrades to a plain-text answer.

No framework, no tool-calling API — just a while-loop
(`lib/cells/agent.ts`). Fork it and add a tool: define its schema in
`lib/cells/tools.ts`, add a pure function in `table-ops.ts`, mention it in the
system prompt. That's it.

## Run it locally

### Zero-setup (mock model, no accounts needed)

```bash
pnpm install
echo 'NEXT_PUBLIC_SITE_URL=http://localhost:3000' >> .env.local
echo 'MOCK_LLM=true' >> .env.local
pnpm dev
# → http://localhost:3000/cells
```

`MOCK_LLM=true` swaps the model for a keyword-matching script in
`app/api/chat/route.ts` — the full agent loop (tool cards, table updates,
error paths) works offline.

### Real model (Cloudflare Workers AI)

```bash
# terminal 1 — the LLM worker (needs `wrangler login`; Workers AI runs remotely)
cd llm-worker
echo 'LLM_API_KEY=devkey' > .dev.vars
npx wrangler dev --port 8787

# terminal 2 — the app
cat >> .env.local <<'EOF'
NEXT_PUBLIC_SITE_URL=http://localhost:3000
LLM_WORKER_URL=http://localhost:8787
LLM_API_KEY=devkey
NEXT_PUBLIC_BYPASS_AUTH=true
EOF
pnpm dev
```

## Repo map

| Path | What it is |
|---|---|
| `app/cells/` + `components/cells/` | Delightful Cells UI (upload → instant table → chat) |
| `lib/cells/` | The interesting bits: parsing, pure table ops, tool schema, agent loop |
| `app/api/chat/route.ts` | Chat proxy (hides the worker key) + the mock model |
| `llm-worker/` | Separate Cloudflare Worker: `/chat` for cells, `/` for the legacy TOON extract endpoint |
| `app/*` (everything else) | The original extractfromexcel.com: SEO landing pages for one-off CSV column extraction (Google login + daily quota) |
| `test-data/` | CSVs to play with |

## Limits (deliberately boring)

5 MB file · 5,000 rows · 60 columns · table renders first 200 rows (tools
operate on everything) · "Reset data" restores the file as uploaded (no
per-step undo yet).

## Deploy

Both the app and `llm-worker/` deploy to Cloudflare Workers:

```bash
pnpm cf                      # app (OpenNext)
cd llm-worker && npx wrangler deploy   # worker; set LLM_API_KEY as a secret
```

## Ideas if you fork this

Per-step undo (inverse patches) · add-derived-column tool · sort tool ·
virtualized table · streaming responses · swap the model for anything
OpenAI-compatible in `llm-worker/src/index.ts`.
