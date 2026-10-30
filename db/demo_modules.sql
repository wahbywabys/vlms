-- VTC_LMS demo data for the workshop, apprenticeship and assessment modules
-- (migration 002), loaded after demo_trades.sql when SEED_DEMO=true.
--
--   * floor rubrics: tap descriptors, categories and photo rules
--   * consumables: bill of materials per job card, two weeks of issues
--   * a safety pre-check per trade, QR codes on every machine, passports and
--     live unlocks matching the stations already in use
--   * a placement for every trade's demo learner, three weeks of geofenced shifts
--   * class attendance, quiz history and level history for the early warning
--   * five parameterised questions and three schematic pinpointing questions
--
-- Every name, place and number here is illustrative.
SET search_path = vtc, public;

-- ---------------------------------------------------------------------------
-- Floor rubrics
-- ---------------------------------------------------------------------------
UPDATE rubrics SET kind = 'floor' WHERE code IN ('RB-JC-118', 'RB-JC-A211', 'RB-JC-E140', 'RB-JC-W305');

UPDATE rubric_criteria c SET
  category = CASE
    WHEN c.key = 'ppe' THEN 'ppe'
    WHEN c.key IN ('safe_op', 'secured', 'safe_iso', 'hot_work') THEN 'safety'
    WHEN c.key = 'housekeeping' THEN 'hygiene'
    WHEN c.scoring->>'rule' = 'measurement_tolerance' THEN 'precision'
    WHEN c.key IN ('finish', 'visual', 'termination', 'torque') THEN 'quality'
    ELSE 'method' END,
  photo_rule = CASE WHEN c.is_gate THEN 'on_fail' WHEN c.key IN ('finish', 'visual') THEN 'always' ELSE 'optional' END,
  sort_order = CASE WHEN c.is_gate THEN 10 WHEN c.scoring->>'rule' = 'measurement_tolerance' THEN 30 WHEN c.key = 'housekeeping' THEN 90 ELSE 50 END,
  descriptors = CASE c.scoring->>'rule'
    WHEN 'rating' THEN CASE c.key
      WHEN 'housekeeping' THEN '[{"value":1,"en":"Unsafe mess","ar":"فوضى غير آمنة"},{"value":2,"en":"Untidy","ar":"غير مرتب"},{"value":3,"en":"Tidy","ar":"مرتب"},{"value":4,"en":"Exemplary","ar":"نموذجي"}]'::jsonb
      ELSE '[{"value":1,"en":"Needs help","ar":"يحتاج مساعدة"},{"value":2,"en":"Developing","ar":"في تطور"},{"value":3,"en":"Competent","ar":"كفء"},{"value":4,"en":"Excellent","ar":"ممتاز"}]'::jsonb END
    WHEN 'check' THEN '[{"value":"pass","en":"Met","ar":"مستوفى"},{"value":"fail","en":"Not met — stop work","ar":"غير مستوفى — أوقف العمل"}]'::jsonb
    ELSE '[]'::jsonb END
  FROM rubrics r WHERE r.id = c.rubric_id AND r.kind = 'floor';

-- ---------------------------------------------------------------------------
-- Consumables: what one attempt at each job card uses
-- ---------------------------------------------------------------------------
INSERT INTO task_consumables (rubric_id, consumable_id, qty_per_task)
SELECT r.id, c.id, x.qty
  FROM (VALUES
    ('RB-JC-118', 'BAR-C45-30', 0.15), ('RB-JC-118', 'INS-CNMG-12', 0.25), ('RB-JC-118', 'CUT-FLUID-5', 0.2),
    ('RB-JC-A211', 'PAD-F-SET', 0.5), ('RB-JC-A211', 'BRK-FLUID', 0.15),
    ('RB-JC-E140', 'CBL-TE-2.5', 4), ('RB-JC-E140', 'LOTO-TAG', 1), ('RB-JC-E140', 'FUSE-2A-10', 0.5),
    ('RB-JC-W305', 'WIRE-ER70-1.0', 0.25), ('RB-JC-W305', 'PLATE-10', 2), ('RB-JC-W305', 'TIP-1.0', 0.2)
  ) AS x(rubric, sku, qty)
  JOIN rubrics r ON r.code = x.rubric
  JOIN workshops w ON w.observation_rubric_id = r.id
  JOIN consumables c ON c.sku = x.sku AND c.workshop_id = w.id;

UPDATE consumables SET lead_time_days = CASE WHEN sku IN ('GAS-M21', 'BAR-C45-30', 'PLATE-10') THEN 10 WHEN sku LIKE 'FUSE%' THEN 3 ELSE 5 END,
       unit_cost = CASE sku WHEN 'BAR-C45-30' THEN 210 WHEN 'INS-CNMG-12' THEN 95 WHEN 'CBL-TE-2.5' THEN 18 WHEN 'WIRE-ER70-1.0' THEN 120
                            WHEN 'PLATE-10' THEN 45 WHEN 'PAD-F-SET' THEN 640 ELSE 30 END;

-- Two weeks of issues to practical tasks, so burn rates and days of cover are real.
-- Stock levels are put back afterwards: the demo opens at the levels demo.sql set.
CREATE TEMP TABLE demo_stock AS SELECT id, on_hand FROM consumables;
UPDATE consumables SET on_hand = on_hand + 100000;
INSERT INTO consumable_movements (consumable_id, delta, reason, user_id, occurred_at)
SELECT tc.consumable_id,
       -tc.qty_per_task * round((SELECT count(*) FROM workshop_assets wa WHERE wa.workshop_id = w.id AND wa.category = 'machine')
                                * (0.6 + (abs(hashtext(tc.consumable_id::text || d::text)) % 40) / 100.0)), 'issue',
       COALESCE((SELECT m.user_id FROM cohort_members m JOIN cohorts co ON co.id = m.cohort_id
                  WHERE co.trade_id = w.trade_id AND m.member_role = 'vocational_trainer' LIMIT 1), '00000000-0000-0000-0000-0000000000b2'),
       d + time '10:30'
  FROM task_consumables tc JOIN rubrics r ON r.id = tc.rubric_id JOIN workshops w ON w.observation_rubric_id = r.id
  CROSS JOIN generate_series(current_date - 14, current_date - 1, interval '1 day') d
 WHERE extract(isodow FROM d) NOT IN (5, 6);
UPDATE consumables c SET on_hand = s.on_hand FROM demo_stock s WHERE s.id = c.id;

-- ---------------------------------------------------------------------------
-- Safety pre-checks, QR codes and interlocks
-- ---------------------------------------------------------------------------
INSERT INTO safety_prechecks (id, institution_id, code, title, title_ar, trade_id, items, draw_count, pass_mark, passport_hours, unlock_minutes) VALUES
('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000a1', 'PC-CNC-LATHE', 'CNC lathe pre-start check', 'فحص ما قبل تشغيل مخرطة CNC', 'cnc', $j$[
 {"id":"cnc1","critical":true,"prompt":{"en":"Before you press Cycle Start, where is the chuck key?","ar":"قبل الضغط على بدء الدورة، أين يكون مفتاح الظرف؟"},
  "options":[{"id":"a","en":"Removed from the chuck and on its holder","ar":"منزوع من الظرف وفي حامله"},{"id":"b","en":"Left in the chuck for the next part","ar":"متروك في الظرف للقطعة التالية"},{"id":"c","en":"On the tool turret","ar":"على برج العدد"}],"correct":"a",
  "why":{"en":"A key left in a spinning chuck is thrown out at speed.","ar":"المفتاح المتروك في ظرف دوّار يُقذف بسرعة عالية."}},
 {"id":"cnc2","critical":true,"prompt":{"en":"The machine may run with the door…","ar":"يمكن تشغيل الماكينة والباب…"},
  "options":[{"id":"a","en":"Closed, with the interlock working","ar":"مغلق مع عمل قفل الأمان"},{"id":"b","en":"Open, to watch the cut","ar":"مفتوح لمراقبة القطع"},{"id":"c","en":"Half open for coolant","ar":"نصف مفتوح لسائل التبريد"}],"correct":"a",
  "why":{"en":"Never defeat the door interlock; chips and broken inserts fly out.","ar":"لا تعطّل قفل الباب أبدًا؛ فالرايش والأقلام المكسورة تتطاير."}},
 {"id":"cnc3","prompt":{"en":"What do you do with loose sleeves and rings?","ar":"ماذا تفعل بالأكمام الواسعة والخواتم؟"},
  "options":[{"id":"a","en":"Roll sleeves up, remove rings and watch","ar":"أشمّر الأكمام وأخلع الخواتم والساعة"},{"id":"b","en":"Nothing if gloves are worn","ar":"لا شيء إذا لبست القفازات"},{"id":"c","en":"Tape them","ar":"أثبتها بشريط لاصق"}],"correct":"a"},
 {"id":"cnc4","prompt":{"en":"How do you clear swarf from the chuck?","ar":"كيف تزيل الرايش من الظرف؟"},
  "options":[{"id":"a","en":"Spindle stopped, with a chip hook or brush","ar":"مع توقف العمود، بخطاف أو فرشاة رايش"},{"id":"b","en":"By hand at low speed","ar":"باليد على سرعة منخفضة"},{"id":"c","en":"With compressed air at the operator","ar":"بالهواء المضغوط نحو المشغّل"}],"correct":"a"},
 {"id":"cnc5","prompt":{"en":"The tool is about to crash into the chuck. First press…","ar":"العدّة على وشك الاصطدام بالظرف. اضغط أولًا…"},
  "options":[{"id":"a","en":"Emergency stop","ar":"زر الطوارئ"},{"id":"b","en":"Reset","ar":"إعادة الضبط"},{"id":"c","en":"Single block","ar":"الكتلة المفردة"}],"correct":"a"},
 {"id":"cnc6","prompt":{"en":"Which eye protection is required at the lathe?","ar":"ما حماية العين المطلوبة عند المخرطة؟"},
  "options":[{"id":"a","en":"Side-shielded safety glasses","ar":"نظارة أمان بواقيات جانبية"},{"id":"b","en":"None behind the door","ar":"لا شيء خلف الباب"},{"id":"c","en":"Prescription glasses","ar":"النظارة الطبية"}],"correct":"a"}
]$j$, 4, 100, 8, 120),
('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000a1', 'PC-ELEC-RIG', 'Live rig pre-check', 'فحص ما قبل العمل على اللوحة', 'elec', $j$[
 {"id":"el1","critical":true,"prompt":{"en":"Before opening the panel you must…","ar":"قبل فتح اللوحة يجب عليك…"},
  "options":[{"id":"a","en":"Isolate, lock, tag and prove dead","ar":"العزل والقفل والتعليم وإثبات انعدام الجهد"},{"id":"b","en":"Switch off at the start button","ar":"الإيقاف من زر البدء"},{"id":"c","en":"Wear gloves and work live","ar":"لبس القفازات والعمل والجهد موجود"}],"correct":"a",
  "why":{"en":"Safe isolation is the gate for every panel task.","ar":"العزل الآمن شرط لكل عمل داخل اللوحة."}},
 {"id":"el2","critical":true,"prompt":{"en":"When proving dead, you test the voltage tester…","ar":"عند إثبات انعدام الجهد، تختبر جهاز الفحص…"},
  "options":[{"id":"a","en":"On a known live source before and after","ar":"على مصدر معروف قبل الفحص وبعده"},{"id":"b","en":"Only once a month","ar":"مرة في الشهر فقط"},{"id":"c","en":"It does not need testing","ar":"لا يحتاج إلى فحص"}],"correct":"a",
  "why":{"en":"A dead tester reads 0 V on a live circuit.","ar":"جهاز الفحص المعطّل يقرأ 0 فولت على دائرة حية."}},
 {"id":"el3","prompt":{"en":"Who may remove your padlock from the isolator?","ar":"من يحق له إزالة قفلك من المفصل؟"},
  "options":[{"id":"a","en":"Only you","ar":"أنت فقط"},{"id":"b","en":"Any trainer","ar":"أي مدرب"},{"id":"c","en":"The next learner","ar":"المتدرب التالي"}],"correct":"a"},
 {"id":"el4","prompt":{"en":"Which meter category is right for the distribution board?","ar":"ما فئة جهاز القياس المناسبة للوحة التوزيع؟"},
  "options":[{"id":"a","en":"CAT III or higher","ar":"CAT III أو أعلى"},{"id":"b","en":"CAT I","ar":"CAT I"},{"id":"c","en":"Any meter","ar":"أي جهاز"}],"correct":"a"},
 {"id":"el5","prompt":{"en":"When may the rig be energised?","ar":"متى يمكن توصيل التيار للوحة التدريب؟"},
  "options":[{"id":"a","en":"After the trainer has inspected the wiring","ar":"بعد فحص المدرب للتوصيلات"},{"id":"b","en":"As soon as the last wire is in","ar":"فور تركيب آخر سلك"},{"id":"c","en":"When the next group arrives","ar":"عند وصول المجموعة التالية"}],"correct":"a"},
 {"id":"el6","prompt":{"en":"Insulating gloves for 400 V work are…","ar":"القفازات العازلة لأعمال 400 فولت هي…"},
  "options":[{"id":"a","en":"Class 0, checked for holes before use","ar":"الفئة 0 وتُفحص من الثقوب قبل الاستخدام"},{"id":"b","en":"Leather welding gloves","ar":"قفازات لحام جلدية"},{"id":"c","en":"Nitrile gloves","ar":"قفازات نيتريل"}],"correct":"a"}
]$j$, 4, 100, 8, 90),
('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-0000000000a1', 'PC-AUTO-BAY', 'Vehicle bay pre-check', 'فحص ما قبل العمل في حجرة السيارة', 'auto', $j$[
 {"id":"au1","critical":true,"prompt":{"en":"Before going under a raised vehicle…","ar":"قبل الدخول تحت مركبة مرفوعة…"},
  "options":[{"id":"a","en":"Engage the lift's mechanical locks","ar":"تعشيق الأقفال الميكانيكية للرافعة"},{"id":"b","en":"Keep a hand on the lift control","ar":"إبقاء اليد على زر الرافعة"},{"id":"c","en":"Ask someone to watch","ar":"طلب مراقبة من شخص آخر"}],"correct":"a",
  "why":{"en":"Hydraulics can drift; only the locks hold the load.","ar":"الهيدروليك قد ينزل تدريجيًا؛ الأقفال وحدها تحمل الحمل."}},
 {"id":"au2","critical":true,"prompt":{"en":"A car is on a trolley jack only. You may…","ar":"سيارة مرفوعة على كريك فقط. يمكنك…"},
  "options":[{"id":"a","en":"Not work under it until axle stands are in place","ar":"عدم العمل تحتها حتى توضع حوامل المحاور"},{"id":"b","en":"Work under it briefly","ar":"العمل تحتها لفترة قصيرة"},{"id":"c","en":"Work under it if the handbrake is on","ar":"العمل تحتها إذا كانت فرملة اليد مشدودة"}],"correct":"a"},
 {"id":"au3","prompt":{"en":"Disconnecting the battery, which terminal comes off first?","ar":"عند فصل البطارية، أي قطب يُفصل أولًا؟"},
  "options":[{"id":"a","en":"Negative (−)","ar":"السالب (−)"},{"id":"b","en":"Positive (+)","ar":"الموجب (+)"},{"id":"c","en":"Either","ar":"أيهما"}],"correct":"a"},
 {"id":"au4","prompt":{"en":"Wheels on the ground while you work on the other axle are…","ar":"العجلات الملامسة للأرض أثناء العمل على المحور الآخر…"},
  "options":[{"id":"a","en":"Chocked","ar":"تُثبّت بمساند"},{"id":"b","en":"Left free","ar":"تُترك حرة"},{"id":"c","en":"Deflated","ar":"تُفرّغ من الهواء"}],"correct":"a"},
 {"id":"au5","prompt":{"en":"Brake fluid spills on the floor. You…","ar":"انسكب زيت فرامل على الأرض. تقوم بـ…"},
  "options":[{"id":"a","en":"Cover with absorbent and report it","ar":"تغطيته بمادة ماصة والإبلاغ"},{"id":"b","en":"Hose it into the drain","ar":"غسله إلى المصرف"},{"id":"c","en":"Leave it to evaporate","ar":"تركه يتبخر"}],"correct":"a"},
 {"id":"au6","prompt":{"en":"The engine has just been run. Before touching the exhaust…","ar":"تم تشغيل المحرك للتو. قبل لمس العادم…"},
  "options":[{"id":"a","en":"Let it cool or wear heat-resistant gloves","ar":"اتركه يبرد أو البس قفازات مقاومة للحرارة"},{"id":"b","en":"Touch it quickly","ar":"المسه بسرعة"},{"id":"c","en":"Spray it with water","ar":"رشّه بالماء"}],"correct":"a"}
]$j$, 4, 100, 8, 120),
('00000000-0000-0000-0000-00000000aa04', '00000000-0000-0000-0000-0000000000a1', 'PC-WELD-BOOTH', 'Welding booth pre-check', 'فحص ما قبل العمل في كابينة اللحام', 'weld', $j$[
 {"id":"we1","critical":true,"prompt":{"en":"Before striking an arc, the fume extraction is…","ar":"قبل بدء القوس، يكون شفط الأدخنة…"},
  "options":[{"id":"a","en":"On, with the hood near the joint","ar":"يعمل والغطاء قريب من الوصلة"},{"id":"b","en":"Off to keep the gas shield","ar":"متوقفًا للحفاظ على غاز الحماية"},{"id":"c","en":"Only on for stainless","ar":"يعمل للستانلس فقط"}],"correct":"a",
  "why":{"en":"Welding fume is a carcinogen; extraction is a hot-work gate.","ar":"أدخنة اللحام مسرطنة؛ والشفط شرط أساسي للأعمال الساخنة."}},
 {"id":"we2","critical":true,"prompt":{"en":"Flammable material near the booth must be…","ar":"المواد القابلة للاشتعال قرب الكابينة يجب…"},
  "options":[{"id":"a","en":"Removed or shielded, screens closed","ar":"إزالتها أو حجبها وإغلاق الستائر"},{"id":"b","en":"Kept within reach","ar":"إبقاؤها في المتناول"},{"id":"c","en":"Wetted","ar":"ترطيبها"}],"correct":"a"},
 {"id":"we3","prompt":{"en":"Filter shade for MIG at 150–250 A?","ar":"درجة العدسة للحام MIG عند 150–250 أمبير؟"},
  "options":[{"id":"a","en":"Shade 11–13","ar":"الدرجة 11–13"},{"id":"b","en":"Shade 5","ar":"الدرجة 5"},{"id":"c","en":"Clear glasses","ar":"نظارة شفافة"}],"correct":"a"},
 {"id":"we4","prompt":{"en":"The gas cylinder must be…","ar":"أسطوانة الغاز يجب أن تكون…"},
  "options":[{"id":"a","en":"Upright and chained","ar":"قائمة ومثبتة بسلسلة"},{"id":"b","en":"Lying on the floor","ar":"ممددة على الأرض"},{"id":"c","en":"Next to the arc","ar":"بجوار القوس"}],"correct":"a"},
 {"id":"we5","prompt":{"en":"Where does the work-return clamp go?","ar":"أين يوضع ملقط الأرضي (العودة)؟"},
  "options":[{"id":"a","en":"On the workpiece, close to the weld","ar":"على القطعة قريبًا من اللحام"},{"id":"b","en":"On the bench leg","ar":"على رجل الطاولة"},{"id":"c","en":"On the gas pipe","ar":"على أنبوب الغاز"}],"correct":"a"},
 {"id":"we6","prompt":{"en":"Your gloves are wet. You…","ar":"قفازاتك مبللة. تقوم بـ…"},
  "options":[{"id":"a","en":"Change to dry gloves before welding","ar":"تغييرها بقفازات جافة قبل اللحام"},{"id":"b","en":"Weld faster","ar":"تلحم بسرعة أكبر"},{"id":"c","en":"Dry them on the hot plate","ar":"تجفيفها على اللوح الساخن"}],"correct":"a"}
]$j$, 4, 100, 8, 120);

UPDATE workshop_assets a SET
  qr_code = 'VTC-' || upper(substr(md5('qr-' || a.asset_tag), 1, 10)),
  precheck_id = CASE w.trade_id WHEN 'cnc' THEN '00000000-0000-0000-0000-00000000aa01'::uuid WHEN 'elec' THEN '00000000-0000-0000-0000-00000000aa02'::uuid
                                WHEN 'auto' THEN '00000000-0000-0000-0000-00000000aa03'::uuid WHEN 'weld' THEN '00000000-0000-0000-0000-00000000aa04'::uuid END
  FROM workshops w WHERE w.id = a.workshop_id AND a.category = 'machine';
-- One lathe has a real interlock controller (key "demo-controller-CNC2-L01"); the rest use the virtual controller.
UPDATE workshop_assets SET controller_key_hash = encode(digest('demo-controller-CNC2-L01', 'sha256'), 'hex'), controller_seen_at = now() - interval '20 seconds'
 WHERE asset_tag = 'CNC2-L01';

-- Stations already in use get the passport and unlock that let them in.
CREATE TEMP TABLE demo_live AS
SELECT ac.id AS checkout_id, ac.asset_id, ac.user_id, ac.checked_out_at, a.precheck_id, pc.items
  FROM asset_checkouts ac JOIN workshop_assets a ON a.id = ac.asset_id JOIN safety_prechecks pc ON pc.id = a.precheck_id
 WHERE ac.returned_at IS NULL AND ac.access_granted;
INSERT INTO safety_precheck_attempts (id, precheck_id, asset_id, learner_id, served_item_ids, answers, score, passed, started_at, submitted_at, expires_at)
SELECT md5('pca-' || checkout_id)::uuid, precheck_id, asset_id, user_id,
       ARRAY(SELECT i->>'id' FROM jsonb_array_elements(items) i LIMIT 4),
       (SELECT jsonb_object_agg(i->>'id', i->>'correct') FROM (SELECT i FROM jsonb_array_elements(items) i LIMIT 4) x),
       100, true, checked_out_at - interval '2 minutes', checked_out_at - interval '1 minute', checked_out_at + interval '8 minutes'
  FROM demo_live;
INSERT INTO safety_passports (id, learner_id, asset_id, precheck_id, attempt_id, issued_at, valid_until)
SELECT md5('pp-' || checkout_id)::uuid, user_id, asset_id, precheck_id, md5('pca-' || checkout_id)::uuid, checked_out_at - interval '1 minute', checked_out_at + interval '8 hours'
  FROM demo_live;
INSERT INTO machine_locks (asset_id, learner_id, passport_id, checkout_id, state, token_hash, issued_at, token_expires_at, unlocked_at, session_ends_at)
SELECT asset_id, user_id, md5('pp-' || checkout_id)::uuid, checkout_id, 'unlocked', md5('tok-' || checkout_id) || md5('tok2-' || checkout_id),
       checked_out_at - interval '1 minute', checked_out_at + interval '1 minute', checked_out_at, checked_out_at + interval '4 hours'
  FROM demo_live;
UPDATE workshop_assets SET status = 'in_use' WHERE id IN (SELECT asset_id FROM demo_live);

-- A failed pre-check this morning (wrong answer on the chuck-key item).
INSERT INTO safety_precheck_attempts (precheck_id, asset_id, learner_id, served_item_ids, answers, score, passed, critical_missed, started_at, submitted_at, expires_at)
SELECT '00000000-0000-0000-0000-00000000aa01', a.id, u.id, ARRAY['cnc1', 'cnc2', 'cnc4', 'cnc5'],
       '{"cnc1":"b","cnc2":"a","cnc4":"a","cnc5":"a"}', 75, false, ARRAY['cnc1'], now() - interval '50 minutes', now() - interval '49 minutes', now() - interval '40 minutes'
  FROM users u, workshop_assets a WHERE u.email = 'learner07@vtc.example' AND a.asset_tag = 'CNC2-L07';

-- ---------------------------------------------------------------------------
-- Placements for every trade, and three weeks of geofenced shifts
-- ---------------------------------------------------------------------------
INSERT INTO employers (id, name, sector) VALUES
  ('00000000-0000-0000-0000-0000000002e5', 'Nasr Auto Service Centre', 'Automotive aftersales'),
  ('00000000-0000-0000-0000-0000000003e5', 'Delta Switchgear', 'Electrical manufacturing'),
  ('00000000-0000-0000-0000-0000000004e5', 'Suez Steel Fabrication', 'Structural steel');
INSERT INTO employer_sites (id, employer_id, name, latitude, longitude, geofence_radius_m) VALUES
  ('00000000-0000-0000-0000-0000000002e6', '00000000-0000-0000-0000-0000000002e5', 'Nasr City workshop', 30.0561, 31.3300, 150),
  ('00000000-0000-0000-0000-0000000003e6', '00000000-0000-0000-0000-0000000003e5', 'Badr City plant, Line 2', 30.1360, 31.7150, 250),
  ('00000000-0000-0000-0000-0000000004e6', '00000000-0000-0000-0000-0000000004e5', 'Ataka fabrication yard', 29.9668, 32.5498, 300);

INSERT INTO wbl_placements (id, learner_id, site_id, supervisor_id, coordinator_id, starts_on, ends_on, required_hours)
SELECT md5('placement' || u.id)::uuid, u.id,
       CASE c.trade_id WHEN 'auto' THEN '00000000-0000-0000-0000-0000000002e6' WHEN 'elec' THEN '00000000-0000-0000-0000-0000000003e6'
                       ELSE '00000000-0000-0000-0000-0000000004e6' END::uuid,
       '00000000-0000-0000-0000-0000000000b4',
       (SELECT m2.user_id FROM cohort_members m2 WHERE m2.cohort_id = c.id AND m2.member_role = 'vocational_trainer' ORDER BY m2.user_id DESC LIMIT 1),
       current_date - 30, current_date + 70, 120
  FROM users u JOIN cohort_members m ON m.user_id = u.id AND m.member_role = 'student' JOIN cohorts c ON c.id = m.cohort_id
 WHERE c.trade_id IN ('auto', 'elec', 'weld')
   AND (u.email LIKE 'student.%' OR u.email ~ '^learner\.(auto|elec|weld)0[2-3]@');

-- Two OJT days a week (Mon and Wed) since the placement started (up to nine weeks). A few learners
-- miss days or leave the fence, which the early warning picks up.
DO $$
DECLARE pl record; d date; cin uuid; cout uuid; slip float; miss boolean; outside boolean;
BEGIN
  FOR pl IN SELECT p.id, p.learner_id, p.starts_on, es.latitude, es.longitude, u.email
              FROM wbl_placements p JOIN employer_sites es ON es.id = p.site_id JOIN users u ON u.id = p.learner_id LOOP
    FOR d IN SELECT x::date FROM generate_series(GREATEST(pl.starts_on, current_date - 63), current_date - 1, interval '1 day') x
              WHERE extract(isodow FROM x) IN (1, 3) LOOP
      miss := pl.email IN ('learner05@vtc.example', 'learner.elec03@vtc.example') AND abs(hashtext(pl.id::text || d)) % 3 <> 0;
      CONTINUE WHEN miss;
      outside := pl.email = 'learner.auto03@vtc.example' AND abs(hashtext(pl.id::text || d)) % 3 = 0;
      slip := (abs(hashtext(d::text || pl.id::text)) % 40) / 100000.0;
      INSERT INTO wbl_checkins (placement_id, kind, device_time, server_time, latitude, longitude, accuracy_m, accepted, source)
      VALUES (pl.id, 'in', d + time '07:55' + make_interval(mins => abs(hashtext(pl.id::text || d)) % 20), d + time '07:56',
              pl.latitude + slip, pl.longitude - slip, 9 + abs(hashtext(d::text)) % 15, true, 'gps') RETURNING id INTO cin;
      INSERT INTO wbl_checkins (placement_id, kind, device_time, server_time, latitude, longitude, accuracy_m, accepted, source)
      VALUES (pl.id, 'out', d + time '15:20' + make_interval(mins => abs(hashtext(d || pl.id::text)) % 40), d + time '15:30',
              pl.latitude + CASE WHEN outside THEN 0.006 ELSE slip END, pl.longitude + slip, 11, true, 'gps') RETURNING id INTO cout;
      INSERT INTO ojt_attendance (placement_id, checkin_id, checkout_id, opened_at, closed_at, status, verified, flags)
      SELECT pl.id, cin, cout, ci.device_time, co.device_time, 'closed', ci.inside_geofence AND co.inside_geofence,
             CASE WHEN co.inside_geofence THEN '{}'::text[] ELSE ARRAY['checkout_outside'] END
        FROM wbl_checkins ci, wbl_checkins co WHERE ci.id = cin AND co.id = cout;
    END LOOP;
  END LOOP;
END $$;
-- The CNC learner checked in this morning and is on site now.
INSERT INTO wbl_checkins (id, placement_id, kind, device_time, latitude, longitude, accuracy_m, source)
SELECT '00000000-0000-0000-0000-00000000cc01', p.id, 'in', now() - interval '3 hours', 30.2937, 31.7430, 8, 'gps'
  FROM wbl_placements p JOIN users u ON u.id = p.learner_id WHERE u.email = 'learner01@vtc.example';
INSERT INTO ojt_attendance (placement_id, checkin_id, opened_at)
SELECT placement_id, id, device_time FROM wbl_checkins WHERE id = '00000000-0000-0000-0000-00000000cc01';

-- Logbook entries with photos for the new placements (awaiting sign-off).
INSERT INTO wbl_logbook_entries (placement_id, work_date, hours, task_summary, competency_ids, status, submitted_at, attendance_id)
SELECT a.placement_id, a.opened_at::date, round((a.minutes / 60.0)::numeric, 1),
       CASE es.id WHEN '00000000-0000-0000-0000-0000000002e6' THEN 'Replaced front brake pads and measured disc runout on a customer Corolla with the bay technician.'
                  WHEN '00000000-0000-0000-0000-0000000003e6' THEN 'Wired and tested a DOL starter for the Line 2 conveyor under supervision; logged insulation resistance.'
                  ELSE 'Tacked and welded 6 mm fillet brackets for the platform frame; checked leg length with the gauge.' END,
       '{}', 'submitted', a.closed_at, a.id
  FROM ojt_attendance a JOIN wbl_placements p ON p.id = a.placement_id JOIN employer_sites es ON es.id = p.site_id
 WHERE es.id IN ('00000000-0000-0000-0000-0000000002e6', '00000000-0000-0000-0000-0000000003e6', '00000000-0000-0000-0000-0000000004e6')
   AND a.opened_at >= current_date - 7;

-- ---------------------------------------------------------------------------
-- Early-warning inputs: final practical dates, attendance, quiz history
-- ---------------------------------------------------------------------------
UPDATE cohorts SET final_practical_on = current_date + CASE trade_id WHEN 'cnc' THEN 18 WHEN 'auto' THEN 25 WHEN 'elec' THEN 40 ELSE 32 END;

INSERT INTO class_attendance (cohort_id, learner_id, session_date, period, status, recorded_by)
SELECT m.cohort_id, m.user_id, d::date, 'day',
       CASE WHEN r < CASE WHEN u.email IN ('learner05@vtc.example', 'learner.auto05@vtc.example', 'learner.elec06@vtc.example', 'learner.weld04@vtc.example') THEN 32 ELSE 4 END THEN 'absent'
            WHEN r < CASE WHEN u.email IN ('learner05@vtc.example', 'learner.weld04@vtc.example') THEN 45 ELSE 10 END THEN 'late'
            WHEN r > 97 THEN 'excused' ELSE 'present' END,
       (SELECT t.user_id FROM cohort_members t WHERE t.cohort_id = m.cohort_id AND t.member_role = 'vocational_trainer' LIMIT 1)
  FROM cohort_members m JOIN users u ON u.id = m.user_id
  CROSS JOIN generate_series(current_date - 30, current_date - 1, interval '1 day') d
  CROSS JOIN LATERAL (SELECT abs(hashtext(m.user_id::text || d::text)) % 100 AS r) x
 WHERE m.member_role = 'student' AND extract(isodow FROM d) NOT IN (5, 6);

-- Quiz history: at-risk learners score low.
INSERT INTO question_attempts (question_id, version, learner_id, assessment_id, response, points_awarded, is_correct, attempted_at)
SELECT v.question_id, v.version, m.user_id, md5('quiz' || m.user_id)::uuid, '{"answer":"demo"}',
       CASE WHEN ok THEN v.max_points ELSE 0 END, ok, now() - make_interval(days => 3 + abs(hashtext(m.user_id::text)) % 10)
  FROM cohort_members m JOIN users u ON u.id = m.user_id JOIN cohorts c ON c.id = m.cohort_id
  JOIN question_competencies qc ON true JOIN competencies comp ON comp.id = qc.competency_id JOIN competency_frameworks f ON f.id = comp.framework_id AND f.trade_id = c.trade_id
  JOIN questions q ON q.id = qc.question_id AND q.status = 'approved' JOIN question_versions v ON v.question_id = q.id AND v.version = q.current_version
  CROSS JOIN LATERAL (SELECT abs(hashtext(m.user_id::text || q.id::text)) % 100 <
         CASE WHEN u.email IN ('learner05@vtc.example', 'learner.auto05@vtc.example', 'learner.elec06@vtc.example', 'learner.weld04@vtc.example', 'learner11@vtc.example') THEN 30 WHEN u.email LIKE 'student%' THEN 101 ELSE 78 END AS ok) x
 WHERE m.member_role = 'student';

-- Machine bookings for the coming week: one practical session a day on
-- every station, which is the demand the stock forecast plans against.
INSERT INTO asset_bookings (asset_id, booked_by, cohort_id, during, purpose)
SELECT a.id, t.user_id, c.id, tstzrange(d + s.start, d + s.start + interval '3 hours'), 'Practical: ' || r.code
  FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id JOIN rubrics r ON r.id = w.observation_rubric_id
  JOIN cohorts c ON c.trade_id = w.trade_id
  JOIN LATERAL (SELECT user_id FROM cohort_members WHERE cohort_id = c.id AND member_role = 'vocational_trainer' LIMIT 1) t ON true
  CROSS JOIN generate_series(current_date + 1, current_date + 7, interval '1 day') d
  CROSS JOIN (VALUES (time '09:00')) AS s(start)
 WHERE a.category = 'machine' AND a.status <> 'maintenance' AND extract(isodow FROM d) NOT IN (5, 6);

-- Stock on the shelf: a spread from "order today" to "well covered", measured
-- in weeks of booked demand, with the reorder point at lead time plus a buffer.
UPDATE consumables c SET
  on_hand = round((f.booked_7d * (ARRAY[0.4, 0.8, 1.5, 2.5, 4])[1 + abs(hashtext(c.sku)) % 5])::numeric, 1),
  reorder_point = round((f.booked_7d / 7.0 * (c.lead_time_days + 3))::numeric, 1)
  FROM v_consumable_forecast f WHERE f.consumable_id = c.id AND f.booked_7d > 0;

-- A couple of recent gate failures on the floor for learners who are slipping.
INSERT INTO workshop_observations (id, learner_id, trainer_id, rubric_id, task_ref, observed_at, measurements)
SELECT md5('obs-risk-' || u.email || n)::uuid, u.id, t.user_id, w.observation_rubric_id, 'risk-demo', now() - make_interval(days => n * 3), '{}'
  FROM users u JOIN cohort_members m ON m.user_id = u.id AND m.member_role = 'student' JOIN cohorts c ON c.id = m.cohort_id
  JOIN workshops w ON w.trade_id = c.trade_id AND w.observation_rubric_id IS NOT NULL
  JOIN LATERAL (SELECT user_id FROM cohort_members WHERE cohort_id = c.id AND member_role = 'vocational_trainer' LIMIT 1) t ON true
  CROSS JOIN generate_series(1, 3) n
 WHERE u.email IN ('learner05@vtc.example', 'learner.auto05@vtc.example', 'learner11@vtc.example', 'learner.weld04@vtc.example');
INSERT INTO rubric_evaluations (rubric_id, subject_type, subject_id, learner_id, evaluator_id, criterion_scores, total_score, passed, gate_failures, evaluated_at)
SELECT o.rubric_id, 'workshop_observation', o.id, o.learner_id, o.trainer_id, '{}', 48 + abs(hashtext(o.id::text)) % 18, false,
       CASE WHEN abs(hashtext(o.id::text)) % 2 = 0 THEN ARRAY['ppe'] ELSE '{}'::text[] END, o.observed_at
  FROM workshop_observations o WHERE o.task_ref = 'risk-demo';
UPDATE consumable_movements m SET occurred_at = o.observed_at
  FROM workshop_observations o WHERE o.id = m.observation_id AND o.task_ref = 'risk-demo';

-- Level history: learners climbed to today's level over the last ten weeks.
INSERT INTO competency_level_history (learner_id, competency_id, level, changed_at)
SELECT lc.learner_id, lc.competency_id, lv.level::proficiency_level,
       COALESCE(lc.last_assessed_at, now()) - make_interval(days => (lc_rank - lv.rank) * (12 + abs(hashtext(lc.learner_id::text || lc.competency_id::text)) % 9))
  FROM learner_competencies lc
  CROSS JOIN LATERAL (SELECT CASE lc.level WHEN 'novice' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'autonomous' THEN 3 WHEN 'master' THEN 4 ELSE 0 END AS lc_rank) r
  JOIN (VALUES ('novice', 1), ('intermediate', 2), ('autonomous', 3)) AS lv(level, rank) ON lv.rank < r.lc_rank
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Parameterised questions: every learner gets their own numbers
-- ---------------------------------------------------------------------------
INSERT INTO questions (id, institution_id, type, bloom, status, author_id, reviewed_by) VALUES
  ('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000a1', 'calculation', 'apply', 'approved', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b3'),
  ('00000000-0000-0000-0000-0000000005f2', '00000000-0000-0000-0000-0000000000a1', 'calculation', 'apply', 'approved', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b3'),
  ('00000000-0000-0000-0000-0000000005f3', '00000000-0000-0000-0000-0000000000a1', 'calculation', 'apply', 'approved', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b3'),
  ('00000000-0000-0000-0000-0000000005f4', '00000000-0000-0000-0000-0000000000a1', 'calculation', 'apply', 'approved', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b3'),
  ('00000000-0000-0000-0000-0000000005f5', '00000000-0000-0000-0000-0000000000a1', 'calculation', 'analyze', 'approved', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b3');
INSERT INTO question_versions (question_id, version, stem, body, answer_key, abs_tolerance, rel_tolerance, max_points) VALUES
  ('00000000-0000-0000-0000-0000000005f1', 1,
   'A shaft is drawn Ø{{n}} ±{{tol}} mm. You measure Ø{{m:3}} mm. By how many mm do you change the X wear offset to bring it back to nominal? (negative = reduce)',
   $j${"template":"A shaft is drawn Ø{{n}} ±{{tol}} mm. You measure Ø{{m:3}} mm. By how many mm do you change the X wear offset to bring it back to nominal? (negative = reduce)",
       "template_ar":"عمود مرسوم بقطر Ø{{n}} ±{{tol}} مم. قست القطر Ø{{m:3}} مم. بكم مليمترًا تعدّل إزاحة تآكل X لإعادته إلى المقاس الاسمي؟ (سالب = تقليل)",
       "derived":{"m":"n + sg * e"},"answer_expr":"n - m","unit":"mm","constraint":"e - tol","answer_decimals":3}$j$, '{}', 0.002, NULL, 2),
  ('00000000-0000-0000-0000-0000000005f2', 1,
   'You are turning a Ø{{d}} mm bar at a cutting speed of {{vc}} m/min. What spindle speed do you programme (rev/min)?',
   $j${"template":"You are turning a Ø{{d}} mm bar at a cutting speed of {{vc}} m/min. What spindle speed do you programme (rev/min)?",
       "template_ar":"تخرط عمودًا قطره Ø{{d}} مم بسرعة قطع {{vc}} م/دقيقة. ما سرعة العمود التي تبرمجها (لفة/دقيقة)؟",
       "answer_expr":"1000 * vc / (pi * d)","unit":"rev/min","answer_decimals":0}$j$, '{}', NULL, 0.02, 2),
  ('00000000-0000-0000-0000-0000000005f3', 1,
   'Resistors R1 = {{R1}} Ω and R2 = {{R2}} Ω are connected in parallel across {{V}} V. What current does the supply deliver (A)?',
   $j${"template":"Resistors R1 = {{R1}} Ω and R2 = {{R2}} Ω are connected in parallel across {{V}} V. What current does the supply deliver (A)?",
       "template_ar":"مقاومتان R1 = {{R1}} أوم وR2 = {{R2}} أوم موصّلتان على التوازي على جهد {{V}} فولت. ما التيار الذي يعطيه المصدر (أمبير)؟",
       "derived":{"Rt":"R1 * R2 / (R1 + R2)"},"answer_expr":"V / Rt","unit":"A","answer_decimals":2}$j$, '{}', NULL, 0.02, 2),
  ('00000000-0000-0000-0000-0000000005f4', 1,
   'An engine of {{m}} kg hangs from a two-leg sling, each leg {{a}}° from vertical. What is the tension in each leg (N)? Use g = 9.81.',
   $j${"template":"An engine of {{m}} kg hangs from a two-leg sling, each leg {{a}}° from vertical. What is the tension in each leg (N)? Use g = 9.81.",
       "template_ar":"محرك كتلته {{m}} كجم معلّق بحمّالة ذات ساقين، كل ساق بزاوية {{a}}° عن الرأسي. ما الشد في كل ساق (نيوتن)؟ استخدم g = 9.81.",
       "answer_expr":"m * 9.81 / (2 * cosd(a))","unit":"N","answer_decimals":0}$j$, '{}', NULL, 0.02, 2),
  ('00000000-0000-0000-0000-0000000005f5', 1,
   'A MIG run is made at {{V}} V and {{I}} A with a travel speed of {{s}} mm/min. Taking arc efficiency as 0.8, what is the heat input (kJ/mm)?',
   $j${"template":"A MIG run is made at {{V}} V and {{I}} A with a travel speed of {{s}} mm/min. Taking arc efficiency as 0.8, what is the heat input (kJ/mm)?",
       "template_ar":"خط لحام MIG عند {{V}} فولت و{{I}} أمبير بسرعة تقدم {{s}} مم/دقيقة. باعتبار كفاءة القوس 0.8، ما الحرارة المدخلة (كيلوجول/مم)؟",
       "answer_expr":"0.8 * V * I * 60 / (1000 * s)","unit":"kJ/mm","answer_decimals":2}$j$, '{}', 0.02, NULL, 2);
INSERT INTO question_parameters (question_id, version, name, min_value, max_value, step, unit, choices) VALUES
  ('00000000-0000-0000-0000-0000000005f1', 1, 'n', 20, 40, 5, 'mm', NULL),
  ('00000000-0000-0000-0000-0000000005f1', 1, 'tol', 0, 0, 1, 'mm', '{0.02,0.05}'),
  ('00000000-0000-0000-0000-0000000005f1', 1, 'e', 0.03, 0.12, 0.005, 'mm', NULL),
  ('00000000-0000-0000-0000-0000000005f1', 1, 'sg', 0, 0, 1, NULL, '{-1,1}'),
  ('00000000-0000-0000-0000-0000000005f2', 1, 'd', 20, 80, 2, 'mm', NULL),
  ('00000000-0000-0000-0000-0000000005f2', 1, 'vc', 120, 240, 10, 'm/min', NULL),
  ('00000000-0000-0000-0000-0000000005f3', 1, 'R1', 10, 100, 5, 'Ω', NULL),
  ('00000000-0000-0000-0000-0000000005f3', 1, 'R2', 10, 100, 5, 'Ω', NULL),
  ('00000000-0000-0000-0000-0000000005f3', 1, 'V', 12, 48, 12, 'V', NULL),
  ('00000000-0000-0000-0000-0000000005f4', 1, 'm', 120, 260, 10, 'kg', NULL),
  ('00000000-0000-0000-0000-0000000005f4', 1, 'a', 15, 45, 5, '°', NULL),
  ('00000000-0000-0000-0000-0000000005f5', 1, 'V', 18, 26, 0.5, 'V', NULL),
  ('00000000-0000-0000-0000-0000000005f5', 1, 'I', 140, 240, 10, 'A', NULL),
  ('00000000-0000-0000-0000-0000000005f5', 1, 's', 250, 450, 25, 'mm/min', NULL);
INSERT INTO question_competencies (question_id, competency_id)
SELECT q, (SELECT id FROM competencies WHERE code = c) FROM (VALUES
  ('00000000-0000-0000-0000-0000000005f1'::uuid, 'CNC-L3-U06-E2'), ('00000000-0000-0000-0000-0000000005f2'::uuid, 'MECH-L3-U05-E2'),
  ('00000000-0000-0000-0000-0000000005f3'::uuid, 'ELEC-L3-U03-E1'), ('00000000-0000-0000-0000-0000000005f4'::uuid, 'AUTO-L3-U01-E1'),
  ('00000000-0000-0000-0000-0000000005f5'::uuid, 'WELD-L3-U04-E1')) AS x(q, c)
 WHERE EXISTS (SELECT 1 FROM competencies WHERE code = c);

-- ---------------------------------------------------------------------------
-- Schematic pinpointing questions (coordinates in each drawing's viewBox)
-- ---------------------------------------------------------------------------
INSERT INTO schematics (id, institution_id, trade_id, code, title, title_ar, kind, view_box, svg, created_by) VALUES
('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-0000000000a1', 'elec', 'SCH-DOL-CTRL', 'DOL starter control circuit', 'دائرة تحكم بادئ DOL', 'wiring', '0 0 800 460', $svg$
<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
  <path d="M60 40H740M60 420H740"/>
  <path d="M400 40V62M400 98V132M400 178V210M400 210H520V222M400 210V222M400 258V272M520 258V272M400 272H520M400 272V300M400 340V372M400 400V420"/>
  <rect x="388" y="62" width="24" height="36"/>
  <circle cx="400" cy="136" r="4"/><circle cx="400" cy="174" r="4"/><path d="M394 140L410 170M380 155H398"/>
  <circle cx="400" cy="226" r="4"/><circle cx="400" cy="254" r="4"/><path d="M406 230L414 252M396 240H382"/>
  <circle cx="520" cy="226" r="4"/><circle cx="520" cy="254" r="4"/><path d="M526 230L534 252"/>
  <circle cx="400" cy="304" r="4"/><circle cx="400" cy="336" r="4"/><path d="M394 308L410 332M378 320H392"/><path d="M372 312h6v16h-6" stroke-width="1.5"/>
  <rect x="380" y="372" width="40" height="28"/>
  <path d="M200 40V100M200 380V420" stroke-dasharray="6 5"/><circle cx="200" cy="240" r="46"/>
</g>
<g fill="currentColor" font-family="IBM Plex Mono, monospace" font-size="15">
  <text x="66" y="30">L1 · 230 V</text><text x="66" y="446">N</text>
  <text x="424" y="86">F2 · 2 A</text><text x="424" y="160">S0 · Stop</text><text x="424" y="246">S1 · Start</text>
  <text x="546" y="246">K1 · 13–14</text><text x="424" y="326">F1 · OL 95–96</text><text x="430" y="392">K1 · A1–A2</text>
  <text x="178" y="246">M1</text><text x="160" y="310" font-size="12">power circuit (not shown)</text>
</g>$svg$, '00000000-0000-0000-0000-0000000003b2'),
('00000000-0000-0000-0000-00000000ab02', '00000000-0000-0000-0000-0000000000a1', 'auto', 'SCH-START-CIRC', 'Starting circuit', 'دائرة بدء التشغيل', 'wiring', '0 0 800 460', $svg$
<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="60" y="180" width="110" height="70" rx="4"/><path d="M80 180v-10M150 180v-10"/>
  <path d="M150 170V80H560" stroke-width="4"/>
  <path d="M250 80V130"/><rect x="238" y="130" width="24" height="34"/><path d="M250 164V212"/>
  <rect x="215" y="212" width="70" height="44" rx="4"/><path d="M285 234H370"/>
  <rect x="370" y="212" width="74" height="44" rx="4"/><path d="M444 234H585V100"/>
  <rect x="530" y="60" width="110" height="40" rx="4"/>
  <circle cx="610" cy="200" r="50"/><path d="M610 100V150"/>
  <path d="M80 250V380L100 370L120 390L140 370L160 390L180 370L200 390L220 370L240 390L260 370L280 380H300" stroke-width="3"/>
  <rect x="300" y="350" width="220" height="60" rx="6"/><path d="M610 250V320L520 360"/>
</g>
<g fill="currentColor" font-family="IBM Plex Mono, monospace" font-size="15">
  <text x="72" y="222">BATTERY 12 V</text><text x="142" y="164">+</text><text x="74" y="164">−</text>
  <text x="270" y="152">F · 30 A</text><text x="222" y="275">Ignition sw.</text><text x="378" y="275">Starter relay</text>
  <text x="540" y="54">Solenoid 30 / 50</text><text x="590" y="205">M</text><text x="340" y="384">ENGINE BLOCK</text>
  <text x="96" y="420">Engine ground strap</text>
</g>$svg$, '00000000-0000-0000-0000-0000000002b2'),
('00000000-0000-0000-0000-00000000ab03', '00000000-0000-0000-0000-0000000000a1', 'weld', 'SCH-TJOINT-MACRO', 'T-joint fillet weld, macro section', 'لحام زاوية لوصلة T، مقطع ماكرو', 'weld_drawing', '0 0 600 420', $svg$
<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">
  <rect x="60" y="300" width="480" height="50"/><rect x="270" y="60" width="50" height="240"/>
  <path d="M320 300V240Q338 278 380 300Z" fill="currentColor" fill-opacity=".18"/>
  <path d="M270 300V240Q252 278 210 300Z" fill="currentColor" fill-opacity=".18"/>
  <path d="M330 314H380M330 308v12M380 308v12" stroke-width="1.5"/>
</g>
<g fill="currentColor" font-family="IBM Plex Mono, monospace" font-size="14">
  <text x="392" y="330">leg 6 mm</text><text x="340" y="232">upper toe</text><text x="392" y="296">lower toe</text>
  <text x="340" y="380">root</text><text x="130" y="232">left fillet</text><text x="284" y="52">web 10 mm</text><text x="64" y="370">flange 10 mm</text>
</g>$svg$, '00000000-0000-0000-0000-0000000004b2');

INSERT INTO questions (id, institution_id, type, bloom, status, author_id, reviewed_by) VALUES
  ('00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000000a1', 'hotspot', 'analyze', 'approved', '00000000-0000-0000-0000-0000000003b2', '00000000-0000-0000-0000-0000000000b3'),
  ('00000000-0000-0000-0000-0000000006f2', '00000000-0000-0000-0000-0000000000a1', 'hotspot', 'analyze', 'approved', '00000000-0000-0000-0000-0000000002b2', '00000000-0000-0000-0000-0000000000b3'),
  ('00000000-0000-0000-0000-0000000006f3', '00000000-0000-0000-0000-0000000000a1', 'hotspot', 'evaluate', 'approved', '00000000-0000-0000-0000-0000000004b2', '00000000-0000-0000-0000-0000000000b3');
INSERT INTO question_versions (question_id, version, stem, body, answer_key, max_points) VALUES
  ('00000000-0000-0000-0000-0000000006f1', 1,
   'Pressing S1 does nothing. With S1 held you measure 230 V across 95–96 and 0 V across A1–A2. Pin the faulty component.',
   '{"stem_ar":"الضغط على S1 لا يفعل شيئًا. مع إبقاء S1 مضغوطًا تقيس 230 فولت بين 95–96 و0 فولت بين A1–A2. حدّد المكوّن المعطّل بدبوس.","max_pins":2,"extra_pin_penalty":0.5}', '{}', 2),
  ('00000000-0000-0000-0000-0000000006f2', 1,
   'The starter turns slowly. During cranking you read 1.8 V between battery negative and the engine block, and 0.2 V on the positive side. Pin the fault.',
   '{"stem_ar":"البادئ يدور ببطء. أثناء التدوير تقرأ 1.8 فولت بين سالب البطارية وكتلة المحرك و0.2 فولت على الجانب الموجب. حدّد العطل بدبوس.","max_pins":2,"extra_pin_penalty":0.5}', '{}', 2),
  ('00000000-0000-0000-0000-0000000006f3', 1,
   'The macro-etch of the right-hand fillet shows lack of root fusion and undercut at the upper toe. Pin both defects.',
   '{"stem_ar":"يظهر مقطع الماكرو للحام الزاوية الأيمن عدم انصهار في الجذر وتآكلًا عند الحافة العليا. حدّد العيبين بدبوسين.","max_pins":3,"extra_pin_penalty":0.5}', '{}', 2);
INSERT INTO schematic_hotspots (question_id, version, key, schematic_id, role, shape, geometry, tolerance, points, label, label_ar, feedback) VALUES
  ('00000000-0000-0000-0000-0000000006f1', 1, 'OL-95-96', '00000000-0000-0000-0000-00000000ab01', 'target', 'circle', '{"cx":400,"cy":320,"r":26}', 10, 1, 'Overload contact 95–96', 'تلامس الحمل الزائد 95–96',
   '{"en":"Full supply voltage across a closed contact means it is open: the overload has tripped or the contact is burnt.","ar":"وجود جهد المصدر كاملًا على تلامس يُفترض أنه مغلق يعني أنه مفتوح: الحمل الزائد فصل أو التلامس محترق."}'),
  ('00000000-0000-0000-0000-0000000006f1', 1, 'K1-COIL', '00000000-0000-0000-0000-00000000ab01', 'distractor', 'rect', '{"x":376,"y":368,"w":48,"h":36}', 6, 0, 'K1 coil', 'ملف K1',
   '{"en":"0 V across A1–A2 means the coil is not getting supply; it is not proven faulty.","ar":"0 فولت على A1–A2 يعني أن الملف لا يصله جهد؛ ولم يثبت أنه معطّل."}'),
  ('00000000-0000-0000-0000-0000000006f1', 1, 'S0', '00000000-0000-0000-0000-00000000ab01', 'distractor', 'circle', '{"cx":400,"cy":156,"r":26}', 6, 0, 'Stop button S0', 'زر الإيقاف S0', NULL),
  ('00000000-0000-0000-0000-0000000006f1', 1, 'F2', '00000000-0000-0000-0000-00000000ab01', 'distractor', 'rect', '{"x":384,"y":58,"w":32,"h":44}', 6, 0, 'Control fuse F2', 'مصهر التحكم F2',
   '{"en":"Voltage reaches 95–96, so the fuse is intact.","ar":"الجهد يصل إلى 95–96، إذن المصهر سليم."}'),
  ('00000000-0000-0000-0000-0000000006f2', 1, 'GROUND-STRAP', '00000000-0000-0000-0000-00000000ab02', 'target', 'rect', '{"x":80,"y":360,"w":220,"h":40}', 10, 1, 'Engine ground strap', 'شريط أرضي المحرك',
   '{"en":"More than 0.5 V on the earth side while cranking points at a corroded or loose ground strap.","ar":"أكثر من 0.5 فولت على جانب الأرضي أثناء التدوير يدل على شريط أرضي متآكل أو مرتخٍ."}'),
  ('00000000-0000-0000-0000-0000000006f2', 1, 'RELAY', '00000000-0000-0000-0000-00000000ab02', 'distractor', 'rect', '{"x":370,"y":212,"w":74,"h":44}', 6, 0, 'Starter relay', 'مرحل البادئ', NULL),
  ('00000000-0000-0000-0000-0000000006f2', 1, 'SOLENOID', '00000000-0000-0000-0000-00000000ab02', 'distractor', 'rect', '{"x":530,"y":60,"w":110,"h":40}', 6, 0, 'Solenoid', 'الملف اللولبي',
   '{"en":"The positive side drops only 0.2 V, so the main feed and solenoid are fine.","ar":"الجانب الموجب يفقد 0.2 فولت فقط، إذن التغذية الرئيسية والملف اللولبي سليمان."}'),
  ('00000000-0000-0000-0000-0000000006f2', 1, 'BATTERY', '00000000-0000-0000-0000-00000000ab02', 'distractor', 'rect', '{"x":60,"y":180,"w":110,"h":70}', 4, 0, 'Battery', 'البطارية', NULL),
  ('00000000-0000-0000-0000-0000000006f3', 1, 'ROOT', '00000000-0000-0000-0000-00000000ab03', 'target', 'circle', '{"cx":322,"cy":298,"r":14}', 6, 1, 'Weld root', 'جذر اللحام',
   '{"en":"Lack of root fusion: too little current or too fast a travel speed for the joint.","ar":"عدم انصهار الجذر: تيار قليل أو سرعة تقدم عالية بالنسبة للوصلة."}'),
  ('00000000-0000-0000-0000-0000000006f3', 1, 'UPPER-TOE', '00000000-0000-0000-0000-00000000ab03', 'target', 'circle', '{"cx":321,"cy":240,"r":12}', 6, 1, 'Upper toe', 'الحافة العليا',
   '{"en":"Undercut at the vertical toe: too much voltage or the gun angled away from the web.","ar":"التآكل عند الحافة الرأسية: جهد زائد أو ميل المسدس بعيدًا عن اللوح الرأسي."}'),
  ('00000000-0000-0000-0000-0000000006f3', 1, 'LOWER-TOE', '00000000-0000-0000-0000-00000000ab03', 'distractor', 'circle', '{"cx":380,"cy":300,"r":12}', 4, 0, 'Lower toe', 'الحافة السفلى', NULL),
  ('00000000-0000-0000-0000-0000000006f3', 1, 'LEFT-ROOT', '00000000-0000-0000-0000-00000000ab03', 'distractor', 'circle', '{"cx":268,"cy":298,"r":14}', 4, 0, 'Left fillet root', 'جذر اللحام الأيسر',
   '{"en":"The defects are on the right-hand fillet.","ar":"العيوب في لحام الزاوية الأيمن."}');
INSERT INTO question_competencies (question_id, competency_id)
SELECT q, (SELECT id FROM competencies WHERE code = c) FROM (VALUES
  ('00000000-0000-0000-0000-0000000006f1'::uuid, 'ELEC-L3-U04-E1'), ('00000000-0000-0000-0000-0000000006f2'::uuid, 'AUTO-L3-U04-E1'),
  ('00000000-0000-0000-0000-0000000006f3'::uuid, 'WELD-L3-U06-E1')) AS x(q, c)
 WHERE EXISTS (SELECT 1 FROM competencies WHERE code = c);

-- Machine register: a type (and 3D twin) for every demo machine.
SELECT assign_machine_types();
