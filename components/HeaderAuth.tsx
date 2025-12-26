'use client'

import { useAuth } from '@/lib/auth/useAuth'

export default function HeaderAuth() {
  const { user, isAuthenticated, isLoading, signInWithGoogle } = useAuth()

  if (isLoading) {
    return (
      <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" aria-hidden />
    )
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => {
          let cb = '/'
          if (typeof window !== 'undefined') {
            const { pathname, search } = window.location || { pathname: '/', search: '' }
            cb = `${pathname || '/'}${search || ''}`
          }
          signInWithGoogle(cb)
        }}
        className="inline-flex items-center gap-2 px-2 py-1 rounded border border-white/10 hover:bg-white/10 text-xs"
      >
        Sign in
      </button>
    )
  }

  const name = (user?.name || user?.email || 'User') as string
  const initial = name.trim().charAt(0).toUpperCase()
  const img = (user as any)?.image as string | undefined

  return (
    <div className="flex items-center gap-2">
      {img ? (
        <img
          src={img}
          alt={name}
          className="h-8 w-8 rounded-full border border-white/10 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="h-8 w-8 rounded-full bg-white/10 border border-white/10 grid place-items-center text-xs font-semibold"
          aria-label={name}
          title={name}
        >
          {initial}
        </div>
      )}
    </div>
  )
}
