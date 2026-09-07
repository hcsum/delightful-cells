'use client'

import { useEffect } from 'react'
import { t, type Locale } from '@/lib/cells/i18n'
import type { ProcessStop } from '@/lib/process'

/**
 * Shown when a run comes back with holes — some rows failed every retry, the
 * allowance ran out mid-run, or the user cancelled. Nothing has been written to
 * the sheet or downloaded yet: this dialog is where the user chooses.
 *
 * There is deliberately no "discard" button. The rows that succeeded were
 * already billed, so throwing them away is never the helpful default — closing
 * the dialog is the same as applying what worked.
 */
export default function PartialResultDialog({
  open,
  locale = 'en',
  total,
  succeeded,
  failed,
  stopped,
  busy,
  onRetryFailed,
  onApplyPartial,
}: {
  open: boolean
  locale?: Locale
  total: number
  succeeded: number
  failed: number
  stopped?: ProcessStop
  busy?: boolean
  onRetryFailed: () => void
  onApplyPartial: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Escape means "I'll take what I have" — the safe reading, since the
      // alternative loses rows the user has already paid for.
      if (e.key === 'Escape' && !busy) onApplyPartial()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onApplyPartial])

  if (!open) return null

  const vars = {
    n: total.toLocaleString(),
    s: succeeded.toLocaleString(),
    f: failed.toLocaleString(),
    m: stopped?.message ?? '',
  }
  const bodyKey =
    stopped?.reason === 'fatal'
      ? 'partialFatalBody'
      : stopped?.reason === 'aborted'
        ? 'partialAbortedBody'
        : 'partialBody'

  // Out of allowance is the one case where retrying is guaranteed to fail
  // again, so don't offer it as a button that looks like it might work.
  const retryPointless = stopped?.reason === 'fatal'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-sm rounded-3xl border !border-black/10 bg-[#fffaf0] p-6 text-black shadow-xl">
        <h3 className="text-lg font-extrabold">{t(locale, 'partialTitle', vars)}</h3>
        <p className="mt-3 text-sm text-black/65">{t(locale, bodyKey, vars)}</p>

        {!retryPointless && (
          <button
            type="button"
            onClick={onRetryFailed}
            disabled={busy}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-black px-4 py-2.5 text-sm font-bold text-[#fffdf8] hover:opacity-85 disabled:opacity-50"
          >
            {busy ? t(locale, 'partialRetrying', vars) : t(locale, 'partialRetryFailed', vars)}
          </button>
        )}
        <button
          type="button"
          onClick={onApplyPartial}
          disabled={busy}
          className={`w-full rounded-full px-4 py-2 text-sm font-semibold hover:bg-black/5 disabled:opacity-50 ${
            retryPointless
              ? 'mt-5 bg-black py-2.5 font-bold text-[#fffdf8] hover:opacity-85 hover:bg-black'
              : 'mt-2 text-black/60'
          }`}
        >
          {t(locale, 'partialApplyPartial', vars)}
        </button>
      </div>
    </div>
  )
}
