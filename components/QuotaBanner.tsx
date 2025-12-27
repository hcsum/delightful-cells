"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { DAILY_ROWS_LIMIT } from '@/lib/limits';

export default function QuotaBanner() {
  const { isAuthenticated } = useAuth();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number>(DAILY_ROWS_LIMIT);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isAuthenticated) { setRemaining(null); return; }
      setLoading(true);
      try {
        const res = await fetch('/api/quota', { method: 'GET', headers: { 'cache-control': 'no-store' } });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!cancelled) {
          setRemaining(Number(json?.remaining ?? 0) || 0);
          const lim = Number(json?.limit ?? DAILY_ROWS_LIMIT) || DAILY_ROWS_LIMIT;
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
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="inline-flex items-center gap-2 text-xs text-white/70 border border-white/10 rounded px-2 py-1 w-fit">
      {loading ? (
        <span>Checking remaining rows…</span>
      ) : (
        <span>Remaining today: {remaining != null ? remaining : '—'} / {limit} rows</span>
      )}
    </div>
  );
}
