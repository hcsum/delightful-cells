'use client'

import { useEffect } from 'react'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'

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
      <div className="relative w-full max-w-sm rounded-lg border border-white/10 shadow-xl" style={{ background: 'var(--panel-bg)', color: 'var(--fg)' }}>
        <div className="p-4 border-b border-white/10">
            <h3 className="text-base font-semibold">Please Sign In</h3>
        </div>
        <div className="p-4">
          <button type="button" onClick={onSignInClick} disabled={disabled} className="inline-flex items-center gap-2 px-3 py-1 rounded border-[1px] border-neutral-600">
            <GoogleIcon />
            <span className="text-xs font-medium">Sign in with Google</span>
          </button>
        </div>
        <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 text-xs">Cancel</button>
        </div>
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
