"use client";

import { useT } from "@/lib/cells/locale";

/**
 * Sheet picker. Renders nothing for a single-sheet workbook — which is every
 * CSV and most uploads — so the common case stays a two-control form.
 */
export default function SheetSelect({
  sheetNames,
  value,
  onChange,
  className = "",
  labelClassName = "",
}: {
  sheetNames: string[];
  value: number;
  onChange: (index: number) => void;
  className?: string;
  labelClassName?: string;
}) {
  const t = useT();
  if (sheetNames.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className={labelClassName}>{t("ctSheet")}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={className}
      >
        {sheetNames.map((name, i) => (
          <option key={i} value={i}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
