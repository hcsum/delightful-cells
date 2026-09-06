"use server";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth/server";

// Never let a stray env var hand out free access in production — this switch
// now gates paid features, not just a soft row quota.
const BYPASS_AUTH =
  process.env.BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production";

async function getSession() {
  try {
    const auth = await getAuth();
    return await auth.api.getSession({ headers: headers() });
  } catch {
    return null;
  }
}

// Resolve logged-in user's email using Better Auth server API.
// This avoids making an extra fetch and reliably forwards cookies.
export async function getLoggedInUserKeyFromRequest(
  _req: Request,
): Promise<string | null> {
  if (BYPASS_AUTH) return "dev-local";
  const session = await getSession();
  const email = session?.user?.email;
  if (email && typeof email === "string" && email.trim())
    return String(email).toLowerCase();
  return null;
}

// The stable user id, which is what the ledger and balance are keyed by.
// Email is not a key: users can change it, and it is not what better-auth
// stores as the primary key of `user`.
export async function getUserIdFromRequest(
  _req?: Request,
): Promise<string | null> {
  if (BYPASS_AUTH) return "dev-local";
  const session = await getSession();
  const id = session?.user?.id;
  return id && typeof id === "string" && id.trim() ? id : null;
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
