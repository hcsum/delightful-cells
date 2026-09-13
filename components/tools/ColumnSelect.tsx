"use client";

/**
 * Column picker fed by the uploaded file's own headers. Before a file is
 * uploaded there is nothing true to offer, so it renders a disabled select
 * saying so rather than a text box inviting a guess at a column name.
 */
export default function ColumnSelect({
  headers,
  value,
  onChange,
  className = "",
  emptyLabel = "upload a file first",
  id,
}: {
  headers: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  emptyLabel?: string;
  id?: string;
}) {
  if (!headers.length) {
    return (
      <select id={id} className={className} disabled>
        <option>{emptyLabel}</option>
      </select>
    );
  }
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {headers.map((h, i) => (
        <option key={i} value={h}>
          {h || `(column ${i + 1})`}
        </option>
      ))}
    </select>
  );
}
