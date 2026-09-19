# SSE Migration Plan

## Goal

Replace the current one-shot JSON chat response with end-to-end Server-Sent
Events (SSE), so users receive meaningful feedback while the model is working.
The migration must preserve the current billing, tool-call, validation, and
multi-step agent semantics.

The target request path is:

```text
Browser
  -> Next /api/chat/stream
  -> llm-worker /chat-stream
  -> Workers AI with stream: true

Workers AI chunks
  -> llm-worker reconstructs and sanitizes the response
  -> Next records usage and settles billing
  -> Browser receives safe progress events and the final response
```

The UI must not display raw reasoning, raw model tokens, or incomplete tool
JSON. Streaming is used to expose activity, not to reveal the model's internal
output.

## Non-goals

- Do not stream partial assistant text into the chat bubble.
- Do not expose reasoning content or chain of thought.
- Do not invent a completion percentage.
- Do not change the agent's JSON tool protocol.
- Do not change tool validation or execution order.
- Do not migrate the row-processing `/api/process` endpoint in the first phase.
- Do not remove the existing non-streaming `/chat` path until the new path has
  been stable in production.

## Current architecture

The current chat flow is fully buffered:

1. `lib/cells/agent.ts` posts messages to `/api/chat`.
2. `app/api/chat/route.ts` checks entitlement and forwards the request to the
   LLM Worker.
3. `llm-worker/src/index.ts` waits for `env.AI.run()` to return a complete
   object.
4. The LLM Worker extracts the final text and returns JSON plus `x-usage-*`
   headers.
5. The Next route reads the usage headers, records site usage, charges the
   user or free allowance, and returns the final JSON.
6. The browser parses the complete model response and either executes a tool
   or displays the final answer.

This has a useful invariant: the Next route knows the measured neuron cost
before it sends the result to the browser. The SSE design must preserve that
invariant without relying on response headers that cannot be changed after a
stream begins.

## Phase 1: verify the Workers AI stream

This phase is a go/no-go gate. Before changing production behavior, add a
standalone probe for `@cf/zai-org/glm-5.3-flash` and record the real stream
schema.

The probe must verify:

1. Whether `stream: true` returns a `ReadableStream`, raw SSE response, or
   another iterable shape.
2. The exact field containing content deltas.
3. Whether reasoning deltas are separate from content deltas.
4. The completion or `[DONE]` event format.
5. Whether the terminal event includes prompt tokens, completion tokens, and
   measured neurons.
6. Whether usage is still available after a client-side cancellation.
7. The event shape for model errors, timeouts, and empty responses.
8. Typical time to the first model chunk.
9. Whether reconstructing streamed content produces the same usable output as
   the current non-streaming `extractText()` behavior.

Proceed with full SSE only if an exact measured neuron value is available by
the end of the stream. Do not derive billing from a local price table. If
streaming does not expose measured neurons, keep the existing inference path
and limit the change to application-generated connection/status feedback.

Suggested probe file:

```text
scripts/stream-probe.mjs
```

The probe must not log prompts, spreadsheet data, or reasoning in production.
Development output may show sanitized chunk shapes with content replaced by
lengths.

## Phase 2: define a stable application SSE protocol

Do not forward Cloudflare's raw stream to the browser. Introduce an
application-owned protocol so the UI remains independent of model-specific
chunk formats.

Use the following event types:

```text
accepted
model_started
activity
result
error
done
```

Every event should use a common envelope:

```json
{
  "type": "activity",
  "requestId": "request-id",
  "seq": 3,
  "at": 1780000000000,
  "data": {
    "phase": "generating"
  }
}
```

### `accepted`

The Next route has completed request validation, identity resolution, site
budget checks, and free/paid entitlement checks. This event means the request
was accepted, not that the model has emitted output.

### `model_started`

The LLM Worker is beginning the Workers AI call. The UI can display “Analyzing
your sheet”.

### `activity`

The LLM Worker has received another model chunk. This event must not contain
the raw delta. Throttle it to at most one event every one or two seconds to
avoid unnecessary network traffic and React renders.

Use a generic phase such as `generating`. Even if the provider distinguishes
reasoning from content, do not expose reasoning details to the user.

### `result`

Contains the complete sanitized model response after the Worker has finished
reconstructing it:

```json
{
  "response": "{\"type\":\"tool_call\",...}"
}
```

The browser must not parse or execute a tool until this event is received.

### `error`

Once an SSE response has started, the server can no longer change the HTTP
status code. Runtime failures must therefore be represented as events:

```json
{
  "code": "upstream_stream_failed",
  "message": "The model response was interrupted.",
  "retrySafe": false
}
```

### `done`

Confirms that inference, usage recording, and billing settlement have
completed and that the stream is closing normally.

## Phase 3: add a streaming endpoint to the LLM Worker

Keep the existing `/chat` endpoint unchanged. Add `/chat-stream` alongside it.

The new endpoint should:

1. Perform the same API-key, rate-limit, message-count, role, and total-size
   validation as `/chat`.
2. Create a `TransformStream` and return a `text/event-stream` response.
3. Send `model_started` immediately before beginning inference.
4. Call Workers AI with the same model settings plus `stream: true`.
5. Parse each provider chunk.
6. Discard reasoning deltas.
7. Append content deltas to a private buffer.
8. Emit throttled `activity` events as chunks arrive.
9. Capture the terminal usage object.
10. Sanitize the complete content using the equivalent of `extractText()`.
11. Emit a terminal internal event containing the complete response and usage.
12. Close the stream.

The response should include at least:

```text
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-store
Connection: keep-alive
```

The Worker must not depend on `x-usage-*` headers for the streaming path.
Headers are committed when streaming starts and cannot carry usage discovered
at the end of inference.

Suggested internal helpers:

```text
extractStreamDelta(chunk)
extractStreamUsage(chunk)
writeSseEvent(writer, event)
writeSseError(writer, error)
```

Provider-specific parsing should be isolated from the endpoint so a future
model change only requires updating one adapter.

## Phase 4: add the Next streaming proxy

Add a new route rather than replacing the current route:

```text
app/api/chat/stream/route.ts
```

### Work completed before starting SSE

All errors that can be known in advance should remain ordinary JSON responses
with correct HTTP status codes:

- Invalid request JSON.
- Invalid roles or message structure.
- Too many messages.
- Conversation too large.
- Site budget exhausted.
- Daily allowance exhausted with no purchased balance.
- Missing Worker configuration.

Only create the streaming response after these checks pass.

### Work completed after starting SSE

The Next route should create its own `TransformStream` and act as a controlled
proxy:

1. Emit `accepted`.
2. Request the LLM Worker `/chat-stream` endpoint.
3. Parse the upstream SSE stream.
4. Forward safe `model_started` and `activity` events.
5. Never forward raw deltas, reasoning, or usage to the browser.
6. Receive the complete response and usage from the terminal Worker event.
7. Record site usage.
8. Charge the paid balance or commit free usage.
9. Emit `result` only after settlement has been attempted.
10. Emit `done` and close the stream.

## Phase 5: adapt billing to terminal stream usage

The current `meterAndCharge()` reads usage from response headers. Add a second
entry point that accepts measured usage directly:

```ts
meterAndChargeUsage(
  usage: {
    inputTokens: number;
    outputTokens: number;
    neurons: number;
  },
  entitlement: Entitlement,
  reason: LedgerReason,
  requestId: string,
): Promise<number>
```

Keep the existing header-based function for the non-streaming route.

The settlement order must remain:

```text
record site usage
  -> deduct purchased neurons for paid calls
  or
  -> commit measured neurons to the daily free allowance
  -> deliver the final result
```

Preserve the existing policy that a user should still receive a result if the
credit deduction fails after the inference has already completed. Site usage
should still be recorded, and the billing failure should be logged for
investigation.

### Idempotency

The same `requestId` must be used by the browser, Next route, LLM Worker,
usage records, and credit ledger.

Settlement must be idempotent so one request ID can create at most one:

- Site-usage record.
- Daily-free usage commitment.
- Paid credit deduction.

If the existing ledger reference is not protected by a unique constraint or
equivalent check, add explicit idempotency before enabling SSE in production.

## Phase 6: handle client disconnects safely

Disconnect behavior is the largest runtime risk after usage availability.
Test all of these cases:

1. The browser disconnects before inference begins.
2. The browser disconnects while the model is generating.
3. The browser disconnects after inference but before settlement.
4. The browser receives `result` but disconnects before `done`.
5. Next loses its connection to the LLM Worker.
6. The LLM Worker loses its connection to Workers AI.

Once inference begins, a browser disconnect must not cause the already-incurred
cost to disappear. The Next route should continue consuming the upstream
stream until terminal usage is available and then complete settlement.

The browser-facing writer and the upstream pump should therefore be decoupled:

- Failure to write an activity event to the browser should stop future UI
  writes, but should not automatically cancel upstream inference.
- The upstream stream should continue being consumed for usage and settlement.
- The background task must be attached to the Cloudflare/OpenNext request
  lifecycle using the supported `waitUntil` or after-response mechanism.

This behavior must be verified in the deployed OpenNext runtime. If the
runtime cannot guarantee settlement after browser cancellation, do not enable
SSE for paid traffic until another settlement design is available.

## Phase 7: implement the browser SSE reader

The request contains a POST body, so browser `EventSource` is not suitable.
Use `fetch()` and parse `response.body` as a stream.

Add a streaming equivalent to `postChat()` in `lib/cells/agent.ts`:

```ts
postChatStream(messages, locale, {
  onStatus,
  signal,
}): Promise<string>
```

It should:

1. POST to `/api/chat/stream`.
2. Preserve the current JSON error handling for non-2xx responses.
3. Decode bytes incrementally with `TextDecoder` streaming mode.
4. Parse SSE frames across arbitrary byte and network chunk boundaries.
5. Ignore heartbeat comments.
6. Call `onStatus()` for safe progress events.
7. Store the complete response received in `result`.
8. Resolve only after `done`.
9. Reject on `error`, malformed protocol, or an incomplete stream.

The existing agent loop should remain conceptually unchanged:

```text
await complete model response
  -> extractToolJson
  -> validateToolCall
  -> applyTool
  -> start the next agent step if required
```

This keeps partial output from triggering a tool and minimizes regression risk.

## Phase 8: update the UI state model

Replace the simple boolean thinking state with an explicit phase:

```ts
type AgentPhase =
  | "idle"
  | "connecting"
  | "accepted"
  | "analyzing"
  | "generating"
  | "executing_tool"
  | "processing_rows"
  | "checking_result";
```

Suggested mapping:

| Signal | UI copy |
| --- | --- |
| User sends a message | Connecting... |
| `accepted` | Request accepted... |
| `model_started` | Analyzing your sheet... |
| `activity` | Generating the next action... |
| Parsed tool call | Running the action... |
| Row progress | Processing rows... X/Y |
| Next agent step | Checking the result... |

Do not display token counts, reasoning, percentages, or claims such as “almost
done”. The provider does not supply reliable completion progress.

Throttle status updates so activity chunks do not trigger a render for every
token.

## Phase 9: add heartbeats

Send an SSE comment every 10–15 seconds while the stream is otherwise idle:

```text
: ping
```

Heartbeats serve two purposes:

- Prevent idle connections from being closed by intermediaries.
- Let the client distinguish an active connection from a dead one before the
  model emits its first chunk.

A heartbeat is not model progress and should not advance the displayed phase.
If the UI references it at all, use neutral copy such as “Still working”.

Timeout thresholds should be chosen from observed production latency rather
than guessed in advance.

## Phase 10: define retry and fallback behavior

Do not automatically retry through the non-streaming endpoint after inference
may have started. An automatic fallback can create this failure:

```text
streaming request completes and incurs cost
  -> client misses the final event
  -> client retries with the legacy endpoint
  -> duplicate inference and duplicate cost
```

Use these rules:

- Errors discovered before streaming starts remain normal HTTP errors.
- Errors after `accepted` are shown to the user and are not automatically
  retried.
- The user may manually retry.
- A feature flag selects streaming or legacy mode before a new turn begins.
- Turning the feature flag off affects future turns only.
- Never replay a partially completed tool turn automatically.

The legacy endpoint is a deployment rollback path, not a per-request automatic
fallback.

## Phase 11: testing

### SSE parser unit tests

Cover:

- One frame split across many byte chunks.
- Multiple frames in one network chunk.
- A UTF-8 character split across chunks.
- LF and CRLF separators.
- Multi-line `data:` fields if supported.
- Heartbeat comments.
- Malformed JSON data.
- Missing `done`.
- `error` followed by close.
- `result` followed by an abnormal close.

### LLM Worker stream tests

Cover fixtures for:

- Separate reasoning and content deltas.
- Content-only deltas.
- Empty reasoning.
- Inline `<think>` blocks.
- Terminal usage.
- `[DONE]`.
- Model error events.
- Stream interruption.
- Empty final content.
- Stream reconstruction equivalent to current `extractText()` behavior.

### Billing tests

Test this matrix:

| Daily free allowance | Purchased balance | Expected settlement |
| --- | --- | --- |
| Available | Any | Commit free neurons |
| Exhausted | Available | Deduct purchased neurons |
| Exhausted | Empty | Reject before opening SSE |
| Site free budget exhausted | Available | Use purchased neurons |
| Site free budget exhausted | Empty | Reject before opening SSE |

Also verify:

- A repeated request ID does not settle twice.
- A browser disconnect still records terminal usage.
- Missing usage raises a high-priority error.
- A credit-database failure does not call the model again.
- A malformed model result still records incurred site cost.

### Agent regression tests

Run the existing eval suite against both paths and compare:

- Final response parsing.
- Tool name and arguments.
- Number of agent steps.
- Invalid-tool correction.
- Unknown-tool handling.
- Irreversible-tool protections.
- Final prose after a sheet mutation.

No new eval failures should be accepted solely because transport changed.

### End-to-end tests

Verify:

- Local mock streaming.
- Deployed Cloudflare Worker streaming.
- Slow first-token responses.
- Browser refresh during inference.
- Network interruption.
- Mobile network behavior.
- Proxy buffering.
- Compression behavior.
- Background settlement in the production OpenNext runtime.

## Phase 12: extend mock mode

Add deterministic SSE behavior to `MOCK_LLM=true` so the complete UI and
billing path can be exercised without Workers AI.

The mock sequence should be:

```text
accepted
short delay
model_started
activity
short delay
result
done
```

Mock usage should continue using a fixed measured neuron value.

Useful development fault switches include:

```text
MOCK_STREAM_FAIL_AFTER_ACTIVITY
MOCK_STREAM_MISSING_USAGE
MOCK_STREAM_MALFORMED_RESULT
MOCK_STREAM_DELAY_MS
```

## Phase 13: observability

Record these timestamps for every request:

```text
request_received_at
entitlement_finished_at
upstream_started_at
first_chunk_at
result_received_at
billing_finished_at
stream_closed_at
```

Derive and monitor:

- Entitlement latency.
- Time to first SSE event.
- Time to first model activity.
- Model generation duration.
- Billing duration.
- Total turn latency.
- Stream interruption rate.
- Missing-usage rate.
- Duplicate-request rate.
- Client-disconnect rate.

Logs should contain request IDs, event types, durations, usage, settlement
mode, and error codes. They should not contain prompts, spreadsheet data,
reasoning, or full model output.

## Phase 14: deployment and rollout

### Deployment 1: LLM Worker capability

- Deploy `/chat-stream`.
- Do not route production clients to it.
- Run the probe and internal requests.
- Confirm chunk reconstruction and measured neurons.
- Leave `/chat` unchanged.

### Deployment 2: Next proxy

- Deploy `/api/chat/stream` behind a disabled feature flag.
- Exercise it with mock mode and internal requests.
- Confirm entitlement and billing behavior.

### Deployment 3: browser support

- Deploy the stream reader and phase-based UI.
- Keep legacy mode as the default.
- Enable streaming for internal users.

### Deployment 4: gradual production rollout

Suggested order:

```text
internal users
  -> small production cohort
  -> signed-in users
  -> all users
```

At each stage, monitor missing usage, billing mismatches, interrupted streams,
eval regressions, time to first activity, and manual retry frequency.

### Rollback

Disable the streaming feature flag. New turns immediately return to the
existing `/api/chat` path. Do not remove the legacy endpoints or header-based
billing until the streaming path has been stable for an agreed observation
period.

## Expected file changes

```text
llm-worker/src/index.ts
llm-worker/src/stream.ts
scripts/stream-probe.mjs

app/api/chat/stream/route.ts
lib/billing/meter.ts
lib/cells/sse.ts
lib/cells/agent.ts

components/cells/CellsApp.tsx
components/cells/ChatPanel.tsx
lib/cells/i18n.ts

tests/sse-parser.test.ts
tests/chat-stream.test.ts
tests/stream-billing.test.ts
```

The exact test locations should follow the project's existing test convention
when implementation begins.

## Acceptance criteria

The migration is ready for full rollout when all of the following are true:

1. The browser receives an `accepted` event shortly after entitlement checks.
2. Model chunks produce safe activity feedback while generation continues.
3. No reasoning, raw token, or partial tool JSON reaches the UI.
4. The final parsed tool behavior matches the non-streaming path.
5. The existing eval suite has no new transport-related failures.
6. Free and paid settlement matches the non-streaming path.
7. A request ID cannot be charged or recorded twice.
8. Client disconnects do not lose billing for completed inference.
9. An incomplete stream can never execute a tool.
10. New turns can be returned to the legacy path with one feature flag.

## Estimated effort

Assuming the GLM stream includes exact measured neurons:

| Work | Estimate |
| --- | --- |
| Provider stream probe | 0.5 day |
| LLM Worker stream endpoint | 0.5 day |
| Next proxy and billing changes | 0.5–1 day |
| Browser stream reader and UI | 0.5 day |
| Tests, deployed-runtime verification, and rollout | 0.5–1 day |

The safe production migration is approximately two to three development days.

If exact neurons are not available in the streamed response, stop after the
probe and choose a new authoritative usage source before estimating the rest
of the migration.
