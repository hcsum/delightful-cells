'use client';

import { createAuthClient } from 'better-auth/react';

// Default base is /api/auth; do not pass secret on client.
export const authClient = createAuthClient({});

export const { useSession, signIn, signOut } = authClient;
