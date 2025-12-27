import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import { getRowsUsedToday } from '@/lib/quota'
import { getLoggedInUserKeyFromRequest } from '@/lib/auth/session'

export async function GET(request: Request) {
  const userKey = await getLoggedInUserKeyFromRequest(request)
  if (!userKey) {
    return new Response(JSON.stringify({ error: 'auth_required' }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  }
  const used = await getRowsUsedToday(userKey)
  const remaining = Math.max(0, DAILY_ROWS_LIMIT - used)
  return new Response(JSON.stringify({ limit: DAILY_ROWS_LIMIT, used, remaining }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export async function POST(request: Request) {
  const userKey = await getLoggedInUserKeyFromRequest(request)
  if (!userKey) {
    return new Response(JSON.stringify({ error: 'auth_required' }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  }
  let requested = 0
  try {
    const body = await request.json()
    requested = Number(body?.requested ?? body?.total ?? body?.totalRows ?? 0) || 0
  } catch {}
  const used = await getRowsUsedToday(userKey)
  const remaining = Math.max(0, DAILY_ROWS_LIMIT - used)
  const allowed = Math.max(0, Math.min(remaining, requested))
  const exceeds = requested > remaining
  return new Response(
    JSON.stringify({ limit: DAILY_ROWS_LIMIT, used, remaining, requested, allowed, exceeds }),
    { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
  )
}

