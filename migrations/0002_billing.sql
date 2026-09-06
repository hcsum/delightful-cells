-- Credit balances and their audit trail.
--
-- Balances are kept in neurons, the unit Cloudflare actually bills and the
-- worker reports back per call; credits are a display unit (NEURONS_PER_CREDIT
-- in lib/limits.ts). Storing credits instead would force a round-up per call,
-- overcharging a 50-row batch ~5x.

CREATE TABLE credit_balance (
  user_id         TEXT PRIMARY KEY,
  balance_neurons INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE credit_ledger (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  delta      INTEGER NOT NULL,   -- +neurons on purchase, -neurons on spend
  reason     TEXT NOT NULL,      -- purchase | chat | process | refund | adjust
  ref        TEXT,               -- stripe session id / x-request-id
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_ledger_user ON credit_ledger(user_id, created_at DESC);
-- One row per (reason, ref): replaying a webhook or retrying a charge is a no-op.
CREATE UNIQUE INDEX idx_ledger_ref ON credit_ledger(reason, ref) WHERE ref IS NOT NULL;

-- Seen Stripe events. Inserted first in the top-up batch, so a redelivered
-- event hits the primary key and rolls the whole batch back.
CREATE TABLE stripe_event (
  id         TEXT PRIMARY KEY,   -- evt_xxx
  type       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE purchase (
  id           TEXT PRIMARY KEY, -- checkout session id
  user_id      TEXT NOT NULL,
  pack         TEXT NOT NULL,
  credits      INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency     TEXT NOT NULL,
  status       TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_purchase_user ON purchase(user_id, created_at DESC);
