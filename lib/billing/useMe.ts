"use client";

import { useCallback, useEffect, useState } from "react";

// The shape /api/me returns. `null` limits mean "no limit" (Infinity does not
// survive JSON).
export type Me = {
  tier: "anon" | "free";
  billingToCredits: boolean;
  user: { name: string | null; email: string | null; image: string | null } | null;
  credits: { neurons: number; credits: number; neuronsPerCredit: number };
  daily: {
    rowsUsed: number;
    rowsLeft: number | null;
    turnsUsed: number;
    turnsLeft: number | null;
  };
  limits: {
    chatTurns: number | null;
    rowsPerDay: number | null;
    aiRowsPerRun: number;
    paidAiRowsPerRun: number;
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
