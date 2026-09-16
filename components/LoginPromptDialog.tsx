'use client'

import { useEffect } from 'react'
import { dailyNeurons, rowsAffordable } from '@/lib/limits'

export default function LoginPromptDialog({ open, onClose, onSignIn, disabled }: { open: boolean; onClose: () => void; onSignIn: () => void; disabled?: boolean }) {

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onSignInClick = () => onSignIn()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl border !border-black/10 bg-[#fffaf0] p-6 text-black shadow-xl">
        <h3 className="text-lg font-extrabold">Sign in to keep going</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-black/65">
          <li>· About {rowsAffordable(dailyNeurons('free')).toLocaleString()} AI rows a day instead of {rowsAffordable(dailyNeurons('anon')).toLocaleString()}</li>
          <li>· Your own daily AI budget, not the shared one</li>
        </ul>
        <button
          type="button"
          onClick={onSignInClick}
          disabled={disabled}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-bold text-[#fffdf8] hover:opacity-85 disabled:opacity-50"
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-full px-4 py-2 text-xs font-semibold text-black/50 hover:bg-black/5"
        >
          Not now
        </button>
      </div>
    </div>
  )
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" {...props}>
      <path fill="#EA4335" d="M12 10.2v3.96h5.5c-.24 1.26-1.66 3.7-5.5 3.7-3.31 0-6-2.74-6-6.12s2.69-6.12 6-6.12c1.89 0 3.16.8 3.89 1.49l2.65-2.56C16.77 3.03 14.59 2 12 2 6.97 2 2.9 6.04 2.9 11.04S6.97 20.08 12 20.08c5.17 0 8.6-3.63 8.6-8.72 0-.59-.06-1.04-.14-1.49H12z"/>
    </svg>
  )
}
