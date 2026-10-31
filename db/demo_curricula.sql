-- VTC_LMS demo data for the programmes added from the WABYS curriculum manual
-- (migration 006), loaded after demo_modules.sql (SEED_DEMO=true).
--
-- One small first-year cohort per new programme, with a workshop, so a demo
-- learner can open "My programme" and the 3D studio of each one. The lead
-- trainer (trainer@) and the academic teacher (teacher@) join every cohort.
-- Every name here is illustrative.
--
-- Sign-in (password demo1234): student.rmg@, student.eim@, student.prt@,
-- student.ait@, student.cws@ (all @vtc.example).
SET search_path = vtc, public;

CREATE TEMP TABLE demo_new_cohorts (trade text PRIMARY KEY, prefix int, name text, name_ar text, workshop text, workshop_ar text);
INSERT INTO demo_new_cohorts VALUES
  ('rmg', 5, 'Ready-made garments Y1-A', 'الملابس الجاهزة، السنة الأولى أ', 'Garment workshop 1', 'ورشة الملابس 1'),
  ('eim', 6, 'Industrial maintenance Y1-A', 'الصيانة الصناعية، السنة الأولى أ', 'Maintenance workshop 2', 'ورشة الصيانة 2'),
  ('prt', 7, 'Printing technology Y1-A', 'تكنولوجيا الطباعة، السنة الأولى أ', 'Print shop 1', 'المطبعة 1'),
  ('ait', 8, 'Applied AI & industrial technology Y1-A', 'الذكاء الاصطناعي التطبيقي والتكنولوجيا الصناعية، السنة الأولى أ', 'AI & automation lab', 'معمل الذكاء الاصطناعي والأتمتة'),
  ('cws', 9, 'Customer & workplace services Y1-A', 'خدمة العملاء وبيئة العمل، السنة الأولى أ', 'Service training room', 'قاعة التدريب على الخدمة');

CREATE TEMP TABLE demo_new_students (trade text, no int, name text, name_ar text, PRIMARY KEY (trade, no));
INSERT INTO demo_new_students VALUES
  ('rmg', 1, 'Salma Adel', 'سلمى عادل'), ('rmg', 2, 'Nour Hamdy', 'نور حمدي'), ('rmg', 3, 'Yara Saad', 'يارا سعد'), ('rmg', 4, 'Karim Fathy', 'كريم فتحي'),
  ('eim', 1, 'Youssef Nabil', 'يوسف نبيل'), ('eim', 2, 'Ahmed Samir', 'أحمد سمير'), ('eim', 3, 'Mariam Zaki', 'مريم زكي'), ('eim', 4, 'Omar Ezzat', 'عمر عزت'),
  ('prt', 1, 'Laila Mostafa', 'ليلى مصطفى'), ('prt', 2, 'Tarek Hosny', 'طارق حسني'), ('prt', 3, 'Habiba Lotfy', 'حبيبة لطفي'), ('prt', 4, 'Mostafa Adel', 'مصطفى عادل'),
  ('ait', 1, 'Mazen Khalil', 'مازن خليل'), ('ait', 2, 'Jana Sherif', 'جنى شريف'), ('ait', 3, 'Ali Tamer', 'علي تامر'), ('ait', 4, 'Rana Wael', 'رنا وائل'),
  ('cws', 1, 'Farah Hesham', 'فرح هشام'), ('cws', 2, 'Mohamed Rizk', 'محمد رزق'), ('cws', 3, 'Nada Emad', 'ندى عماد'), ('cws', 4, 'Hossam Galal', 'حسام جلال');

INSERT INTO users (id, institution_id, email, full_name, full_name_ar, safety_badge_uid, password_hash)
SELECT md5('vtc-demo-student-' || trade || no)::uuid, '00000000-0000-0000-0000-0000000000a1',
       CASE WHEN no = 1 THEN 'student.' || trade ELSE 'learner.' || trade || lpad(no::text, 2, '0') END || '@vtc.example',
       name, name_ar, 'RFID-' || upper(trade) || lpad(no::text, 3, '0'), crypt('demo1234', gen_salt('bf', 8))
  FROM demo_new_students;
INSERT INTO user_roles (user_id, role) SELECT md5('vtc-demo-student-' || trade || no)::uuid, 'student'::user_role FROM demo_new_students;

INSERT INTO cohorts (id, institution_id, name, name_ar, trade, trade_id, starts_on, ends_on)
SELECT md5('vtc-demo-cohort-' || c.trade)::uuid, '00000000-0000-0000-0000-0000000000a1', c.name, c.name_ar, t.name, c.trade, date '2026-09-14', date '2029-06-30'
  FROM demo_new_cohorts c JOIN trades t ON t.id = c.trade;
INSERT INTO cohort_members (cohort_id, user_id, member_role)
SELECT md5('vtc-demo-cohort-' || trade)::uuid, md5('vtc-demo-student-' || trade || no)::uuid, 'student'::user_role FROM demo_new_students
UNION ALL SELECT md5('vtc-demo-cohort-' || trade)::uuid, '00000000-0000-0000-0000-0000000000b2', 'vocational_trainer' FROM demo_new_cohorts
UNION ALL SELECT md5('vtc-demo-cohort-' || trade)::uuid, '00000000-0000-0000-0000-0000000000b3', 'academic_teacher' FROM demo_new_cohorts;

INSERT INTO workshops (id, institution_id, name, name_ar, capacity, trade_id)
SELECT md5('vtc-demo-workshop-' || trade)::uuid, '00000000-0000-0000-0000-0000000000a1', workshop, workshop_ar, 12, trade FROM demo_new_cohorts;

DROP TABLE demo_new_cohorts, demo_new_students;
