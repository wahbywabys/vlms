-- VTC_LMS cloud hub (api/src/hub). Every training centre's local server
-- uploads here when it has internet; dashboards (Wisdom, Power BI, Looker
-- Studio, Grafana, an LRS…) read from here. Idempotent: applied at every start.
CREATE SCHEMA IF NOT EXISTS hub;
SET search_path = hub, public;

CREATE TABLE IF NOT EXISTS centers (
  id              text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  name            text NOT NULL,
  key_hash        text NOT NULL,                  -- sha256 of the centre key
  relay_secret    text NOT NULL,                  -- HMAC(centre key) that signs relay tokens
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz,
  app_version     text
);

CREATE TABLE IF NOT EXISTS statements (
  id              uuid PRIMARY KEY,               -- stable id minted by the centre
  center_id       text NOT NULL REFERENCES centers(id),
  learner_id      text NOT NULL,
  learner         text,
  verb            text NOT NULL,
  activity        text NOT NULL,
  activity_name   text,
  kind            text,
  score           numeric,
  success         boolean,
  occurred_at     timestamptz NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  statement       jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS statements_center_time ON statements (center_id, occurred_at);
CREATE INDEX IF NOT EXISTS statements_received ON statements (received_at, id);

CREATE TABLE IF NOT EXISTS snapshots (
  center_id       text NOT NULL REFERENCES centers(id),
  institution_id  uuid NOT NULL,
  taken_at        timestamptz NOT NULL,
  kpis            jsonb NOT NULL,
  PRIMARY KEY (center_id, institution_id, taken_at)
);

CREATE TABLE IF NOT EXISTS learners (
  center_id       text NOT NULL REFERENCES centers(id),
  learner_id      uuid NOT NULL,
  institution_id  uuid NOT NULL,
  name            text NOT NULL,
  name_ar         text,
  cohort          text,
  trade           text,
  risk_band       text,
  risk_probability numeric,
  last_active_at  timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (center_id, learner_id)
);

-- Writes a phone handed over while away from its centre's Wi-Fi, waiting for
-- that centre's server to come online and pull them.
CREATE TABLE IF NOT EXISTS relay (
  seq             bigserial PRIMARY KEY,
  center_id       text NOT NULL REFERENCES centers(id),
  user_id         uuid NOT NULL,
  token           text NOT NULL,
  mutations       jsonb NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz
);
CREATE INDEX IF NOT EXISTS relay_pending ON relay (center_id, seq) WHERE delivered_at IS NULL;
