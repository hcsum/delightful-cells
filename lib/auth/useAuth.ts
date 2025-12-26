'use client';

import { useSession, signIn, signOut } from '@/lib/auth/client';

export function useAuth() {
  const { data: session, isPending, error, refetch } = useSession();
  const user = (session as any)?.user ?? null;

  const signInWithGoogle = (callbackURL: string = '/') =>
    signIn.social({ provider: 'google', callbackURL });

  return {
    user,
    session,
    isAuthenticated: !!user,
    isLoading: isPending,
    error,
    refetch,
    signInWithGoogle,
    signOut,
  } as const;
}
