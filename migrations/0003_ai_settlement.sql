-- One settlement claim per model request. The claim is created before usage
-- counters or balances are changed, so a replay cannot apply them twice.
CREATE TABLE ai_settlement (
  ref        TEXT NOT NULL,
  reason     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (reason, ref)
);

-- Settlement refs only protect short-lived request replays. Bound table growth
-- without adding a scheduled maintenance dependency.
CREATE TRIGGER ai_settlement_prune
AFTER INSERT ON ai_settlement
BEGIN
  DELETE FROM ai_settlement
  WHERE created_at < NEW.created_at - 604800000;
END;
