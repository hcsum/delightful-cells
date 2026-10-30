-- Expired locks can be replaced, but their credit holds and site reservations
-- remain charged/reserved until reconciled. A crashed isolate never frees money.
CREATE TABLE ai_identity_lock (
  identity TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE ai_budget (
  key TEXT PRIMARY KEY,
  used REAL NOT NULL DEFAULT 0,
  reserved REAL NOT NULL DEFAULT 0
);
CREATE TABLE ai_budget_reservation (
  ref TEXT PRIMARY KEY,
  site_key TEXT NOT NULL,
  user_key TEXT NOT NULL,
  amount REAL NOT NULL,
  settled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE ai_credit_reservation (
  ref TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  settled INTEGER NOT NULL DEFAULT 0
);
