-- Workshop operations, apprenticeship governance and advanced assessment.
--
-- Builds on the base schema rather than replacing it:
--   FloorRubrics          rubrics (kind = 'floor') + rubric_criteria tap metadata, view floor_rubrics
--   RubricEvaluations     rubric_evaluations (existing) + observation photo evidence
--   WorkshopAssets        workshop_assets (existing) + QR code, pre-check, controller key
--   ConsumableInventory   consumables + task bill of materials, auto-issue, forecast view
--   SafetyPassports       safety_prechecks, safety_precheck_attempts, safety_passports
--   MachineLocks          machine_locks (unlock tokens, one live unlock per machine)
--   OJT_Attendance        ojt_attendance (check-in/out pairs → verified hours)
--   ApprenticeLogbooks    wbl_logbook_entries (existing) + media_objects, attendance link
--   ParametricQuestions   question_parameters (existing) + question_instances, view parametric_questions
--   SchematicHotspots     schematics, schematic_hotspots
--   Early warning         class_attendance, risk_snapshots, competency_level_history
SET search_path = vtc, public;

-- =============================================================================
-- A. MEDIA (photos and videos from the floor tablet and the apprentice's phone)
-- =============================================================================
-- One row per uploaded file. In production `storage_uri` points at object
-- storage (s3://…) and `data` is NULL; the demo keeps small files inline.
-- sha256 is computed server-side and copied into logbook entries and
-- observations so a sign-off covers the exact bytes the supervisor saw.
CREATE TABLE media_objects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  owner_id        uuid NOT NULL REFERENCES users(id),
  kind            text NOT NULL CHECK (kind IN ('photo', 'video', 'signature')),
  mime            text NOT NULL CHECK (mime ~ '^(image|video)/[a-z0-9.+-]+$'),
  bytes           integer NOT NULL CHECK (bytes > 0 AND bytes <= 25 * 1024 * 1024),
  sha256          text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  width           integer,
  height          integer,
  duration_ms     integer,
  captured_at     timestamptz NOT NULL,              -- device clock at capture
  received_at     timestamptz NOT NULL DEFAULT now(),
  latitude        float8,
  longitude       float8,
  storage_uri     text,
  data            bytea,
  client_mutation_id uuid UNIQUE,
  CHECK (storage_uri IS NOT NULL OR data IS NOT NULL)
);
CREATE INDEX idx_media_owner ON media_objects(owner_id, received_at DESC);

-- =============================================================================
-- B. FLOOR RUBRICS (tablet, single-tap scoring)
-- =============================================================================
ALTER TABLE rubrics ADD COLUMN kind text NOT NULL DEFAULT 'vlab' CHECK (kind IN ('vlab', 'floor', 'both'));

-- What the tablet needs to draw a criterion as big tap targets.
--   category     groups rows and picks the icon colour band
--   descriptors  one label per tap level: [{"value":1,"en":"Needs help","ar":"…"}, …]
--   photo_rule   'on_fail' asks for a photo when a gate fails or a rating is ≤ 1
ALTER TABLE rubric_criteria
  ADD COLUMN category    text CHECK (category IN ('ppe', 'safety', 'hygiene', 'precision', 'method', 'quality')),
  ADD COLUMN descriptors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN photo_rule  text NOT NULL DEFAULT 'optional' CHECK (photo_rule IN ('optional', 'on_fail', 'always')),
  ADD COLUMN sort_order  integer NOT NULL DEFAULT 100;

CREATE VIEW floor_rubrics AS
SELECT r.id, r.code, r.version, r.title, r.title_ar, r.trade_id, r.pass_threshold,
       (SELECT jsonb_agg(jsonb_build_object(
                 'key', c.key, 'label', c.label, 'label_ar', c.label_ar, 'weight', c.weight, 'is_gate', c.is_gate,
                 'category', c.category, 'scoring', c.scoring, 'descriptors', c.descriptors, 'photo_rule', c.photo_rule)
               ORDER BY c.is_gate DESC, c.sort_order, c.key)
          FROM rubric_criteria c WHERE c.rubric_id = r.id) AS criteria
  FROM rubrics r WHERE r.kind IN ('floor', 'both');

-- Photo evidence attached to an observation, optionally against one criterion.
CREATE TABLE observation_media (
  observation_id  uuid NOT NULL REFERENCES workshop_observations(id) ON DELETE CASCADE,
  media_id        uuid NOT NULL REFERENCES media_objects(id),
  criterion_key   text,
  PRIMARY KEY (observation_id, media_id)
);

-- =============================================================================
-- C. CONSUMABLES: task bill of materials, automatic issue, forecast
-- =============================================================================
ALTER TABLE consumables
  ADD COLUMN lead_time_days integer NOT NULL DEFAULT 7 CHECK (lead_time_days >= 0),
  ADD COLUMN unit_cost      numeric(10,2);

-- How much of each consumable one attempt at a practical task uses.
CREATE TABLE task_consumables (
  rubric_id       uuid NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  consumable_id   uuid NOT NULL REFERENCES consumables(id),
  qty_per_task    numeric(12,3) NOT NULL CHECK (qty_per_task > 0),
  PRIMARY KEY (rubric_id, consumable_id)
);

ALTER TABLE consumable_movements
  ADD COLUMN observation_id     uuid REFERENCES workshop_observations(id),
  ADD COLUMN shortfall          numeric(12,3) NOT NULL DEFAULT 0,  -- wanted but not on the shelf
  ADD COLUMN client_mutation_id uuid UNIQUE;
-- A movement may be all shortfall (nothing left to issue).
ALTER TABLE consumable_movements DROP CONSTRAINT consumable_movements_delta_check,
  ADD CONSTRAINT consumable_movements_delta_check CHECK (delta <> 0 OR shortfall > 0);

-- A signed-off observation issues the task's materials from the workshop's
-- stores. Stock never goes negative: what is missing is recorded as a
-- shortfall so the stores clerk sees the bottleneck instead of a failed sign-off.
CREATE OR REPLACE FUNCTION issue_task_consumables() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE r record; take numeric;
BEGIN
  FOR r IN
    SELECT tc.consumable_id, tc.qty_per_task, c.on_hand
      FROM task_consumables tc JOIN consumables c ON c.id = tc.consumable_id
     WHERE tc.rubric_id = NEW.rubric_id
     FOR UPDATE OF c
  LOOP
    take := LEAST(r.qty_per_task, r.on_hand);
    INSERT INTO consumable_movements (consumable_id, delta, reason, user_id, related_session, observation_id, shortfall)
    VALUES (r.consumable_id, -take, 'issue', NEW.trainer_id, NEW.id, NEW.id, r.qty_per_task - take);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_observation_consumables AFTER INSERT ON workshop_observations
  FOR EACH ROW EXECUTE FUNCTION issue_task_consumables();

-- Days of cover against both the recent burn rate and the practical tasks
-- already booked on the workshop's machines for the next 7 days.
CREATE VIEW v_consumable_forecast AS
WITH burn AS (
  SELECT consumable_id, -sum(delta) FILTER (WHERE reason IN ('issue', 'scrap')) / 14.0 AS per_day, sum(shortfall) AS shortfall
    FROM consumable_movements WHERE occurred_at >= now() - interval '14 days' GROUP BY consumable_id
), booked AS (
  SELECT tc.consumable_id, sum(tc.qty_per_task) AS qty
    FROM asset_bookings b
    JOIN workshop_assets a ON a.id = b.asset_id
    JOIN workshops w ON w.id = a.workshop_id
    JOIN task_consumables tc ON tc.rubric_id = w.observation_rubric_id
   WHERE b.cancelled_at IS NULL AND lower(b.during) BETWEEN now() AND now() + interval '7 days'
   GROUP BY tc.consumable_id
)
SELECT c.id AS consumable_id, c.workshop_id, w.trade_id, c.sku, c.name, c.unit, c.on_hand::float, c.reorder_point::float,
       c.lead_time_days, COALESCE(b.per_day, 0)::float AS burn_per_day, COALESCE(k.qty, 0)::float AS booked_7d,
       COALESCE(b.shortfall, 0)::float AS shortfall_14d,
       CASE WHEN COALESCE(b.per_day, 0) > 0 THEN round((c.on_hand / b.per_day)::numeric, 1)::float END AS days_of_cover,
       CASE WHEN c.on_hand < COALESCE(k.qty, 0) OR (b.per_day > 0 AND c.on_hand / b.per_day < c.lead_time_days) THEN 'critical'
            WHEN c.on_hand < c.reorder_point THEN 'reorder' ELSE 'ok' END AS status
  FROM consumables c JOIN workshops w ON w.id = c.workshop_id
  LEFT JOIN burn b ON b.consumable_id = c.id
  LEFT JOIN booked k ON k.consumable_id = c.id;

-- =============================================================================
-- D. SAFETY PASSPORTS & MACHINE LOCKS (QR / RFID access control)
-- =============================================================================
-- A pre-check is the short quiz served after a QR scan. `items` holds the
-- full bank with answers (never sent to clients); see api/src/services/precheck.ts.
CREATE TABLE safety_prechecks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  code            text NOT NULL UNIQUE,              -- 'PC-CNC-LATHE'
  title           text NOT NULL,
  title_ar        text,
  trade_id        text REFERENCES trades(id),
  items           jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  draw_count      integer NOT NULL DEFAULT 4 CHECK (draw_count > 0),
  pass_mark       numeric(5,2) NOT NULL DEFAULT 100, -- and every critical item right
  passport_hours  integer NOT NULL DEFAULT 8 CHECK (passport_hours BETWEEN 1 AND 24 * 30),
  unlock_minutes  integer NOT NULL DEFAULT 120 CHECK (unlock_minutes BETWEEN 5 AND 600),
  cooldown_s      integer NOT NULL DEFAULT 60,       -- wait after a failed attempt
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workshop_assets
  ADD COLUMN qr_code             text UNIQUE,        -- random code printed on the label (not the guessable tag)
  ADD COLUMN precheck_id         uuid REFERENCES safety_prechecks(id),
  ADD COLUMN controller_key_hash text,               -- sha256 of the interlock controller's API key; NULL = virtual controller
  ADD COLUMN controller_seen_at  timestamptz;

CREATE TABLE safety_precheck_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  precheck_id     uuid NOT NULL REFERENCES safety_prechecks(id),
  asset_id        uuid NOT NULL REFERENCES workshop_assets(id),
  learner_id      uuid NOT NULL REFERENCES users(id),
  served_item_ids text[] NOT NULL,
  answers         jsonb,
  score           numeric(5,2),
  passed          boolean,
  critical_missed text[] NOT NULL DEFAULT '{}',
  started_at      timestamptz NOT NULL DEFAULT now(),
  submitted_at    timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
CREATE INDEX idx_precheck_attempts_learner ON safety_precheck_attempts(learner_id, started_at DESC);

-- A passport clears one learner for one machine for a shift.
CREATE TABLE safety_passports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      uuid NOT NULL REFERENCES users(id),
  asset_id        uuid NOT NULL REFERENCES workshop_assets(id),
  precheck_id     uuid NOT NULL REFERENCES safety_prechecks(id),
  attempt_id      uuid NOT NULL UNIQUE REFERENCES safety_precheck_attempts(id),
  issued_at       timestamptz NOT NULL DEFAULT now(),
  valid_until     timestamptz NOT NULL,
  revoked_at      timestamptz,
  revoked_by      uuid REFERENCES users(id),
  revoke_reason   text,
  CHECK (valid_until > issued_at)
);
CREATE INDEX idx_passports_valid ON safety_passports(learner_id, asset_id, valid_until DESC) WHERE revoked_at IS NULL;

CREATE TYPE lock_state AS ENUM ('unlock_pending', 'unlocked', 'released', 'expired', 'revoked', 'denied');

-- Each unlock signal sent to a machine's interlock. Only the SHA-256 of the
-- token is stored; the controller verifies the token it is handed.
CREATE TABLE machine_locks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        uuid NOT NULL REFERENCES workshop_assets(id),
  learner_id      uuid NOT NULL REFERENCES users(id),
  passport_id     uuid REFERENCES safety_passports(id),
  checkout_id     uuid REFERENCES asset_checkouts(id),
  state           lock_state NOT NULL,
  token_hash      text UNIQUE,
  pin_code        text CHECK (pin_code ~ '^\d{6}$'),  -- typed on the machine keypad if it has no network
  issued_at       timestamptz NOT NULL DEFAULT now(),
  token_expires_at timestamptz,                       -- must reach the machine before this
  unlocked_at     timestamptz,
  session_ends_at timestamptz,
  released_at     timestamptz,
  released_by     uuid REFERENCES users(id),
  reason          text,                               -- denial or release reason
  client_mutation_id uuid UNIQUE
);
-- At most one live unlock per machine, enforced by the database.
CREATE UNIQUE INDEX uq_machine_live_lock ON machine_locks(asset_id) WHERE state IN ('unlock_pending', 'unlocked');
CREATE INDEX idx_machine_locks_learner ON machine_locks(learner_id, issued_at DESC);

-- Lazily expire unlocks whose time is up; called before every lock read/write.
CREATE OR REPLACE FUNCTION expire_machine_locks() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  WITH gone AS (
    UPDATE machine_locks SET state = 'expired', released_at = now(), reason = COALESCE(reason, 'time limit reached')
     WHERE (state = 'unlock_pending' AND token_expires_at < now())
        OR (state = 'unlocked' AND session_ends_at < now())
    RETURNING asset_id, checkout_id
  ), closed AS (
    UPDATE asset_checkouts SET returned_at = now(), condition_in = 'auto-returned at lock expiry'
     WHERE id IN (SELECT checkout_id FROM gone WHERE checkout_id IS NOT NULL) AND returned_at IS NULL
  )
  UPDATE workshop_assets SET status = 'available' WHERE id IN (SELECT asset_id FROM gone) AND status = 'in_use';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- =============================================================================
-- E. OJT ATTENDANCE (geofenced check-in / check-out → hours)
-- =============================================================================
ALTER TABLE wbl_checkins
  ADD COLUMN accepted      boolean NOT NULL DEFAULT true,  -- false: recorded for audit, no hours
  ADD COLUMN flags         text[] NOT NULL DEFAULT '{}',   -- 'clock_skew', 'offline_replay', 'impossible_travel', …
  ADD COLUMN reject_reason text,
  ADD COLUMN is_mocked     boolean NOT NULL DEFAULT false,
  ADD COLUMN source        text CHECK (source IN ('gps', 'network', 'demo'));
CREATE INDEX idx_checkins_placement ON wbl_checkins(placement_id, device_time DESC);

CREATE TABLE ojt_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id    uuid NOT NULL REFERENCES wbl_placements(id),
  checkin_id      uuid NOT NULL UNIQUE REFERENCES wbl_checkins(id),
  checkout_id     uuid UNIQUE REFERENCES wbl_checkins(id),
  opened_at       timestamptz NOT NULL,
  closed_at       timestamptz,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'auto_closed', 'disputed')),
  -- Both ends inside the geofence and no hard flags: counts without review.
  verified        boolean NOT NULL DEFAULT false,
  minutes         integer GENERATED ALWAYS AS
                    (CASE WHEN closed_at IS NULL THEN NULL ELSE (extract(epoch FROM closed_at - opened_at) / 60)::integer END) STORED,
  flags           text[] NOT NULL DEFAULT '{}',
  confirmed_by    uuid REFERENCES users(id),          -- supervisor confirms an unverified shift
  CHECK (closed_at IS NULL OR closed_at > opened_at)
);
-- One open shift per placement.
CREATE UNIQUE INDEX uq_ojt_open ON ojt_attendance(placement_id) WHERE status = 'open';

CREATE VIEW v_ojt_hours AS
SELECT p.id AS placement_id, p.learner_id, p.required_hours, p.starts_on, p.ends_on,
       round(COALESCE(sum(a.minutes) FILTER (WHERE a.verified OR a.confirmed_by IS NOT NULL), 0) / 60.0, 1)::float AS verified_hours,
       round(COALESCE(sum(a.minutes) FILTER (WHERE NOT a.verified AND a.confirmed_by IS NULL), 0) / 60.0, 1)::float AS unverified_hours,
       -- Pro-rata hours expected by today on a Sun–Thu week.
       round(p.required_hours * LEAST(1, GREATEST(0,
         (SELECT count(*) FROM generate_series(p.starts_on, LEAST(current_date, p.ends_on), interval '1 day') d WHERE extract(isodow FROM d) NOT IN (5, 6))::numeric
         / NULLIF((SELECT count(*) FROM generate_series(p.starts_on, p.ends_on, interval '1 day') d WHERE extract(isodow FROM d) NOT IN (5, 6)), 0))), 1)::float AS expected_hours,
       bool_or(a.status = 'open') AS on_site
  FROM wbl_placements p LEFT JOIN ojt_attendance a ON a.placement_id = p.id
 GROUP BY p.id;

-- Logbook entries can point at the shift they describe and carry the
-- submission fix; media is a list of media_objects ids with their hashes.
ALTER TABLE wbl_logbook_entries
  ADD COLUMN attendance_id uuid REFERENCES ojt_attendance(id),
  ADD COLUMN submitted_lat float8,
  ADD COLUMN submitted_lon float8;
ALTER TABLE wbl_signoffs ADD COLUMN signature_media_id uuid REFERENCES media_objects(id);

-- =============================================================================
-- F. PARAMETRIC QUESTIONS (per-learner randomised variables and tolerances)
-- =============================================================================
ALTER TABLE question_parameters ADD COLUMN choices numeric[];  -- draw from a list instead of a range

-- A quiz sitting: which items a learner was served, so only those can be graded.
CREATE TABLE assessment_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      uuid NOT NULL REFERENCES users(id),
  trade_id        text REFERENCES trades(id),
  question_ids    uuid[] NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  submitted_at    timestamptz,
  score           numeric(7,2),
  max_score       numeric(7,2)
);
CREATE INDEX idx_assessment_sessions_learner ON assessment_sessions(learner_id, started_at DESC);

-- The exact instance a learner was served. Grading rebuilds nothing from the
-- client: it reads the stored values and the stored answer.
CREATE TABLE question_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     uuid NOT NULL,
  version         integer NOT NULL,
  learner_id      uuid NOT NULL REFERENCES users(id),
  assessment_id   uuid NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  seed            bigint NOT NULL,
  parameter_values jsonb NOT NULL,
  rendered_stem   text NOT NULL,
  rendered_stem_ar text,
  answer_value    numeric NOT NULL,                  -- never sent to the learner
  abs_tolerance   numeric,
  rel_tolerance   numeric,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  attempt_id      uuid REFERENCES question_attempts(id),
  FOREIGN KEY (question_id, version) REFERENCES question_versions(question_id, version),
  UNIQUE (question_id, learner_id, assessment_id)
);
CREATE INDEX idx_instances_learner ON question_instances(learner_id, issued_at DESC);

CREATE VIEW parametric_questions AS
SELECT q.id AS question_id, v.version, q.status, q.institution_id, v.stem, v.body, v.abs_tolerance, v.rel_tolerance, v.max_points,
       (SELECT jsonb_agg(jsonb_build_object('name', p.name, 'min', p.min_value, 'max', p.max_value, 'step', p.step,
                                            'unit', p.unit, 'choices', p.choices) ORDER BY p.name)
          FROM question_parameters p WHERE p.question_id = q.id AND p.version = v.version) AS parameters
  FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version = q.current_version
 WHERE q.type = 'calculation' AND v.body ? 'answer_expr';

-- =============================================================================
-- G. SCHEMATIC HOTSPOTS (pinpoint the fault on a drawing)
-- =============================================================================
CREATE TABLE schematics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  trade_id        text REFERENCES trades(id),
  code            text NOT NULL UNIQUE,              -- 'SCH-DOL-CTRL'
  title           text NOT NULL,
  title_ar        text,
  kind            text NOT NULL CHECK (kind IN ('wiring', 'blueprint', 'hydraulic', 'pneumatic', 'weld_drawing')),
  view_box        text NOT NULL,                     -- '0 0 800 500': hotspot coordinates use these units
  svg             text,                              -- inline drawing (sanitised on upload) …
  media_id        uuid REFERENCES media_objects(id), -- … or a raster/PDF render
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (svg IS NOT NULL OR media_id IS NOT NULL)
);

CREATE TABLE schematic_hotspots (
  question_id     uuid NOT NULL,
  version         integer NOT NULL,
  key             text NOT NULL,                     -- 'OL-95-96'
  schematic_id    uuid NOT NULL REFERENCES schematics(id),
  role            text NOT NULL CHECK (role IN ('target', 'distractor')),
  shape           text NOT NULL CHECK (shape IN ('circle', 'rect', 'polygon')),
  geometry        jsonb NOT NULL,                    -- circle {cx,cy,r} · rect {x,y,w,h} · polygon {points:[[x,y],…]}
  tolerance       numeric NOT NULL DEFAULT 0 CHECK (tolerance >= 0),  -- slack in drawing units
  points          numeric(6,2) NOT NULL DEFAULT 1,
  label           text,
  label_ar        text,
  feedback        jsonb,                             -- {"en": "…", "ar": "…"}
  PRIMARY KEY (question_id, version, key),
  FOREIGN KEY (question_id, version) REFERENCES question_versions(question_id, version) ON DELETE CASCADE
);

-- =============================================================================
-- H. ANALYTICS: attendance, risk snapshots, level history
-- =============================================================================
ALTER TABLE cohorts ADD COLUMN final_practical_on date;

CREATE TABLE class_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id       uuid NOT NULL REFERENCES cohorts(id),
  learner_id      uuid NOT NULL REFERENCES users(id),
  session_date    date NOT NULL,
  period          text NOT NULL DEFAULT 'day',       -- 'am', 'pm', 'workshop', …
  status          text NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  recorded_by     uuid REFERENCES users(id),
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, session_date, period)
);
CREATE INDEX idx_class_attendance ON class_attendance(cohort_id, session_date DESC);

-- Each level change, so the heatmap can show how a learner moved
-- Novice → Intermediate → Autonomous → Master over time.
CREATE TABLE competency_level_history (
  learner_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competency_id   uuid NOT NULL REFERENCES competencies(id),
  level           proficiency_level NOT NULL,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, competency_id, changed_at)
);
CREATE OR REPLACE FUNCTION record_level_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.level IS DISTINCT FROM OLD.level THEN
    INSERT INTO competency_level_history (learner_id, competency_id, level, changed_at)
    VALUES (NEW.learner_id, NEW.competency_id, NEW.level, COALESCE(NEW.last_assessed_at, now()))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_level_history AFTER INSERT OR UPDATE OF level ON learner_competencies
  FOR EACH ROW EXECUTE FUNCTION record_level_change();
-- Rows that existed before history was kept.
INSERT INTO competency_level_history (learner_id, competency_id, level, changed_at)
SELECT learner_id, competency_id, level, COALESCE(last_assessed_at, updated_at) FROM learner_competencies
ON CONFLICT DO NOTHING;

-- Cohort × element matrix for the executive heatmap (levels are held per
-- element of a unit): how many learners sit at each level.
CREATE VIEW v_skills_heatmap AS
SELECT c.id AS cohort_id, c.trade_id, comp.id AS competency_id, comp.code, comp.title, comp.title_ar,
       unit.code AS unit_code, unit.title AS unit_title, unit.title_ar AS unit_title_ar,
       count(*) FILTER (WHERE COALESCE(lc.level, 'not_yet') = 'not_yet') AS not_yet,
       count(*) FILTER (WHERE lc.level = 'novice')       AS novice,
       count(*) FILTER (WHERE lc.level = 'intermediate') AS intermediate,
       count(*) FILTER (WHERE lc.level = 'autonomous')   AS autonomous,
       count(*) FILTER (WHERE lc.level = 'master')       AS master,
       count(*) AS learners,
       round(avg(CASE COALESCE(lc.level, 'not_yet') WHEN 'not_yet' THEN 0 WHEN 'novice' THEN 1 WHEN 'intermediate' THEN 2
                               WHEN 'autonomous' THEN 3 WHEN 'master' THEN 4 END), 2)::float AS mean_level
  FROM cohorts c
  JOIN cohort_members m ON m.cohort_id = c.id AND m.member_role = 'student'
  JOIN competency_frameworks f ON f.trade_id = c.trade_id
  JOIN competencies comp ON comp.framework_id = f.id AND comp.kind = 'element'
  LEFT JOIN competencies unit ON unit.id = comp.parent_id
  LEFT JOIN learner_competencies lc ON lc.learner_id = m.user_id AND lc.competency_id = comp.id
 GROUP BY c.id, c.trade_id, comp.id, unit.code, unit.title, unit.title_ar;

-- The raw signals the early-warning model reads (api/src/services/riskModel.ts).
CREATE VIEW v_learner_signals AS
SELECT u.id AS learner_id, u.institution_id, c.id AS cohort_id, c.trade_id, c.final_practical_on,
       att.rate AS attendance_rate,
       fl.avg_score AS floor_avg, fl.trend AS floor_trend, fl.gate_fails,
       vl.pass_rate AS vlab_pass_rate,
       (SELECT count(*) FROM safety_alerts sa WHERE sa.learner_id = u.id AND sa.source = 'vlab'
           AND sa.raised_at >= now() - interval '30 days')::int AS safety_violations,
       qz.pct AS quiz_pct,
       CASE WHEN oh.expected_hours > 0 THEN oh.verified_hours / oh.expected_hours END AS ojt_pace,
       (current_date - GREATEST(
          (SELECT max(e.recorded_at) FROM competency_evidence e WHERE e.learner_id = u.id),
          (SELECT max(r.evaluated_at) FROM rubric_evaluations r WHERE r.learner_id = u.id),
          (SELECT max(qa.attempted_at) FROM question_attempts qa WHERE qa.learner_id = u.id))::date) AS days_inactive
  FROM users u
  JOIN cohort_members m ON m.user_id = u.id AND m.member_role = 'student'
  JOIN cohorts c ON c.id = m.cohort_id
  LEFT JOIN LATERAL (
    SELECT avg(CASE status WHEN 'present' THEN 1 WHEN 'late' THEN 0.75 WHEN 'excused' THEN NULL ELSE 0 END)::float AS rate
      FROM class_attendance WHERE learner_id = u.id AND session_date >= current_date - 30) att ON true
  LEFT JOIN LATERAL (
    SELECT avg(total_score)::float AS avg_score,
           (avg(total_score) FILTER (WHERE rn <= 3) - avg(total_score) FILTER (WHERE rn BETWEEN 4 AND 6))::float AS trend,
           count(*) FILTER (WHERE cardinality(gate_failures) > 0)::int AS gate_fails
      FROM (SELECT total_score, gate_failures, row_number() OVER (ORDER BY evaluated_at DESC) AS rn
              FROM rubric_evaluations WHERE learner_id = u.id AND subject_type = 'workshop_observation'
               AND evaluated_at >= now() - interval '30 days') x) fl ON true
  LEFT JOIN LATERAL (
    SELECT avg(CASE WHEN passed THEN 1 ELSE 0 END)::float AS pass_rate
      FROM virtual_lab_sessions WHERE learner_id = u.id AND status = 'evaluated'
       AND started_at >= now() - interval '30 days') vl ON true
  LEFT JOIN LATERAL (
    SELECT 100 * sum(points_awarded)::float / NULLIF(sum(v.max_points), 0)::float AS pct
      FROM question_attempts qa JOIN question_versions v ON v.question_id = qa.question_id AND v.version = qa.version
     WHERE qa.learner_id = u.id AND qa.attempted_at >= now() - interval '30 days') qz ON true
  LEFT JOIN LATERAL (SELECT * FROM v_ojt_hours h WHERE h.learner_id = u.id ORDER BY h.starts_on DESC LIMIT 1) oh ON true;

CREATE TABLE risk_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      uuid NOT NULL REFERENCES users(id),
  computed_on     date NOT NULL DEFAULT current_date,
  probability     numeric(4,3) NOT NULL CHECK (probability BETWEEN 0 AND 1),
  band            text NOT NULL CHECK (band IN ('low', 'watch', 'high')),
  signals         jsonb NOT NULL,                    -- model inputs, kept for refitting
  factors         jsonb NOT NULL,                    -- [{key, value, contribution}]
  model_version   text NOT NULL,
  acknowledged_by uuid REFERENCES users(id),         -- a trainer took action
  action_note     text,
  UNIQUE (learner_id, computed_on, model_version)
);
