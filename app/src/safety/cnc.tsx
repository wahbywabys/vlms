/**
 * CNC lathe: load a bar, turn it, measure it and unload it. Traps: the chuck
 * key left in the chuck, tools and a rag left on the bed, opening the guard
 * while the spindle turns, blowing swarf off with the air gun, and polishing
 * with gloves, a watch or loose cuffs near the turning bar.
 */
import { cncLathe } from '../models/cncLathe';
import { tx } from '../models/kit';
import type { Scenario } from './types';

const CHUCK: [number, number, number] = [-0.9, 0.1, 0.1];

export const cncSafety: Scenario = {
  id: 'sim-cnc-turning',
  trade: 'cnc',
  model: cncLathe,
  minutes: 25,
  title: tx('Turn a Ø25 shaft safely', 'خراطة عمود Ø25 بأمان'),
  brief: tx(
    'Job card JC-118 is on the lathe. The WABYS student has to load a Ø32 bar, turn it to Ø25, check it and take it out. The trainer is busy at another station: every decision is yours. Mistakes play out for real, then you rewind and try again.',
    'بطاقة العمل JC-118 على المخرطة. على متدرب WABYS تحميل عمود Ø32 وخراطته إلى Ø25 ثم فحصه وإخراجه. المدرب مشغول عند محطة أخرى: كل قرار لك. الأخطاء تحدث أمامك كما في الواقع، ثم ترجع وتحاول من جديد.'),
  task: tx('Load, turn, measure and unload the shaft without an incident.', 'حمّل العمود واخرطه وقِسه وأخرجه دون أي حادث.'),
  params: { door: 1, cut: 0, feed: 0.05 },
  ppe: [
    { key: 'glasses', need: 'required', why: tx('Hot chips leave the cut at speed and travel metres.', 'الرايش الساخن يخرج من القطع بسرعة ويطير لأمتار.') },
    { key: 'boots', need: 'required', why: tx('Bars and chucks are heavy; swarf on the floor is sharp.', 'الأعمدة والظروف ثقيلة، والرايش على الأرض حاد.') },
    { key: 'cuffs', need: 'required', why: tx('A loose sleeve is the first thing a turning chuck catches.', 'الكم الفضفاض أول ما يلتقطه الظرف الدوار.') },
    { key: 'no-jewellery', need: 'required', why: tx('A watch strap or ring can be caught and pull the hand in.', 'سوار الساعة أو الخاتم قد يعلق ويسحب اليد.') },
    { key: 'earmuffs', need: 'optional', why: tx('Good practice when the bay is noisy for long periods.', 'ممارسة جيدة إذا كان الضجيج مستمرًا لفترة طويلة.') },
    { key: 'gloves-nitrile', need: 'forbidden', why: tx('Never wear gloves near rotating parts on a lathe: they wrap and pull.', 'لا تلبس القفازات قرب الأجزاء الدوارة في المخرطة: تلتف وتسحب اليد.') },
    { key: 'visor', need: 'optional', why: tx('A face shield adds protection when grinding or blowing down, over the glasses.', 'واقي الوجه يضيف حماية فوق النظارة عند التجليخ.') },
  ],
  actions: [
    {
      id: 'tighten', station: 'chuck', pose: 'reach', reach: CHUCK,
      label: tx('Load the bar and tighten the chuck with the chuck key', 'حمّل العمود واربط الظرف بمفتاح الظرف'),
      ok: tx('Bar gripped on all three jaws, 60 mm stick-out.', 'العمود مثبت على الفكوك الثلاثة، بروز 60 مم.'),
    },
    {
      id: 'remove-key', station: 'chuck', pose: 'reach', reach: [-0.9, 0.45, 0.1], needs: ['tighten'],
      label: tx('Take the chuck key out and put it back on its holder', 'أخرج مفتاح الظرف وأعده إلى حامله'),
      ok: tx('Key out of the chuck and on its holder. Never leave it in, not even for a second.', 'المفتاح خارج الظرف وعلى حامله. لا تتركه أبدًا ولو لثانية.'),
    },
    {
      id: 'clear', station: 'front', pose: 'reach', reach: [0.1, -0.2, 0.45],
      label: tx('Clear the rag and the vernier off the bed', 'ارفع الخرقة والقدمة من على الفرش'),
      ok: tx('Bed clear: nothing loose in the work area.', 'الفرش نظيف: لا شيء سائب في منطقة العمل.'),
    },
    {
      id: 'close', station: 'front', pose: 'reach', reach: [0.5, 0.3, 0.8], set: { door: 0 }, undoes: ['open'], hideWhen: { done: ['close'] },
      label: tx('Close the guard door', 'أغلق باب الحماية'),
      ok: tx('Guard closed and interlocked.', 'الباب مغلق ومؤمَّن بالقفل البيني.'),
    },
    {
      id: 'open', station: 'front', pose: 'reach', reach: [0.5, 0.3, 0.8], set: { door: 1 }, undoes: ['close'], hideWhen: { notDone: ['close'] },
      label: tx('Open the guard door', 'افتح باب الحماية'),
      ok: tx('Door open. The spindle cannot start until it is shut again.', 'الباب مفتوح. لن يدور عمود الدوران حتى يُغلق.'),
      hazards: [{
        when: { done: ['start'], notDone: ['stop'] },
        outcome: {
          kind: 'blocked', id: 'cnc-door-locked', effect: 'alarm', at: [0.6, 0.6, 0.85],
          title: tx('Door locked: the spindle is turning', 'الباب مقفل: عمود الدوران يدور'),
          what: tx('The guard lock held the door shut and the control showed "Door locked, spindle running".', 'قفل الحماية أبقى الباب مغلقًا وظهرت رسالة "الباب مقفل، العمود يدور".'),
          harm: tx('On older or tampered machines, reaching in to a turning chuck causes amputations and scalping injuries every year.', 'في الماكينات القديمة أو المعدَّلة، يتسبب مد اليد إلى ظرف دوّار في حالات بتر وإصابات خطيرة كل عام.'),
          rule: tx('Stop the spindle and wait for it to stand still before you open the guard. Never defeat an interlock.', 'أوقف العمود وانتظر حتى يتوقف تمامًا قبل فتح الباب. لا تعطل القفل البيني أبدًا.'),
          ref: 'ISO 23125 · interlocked guards', sign: { kind: 'warning', pic: 'rotating' },
        },
      }],
    },
    {
      id: 'start', station: 'controls', pose: 'operate', needs: ['tighten'], set: { cut: 1, feed: 0.85 }, running: true,
      label: tx('Press Cycle Start', 'اضغط بدء الدورة'),
      ok: tx('Program O1180 running: roughing then finishing to Ø25.', 'البرنامج O1180 يعمل: خشن ثم تشطيب إلى Ø25.'),
      hazards: [
        {
          when: { notDone: ['close'] },
          outcome: {
            kind: 'blocked', id: 'cnc-door-open', effect: 'alarm', at: [2.25, 0.7, 0.6],
            title: tx('Cycle start refused: guard open', 'رُفض بدء الدورة: الباب مفتوح'),
            what: tx('The interlock stopped the cycle and the control showed alarm 2001 "Guard door open".', 'منع القفل البيني الدورة وظهر الإنذار 2001 "باب الحماية مفتوح".'),
            rule: tx('Close the guard before every cycle start. The interlock is the last line, not the plan.', 'أغلق الباب قبل كل بدء دورة. القفل البيني هو خط الدفاع الأخير وليس الخطة.'),
            ref: 'ISO 23125', sign: { kind: 'mandatory', pic: 'exclaim' },
          },
        },
        {
          when: { notDone: ['remove-key'] },
          outcome: {
            kind: 'incident', id: 'cnc-chuck-key', effect: 'projectile', object: 'key', at: [-0.9, 0.42, 0.1], toward: [0.2, 0.55, 0.78], severity: 2,
            title: tx('The chuck key was thrown out of the chuck', 'انطلق مفتاح الظرف من الظرف'),
            what: tx('The spindle started with the key still in it. The key flew out and smashed into the guard window, cracking it.', 'بدأ الدوران والمفتاح ما زال في الظرف. انطلق المفتاح وارتطم بزجاج الباب فشرخه.'),
            harm: tx('Without the guard, a chuck key leaves at 20 m/s or more: fractured skulls, lost eyes and broken arms are on record.', 'بدون الحماية، يخرج المفتاح بسرعة 20 م/ث أو أكثر: كسور في الجمجمة وفقدان عيون وكسور ذراع مسجلة.'),
            rule: tx('Never let go of a chuck key while it is in the chuck. Take it out and put it on its holder straight away.', 'لا تترك مفتاح الظرف وهو في الظرف أبدًا. أخرجه وضعه على حامله فورًا.'),
            ref: 'ISO 23125 · chuck key safety', sign: { kind: 'warning', pic: 'flying' },
          },
        },
        {
          when: { notDone: ['clear'] },
          outcome: {
            kind: 'incident', id: 'cnc-loose-items', effect: 'crash', at: [-0.4, -0.15, 0.3], severity: 1,
            title: tx('The rag and the vernier were caught by the chuck', 'التقط الظرف الخرقة والقدمة'),
            what: tx('The rag left on the bed wrapped round the bar and whipped the vernier into the turret. The vernier is scrap and the insert is chipped.', 'التفت الخرقة على العمود وقذفت القدمة نحو البرج. القدمة تلفت وحافة القلم انكسرت.'),
            harm: tx('Rags caught by a lathe pull hands in with them. Loose tools become missiles.', 'الخرق التي تلتقطها المخرطة تسحب الأيدي معها، والعدد السائبة تتحول إلى مقذوفات.'),
            rule: tx('Clear the bed and the work area of tools, rags and gauges before every start.', 'نظّف الفرش ومنطقة العمل من العدد والخرق وأدوات القياس قبل كل تشغيل.'),
            sign: { kind: 'warning', pic: 'rotating' },
          },
        },
      ],
    },
    {
      id: 'stop', station: 'controls', pose: 'operate', needs: ['start'], running: false,
      label: tx('Wait for the end of the program and check the spindle has stopped', 'انتظر نهاية البرنامج وتأكد من توقف العمود'),
      ok: tx('M30: program end. Spindle at 0 rpm, coolant off.', 'M30: نهاية البرنامج. العمود عند 0 لفة/دقيقة والتبريد متوقف.'),
    },
    {
      id: 'chips-air', station: 'front', pose: 'reach', reach: [-0.4, 0.05, 0.4], needs: ['stop', 'open'],
      label: tx('Blow the swarf off with the air gun', 'انفخ الرايش بمسدس الهواء'),
      hazards: [
        {
          when: { notWearing: ['glasses'] },
          outcome: {
            kind: 'incident', id: 'cnc-air-eye', effect: 'chips', at: [-0.4, 0.0, 0.2], toward: 'face', severity: 2,
            title: tx('A chip was blown into the eye', 'دخلت رايشة في العين'),
            what: tx('The compressed air threw hot steel chips back at the student. One went into the unprotected eye.', 'دفع الهواء المضغوط الرايش الساخن نحو المتدرب، فدخلت رايشة في العين غير المحمية.'),
            harm: tx('Metal in the eye is the most common machine-shop injury. Rust rings and infection can cost the sight of that eye.', 'المعدن في العين أكثر إصابات ورش التشغيل شيوعًا، وقد يؤدي الصدأ والعدوى إلى فقدان البصر في تلك العين.'),
            rule: tx('Wear safety glasses at all times in the bay. Clear swarf with a chip hook and brush, never with an air gun.', 'ارتدِ نظارة السلامة دائمًا في الورشة. أزل الرايش بخطاف وفرشاة، لا بمسدس الهواء.'),
            ref: 'PPE · eye protection', sign: { kind: 'mandatory', pic: 'glasses' },
          },
        },
        {
          when: {},
          outcome: {
            kind: 'incident', id: 'cnc-air-hand', effect: 'chips', at: [-0.4, 0.0, 0.2], toward: 'hand', severity: 1,
            title: tx('Chips bounced back and cut the hand', 'ارتد الرايش وجرح اليد'),
            what: tx('The glasses saved the eyes, but the blast bounced sharp swarf back onto the hand and into the bay, where others walk.', 'حمت النظارة العينين، لكن الهواء أعاد الرايش الحاد إلى اليد ونثره في الورشة حيث يمر الآخرون.'),
            harm: tx('Air at shop pressure can also drive dirt through the skin. Swarf is razor sharp.', 'الهواء بضغط الورشة قد يدفع الأوساخ عبر الجلد، والرايش حاد كالشفرة.'),
            rule: tx('Clear swarf with a chip hook and brush. Air guns are for blowing down parts inside a closed guard only.', 'أزل الرايش بخطاف وفرشاة. مسدس الهواء لتنظيف القطع داخل باب مغلق فقط.'),
            sign: { kind: 'warning', pic: 'flying' },
          },
        },
      ],
      ok: tx('', ''),
    },
    {
      id: 'chips-hook', station: 'front', pose: 'reach', reach: [-0.4, -0.1, 0.4], needs: ['stop', 'open'],
      label: tx('Pull the swarf out with a chip hook and brush', 'اسحب الرايش بخطاف الرايش والفرشاة'),
      ok: tx('Swarf in the chip tray. Hands never touched it.', 'الرايش في الصينية دون أن تلمسه اليد.'),
    },
    {
      id: 'polish', station: 'chuck', pose: 'reach', reach: [-0.5, 0.05, 0.25], needs: ['stop', 'open'],
      label: tx('Polish the shaft with emery cloth (setting mode, slow speed)', 'لمّع العمود بورق الصنفرة (وضع الضبط، سرعة بطيئة)'),
      detail: tx('Optional finishing step', 'خطوة تشطيب اختيارية'),
      hazards: [
        ...(['gloves-nitrile', 'cuffs', 'no-jewellery'] as const).map((k) => ({
          when: k === 'gloves-nitrile' ? { wearing: [k] } : { notWearing: [k] },
          outcome: {
            kind: 'incident' as const, id: `cnc-entangle-${k}`, effect: 'entangle' as const, at: [-0.5, 0.0, 0.0] as [number, number, number], toward: 'hand' as const, severity: 3 as const,
            title: k === 'gloves-nitrile' ? tx('The glove was caught and wrapped round the bar', 'علق القفاز والتف حول العمود')
              : k === 'cuffs' ? tx('The loose sleeve was caught by the turning bar', 'علق الكم الفضفاض بالعمود الدوار')
                : tx('The watch strap was caught by the turning bar', 'علق سوار الساعة بالعمود الدوار'),
            what: tx('Even at slow speed the bar grabbed it in a fraction of a second and pulled the arm in. The emergency stop was out of reach.', 'حتى بالسرعة البطيئة أمسكه العمود في جزء من الثانية وسحب الذراع، وكان زر الطوارئ بعيدًا.'),
            harm: tx('Entanglement on lathes causes degloving injuries, broken arms and deaths. It happens too fast to let go.', 'الالتفاف في المخارط يسبب سلخ الجلد وكسور الذراع والوفاة، ويحدث أسرع من أن تفلت.'),
            rule: tx('No gloves, jewellery or loose clothing near rotating parts. Hold emery on a backing board, never wrapped round a finger.', 'لا قفازات ولا حُلي ولا ملابس فضفاضة قرب الأجزاء الدوارة. أمسك الصنفرة على لوح، ولا تلفها حول إصبعك.'),
            ref: 'ISO 23125 · entanglement', sign: { kind: 'prohibition' as const, pic: (k === 'gloves-nitrile' ? 'noGloves' : k === 'cuffs' ? 'rotating' : 'noJewel') as 'noGloves' },
          },
        })),
      ],
      ok: tx('Emery on a backing board, both hands on top, nothing to catch. Ra 0.8 finish.', 'الصنفرة على لوح، اليدان من أعلى، لا شيء يعلق. تشطيب Ra 0.8.'),
    },
    {
      id: 'measure', station: 'front', pose: 'measure', reach: [-0.4, 0.05, 0.3], needs: ['stop', 'open'],
      label: tx('Measure the diameter with the micrometer', 'قِس القطر بالميكرومتر'),
      ok: tx('Ø24.992 mm: inside 25 h7 (24.979 to 25.000).', 'Ø24.992 مم: ضمن 25 h7 (من 24.979 إلى 25.000).'),
      hazards: [{
        when: { notDone: ['stop'] },
        outcome: {
          kind: 'blocked', id: 'cnc-measure-running', effect: 'alarm', at: [0.6, 0.6, 0.85],
          title: tx('Never measure a turning part', 'لا تقِس قطعة تدور'), what: tx('The trainer stopped you.', 'أوقفك المدرب.'),
          rule: tx('Stop the spindle before you measure.', 'أوقف العمود قبل القياس.'),
        },
      }],
    },
    {
      id: 'unload', station: 'chuck', pose: 'lift', reach: CHUCK, needs: ['measure'], goal: true, set: { cut: 0 },
      label: tx('Unload the finished shaft', 'أخرج العمود المنتهي'),
      ok: tx('Shaft out, deburred and on the inspection tray. Job done.', 'العمود خارج الماكينة ومنظّف من الزوائد وعلى صينية الفحص. انتهت المهمة.'),
    },
  ],
  props: [
    {
      id: 'chuck-key', when: { done: ['tighten'], notDone: ['remove-key'] },
      render: (v) => v.fx === 'projectile' ? null : (
        <group position={[-0.9, 0.42, 0.1]}>
          <mesh castShadow><boxGeometry args={[0.03, 0.18, 0.03]} /><meshStandardMaterial color="#8e99a4" metalness={0.9} roughness={0.3} /></mesh>
          <mesh position={[0, 0.09, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.014, 0.014, 0.2, 10]} /><meshStandardMaterial color="#8e99a4" metalness={0.9} roughness={0.3} /></mesh>
        </group>
      ),
    },
    {
      id: 'rag-vernier', when: { notDone: ['clear'] },
      render: (v) => v.fx === 'crash' ? null : (
        <group>
          <mesh position={[-0.35, -0.255, 0.3]} rotation={[0, 0.4, 0]} castShadow><boxGeometry args={[0.3, 0.035, 0.2]} /><meshStandardMaterial color="#b43a2c" roughness={0.95} /></mesh>
          <group position={[0.25, -0.26, 0.38]} rotation={[0, -0.3, 0]}>
            <mesh castShadow><boxGeometry args={[0.32, 0.012, 0.03]} /><meshStandardMaterial color="#c6ccd2" metalness={0.9} roughness={0.25} /></mesh>
            <mesh position={[-0.13, 0, 0.04]}><boxGeometry args={[0.025, 0.012, 0.07]} /><meshStandardMaterial color="#c6ccd2" metalness={0.9} roughness={0.25} /></mesh>
          </group>
        </group>
      ),
    },
    {
      id: 'swarf', when: { done: ['start'], notDone: ['chips-hook'] },
      render: () => (
        <group position={[-0.3, -0.27, 0.15]}>
          {Array.from({ length: 18 }, (_, i) => (
            <mesh key={i} position={[Math.sin(i * 2.3) * 0.28, 0.02 + (i % 3) * 0.015, Math.cos(i * 1.7) * 0.12]} rotation={[i, i * 0.7, 0]}>
              <torusGeometry args={[0.03 + (i % 4) * 0.008, 0.004, 4, 14, 4.5]} />
              <meshStandardMaterial color={i % 3 ? '#8a6a3a' : '#5c4a6e'} metalness={0.9} roughness={0.35} />
            </mesh>
          ))}
        </group>
      ),
    },
  ],
};
