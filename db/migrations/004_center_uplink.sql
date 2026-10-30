-- Centre uplink: the training centre's local server pushes its records to the
-- cloud hub whenever it has internet (api/src/services/uplink.ts).
--
-- One status row for the whole server (cursor, last success, last error) and a
-- log of the relayed batches it has applied, so a batch the hub sends twice
-- (the ack was lost) is applied once.
SET search_path = vtc, public;

CREATE TABLE IF NOT EXISTS center_uplink (
  id                boolean PRIMARY KEY DEFAULT true CHECK (id),
  statements_cursor timestamptz NOT NULL DEFAULT '1970-01-01',
  statements_sent   bigint NOT NULL DEFAULT 0,
  relay_applied     bigint NOT NULL DEFAULT 0,
  last_attempt_at   timestamptz,
  last_success_at   timestamptz,
  last_error        text
);
INSERT INTO center_uplink DEFAULT VALUES ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS center_relay_applied (
  hub_seq     bigint PRIMARY KEY,
  user_id     uuid,
  results     jsonb NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
);
