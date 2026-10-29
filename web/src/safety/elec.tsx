/**
 * Motor starter panel: replace a tripped overload relay. Traps: the door
 * interlock, working without your own lock (a colleague switches back on),
 * skipping test-before-touch on a panel with a second supply, an unproven
 * tester, and switching back on with a screwdriver left inside.
 */
import { starterPanel } from '../models/starterPanel';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const BACK = -0.3;
const F2: V3 = [0.36, -0.5, BACK + 0.24];
const X1: V3 = [0.25, -0.75, BACK + 0.2];
const LINE: V3 = [-0.45, 0.6, BACK + 0.2];
const Q1: V3 = [-0.45, 0.28, 0.45];

const shockHarm = tx('400 V across the chest stops the heart. Survivors often have deep burns where the current went in and out.', '400 فولت عبر الصدر توقف القلب. ومن ينجو غالبًا تكون لديه حروق عميقة عند نقطتي دخول التيار وخروجه.');
const deadRule = tx('Safe isolation: isolate, lock off with your own lock, prove the tester, test for dead, prove the tester again. Only then touch.', 'العزل الآمن: اعزل، اقفل بقفلك الشخصي، تحقق من جهاز الاختبار، اختبر انعدام الجهد، ثم تحقق من الجهاز مرة أخرى. بعدها فقط المس.');

export const elecSafety: Scenario = {
  id: 'sim-elec-overload',
  trade: 'elec',
  model: starterPanel,
  minutes: 30,
  startRunning: true,
  title: tx('Replace the overload relay safely', 'تغيير ريلاي الحماية الحرارية بأمان'),
  brief: tx(
    'The pump motor on this DOL starter keeps tripping. The supervisor wants the overload relay F2 replaced now. The motor is running and other people work in this plant room. Do it your way; the panel will show you the consequences.',
    'محرك المضخة على هذا البادئ المباشر يفصل باستمرار. يريد المشرف تغيير ريلاي الحماية F2 الآن. المحرك يعمل وهناك آخرون يعملون في غرفة المعدات. نفّذها بطريقتك وستُظهر لك اللوحة العواقب.'),
  task: tx('Replace F2 and put the motor back into service with no incident.', 'غيّر F2 وأعد المحرك للخدمة دون أي حادث.'),
  params: { door: 0, q1: 1, km: 1, lock: 0, trip: 0 },
  ppe: [
    { key: 'gloves-insulated', need: 'required', why: tx('Class 0 insulated gloves for testing and work near parts that could be live.', 'قفازات عازلة فئة 0 للاختبار والعمل قرب أجزاء قد تكون مكهربة.') },
    { key: 'glasses', need: 'required', why: tx('Arc flash and flying copper at the moment of a fault.', 'وميض القوس والنحاس المتطاير لحظة العطل.') },
    { key: 'boots', need: 'required', why: tx('Electrical-rated soles add insulation to earth.', 'النعل المقاوم للكهرباء يضيف عزلًا عن الأرض.') },
    { key: 'no-jewellery', need: 'required', why: tx('Metal on hands conducts and burns.', 'المعادن على اليدين توصل التيار وتحرق.') },
    { key: 'visor', need: 'optional', why: tx('Arc-rated face shield when switching or testing on high-energy panels.', 'واقي وجه مقاوم للقوس عند الفصل أو الاختبار في لوحات عالية الطاقة.') },
    { key: 'gloves-leather', need: 'forbidden', why: tx('Leather welding gloves are not insulated and give false confidence.', 'قفازات اللحام الجلدية غير عازلة وتعطي ثقة زائفة.') },
  ],
  actions: [
    {
      id: 'stop', station: 'front', pose: 'operate', set: { km: 0 }, running: false,
      label: tx('Press Stop (S1) and check the motor has stopped', 'اضغط إيقاف (S1) وتأكد من توقف المحرك'),
      ok: tx('Contactor dropped out, run lamp off, the pump has run down.', 'فصل الكونتاكتور وانطفأت لمبة التشغيل وتوقفت المضخة.'),
    },
    {
      id: 'isolate', station: 'isolator', pose: 'operate', reach: Q1, set: { q1: 0, km: 0 }, running: false,
      label: tx('Turn the isolator Q1 to OFF', 'أدر المفصل Q1 إلى وضع OFF'),
      ok: tx('Q1 OFF. The handle now lets the door open.', 'Q1 على OFF. المقبض يسمح الآن بفتح الباب.'),
    },
    {
      id: 'lock', station: 'isolator', pose: 'operate', reach: Q1, needs: ['isolate'], set: { lock: 1 },
      label: tx('Fit your own padlock and danger tag to Q1', 'ضع قفلك الشخصي وبطاقة الخطر على Q1'),
      ok: tx('Your lock, your key in your pocket, tag signed and dated.', 'قفلك ومفتاحك في جيبك والبطاقة موقّعة ومؤرخة.'),
    },
    {
      id: 'open', station: 'front', pose: 'reach', reach: [0.6, 0.0, 0.45], set: { door: 1 },
      label: tx('Open the panel door', 'افتح باب اللوحة'),
      ok: tx('Door open. The mounting plate is in front of you.', 'الباب مفتوح ولوح التركيب أمامك.'),
      hazards: [{
        when: { notDone: ['isolate'] },
        outcome: {
          kind: 'blocked', id: 'elec-door-interlock', effect: 'alarm', at: Q1,
          title: tx('Door interlocked: the isolator is ON', 'الباب مؤمَّن: المفصل على ON'),
          what: tx('The isolator handle holds the door shut while it is ON.', 'مقبض المفصل يُبقي الباب مغلقًا طالما هو على ON.'),
          rule: tx('Isolate before you open. Never defeat the door interlock with a screwdriver.', 'اعزل قبل الفتح. لا تعطّل قفل الباب بالمفك أبدًا.'),
          sign: { kind: 'warning', pic: 'electric' },
        },
      }],
    },
    {
      id: 'prove1', station: 'front', pose: 'inspect', reach: [0.5, -0.4, 0.6],
      label: tx('Prove the voltage tester on the proving unit', 'تحقق من جهاز اختبار الجهد على وحدة التحقق'),
      ok: tx('Tester lights at 230 V and 400 V on the proving unit. It works.', 'أضاء الجهاز عند 230 و400 فولت على وحدة التحقق. إنه يعمل.'),
    },
    {
      id: 'test', station: 'inside', pose: 'reach', reach: LINE, needs: ['open'],
      label: tx('Test for dead: every phase to phase, to N and to PE, at Q1 and X1', 'اختبر انعدام الجهد: كل طور مع الأطوار ومع N وPE عند Q1 وX1'),
      ok: tx('All readings 0 V. But X1 terminals 1 and 2 are marked "Fed from DB-2": you found the second supply and isolated it too.', 'كل القراءات 0 فولت. لكن طرفي X1 رقم 1 و2 مكتوب عليهما "مغذّى من DB-2": اكتشفت المصدر الثاني وعزلته أيضًا.'),
      hazards: [{
        when: { notWearing: ['gloves-insulated'] },
        outcome: {
          kind: 'incident', id: 'elec-test-live', effect: 'shock', at: LINE, toward: 'hand', severity: 2,
          title: tx('Shock from the incoming terminals', 'صدمة من أطراف التغذية الداخلة'),
          what: tx('The probe slipped onto the incoming terminals above Q1. They stay live even with the isolator off, and the bare hand touched them.', 'انزلق المجس على أطراف التغذية فوق Q1، وهي تبقى مكهربة حتى مع فصل المفصل، ولمستها اليد العارية.'),
          harm: shockHarm, rule: deadRule, ref: 'BS EN 50110 · GS38', sign: { kind: 'warning', pic: 'electric' },
        },
      }],
    },
    {
      id: 'prove2', station: 'front', pose: 'inspect', reach: [0.5, -0.4, 0.6], needs: ['test'],
      label: tx('Prove the tester again on the proving unit', 'تحقق من جهاز الاختبار مرة أخرى'),
      ok: tx('Still working: the 0 V readings are real.', 'ما زال يعمل: قراءات 0 فولت حقيقية.'),
    },
    {
      id: 'replace', station: 'inside', pose: 'reach', reach: F2, needs: ['open'], set: { trip: 0 },
      label: tx('Unscrew the old F2 and fit the new one, set to 7.6 A', 'فك F2 القديم وركّب الجديد على 7.6 أمبير'),
      ok: tx('New F2 fitted, set to the motor FLC of 7.6 A, terminals torqued.', 'رُكّب F2 الجديد على تيار الحمل الكامل 7.6 أمبير وشُدت الأطراف.'),
      hazards: [
        {
          when: { notDone: ['lock'] },
          outcome: {
            kind: 'incident', id: 'elec-no-lock', effect: 'shock', at: F2, toward: 'hand', severity: 3,
            title: tx('Someone switched the isolator back on', 'شخص ما أعاد تشغيل المفصل'),
            what: tx('A colleague saw the pump off, did not see you behind the door and turned Q1 back ON. Your hand was on F2.', 'رأى زميل المضخة متوقفة ولم يرك خلف الباب فأعاد Q1 إلى ON، ويدك على F2.'),
            harm: shockHarm,
            rule: tx('Lock off with your own padlock and keep the key. A switch that is only OFF can be turned ON by anyone.', 'اقفل بقفلك واحتفظ بالمفتاح. المفتاح المطفأ فقط يمكن لأي شخص تشغيله.'),
            ref: 'Lockout / tagout · BS EN 50110', sign: { kind: 'mandatory', pic: 'lockout' },
          },
        },
        {
          when: { notDone: ['test'] },
          outcome: {
            kind: 'incident', id: 'elec-backfeed', effect: 'shock', at: X1, toward: 'hand', severity: 3,
            title: tx('Shock from a second supply', 'صدمة من مصدر تغذية ثانٍ'),
            what: tx('Q1 was off and locked, but the control circuit at X1 is fed from another board. You touched 230 V.', 'كان Q1 مفصولًا ومقفلًا، لكن دائرة التحكم عند X1 تتغذى من لوحة أخرى. لمست 230 فولت.'),
            harm: shockHarm, rule: deadRule, ref: 'BS EN 50110 · GS38', sign: { kind: 'warning', pic: 'electric' },
          },
        },
        {
          when: { notDone: ['prove1'] },
          outcome: {
            kind: 'blocked', id: 'elec-unproven', effect: 'alarm', at: F2,
            title: tx('Your test means nothing: the tester was never proved', 'اختبارك بلا قيمة: لم تتحقق من الجهاز'),
            what: tx('The trainer stopped you. A tester with a flat battery or a broken lead reads 0 V on a live panel.', 'أوقفك المدرب. جهاز ببطارية فارغة أو سلك مقطوع يقرأ 0 فولت على لوحة مكهربة.'),
            rule: deadRule, sign: { kind: 'mandatory', pic: 'exclaim' },
          },
        },
        {
          when: { notDone: ['prove2'] },
          outcome: {
            kind: 'blocked', id: 'elec-not-reproved', effect: 'alarm', at: F2,
            title: tx('Prove the tester again before you touch', 'تحقق من الجهاز مرة أخرى قبل اللمس'),
            what: tx('The trainer stopped you. If the tester failed during the test, all your 0 V readings are wrong.', 'أوقفك المدرب. إذا تعطل الجهاز أثناء الاختبار، فكل قراءات 0 فولت خاطئة.'),
            rule: deadRule, sign: { kind: 'mandatory', pic: 'exclaim' },
          },
        },
      ],
    },
    {
      id: 'tools-out', station: 'inside', pose: 'inspect', reach: [0.2, -0.3, 0.1], needs: ['replace'],
      label: tx('Count your tools back and check nothing is left inside', 'عُد أدواتك وتأكد أنه لم يبقَ شيء بالداخل'),
      ok: tx('Seven tools out, seven back in the bag. Screwdriver found on the trunking and removed.', 'سبع أدوات خرجت وسبع عادت للحقيبة. وُجد مفك على المجرى وأُزيل.'),
    },
    {
      id: 'close', station: 'front', pose: 'reach', reach: [0.6, 0.0, 0.45], needs: ['replace'], set: { door: 0 },
      label: tx('Close the panel door', 'أغلق باب اللوحة'),
      ok: tx('Door closed and latched.', 'الباب مغلق ومثبت.'),
    },
    {
      id: 'restore', station: 'isolator', pose: 'operate', reach: Q1, needs: ['close'], set: { lock: 0, q1: 1, km: 1 }, running: true, goal: true,
      label: tx('Remove your lock, switch Q1 ON and start the motor', 'انزع قفلك وشغّل Q1 وابدأ المحرك'),
      ok: tx('Motor running at 7.1 A, no trip. Job card signed off.', 'المحرك يعمل بتيار 7.1 أمبير دون فصل. أُغلقت بطاقة العمل.'),
      hazards: [
        {
          when: { notDone: ['tools-out'], notWearing: ['visor'] },
          outcome: {
            kind: 'incident', id: 'elec-arcflash', effect: 'arcflash', at: [0.2, -0.3, BACK + 0.25], toward: 'face', severity: 3,
            title: tx('Arc flash: a screwdriver was left across the terminals', 'وميض قوس: مفك تُرك عبر الأطراف'),
            what: tx('A screwdriver left on the trunking fell across two phases when Q1 closed. The fault current made an arc flash of plasma and molten copper.', 'سقط مفك تُرك على المجرى عبر طورين عند غلق Q1، فأحدث تيار القصر وميض قوس من البلازما والنحاس المنصهر.'),
            harm: tx('Arc flash reaches thousands of degrees: facial burns, blindness and hearing loss from the blast.', 'يصل وميض القوس إلى آلاف الدرجات: حروق في الوجه وعمى وفقدان سمع من الانفجار.'),
            rule: tx('Count your tools out and back in. Check inside the panel before you close it and re-energise.', 'عُد أدواتك عند الخروج والعودة. افحص داخل اللوحة قبل غلقها وإعادة التغذية.'),
            ref: 'Arc flash · NFPA 70E', sign: { kind: 'warning', pic: 'electric' },
          },
        },
        {
          when: { notDone: ['tools-out'] },
          outcome: {
            kind: 'incident', id: 'elec-arcflash-visor', effect: 'arcflash', at: [0.2, -0.3, BACK + 0.25], toward: 'face', severity: 2,
            title: tx('Arc flash: a screwdriver was left inside', 'وميض قوس: مفك تُرك بالداخل'),
            what: tx('The closed door and your face shield took most of the blast, but the panel is wrecked and the plant is down.', 'تحمّل الباب المغلق وواقي الوجه معظم الانفجار، لكن اللوحة تلفت وتوقف المصنع.'),
            rule: tx('Count your tools out and back in. Check inside the panel before you close it and re-energise.', 'عُد أدواتك عند الخروج والعودة. افحص داخل اللوحة قبل غلقها وإعادة التغذية.'),
            ref: 'Arc flash · NFPA 70E', sign: { kind: 'warning', pic: 'electric' },
          },
        },
      ],
    },
  ],
  props: [
    {
      id: 'tag', when: { done: ['lock'], notDone: ['restore'] },
      render: () => (
        <group position={[-0.28, -0.05, 0.36]}>
          <mesh rotation={[0, 0, 0.08]} castShadow><boxGeometry args={[0.14, 0.22, 0.006]} /><meshStandardMaterial color="#d22d2d" roughness={0.7} /></mesh>
          <mesh position={[0, 0.02, 0.004]}><planeGeometry args={[0.11, 0.06]} /><meshStandardMaterial color="#ffffff" /></mesh>
        </group>
      ),
    },
    {
      id: 'screwdriver', when: { done: ['replace'], notDone: ['tools-out'] },
      render: (v) => v.fx === 'arcflash' ? null : (
        <group position={[0.15, -0.28, BACK + 0.28]} rotation={[0, 0, 0.3]}>
          <mesh castShadow><cylinderGeometry args={[0.02, 0.02, 0.12, 12]} /><meshStandardMaterial color="#e2b100" roughness={0.5} /></mesh>
          <mesh position={[0, -0.14, 0]}><cylinderGeometry args={[0.006, 0.006, 0.18, 8]} /><meshStandardMaterial color="#c7ccd1" metalness={0.9} roughness={0.25} /></mesh>
        </group>
      ),
    },
    {
      id: 'tester', when: { done: ['prove1'] },
      render: () => (
        <group position={[0.85, -1.2, 0.35]}>
          <mesh castShadow><boxGeometry args={[0.12, 0.26, 0.05]} /><meshStandardMaterial color="#f5c400" roughness={0.6} /></mesh>
          <mesh position={[0, 0.06, 0.026]}><planeGeometry args={[0.08, 0.06]} /><meshStandardMaterial color="#1a2a1a" emissive="#4cff7a" emissiveIntensity={0.5} /></mesh>
        </group>
      ),
    },
  ],
};
