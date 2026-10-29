-- Trades (specialisations): CNC machining, automotive, electrical, welding.
--
-- A trade groups the frameworks, cohorts, workshops, observation rubrics and
-- virtual labs that belong to one specialisation, so every screen can be
-- filtered by it. Add a trade by inserting a row here (or in a later
-- migration) and pointing its frameworks, cohorts and workshops at it.
SET search_path = vtc, public;

CREATE TABLE trades (
  id              text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_]{1,23}$'),  -- 'cnc', also the URL value
  code            text NOT NULL UNIQUE,              -- short code used in competency and lab codes
  name            text NOT NULL,
  name_ar         text,
  icon            text,                              -- 24×24 line-icon SVG path data
  sort_order      integer NOT NULL DEFAULT 100
);

INSERT INTO trades (id, code, name, name_ar, icon, sort_order) VALUES
  ('cnc',  'CNC',  'CNC machining',           'تشغيل ماكينات CNC',  'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10.5 2h3l.5 2.6 2 .9 2.2-1.5 2.1 2.1-1.5 2.2.9 2 2.6.5v3l-2.6.5-.9 2 1.5 2.2-2.1 2.1-2.2-1.5-2 .9-.5 2.6h-3l-.5-2.6-2-.9-2.2 1.5-2.1-2.1 1.5-2.2-.9-2L2 13.5v-3l2.6-.5.9-2L4 5.8l2.1-2.1 2.2 1.5 2-.9z', 10),
  ('auto', 'AUTO', 'Automotive mechanics',    'ميكانيكا السيارات',   'M5 17h14M3 17v-4l2-5h14l2 5v4M7 17a2 2 0 1 0 0 .1M17 17a2 2 0 1 0 0 .1M5.5 12h13', 20),
  ('elec', 'ELEC', 'Electrical installation', 'التركيبات الكهربائية', 'M13 2 4 14h7l-1 8 9-12h-7z', 30),
  ('weld', 'WELD', 'Welding & fabrication',   'اللحام والتشكيل',     'M4 20l6-6M10 14l3 3M13 17l7-7-3-3-7 7M15 4l1 2M19 3l-1 2M21 7l-2 1', 40);

ALTER TABLE competency_frameworks ADD COLUMN trade_id text REFERENCES trades(id);
ALTER TABLE cohorts               ADD COLUMN trade_id text REFERENCES trades(id);
ALTER TABLE workshops             ADD COLUMN trade_id text REFERENCES trades(id);
ALTER TABLE virtual_labs          ADD COLUMN trade_id text REFERENCES trades(id);
ALTER TABLE rubrics               ADD COLUMN trade_id text REFERENCES trades(id);
-- The rubric a trainer scores this workshop's practical tasks against.
ALTER TABLE workshops ADD COLUMN observation_rubric_id uuid REFERENCES rubrics(id);
CREATE INDEX idx_cohorts_trade ON cohorts(trade_id);
CREATE INDEX idx_workshops_trade ON workshops(institution_id, trade_id);

-- Assign a trade to rows created before trades existed (and to demo rows,
-- which load after this migration). Only rows without a trade are touched.
CREATE FUNCTION assign_trades() RETURNS void LANGUAGE sql AS $$
  UPDATE competency_frameworks SET trade_id = CASE
           WHEN code ~* 'ELEC' THEN 'elec' WHEN code ~* 'CNC|MECH|MACH' THEN 'cnc'
           WHEN code ~* 'AUTO|VEH' THEN 'auto' WHEN code ~* 'WELD|FAB' THEN 'weld' END
   WHERE trade_id IS NULL;
  UPDATE virtual_labs SET trade_id = CASE domain
           WHEN 'electrical_automation' THEN 'elec' WHEN 'loto_safety' THEN 'elec' WHEN 'cnc_milling' THEN 'cnc'
           WHEN 'automotive_obd' THEN 'auto' WHEN 'welding_fabrication' THEN 'weld' END
   WHERE trade_id IS NULL;
  UPDATE cohorts SET trade_id = CASE
           WHEN trade ~* 'electr' THEN 'elec' WHEN trade ~* 'mechatron|cnc|machin' THEN 'cnc'
           WHEN trade ~* 'auto|vehicle|motor mech' THEN 'auto' WHEN trade ~* 'weld|fabric' THEN 'weld' END
   WHERE trade_id IS NULL;
  UPDATE workshops SET trade_id = CASE
           WHEN name ~* 'electr' THEN 'elec' WHEN name ~* 'cnc|machin|lathe' THEN 'cnc'
           WHEN name ~* 'auto|vehicle|garage' THEN 'auto' WHEN name ~* 'weld|fabric' THEN 'weld' END
   WHERE trade_id IS NULL;
  UPDATE rubrics r SET trade_id = l.trade_id FROM virtual_labs l
   WHERE l.default_rubric_id = r.id AND r.trade_id IS NULL;
  UPDATE workshops w SET observation_rubric_id = r.id FROM rubrics r
   WHERE w.observation_rubric_id IS NULL AND w.trade_id = 'cnc' AND r.code = 'RB-JC-118';
  UPDATE rubrics r SET trade_id = w.trade_id FROM workshops w
   WHERE w.observation_rubric_id = r.id AND r.trade_id IS NULL;
$$;
SELECT assign_trades();

-- Reporting views gain a trade column (appended, so existing readers keep working).
CREATE OR REPLACE VIEW v_asset_utilisation_30d AS
SELECT a.id AS asset_id, a.asset_tag, a.name, w.name AS workshop,
       round(100.0 * COALESCE(sum(extract(epoch FROM
             upper(b.during * tstzrange(now() - interval '30 days', now()))
           - lower(b.during * tstzrange(now() - interval '30 days', now())))), 0)
           / (30 * 8 * 3600), 1) AS utilisation_pct,  -- vs. 8 bookable hours/day
       w.trade_id
FROM workshop_assets a
JOIN workshops w ON w.id = a.workshop_id
LEFT JOIN asset_bookings b ON b.asset_id = a.id AND b.cancelled_at IS NULL
     AND b.during && tstzrange(now() - interval '30 days', now())
GROUP BY a.id, w.name, w.trade_id;

CREATE OR REPLACE VIEW v_regional_skill_heatmap AS
SELECT i.region, c.code AS competency_code, c.title,
       count(*) FILTER (WHERE lc.level IN ('autonomous', 'master'))::float / NULLIF(count(*), 0) AS pct_competent,
       count(*) AS learners,
       f.trade_id
FROM learner_competencies lc
JOIN users u        ON u.id = lc.learner_id
JOIN institutions i ON i.id = u.institution_id
JOIN competencies c ON c.id = lc.competency_id AND c.kind = 'unit'
JOIN competency_frameworks f ON f.id = c.framework_id
GROUP BY i.region, c.code, c.title, f.trade_id;

-- A learner's trade is their cohort's; staff can belong to several.
CREATE VIEW v_user_trades AS
SELECT DISTINCT m.user_id, c.trade_id
  FROM cohort_members m JOIN cohorts c ON c.id = m.cohort_id
 WHERE c.trade_id IS NOT NULL;
