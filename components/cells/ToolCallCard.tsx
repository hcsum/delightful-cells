"use client";

import type { ToolCall, ToolResult } from "@/lib/cells/tools";
import { useT } from "@/lib/cells/locale";

const TOOL_EMOJI: Record<ToolCall["tool"], string> = {
  filter_rows: "🔦",
  filter_rows_ai: "🔮",
  find_replace: "✂️",
  summarize_column: "🧮",
  transform_column: "🪄",
  compute_column: "➗",
  highlight_rows: "🖍️",
  remove_column: "🗑️",
};

// Dark inverted card (the "tool ran in your browser" moment).
// NOTE: inside dark cards we use explicit hex utilities, never text-white/80
// or border-white/10 — globals.css hijacks those for the light theme.
export default function ToolCallCard({
  call,
  result,
}: {
  call: ToolCall;
  result: ToolResult;
}) {
  const t = useT();
  const params = Object.entries(call).filter(([k]) => k !== "tool");
  return (
    <div className="rounded-2xl bg-[#201112] p-4 shadow-[0_12px_32px_rgba(20,10,10,0.18)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-[#f5f5f5]">
          {TOOL_EMOJI[call.tool]} {t(`tool_${call.tool}`)}
        </span>
        <span className="rounded-full bg-[#3a2325] px-3 py-0.5 text-xs font-semibold text-[#ffd166]">
          {result.summary}
        </span>
      </div>
      <dl className="mt-2 space-y-1">
        {params.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs">
            {/* Labels wrap onto a second line rather than colliding with the
                value — "New column name" is wider than any one-word key. */}
            <dt className="w-24 shrink-0 break-words leading-snug text-[#bfa9aa]">
              {t(`param_${k}`)}
            </dt>
            <dd className="min-w-0 break-words font-mono leading-snug text-[#f0e6e6]">
              {v == null || v === "" ? "—" : String(v)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-[#8a7375]">
        {t("ranLocally")}
      </p>
    </div>
  );
}
