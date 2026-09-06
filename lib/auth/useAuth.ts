'use client';

import { useSession, signIn, signOut } from '@/lib/auth/client';

export function useAuth() {
  const bypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';
  if (bypass) {
    const fakeUser = { email: 'test@test.com', name: 'Dev User' } as any;
    const noop = () => {};
    return {
      user: fakeUser,
      session: { user: fakeUser },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: async () => ({ data: { user: fakeUser } }),
      signInWithGoogle: noop,
      signOut: async () => {},
    } as const;
  }

  const { data: session, isPending, error, refetch } = useSession();
  const user = (session as any)?.user ?? null;

  const signInWithGoogle = (callbackURL: string = '/') =>
    signIn.social({ provider: 'google', callbackURL });

  // Normalized so callers get the same signature in bypass mode and out of it.
  const signOutUser = async () => {
    await signOut();
  };

  return {
    user,
    session,
    isAuthenticated: !!user,
    isLoading: isPending,
    error,
    refetch,
    signInWithGoogle,
    signOut: signOutUser,
  } as const;
}
