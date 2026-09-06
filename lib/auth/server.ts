import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { D1Dialect } from 'kysely-d1';
import { getDb } from '@/lib/billing/db';

// Build minimal Better Auth options using env. Google only.
async function getAuthOptions(): Promise<BetterAuthOptions> {
  const baseURL = process.env.AUTH_URL || process.env.NEXT_PUBLIC_AUTH_URL || '';
  const secret = process.env.AUTH_SECRET || '';

  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  const socialProviders: BetterAuthOptions['socialProviders'] =
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {};

  const opts: BetterAuthOptions = {
    secret,
    emailAndPassword: { enabled: false },
    socialProviders,
    session: {
      // Cache session in a signed cookie to avoid server lookups; keep it for 24h
      cookieCache: { enabled: true, maxAge: 60 * 60 * 24 }, // 24 hours
    },
    // Keep logs quiet by default
    logger: { disabled: true },
  } as BetterAuthOptions;

  // Persist users/sessions/accounts in D1 through Kysely. Without this the
  // cookie cache makes sign-in *look* like it works while nothing is stored,
  // so every reload past 24h starts over and there is no stable user id.
  // transaction: false — D1 has no interactive transactions (batch() only).
  const db = await getDb();
  if (db) {
    (opts as any).database = {
      dialect: new D1Dialect({ database: db as any }),
      type: 'sqlite',
      transaction: false,
    };
  }

  // Only set baseURL if provided; otherwise default (/api/auth) is used
  if (baseURL) (opts as any).baseURL = baseURL;

  return opts;
}

export async function getAuth() {
  return betterAuth(await getAuthOptions());
}
