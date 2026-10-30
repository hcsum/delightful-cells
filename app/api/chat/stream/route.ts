import { asPaid, billFreeCall, resolveEntitlement } from "@/lib/billing/entitlement";
import { meterAndChargeUsage, reserveSettlement, type MeasuredUsage } from "@/lib/billing/meter";
import { getClientIp } from "@/lib/client-ip";
import { t } from "@/lib/cells/i18n";
import { encodeSse, encodeSseComment, readSse, type SseEnvelope } from "@/lib/cells/sse";
import { isFreeTierExhausted, localeFromRequest, siteQuotaMessage } from "@/lib/usage";
import { finishInference, refundRejectedInference, reserveInferenceBudget, withInferenceLock } from "@/lib/billing/guard";

type FlatMessage = { role: string; content: string };
const MAX_MESSAGES = 30;
const MAX_TOTAL_CHARS = 24_000;
const UPSTREAM_TIMEOUT_MS = 120_000;
const ROLES = new Set(["system", "user", "assistant"]);

function json(body: unknown, status = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...(extra || {}) },
  });
}

function requestIdFor(request: Request): string {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

export const POST = withInferenceLock(handlePost);

async function handlePost(request: Request, settlementRef: string) {
  if (process.env.CHAT_STREAMING_ENABLED === "false" && process.env.MOCK_LLM !== "true") {
    return json({ error: "not_found", message: "Streaming chat is not enabled." }, 404);
  }
  const receivedAt = Date.now();
  const requestId = requestIdFor(request);
  let body: { messages?: FlatMessage[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Invalid JSON body" }, 400);
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length || messages.length > MAX_MESSAGES) {
    return json({ error: "bad_messages", message: `messages must contain 1–${MAX_MESSAGES} items` }, 400);
  }
  let totalChars = 0;
  for (const message of messages) {
    if (!message || !ROLES.has(message.role) || typeof message.content !== "string") {
      return json({ error: "bad_messages", message: "Each message needs a valid role and string content" }, 400);
    }
    totalChars += message.content.length;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return json({ error: "too_large", message: "Conversation too large — start a fresh chat or upload a smaller sheet" }, 400);
  }

  let entitlement = await resolveEntitlement(request);
  if (await isFreeTierExhausted(entitlement.baseTier)) {
    if (entitlement.balanceNeurons > 0) entitlement = asPaid(entitlement);
    else return json({
      error: "site_quota_exceeded",
      action: entitlement.baseTier === "anon" ? "sign_in" : "buy_credits",
      message: siteQuotaMessage(entitlement.baseTier, localeFromRequest(request)),
    }, 429);
  }
  if (entitlement.tier !== "paid") {
    const billing = await billFreeCall(entitlement);
    if (billing.mode === "exceeded") {
      return json({ error: "quota_exceeded", message: t(localeFromRequest(request), "dailyCreditsExhausted") }, 429);
    }
    if (billing.mode === "paid") entitlement = asPaid(entitlement);
  }

  if (!await reserveInferenceBudget(entitlement, settlementRef)) {
    if (entitlement.balanceNeurons > 0) {
      entitlement = asPaid(entitlement);
      await reserveInferenceBudget(entitlement, settlementRef);
    }
    else return json({ error: "quota_exceeded", message: "AI budget is exhausted. Try again tomorrow." }, 429);
  }

  const workerUrl = process.env.LLM_WORKER_URL;
  if (process.env.MOCK_LLM !== "true" && !workerUrl) {
    await refundRejectedInference(settlementRef);
    return json({ error: "not_configured", message: "LLM_WORKER_URL is not set. For local dev without a worker, set MOCK_LLM=true." }, 500);
  }

  try {
    if (await reserveSettlement(settlementRef, "chat") !== "claimed") {
      await refundRejectedInference(settlementRef);
      return json({ error: "settlement_conflict", message: "Request settlement conflict." }, 409);
    }
  } catch {
    await refundRejectedInference(settlementRef);
    return json({ error: "billing_unavailable", message: "Billing is temporarily unavailable." }, 503);
  }

  const entitlementFinishedAt = Date.now();
  const transform = new TransformStream<Uint8Array, Uint8Array>();
  const writer = transform.writable.getWriter();
  let seq = 0;
  let browserWritable = true;
  const send = (type: string, data: unknown = {}) => {
    if (!browserWritable) return;
    const event: SseEnvelope = { type, requestId, seq: ++seq, at: Date.now(), data };
    void writer.write(encodeSse(event)).catch(() => { browserWritable = false; });
  };
  send("accepted");

  const pump = (async () => {
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let firstChunkAt = 0;
    let resultReceivedAt = 0;
    let upstreamStartedAt = 0;
    try {
      heartbeat = setInterval(() => {
        if (browserWritable) void writer.write(encodeSseComment()).catch(() => { browserWritable = false; });
      }, 12_000);

      let response = "";
      let usage: MeasuredUsage | null = null;
      if (process.env.MOCK_LLM === "true") {
        const delay = Math.max(0, Number(process.env.MOCK_STREAM_DELAY_MS) || 40);
        await new Promise((resolve) => setTimeout(resolve, delay));
        send("model_started");
        await new Promise((resolve) => setTimeout(resolve, delay));
        firstChunkAt = Date.now();
        send("activity", { phase: "generating" });
        if (process.env.MOCK_STREAM_FAIL_AFTER_ACTIVITY === "true") throw new Error("mock stream failure");
        await new Promise((resolve) => setTimeout(resolve, delay));
        response = process.env.MOCK_STREAM_MALFORMED_RESULT === "true"
          ? "{malformed"
          : JSON.stringify({ type: "final", message: "(mock) Streaming response complete." });
        if (process.env.MOCK_STREAM_MISSING_USAGE !== "true") {
          usage = { inputTokens: 1200, outputTokens: 120, neurons: 20 };
        }
      } else {
        upstreamStartedAt = Date.now();
        const upstreamController = new AbortController();
        const upstreamTimeout = setTimeout(() => upstreamController.abort(), UPSTREAM_TIMEOUT_MS);
        try {
          const upstream = await fetch(`${workerUrl!.replace(/\/$/, "")}/chat-stream`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.LLM_API_KEY || "",
              "x-request-id": requestId,
              "x-app": "delightful-cells",
              "x-client-ip": getClientIp(request),
              "x-tier": entitlement.tier,
            },
            body: JSON.stringify({ messages }),
            signal: upstreamController.signal,
          });
          if (!upstream.ok) {
            await refundRejectedInference(settlementRef);
            throw new Error(`LLM worker error (${upstream.status})`);
          }
          if (!upstream.body) throw new Error("Missing upstream stream");
          await readSse(upstream.body, (event) => {
            if (!firstChunkAt) firstChunkAt = Date.now();
            if (event.requestId !== requestId) throw new Error("Upstream request ID mismatch");
            if (event.type === "model_started" || event.type === "activity") send(event.type, event.data);
            else if (event.type === "internal_result") {
              const data = event.data as { response?: unknown; usage?: Partial<MeasuredUsage> };
              response = String(data.response ?? "");
              usage = normalizeUsage(data.usage);
            } else if (event.type === "error") {
              const data = event.data as { message?: string };
              throw new Error(data.message || "The model response was interrupted.");
            }
          });
        } finally {
          clearTimeout(upstreamTimeout);
        }
      }

      resultReceivedAt = Date.now();
      if (!usage) {
        console.error("[chat-stream] missing-usage", { requestId });
        send("error", { code: "missing_usage", message: "The model usage could not be verified.", retrySafe: false });
        return;
      }
      const charged = await meterAndChargeUsage(usage, entitlement, "chat", settlementRef, true);
      const billingFinishedAt = Date.now();
      send("result", { response });
      send("done");
      console.log("[chat-stream] complete", {
        requestId,
        request_received_at: receivedAt,
        entitlement_finished_at: entitlementFinishedAt,
        upstream_started_at: upstreamStartedAt,
        first_chunk_at: firstChunkAt,
        result_received_at: resultReceivedAt,
        billing_finished_at: billingFinishedAt,
        stream_closed_at: Date.now(),
        usage,
        settlement: entitlement.tier,
        charged_neurons: charged,
      });
    } catch (error) {
      console.error("[chat-stream] failed", { requestId, code: "upstream_stream_failed", error: String(error) });
      send("error", { code: "upstream_stream_failed", message: "The model response was interrupted.", retrySafe: false });
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      try {
        await finishInference(settlementRef);
      } catch (error) {
        console.error("[billing] streaming settlement failed", String(error));
        send("error", { code: "billing_unavailable", message: "Billing is temporarily unavailable.", retrySafe: false });
      }
      if (browserWritable) await writer.close().catch(() => {});
    }
  })();

  attachWaitUntil(pump);
  return new Response(transform.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function normalizeUsage(usage: Partial<MeasuredUsage> | undefined): MeasuredUsage | null {
  const normalized = {
    inputTokens: Number(usage?.inputTokens) || 0,
    outputTokens: Number(usage?.outputTokens) || 0,
    neurons: Number(usage?.neurons) || 0,
  };
  return normalized.inputTokens || normalized.outputTokens || normalized.neurons ? normalized : null;
}

function attachWaitUntil(promise: Promise<void>) {
  void import("@opennextjs/cloudflare")
    .then((mod) => mod.getCloudflareContext?.()?.ctx?.waitUntil(promise))
    .catch(() => { void promise; });
}
