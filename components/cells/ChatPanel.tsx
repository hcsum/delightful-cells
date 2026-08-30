"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/cells/agent";
import ToolCallCard from "./ToolCallCard";
import { useT } from "@/lib/cells/locale";

export default function ChatPanel({
  messages,
  thinking,
  thinkingStep,
  progress,
  ready,
  presets,
  onSend,
}: {
  messages: ChatMessage[];
  thinking: boolean;
  thinkingStep: number;
  progress: { done: number; total: number } | null;
  ready: boolean; // a sheet is loaded
  presets: string[];
  onSend: (text: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, thinking]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !ready || thinking) return;
    setDraft("");
    onSend(trimmed);
  };

  return (
    <section className="flex min-h-0 flex-col rounded-[28px] border !border-black/10 bg-[#fffaf0] p-4">
      <h2 className="px-1 text-sm font-extrabold uppercase tracking-wide text-black/50">
        {t("talkToSheet")}
      </h2>

      <div ref={scrollRef} className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
        {messages.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed !border-black/10 bg-white p-4 text-sm text-black/55">
            {ready ? (
              <>
                <p className="font-semibold text-black/70">
                  {t("sheetIn")}
                </p>
                <div className="mt-3 flex flex-col items-start gap-3">
                  {presets.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-2xl border !border-black bg-[#fff3d6] px-3.5 py-2 text-left text-xs font-semibold leading-snug text-black/80 hover:bg-[#ffe6ef]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p>{t("uploadFirstPanel")}</p>
            )}
          </div>
        )}

        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-black px-4 py-2 text-sm text-[#fffdf8]">
                  {m.content}
                </div>
              </div>
            );
          }
          if (m.role === "note") {
            return (
              <div key={m.id} className="px-2 text-center text-[11px] italic text-black/40">
                {m.content.replace(/^\[|\]$/g, "").replace(/ Trust CURRENT TABLE STATE.*$/, "")}
              </div>
            );
          }
          if (m.role === "assistant") {
            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border !border-black/10 bg-white px-4 py-2 text-sm text-black/80">
                  {m.content}
                </div>
              </div>
            );
          }
          return <ToolCallCard key={m.id} call={m.call} result={m.result} />;
        })}

        {thinking && (
          <div className="flex items-center gap-2 px-1 text-xs font-semibold text-black/45">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff0080]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ffd500] [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#00b0ff] [animation-delay:240ms]" />
            </span>
            {progress
              ? t("processing", { d: progress.done, t: progress.total })
              : t("thinkingStep", { s: thinkingStep })}
          </div>
        )}
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!ready || thinking}
          placeholder={ready ? t("placeholder") : t("uploadFirst")}
          className="min-w-0 flex-1 rounded-full border !border-black/15 bg-white px-4 py-2.5 text-sm text-black placeholder:text-black/35 focus:!border-black/40 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!ready || thinking || !draft.trim()}
          className="shrink-0 rounded-full px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
          style={{
            border: "3px solid transparent",
            background:
              "linear-gradient(#fffdf8,#fffdf8) padding-box, linear-gradient(90deg,#ff0080,#ff8c00,#ffd500,#00c853,#00b0ff,#7c4dff,#ff0080) border-box",
          }}
        >
          {t("send")}
        </button>
      </form>
    </section>
  );
}
