-- VTC_LMS demo data for the four trades, loaded after demo.sql (SEED_DEMO=true).
--
-- demo.sql set up the CNC cohort and the electrical lab. This adds an
-- automotive, an electrical and a welding cohort with their own trainer,
-- learners, workshop, assets, consumables, observation rubric, V-Lab,
-- questions and three weeks of history, so every screen can be filtered by
-- trade. Every name and number here is illustrative.
--
-- Sign-in (password demo1234): student.auto@, student.elec@, student.weld@,
-- trainer.auto@, trainer.elec@, trainer.weld@ (all @vtc.example). The main
-- trainer@ account leads all four workshops, so it can switch between them.
SET search_path = vtc, public;

-- Rows demo.sql created before trades existed.
SELECT assign_trades();
UPDATE cohorts SET name = 'CNC machining Y2-B', name_ar = 'تشغيل CNC، السنة الثانية ب', trade = 'CNC machining'
 WHERE id = '00000000-0000-0000-0000-00000000c0b2';
UPDATE competency_frameworks SET title = 'CNC Machining & Mechatronics L3' WHERE id = '00000000-0000-0000-0000-0000000000ca';

-- ---------------------------------------------------------------------------
-- Frameworks and competencies
-- ---------------------------------------------------------------------------
INSERT INTO competency_frameworks (id, code, title, issuing_body, version, effective_from, trade_id) VALUES
  ('00000000-0000-0000-0000-0000000002c0', 'NTQF-AUTO-L3', 'Light Vehicle Maintenance & Repair L3', 'National Qualifications Authority', '2026.1', '2026-01-01', 'auto'),
  ('00000000-0000-0000-0000-0000000004c0', 'NTQF-WELD-L3', 'Welding & Fabrication Technician L3', 'National Qualifications Authority', '2026.1', '2026-01-01', 'weld');

-- Ids are derived from the code so later statements can refer to them by code.
CREATE TEMP TABLE demo_comps (framework_id uuid, code text, parent text, title text, title_ar text, safety boolean, hours numeric);
INSERT INTO demo_comps VALUES
  ('00000000-0000-0000-0000-0000000000ca', 'CNC-L3-U06', NULL, 'Diagnose machining quality faults', 'تشخيص أعطال جودة التشغيل', false, 40),
  ('00000000-0000-0000-0000-0000000000ca', 'CNC-L3-U06-E1', 'CNC-L3-U06', 'Lock out the machine before reaching into the work area', 'إيقاف الماكينة وإقفالها قبل مدّ اليد إلى منطقة العمل', true, NULL),
  ('00000000-0000-0000-0000-0000000000ca', 'CNC-L3-U06-E2', 'CNC-L3-U06', 'Trace a dimensional or finish fault to its cause', 'تتبع عيب الأبعاد أو جودة السطح إلى سببه', false, NULL),
  ('00000000-0000-0000-0000-0000000000c0', 'ELEC-L3-U05', NULL, 'Install distribution boards and RCD protection', 'تركيب لوحات التوزيع وحماية RCD', false, 45),
  ('00000000-0000-0000-0000-0000000000c0', 'ELEC-L3-U05-E1', 'ELEC-L3-U05', 'Install a radial circuit to the drawing', 'تركيب دائرة شعاعية حسب المخطط', false, NULL),
  ('00000000-0000-0000-0000-0000000000c0', 'ELEC-L3-U05-E2', 'ELEC-L3-U05', 'Test earth continuity and RCD trip time', 'اختبار استمرارية الأرضي وزمن فصل RCD', false, NULL),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U01', NULL, 'Work safely on vehicles', 'العمل الآمن على المركبات', true, 20),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U01-E1', 'AUTO-L3-U01', 'Secure the vehicle on the lift or axle stands', 'تأمين المركبة على الرافعة أو حوامل المحاور', true, NULL),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U01-E2', 'AUTO-L3-U01', 'Wear PPE and handle fluids safely', 'ارتداء معدات الوقاية والتعامل الآمن مع السوائل', true, NULL),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U03', NULL, 'Service braking systems', 'صيانة أنظمة الفرامل', false, 40),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U03-E1', 'AUTO-L3-U03', 'Replace brake pads to the manufacturer''s specification', 'تغيير تيل الفرامل حسب مواصفات الشركة المصنعة', false, NULL),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U03-E2', 'AUTO-L3-U03', 'Measure disc runout and thickness', 'قياس انحراف الطنبورة وسمكها', false, NULL),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U04', NULL, 'Diagnose starting and charging circuit faults', 'تشخيص أعطال دوائر البدء والشحن', false, 50),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U04-E1', 'AUTO-L3-U04', 'Isolate the battery before working on the starter circuit', 'فصل البطارية قبل العمل على دائرة البادئ', true, NULL),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U04-E2', 'AUTO-L3-U04', 'Locate the faulty part in the starting circuit', 'تحديد القطعة المعطوبة في دائرة البدء', false, NULL),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U05', NULL, 'Use engine management diagnostics (OBD-II)', 'استخدام تشخيص إدارة المحرك (OBD-II)', false, 45),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U05-E1', 'AUTO-L3-U05', 'Read and interpret OBD-II fault codes', 'قراءة أكواد أعطال OBD-II وتفسيرها', false, NULL),
  ('00000000-0000-0000-0000-0000000002c0', 'AUTO-L3-U05-E2', 'AUTO-L3-U05', 'Test engine sensors with a multimeter', 'اختبار حساسات المحرك بجهاز القياس', false, NULL),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U01', NULL, 'Work safely in hot-work areas', 'العمل الآمن في مناطق الأعمال الساخنة', true, 20),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U01-E1', 'WELD-L3-U01', 'Set up fume extraction and welding screens', 'تجهيز شفط الأبخرة وستائر اللحام', true, NULL),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U01-E2', 'WELD-L3-U01', 'Select and wear welding PPE', 'اختيار معدات وقاية اللحام وارتداؤها', true, NULL),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U02', NULL, 'Read weld symbols and drawings', 'قراءة رموز اللحام والرسومات', false, 20),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U02-E1', 'WELD-L3-U02', 'Interpret ISO 2553 weld symbols', 'تفسير رموز اللحام وفق ISO 2553', false, NULL),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U04', NULL, 'Weld plate with MIG/MAG', 'لحام الألواح بطريقة MIG/MAG', false, 80),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U04-E1', 'WELD-L3-U04', 'Set wire feed, voltage and gas for the joint', 'ضبط تغذية السلك والجهد والغاز للوصلة', false, NULL),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U04-E2', 'WELD-L3-U04', 'Weld a fillet joint in PB to size', 'لحام وصلة زاوية في وضع PB بالمقاس المطلوب', false, NULL),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U06', NULL, 'Diagnose weld defects and equipment faults', 'تشخيص عيوب اللحام وأعطال المعدات', false, 30),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U06-E1', 'WELD-L3-U06', 'Isolate the welder before opening the wire feeder', 'فصل ماكينة اللحام قبل فتح وحدة تغذية السلك', true, NULL),
  ('00000000-0000-0000-0000-0000000004c0', 'WELD-L3-U06-E2', 'WELD-L3-U06', 'Trace a weld defect to its cause', 'تتبع عيب اللحام إلى سببه', false, NULL);
INSERT INTO competencies (id, framework_id, parent_id, code, title, title_ar, kind, is_safety_critical, nominal_hours)
SELECT md5('vtc-comp-' || code)::uuid, framework_id, NULL, code, title, title_ar, 'unit', safety, hours FROM demo_comps WHERE parent IS NULL;
INSERT INTO competencies (id, framework_id, parent_id, code, title, title_ar, kind, is_safety_critical, nominal_hours)
SELECT md5('vtc-comp-' || code)::uuid, framework_id, md5('vtc-comp-' || parent)::uuid, code, title, title_ar, 'element', safety, hours
  FROM demo_comps WHERE parent IS NOT NULL;

-- ---------------------------------------------------------------------------
-- People: a trainer and a cohort per trade
-- ---------------------------------------------------------------------------
INSERT INTO users (id, institution_id, email, full_name, full_name_ar) VALUES
  ('00000000-0000-0000-0000-0000000002b2', '00000000-0000-0000-0000-0000000000a1', 'trainer.auto@vtc.example', 'Eng. Tamer Saleh', 'م. تامر صالح'),
  ('00000000-0000-0000-0000-0000000003b2', '00000000-0000-0000-0000-0000000000a1', 'trainer.elec@vtc.example', 'Eng. Mahmoud Fawzy', 'م. محمود فوزي'),
  ('00000000-0000-0000-0000-0000000004b2', '00000000-0000-0000-0000-0000000000a1', 'trainer.weld@vtc.example', 'Eng. Sherif Ali', 'م. شريف علي');
INSERT INTO user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000002b2', 'vocational_trainer'),
  ('00000000-0000-0000-0000-0000000003b2', 'vocational_trainer'),
  ('00000000-0000-0000-0000-0000000004b2', 'vocational_trainer');

CREATE TEMP TABLE demo_cohorts (trade text PRIMARY KEY, cohort uuid, trainer uuid, workshop uuid, prefix int, name text, name_ar text, starts date);
INSERT INTO demo_cohorts VALUES
  ('auto', '00000000-0000-0000-0000-0000000002cb', '00000000-0000-0000-0000-0000000002b2', '00000000-0000-0000-0000-0000000002d5', 2,
   'Automotive mechanics Y2-A', 'ميكانيكا السيارات، السنة الثانية أ', '2025-09-15'),
  ('elec', '00000000-0000-0000-0000-0000000003cb', '00000000-0000-0000-0000-0000000003b2', '00000000-0000-0000-0000-0000000000d6', 3,
   'Electrical installation Y2-A', 'التركيبات الكهربائية، السنة الثانية أ', '2025-09-15'),
  ('weld', '00000000-0000-0000-0000-0000000004cb', '00000000-0000-0000-0000-0000000004b2', '00000000-0000-0000-0000-0000000004d5', 4,
   'Welding & fabrication Y1-C', 'اللحام والتشكيل، السنة الأولى ج', '2026-09-14');

CREATE TEMP TABLE demo_trade_students (trade text, no int, id uuid, name text, name_ar text, PRIMARY KEY (trade, no));
INSERT INTO demo_trade_students (trade, no, name, name_ar) VALUES
  ('auto', 1, 'Ziad Hassan', 'زياد حسن'), ('auto', 2, 'Malak Fouad', 'ملك فؤاد'), ('auto', 3, 'Bassem Nagy', 'باسم ناجي'),
  ('auto', 4, 'Hana Reda', 'هنا رضا'), ('auto', 5, 'Seif Magdy', 'سيف مجدي'), ('auto', 6, 'Nadine Kamel', 'نادين كامل'),
  ('auto', 7, 'Adham Yassin', 'أدهم ياسين'), ('auto', 8, 'Rawan Helmy', 'روان حلمي'),
  ('elec', 1, 'Rana Ibrahim', 'رنا إبراهيم'), ('elec', 2, 'Hazem Adly', 'حازم عدلي'), ('elec', 3, 'Mona Shaker', 'منى شاكر'),
  ('elec', 4, 'Islam Badr', 'إسلام بدر'), ('elec', 5, 'Dina Hamed', 'دينا حامد'), ('elec', 6, 'Sherif Wagdy', 'شريف وجدي'),
  ('elec', 7, 'Aya Mounir', 'آية منير'), ('elec', 8, 'Khaled Osman', 'خالد عثمان'), ('elec', 9, 'Farida Sami', 'فريدة سامي'),
  ('elec', 10, 'Amr Tawfik', 'عمرو توفيق'),
  ('weld', 1, 'Hassan Gamal', 'حسن جمال'), ('weld', 2, 'Mohamed Saber', 'محمد صابر'), ('weld', 3, 'Ali Mahmoud', 'علي محمود'),
  ('weld', 4, 'Eman Fekry', 'إيمان فكري'), ('weld', 5, 'Waleed Hany', 'وليد هاني'), ('weld', 6, 'Mahmoud Essam', 'محمود عصام'),
  ('weld', 7, 'Reem Ashraf', 'ريم أشرف'), ('weld', 8, 'Ibrahim Said', 'إبراهيم سعيد');
UPDATE demo_trade_students s SET id = ('00000000-0000-0000-0000-000000000' || c.prefix || lpad(s.no::text, 2, '0'))::uuid
  FROM demo_cohorts c WHERE c.trade = s.trade;

-- Learner 1 of each trade has an easy address (student.auto@…); the rest are learner.auto02@… and so on.
INSERT INTO users (id, institution_id, email, full_name, full_name_ar, safety_badge_uid)
SELECT id, '00000000-0000-0000-0000-0000000000a1',
       CASE WHEN no = 1 THEN 'student.' || trade ELSE 'learner.' || trade || lpad(no::text, 2, '0') END || '@vtc.example',
       name, name_ar, 'RFID-' || upper(trade) || lpad(no::text, 3, '0')
  FROM demo_trade_students;
INSERT INTO user_roles (user_id, role) SELECT id, 'student'::user_role FROM demo_trade_students;
UPDATE users SET password_hash = crypt('demo1234', gen_salt('bf', 8))
 WHERE institution_id = '00000000-0000-0000-0000-0000000000a1' AND password_hash IS NULL;

INSERT INTO cohorts (id, institution_id, name, name_ar, trade, trade_id, starts_on, ends_on)
SELECT cohort, '00000000-0000-0000-0000-0000000000a1', name, name_ar, initcap(trade), trade, starts, starts + 650 FROM demo_cohorts;
INSERT INTO cohort_members (cohort_id, user_id, member_role)
SELECT c.cohort, s.id, 'student'::user_role FROM demo_trade_students s JOIN demo_cohorts c USING (trade);
-- Each trade's own trainer, plus the lead trainer (trainer@) and the academic teacher across all four.
INSERT INTO cohort_members (cohort_id, user_id, member_role)
SELECT cohort, trainer, 'vocational_trainer'::user_role FROM demo_cohorts
UNION ALL SELECT cohort, '00000000-0000-0000-0000-0000000000b2', 'vocational_trainer' FROM demo_cohorts
UNION ALL SELECT cohort, '00000000-0000-0000-0000-0000000000b3', 'academic_teacher' FROM demo_cohorts;

-- ---------------------------------------------------------------------------
-- Workshops, assets, consumables
-- ---------------------------------------------------------------------------
INSERT INTO workshops (id, institution_id, name, name_ar, capacity, trade_id) VALUES
  ('00000000-0000-0000-0000-0000000002d5', '00000000-0000-0000-0000-0000000000a1', 'Auto Bay 1 · light vehicles', 'ورشة السيارات 1 · مركبات خفيفة', 8, 'auto'),
  ('00000000-0000-0000-0000-0000000004d5', '00000000-0000-0000-0000-0000000000a1', 'Welding Bay 3', 'ورشة اللحام 3', 8, 'weld');
UPDATE workshops SET name = 'Electrical Lab 1', name_ar = 'معمل الكهرباء 1', capacity = 16 WHERE id = '00000000-0000-0000-0000-0000000000d6';

-- One station per learner (bay, wiring booth or welding booth), like the CNC lathes.
INSERT INTO workshop_assets (workshop_id, asset_tag, name, category, make_model, status, required_competency_id, hourly_cost, next_service_due, meter_hours)
SELECT c.workshop,
       CASE c.trade WHEN 'auto' THEN 'AUTO1-B' WHEN 'elec' THEN 'ELEC-BTH-' ELSE 'WELD3-B' END || lpad(s.no::text, 2, '0'),
       CASE c.trade WHEN 'auto' THEN 'Vehicle bay ' WHEN 'elec' THEN 'Wiring booth ' ELSE 'MIG welding booth ' END || s.no,
       'machine',
       CASE c.trade WHEN 'auto' THEN 'Training car + 2-post lift' WHEN 'elec' THEN 'Wiring board 1.2 × 2.4 m' ELSE 'MIG 250 A + extraction arm' END,
       'available',
       CASE c.trade WHEN 'auto' THEN md5('vtc-comp-AUTO-L3-U01-E1')::uuid WHEN 'elec' THEN '00000000-0000-0000-0000-0000000000c2'::uuid
            ELSE md5('vtc-comp-WELD-L3-U01-E2')::uuid END,
       CASE c.trade WHEN 'auto' THEN 70 WHEN 'elec' THEN 30 ELSE 55 END, current_date + (s.no * 11 % 70) - 6, 400 + s.no * 53
  FROM demo_trade_students s JOIN demo_cohorts c USING (trade);
INSERT INTO workshop_assets (workshop_id, asset_tag, name, category, make_model, status, hourly_cost, next_service_due) VALUES
  ('00000000-0000-0000-0000-0000000002d5', 'OBD-02', 'OBD-II diagnostic scanner', 'instrument', 'Multi-brand scan tool', 'available', 15, current_date + 120),
  ('00000000-0000-0000-0000-0000000002d5', 'ENG-R3', 'Engine run stand', 'machine', '1.6 L petrol, instrumented', 'available', 40, current_date + 45),
  ('00000000-0000-0000-0000-0000000002d5', 'ALIGN-01', 'Wheel alignment rig', 'machine', '3D camera aligner', 'available', 60, current_date + 200),
  ('00000000-0000-0000-0000-0000000002d5', 'AUTO-DTI-01', 'Dial indicator with magnetic base', 'instrument', '0.01 mm', 'available', NULL, NULL),
  ('00000000-0000-0000-0000-0000000000d6', 'MFT-03', 'Multifunction installation tester', 'instrument', 'IEC 61557 MFT', 'available', 10, current_date + 90),
  ('00000000-0000-0000-0000-0000000004d5', 'TIG-01', 'TIG welding booth', 'machine', 'AC/DC TIG 200 A', 'available', 55, current_date + 60),
  ('00000000-0000-0000-0000-0000000004d5', 'PLAS-01', 'Plasma cutter', 'machine', '45 A air plasma', 'available', 35, current_date + 30),
  ('00000000-0000-0000-0000-0000000004d5', 'WELD-GAUGE-01', 'Fillet weld gauge set', 'instrument', '3–25 mm', 'available', NULL, NULL);

-- Bookings over the last 30 days: the first two stations of each trade run near capacity.
INSERT INTO asset_bookings (asset_id, booked_by, cohort_id, during, purpose)
SELECT a.id, c.trainer, c.cohort,
       tstzrange(d + time '08:00', d + time '08:00' + make_interval(hours => CASE WHEN right(a.asset_tag, 2) IN ('01', '02') THEN 7 + (c.prefix % 2)
                                                                             ELSE 2 + (abs(hashtext(a.asset_tag || d::text)) % 5) END)),
       'Practical session'
  FROM demo_cohorts c JOIN workshop_assets a ON a.workshop_id = c.workshop AND a.category = 'machine'
                                              AND a.asset_tag ~ '^(AUTO1-B|ELEC-BTH-|WELD3-B|TIG-|PLAS-|ENG-|ALIGN-)'
 CROSS JOIN generate_series(current_date - 30, current_date - 1, interval '1 day') d
 WHERE extract(isodow FROM d) NOT IN (5, 6)
   AND (right(a.asset_tag, 2) IN ('01', '02') AND a.asset_tag !~ '^(TIG|PLAS|ALIGN)' OR abs(hashtext(a.asset_tag || d::text)) % 10 < 6);

-- Today's floor: who is at which station.
INSERT INTO asset_checkouts (asset_id, user_id, approved_by, checked_out_at, access_granted, condition_out)
SELECT a.id, s.id, c.trainer, now() - interval '75 minutes', true, 'OK'
  FROM demo_trade_students s JOIN demo_cohorts c USING (trade)
  JOIN workshop_assets a ON a.asset_tag = CASE c.trade WHEN 'auto' THEN 'AUTO1-B' WHEN 'elec' THEN 'ELEC-BTH-' ELSE 'WELD3-B' END || lpad(s.no::text, 2, '0')
 WHERE (s.trade, s.no) NOT IN (('auto', 6), ('elec', 6), ('weld', 6));

INSERT INTO consumables (workshop_id, sku, name, unit, on_hand, reorder_point, hazard_class) VALUES
  ('00000000-0000-0000-0000-0000000002d5', 'OIL-5W30', 'Engine oil 5W-30', 'L', 38, 40, NULL),
  ('00000000-0000-0000-0000-0000000002d5', 'PAD-F-SET', 'Front brake pad sets', 'sets', 9, 6, NULL),
  ('00000000-0000-0000-0000-0000000002d5', 'FUSE-30A', '30 A blade fuses', 'pcs', 25, 10, NULL),
  ('00000000-0000-0000-0000-0000000002d5', 'BRK-FLUID', 'Brake fluid DOT 4', 'L', 6, 4, 'H319'),
  ('00000000-0000-0000-0000-0000000000d6', 'CBL-TE-2.5', '2.5 mm² twin & earth cable', 'm', 42, 100, NULL),
  ('00000000-0000-0000-0000-0000000000d6', 'LOTO-TAG', 'LOTO tags', 'pcs', 18, 20, NULL),
  ('00000000-0000-0000-0000-0000000004d5', 'WIRE-ER70-1.0', 'ER70S-6 MIG wire 1.0 mm', 'kg', 30, 45, NULL),
  ('00000000-0000-0000-0000-0000000004d5', 'GAS-M21', 'Ar/CO₂ M21 cylinders', 'cyl', 3, 2, 'H280'),
  ('00000000-0000-0000-0000-0000000004d5', 'TIP-1.0', 'Contact tips 1.0 mm', 'pcs', 48, 25, NULL),
  ('00000000-0000-0000-0000-0000000004d5', 'PLATE-10', 'S275 plate 10 mm, 150 × 300', 'pcs', 64, 40, NULL);

-- ---------------------------------------------------------------------------
-- Floor-observation rubrics, one per workshop
-- ---------------------------------------------------------------------------
INSERT INTO rubrics (id, code, title, pass_threshold, trade_id) VALUES
  ('00000000-0000-0000-0000-0000000002e3', 'RB-JC-A211', 'JC-A211 Front pads & disc runout check', 70, 'auto'),
  ('00000000-0000-0000-0000-0000000003e3', 'RB-JC-E140', 'JC-E140 Wire a DOL starter to drawing E-07', 70, 'elec'),
  ('00000000-0000-0000-0000-0000000004e3', 'RB-JC-W305', 'JC-W305 Fillet weld 10 mm plate, PB, MAG', 70, 'weld');
UPDATE rubrics SET trade_id = 'cnc' WHERE id = '00000000-0000-0000-0000-0000000000e3';
INSERT INTO rubric_criteria (rubric_id, key, label, weight, is_gate, competency_id, scoring) VALUES
  ('00000000-0000-0000-0000-0000000002e3', 'ppe', 'PPE worn (glasses, gloves, safety boots)', 5, true, md5('vtc-comp-AUTO-L3-U01-E2')::uuid, '{"rule":"check","objectRef":"ppe"}'),
  ('00000000-0000-0000-0000-0000000002e3', 'secured', 'Vehicle secured (lift locks or axle stands, wheels chocked)', 5, true, md5('vtc-comp-AUTO-L3-U01-E1')::uuid, '{"rule":"check","objectRef":"secured"}'),
  ('00000000-0000-0000-0000-0000000002e3', 'method', 'Diagnostic method', 25, false, md5('vtc-comp-AUTO-L3-U03-E1')::uuid, '{"rule":"rating","objectRef":"method"}'),
  ('00000000-0000-0000-0000-0000000002e3', 'runout', 'Disc runout ≤ 0.05 mm', 30, false, md5('vtc-comp-AUTO-L3-U03-E2')::uuid,
   '{"rule":"measurement_tolerance","objectRef":"runout","expected":0.025,"absTol":0.025}'),
  ('00000000-0000-0000-0000-0000000002e3', 'torque', 'Fasteners torqued to spec', 25, false, md5('vtc-comp-AUTO-L3-U03-E1')::uuid, '{"rule":"rating","objectRef":"torque"}'),
  ('00000000-0000-0000-0000-0000000002e3', 'housekeeping', 'Housekeeping & fluid spills', 20, false, NULL, '{"rule":"rating","objectRef":"housekeeping"}'),
  ('00000000-0000-0000-0000-0000000003e3', 'ppe', 'PPE worn (insulated gloves, glasses, boots)', 5, true, '00000000-0000-0000-0000-0000000000c5', '{"rule":"check","objectRef":"ppe"}'),
  ('00000000-0000-0000-0000-0000000003e3', 'safe_iso', 'Safe isolation proved (lock, tag, test dead)', 5, true, '00000000-0000-0000-0000-0000000000c2', '{"rule":"check","objectRef":"safe_iso"}'),
  ('00000000-0000-0000-0000-0000000003e3', 'layout', 'Layout matches the drawing', 25, false, md5('vtc-comp-ELEC-L3-U05-E1')::uuid, '{"rule":"rating","objectRef":"layout"}'),
  ('00000000-0000-0000-0000-0000000003e3', 'r1r2', 'Earth continuity R1+R2 ≤ 0.50 Ω', 30, false, md5('vtc-comp-ELEC-L3-U05-E2')::uuid,
   '{"rule":"measurement_tolerance","objectRef":"r1r2","expected":0.25,"absTol":0.25}'),
  ('00000000-0000-0000-0000-0000000003e3', 'termination', 'Terminations tight, no bare copper', 25, false, md5('vtc-comp-ELEC-L3-U05-E1')::uuid, '{"rule":"rating","objectRef":"termination"}'),
  ('00000000-0000-0000-0000-0000000003e3', 'housekeeping', 'Housekeeping', 20, false, NULL, '{"rule":"rating","objectRef":"housekeeping"}'),
  ('00000000-0000-0000-0000-0000000004e3', 'ppe', 'PPE worn (helmet shade 11, leather gloves, FR jacket)', 5, true, md5('vtc-comp-WELD-L3-U01-E2')::uuid, '{"rule":"check","objectRef":"ppe"}'),
  ('00000000-0000-0000-0000-0000000004e3', 'hot_work', 'Fume extraction on, screens closed, no flammables', 5, true, md5('vtc-comp-WELD-L3-U01-E1')::uuid, '{"rule":"check","objectRef":"hot_work"}'),
  ('00000000-0000-0000-0000-0000000004e3', 'prep', 'Joint preparation & fit-up', 20, false, md5('vtc-comp-WELD-L3-U04-E1')::uuid, '{"rule":"rating","objectRef":"prep"}'),
  ('00000000-0000-0000-0000-0000000004e3', 'leg', 'Fillet leg length 6 mm', 30, false, md5('vtc-comp-WELD-L3-U04-E2')::uuid,
   '{"rule":"measurement_tolerance","objectRef":"leg","expected":6.25,"absTol":0.75}'),
  ('00000000-0000-0000-0000-0000000004e3', 'visual', 'Visual: no undercut, porosity or cracks', 30, false, md5('vtc-comp-WELD-L3-U04-E2')::uuid, '{"rule":"rating","objectRef":"visual"}'),
  ('00000000-0000-0000-0000-0000000004e3', 'housekeeping', 'Housekeeping & cylinder storage', 20, false, NULL, '{"rule":"rating","objectRef":"housekeeping"}');
UPDATE workshops SET observation_rubric_id = '00000000-0000-0000-0000-0000000002e3' WHERE id = '00000000-0000-0000-0000-0000000002d5';
UPDATE workshops SET observation_rubric_id = '00000000-0000-0000-0000-0000000003e3' WHERE id = '00000000-0000-0000-0000-0000000000d6';
UPDATE workshops SET observation_rubric_id = '00000000-0000-0000-0000-0000000004e3' WHERE id = '00000000-0000-0000-0000-0000000004d5';

-- Arabic titles and labels; measured criteria also carry the unit and the input prompt.
UPDATE rubrics SET title = 'JC-118 Turn Ø25 h7 shaft, Ra 1.6', title_ar = 'JC-118 خراطة عمود Ø25 h7، خشونة Ra 1.6' WHERE code = 'RB-JC-118';
UPDATE rubric_criteria SET label_ar = 'ارتداء معدات الوقاية (نظارة، حذاء أمان، بلا أكمام فضفاضة)' WHERE key = 'ppe' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-118');
UPDATE rubric_criteria SET label_ar = 'تشغيل آمن (الواقي مغلق، مفتاح الظرف مُزال)' WHERE key = 'safe_op' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-118');
UPDATE rubric_criteria SET label_ar = 'ضبط الماكينة' WHERE key = 'setup' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-118');
UPDATE rubric_criteria SET label_ar = 'القطر Ø25 h7', scoring = scoring || '{"unit":"mm","measure":{"en":"Measured diameter in mm","ar":"القطر المقاس بالمليمتر"}}'::jsonb WHERE key = 'dia' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-118');
UPDATE rubric_criteria SET label_ar = 'جودة السطح Ra 1.6' WHERE key = 'finish' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-118');
UPDATE rubric_criteria SET label_ar = 'النظافة والترتيب' WHERE key = 'housekeeping' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-118');
UPDATE rubrics SET title = 'JC-A211 Front pads & disc runout check', title_ar = 'JC-A211 تغيير تيل الفرامل الأمامي وفحص انحراف الطنبورة' WHERE code = 'RB-JC-A211';
UPDATE rubric_criteria SET label_ar = 'ارتداء معدات الوقاية (نظارة، قفازات، حذاء أمان)' WHERE key = 'ppe' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-A211');
UPDATE rubric_criteria SET label_ar = 'تأمين المركبة (أقفال الرافعة أو حوامل المحاور، تثبيت العجلات)' WHERE key = 'secured' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-A211');
UPDATE rubric_criteria SET label_ar = 'منهجية التشخيص' WHERE key = 'method' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-A211');
UPDATE rubric_criteria SET label_ar = 'انحراف الطنبورة ≤ 0.05 مم', scoring = scoring || '{"unit":"mm","measure":{"en":"Measured runout in mm","ar":"الانحراف المقاس بالمليمتر"}}'::jsonb WHERE key = 'runout' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-A211');
UPDATE rubric_criteria SET label_ar = 'ربط المسامير بالعزم المحدد' WHERE key = 'torque' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-A211');
UPDATE rubric_criteria SET label_ar = 'النظافة وانسكاب السوائل' WHERE key = 'housekeeping' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-A211');
UPDATE rubrics SET title = 'JC-E140 Wire a DOL starter to drawing E-07', title_ar = 'JC-E140 توصيل بادئ DOL حسب المخطط E-07' WHERE code = 'RB-JC-E140';
UPDATE rubric_criteria SET label_ar = 'ارتداء معدات الوقاية (قفازات معزولة، نظارة، حذاء أمان)' WHERE key = 'ppe' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-E140');
UPDATE rubric_criteria SET label_ar = 'إثبات العزل الآمن (قفل، بطاقة، اختبار انعدام الجهد)' WHERE key = 'safe_iso' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-E140');
UPDATE rubric_criteria SET label_ar = 'التنفيذ مطابق للمخطط' WHERE key = 'layout' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-E140');
UPDATE rubric_criteria SET label_ar = 'استمرارية الأرضي R1+R2 ≤ 0.50 Ω', scoring = scoring || '{"unit":"Ω","measure":{"en":"Measured R1+R2 in ohms","ar":"قيمة R1+R2 المقاسة بالأوم"}}'::jsonb WHERE key = 'r1r2' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-E140');
UPDATE rubric_criteria SET label_ar = 'أطراف محكمة بلا نحاس مكشوف' WHERE key = 'termination' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-E140');
UPDATE rubric_criteria SET label_ar = 'النظافة والترتيب' WHERE key = 'housekeeping' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-E140');
UPDATE rubrics SET title = 'JC-W305 Fillet weld 10 mm plate, PB (2F), MAG', title_ar = 'JC-W305 لحام زاوية لوح 10 مم، وضع PB ‏(2F)، MAG' WHERE code = 'RB-JC-W305';
UPDATE rubric_criteria SET label_ar = 'ارتداء معدات الوقاية (خوذة درجة تعتيم 11، قفازات جلدية، سترة مقاومة للهب)' WHERE key = 'ppe' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-W305');
UPDATE rubric_criteria SET label_ar = 'شفط الأبخرة يعمل، الستائر مغلقة، لا مواد قابلة للاشتعال' WHERE key = 'hot_work' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-W305');
UPDATE rubric_criteria SET label_ar = 'تجهيز الوصلة والتركيب' WHERE key = 'prep' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-W305');
UPDATE rubric_criteria SET label_ar = 'طول ساق لحام الزاوية 6 مم', scoring = scoring || '{"unit":"mm","measure":{"en":"Measured leg length in mm","ar":"طول الساق المقاس بالمليمتر"}}'::jsonb WHERE key = 'leg' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-W305');
UPDATE rubric_criteria SET label_ar = 'الفحص البصري: لا تآكل حواف ولا مسامية ولا شروخ' WHERE key = 'visual' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-W305');
UPDATE rubric_criteria SET label_ar = 'النظافة وتخزين الأسطوانات' WHERE key = 'housekeeping' AND rubric_id = (SELECT id FROM rubrics WHERE code = 'RB-JC-W305');

-- ---------------------------------------------------------------------------
-- V-Labs for CNC, automotive and welding (the DOL starter is in seed.sql)
-- ---------------------------------------------------------------------------
-- VLAB-CNC-QUALITY: generated from api/src/labs (keep the two in step; api/test/labs.test.ts checks the definitions).
INSERT INTO virtual_labs (id, code, title, title_ar, domain, model_uri, sim_version, trade_id) VALUES
  ('00000000-0000-0000-0000-0000000001d1', 'VLAB-CNC-QUALITY', 'CNC lathe quality fault test', 'اختبار أعطال الجودة في مخرطة CNC', 'cnc_milling', 's3://vtc-twins/cnc-lathe-v1.glb', '1.0.0', 'cnc');
INSERT INTO lab_faults (lab_id, code, description, component_ref, correct_isolation_steps) VALUES
  ('00000000-0000-0000-0000-0000000001d1', 'F-INSERT-WORN', 'T01 insert flank wear beyond limit', 'T01_insert',
   ARRAY['CHUCK:pressure', 'PART:dia', 'PART:ra', 'T01:flank']),
  ('00000000-0000-0000-0000-0000000001d1', 'F-OFFSET-X', 'T01 X wear offset entered wrong (+0.100)', 'offset_x',
   ARRAY['CHUCK:pressure', 'PART:dia', 'PART:ra', 'CTRL:offset_x']),
  ('00000000-0000-0000-0000-0000000001d1', 'F-JAW-LOOSE', 'Chuck jaws not gripping (worn serrations)', 'chuck_jaws',
   ARRAY['CHUCK:pressure', 'PART:ra', 'SPINDLE:runout']),
  ('00000000-0000-0000-0000-0000000001d1', 'F-COOLANT-LEAN', 'Coolant mix too lean (1.5%)', 'coolant',
   ARRAY['CHUCK:pressure', 'PART:ra', 'T01:flank', 'COOLANT:conc']);
INSERT INTO rubrics (id, code, title, pass_threshold, trade_id) VALUES ('00000000-0000-0000-0000-0000000001e1', 'RB-CNC-QUALITY', 'CNC lathe quality fault test', 70, 'cnc');
UPDATE virtual_labs SET default_rubric_id = '00000000-0000-0000-0000-0000000001e1' WHERE id = '00000000-0000-0000-0000-0000000001d1';
INSERT INTO rubric_criteria (rubric_id, key, label, weight, is_gate, competency_id, scoring) VALUES
  ('00000000-0000-0000-0000-0000000001e1', 'ppe', 'PPE donned before work', 5, true, NULL,
   '{"rule":"precedes","first":"ppe_donned","then":["panel_opened","measured","component_replaced"]}'),
  ('00000000-0000-0000-0000-0000000001e1', 'loto', 'Machine locked out before reaching in', 10, true, (SELECT id FROM competencies WHERE code = 'CNC-L3-U06-E1'),
   '{"rule":"precedes","first":"loto_applied","then":["panel_opened","component_replaced"]}'),
  ('00000000-0000-0000-0000-0000000001e1', 'no_contact', 'No hands in the work area while armed', 5, true, NULL,
   '{"rule":"absent","verb":"energized_contact"}'),
  ('00000000-0000-0000-0000-0000000001e1', 'diagnosis', 'Correct fault identified', 35, false, (SELECT id FROM competencies WHERE code = 'CNC-L3-U06-E2'),
   '{"rule":"fault_diagnosed","componentOnlyCredit":50}'),
  ('00000000-0000-0000-0000-0000000001e1', 'isolation', 'Logical test-point sequence', 20, false, (SELECT id FROM competencies WHERE code = 'CNC-L3-U06-E2'),
   '{"rule":"isolation_steps"}'),
  ('00000000-0000-0000-0000-0000000001e1', 'supply', 'Chuck pressure read within ±10%', 10, false, NULL,
   '{"rule":"measurement_tolerance","objectRef":"CHUCK:pressure","expected":25,"relTol":0.1}'),
  ('00000000-0000-0000-0000-0000000001e1', 'parts', 'No unnecessary part swaps', 10, false, NULL,
   '{"rule":"penalty_per","verb":"component_replaced","per":50,"ignoreFaultyComponents":true}'),
  ('00000000-0000-0000-0000-0000000001e1', 'time', 'Completed within target time', 5, false, NULL,
   '{"rule":"time","targetS":900,"maxS":1800}');

-- VLAB-AUTO-NOCRANK: generated from api/src/labs (keep the two in step; api/test/labs.test.ts checks the definitions).
INSERT INTO virtual_labs (id, code, title, title_ar, domain, model_uri, sim_version, trade_id) VALUES
  ('00000000-0000-0000-0000-0000000002d1', 'VLAB-AUTO-NOCRANK', 'No-crank fault test', 'اختبار عطل عدم دوران المحرك', 'automotive_obd', 's3://vtc-twins/starting-circuit-v1.glb', '1.0.0', 'auto');
INSERT INTO lab_faults (lab_id, code, description, component_ref, correct_isolation_steps) VALUES
  ('00000000-0000-0000-0000-0000000002d1', 'F-K3-COIL', 'Starter relay K3 coil open-circuit', 'K3_relay',
   ARRAY['BAT:terminals', 'IGN:start_signal', 'F12:fuse', 'K3:coil']),
  ('00000000-0000-0000-0000-0000000002d1', 'F-F12-BLOWN', 'Starter fuse F12 (30 A) blown', 'F12_fuse',
   ARRAY['BAT:terminals', 'IGN:start_signal', 'F12:fuse']),
  ('00000000-0000-0000-0000-0000000002d1', 'F-SOL-OPEN', 'Starter solenoid pull-in winding open', 'M1_solenoid',
   ARRAY['BAT:terminals', 'IGN:start_signal', 'F12:fuse', 'K3:coil', 'M1:solenoid']),
  ('00000000-0000-0000-0000-0000000002d1', 'F-GND-CORR', 'Engine ground strap corroded (high resistance)', 'ground_strap',
   ARRAY['BAT:terminals', 'GND:strap']);
INSERT INTO rubrics (id, code, title, pass_threshold, trade_id) VALUES ('00000000-0000-0000-0000-0000000002e1', 'RB-AUTO-NOCRANK', 'No-crank fault test', 70, 'auto');
UPDATE virtual_labs SET default_rubric_id = '00000000-0000-0000-0000-0000000002e1' WHERE id = '00000000-0000-0000-0000-0000000002d1';
INSERT INTO rubric_criteria (rubric_id, key, label, weight, is_gate, competency_id, scoring) VALUES
  ('00000000-0000-0000-0000-0000000002e1', 'ppe', 'PPE donned before work', 5, true, NULL,
   '{"rule":"precedes","first":"ppe_donned","then":["panel_opened","measured","component_replaced"]}'),
  ('00000000-0000-0000-0000-0000000002e1', 'loto', 'Battery isolated before working on the starter', 10, true, (SELECT id FROM competencies WHERE code = 'AUTO-L3-U04-E1'),
   '{"rule":"precedes","first":"loto_applied","then":["panel_opened","component_replaced"]}'),
  ('00000000-0000-0000-0000-0000000002e1', 'no_contact', 'No short across the starter B+', 5, true, NULL,
   '{"rule":"absent","verb":"energized_contact"}'),
  ('00000000-0000-0000-0000-0000000002e1', 'diagnosis', 'Correct fault identified', 35, false, (SELECT id FROM competencies WHERE code = 'AUTO-L3-U04-E2'),
   '{"rule":"fault_diagnosed","componentOnlyCredit":50}'),
  ('00000000-0000-0000-0000-0000000002e1', 'isolation', 'Logical test-point sequence', 20, false, (SELECT id FROM competencies WHERE code = 'AUTO-L3-U04-E2'),
   '{"rule":"isolation_steps"}'),
  ('00000000-0000-0000-0000-0000000002e1', 'supply', 'Battery voltage read within ±5%', 10, false, NULL,
   '{"rule":"measurement_tolerance","objectRef":"BAT:terminals","expected":12.6,"relTol":0.05}'),
  ('00000000-0000-0000-0000-0000000002e1', 'parts', 'No unnecessary part swaps', 10, false, NULL,
   '{"rule":"penalty_per","verb":"component_replaced","per":50,"ignoreFaultyComponents":true}'),
  ('00000000-0000-0000-0000-0000000002e1', 'time', 'Completed within target time', 5, false, NULL,
   '{"rule":"time","targetS":900,"maxS":1800}');

-- VLAB-MIG-DEFECT: generated from api/src/labs (keep the two in step; api/test/labs.test.ts checks the definitions).
INSERT INTO virtual_labs (id, code, title, title_ar, domain, model_uri, sim_version, trade_id) VALUES
  ('00000000-0000-0000-0000-0000000004d1', 'VLAB-MIG-DEFECT', 'MIG weld-defect test', 'اختبار عيوب لحام MIG', 'welding_fabrication', 's3://vtc-twins/mig-welder-v1.glb', '1.0.0', 'weld');
INSERT INTO lab_faults (lab_id, code, description, component_ref, correct_isolation_steps) VALUES
  ('00000000-0000-0000-0000-0000000004d1', 'F-GAS-LEAK', 'Split shielding-gas hose', 'gas_hose',
   ARRAY['Q1:supply', 'GAS:flow', 'HOSE:leak']),
  ('00000000-0000-0000-0000-0000000004d1', 'F-TIP-WORN', 'Contact tip bore worn oversize', 'contact_tip',
   ARRAY['Q1:supply', 'GAS:flow', 'TIP:bore']),
  ('00000000-0000-0000-0000-0000000004d1', 'F-POLARITY', 'Torch polarity reversed (DCEN on solid wire)', 'polarity_lead',
   ARRAY['Q1:supply', 'GAS:flow', 'TORCH:polarity']),
  ('00000000-0000-0000-0000-0000000004d1', 'F-LINER', 'Torch liner blocked with swarf', 'liner',
   ARRAY['Q1:supply', 'GAS:flow', 'LINER:drag']);
INSERT INTO rubrics (id, code, title, pass_threshold, trade_id) VALUES ('00000000-0000-0000-0000-0000000004e1', 'RB-MIG-DEFECT', 'MIG weld-defect test', 70, 'weld');
UPDATE virtual_labs SET default_rubric_id = '00000000-0000-0000-0000-0000000004e1' WHERE id = '00000000-0000-0000-0000-0000000004d1';
INSERT INTO rubric_criteria (rubric_id, key, label, weight, is_gate, competency_id, scoring) VALUES
  ('00000000-0000-0000-0000-0000000004e1', 'ppe', 'PPE donned before work', 5, true, NULL,
   '{"rule":"precedes","first":"ppe_donned","then":["panel_opened","measured","component_replaced"]}'),
  ('00000000-0000-0000-0000-0000000004e1', 'loto', 'Welder isolated before opening the feeder', 10, true, (SELECT id FROM competencies WHERE code = 'WELD-L3-U06-E1'),
   '{"rule":"precedes","first":"loto_applied","then":["panel_opened","component_replaced"]}'),
  ('00000000-0000-0000-0000-0000000004e1', 'no_contact', 'No contact with live wire or tip', 5, true, NULL,
   '{"rule":"absent","verb":"energized_contact"}'),
  ('00000000-0000-0000-0000-0000000004e1', 'diagnosis', 'Correct fault identified', 35, false, (SELECT id FROM competencies WHERE code = 'WELD-L3-U06-E2'),
   '{"rule":"fault_diagnosed","componentOnlyCredit":50}'),
  ('00000000-0000-0000-0000-0000000004e1', 'isolation', 'Logical test-point sequence', 20, false, (SELECT id FROM competencies WHERE code = 'WELD-L3-U06-E2'),
   '{"rule":"isolation_steps"}'),
  ('00000000-0000-0000-0000-0000000004e1', 'supply', 'Supply voltage read within ±5%', 10, false, NULL,
   '{"rule":"measurement_tolerance","objectRef":"Q1:supply","expected":400,"relTol":0.05}'),
  ('00000000-0000-0000-0000-0000000004e1', 'parts', 'No unnecessary part swaps', 10, false, NULL,
   '{"rule":"penalty_per","verb":"component_replaced","per":50,"ignoreFaultyComponents":true}'),
  ('00000000-0000-0000-0000-0000000004e1', 'time', 'Completed within target time', 5, false, NULL,
   '{"rule":"time","targetS":900,"maxS":1800}');



-- The CNC cohort's V-Lab history in demo.sql predates the CNC lab: move it there.
UPDATE virtual_lab_sessions v
   SET lab_id = '00000000-0000-0000-0000-0000000001d1', rubric_id = '00000000-0000-0000-0000-0000000001e1',
       injected_fault_ids = ARRAY[(SELECT id FROM lab_faults f WHERE f.lab_id = '00000000-0000-0000-0000-0000000001d1'
                                    ORDER BY code OFFSET abs(hashtext(v.id::text)) % 4 LIMIT 1)]
  FROM cohort_members m
 WHERE m.user_id = v.learner_id AND m.cohort_id = '00000000-0000-0000-0000-00000000c0b2' AND m.member_role = 'student';
UPDATE rubric_evaluations e SET rubric_id = '00000000-0000-0000-0000-0000000001e1'
  FROM virtual_lab_sessions v
 WHERE e.subject_type = 'vlab_session' AND e.subject_id = v.id AND v.lab_id = '00000000-0000-0000-0000-0000000001d1';

-- ---------------------------------------------------------------------------
-- Assessment history for the new cohorts (last three weeks)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE demo_trade_labs (trade text PRIMARY KEY, lab uuid, rubric uuid, obs_rubric uuid, task text, framework text, gate text);
INSERT INTO demo_trade_labs
SELECT t.trade, l.id, l.default_rubric_id, w.observation_rubric_id, r.code, t.framework, t.gate
  FROM (VALUES ('auto', 'VLAB-AUTO-NOCRANK', 'NTQF-AUTO-L3', 'loto'),
               ('elec', 'VLAB-DOL-STARTER', 'NTQF-ELEC-L3', 'loto'),
               ('weld', 'VLAB-MIG-DEFECT', 'NTQF-WELD-L3', 'loto')) t(trade, lab_code, framework, gate)
  JOIN virtual_labs l ON l.code = t.lab_code
  JOIN demo_cohorts c ON c.trade = t.trade
  JOIN workshops w ON w.id = c.workshop
  JOIN rubrics r ON r.id = w.observation_rubric_id;
UPDATE demo_trade_labs SET task = substr(task, 4);   -- RB-JC-A211 → JC-A211

CREATE TEMP TABLE demo_trade_attempts AS
SELECT s.trade, s.id AS learner_id, s.no, k, c.trainer,
       now() - make_interval(days => 2 + ((s.no * 5 + k * 3) % 18), hours => (s.no + k) % 6) AS started_at,
       CASE WHEN s.no = 6 THEN 50 + k * 7 ELSE 60 + (abs(hashtext(s.name || k)) % 38) END::numeric AS score,
       s.no = 6 AND k = 1 AS gate_failed
  FROM demo_trade_students s JOIN demo_cohorts c USING (trade) CROSS JOIN generate_series(1, 2) k
 WHERE k = 1 OR s.no % 3 <> 0;

INSERT INTO virtual_lab_sessions (id, lab_id, learner_id, mode, rubric_id, injected_fault_ids, injected_by, device, status,
                                  started_at, submitted_at, time_limit_s, final_score, passed)
SELECT md5('vlab' || a.learner_id || a.k)::uuid, l.lab, a.learner_id, 'assessment', l.rubric,
       ARRAY[(SELECT id FROM lab_faults f WHERE f.lab_id = l.lab ORDER BY code OFFSET (a.no + a.k) % 4 LIMIT 1)],
       a.trainer, 'browser', 'evaluated', a.started_at,
       a.started_at + make_interval(secs => 600 + (a.no * 97 % 900)), 1800, a.score, a.score >= 70 AND NOT a.gate_failed
  FROM demo_trade_attempts a JOIN demo_trade_labs l USING (trade);

INSERT INTO rubric_evaluations (rubric_id, subject_type, subject_id, learner_id, evaluator_id, criterion_scores, total_score, passed, gate_failures, evaluated_at)
SELECT l.rubric, 'vlab_session', md5('vlab' || a.learner_id || a.k)::uuid, a.learner_id, NULL, '{}'::jsonb, a.score,
       a.score >= 70 AND NOT a.gate_failed, CASE WHEN a.gate_failed THEN ARRAY[l.gate] ELSE '{}' END,
       a.started_at + make_interval(secs => 600 + (a.no * 97 % 900))
  FROM demo_trade_attempts a JOIN demo_trade_labs l USING (trade);

-- Floor observations on each workshop's job card.
INSERT INTO workshop_observations (id, learner_id, trainer_id, asset_id, rubric_id, task_ref, observed_at, measurements)
SELECT md5('obs' || s.id)::uuid, s.id, c.trainer,
       (SELECT id FROM workshop_assets WHERE workshop_id = c.workshop AND asset_tag ~ (lpad(s.no::text, 2, '0') || '$') AND category = 'machine' LIMIT 1),
       l.obs_rubric, l.task,
       CASE WHEN s.no = 1 THEN now() - interval '35 minutes' ELSE now() - make_interval(days => 3 + s.no % 7) END,
       CASE s.trade WHEN 'auto' THEN jsonb_build_object('runout', 0.02 + (s.no % 4) * 0.01)
                    WHEN 'elec' THEN jsonb_build_object('r1r2', 0.21 + (s.no % 4) * 0.07)
                    ELSE jsonb_build_object('leg', 5.8 + (s.no % 4) * 0.3) END
  FROM demo_trade_students s JOIN demo_cohorts c USING (trade) JOIN demo_trade_labs l USING (trade)
 WHERE s.no IN (1, 2, 3, 5, 7, 8);
INSERT INTO rubric_evaluations (rubric_id, subject_type, subject_id, learner_id, evaluator_id, criterion_scores, total_score, passed, gate_failures, evaluated_at)
SELECT o.rubric_id, 'workshop_observation', o.id, o.learner_id, o.trainer_id, '{}'::jsonb,
       CASE s.no WHEN 1 THEN 88 ELSE 68 + abs(hashtext(s.name)) % 28 END, true, '{}', o.observed_at
  FROM workshop_observations o JOIN demo_trade_students s ON s.id = o.learner_id;

-- Competency profile: each learner on their own trade's framework only.
INSERT INTO learner_competencies (learner_id, competency_id, level, score, evidence_count, last_assessed_at)
SELECT s.id, c.id,
       (ARRAY['not_yet', 'novice', 'intermediate', 'intermediate', 'autonomous', 'autonomous'])
         [LEAST(6, GREATEST(1, 1 + (abs(hashtext(s.name || c.code)) % 6) - CASE WHEN s.no = 6 THEN 2 ELSE 0 END
            + CASE WHEN s.no = 1 THEN 1 ELSE 0 END))]::proficiency_level,
       45 + abs(hashtext(c.code || s.name)) % 55, 1 + abs(hashtext(s.name)) % 4,
       now() - make_interval(days => abs(hashtext(c.code || s.no)) % 20)
  FROM demo_trade_students s JOIN demo_trade_labs l USING (trade)
  JOIN competency_frameworks f ON f.code = l.framework
  JOIN competencies c ON c.framework_id = f.id AND c.kind = 'element'
ON CONFLICT DO NOTHING;

-- One open alert per trade, raised this morning on the floor.
INSERT INTO safety_alerts (institution_id, learner_id, source, criterion_key, detail, raised_at) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000206', 'observation', 'secured',
   'Working under the car on AUTO1-B06 without axle stands', now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000306', 'rfid', 'safe_iso',
   'Board ELEC-BTH-06 energised while the cover was off', now() - interval '30 minutes'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000406', 'rfid', 'hot_work',
   'Arc struck in WELD3-B06 with the fume extraction off', now() - interval '15 minutes');

-- ---------------------------------------------------------------------------
-- Question bank: two approved items per trade (the DOL items in demo.sql are electrical)
-- ---------------------------------------------------------------------------
INSERT INTO questions (id, institution_id, type, bloom, status, author_id, ai_generated) VALUES
  ('00000000-0000-0000-0000-0000000001f1', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'apply', 'approved', '00000000-0000-0000-0000-0000000000b2', false),
  ('00000000-0000-0000-0000-0000000001f2', '00000000-0000-0000-0000-0000000000a1', 'calculation', 'apply', 'approved', '00000000-0000-0000-0000-0000000000b2', false),
  ('00000000-0000-0000-0000-0000000002f1', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'apply', 'approved', '00000000-0000-0000-0000-0000000002b2', false),
  ('00000000-0000-0000-0000-0000000002f2', '00000000-0000-0000-0000-0000000000a1', 'calculation', 'apply', 'approved', '00000000-0000-0000-0000-0000000002b2', false),
  ('00000000-0000-0000-0000-0000000003f1', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'understand', 'approved', '00000000-0000-0000-0000-0000000003b2', false),
  ('00000000-0000-0000-0000-0000000003f2', '00000000-0000-0000-0000-0000000000a1', 'calculation', 'apply', 'approved', '00000000-0000-0000-0000-0000000003b2', false),
  ('00000000-0000-0000-0000-0000000004f1', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'analyze', 'approved', '00000000-0000-0000-0000-0000000004b2', false),
  ('00000000-0000-0000-0000-0000000004f2', '00000000-0000-0000-0000-0000000000a1', 'mcq', 'understand', 'approved', '00000000-0000-0000-0000-0000000004b2', false);
INSERT INTO question_versions (question_id, version, stem, body, answer_key, abs_tolerance, max_points) VALUES
  ('00000000-0000-0000-0000-0000000001f1', 1,
   'Before opening the lathe guard to measure the part, you must first:',
   '{"stem_ar":"قبل فتح واقي المخرطة لقياس القطعة يجب عليك أولًا:","options":[
     {"id":"a","en":"Stop the spindle and wait until it has stopped turning","ar":"إيقاف عمود الدوران والانتظار حتى يتوقف تمامًا"},
     {"id":"b","en":"Reduce the feed rate","ar":"تقليل معدل التغذية"},
     {"id":"c","en":"Switch the coolant off only","ar":"إيقاف سائل التبريد فقط"},
     {"id":"d","en":"Put the machine in single-block mode","ar":"وضع الماكينة في وضع الكتلة المفردة"}]}', '{"correct":"a"}', NULL, 1),
  ('00000000-0000-0000-0000-0000000001f2', 1,
   'A turned part measures 0.06 mm oversize on diameter. By how many mm do you change the X wear offset (enter a negative number to reduce)?',
   '{"stem_ar":"قطعة مخروطة أكبر بمقدار 0.06 مم في القطر. بكم مليمترًا تعدّل إزاحة تآكل X (أدخل رقمًا سالبًا للتقليل)؟","unit":"mm"}', '{"value":-0.06}', 0.001, 2),
  ('00000000-0000-0000-0000-0000000002f1', 1,
   'The dash lights dim heavily and the starter clicks rapidly. Battery reads 12.6 V at rest. What do you test first?',
   '{"stem_ar":"تخفت لمبات التابلوه بشدة ويطقطق البادئ بسرعة. البطارية تقرأ 12.6 فولت في السكون. ما الذي تختبره أولًا؟","options":[
     {"id":"a","en":"The engine ground strap and battery cables","ar":"شريط أرضي المحرك وكابلات البطارية"},
     {"id":"b","en":"The ignition switch","ar":"مفتاح الإشعال"},
     {"id":"c","en":"The fuel pump relay","ar":"مرحل مضخة الوقود"},
     {"id":"d","en":"The immobiliser key","ar":"مفتاح منع التشغيل"}]}', '{"correct":"a"}', NULL, 1),
  ('00000000-0000-0000-0000-0000000002f2', 1,
   'A disc reads 0.02 mm and 0.09 mm runout at two points on one revolution. What is the total runout in mm?',
   '{"stem_ar":"قرص يقرأ انحرافًا 0.02 مم و0.09 مم عند نقطتين في دورة واحدة. ما مقدار الانحراف الكلي بالمليمتر؟","unit":"mm"}', '{"value":0.07}', 0.005, 2),
  ('00000000-0000-0000-0000-0000000003f1', 1,
   'Why is an RCD fitted on socket-outlet circuits?',
   '{"stem_ar":"لماذا يُركَّب قاطع التيار المتبقي RCD على دوائر المقابس؟","options":[
     {"id":"a","en":"To give additional protection against electric shock","ar":"لتوفير حماية إضافية من الصدمة الكهربائية"},
     {"id":"b","en":"To limit the load current","ar":"لتحديد تيار الحمل"},
     {"id":"c","en":"To improve the power factor","ar":"لتحسين معامل القدرة"},
     {"id":"d","en":"To replace the circuit breaker","ar":"ليحل محل القاطع"}]}', '{"correct":"a"}', NULL, 1),
  ('00000000-0000-0000-0000-0000000003f2', 1,
   'A radial circuit has R1 = 0.18 Ω and R2 = 0.29 Ω. What is R1+R2 in ohms?',
   '{"stem_ar":"دائرة شعاعية فيها R1 = 0.18 أوم وR2 = 0.29 أوم. ما قيمة R1+R2 بالأوم؟","unit":"Ω"}', '{"value":0.47}', 0.01, 2),
  ('00000000-0000-0000-0000-0000000004f1', 1,
   'A MIG weld shows surface porosity along the whole run. What is the most likely cause?',
   '{"stem_ar":"لحام MIG تظهر فيه مسامية سطحية على طول الخط. ما السبب الأرجح؟","options":[
     {"id":"a","en":"Loss of shielding gas coverage","ar":"فقد تغطية غاز الحماية"},
     {"id":"b","en":"Travel speed too slow","ar":"سرعة اللحام بطيئة جدًا"},
     {"id":"c","en":"Wire stick-out too short","ar":"بروز السلك قصير جدًا"},
     {"id":"d","en":"Plate too thick","ar":"اللوح سميك جدًا"}]}', '{"correct":"a"}', NULL, 1),
  ('00000000-0000-0000-0000-0000000004f2', 1,
   'Which shade of filter lens is usually right for MIG welding at 150–250 A?',
   '{"stem_ar":"ما درجة عدسة الترشيح المناسبة عادةً للحام MIG عند 150–250 أمبير؟","options":[
     {"id":"a","en":"Shade 11–13","ar":"الدرجة 11–13"},
     {"id":"b","en":"Shade 5","ar":"الدرجة 5"},
     {"id":"c","en":"Shade 3","ar":"الدرجة 3"},
     {"id":"d","en":"Clear safety glasses","ar":"نظارة أمان شفافة"}]}', '{"correct":"a"}', NULL, 1);
INSERT INTO question_competencies (question_id, competency_id) VALUES
  ('00000000-0000-0000-0000-0000000001f1', md5('vtc-comp-CNC-L3-U06-E1')::uuid),
  ('00000000-0000-0000-0000-0000000001f2', md5('vtc-comp-CNC-L3-U06-E2')::uuid),
  ('00000000-0000-0000-0000-0000000002f1', md5('vtc-comp-AUTO-L3-U04-E2')::uuid),
  ('00000000-0000-0000-0000-0000000002f2', md5('vtc-comp-AUTO-L3-U03-E2')::uuid),
  ('00000000-0000-0000-0000-0000000003f1', md5('vtc-comp-ELEC-L3-U05-E2')::uuid),
  ('00000000-0000-0000-0000-0000000003f2', md5('vtc-comp-ELEC-L3-U05-E2')::uuid),
  ('00000000-0000-0000-0000-0000000004f1', md5('vtc-comp-WELD-L3-U04-E2')::uuid),
  ('00000000-0000-0000-0000-0000000004f2', md5('vtc-comp-WELD-L3-U01-E2')::uuid);

SELECT assign_trades();
