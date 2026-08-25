"use client";

import type { ToolCall, ToolResult } from "@/lib/cells/tools";

const TOOL_META: Record<ToolCall["tool"], { emoji: string; label: string }> = {
  filter_rows: { emoji: "🔦", label: "Filter rows" },
  filter_rows_ai: { emoji: "🔮", label: "AI filter rows" },
  find_replace: { emoji: "✂️", label: "Find & replace" },
  summarize_column: { emoji: "🧮", label: "Summarize column" },
  transform_column: { emoji: "🪄", label: "AI transform column" },
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
  const meta = TOOL_META[call.tool];
  const params = Object.entries(call).filter(([k]) => k !== "tool");
  return (
    <div className="rounded-2xl bg-[#201112] p-4 shadow-[0_12px_32px_rgba(20,10,10,0.18)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-[#f5f5f5]">
          {meta.emoji} {meta.label}
        </span>
        <span className="rounded-full bg-[#3a2325] px-3 py-0.5 text-xs font-semibold text-[#ffd166]">
          {result.summary}
        </span>
      </div>
      <dl className="mt-2 space-y-0.5">
        {params.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs">
            <dt className="w-20 shrink-0 text-[#bfa9aa]">{k}</dt>
            <dd className="break-all font-mono text-[#f0e6e6]">{String(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-[#8a7375]">
        ran locally in your browser
      </p>
    </div>
  );
}
