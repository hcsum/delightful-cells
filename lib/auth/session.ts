'use server'

// Resolve logged-in user's email via Better Auth session endpoint.
// Does not rely on cookie-cache; uses the session token cookie sent by the browser.
export async function getLoggedInUserKeyFromRequest(req: Request): Promise<string | null> {
  try {
    const u = new URL(req.url)
    u.pathname = '/api/auth/get-session'
    u.search = ''
    const res = await fetch(u.toString(), {
      method: 'GET',
      headers: { cookie: req.headers.get('cookie') || '' },
      redirect: 'manual',
    })
    if (!res.ok) return null
    const data: any = await res.json()
    const email = data?.user?.email || data?.session?.user?.email
    if (email && typeof email === 'string' && email.trim()) return String(email).toLowerCase()
    return null
  } catch {
    return null
  }
}
