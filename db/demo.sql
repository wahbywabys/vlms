-- VTC_LMS demo data, loaded after schema.sql and seed.sql.
--
-- Five sign-in accounts (password for all: demo1234), one cohort of twelve
-- learners, two competency frameworks, a CNC bay and an electrical lab, a
-- work-based-learning placement with a logbook, a question bank, and three
-- weeks of assessment history so the dashboards have something to show.
-- Every name and number here is illustrative.
SET search_path = vtc, public;

UPDATE institutions SET name = 'Vocational Training Centre — Cairo East', name_ar = 'مركز التدريب المهني — شرق القاهرة' WHERE id = '00000000-0000-0000-0000-0000000000a1';

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
UPDATE users SET email = 'student@vtc.example', full_name = 'Omar Lotfy', full_name_ar = 'عمر لطفي'
 WHERE id = '00000000-0000-0000-0000-0000000000b1';
UPDATE users SET email = 'trainer@vtc.example', full_name = 'Eng. Huda Kamal', full_name_ar = 'م. هدى كمال'
 WHERE id = '00000000-0000-0000-0000-0000000000b2';

INSERT INTO users (id, institution_id, email, full_name, full_name_ar) VALUES
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'teacher@vtc.example', 'Mr. Ahmed Saleh', 'أ. أحمد صالح'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a1', 'supervisor@vtc.example', 'Eng. Tamer Hassan', 'م. تامر حسن'),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000a1', 'director@vtc.example', 'Dr. Samia Rashad', 'د. سامية رشاد');
INSERT INTO user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000b3', 'academic_teacher'),
  ('00000000-0000-0000-0000-0000000000b4', 'industry_supervisor'),
  ('00000000-0000-0000-0000-0000000000b5', 'director');

CREATE TEMP TABLE demo_students (no int PRIMARY KEY, id uuid NOT NULL, name text, name_ar text);
INSERT INTO demo_students VALUES
  (1,  '00000000-0000-0000-0000-000000000101', 'Mariam Adel',   'مريم عادل'),
  (2,  '00000000-0000-0000-0000-000000000102', 'Youssef Hamdy', 'يوسف حمدي'),
  (3,  '00000000-0000-0000-0000-000000000103', 'Nour El-Sayed', 'نور السيد'),
  (4,  '00000000-0000-0000-0000-0000000000b1', 'Omar Lotfy',    'عمر لطفي'),
  (5,  '00000000-0000-0000-0000-000000000105', 'Karim Fathy',   'كريم فتحي'),
  (6,  '00000000-0000-0000-0000-000000000106', 'Salma Mostafa', 'سلمى مصطفى'),
  (7,  '00000000-0000-0000-0000-000000000107', 'Ahmed Ragab',   'أحمد رجب'),
  (8,  '00000000-0000-0000-0000-000000000108', 'Habiba Samir',  'حبيبة سمير'),
  (9,  '00000000-0000-0000-0000-000000000109', 'Mostafa Zaki',  'مصطفى زكي'),
  (10, '00000000-0000-0000-0000-000000000110', 'Laila Farouk',  'ليلى فاروق'),
  (11, '00000000-0000-0000-0000-000000000111', 'Tarek Nabil',   'طارق نبيل'),
  (12, '00000000-0000-0000-0000-000000000112', 'Yasmin Hosny',  'ياسمين حسني');

INSERT INTO users (id, institution_id, email, full_name, full_name_ar, safety_badge_uid)
SELECT id, '00000000-0000-0000-0000-0000000000a1', 'learner' || lpad(no::text, 2, '0') || '@vtc.example', name, name_ar,
       'RFID-1' || lpad(no::text, 3, '0')
  FROM demo_students WHERE no <> 4;
INSERT INTO user_roles (user_id, role) SELECT id, 'student' FROM demo_students WHERE no <> 4;

-- Everyone signs in with the same demo password (bcrypt via pgcrypto).
UPDATE users SET password_hash = crypt('demo1234', gen_salt('bf', 8))
 WHERE institution_id = '00000000-0000-0000-0000-0000000000a1';

INSERT INTO cohorts (id, institution_id, name, name_ar, trade, starts_on, ends_on) VALUES
  ('00000000-0000-0000-0000-00000000c0b2', '00000000-0000-0000-0000-0000000000a1', 'Mechatronics Y2-B',
   'ميكاترونكس، السنة الثانية ب', 'Mechatronics', '2025-09-15', '2027-06-30');
INSERT INTO cohort_members (cohort_id, user_id, member_role)
SELECT '00000000-0000-0000-0000-00000000c0b2', id, 'student' FROM demo_students;
INSERT INTO cohort_members (cohort_id, user_id, member_role) VALUES
  ('00000000-0000-0000-0000-00000000c0b2', '00000000-0000-0000-0000-0000000000b2', 'vocational_trainer'),
  ('00000000-0000-0000-0000-00000000c0b2', '00000000-0000-0000-0000-0000000000b3', 'academic_teacher');

-- ---------------------------------------------------------------------------
-- Competencies
-- ---------------------------------------------------------------------------
UPDATE competencies SET title_ar = 'تشخيص أعطال دوائر تحكم المحركات' WHERE id = '00000000-0000-0000-0000-0000000000c1';
UPDATE competencies SET title_ar = 'تطبيق العزل الآمن (LOTO) قبل العمل' WHERE id = '00000000-0000-0000-0000-0000000000c2';
UPDATE competencies SET title_ar = 'تحديد المكوّن المعطوب' WHERE id = '00000000-0000-0000-0000-0000000000c3';

INSERT INTO competencies (id, framework_id, parent_id, code, title, title_ar, kind, is_safety_critical, nominal_hours) VALUES
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c0', NULL, 'ELEC-L3-U01',
   'Apply safe working practices in the workshop', 'تطبيق ممارسات العمل الآمن في الورشة', 'unit', true, 30),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c4', 'ELEC-L3-U01-E1',
   'Select and wear the right PPE', 'اختيار معدات الوقاية المناسبة وارتداؤها', 'element', true, NULL),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c4', 'ELEC-L3-U01-E2',
   'Operate machines with guards in place', 'تشغيل الماكينات والواقيات في مكانها', 'element', true, NULL),
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000c0', NULL, 'ELEC-L3-U03',
   'Measure and test electrical circuits', 'قياس واختبار الدوائر الكهربائية', 'unit', false, 45),
  ('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c7', 'ELEC-L3-U03-E1',
   'Use a multimeter safely and accurately', 'استخدام جهاز القياس المتعدد بأمان ودقة', 'element', false, NULL);
UPDATE competencies SET nominal_hours = 60 WHERE id = '00000000-0000-0000-0000-0000000000c1';

INSERT INTO competency_frameworks (id, code, title, issuing_body, version, effective_from) VALUES
  ('00000000-0000-0000-0000-0000000000ca', 'NTQF-MECH-L3', 'Mechatronics & Machining L3', 'National Qualifications Authority', '2026.1', '2026-01-01');
INSERT INTO competencies (id, framework_id, parent_id, code, title, title_ar, kind, is_safety_critical, nominal_hours) VALUES
  ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-0000000000ca', NULL, 'MECH-L3-U05',
   'Turn components on a CNC lathe', 'خراطة القطع على مخرطة CNC', 'unit', false, 90),
  ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000cb', 'MECH-L3-U05-E1',
   'Set up the lathe and workholding', 'ضبط المخرطة وتثبيت المشغولة', 'element', false, NULL),
  ('00000000-0000-0000-0000-0000000000cd', '00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000cb', 'MECH-L3-U05-E2',
   'Machine to drawing tolerance', 'التشغيل ضمن تفاوتات الرسم', 'element', false, NULL),
  ('00000000-0000-0000-0000-0000000000ce', '00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000cb', 'MECH-L3-U05-E3',
   'Achieve the specified surface finish', 'تحقيق جودة السطح المطلوبة', 'element', false, NULL);

INSERT INTO micro_credentials (id, code, title, required_competency_ids, min_level) VALUES
  ('00000000-0000-0000-0000-0000000000cf', 'MC-SAFE-ISO', 'Safe Isolation (LOTO) Practitioner',
   ARRAY['00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c5']::uuid[], 'autonomous');

-- ---------------------------------------------------------------------------
-- Labs and rubrics
-- ---------------------------------------------------------------------------
UPDATE virtual_labs SET title_ar = 'تشخيص أعطال بادئ المحرك المباشر DOL' WHERE id = '00000000-0000-0000-0000-0000000000d1';
-- The seeded exam session would have timed out by now; the demo starts fresh ones.
UPDATE virtual_lab_sessions SET status = 'aborted' WHERE id = '00000000-0000-0000-0000-0000000000f1';

-- Floor-observation rubric for job card JC-118 (Ø25 h7 shaft: 24.979–25.000 mm).
INSERT INTO rubrics (id, code, title, pass_threshold) VALUES
  ('00000000-0000-0000-0000-0000000000e3', 'RB-JC-118', 'JC-118 Turn Ø25 h7 shaft, Ra 1.6', 70);
INSERT INTO rubric_criteria (rubric_id, key, label, weight, is_gate, competency_id, scoring) VALUES
  ('00000000-0000-0000-0000-0000000000e3', 'ppe', 'PPE worn (glasses, boots, no loose sleeves)', 5, true,
   '00000000-0000-0000-0000-0000000000c5', '{"rule":"check","objectRef":"ppe"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'safe_op', 'Safe operation (guard closed, chuck key removed)', 5, true,
   '00000000-0000-0000-0000-0000000000c6', '{"rule":"check","objectRef":"safe_op"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'setup', 'Machine setup', 20, false,
   '00000000-0000-0000-0000-0000000000cc', '{"rule":"rating","objectRef":"setup"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'dia', 'Diameter Ø25 h7', 35, false,
   '00000000-0000-0000-0000-0000000000cd', '{"rule":"measurement_tolerance","objectRef":"dia","expected":24.9895,"absTol":0.0105}'),
  ('00000000-0000-0000-0000-0000000000e3', 'finish', 'Surface finish Ra 1.6', 25, false,
   '00000000-0000-0000-0000-0000000000ce', '{"rule":"rating","objectRef":"finish"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'housekeeping', 'Housekeeping', 20, false, NULL,
   '{"rule":"rating","objectRef":"housekeeping"}');

-- ---------------------------------------------------------------------------
-- Workshops, assets, consumables
-- ---------------------------------------------------------------------------
INSERT INTO workshops (id, institution_id, name, name_ar, capacity) VALUES
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a1', 'CNC Bay 2', 'ورشة CNC رقم 2', 12),
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000a1', 'Electrical Installations Lab', 'معمل التركيبات الكهربائية', 16);

INSERT INTO workshop_assets (workshop_id, asset_tag, name, category, make_model, status, required_competency_id, hourly_cost, next_service_due, meter_hours)
SELECT '00000000-0000-0000-0000-0000000000d5', 'CNC2-L' || lpad(n::text, 2, '0'), 'CNC lathe ' || n, 'machine', 'Teach-turn 250',
       CASE n WHEN 11 THEN 'maintenance' ELSE 'available' END::asset_status,
       '00000000-0000-0000-0000-0000000000c6', 85, current_date + (n * 9 % 60) - 5, 1200 + n * 37
  FROM generate_series(1, 12) n;
INSERT INTO workshop_assets (workshop_id, asset_tag, name, category, make_model, digital_twin_lab_id, status, required_competency_id, hourly_cost, next_service_due)
SELECT '00000000-0000-0000-0000-0000000000d6', 'ELEC-DOL-' || lpad(n::text, 2, '0'), 'DOL starter training rig ' || n, 'machine', 'Rig DOL-4kW',
       '00000000-0000-0000-0000-0000000000d1', 'available', '00000000-0000-0000-0000-0000000000c2', 40, current_date + 30 * n
  FROM generate_series(1, 4) n;
INSERT INTO workshop_assets (workshop_id, asset_tag, name, category, make_model, status) VALUES
  ('00000000-0000-0000-0000-0000000000d5', 'CNC2-MIC-01', 'Outside micrometer 0–25 mm', 'instrument', 'Mitutoyo-type 0.001', 'available'),
  ('00000000-0000-0000-0000-0000000000d5', 'CNC2-RA-01', 'Surface roughness tester', 'instrument', 'Ra/Rz portable', 'available'),
  ('00000000-0000-0000-0000-0000000000d6', 'ELEC-MM-01', 'CAT III multimeter', 'instrument', '1000 V CAT III', 'available');

-- Lathe bookings: weekday sessions over the last 30 days drive the utilisation view.
INSERT INTO asset_bookings (asset_id, booked_by, cohort_id, during, purpose)
SELECT a.id, '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000c0b2',
       tstzrange(d + time '08:00', d + time '08:00' + make_interval(hours => CASE WHEN a.asset_tag IN ('CNC2-L01', 'CNC2-L02') THEN 8 ELSE 3 + (abs(hashtext(a.asset_tag || d::text)) % 5) END)),
       'JC-118 practical'
  FROM workshop_assets a
 CROSS JOIN generate_series(current_date - 30, current_date - 1, interval '1 day') d
 WHERE a.asset_tag LIKE 'CNC2-L%' AND extract(isodow FROM d) NOT IN (5, 6)   -- Friday/Saturday weekend
   AND (a.asset_tag IN ('CNC2-L01', 'CNC2-L02') OR abs(hashtext(a.asset_tag || d::text)) % 10 < 8);

-- Today's floor: who is on which lathe (open checkouts).
INSERT INTO asset_checkouts (asset_id, user_id, approved_by, checked_out_at, access_granted, condition_out)
SELECT a.id, s.id, '00000000-0000-0000-0000-0000000000b2', now() - interval '90 minutes', true, 'OK'
  FROM demo_students s JOIN workshop_assets a ON a.asset_tag = 'CNC2-L' || lpad(s.no::text, 2, '0')
 WHERE s.no NOT IN (7, 11);
-- Lathe 11 is in maintenance, so Tarek's badge tap was refused.
INSERT INTO asset_checkouts (asset_id, user_id, checked_out_at, returned_at, access_granted, denial_reason)
SELECT a.id, '00000000-0000-0000-0000-000000000111', now() - interval '80 minutes', now() - interval '80 minutes', false, 'Asset in maintenance'
  FROM workshop_assets a WHERE a.asset_tag = 'CNC2-L11';

INSERT INTO consumables (workshop_id, sku, name, unit, on_hand, reorder_point, hazard_class) VALUES
  ('00000000-0000-0000-0000-0000000000d5', 'BAR-C45-30', 'C45 bar stock Ø30', 'm', 4.2, 5, NULL),
  ('00000000-0000-0000-0000-0000000000d5', 'INS-CNMG-12', 'CNMG 120408 turning inserts', 'pcs', 46, 20, NULL),
  ('00000000-0000-0000-0000-0000000000d5', 'CUT-FLUID-5', 'Soluble cutting fluid', 'L', 18, 10, 'H319'),
  ('00000000-0000-0000-0000-0000000000d6', 'FUSE-2A-10', 'Control fuse 2 A gG', 'pcs', 9, 12, NULL),
  ('00000000-0000-0000-0000-0000000000d6', 'CONT-9A', 'Contactor 9 A 230 V coil', 'pcs', 6, 4, NULL);

-- ---------------------------------------------------------------------------
-- Assessment history (last three weeks)
-- ---------------------------------------------------------------------------
-- V-Lab exam attempts: one or two per learner. Scores are deterministic per learner.
CREATE TEMP TABLE demo_attempts AS
SELECT s.id AS learner_id, s.no, k,
       now() - make_interval(days => 2 + ((s.no * 5 + k * 3) % 18), hours => (s.no + k) % 6) AS started_at,
       CASE WHEN s.no IN (5) AND k = 1 THEN 61
            WHEN s.no IN (11) THEN 48 + k * 6
            ELSE 62 + (abs(hashtext(s.name || k)) % 36) END::numeric AS score,
       (s.no = 5 AND k = 1) OR (s.no = 11 AND k = 1) AS gate_failed
  FROM demo_students s CROSS JOIN generate_series(1, 2) k
 WHERE k = 1 OR s.no % 3 <> 0;

INSERT INTO virtual_lab_sessions (id, lab_id, learner_id, mode, rubric_id, injected_fault_ids, injected_by, device, status,
                                  started_at, submitted_at, time_limit_s, final_score, passed)
SELECT md5('vlab' || learner_id || k)::uuid, '00000000-0000-0000-0000-0000000000d1', learner_id, 'assessment',
       '00000000-0000-0000-0000-0000000000e1',
       ARRAY[(SELECT id FROM lab_faults WHERE lab_id = '00000000-0000-0000-0000-0000000000d1' ORDER BY code OFFSET (no + k) % 4 LIMIT 1)],
       '00000000-0000-0000-0000-0000000000b2', 'browser', 'evaluated', started_at,
       started_at + make_interval(secs => 600 + (no * 97 % 900)), 1800, score, score >= 70 AND NOT gate_failed
  FROM demo_attempts;

INSERT INTO rubric_evaluations (rubric_id, subject_type, subject_id, learner_id, evaluator_id, criterion_scores, total_score, passed, gate_failures, evaluated_at)
SELECT '00000000-0000-0000-0000-0000000000e1', 'vlab_session', md5('vlab' || learner_id || k)::uuid, learner_id, NULL,
       '{}'::jsonb, score, score >= 70 AND NOT gate_failed,
       CASE WHEN gate_failed THEN ARRAY['loto'] ELSE '{}' END,
       started_at + make_interval(secs => 600 + (no * 97 % 900))
  FROM demo_attempts;

-- Floor observations on JC-118 for learners who finished.
INSERT INTO workshop_observations (id, learner_id, trainer_id, asset_id, rubric_id, task_ref, observed_at, measurements)
SELECT md5('obs' || s.id)::uuid, s.id, '00000000-0000-0000-0000-0000000000b2',
       (SELECT id FROM workshop_assets WHERE asset_tag = 'CNC2-L' || lpad(s.no::text, 2, '0')),
       '00000000-0000-0000-0000-0000000000e3', 'JC-118',
       CASE WHEN s.no IN (1, 9) THEN now() - interval '40 minutes' ELSE now() - make_interval(days => 3 + s.no % 7) END,
       jsonb_build_object('dia', 24.980 + (s.no % 4) * 0.006)
  FROM demo_students s WHERE s.no IN (1, 2, 3, 6, 8, 9, 10, 12);
INSERT INTO rubric_evaluations (rubric_id, subject_type, subject_id, learner_id, evaluator_id, criterion_scores, total_score, passed, gate_failures, evaluated_at)
SELECT '00000000-0000-0000-0000-0000000000e3', 'workshop_observation', o.id, o.learner_id, o.trainer_id, '{}'::jsonb,
       CASE s.no WHEN 1 THEN 91 WHEN 9 THEN 78 ELSE 70 + abs(hashtext(s.name)) % 26 END, true, '{}', o.observed_at
  FROM workshop_observations o JOIN demo_students s ON s.id = o.learner_id;

-- Competency profile: levels per learner per element, deterministic spread.
INSERT INTO learner_competencies (learner_id, competency_id, level, score, evidence_count, last_assessed_at, verified_by)
SELECT s.id, c.id,
       (ARRAY['not_yet', 'novice', 'intermediate', 'intermediate', 'autonomous', 'autonomous', 'master'])
         [LEAST(7, GREATEST(1, 1 + (abs(hashtext(s.name || c.code)) % 7) - CASE WHEN s.no = 11 THEN 2 ELSE 0 END
            + CASE WHEN s.no IN (1, 9) THEN 1 ELSE 0 END))]::proficiency_level,
       45 + abs(hashtext(c.code || s.name)) % 55, 1 + abs(hashtext(s.name)) % 4,
       now() - make_interval(days => abs(hashtext(c.code || s.no)) % 20),
       CASE WHEN abs(hashtext(s.name || c.code)) % 7 = 6 THEN '00000000-0000-0000-0000-0000000000b4'::uuid END
  FROM demo_students s CROSS JOIN competencies c
 WHERE c.kind = 'element' AND (s.no <> 11 OR abs(hashtext(c.code)) % 3 <> 0)
ON CONFLICT DO NOTHING;
-- 'master' needs workplace verification: anything not verified by the supervisor is capped.
UPDATE learner_competencies SET level = 'autonomous' WHERE level = 'master' AND verified_by IS NULL;
-- The safety units are what the RFID interlock checks; Tarek is still working on them.
UPDATE learner_competencies SET level = 'novice'
 WHERE learner_id = '00000000-0000-0000-0000-000000000111' AND competency_id IN
       ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000c2');

INSERT INTO learner_credentials (learner_id, credential_id, issued_at)
SELECT lc.learner_id, '00000000-0000-0000-0000-0000000000cf', now() - interval '6 days'
  FROM learner_competencies lc
 WHERE lc.competency_id IN ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c5')
   AND lc.level IN ('autonomous', 'master')
 GROUP BY lc.learner_id HAVING count(*) = 2;

-- Safety alerts: one open (today), the rest resolved.
INSERT INTO safety_alerts (institution_id, learner_id, source, criterion_key, detail, raised_at, resolved_by, resolved_at, resolution) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000105', 'rfid', 'safe_op',
   'Guard open while spindle running on CNC2-L05', now() - interval '25 minutes', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000105', 'vlab', 'loto',
   'panel_opened before loto_applied', now() - interval '9 days', '00000000-0000-0000-0000-0000000000b2', now() - interval '9 days',
   'Re-briefed on safe isolation; re-sit booked'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000111', 'vlab', 'loto',
   'component_replaced before loto_applied', now() - interval '12 days', '00000000-0000-0000-0000-0000000000b2', now() - interval '12 days',
   'Guided-mode practice assigned'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000107', 'observation', 'ppe',
   'PPE worn (glasses, boots, no loose sleeves) not met on JC-118', now() - interval '15 days', '00000000-0000-0000-0000-0000000000b2',
   now() - interval '15 days', 'Sent to stores for safety glasses');

-- ---------------------------------------------------------------------------
-- Work-based learning
-- ---------------------------------------------------------------------------
INSERT INTO employers (id, name, sector) VALUES
  ('00000000-0000-0000-0000-0000000000e5', 'Nile Electro-Mechanical Co.', 'Industrial maintenance');
INSERT INTO employer_sites (id, employer_id, name, latitude, longitude, geofence_radius_m) VALUES
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000e5', '10th of Ramadan plant, Hall C', 30.2935, 31.7432, 200);

INSERT INTO wbl_placements (id, learner_id, site_id, supervisor_id, coordinator_id, starts_on, ends_on, required_hours)
SELECT md5('placement' || s.id)::uuid, s.id, '00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000b4',
       '00000000-0000-0000-0000-0000000000b2', current_date - 56, current_date + 70, 240
  FROM demo_students s WHERE s.no IN (4, 1, 6, 9);

CREATE TEMP TABLE demo_tasks (i int, summary text);
INSERT INTO demo_tasks VALUES
  (0, 'Assisted with LOTO and fault-finding on conveyor 3 DOL starter; overload relay replaced'),
  (1, 'Preventive maintenance on hall C extraction fan motors: insulation resistance tests'),
  (2, 'Rewired a star-delta starter panel under supervision; continuity and IR tested'),
  (3, 'Thermographic survey of MCC-2 with the maintenance engineer; logged two hot joints'),
  (4, 'Replaced proximity sensors on packing line 1; verified PLC inputs'),
  (5, 'Toolbox talk on arc-flash PPE; inspected and tagged portable tools');

-- Two days a week on placement; older entries approved, the last few awaiting sign-off.
INSERT INTO wbl_logbook_entries (id, placement_id, work_date, hours, task_summary, competency_ids, status, submitted_at)
SELECT md5('log' || p.id || d)::uuid, p.id, d::date, 6 + (abs(hashtext(p.id::text || d::text)) % 3),
       t.summary,
       ARRAY['00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3']::uuid[],
       'submitted', d + interval '17 hours'
  FROM wbl_placements p
 CROSS JOIN generate_series(current_date - 55, current_date - 1, interval '1 day') d
  JOIN demo_tasks t ON t.i = abs(hashtext(p.id::text || d::text)) % 6
 WHERE extract(isodow FROM d) IN (1, 3);

-- Sign-offs: an immutable row per decision; the trigger moves the entry's status.
INSERT INTO wbl_signoffs (entry_id, supervisor_id, decision, rating, comment, signature_hash, signed_at)
SELECT e.id, '00000000-0000-0000-0000-0000000000b4', 'approved', 3 + abs(hashtext(e.id::text)) % 3, NULL,
       encode(digest(e.id::text || e.task_summary || e.hours::text || 'supervisor-b4', 'sha256'), 'hex'),
       e.submitted_at + interval '1 day'
  FROM wbl_logbook_entries e
 WHERE e.work_date < current_date - 7;

INSERT INTO wbl_checkins (placement_id, kind, device_time, latitude, longitude, accuracy_m)
SELECT e.placement_id, 'in', e.work_date + time '07:58', 30.2937, 31.7429, 12
  FROM wbl_logbook_entries e;

-- ---------------------------------------------------------------------------
-- Question bank (theory, authored by the academic teacher)
-- ---------------------------------------------------------------------------
INSERT INTO questions (id, institution_id, type, bloom, status, author_id, ai_generated, reviewed_by) VALUES
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'understand', 'approved', '00000000-0000-0000-0000-0000000000b3', false, NULL),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'apply', 'approved', '00000000-0000-0000-0000-0000000000b3', false, NULL),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'analyze', 'approved', '00000000-0000-0000-0000-0000000000b3', false, NULL),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'remember', 'approved', '00000000-0000-0000-0000-0000000000b3', false, NULL),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000a1', 'calculation', 'apply', 'approved', '00000000-0000-0000-0000-0000000000b3', false, NULL),
  ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'analyze', 'in_review', '00000000-0000-0000-0000-0000000000b3', true, NULL),
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'understand', 'draft', '00000000-0000-0000-0000-0000000000b3', false, NULL);

-- body.options carry {en, ar}; body.stem_ar is the Arabic stem; answer_key is withheld from learners.
INSERT INTO question_versions (question_id, version, stem, body, answer_key, abs_tolerance, max_points) VALUES
  ('00000000-0000-0000-0000-0000000000f2', 1,
   'Why must you prove dead at the load side of the isolator after applying your lock?',
   '{"stem_ar":"لماذا يجب إثبات انعدام الجهد عند مخرج المفصل بعد تركيب القفل؟","options":[
     {"id":"a","en":"Because the lock might not have engaged the isolator","ar":"لأن القفل قد لا يكون فصل المفصل فعليًا"},
     {"id":"b","en":"To check the multimeter battery","ar":"لفحص بطارية جهاز القياس"},
     {"id":"c","en":"It is only needed on DC circuits","ar":"هذا مطلوب في دوائر التيار المستمر فقط"},
     {"id":"d","en":"To measure the motor current","ar":"لقياس تيار المحرك"}]}', '{"correct":"a"}', NULL, 1),
  ('00000000-0000-0000-0000-0000000000f3', 1,
   'A DOL starter does nothing when START is pressed. The control fuse reads 0.4 Ω and S1 reads 0.1 Ω. What do you test next?',
   '{"stem_ar":"بادئ DOL لا يستجيب عند الضغط على START. فيوز التحكم يقرأ 0.4 أوم وS1 يقرأ 0.1 أوم. ما الذي تختبره بعد ذلك؟","options":[
     {"id":"a","en":"The motor windings","ar":"ملفات المحرك"},
     {"id":"b","en":"The overload NC contact 95–96","ar":"تلامس الحمل الزائد NC ‏95–96"},
     {"id":"c","en":"The incoming supply again","ar":"التغذية الداخلة مرة أخرى"},
     {"id":"d","en":"The earth bonding","ar":"توصيل التأريض"}]}', '{"correct":"b"}', NULL, 1),
  ('00000000-0000-0000-0000-0000000000f4', 1,
   'An open-circuit reading (OL) across a healthy NO start button at rest means:',
   '{"stem_ar":"قراءة دائرة مفتوحة (OL) على زر تشغيل NO سليم في وضع السكون تعني:","options":[
     {"id":"a","en":"The button is faulty","ar":"الزر معطوب"},
     {"id":"b","en":"Normal: a normally-open contact is open at rest","ar":"طبيعي: التلامس المفتوح طبيعيًا يكون مفتوحًا في السكون"},
     {"id":"c","en":"The fuse is blown","ar":"الفيوز محروق"},
     {"id":"d","en":"The meter is on the wrong range","ar":"الجهاز على مدى خاطئ"}]}', '{"correct":"b"}', NULL, 1),
  ('00000000-0000-0000-0000-0000000000f5', 1,
   'Which ISO 7010 colour is used for warning signs such as "electrical hazard"?',
   '{"stem_ar":"ما لون ISO 7010 المستخدم في لافتات التحذير مثل «خطر كهربائي»؟","options":[
     {"id":"a","en":"Yellow with black","ar":"أصفر مع أسود"},
     {"id":"b","en":"Blue with white","ar":"أزرق مع أبيض"},
     {"id":"c","en":"Green with white","ar":"أخضر مع أبيض"},
     {"id":"d","en":"Red with white","ar":"أحمر مع أبيض"}]}', '{"correct":"a"}', NULL, 1),
  ('00000000-0000-0000-0000-0000000000f6', 1,
   'A 4 kW, 400 V three-phase motor has a power factor of 0.85 and efficiency of 0.88. Calculate the full-load line current in amps.',
   '{"stem_ar":"محرك ثلاثي الأطوار 4 كيلوواط، 400 فولت، معامل قدرته 0.85 وكفاءته 0.88. احسب تيار الخط عند الحمل الكامل بالأمبير.","unit":"A"}',
   '{"value":7.72}', 0.1, 2),
  ('00000000-0000-0000-0000-0000000000f7', 1,
   'After replacing a tripped overload relay the motor trips again within a minute. What is the most likely cause?',
   '{"stem_ar":"بعد استبدال مرحل حمل زائد فصل، يفصل المحرك مرة أخرى خلال دقيقة. ما السبب الأرجح؟","options":[
     {"id":"a","en":"The new relay is faulty","ar":"المرحل الجديد معطوب"},
     {"id":"b","en":"The motor is overloaded or single-phasing","ar":"المحرك محمّل زيادة أو يعمل على طورين"},
     {"id":"c","en":"The control fuse is too large","ar":"فيوز التحكم أكبر من اللازم"},
     {"id":"d","en":"The START button is sticking","ar":"زر التشغيل عالق"}]}', '{"correct":"b"}', NULL, 1),
  ('00000000-0000-0000-0000-0000000000f8', 1,
   'What does the "h7" in Ø25 h7 specify?',
   '{"stem_ar":"ماذا يحدد الرمز «h7» في Ø25 h7؟","options":[
     {"id":"a","en":"Surface roughness","ar":"خشونة السطح"},
     {"id":"b","en":"The tolerance zone of the shaft diameter","ar":"منطقة التفاوت لقطر العمود"},
     {"id":"c","en":"Material hardness","ar":"صلادة المادة"},
     {"id":"d","en":"Thread pitch","ar":"خطوة السن"}]}', '{"correct":"b"}', NULL, 1);
INSERT INTO question_competencies (question_id, competency_id) VALUES
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c3'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000c8'),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000c5'),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000c8'),
  ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000c3'),
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000cd');
