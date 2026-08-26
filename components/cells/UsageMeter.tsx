"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/cells/locale";

type Usage = {
  available: boolean;
  neurons?: number;
  freeNeurons?: number;
  requests?: number;
  inputTokens?: number;
  outputTokens?: number;
};

// Site-wide "what has the AI cost today" strip, read live from Cloudflare.
// `refreshKey` bumps after each agent turn so the bar moves as you chat.
export default function UsageMeter({ refreshKey }: { refreshKey: number }) {
  const t = useT();
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/usage")
      .then((r) => r.json())
      .then((u: Usage) => alive && setUsage(u))
      .catch(() => alive && setUsage({ available: false }));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (!usage?.available) return null;
  const used = usage.neurons ?? 0;
  const free = usage.freeNeurons ?? 10_000;
  const pct = Math.min(100, (used / free) * 100);
  const tokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);

  return (
    <div
      className="mb-3 rounded-2xl border !border-black/10 bg-white px-4 py-2.5 text-xs text-black/60"
      title={t("usageHover", { c: usage.requests ?? 0, t: tokens.toLocaleString() })}
    >
      <div className="flex items-center justify-between font-semibold">
        <span>{t("usageTitle")}</span>
        <span className="text-black/80">
          {t("usageFree", { u: used.toLocaleString(), f: free.toLocaleString() })}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(pct, 1)}%`,
            background:
              "linear-gradient(90deg,#ff0080,#ff8c00,#ffd500,#00c853,#00b0ff,#7c4dff)",
          }}
        />
      </div>
      <div className="mt-1 text-[11px] text-black/45">
        {pct >= 100 ? (
          <span className="font-semibold text-[#b3003c]">{t("usagePaused")}</span>
        ) : (
          <>{t("usageDetail", { c: (usage.requests ?? 0).toLocaleString(), t: tokens.toLocaleString() })}</>
        )}
      </div>
    </div>
  );
}
