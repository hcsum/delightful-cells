// The browser's IP, as seen by the Next worker. Forwarded upstream as
// x-client-ip so llm-worker can rate limit per visitor: its own
// CF-Connecting-IP is this worker's egress IP, the same value for everyone.
export function getClientIp(req: Request): string {
  return (
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    ""
  );
}
