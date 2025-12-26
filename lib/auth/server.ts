import { betterAuth, type BetterAuthOptions } from 'better-auth';

// Build minimal Better Auth options using env. Google only.
function getAuthOptions(): BetterAuthOptions {
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
    // Keep logs quiet by default
    logger: { disabled: true },
  } as BetterAuthOptions;

  // Only set baseURL if provided; otherwise default (/api/auth) is used
  if (baseURL) (opts as any).baseURL = baseURL;

  return opts;
}

export function getAuth() {
  return betterAuth(getAuthOptions());
}
