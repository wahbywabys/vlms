-- Demo data: one ATS, a learner + trainer, an electrical framework, and an
-- assessment-mode V-Lab session on a DOL motor starter with an injected fault.
-- Fixed UUIDs so the API integration test and the docs can reference them.
SET search_path = vlms, public;

INSERT INTO institutions (id, name, code, region) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Applied Technology School — Cairo East', 'ATS-CAI-01', 'Cairo');

INSERT INTO users (id, institution_id, email, full_name, safety_badge_uid) VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'learner@ats.example', 'Omar Learner', 'RFID-0001'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'trainer@ats.example', 'Huda Trainer', 'RFID-0002');
INSERT INTO user_roles VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'student', now()),
  ('00000000-0000-0000-0000-0000000000b2', 'vocational_trainer', now());

INSERT INTO competency_frameworks (id, code, title, issuing_body, version, effective_from) VALUES
  ('00000000-0000-0000-0000-0000000000c0', 'NTQF-ELEC-L3', 'Industrial Electrical Maintenance L3', 'National Qualifications Authority', '2026.1', '2026-01-01');
INSERT INTO competencies (id, framework_id, parent_id, code, title, kind, is_safety_critical) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c0', NULL,
   'ELEC-L3-U04', 'Diagnose faults in motor control circuits', 'unit', false),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c1',
   'ELEC-L3-U04-E1', 'Apply safe isolation (LOTO) before work', 'element', true),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c1',
   'ELEC-L3-U04-E2', 'Locate and identify the faulty component', 'element', false);

INSERT INTO virtual_labs (id, code, title, domain, model_uri, sim_version) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'VLAB-DOL-STARTER', 'DOL Motor Starter Fault Finding',
   'electrical_automation', 's3://vlms-twins/dol-starter-v3.glb', '3.2.0');

INSERT INTO lab_faults (id, lab_id, code, description, component_ref, correct_isolation_steps) VALUES
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d1', 'F-OL-OPEN',
   'Thermal overload NC contact 95-96 open-circuit', 'F2_overload',
   ARRAY['X1:L1-L2', 'Q1:control_supply', 'S1:stop_pb', 'F2:95-96']);

INSERT INTO rubrics (id, code, title, pass_threshold) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'RB-DOL-FAULT', 'DOL starter fault test', 70);
INSERT INTO rubric_criteria (rubric_id, key, label, weight, is_gate, competency_id, scoring) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'ppe',        'PPE donned before work',        5,  true,  NULL,
   '{"rule":"precedes","first":"ppe_donned","then":["panel_opened","measured","component_replaced"]}'),
  ('00000000-0000-0000-0000-0000000000e1', 'loto',       'LOTO applied before panel work', 10, true,  '00000000-0000-0000-0000-0000000000c2',
   '{"rule":"precedes","first":"loto_applied","then":["panel_opened","component_replaced"]}'),
  ('00000000-0000-0000-0000-0000000000e1', 'no_contact', 'No contact with live parts',     5,  true,  NULL,
   '{"rule":"absent","verb":"energized_contact"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'diagnosis',  'Correct fault identified',       35, false, '00000000-0000-0000-0000-0000000000c3',
   '{"rule":"fault_diagnosed","componentOnlyCredit":50}'),
  ('00000000-0000-0000-0000-0000000000e1', 'isolation',  'Logical test-point sequence',    20, false, '00000000-0000-0000-0000-0000000000c3',
   '{"rule":"isolation_steps"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'supply',     'Supply voltage within ±5%',      10, false, NULL,
   '{"rule":"measurement_tolerance","objectRef":"X1:L1-L2","expected":400,"relTol":0.05}'),
  ('00000000-0000-0000-0000-0000000000e1', 'parts',      'No unnecessary part swaps',      10, false, NULL,
   '{"rule":"penalty_per","verb":"component_replaced","per":50}'),
  ('00000000-0000-0000-0000-0000000000e1', 'time',       'Completed within target time',   5,  false, NULL,
   '{"rule":"time","targetS":900,"maxS":1800}');

INSERT INTO virtual_lab_sessions (id, lab_id, learner_id, mode, rubric_id, injected_fault_ids, injected_by, device, time_limit_s, started_at) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1',
   'assessment', '00000000-0000-0000-0000-0000000000e1', ARRAY['00000000-0000-0000-0000-0000000000d2']::uuid[],
   '00000000-0000-0000-0000-0000000000b2', 'tablet', 1800, now() - interval '10 minutes');
