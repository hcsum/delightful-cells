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
