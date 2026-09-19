"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function InfoPopover({
  label,
  children,
  panelClassName = "w-64",
}: {
  label: string;
  children: ReactNode;
  panelClassName?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const details = ref.current;
      if (details?.open && !details.contains(event.target as Node)) {
        details.open = false;
      }
    };
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismissWithEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismissWithEscape);
    };
  }, []);

  return (
    <details ref={ref} className="group relative">
      <summary
        className="cursor-pointer list-none font-bold text-black/35 hover:text-black/65 [&::-webkit-details-marker]:hidden"
        aria-label={label}
      >
        ⓘ
      </summary>
      <div
        className={`absolute left-1/2 z-30 mt-2 -translate-x-1/2 rounded-xl border !border-black/10 bg-white px-3 py-2 font-medium leading-relaxed text-black/65 shadow-lg ${panelClassName}`}
      >
        {children}
      </div>
    </details>
  );
}
