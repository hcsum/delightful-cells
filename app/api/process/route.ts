import { decode, encode } from "@toon-format/toon";
import {
  asPaid,
  billFreeCall,
  commitFreeNeurons,
  resolveEntitlement,
} from "@/lib/billing/entitlement";
import { AI_BATCH_ROWS } from "@/lib/limits";
import { chargeNeurons, recordSiteUsage } from "@/lib/billing/meter";
import { t } from "@/lib/cells/i18n";
import { isFreeTierExhausted, localeFromRequest, siteQuotaMessage } from "@/lib/usage";
import { getClientIp } from "@/lib/client-ip";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, x-request-id, x-action, x-app",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET() {
  const body = JSON.stringify({
    status: "ok",
    ts: new Date().toISOString(),
    note: "api-process",
  });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  // Get worker URL and shared API key from environment variables
  const workerUrl = process.env.LLM_WORKER_URL;
  const apiKey = process.env.LLM_API_KEY || "";

  if (!workerUrl) {
    return new Response(
      JSON.stringify({
        error: "LLM_WORKER_URL not configured",
        message: "Server configuration error: LLM worker URL is not set",
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  }

  try {
    // Get request headers to forward
    const requestId =
      request.headers.get("x-request-id") ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const action = request.headers.get("x-action") || "preview";
    const rid = request.headers.get("x-request-id") || "";
    const app = request.headers.get("x-app") || "excel-extract-column-app";
    const origin =
      request.headers.get("Origin") || request.headers.get("origin") || "";
    const t0 = Date.now();

    // Get request body
    const body = await request.json();
    // Debug: log inbound request payload (truncated)
    try {
      const bodyStr = JSON.stringify(body);
      // Optional: preview inputs encoded as TOON (tab-delimited)
      let toonPreview: string | undefined;
      try {
        const rows = Array.isArray(body?.rows)
          ? body.rows.map((r: any) => ({ input: String(r) }))
          : [];
        if (rows.length) {
          const toon = encode({ inputs: rows }, { delimiter: "\t" });
          toonPreview = String(toon).slice(0, 512);
        }
      } catch {}
      console.debug("[api/process] request", {
        rid: requestId,
        action,
        rows: Array.isArray(body?.rows) ? body.rows.length : 0,
        bodyBytes: bodyStr.length,
        bodyPreview: bodyStr.slice(0, 1024),
        toonPreview,
      });
    } catch {}

    // Prepare TOON input (tab-delimited) to send along to the worker
    let toonForWorker: string | undefined;
    try {
      const rowsArr = Array.isArray(body?.rows)
        ? body.rows.map((r: any, i: number) => ({
            id: i + 1,
            input: String(r),
          }))
        : [];
      if (rowsArr.length)
        toonForWorker = encode({ inputs: rowsArr }, { delimiter: "\t" });
    } catch {}

    // Billing order: today's free rows for this tier, then credits.
    const rowsCount = Array.isArray((body as any)?.rows)
      ? (body as any).rows.length
      : 0;
    let ent = await resolveEntitlement(request);

    // One batch per request, and the batch size is ours to choose: every client
    // path sends AI_BATCH_ROWS or less (the retry path sends less). The cap is
    // the batch, not the run, because the worker's output-token budget is what
    // actually breaks — a hand-crafted 10,000-row POST would be truncated into
    // silent nulls rather than refused.
    const canPay = ent.balanceNeurons > 0;
    if (rowsCount > AI_BATCH_ROWS) {
      return new Response(
        JSON.stringify({
          error: "rows_per_run_exceeded",
          message: `This AI action can process up to ${AI_BATCH_ROWS} rows per request.`,
          limit: AI_BATCH_ROWS,
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        },
      );
    }

    // Site budget before the free allowance: when the shared budget for this
    // tier is gone, credits are the way through.
    if (await isFreeTierExhausted(ent.baseTier)) {
      if (canPay) ent = asPaid(ent);
      else
        return new Response(
          JSON.stringify({
            error: "site_quota_exceeded",
            action: ent.baseTier === "anon" ? "sign_in" : "buy_credits",
            message: siteQuotaMessage(ent.baseTier, localeFromRequest(request)),
          }),
          { status: 429, headers: { "content-type": "application/json", "cache-control": "no-store" } },
        );
    }

    if (ent.tier !== "paid") {
      const billing = await billFreeCall(ent);
      if (billing.mode === "exceeded") {
        return new Response(
          JSON.stringify({
            error: "quota_exceeded",
            message: t(localeFromRequest(request), "dailyCreditsExhausted"),
          }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
      }
      if (billing.mode === "paid") {
        ent = asPaid(ent);
      }
    }

    // Forward request to LLM worker (include pre-encoded TOON)
    const workerResponse = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        "x-action": action,
        "x-app": app,
        ...(apiKey ? { "x-api-key": apiKey } : {}),
        ...(origin ? { Origin: origin } : {}),
        // Trusted by the worker because x-api-key already proves this is us.
        "x-client-ip": getClientIp(request),
        "x-tier": ent.tier,
      },
      body: JSON.stringify({
        ...body,
        ...(toonForWorker ? { toon: toonForWorker } : {}),
      }),
    });

    // Get response body
    const responseBody = await workerResponse.text();
    // Debug: log response from worker (truncated)
    try {
      const ct = workerResponse.headers.get("content-type") || "";
      const dt = Date.now() - t0;
      console.debug("[api/process] response", {
        rid: requestId,
        action,
        status: workerResponse.status,
        ct,
        dt,
        respBytes: responseBody.length,
        respPreview: responseBody.slice(0, 1024),
      });
    } catch {}
    // If worker responded OK, extract results and only then charge the user.
    if (workerResponse.ok) {
      // Cloudflare billed us for this call whether or not we can read the
      // answer, so the site-wide meter records it either way. What the USER
      // pays waits until we know we have rows to hand back: the client retries
      // a bad batch several times, and charging each attempt would bill someone
      // five times over for a column they never received.
      const neurons = await recordSiteUsage(workerResponse.headers, ent);
      const expected = Array.isArray(body?.rows) ? body.rows.length : 0;
      let decoded: any = null;
      try {
        const toonRaw =
          extractResultsToonBlock(responseBody) ??
          extractUnfencedResultsSegment(responseBody) ??
          responseBody;
        // First, repair missing tab separators between id/input and output, then normalize
        const toonText = normalizeResultsToon(fixMissingTabSeparator(toonRaw));
        decoded = decode(toonText, { strict: true });
      } catch (e) {
        console.warn("[api/process] decode failed (TOON)", {
          rid: requestId,
          action,
          err: String(e),
          respPreview: responseBody.slice(0, 512),
        });
        return new Response(
          JSON.stringify({
            error: "invalid_toon",
            message: "Worker returned invalid TOON",
          }),
          {
            status: 502,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
      }
      const items: any[] | null = Array.isArray((decoded as any)?.results)
        ? (decoded as any).results
        : null;
      if (!items) {
        console.warn("[api/process] no results array decoded", {
          rid: requestId,
          action,
        });
        return new Response(
          JSON.stringify({
            error: "invalid_toon",
            message: "Decoded TOON missing results",
          }),
          {
            status: 502,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
      }
      let results: { input: string; output: string | null }[] = [];
      // Rows the worker never answered for, as opposed to rows it answered with
      // an explicit null. The two look identical in `results` and mean opposite
      // things: "the model found nothing" is a finished row, while "the reply
      // stopped early" is a row still owed to the user. Truncation at the
      // worker's output-token cap is the common cause, and the client can only
      // re-run these rows if we say which ones they are.
      const missing: number[] = [];
      const hasId = items.some(
        (x) => x && Object.prototype.hasOwnProperty.call(x, "id"),
      );
      if (hasId) {
        // Map by id -> original input, fill missing with nulls
        results = new Array(expected);
        const seen = new Array<boolean>(expected).fill(false);
        for (let i = 0; i < expected; i++) {
          results[i] = { input: String(body.rows[i] ?? ""), output: null };
        }
        for (const it of items) {
          const idNum = Number(it?.id);
          if (!Number.isFinite(idNum)) continue;
          const idx = idNum - 1;
          if (idx < 0 || idx >= expected) continue;
          seen[idx] = true;
          results[idx] = {
            input: String(body.rows[idx] ?? ""),
            output: it?.output == null ? null : String(it.output),
          };
        }
        for (let i = 0; i < expected; i++) if (!seen[i]) missing.push(i);
      } else {
        // Positional mapping; pad/truncate to expected
        results = new Array(expected);
        for (let i = 0; i < expected; i++) {
          const it = items[i];
          const out = it?.output == null ? null : String(it.output);
          const input = String(it?.input ?? body.rows[i] ?? "");
          results[i] = { input, output: out };
          if (i >= items.length) missing.push(i);
        }
      }
      if (missing.length) {
        console.warn("[api/process] partial results", {
          rid: requestId,
          action,
          expected,
          missing: missing.length,
        });
      }
      await chargeNeurons(ent, neurons, "process", requestId);
      // Free batches settle against the same measured cost, into the same daily
      // neuron counter chat uses. Note this is the whole call, not the delivered
      // rows: Cloudflare billed us for every row the worker read, including the
      // ones whose answers came back truncated, and the counter tracks our bill.
      if (ent.tier !== "paid") await commitFreeNeurons(ent, neurons);
      const jsonBody = JSON.stringify({ results, missing });
      return new Response(jsonBody, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    }

    // Non-OK: forward error body and relevant headers
    const headers: Record<string, string> = {
      "content-type":
        workerResponse.headers.get("content-type") ||
        "text/plain; charset=utf-8",
      "cache-control": "no-store",
    };
    const rateLimitHeaders = [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "Retry-After",
    ];
    rateLimitHeaders.forEach((headerName) => {
      const value = workerResponse.headers.get(headerName);
      if (value) headers[headerName] = value;
    });
    return new Response(responseBody, {
      status: workerResponse.status,
      statusText: workerResponse.statusText,
      headers,
    });
  } catch (error) {
    console.error("[api/process] Error proxying to worker:", error);
    return new Response(
      JSON.stringify({
        error: "proxy_error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to proxy request to LLM worker",
      }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  }
}

// Some models may echo the input TOON block and then place the results block after it.
// This helper finds the last fenced ```toon block that begins with a results header and returns its content.
function extractResultsToonBlock(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const re = /```toon\s*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  let candidate: string | null = null;
  let lastAny: string | null = null;
  while ((m = re.exec(raw)) !== null) {
    const block = m[1].trim();
    lastAny = block;
    // Accept headers with tab, comma, or even missing delimiter between field names; normalize later
    if (
      /^results\[\d+(?:\t|,)?\]\{\s*(?:id|input)(?:\t|,|\s*)output\s*\}:/.test(
        block,
      )
    ) {
      candidate = block; // pick the last matching block
    }
  }
  // Fallback to last fenced toon block if none matched the strict header
  return candidate ?? lastAny;
}

// Fallback for unfenced responses: find the first results header and take from there to the end
function extractUnfencedResultsSegment(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(
    /results\[\d+(?:\t|,)?\]\{\s*(?:id|input)(?:\t|,|\s*)output\s*\}:[\s\S]*$/,
  );
  return m ? m[0] : null;
}

// Some models may omit the tab between field names in the header, e.g. {inputoutput}
// This normalizer attempts to repair the header to {input\toutput} while leaving other parts intact.
function normalizeResultsToon(raw: string): string {
  try {
    // Replace literal backslash-t with a real tab everywhere
    let out = raw.replace(/\\t/g, "\t");
    // Normalize header fields to tab-delimited exactly once (support id or input)
    out = out.replace(
      /\{\s*input\s*(?:,|\t|\s*)\s*output\s*\}/,
      "{input\toutput}",
    );
    out = out.replace(/\{\s*id\s*(?:,|\t|\s*)\s*output\s*\}/, "{id\toutput}");
    // If missing delimiter after [N], inject a tab
    out = out.replace(/^results\[(\d+)\](?=\{)/m, "results[$1\t]");
    // Normalize line endings
    out = out.replace(/\r\n/g, "\n");
    // Collapse multiple tabs in data rows, fill missing outputs, drop blank rows, and fix header count
    let lines = out.split("\n");
    const headerIdx = lines.findIndex((ln) =>
      /^results\[\d+(?:\t|,)?\]\{\s*(?:id|input)(?:\t|,|\s*)output\s*\}:\s*$/.test(
        (ln || "").trim(),
      ),
    );
    if (headerIdx >= 0) {
      const head = lines[headerIdx];
      const data: string[] = [];
      for (let i = headerIdx + 1; i < lines.length; i++) {
        let ln = lines[i] || "";
        if (!ln.trim()) continue; // drop empty rows
        if (!/^\s{2}/.test(ln)) continue; // only keep indented data rows
        // collapse multiple tabs
        ln = ln.replace(/\t{2,}/g, "\t");
        // if line has no tab, append a null output; if ends with a tab, also append null
        if (!ln.includes("\t") || /\t\s*$/.test(ln))
          ln = ln.replace(/\s*$/, "") + "\tnull";
        data.push(ln);
      }
      // Fix header count to actual data rows
      const newCount = data.length;
      const fixedHead = head
        .replace(/^(results\[)\d+((?:\t|,)?\]\{.*)/, `$1${newCount}$2`)
        .replace(/^results\[(\d+)\](?=\{)/, "results[$1\t]");
      lines = [fixedHead, ...data];
    }
    return lines.join("\n");
  } catch {
    return raw;
  }
}

// Repair rows missing a tab between id/input and output, e.g. "  2 null" -> "  2\tnull"
function fixMissingTabSeparator(raw: string): string {
  try {
    const lines = (raw || "").split("\n");
    const headerRe =
      /^results\[\d+(?:\t|,)?\]\{\s*(?:id|input)(?:\t|,|\s*)output\s*\}:\s*$/;
    const headerIdx = lines.findIndex((ln) => headerRe.test((ln || "").trim()));
    if (headerIdx < 0) return raw;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const ln = lines[i] || "";
      if (!/^\s{2}/.test(ln)) continue; // data rows usually start with two spaces
      if (ln.includes("\t")) continue; // already has a tab
      // Insert a single tab between the first number (id) and the rest, or between first token and rest
      const fixed = ln
        .replace(/^\s{2}(\d+)\s+(.+)$/, "  $1\t$2")
        .replace(/^\s{2}([^\t]+?)\s+(.+)$/, "  $1\t$2");
      lines[i] = fixed;
    }
    return lines.join("\n");
  } catch {
    return raw;
  }
}
