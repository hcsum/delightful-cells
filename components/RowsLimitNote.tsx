import { TIER_LIMITS } from "@/lib/limits";

// The /tools landing pages are static and render before we know who is
// reading, so they quote the anonymous floor first and say what signing in
// adds. Quoting the signed-in numbers alone told every visitor they had 6x
// the rows they actually had.
export default function RowsLimitNote({ className = "" }: { className?: string }) {
  const anon = TIER_LIMITS.anon;
  const free = TIER_LIMITS.free;
  return (
    <p className={`text-white/60 max-w-2xl text-sm ${className}`}>
      Note: without signing in, AI processing is capped at{" "}
      {anon.rowsPerDay.toLocaleString()} rows a day. Signing in raises that to{" "}
      {free.rowsPerDay.toLocaleString()} rows a day; credits remove the daily cap.
    </p>
  );
}
