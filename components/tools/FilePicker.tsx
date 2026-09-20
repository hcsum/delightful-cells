"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useT } from "@/lib/cells/locale";
import { trackEvent } from "@/lib/analytics";

/**
 * The upload control every single-use tool shares: a real button, drag & drop,
 * and .xlsx first in the accept list so the OS file dialog opens on Excel files
 * rather than filtering them out.
 *
 * `tone` covers the two skins on the site — the cream tool pages and the older
 * dark ones. It is a skin, not a behavior switch.
 */
export default function FilePicker({
  onFile,
  tone = "light",
  label,
  hint,
  info,
}: {
  onFile: (file: File) => void;
  tone?: "light" | "dark";
  label?: string;
  hint?: string;
  info?: string | null;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  const take = useCallback(
    (file: File | undefined | null) => {
      if (file) {
        trackEvent("file_selected", {
          file_type: file.name.split(".").pop()?.toLowerCase() ?? "unknown",
          file_size_kb: Math.ceil(file.size / 1024),
        });
        onFile(file);
      }
    },
    [onFile],
  );

  const light = tone === "light";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files?.[0]);
      }}
      className={`rounded-2xl transition-colors ${
        dragging ? (light ? "bg-black/5" : "bg-white/5") : ""
      }`}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="sr-only"
        onClick={(e) => {
          (e.currentTarget as HTMLInputElement).value = "";
        }}
        onChange={(e) => take(e.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={
            light
              ? "rounded-full px-4 py-2 text-sm font-bold text-black transition-colors"
              : "inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 font-semibold text-black shadow-md transition-colors hover:bg-white/90"
          }
          style={
            light
              ? {
                  border: "3px solid transparent",
                  background:
                    "linear-gradient(#fffaf0,#fffaf0) padding-box, linear-gradient(90deg,#ff0080,#ff8c00,#ffd500,#00c853,#00b0ff,#7c4dff,#ff0080) border-box",
                }
              : undefined
          }
        >
          {label ?? t("chooseFile")}
        </button>
        {info && (
          <span
            className={`text-sm font-semibold ${light ? "text-black/70" : "text-white/80"}`}
          >
            {info}
          </span>
        )}
      </div>
      {hint && (
        <p
          className={`mt-2 text-xs ${light ? "text-black/45" : "text-white/60"}`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
