'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth/useAuth'
import { useLocale, useT } from '@/lib/cells/locale'
import { localizePath } from '@/lib/locale-routing'

export default function HeaderAuth() {
  const { user, isAuthenticated, isLoading, signInWithGoogle } = useAuth()
  const locale = useLocale()
  const t = useT()

  if (isLoading) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-black/5" aria-hidden />
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
        className="inline-flex items-center gap-2 rounded-full border !border-black/15 bg-white px-3 py-1 text-xs font-semibold !text-black/70 hover:bg-[#fff3d6]"
      >
        {t('signIn')}
      </button>
    )
  }

  const name = (user?.name || user?.email || 'User') as string
  const initial = name.trim().charAt(0).toUpperCase()
  const img = (user as any)?.image as string | undefined

  // The avatar is the way into the account page (balance, ledger, sign out).
  return (
    <Link href={localizePath('/account', locale)} title={name} className="flex items-center gap-2">
      {img ? (
        <img
          src={img}
          alt={name}
          className="h-8 w-8 rounded-full border !border-black/15 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="grid h-8 w-8 place-items-center rounded-full border !border-black/15 bg-white text-xs font-bold text-black/70"
          aria-label={name}
          title={name}
        >
          {initial}
        </div>
      )}
    </Link>
  )
}
