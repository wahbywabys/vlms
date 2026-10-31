/**
 * Electronics bench: replace the failed MOSFET on a power board and prove
 * it. Traps: working on the board with the bulk capacitors still charged,
 * soldering without the ESD strap, leaving the iron out of its stand, and
 * clipping the scope earth to the board without the isolation transformer.
 */
import { electronicsBench } from '../models/electronicsBench';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const BOARD: V3 = [1.15, 0.1, 0.55];
const IRON: V3 = [-0.3, 0.12, 0.55];

export const ielSafety: Scenario = {
  id: 'sim-iel-power-board',
  trade: 'iel',
  model: electronicsBench,
  minutes: 40,
  title: tx('Replace a failed MOSFET on a power board', 'استبدل ترانزستور MOSFET تالفًا في لوحة قدرة'),
  brief: tx(
    'A 24 V motor driver board came back from the line: no output. The MOSFET on the heatsink has failed short. The board is still on the bench supply from the last test.',
    'عادت لوحة تشغيل محرك 24 فولت من خط الإنتاج بلا خرج. ترانزستور MOSFET على المشتت الحراري تالف (قصر). اللوحة ما زالت موصلة بمصدر الطاولة من الاختبار السابق.'),
  task: tx('Make the board safe, replace the MOSFET, and prove it on the scope.', 'اجعل اللوحة آمنة واستبدل الترانزستور وأثبت سلامتها على راسم الموجات.'),
  params: { power: 1, iron: 0, cap: 1, iso: 0, strap: 0 },
  startRunning: true,
  ppe: [
    { key: 'glasses', need: 'required', why: tx('Solder spits and clipped leads fly when you cut them.', 'القصدير يتطاير وأطراف المكونات تقفز عند قصها.') },
    { key: 'no-jewellery', need: 'required', why: tx('A ring or watch strap across two pins is a short circuit and a burn.', 'الخاتم أو سوار الساعة على طرفين يعني قصرًا وحرقًا.') },
    { key: 'gloves-insulated', need: 'forbidden', why: tx('Thick gloves at a bench this fine knock parts and leads; isolation is what protects you here.', 'القفازات السميكة على طاولة دقيقة تسقط المكونات والأطراف؛ العزل هو ما يحميك هنا.') },
  ],
  actions: [
    {
      id: 'off', station: 'front', pose: 'operate', reach: [0.2, 0.15, 0.6], set: { power: 0 }, running: false,
      label: tx('Switch off the bench supply and unplug the board', 'أطفئ مصدر الطاولة وافصل اللوحة'),
      ok: tx('Supply off, leads out. The red LED on the capacitor bank is still lit.', 'المصدر مطفأ والأطراف مفصولة. الليد الأحمر على المكثفات ما زال مضيئًا.'),
    },
    {
      id: 'discharge', station: 'board', pose: 'reach', reach: BOARD, needs: ['off'], set: { cap: 0 },
      label: tx('Measure the capacitors, then discharge them through the resistor', 'قِس المكثفات ثم فرّغها عبر المقاومة'),
      ok: tx('41 V on the bank. Discharged through 100 Ω, measured again: 0.2 V. The LED is out.', '41 فولت على المكثفات. فُرغت عبر 100 أوم وقيست مرة أخرى: 0.2 فولت. انطفأ الليد.'),
    },
    {
      id: 'strap', station: 'front', pose: 'operate', reach: [0.2, 0.15, 0.6], set: { strap: 1 }, hideWhen: { done: ['strap'] },
      label: tx('Plug your wrist strap into the mat', 'وصّل سوار اليد بسطح التفريغ'),
      ok: tx('Strap on, tester shows green.', 'السوار مركب والفاحص يظهر أخضر.'),
    },
    {
      id: 'replace', station: 'iron', pose: 'reach', reach: IRON, needs: ['off'], set: { iron: 1 },
      label: tx('Desolder the old MOSFET and solder in the new one', 'فك الترانزستور القديم ولحّم الجديد'),
      ok: tx('Old part out, pads clean, new IRF540N in with fresh thermal pad. Joints bright and concave.', 'خرج القديم ونُظفت النقاط وركب IRF540N الجديد مع وسادة حرارية جديدة. الوصلات لامعة ومقعرة.'),
      hazards: [
        {
          when: { notDone: ['discharge'] },
          outcome: {
            kind: 'incident', id: 'iel-charged', effect: 'spark', at: BOARD, toward: 'hand', severity: 1,
            title: tx('The capacitors were still charged', 'المكثفات كانت ما زالت مشحونة'),
            what: tx('The iron tip bridged the drain and the 41 V rail. A bang, a spray of molten solder, and a pitted tip.', 'وصل طرف الكاوية بين المصرف وخط 41 فولت. فرقعة ورذاذ قصدير منصهر وطرف متآكل.'),
            harm: tx('On mains-powered boards the same bank holds 340 V: enough to stop a heart.', 'في اللوحات المغذاة من الشبكة تحمل المكثفات نفسها 340 فولت: ما يكفي لإيقاف القلب.'),
            rule: tx('Measure, discharge and measure again before you touch a power board.', 'قِس ثم فرّغ ثم قِس مرة أخرى قبل أن تلمس لوحة قدرة.'),
            sign: { kind: 'warning', pic: 'electric' },
          },
        },
        {
          when: { notDone: ['strap'] },
          outcome: {
            kind: 'blocked', id: 'iel-esd', effect: 'spark', at: BOARD,
            title: tx('The new MOSFET was killed by static', 'تلف الترانزستور الجديد بالكهرباء الساكنة'),
            what: tx('You walked across the floor and picked it up by the gate. It tested short before it was even powered.', 'مشيت على الأرض ثم أمسكته من البوابة. ظهر به قصر قبل أن يُغذى أصلًا.'),
            rule: tx('Strap on before you touch a static-sensitive part.', 'ركّب السوار قبل أن تلمس مكونًا حساسًا للكهرباء الساكنة.'),
            ref: 'IEC 61340-5-1', sign: { kind: 'mandatory', pic: 'exclaim' },
          },
        },
      ],
    },
    {
      id: 'park', station: 'iron', pose: 'reach', reach: IRON, needs: ['replace'], set: { iron: 0 }, hideWhen: { done: ['park'] },
      label: tx('Put the iron back in its stand and switch it off', 'أعد الكاوية إلى حاملها وأطفئها'),
      ok: tx('Iron in the stand, station off, fume extractor still running for a minute.', 'الكاوية في الحامل والمحطة مطفأة، والشفاط يعمل دقيقة أخرى.'),
    },
    {
      id: 'iso', station: 'iso', pose: 'reach', reach: [1.75, 0.3, -0.25], set: { iso: 1 }, hideWhen: { done: ['iso'] },
      label: tx('Feed the board through the isolation transformer', 'غذِّ اللوحة عبر محول العزل'),
      ok: tx('Board plugged into the isolated outlet, so the scope earth can go on its 0 V.', 'اللوحة موصلة بمخرج العزل، فيمكن توصيل أرضي راسم الموجات على صفرها.'),
    },
    {
      id: 'test', station: 'scope', pose: 'operate', reach: [-1.0, 0.3, -0.3], needs: ['replace'], set: { power: 1, cap: 1 }, running: true, goal: true,
      label: tx('Power up with a low current limit and check the gate drive on the scope', 'شغّل بحد تيار منخفض وافحص إشارة البوابة على راسم الموجات'),
      ok: tx('Current limit 0.5 A, no foldback. Clean 12 V gate pulses at 20 kHz, drain switching cleanly. Board passed.', 'حد التيار 0.5 أمبير بلا انخفاض. نبضات بوابة 12 فولت نظيفة عند 20 كيلوهرتز، والمصرف يقطع بنظافة. نجحت اللوحة.'),
      hazards: [
        {
          when: { notDone: ['park'] },
          outcome: {
            kind: 'incident', id: 'iel-iron', effect: 'burn', at: IRON, toward: 'hand', severity: 1,
            title: tx('Burnt by the iron left on the mat', 'حرق من الكاوية المتروكة على السطح'),
            what: tx('Reaching for the scope probe, your wrist rested on the 350 °C tip lying on the mat.', 'وأنت تمد يدك إلى طرف راسم الموجات استقر معصمك على طرف 350 درجة ملقى على السطح.'),
            rule: tx('The iron lives in its stand. Every time.', 'مكان الكاوية في حاملها. في كل مرة.'),
            sign: { kind: 'warning', pic: 'hot' },
          },
        },
        {
          when: { notDone: ['iso'] },
          outcome: {
            kind: 'incident', id: 'iel-scope-earth', effect: 'arcflash', at: BOARD, toward: 'face', severity: 2,
            title: tx('Scope earth on a mains-referenced board', 'أرضي راسم الموجات على لوحة مرتبطة بالشبكة'),
            what: tx('Without the isolation transformer, the 0 V of the board was not earth. The scope earth clip shorted it to earth: a flash, the clip lead vaporised, the scope input died.', 'بدون محول العزل لم يكن صفر اللوحة هو الأرضي. قصّر مشبك أرضي راسم الموجات بينه وبين الأرض: وميض وتبخر سلك المشبك وتلف مدخل الجهاز.'),
            harm: tx('The arc burns hands and eyes, and the scope chassis can become live.', 'القوس يحرق اليدين والعينين، وقد يصبح هيكل الجهاز مكهربًا.'),
            rule: tx('Use the isolation transformer (or a differential probe) before any scope earth goes on a power board.', 'استخدم محول العزل (أو مجسًا تفاضليًا) قبل وضع أي أرضي لراسم الموجات على لوحة قدرة.'),
            sign: { kind: 'warning', pic: 'electric' },
          },
        },
      ],
    },
  ],
};
