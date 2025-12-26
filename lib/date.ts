export function secondsUntilNextUtcDay(): number {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0))
  const sec = Math.max(1, Math.floor((next.getTime() - now.getTime()) / 1000))
  return sec
}

