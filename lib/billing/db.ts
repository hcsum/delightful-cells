// D1 binding lookup. Mirrors lib/quota.ts: the dynamic import keeps
// @opennextjs/cloudflare out of any non-worker build path (scripts, tests).

export type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = unknown>(col?: string) => Promise<T | null>;
  run: () => Promise<{ meta: { changes: number } }>;
  all: <T = unknown>() => Promise<{ results: T[] }>;
};

export type D1 = {
  prepare: (sql: string) => D1Statement;
  batch: (statements: D1Statement[]) => Promise<unknown[]>;
};

export async function getDb(): Promise<D1 | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const db: any = (mod.getCloudflareContext?.()?.env as any)?.DB;
    return db && typeof db.prepare === "function" ? (db as D1) : null;
  } catch {
    return null;
  }
}

// Everything money-related refuses to guess when D1 is missing: a silent
// fallback would hand out credits nobody paid for.
export async function requireDb(): Promise<D1> {
  const db = await getDb();
  if (!db) throw new Error("D1 binding DB is not available");
  return db;
}
