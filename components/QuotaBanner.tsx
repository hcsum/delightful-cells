"use client";

import { useEffect, useState } from 'react';
import { dailyNeurons, rowsAffordable } from '@/lib/limits';
import { useT } from '@/lib/cells/locale';

// No sign-in required anymore: /api/quota answers for anonymous visitors too
// (keyed by IP server-side). Until it answers we show the anonymous cap: the
// signed-in number would be wrong for most visitors, and wrong in the
// flattering direction.
export default function QuotaBanner() {
  const t = useT();
  const [remaining, setRemaining] = useState<number | null>(null);
  const anonFloor = rowsAffordable(dailyNeurons('anon'));
  const [limit, setLimit] = useState<number>(anonFloor);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/quota', { method: 'GET', headers: { 'cache-control': 'no-store' } });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!cancelled) {
          setRemaining(Number(json?.remaining ?? 0) || 0);
          const lim = Number(json?.limit ?? anonFloor) || anonFloor;
          setLimit(lim);
        }
      } catch {
        if (!cancelled) setRemaining(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // A tier with no daily cap (paying by credits) is reported as a sentinel,
  // not a number anyone should read.
  const metered = limit >= Number.MAX_SAFE_INTEGER;

  if (remaining == null && !loading) return null;

  return (
    <div className="inline-flex items-center gap-2 text-xs text-black/60 border !border-black/15 bg-white rounded-full px-3 py-1 w-fit font-semibold">
      {loading ? (
        <span>{t('quotaChecking')}</span>
      ) : (
        <span>
          {metered
            ? t('quotaMetered')
            : t('quotaRemaining', {
                remaining: remaining != null ? remaining : '—',
                limit: limit.toLocaleString(),
              })}
        </span>
      )}
    </div>
  );
}
