"use server";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth/server";

const BYPASS_AUTH = process.env.BYPASS_AUTH === "true";

// Resolve logged-in user's email using Better Auth server API.
// This avoids making an extra fetch and reliably forwards cookies.
export async function getLoggedInUserKeyFromRequest(
  _req: Request,
): Promise<string | null> {
  if (BYPASS_AUTH) return "dev-local";
  try {
    const auth = getAuth();
    const h = headers();
    const session = await (await auth).api.getSession({ headers: h });
    const email = session?.user?.email;
    if (email && typeof email === "string" && email.trim())
      return String(email).toLowerCase();
    return null;
  } catch {
    return null;
  }
}

// Quota key without requiring sign-in: logged-in email when present,
// otherwise the client IP. Sign-in is optional across the site now; the
// daily row quota still applies per identity.
export async function getQuotaKeyFromRequest(req: Request): Promise<string> {
  const userKey = await getLoggedInUserKeyFromRequest(req);
  if (userKey) return userKey;
  const ip =
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "anon";
  return `ip:${ip}`;
}
