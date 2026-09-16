"use client";

import { useCallback, useEffect, useState } from "react";

// The shape /api/me returns. `null` limits mean "no limit" (Infinity does not
// survive JSON).
export type Me = {
  tier: "anon" | "free";
  billingToCredits: boolean;
  user: { name: string | null; email: string | null; image: string | null } | null;
  credits: { neurons: number; credits: number; neuronsPerCredit: number };
  // One bucket, counted in neurons — the same unit a paid call is billed in.
  // `creditsLeft` is that figure floored to whole credits, which is the only
  // form the UI ever shows.
  daily: {
    neuronsUsed: number;
    neuronsLeft: number | null;
    creditsLeft: number | null;
  };
  limits: {
    dailyCredits: number | null;
    maxRowsPerRun: number;
  };
  site: {
    date: string;
    neurons: number;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    tierNeurons: number;
    tierBudget: number;
  };
};

// One fetch per refreshKey bump; every limit the UI shows comes from here so
// the client and the API can't drift apart.
export function useMe(refreshKey: number = 0) {
  const [me, setMe] = useState<Me | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/me", { signal });
      if (res.ok) setMe((await res.json()) as Me);
    } catch {
      // Offline or mid-navigation: keep whatever we had.
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load, refreshKey]);

  return { me, reload: load };
}
