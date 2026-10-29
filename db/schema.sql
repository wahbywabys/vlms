-- =============================================================================
-- VLMS — Vocational Learning Management System
-- Core relational schema (PostgreSQL 15+)
--
-- Domains covered:
--   1. Identity & tenancy          (institutions, users, roles)
--   2. Competencies (CBT)          (frameworks, units, criteria, learner levels)
--   3. QuestionBank                (items, versions, parameters, psychometrics)
--   4. VirtualLabSessions          (labs, faults, sessions, telemetry, rubrics)
--   5. WorkshopAssets              (assets, bookings, checkouts, consumables)
--   6. WBLLogbooks                 (placements, geofenced check-ins, entries)
--
-- Conventions:
--   * UUID v4 primary keys (gen_random_uuid) so offline PWA clients can mint
--     IDs locally and sync without collisions.
--   * Every mutable row carries created_at / updated_at; offline-synced rows
--     also carry client_mutation_id for idempotent replay.
--   * Multi-tenant: every top-level row is scoped by institution_id.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist; -- exclusion constraints on bookings
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive emails

CREATE SCHEMA IF NOT EXISTS vlms;
SET search_path = vlms, public;

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Great-circle distance in metres (keeps the schema free of a PostGIS
-- dependency; swap for ST_DWithin if PostGIS is available).
CREATE OR REPLACE FUNCTION haversine_m(lat1 float8, lon1 float8, lat2 float8, lon2 float8)
RETURNS float8 LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 2 * 6371000 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2) +
           cos(radians(lat1)) * cos(radians(lat2)) *
           power(sin(radians(lon2 - lon1) / 2), 2)))
$$;

CREATE TYPE user_role        AS ENUM ('academic_teacher', 'vocational_trainer', 'student',
                                      'industry_supervisor', 'director', 'qa_auditor', 'admin');
CREATE TYPE proficiency_level AS ENUM ('not_yet', 'novice', 'intermediate', 'autonomous', 'master');
CREATE TYPE bloom_level      AS ENUM ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create');
CREATE TYPE question_type    AS ENUM ('hotspot', 'fault_tree', 'calculation', 'sequence',
                                      'image_identification', 'mcq', 'short_answer');
CREATE TYPE item_status      AS ENUM ('draft', 'in_review', 'approved', 'retired');
CREATE TYPE lab_mode         AS ENUM ('guided', 'sandbox', 'assessment');
CREATE TYPE lab_domain       AS ENUM ('electrical_automation', 'cnc_milling', 'automotive_obd',
                                      'welding_fabrication', 'loto_safety');
CREATE TYPE session_status   AS ENUM ('in_progress', 'submitted', 'evaluated', 'aborted', 'voided');
CREATE TYPE asset_status     AS ENUM ('available', 'in_use', 'maintenance', 'locked_out', 'retired');
CREATE TYPE signoff_status   AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'revision_requested');

-- =============================================================================
-- 1. IDENTITY & TENANCY
-- =============================================================================
CREATE TABLE institutions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  code            text NOT NULL UNIQUE,              -- e.g. 'ATS-CAI-01'
  region          text,                              -- drives regional skill heatmaps
  timezone        text NOT NULL DEFAULT 'UTC',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  email           citext NOT NULL,
  full_name       text NOT NULL,
  locale          text NOT NULL DEFAULT 'en',
  external_ids    jsonb NOT NULL DEFAULT '{}'::jsonb, -- LTI 1.3 sub, national learner no., SSO ids
  safety_badge_uid text UNIQUE,                       -- RFID/NFC badge for machine access
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, email)
);
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- A user can hold several roles (e.g. a trainer who also teaches theory).
CREATE TABLE user_roles (
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            user_role NOT NULL,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE cohorts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  name            text NOT NULL,                     -- 'Mechatronics Y2 — Group B'
  trade           text NOT NULL,
  starts_on       date NOT NULL,
  ends_on         date,
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE cohort_members (
  cohort_id       uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role     user_role NOT NULL,                -- student / trainer / teacher
  PRIMARY KEY (cohort_id, user_id)
);

-- =============================================================================
-- 2. COMPETENCIES (Competency-Based Training)
--    framework → unit → element → performance criterion
-- =============================================================================
CREATE TABLE competency_frameworks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,              -- e.g. 'NTQF-ELEC-L3'
  title           text NOT NULL,
  issuing_body    text NOT NULL,                     -- national qualification authority
  version         text NOT NULL,
  effective_from  date NOT NULL
);

CREATE TABLE competencies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id    uuid NOT NULL REFERENCES competency_frameworks(id),
  parent_id       uuid REFERENCES competencies(id),  -- unit → element → criterion tree
  code            text NOT NULL,                     -- 'ELEC-L3-U04-E2-PC3'
  title           text NOT NULL,
  description     text,
  kind            text NOT NULL CHECK (kind IN ('unit', 'element', 'criterion')),
  is_safety_critical boolean NOT NULL DEFAULT false, -- failing = automatic not-yet-competent
  nominal_hours   numeric(6,1),
  UNIQUE (framework_id, code)
);
CREATE INDEX idx_competencies_parent ON competencies(parent_id);

-- Current proficiency per learner per competency (materialised from evidence).
CREATE TABLE learner_competencies (
  learner_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competency_id   uuid NOT NULL REFERENCES competencies(id),
  level           proficiency_level NOT NULL DEFAULT 'not_yet',
  score           numeric(5,2) CHECK (score BETWEEN 0 AND 100),
  evidence_count  integer NOT NULL DEFAULT 0,
  last_assessed_at timestamptz,
  verified_by     uuid REFERENCES users(id),         -- trainer or industry supervisor
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, competency_id)
);

-- Append-only evidence ledger: every source that moves a proficiency level.
-- Supports IQA audits ("show me why this learner is 'autonomous'").
CREATE TABLE competency_evidence (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      uuid NOT NULL REFERENCES users(id),
  competency_id   uuid NOT NULL REFERENCES competencies(id),
  source_type     text NOT NULL CHECK (source_type IN
                    ('question_attempt', 'vlab_session', 'workshop_observation', 'wbl_logbook', 'rpl')),
  source_id       uuid NOT NULL,
  score           numeric(5,2),
  level_awarded   proficiency_level,
  assessor_id     uuid REFERENCES users(id),
  recorded_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidence_learner ON competency_evidence(learner_id, competency_id, recorded_at DESC);

-- Micro-credentials earned when a bundle of competencies is met.
CREATE TABLE micro_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  title           text NOT NULL,
  required_competency_ids uuid[] NOT NULL,
  min_level       proficiency_level NOT NULL DEFAULT 'autonomous'
);

CREATE TABLE learner_credentials (
  learner_id      uuid NOT NULL REFERENCES users(id),
  credential_id   uuid NOT NULL REFERENCES micro_credentials(id),
  issued_at       timestamptz NOT NULL DEFAULT now(),
  open_badge_url  text,                              -- Open Badges 3.0 assertion
  PRIMARY KEY (learner_id, credential_id)
);

-- =============================================================================
-- 3. QUESTION BANK
-- =============================================================================
CREATE TABLE questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  type            question_type NOT NULL,
  bloom           bloom_level NOT NULL,
  status          item_status NOT NULL DEFAULT 'draft',
  current_version integer NOT NULL DEFAULT 1,
  author_id       uuid NOT NULL REFERENCES users(id),
  ai_generated    boolean NOT NULL DEFAULT false,    -- AI-assisted items must pass human review
  reviewed_by     uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT ai_generated OR status <> 'approved' OR reviewed_by IS NOT NULL)
);
CREATE TRIGGER trg_questions_touch BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Immutable versions; attempts point at the exact version a learner saw.
--
-- `body` holds the type-specific payload, e.g.
--   hotspot:     {"image_asset":"...","regions":[{"id":"K1","shape":"poly","points":[...]}]}
--   fault_tree:  {"root":"n1","nodes":{"n1":{"prompt":"...","options":[{"label":"...","next":"n2"}]}}}
--   calculation: {"template":"Bore Ø = {{d}} mm ...","answer_expr":"d - 2*t","unit":"mm"}
--   sequence:    {"steps":[{"id":"s1","text":"Notify affected staff"}, ...]}
-- `answer_key` is stored separately so it can be withheld from client payloads.
CREATE TABLE question_versions (
  question_id     uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  stem            text NOT NULL,
  body            jsonb NOT NULL,
  answer_key      jsonb NOT NULL,
  -- Engineering tolerances for calculation items: accepted if |x - key| <= abs_tol
  -- OR |x - key| / |key| <= rel_tol.
  abs_tolerance   numeric,
  rel_tolerance   numeric,
  max_points      numeric(6,2) NOT NULL DEFAULT 1,
  media           jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, version)
);

-- Dynamic parameterisation: each attempt draws its own variable values.
CREATE TABLE question_parameters (
  question_id     uuid NOT NULL,
  version         integer NOT NULL,
  name            text NOT NULL,                     -- 'd'
  min_value       numeric NOT NULL,
  max_value       numeric NOT NULL,
  step            numeric NOT NULL DEFAULT 1,
  unit            text,
  PRIMARY KEY (question_id, version, name),
  FOREIGN KEY (question_id, version) REFERENCES question_versions(question_id, version) ON DELETE CASCADE,
  CHECK (max_value >= min_value AND step > 0)
);

CREATE TABLE question_competencies (
  question_id     uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  competency_id   uuid NOT NULL REFERENCES competencies(id),
  PRIMARY KEY (question_id, competency_id)
);

CREATE TABLE question_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     uuid NOT NULL,
  version         integer NOT NULL,
  learner_id      uuid NOT NULL REFERENCES users(id),
  assessment_id   uuid,                              -- quiz / exam container
  parameter_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  response        jsonb NOT NULL,
  points_awarded  numeric(6,2),
  is_correct      boolean,
  duration_ms     integer,
  attempted_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (question_id, version) REFERENCES question_versions(question_id, version)
);
CREATE INDEX idx_attempts_question ON question_attempts(question_id, attempted_at);
CREATE INDEX idx_attempts_learner  ON question_attempts(learner_id, attempted_at DESC);

-- Classical Test Theory stats, recomputed nightly from question_attempts.
--   p_value         = proportion correct (item difficulty)
--   discrimination  = upper-27% minus lower-27% proportion correct
--   point_biserial  = item–total correlation
CREATE TABLE question_psychometrics (
  question_id     uuid NOT NULL,
  version         integer NOT NULL,
  n_attempts      integer NOT NULL,
  p_value         numeric(5,4),
  discrimination  numeric(5,4),
  point_biserial  numeric(5,4),
  flagged         boolean GENERATED ALWAYS AS
                    (p_value < 0.2 OR p_value > 0.95 OR discrimination < 0.2) STORED,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, version),
  FOREIGN KEY (question_id, version) REFERENCES question_versions(question_id, version) ON DELETE CASCADE
);

-- =============================================================================
-- 4. VIRTUAL LAB SESSIONS
-- =============================================================================
CREATE TABLE virtual_labs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,              -- 'VLAB-PLC-MOTOR-STARTER'
  title           text NOT NULL,
  domain          lab_domain NOT NULL,
  model_uri       text NOT NULL,                     -- glTF digital twin
  sim_version     text NOT NULL,
  supported_modes lab_mode[] NOT NULL DEFAULT ARRAY['guided','sandbox','assessment']::lab_mode[],
  vr_capable      boolean NOT NULL DEFAULT false
);

-- Fault library a trainer can inject in assessment mode.
CREATE TABLE lab_faults (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id          uuid NOT NULL REFERENCES virtual_labs(id) ON DELETE CASCADE,
  code            text NOT NULL,                     -- 'F-OL-TRIP' (thermal overload stuck open)
  description     text NOT NULL,
  component_ref   text NOT NULL,                     -- node name in the glTF scene
  correct_isolation_steps text[] NOT NULL,           -- expected diagnostic actions
  UNIQUE (lab_id, code)
);

-- A rubric is a versioned set of weighted criteria, reused by V-Labs and
-- physical workshop observations alike.
CREATE TABLE rubrics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL,
  version         integer NOT NULL DEFAULT 1,
  title           text NOT NULL,
  pass_threshold  numeric(5,2) NOT NULL DEFAULT 70,
  UNIQUE (code, version)
);

CREATE TABLE rubric_criteria (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id       uuid NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  key             text NOT NULL,                     -- 'ppe', 'isolation', 'diagnosis_time'
  label           text NOT NULL,
  weight          numeric(5,2) NOT NULL CHECK (weight > 0),
  is_gate         boolean NOT NULL DEFAULT false,    -- safety gate: fail ⇒ overall fail
  competency_id   uuid REFERENCES competencies(id),
  scoring         jsonb NOT NULL,                    -- rule definition, see API evaluator
  UNIQUE (rubric_id, key)
);

CREATE TABLE virtual_lab_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id          uuid NOT NULL REFERENCES virtual_labs(id),
  learner_id      uuid NOT NULL REFERENCES users(id),
  mode            lab_mode NOT NULL,
  rubric_id       uuid REFERENCES rubrics(id),
  injected_fault_ids uuid[] NOT NULL DEFAULT '{}',   -- hidden from the learner client
  injected_by     uuid REFERENCES users(id),
  device          text CHECK (device IN ('browser', 'tablet', 'vr')),
  status          session_status NOT NULL DEFAULT 'in_progress',
  started_at      timestamptz NOT NULL DEFAULT now(),
  submitted_at    timestamptz,
  time_limit_s    integer,
  last_seq        bigint NOT NULL DEFAULT 0,         -- highest telemetry seq accepted
  final_score     numeric(5,2),
  passed          boolean,
  CHECK (mode = 'assessment' OR cardinality(injected_fault_ids) = 0)
);
CREATE INDEX idx_vlab_sessions_learner ON virtual_lab_sessions(learner_id, started_at DESC);
CREATE INDEX idx_vlab_sessions_open    ON virtual_lab_sessions(status) WHERE status = 'in_progress';

-- High-volume, xAPI-shaped telemetry. Partitioned monthly; hot window also
-- mirrored to Redis Streams for live trainer dashboards.
CREATE TABLE vlab_telemetry (
  session_id      uuid NOT NULL,
  seq             bigint NOT NULL,                   -- client monotonic sequence
  occurred_at     timestamptz NOT NULL,
  verb            text NOT NULL,                     -- xAPI verb IRI suffix: 'measured', 'isolated', ...
  object_ref      text,                              -- scene node / component
  value           jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, seq, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE vlab_telemetry_default PARTITION OF vlab_telemetry DEFAULT;
-- Example monthly partition (create ahead of time via pg_partman or cron):
CREATE TABLE vlab_telemetry_2026_11 PARTITION OF vlab_telemetry
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE rubric_evaluations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id       uuid NOT NULL REFERENCES rubrics(id),
  subject_type    text NOT NULL CHECK (subject_type IN ('vlab_session', 'workshop_observation')),
  subject_id      uuid NOT NULL,
  learner_id      uuid NOT NULL REFERENCES users(id),
  evaluator_id    uuid REFERENCES users(id),         -- NULL = automated
  criterion_scores jsonb NOT NULL,                   -- {"ppe":{"score":100,"evidence":[...]}, ...}
  total_score     numeric(5,2) NOT NULL,
  passed          boolean NOT NULL,
  gate_failures   text[] NOT NULL DEFAULT '{}',
  evaluated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_id, rubric_id)
);

-- =============================================================================
-- 5. WORKSHOP ASSETS & INVENTORY
-- =============================================================================
CREATE TABLE workshops (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  name            text NOT NULL,                     -- 'CNC Bay 2'
  capacity        integer NOT NULL CHECK (capacity > 0)
);

CREATE TABLE workshop_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id     uuid NOT NULL REFERENCES workshops(id),
  asset_tag       text NOT NULL UNIQUE,              -- printed on the QR/RFID label
  name            text NOT NULL,
  category        text NOT NULL CHECK (category IN ('machine', 'tool', 'instrument', 'ppe', 'kiosk')),
  make_model      text,
  digital_twin_lab_id uuid REFERENCES virtual_labs(id), -- QR sync to the 3D twin
  status          asset_status NOT NULL DEFAULT 'available',
  required_competency_id uuid REFERENCES competencies(id), -- badge gate for machine unlock
  hourly_cost     numeric(10,2),
  next_service_due date,
  meter_hours     numeric(10,1) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_assets_touch BEFORE UPDATE ON workshop_assets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Bookings cannot overlap for the same asset (DB-enforced, not app-enforced).
CREATE TABLE asset_bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        uuid NOT NULL REFERENCES workshop_assets(id),
  booked_by       uuid NOT NULL REFERENCES users(id),
  cohort_id       uuid REFERENCES cohorts(id),
  during          tstzrange NOT NULL,
  purpose         text,
  cancelled_at    timestamptz,
  EXCLUDE USING gist (asset_id WITH =, during WITH &&) WHERE (cancelled_at IS NULL)
);

-- Physical checkout / machine unlock log (RFID tap → access decision).
CREATE TABLE asset_checkouts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        uuid NOT NULL REFERENCES workshop_assets(id),
  user_id         uuid NOT NULL REFERENCES users(id),
  approved_by     uuid REFERENCES users(id),
  checked_out_at  timestamptz NOT NULL DEFAULT now(),
  returned_at     timestamptz,
  condition_out   text,
  condition_in    text,
  access_granted  boolean NOT NULL,
  denial_reason   text,                              -- 'missing competency ELEC-L3-U04'
  client_mutation_id uuid UNIQUE,                    -- offline replay idempotency
  CHECK (returned_at IS NULL OR returned_at >= checked_out_at)
);
-- Only one open checkout per asset.
CREATE UNIQUE INDEX uq_open_checkout ON asset_checkouts(asset_id)
  WHERE returned_at IS NULL AND access_granted;

CREATE TABLE consumables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id     uuid NOT NULL REFERENCES workshops(id),
  sku             text NOT NULL,
  name            text NOT NULL,                     -- 'Mild steel flat bar 40×6'
  unit            text NOT NULL,                     -- 'm', 'kg', 'pcs', 'L'
  on_hand         numeric(12,3) NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reorder_point   numeric(12,3) NOT NULL DEFAULT 0,
  hazard_class    text,                              -- links to MSDS
  msds_uri        text,
  UNIQUE (workshop_id, sku)
);

CREATE TABLE consumable_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_id   uuid NOT NULL REFERENCES consumables(id),
  delta           numeric(12,3) NOT NULL CHECK (delta <> 0),
  reason          text NOT NULL CHECK (reason IN ('receipt', 'issue', 'scrap', 'adjustment')),
  user_id         uuid NOT NULL REFERENCES users(id),
  related_session uuid,                              -- practical task that consumed it
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION apply_consumable_movement() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE consumables SET on_hand = on_hand + NEW.delta WHERE id = NEW.consumable_id;
  RETURN NEW;  -- the CHECK on on_hand rejects over-issue
END $$;
CREATE TRIGGER trg_consumable_movement AFTER INSERT ON consumable_movements
  FOR EACH ROW EXECUTE FUNCTION apply_consumable_movement();

-- Tablet floor observations (one-tap rubric scoring by trainers).
CREATE TABLE workshop_observations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      uuid NOT NULL REFERENCES users(id),
  trainer_id      uuid NOT NULL REFERENCES users(id),
  asset_id        uuid REFERENCES workshop_assets(id),
  rubric_id       uuid NOT NULL REFERENCES rubrics(id),
  task_ref        text,                              -- job card number
  observed_at     timestamptz NOT NULL DEFAULT now(),
  measurements    jsonb NOT NULL DEFAULT '{}'::jsonb, -- {"bore_mm": 24.97, "nominal": 25.00, "tol": 0.05}
  evidence_media  jsonb NOT NULL DEFAULT '[]'::jsonb, -- annotated photo/video refs
  client_mutation_id uuid UNIQUE
);

-- =============================================================================
-- 6. WORK-BASED LEARNING (WBL) LOGBOOKS
-- =============================================================================
CREATE TABLE employers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  sector          text
);

CREATE TABLE employer_sites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id     uuid NOT NULL REFERENCES employers(id),
  name            text NOT NULL,
  latitude        float8 NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude       float8 NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  geofence_radius_m integer NOT NULL DEFAULT 150 CHECK (geofence_radius_m BETWEEN 25 AND 5000)
);

CREATE TABLE wbl_placements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      uuid NOT NULL REFERENCES users(id),
  site_id         uuid NOT NULL REFERENCES employer_sites(id),
  supervisor_id   uuid NOT NULL REFERENCES users(id), -- industry_supervisor
  coordinator_id  uuid REFERENCES users(id),          -- institution-side trainer
  starts_on       date NOT NULL,
  ends_on         date NOT NULL,
  required_hours  integer NOT NULL,
  CHECK (ends_on >= starts_on)
);

-- GPS-verified attendance. inside_geofence is computed server-side from the
-- reported fix, never trusted from the client.
CREATE TABLE wbl_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id    uuid NOT NULL REFERENCES wbl_placements(id),
  kind            text NOT NULL CHECK (kind IN ('in', 'out')),
  device_time     timestamptz NOT NULL,
  server_time     timestamptz NOT NULL DEFAULT now(),
  latitude        float8 NOT NULL,
  longitude       float8 NOT NULL,
  accuracy_m      real,
  distance_m      float8,
  inside_geofence boolean,
  client_mutation_id uuid UNIQUE
);

CREATE OR REPLACE FUNCTION evaluate_geofence() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE s employer_sites%ROWTYPE;
BEGIN
  SELECT es.* INTO s FROM employer_sites es
    JOIN wbl_placements p ON p.site_id = es.id
   WHERE p.id = NEW.placement_id;
  NEW.distance_m := haversine_m(NEW.latitude, NEW.longitude, s.latitude, s.longitude);
  -- Allow the fix's own accuracy radius (capped) as slack.
  NEW.inside_geofence := NEW.distance_m <= s.geofence_radius_m + LEAST(COALESCE(NEW.accuracy_m, 0), 50);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_checkin_geofence BEFORE INSERT ON wbl_checkins
  FOR EACH ROW EXECUTE FUNCTION evaluate_geofence();

CREATE TABLE wbl_logbook_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id    uuid NOT NULL REFERENCES wbl_placements(id),
  work_date       date NOT NULL,
  hours           numeric(4,2) NOT NULL CHECK (hours > 0 AND hours <= 16),
  task_summary    text NOT NULL,
  competency_ids  uuid[] NOT NULL DEFAULT '{}',
  media           jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{"uri":"s3://...","type":"photo","sha256":"...","captured_at":"..."}]
  status          signoff_status NOT NULL DEFAULT 'draft',
  submitted_at    timestamptz,
  client_mutation_id uuid UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_logbook_touch BEFORE UPDATE ON wbl_logbook_entries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE INDEX idx_logbook_pending ON wbl_logbook_entries(placement_id) WHERE status = 'submitted';

-- Each sign-off decision is its own immutable row (audit trail for IQA).
CREATE TABLE wbl_signoffs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        uuid NOT NULL REFERENCES wbl_logbook_entries(id) ON DELETE CASCADE,
  supervisor_id   uuid NOT NULL REFERENCES users(id),
  decision        signoff_status NOT NULL CHECK (decision IN ('approved', 'rejected', 'revision_requested')),
  rating          smallint CHECK (rating BETWEEN 1 AND 5),
  comment         text,
  signature_hash  text NOT NULL,                     -- sha256(entry payload || supervisor key)
  signed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION apply_signoff() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE wbl_logbook_entries SET status = NEW.decision WHERE id = NEW.entry_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_apply_signoff AFTER INSERT ON wbl_signoffs
  FOR EACH ROW EXECUTE FUNCTION apply_signoff();

-- =============================================================================
-- REPORTING VIEWS (Executive / QA dashboard)
-- =============================================================================
CREATE VIEW v_asset_utilisation_30d AS
SELECT a.id AS asset_id, a.asset_tag, a.name, w.name AS workshop,
       round(100.0 * COALESCE(sum(extract(epoch FROM
             upper(b.during * tstzrange(now() - interval '30 days', now()))
           - lower(b.during * tstzrange(now() - interval '30 days', now())))), 0)
           / (30 * 8 * 3600), 1) AS utilisation_pct   -- vs. 8 bookable hours/day
FROM workshop_assets a
JOIN workshops w ON w.id = a.workshop_id
LEFT JOIN asset_bookings b ON b.asset_id = a.id AND b.cancelled_at IS NULL
     AND b.during && tstzrange(now() - interval '30 days', now())
GROUP BY a.id, w.name;

CREATE VIEW v_regional_skill_heatmap AS
SELECT i.region, c.code AS competency_code, c.title,
       count(*) FILTER (WHERE lc.level IN ('autonomous', 'master'))::float / NULLIF(count(*), 0) AS pct_competent,
       count(*) AS learners
FROM learner_competencies lc
JOIN users u        ON u.id = lc.learner_id
JOIN institutions i ON i.id = u.institution_id
JOIN competencies c ON c.id = lc.competency_id AND c.kind = 'unit'
GROUP BY i.region, c.code, c.title;

CREATE VIEW v_wbl_hours_progress AS
SELECT p.id AS placement_id, p.learner_id, p.required_hours,
       COALESCE(sum(e.hours) FILTER (WHERE e.status = 'approved'), 0) AS approved_hours,
       COALESCE(sum(e.hours) FILTER (WHERE e.status = 'submitted'), 0) AS pending_hours
FROM wbl_placements p
LEFT JOIN wbl_logbook_entries e ON e.placement_id = p.id
GROUP BY p.id;
