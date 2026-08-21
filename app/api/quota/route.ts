import { DAILY_ROWS_LIMIT } from "@/lib/limits";
import { getRowsUsedToday } from "@/lib/quota";
import { getQuotaKeyFromRequest } from "@/lib/auth/session";

export async function GET(request: Request) {
  const userKey = await getQuotaKeyFromRequest(request);
  const used = await getRowsUsedToday(userKey);
  const remaining = Math.max(0, DAILY_ROWS_LIMIT - used);
  return new Response(
    JSON.stringify({ limit: DAILY_ROWS_LIMIT, used, remaining }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const userKey = await getQuotaKeyFromRequest(request);
  let requested = 0;
  try {
    const body = await request.json();
    requested =
      Number(body?.requested ?? body?.total ?? body?.totalRows ?? 0) || 0;
  } catch {}
  const used = await getRowsUsedToday(userKey);
  const remaining = Math.max(0, DAILY_ROWS_LIMIT - used);
  const allowed = Math.max(0, Math.min(remaining, requested));
  const exceeds = requested > remaining;
  return new Response(
    JSON.stringify({
      limit: DAILY_ROWS_LIMIT,
      used,
      remaining,
      requested,
      allowed,
      exceeds,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}
