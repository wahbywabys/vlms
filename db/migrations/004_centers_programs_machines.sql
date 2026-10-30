-- Centres, the real machine register, and offline machine scans.
--
-- A centre is one physical training site of the institution. Each workshop
-- belongs to a centre. Every real machine on the workshop floor is one row in
-- workshop_assets, with its brand, model, serial number and photo, and a
-- machine type that links it to the 3D twin learners practise on.
-- Programmes (specialisations) are the trades table; their skills are the
-- competency tree of the trade's framework. Both are managed from the admin
-- screens (api/src/routes/admin.ts), one by one or imported from Excel/CSV.
SET search_path = vtc, public;

-- -----------------------------------------------------------------------------
-- Centres
-- -----------------------------------------------------------------------------
CREATE TABLE centers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  code            text NOT NULL CHECK (code ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$'),
  name            text NOT NULL,
  name_ar         text,
  region          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, code)
);

ALTER TABLE workshops ADD COLUMN center_id uuid REFERENCES centers(id);
CREATE INDEX idx_workshops_center ON workshops(center_id);

-- Every institution starts with one centre carrying its own code; workshops
-- created without a centre (older code paths, demo data) land in it.
CREATE FUNCTION default_center(inst uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE c uuid;
BEGIN
  SELECT id INTO c FROM centers WHERE institution_id = inst ORDER BY created_at, code LIMIT 1;
  IF c IS NULL THEN
    INSERT INTO centers (institution_id, code, name, name_ar, region)
    SELECT id, regexp_replace(code, '[^A-Za-z0-9_.-]', '-', 'g'), name, name_ar, region FROM institutions WHERE id = inst
    RETURNING id INTO c;
  END IF;
  RETURN c;
END $$;

CREATE FUNCTION workshops_default_center() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.center_id IS NULL THEN NEW.center_id := default_center(NEW.institution_id); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_workshops_center BEFORE INSERT OR UPDATE OF center_id ON workshops
  FOR EACH ROW EXECUTE FUNCTION workshops_default_center();
UPDATE workshops SET center_id = default_center(institution_id) WHERE center_id IS NULL;

-- -----------------------------------------------------------------------------
-- Machine types: what kind of machine it is, and which 3D twin it practises on
-- -----------------------------------------------------------------------------
CREATE TABLE machine_types (
  id              text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_]{1,39}$'),
  trade_id        text REFERENCES trades(id),
  name            text NOT NULL,
  name_ar         text,
  model_id        text,                              -- 3D twin id in the 3D studio ('cnc-lathe'); NULL = no twin yet
  twin_match      text CHECK (twin_match IN ('exact', 'similar')),
  precheck_code   text,                              -- default safety pre-check for machines of this type
  sort_order      integer NOT NULL DEFAULT 100,
  CHECK ((model_id IS NULL) = (twin_match IS NULL))
);

INSERT INTO machine_types (id, trade_id, name, name_ar, model_id, twin_match, precheck_code, sort_order) VALUES
  ('cnc_lathe',       'cnc',  'CNC lathe',                    'مخرطة CNC',                 'cnc-lathe',       'exact',   'PC-CNC-LATHE', 10),
  ('centre_lathe',    'cnc',  'Centre lathe (manual)',        'مخرطة يدوية',               'cnc-lathe',       'similar', 'PC-CNC-LATHE', 11),
  ('cnc_mill',        'cnc',  'CNC milling machine',          'فريزة CNC',                 NULL,              NULL,      NULL,           12),
  ('milling',         'cnc',  'Milling machine (manual)',     'فريزة يدوية',               NULL,              NULL,      NULL,           13),
  ('drill_press',     'cnc',  'Pillar drill',                 'مثقاب عمودي',               NULL,              NULL,      NULL,           14),
  ('bench_grinder',   'cnc',  'Bench / pedestal grinder',     'جلاخة',                     'bench-grinder',   'exact',   NULL,           15),
  ('engine_stand',    'auto', 'Engine on run stand',          'محرك على حامل تشغيل',       'car-engine',      'exact',   'PC-AUTO-BAY',  20),
  ('vehicle_bay',     'auto', 'Vehicle bay with lift',        'موقع سيارة برافعة',          'car-engine',      'similar', 'PC-AUTO-BAY',  21),
  ('wheel_aligner',   'auto', 'Wheel alignment rig',          'جهاز ضبط زوايا العجلات',    NULL,              NULL,      'PC-AUTO-BAY',  22),
  ('dol_starter',     'elec', 'Motor starter panel (DOL)',    'لوحة بادئ تشغيل مباشر',     'dol-panel',       'exact',   'PC-ELEC-RIG',  30),
  ('induction_motor', 'elec', 'Three-phase induction motor',  'محرك حثي ثلاثي الأوجه',     'induction-motor', 'exact',   'PC-ELEC-RIG',  31),
  ('wiring_booth',    'elec', 'Wiring booth / board',         'كابينة تمديدات',            'dol-panel',       'similar', 'PC-ELEC-RIG',  32),
  ('mig_welder',      'weld', 'MIG/MAG welder',               'ماكينة لحام MIG/MAG',       'mig-welder',      'exact',   'PC-WELD-BOOTH',  40),
  ('tig_welder',      'weld', 'TIG welder',                   'ماكينة لحام TIG',           'mig-welder',      'similar', 'PC-WELD-BOOTH',  41),
  ('arc_welder',      'weld', 'Stick (MMA) welder',           'ماكينة لحام كهربائي بالقوس', 'mig-welder',      'similar', 'PC-WELD-BOOTH',  42),
  ('plasma_cutter',   'weld', 'Plasma cutter',                'ماكينة قطع بلازما',          NULL,              NULL,      'PC-WELD-BOOTH',  43),
  ('other',           NULL,   'Other machine',                'ماكينة أخرى',               NULL,              NULL,      NULL,           999);

-- -----------------------------------------------------------------------------
-- The real machine: register fields on workshop_assets
-- -----------------------------------------------------------------------------
ALTER TABLE workshop_assets
  ADD COLUMN machine_type_id text REFERENCES machine_types(id),
  ADD COLUMN brand           text,
  ADD COLUMN model_no        text,
  ADD COLUMN serial_no       text,
  ADD COLUMN year_made       integer CHECK (year_made BETWEEN 1900 AND 2100),
  ADD COLUMN photo_media_id  uuid REFERENCES media_objects(id),
  ADD COLUMN notes           text,
  ADD COLUMN imported_at     timestamptz;
CREATE INDEX idx_assets_serial ON workshop_assets(lower(serial_no)) WHERE serial_no IS NOT NULL;

-- Give machines registered before types existed (and the demo rigs) a type from their name.
CREATE FUNCTION assign_machine_types() RETURNS void LANGUAGE sql AS $$
  UPDATE workshop_assets SET machine_type_id = CASE
           WHEN name ~* 'cnc lathe' THEN 'cnc_lathe' WHEN name ~* 'lathe' THEN 'centre_lathe'
           WHEN name ~* 'cnc mill' THEN 'cnc_mill' WHEN name ~* 'mill' THEN 'milling'
           WHEN name ~* 'grinder' THEN 'bench_grinder' WHEN name ~* 'drill' THEN 'drill_press'
           WHEN name ~* 'engine' THEN 'engine_stand' WHEN name ~* 'align' THEN 'wheel_aligner' WHEN name ~* 'vehicle|bay' AND make_model ~* 'car|lift' THEN 'vehicle_bay'
           WHEN name ~* 'dol|starter' THEN 'dol_starter' WHEN name ~* 'motor' THEN 'induction_motor' WHEN name ~* 'wiring' THEN 'wiring_booth'
           WHEN name ~* 'mig' THEN 'mig_welder' WHEN name ~* 'tig' THEN 'tig_welder' WHEN name ~* 'plasma' THEN 'plasma_cutter'
           WHEN name ~* 'stick|mma|arc' THEN 'arc_welder' ELSE 'other' END
   WHERE category = 'machine' AND machine_type_id IS NULL;
$$;
SELECT assign_machine_types();

-- -----------------------------------------------------------------------------
-- Machine scans made with no connection, confirmed when the device reconnects
-- -----------------------------------------------------------------------------
-- The phone or tablet decides from the qualification list it downloaded last
-- (GET /v1/safety/offline-pack) and queues the scan; POST /v1/sync replays it
-- here, the server decides again from its own records, and a disagreement
-- ("offline said allowed, server says not") raises a safety alert.
CREATE TABLE offline_machine_scans (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_mutation_id uuid NOT NULL UNIQUE,
  asset_id           uuid NOT NULL REFERENCES workshop_assets(id),
  learner_id         uuid NOT NULL REFERENCES users(id),
  scanned_by         uuid NOT NULL REFERENCES users(id),
  scanned_at         timestamptz NOT NULL,
  pack_generated_at  timestamptz,
  offline_allowed    boolean NOT NULL,
  server_allowed     boolean NOT NULL,
  server_reasons     text[] NOT NULL DEFAULT '{}',
  confirmed          boolean GENERATED ALWAYS AS (offline_allowed = server_allowed) STORED,
  synced_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_offline_scans_asset ON offline_machine_scans(asset_id, scanned_at DESC);
