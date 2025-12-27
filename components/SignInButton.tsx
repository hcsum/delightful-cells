"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import LoginPromptDialog from "@/components/LoginPromptDialog";

export default function SignInButton() {
  const { isAuthenticated, isLoading, signInWithGoogle } = useAuth();
  const [open, setOpen] = useState(false);
  if (isAuthenticated) return null;
  return (
    <>
      <button
        className="px-3 py-1 rounded bg-white/10 text-sm"
        disabled={isLoading}
        onClick={() => setOpen(true)}
      >
        {isLoading ? 'Signing in…' : 'Sign in to start'}
      </button>
      <LoginPromptDialog
        open={open}
        onClose={() => setOpen(false)}
        disabled={isLoading}
        onSignIn={() => {
          let cb = '/';
          if (typeof window !== 'undefined') {
            const { pathname, search } = window.location || { pathname: '/', search: '' };
            cb = `${pathname || '/'}${search || ''}`;
          }
          signInWithGoogle(cb);
        }}
      />
    </>
  );
}
