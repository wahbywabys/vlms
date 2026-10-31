/**
 * Shadow tool boards: each trade's hand tools and instruments (from the
 * manual's training requirements) hung on a pegboard over a bench, every tool
 * in its painted outline. Each tool is a part: tap it for its briefing, or
 * explode the board to lift every tool off its hook. One shared library of
 * tools; each trade picks its eight.
 */
import { Box, COLORS, Cyl, Sticker, tx, type BiPart, type ModelDef, type Txt } from './kit';

type V3 = [number, number, number];
type Shape = 'screwdriver' | 'pliers' | 'spanner' | 'hammer' | 'meter' | 'clamp' | 'tester' | 'caliper' | 'tape'
  | 'iron' | 'crimper' | 'gauge' | 'torch' | 'drill' | 'allen' | 'scissors' | 'dial';

interface Tool { shape: Shape; color: string; name: Txt; what: Txt; does: Txt; spec: [Txt, string | Txt]; safety?: Txt }

const RED = COLORS.red, YEL = COLORS.yellow, ORG = COLORS.orange, BLU = COLORS.blue, BLK = COLORS.black, GRN = COLORS.green;
const VDE = tx('Rating', 'التصنيف');
const RANGE = tx('Range', 'المدى');
const SIZE = tx('Sizes', 'المقاسات');

/** The shared tool library. */
const TOOLS: Record<string, Tool> = {
  'screwdrivers-vde': {
    shape: 'screwdriver', color: RED, name: tx('Insulated screwdrivers', 'مفكات معزولة'),
    what: tx('Slotted and Phillips screwdrivers with a moulded insulation sleeve down to the tip, tested at 10 kV.', 'مفكات عادية وصليبة بغلاف عازل مصبوب حتى الطرف، مختبرة عند 10 كيلو فولت.'),
    does: tx('Tightens terminals in panels and appliances. The insulation is a back-up only: you still isolate first.', 'تشد أطراف التوصيل في اللوحات والأجهزة. العزل حماية إضافية فقط: يجب العزل أولًا.'),
    spec: [VDE, '1000 V AC · IEC 60900'],
    safety: tx('A cracked or nicked sleeve is no longer insulated: throw it out.', 'الغلاف المشروخ أو المجروح لم يعد عازلًا: تخلص منه.'),
  },
  'screwdrivers': {
    shape: 'screwdriver', color: YEL, name: tx('Screwdriver set', 'طقم مفكات'),
    what: tx('Slotted, Phillips, Pozidriv and Torx drivers in the common sizes.', 'مفكات عادية وصليبة وبوزيدرايف وتوركس بالمقاسات الشائعة.'),
    does: tx('Opens covers and panels. Match the tip to the screw head exactly or you strip it.', 'تفك الأغطية واللوحات. طابق الطرف مع رأس المسمار تمامًا وإلا أتلفته.'),
    spec: [SIZE, 'PH0–PH2 · T10–T30'],
  },
  'pliers-vde': {
    shape: 'pliers', color: RED, name: tx('Insulated pliers', 'زرادية معزولة'),
    what: tx('Combination, long-nose and side-cutting pliers with insulated handles.', 'زرادية عادية وبوز طويل وقصافة بمقابض معزولة.'),
    does: tx('Grip, bend and cut conductors. Side cutters trim cable ties and leads flush.', 'تمسك الموصلات وتثنيها وتقطعها. القصافة تقص الأربطة والأطراف على مستوى السطح.'),
    spec: [VDE, '1000 V AC · IEC 60900'],
  },
  'stripper': {
    shape: 'crimper', color: ORG, name: tx('Wire stripper', 'أداة تعرية الأسلاك'),
    what: tx('Self-adjusting stripper with a cutter and a length stop.', 'أداة تعرية ذاتية الضبط مع قاطع ومحدد طول.'),
    does: tx('Removes insulation without nicking the copper. A nicked strand is where a joint overheats.', 'تزيل العزل دون جرح النحاس. الشعيرة المجروحة هي مكان سخونة الوصلة.'),
    spec: [RANGE, '0.2–6 mm²'],
  },
  'crimper': {
    shape: 'crimper', color: BLU, name: tx('Ratchet crimping tool', 'كماشة كبس بسقاطة'),
    what: tx('Ratchet crimper with dies for ferrules and insulated lugs.', 'كماشة كبس بسقاطة مع قوالب للجلب والأطراف المعزولة.'),
    does: tx('Makes a gas-tight crimp. The ratchet will not release until the crimp is complete.', 'تصنع كبسة محكمة. السقاطة لا تفتح حتى تكتمل الكبسة.'),
    spec: [RANGE, '0.5–10 mm²'],
  },
  'multimeter': {
    shape: 'meter', color: YEL, name: tx('Digital multimeter', 'جهاز آفو رقمي'),
    what: tx('True-RMS multimeter, CAT III 600 V, with fused current inputs.', 'جهاز آفو بقيمة فعالة حقيقية، فئة CAT III 600 فولت، بمداخل تيار محمية بفيوز.'),
    does: tx('Measures volts, amps, ohms, continuity, diodes and capacitance.', 'يقيس الجهد والتيار والمقاومة والاستمرارية والدايود والسعة.'),
    spec: [tx('Category', 'الفئة'), 'CAT III 600 V / CAT IV 300 V'],
    safety: tx('Leads in the amps socket across a supply is a short circuit through your hands. Check the leads before every measurement.', 'وضع الأطراف في مدخل التيار عبر مصدر جهد يعني قصرًا بين يديك. افحص الأطراف قبل كل قياس.'),
  },
  'clamp-meter': {
    shape: 'clamp', color: YEL, name: tx('Clamp meter', 'جهاز قياس كلّاب'),
    what: tx('AC/DC clamp meter with inrush capture.', 'جهاز كلّاب للتيار المتردد والمستمر مع قياس تيار البدء.'),
    does: tx('Measures current without breaking the circuit: clamp one conductor only.', 'يقيس التيار دون فتح الدائرة: اقبض على موصل واحد فقط.'),
    spec: [RANGE, '0–600 A'],
  },
  'voltage-tester': {
    shape: 'tester', color: YEL, name: tx('Two-pole voltage tester', 'كاشف جهد ثنائي القطب'),
    what: tx('A dedicated voltage indicator to EN 61243-3 with LED steps and vibration.', 'كاشف جهد مخصص وفق EN 61243-3 بمؤشرات LED واهتزاز.'),
    does: tx('Proves dead: test it on a known live source, test the circuit, then test it again.', 'يثبت انعدام الجهد: اختبره على مصدر حي معروف، ثم الدائرة، ثم المصدر مرة أخرى.'),
    spec: [RANGE, '12–1000 V AC'],
  },
  'megger': {
    shape: 'meter', color: ORG, name: tx('Insulation tester', 'جهاز قياس العزل (ميجر)'),
    what: tx('Battery insulation resistance tester at 250, 500 and 1000 V.', 'جهاز قياس مقاومة العزل بالبطارية عند 250 و500 و1000 فولت.'),
    does: tx('Finds damp, burnt or damaged insulation in cables, motors and appliances.', 'يكشف العزل الرطب أو المحروق أو التالف في الكابلات والمحركات والأجهزة.'),
    spec: [tx('Pass', 'القبول'), '≥ 1 MΩ (≥ 100 MΩ new motor)'],
    safety: tx('It puts out up to 1000 V: nobody touches the circuit during the test, and you discharge it after.', 'يخرج حتى 1000 فولت: لا أحد يلمس الدائرة أثناء الاختبار، وتفرّغها بعده.'),
  },
  'spanners': {
    shape: 'spanner', color: COLORS.alu, name: tx('Combination spanners', 'مفاتيح مشتركة'),
    what: tx('Ring and open-end spanners, chrome vanadium.', 'مفاتيح حلقة وبلدي من الكروم فاناديوم.'),
    does: tx('Undo and tighten nuts and bolts. Pull, do not push, and use the ring end for the final turn.', 'تفك وتربط الصواميل والمسامير. اسحب ولا تدفع، واستخدم طرف الحلقة للشدة الأخيرة.'),
    spec: [SIZE, '6–24 mm'],
  },
  'torque-wrench': {
    shape: 'spanner', color: BLK, name: tx('Torque wrench', 'مفتاح عزم'),
    what: tx('Click-type torque wrench with a 1/2" square drive.', 'مفتاح عزم بنقرة مع رأس مربع 1/2 بوصة.'),
    does: tx('Tightens to the specified torque: cylinder heads, wheel nuts, motor feet, terminal bolts.', 'يربط بالعزم المحدد: رأس السلندر وصواميل العجلات وأقدام المحركات ومسامير الأطراف.'),
    spec: [RANGE, '20–200 N·m'],
  },
  'sockets': {
    shape: 'spanner', color: COLORS.steel, name: tx('Socket set and ratchet', 'طقم لقم وسقاطة'),
    what: tx('6-point sockets, extensions and a reversible ratchet.', 'لقم سداسية ووصلات وسقاطة عكسية.'),
    does: tx('Fast work on bolts in tight places; the 6-point socket grips the flats, not the corners.', 'عمل سريع على المسامير في الأماكن الضيقة؛ اللقمة السداسية تمسك الأوجه لا الأركان.'),
    spec: [SIZE, '8–32 mm · 1/2"'],
  },
  'hammer': {
    shape: 'hammer', color: COLORS.darkSteel, name: tx('Ball-pein hammer', 'شاكوش بنا'),
    what: tx('Forged steel head on a hickory or fibreglass shaft.', 'رأس من الصلب المطروق على يد خشبية أو من الفيبر.'),
    does: tx('Centre-punching, riveting and driving pins. Use a soft-face mallet on finished parts.', 'للتنقيط والبرشمة وطرق المسامير. استخدم شاكوشًا لينًا على الأجزاء المشطبة.'),
    spec: [tx('Head', 'الرأس'), '450 g'],
    safety: tx('Check the head is tight on the shaft; a flying head is a serious injury.', 'تأكد أن الرأس مثبت على اليد؛ الرأس المتطاير يسبب إصابة خطيرة.'),
  },
  'mallet': {
    shape: 'hammer', color: GRN, name: tx('Soft-face mallet', 'شاكوش لين'),
    what: tx('Dead-blow mallet with nylon faces.', 'شاكوش بلا ارتداد بوجهين من النايلون.'),
    does: tx('Taps parts into place without marking them: bearings, workpieces in the vice, panels.', 'يطرق القطع لتستقر دون أن يخدشها: الرولمان البلي والمشغولات في المنجلة والألواح.'),
    spec: [tx('Head', 'الرأس'), '35 mm'],
  },
  'caliper': {
    shape: 'caliper', color: COLORS.alu, name: tx('Vernier caliper', 'قدمة ورنيّة'),
    what: tx('Stainless steel caliper with outside, inside and depth jaws.', 'قدمة من الستانلس بفكوك خارجية وداخلية وعمق.'),
    does: tx('Measures to 0.02 mm. Close the jaws gently: forcing them reads small.', 'تقيس بدقة 0.02 مم. أغلق الفكوك برفق: الضغط يعطي قراءة أصغر.'),
    spec: [RANGE, '0–150 mm · 0.02 mm'],
  },
  'micrometer': {
    shape: 'caliper', color: COLORS.steel, name: tx('Outside micrometer', 'ميكرومتر خارجي'),
    what: tx('Micrometer with a ratchet thimble.', 'ميكرومتر بجلبة سقاطة.'),
    does: tx('Measures to 0.01 mm: shafts, bearing seats, wire diameter. Always turn by the ratchet.', 'يقيس بدقة 0.01 مم: الأعمدة ومقاعد الرولمان وقطر السلك. أدر دائمًا بالسقاطة.'),
    spec: [RANGE, '0–25 mm · 0.01 mm'],
  },
  'dial-indicator': {
    shape: 'dial', color: COLORS.alu, name: tx('Dial indicator on a magnetic base', 'ساعة قياس على قاعدة مغناطيسية'),
    what: tx('A 0.01 mm dial indicator on an articulated magnetic stand.', 'ساعة قياس 0.01 مم على حامل مغناطيسي مفصلي.'),
    does: tx('Checks run-out, alignment and setting: zero it, turn the part, read the swing.', 'تفحص عدم الاستدارة والمحاذاة والضبط: صفّرها وأدر القطعة واقرأ التأرجح.'),
    spec: [RANGE, '0–10 mm · 0.01 mm'],
  },
  'tape': {
    shape: 'tape', color: YEL, name: tx('Tape measure', 'شريط قياس'),
    what: tx('Steel tape measure with a sliding hook.', 'شريط قياس صلب بخطاف منزلق.'),
    does: tx('Room and site measurements, cable runs and garment lengths.', 'قياسات الغرف والمواقع ومسارات الكابلات وأطوال الملابس.'),
    spec: [RANGE, '5 m'],
  },
  'soldering-iron': {
    shape: 'iron', color: BLU, name: tx('Soldering iron', 'كاوية لحام'),
    what: tx('Temperature-controlled iron, ESD-safe, with chisel and conical tips.', 'كاوية بتحكم في الحرارة، آمنة من الكهرباء الساكنة، بأطراف إزميلية ومخروطية.'),
    does: tx('Melts solder to join components to the board: heat the pad and the lead, then feed the solder.', 'تذيب القصدير لتثبيت المكونات على اللوحة: سخّن النقطة والطرف ثم أضف القصدير.'),
    spec: [RANGE, '200–450 °C'],
    safety: tx('Always back in the stand; the tip is 350 °C. Solder fumes go to the extractor, not your face.', 'أعدها دائمًا إلى الحامل؛ الطرف 350 درجة. أبخرة اللحام إلى الشفاط لا إلى وجهك.'),
  },
  'desolder': {
    shape: 'tester', color: BLU, name: tx('Desoldering pump and wick', 'شفاط وشريط فك اللحام'),
    what: tx('Spring solder sucker and copper braid.', 'شفاط قصدير بزنبرك وشريط نحاسي مضفر.'),
    does: tx('Removes solder to free a component without lifting the pad.', 'يزيل القصدير لتحرير المكون دون اقتلاع النقطة.'),
    spec: [tx('Braid', 'الشريط'), '2.0 mm'],
  },
  'tweezers': {
    shape: 'scissors', color: COLORS.steel, name: tx('ESD tweezers and magnifier', 'ملقاط مضاد للكهرباء الساكنة وعدسة'),
    what: tx('Fine anti-static tweezers and a 10× loupe.', 'ملقاط دقيق مضاد للكهرباء الساكنة وعدسة تكبير 10×.'),
    does: tx('Places and inspects SMD parts and solder joints.', 'لوضع وفحص مكونات SMD ونقاط اللحام.'),
    spec: [tx('Loupe', 'العدسة'), '10×'],
  },
  'rj45-crimper': {
    shape: 'crimper', color: BLK, name: tx('RJ45 crimper', 'كماشة كبس RJ45'),
    what: tx('Modular plug crimper with a cutter and stripper.', 'كماشة كبس للفيش المعيارية مع قاطع وأداة تعرية.'),
    does: tx('Terminates twisted-pair cable in T568B order: untwist as little as you can.', 'تركّب الكابل المجدول بترتيب T568B: فك الجدل بأقل قدر ممكن.'),
    spec: [tx('Plugs', 'الفيش'), 'RJ45 8P8C · RJ11'],
  },
  'cable-tester': {
    shape: 'meter', color: BLU, name: tx('Network cable tester', 'فاحص كابلات الشبكة'),
    what: tx('Wire-map tester with a remote end.', 'فاحص خريطة الأسلاك بطرف بعيد.'),
    does: tx('Checks each pair for opens, shorts, reversed and split pairs.', 'يفحص كل زوج للقطع والقصر والانعكاس والأزواج المنفصلة.'),
    spec: [tx('Tests', 'الاختبارات'), 'Cat5e/6 · PoE'],
  },
  'punch-down': {
    shape: 'tester', color: ORG, name: tx('Punch-down tool', 'أداة التركيب بالضغط'),
    what: tx('Impact tool with a 110 / Krone blade.', 'أداة صدم بنصل 110 / كرون.'),
    does: tx('Seats and trims wires in patch panels and keystone jacks.', 'تثبت الأسلاك وتقص الزائد في لوحات التوزيع والمقابس.'),
    spec: [tx('Blade', 'النصل'), '110 · Krone'],
  },
  'fibre-kit': {
    shape: 'tester', color: GRN, name: tx('Fibre cleaver and light source', 'قاطع ألياف ومصدر ضوء'),
    what: tx('Precision cleaver and a visual fault locator.', 'قاطع دقيق وكاشف أعطال مرئي.'),
    does: tx('Prepares fibre ends for splicing and finds breaks with red light.', 'يجهز أطراف الألياف للوصل ويكشف الكسور بالضوء الأحمر.'),
    spec: [tx('Locator', 'الكاشف'), '650 nm · 10 mW'],
    safety: tx('Never look into a fibre or a connector. Fibre shards go in the sharps bin, not on the bench.', 'لا تنظر أبدًا في ليف أو موصل. شظايا الألياف في صندوق الحادّات لا على الطاولة.'),
  },
  'manifold': {
    shape: 'gauge', color: BLU, name: tx('Manifold gauge set', 'طقم ساعات الضغط (المانيفولد)'),
    what: tx('Low (blue) and high (red) gauges with charging hoses, R32/R410A scales.', 'ساعة ضغط منخفض (زرقاء) وعالٍ (حمراء) مع خراطيم الشحن، بتدريج R32/R410A.'),
    does: tx('Reads system pressures and saturation temperatures for charging and fault finding.', 'تقرأ ضغوط النظام ودرجات التشبع للشحن وتشخيص الأعطال.'),
    spec: [RANGE, '−1…+55 bar'],
    safety: tx('Refrigerant at −40 °C freezes skin: gloves and glasses before any hose comes off.', 'الفريون عند −40 درجة يجمد الجلد: القفاز والنظارة قبل فك أي خرطوم.'),
  },
  'leak-detector': {
    shape: 'tester', color: GRN, name: tx('Electronic leak detector', 'كاشف تسرب إلكتروني'),
    what: tx('Heated-diode refrigerant leak detector.', 'كاشف تسرب فريون بدايود مسخن.'),
    does: tx('Finds leaks down to 3 g/year: move it slowly, 25 mm/s, below the joint.', 'يكشف التسرب حتى 3 جم/سنة: حركه ببطء 25 مم/ث أسفل الوصلة.'),
    spec: [tx('Sensitivity', 'الحساسية'), '3 g/yr'],
  },
  'tube-tools': {
    shape: 'clamp', color: COLORS.copper, name: tx('Tube cutter and flaring tool', 'قطاعة مواسير وأداة تفليره'),
    what: tx('Wheel cutter, reamer and an eccentric flaring tool.', 'قطاعة بعجلة ومنظف حواف وأداة تفليره لا مركزية.'),
    does: tx('Cuts copper pipe square, deburrs it and forms a 45° flare for the service valves.', 'تقطع ماسورة النحاس بزاوية قائمة وتنظف الحافة وتشكل تفليره 45 درجة لمحابس الخدمة.'),
    spec: [SIZE, '1/4"–7/8"'],
  },
  'torch': {
    shape: 'torch', color: RED, name: tx('Brazing torch', 'شعلة اللحام بالمونة'),
    what: tx('Oxy-acetylene or air-propane torch with flashback arrestors.', 'شعلة أكسجين وأستيلين أو هواء وبروبان مع موانع ارتداد اللهب.'),
    does: tx('Brazes copper joints with nitrogen flowing inside to stop scale.', 'تلحم وصلات النحاس بالمونة مع سريان النيتروجين بالداخل لمنع القشور.'),
    spec: [tx('Rod', 'السلك'), '5–15 % silver'],
    safety: tx('Hot-work permit, extinguisher at hand and no refrigerant in the pipe you heat.', 'تصريح أعمال ساخنة وطفاية في متناول اليد ولا فريون في الماسورة التي تسخنها.'),
  },
  'allen': {
    shape: 'allen', color: BLK, name: tx('Hex and Torx keys', 'مفاتيح ألن وتوركس'),
    what: tx('L-shaped hex and Torx keys with ball ends.', 'مفاتيح ألن وتوركس على شكل L بأطراف كروية.'),
    does: tx('Undo cap screws in machines, printers and appliances.', 'تفك مسامير الرأس الغاطس في الماكينات والطابعات والأجهزة.'),
    spec: [SIZE, '1.5–10 mm · T10–T40'],
  },
  'drill': {
    shape: 'drill', color: ORG, name: tx('Cordless drill-driver', 'شنيور لاسلكي'),
    what: tx('18 V drill-driver with a clutch and two speeds.', 'شنيور 18 فولت بقابض وسرعتين.'),
    does: tx('Drills fixing holes and drives screws; set the clutch low for small screws.', 'يثقب فتحات التثبيت ويربط المسامير؛ اضبط القابض منخفضًا للمسامير الصغيرة.'),
    spec: [tx('Chuck', 'الظرف'), '13 mm'],
    safety: tx('No gloves near a turning chuck; clamp the work, do not hold it.', 'لا قفازات قرب الظرف الدوار؛ ثبت المشغولة بالمنجلة ولا تمسكها بيدك.'),
  },
  'grinder': {
    shape: 'drill', color: GRN, name: tx('Angle grinder', 'صاروخ تجليخ'),
    what: tx('115 mm angle grinder with a guard and side handle.', 'صاروخ 115 مم بواقٍ ويد جانبية.'),
    does: tx('Cuts and grinds steel, prepares weld edges and removes slag.', 'يقطع ويجلخ الصلب ويجهز حواف اللحام ويزيل الخبث.'),
    spec: [tx('Disc', 'القرص'), '115 mm · 11 000 rpm'],
    safety: tx('Guard on, both hands, face shield, and the disc rated above the grinder speed.', 'الواقي مركب واليدان معًا وواقي الوجه، والقرص مصنف بسرعة أعلى من الصاروخ.'),
  },
  'chipping-hammer': {
    shape: 'hammer', color: RED, name: tx('Chipping hammer and wire brush', 'شاكوش تقشير وفرشاة سلك'),
    what: tx('Pointed chipping hammer and a steel wire brush.', 'شاكوش تقشير مدبب وفرشاة سلك صلب.'),
    does: tx('Removes slag between weld passes so the next pass fuses clean.', 'يزيل الخبث بين طبقات اللحام لكي تنصهر الطبقة التالية نظيفة.'),
    spec: [tx('Head', 'الرأس'), '500 g'],
    safety: tx('Slag flies hot: keep the clear glasses on under the lifted helmet.', 'الخبث يتطاير ساخنًا: أبقِ النظارة الشفافة تحت الخوذة المرفوعة.'),
  },
  'welding-pliers': {
    shape: 'pliers', color: COLORS.darkSteel, name: tx('MIG pliers', 'زرادية لحام MIG'),
    what: tx('Multi-purpose welding pliers.', 'زرادية لحام متعددة الأغراض.'),
    does: tx('Cut the wire stick-out, clean spatter from the nozzle and change contact tips.', 'تقص بروز السلك وتنظف الرذاذ من الفوهة وتغير أطراف التلامس.'),
    spec: [tx('Length', 'الطول'), '200 mm'],
  },
  'scissors': {
    shape: 'scissors', color: COLORS.steel, name: tx('Tailor\'s shears and snips', 'مقص خياطة ومقص خيوط'),
    what: tx('Bent-handle fabric shears and spring thread snips.', 'مقص قماش بيد مائلة ومقص خيوط بزنبرك.'),
    does: tx('Cuts fabric along the marked line and trims threads at the machine.', 'يقص القماش على الخط المحدد ويقص الخيوط عند الماكينة.'),
    spec: [tx('Length', 'الطول'), '250 mm'],
  },
  'densitometer': {
    shape: 'meter', color: BLK, name: tx('Densitometer and loupe', 'مقياس الكثافة وعدسة الطباعة'),
    what: tx('Reflection densitometer and a 10× print loupe.', 'مقياس كثافة انعكاسي وعدسة طباعة 10×.'),
    does: tx('Measures ink density and dot gain on the colour bar so every sheet matches the proof.', 'يقيس كثافة الحبر وزيادة النقطة على شريط الألوان لتطابق كل ورقة البروفة.'),
    spec: [tx('Reads', 'القراءات'), 'CMYK density · dot gain'],
  },
  'laptop': {
    shape: 'meter', color: COLORS.darkSteel, name: tx('Programming laptop and cables', 'حاسب البرمجة والكابلات'),
    what: tx('Laptop with the PLC/robot software, USB and Ethernet cables.', 'حاسب محمول عليه برامج PLC والروبوت مع كابلات USB وإيثرنت.'),
    does: tx('Goes online to the controller to download, monitor and force signals.', 'يتصل بالمتحكم لتحميل البرنامج ومراقبة الإشارات وفرضها.'),
    spec: [tx('Ports', 'المنافذ'), 'USB · Ethernet · RS-485'],
    safety: tx('Forcing an output moves real machinery: warn everyone and keep the guard closed.', 'فرض مخرج يحرك ماكينة حقيقية: نبّه الجميع وأبقِ الحاجز مغلقًا.'),
  },
  'obd': {
    shape: 'meter', color: BLU, name: tx('OBD diagnostic scanner', 'جهاز فحص OBD'),
    what: tx('OBD-II scan tool with live data.', 'جهاز فحص OBD-II مع بيانات حية.'),
    does: tx('Reads and clears fault codes and shows sensor values while the engine runs.', 'يقرأ ويمسح أكواد الأعطال ويعرض قيم الحساسات أثناء دوران المحرك.'),
    spec: [tx('Protocols', 'البروتوكولات'), 'CAN · K-line'],
  },
  'feelers': {
    shape: 'allen', color: COLORS.steel, name: tx('Feeler gauges', 'فلر (شرائح قياس الخلوص)'),
    what: tx('Leaves from 0.05 to 1.00 mm.', 'شرائح من 0.05 إلى 1.00 مم.'),
    does: tx('Sets valve clearance, plug gaps and checks soft foot under motor feet.', 'تضبط خلوص الصمامات وفتحة البوجيهات وتفحص القدم الرخوة تحت أقدام المحرك.'),
    spec: [RANGE, '0.05–1.00 mm'],
  },
  'puller': {
    shape: 'clamp', color: COLORS.darkSteel, name: tx('Bearing puller', 'ساحب رولمان بلي'),
    what: tx('Three-leg mechanical puller.', 'ساحب ميكانيكي بثلاثة أرجل.'),
    does: tx('Draws bearings, pulleys and couplings off shafts without hammering.', 'يسحب الرولمان البلي والطارات والوصلات من الأعمدة دون طرق.'),
    spec: [tx('Reach', 'الوصول'), '150 mm'],
  },
  'edge-finder': {
    shape: 'tester', color: RED, name: tx('Edge finder', 'باحث الحافة'),
    what: tx('Mechanical edge finder for the spindle.', 'باحث حافة ميكانيكي يركب في عمود الدوران.'),
    does: tx('Finds the workpiece edge to set the work offset; spin it at 600–800 rpm.', 'يحدد حافة المشغولة لضبط نقطة الصفر؛ أدره عند 600–800 لفة/دقيقة.'),
    spec: [tx('Tip', 'الطرف'), '⌀ 10 / 4 mm'],
  },
  'esd-kit': {
    shape: 'tester', color: GRN, name: tx('ESD wrist strap and tester', 'سوار وفاحص التفريغ الكهروستاتيكي'),
    what: tx('Wrist strap with a 1 MΩ resistor and a daily strap checker.', 'سوار يد بمقاومة 1 ميجا أوم وفاحص يومي للسوار.'),
    does: tx('Bleeds static from you before it kills a chip you cannot see.', 'يفرغ الكهرباء الساكنة منك قبل أن تتلف شريحة لا تراها.'),
    spec: [tx('Resistor', 'المقاومة'), '1 MΩ'],
  },
  'cap-discharge': {
    shape: 'tester', color: RED, name: tx('Capacitor discharge tool', 'أداة تفريغ المكثفات'),
    what: tx('Insulated probes with a 2 kΩ power resistor.', 'أطراف معزولة مع مقاومة قدرة 2 كيلو أوم.'),
    does: tx('Discharges power-supply capacitors safely after you have measured them.', 'تفرغ مكثفات مصدر التغذية بأمان بعد قياسها.'),
    spec: [tx('Resistor', 'المقاومة'), '2 kΩ · 10 W'],
  },
};

/** Each trade's eight tools, in board order (top row, then bottom row). */
export const TRADE_TOOLS: Record<string, string[]> = {
  cnc: ['caliper', 'micrometer', 'dial-indicator', 'edge-finder', 'allen', 'spanners', 'mallet', 'feelers'],
  auto: ['sockets', 'torque-wrench', 'spanners', 'screwdrivers', 'feelers', 'multimeter', 'obd', 'hammer'],
  elec: ['screwdrivers-vde', 'pliers-vde', 'stripper', 'crimper', 'voltage-tester', 'multimeter', 'clamp-meter', 'megger'],
  weld: ['chipping-hammer', 'welding-pliers', 'grinder', 'caliper', 'tape', 'hammer', 'spanners', 'allen'],
  rmg: ['scissors', 'tape', 'tweezers', 'screwdrivers', 'allen', 'spanners', 'feelers', 'mallet'],
  eim: ['dial-indicator', 'feelers', 'puller', 'torque-wrench', 'spanners', 'mallet', 'clamp-meter', 'megger'],
  prt: ['densitometer', 'spanners', 'allen', 'screwdrivers', 'feelers', 'caliper', 'tape', 'mallet'],
  ait: ['laptop', 'multimeter', 'screwdrivers-vde', 'stripper', 'crimper', 'allen', 'caliper', 'voltage-tester'],
  iel: ['soldering-iron', 'desolder', 'tweezers', 'esd-kit', 'multimeter', 'pliers-vde', 'stripper', 'screwdrivers'],
  csn: ['rj45-crimper', 'cable-tester', 'punch-down', 'fibre-kit', 'esd-kit', 'screwdrivers', 'stripper', 'laptop'],
  rac: ['manifold', 'leak-detector', 'tube-tools', 'torch', 'clamp-meter', 'multimeter', 'spanners', 'allen'],
  ham: ['multimeter', 'clamp-meter', 'megger', 'screwdrivers', 'allen', 'pliers-vde', 'crimper', 'sockets'],
  oeq: ['screwdrivers', 'allen', 'esd-kit', 'multimeter', 'tweezers', 'pliers-vde', 'laptop', 'caliper'],
  ave: ['soldering-iron', 'desolder', 'cap-discharge', 'esd-kit', 'multimeter', 'tweezers', 'screwdrivers', 'cable-tester'],
  iem: ['megger', 'clamp-meter', 'voltage-tester', 'screwdrivers-vde', 'pliers-vde', 'crimper', 'puller', 'micrometer'],
};

// ---------------------------------------------------------------------------
// Tool shapes, each about 0.7 units tall, hung from its top
// ---------------------------------------------------------------------------
function ToolShape({ shape, color }: { shape: Shape; color: string }) {
  const steel = COLORS.alu;
  switch (shape) {
    case 'screwdriver': return (
      <group>{[-0.12, 0, 0.12].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <Cyl r={0.035} len={0.26} position={[0, 0.12, 0]} color={color} rough={0.5} />
          <Cyl r={0.01} len={0.34} position={[0, -0.18, 0]} color={steel} metal={0.85} />
        </group>
      ))}</group>
    );
    case 'pliers': return (
      <group>
        <Box size={[0.05, 0.42, 0.03]} position={[-0.06, 0.06, 0]} rotation={[0, 0, -0.12]} color={color} rough={0.5} />
        <Box size={[0.05, 0.42, 0.03]} position={[0.06, 0.06, 0]} rotation={[0, 0, 0.12]} color={color} rough={0.5} />
        <Box size={[0.07, 0.22, 0.035]} position={[0, -0.25, 0]} color={steel} metal={0.8} />
        <Cyl r={0.03} len={0.05} axis="z" position={[0, -0.14, 0]} color={COLORS.steel} metal={0.8} />
      </group>
    );
    case 'spanner': return (
      <group>
        <Box size={[0.06, 0.6, 0.02]} color={color} metal={0.75} rough={0.3} />
        <Cyl r={0.07} len={0.025} axis="z" position={[0, 0.3, 0]} color={color} metal={0.75} rough={0.3} />
        <Box size={[0.13, 0.08, 0.025]} position={[0, -0.32, 0]} color={color} metal={0.75} rough={0.3} />
      </group>
    );
    case 'hammer': return (
      <group>
        <Cyl r={0.025} len={0.55} position={[0, -0.05, 0]} color={color === COLORS.red ? '#8a6a3a' : '#b08850'} rough={0.7} />
        <Box size={[0.3, 0.09, 0.08]} position={[0, 0.25, 0]} color={color} metal={0.6} />
      </group>
    );
    case 'meter': return (
      <group>
        <Box size={[0.26, 0.42, 0.07]} color={color} rough={0.6} round={0.02} />
        <Box size={[0.18, 0.1, 0.01]} position={[0, 0.1, 0.036]} color="#b8c6a0" shadow={false} />
        <Cyl r={0.06} len={0.02} axis="z" position={[0, -0.07, 0.04]} color={COLORS.black} />
        <Box size={[0.03, 0.2, 0.02]} position={[-0.06, -0.35, 0]} color={COLORS.red} />
        <Box size={[0.03, 0.2, 0.02]} position={[0.06, -0.35, 0]} color={COLORS.black} />
      </group>
    );
    case 'clamp': return (
      <group>
        <Box size={[0.12, 0.36, 0.06]} position={[0, -0.12, 0]} color={color} rough={0.6} round={0.02} />
        <Cyl r={0.12} len={0.05} axis="z" position={[0, 0.17, 0]} color={COLORS.black} open />
        <Cyl r={0.08} len={0.055} axis="z" position={[0, 0.17, 0]} color="#e9ecef" open />
      </group>
    );
    case 'tester': return (
      <group>
        <Cyl r={0.03} len={0.4} position={[0, 0, 0]} color={color} rough={0.5} />
        <Cyl r={0.008} len={0.16} position={[0, -0.27, 0]} color={steel} metal={0.85} />
        <Box size={[0.04, 0.06, 0.02]} position={[0, 0.12, 0.028]} color="#103a12" emissive="#2fff80" glow={0.5} shadow={false} />
      </group>
    );
    case 'caliper': return (
      <group>
        <Box size={[0.04, 0.65, 0.01]} color={color} metal={0.85} rough={0.25} />
        <Box size={[0.14, 0.03, 0.012]} position={[0.06, 0.3, 0]} color={color} metal={0.85} rough={0.25} />
        <Box size={[0.14, 0.03, 0.012]} position={[0.06, 0.16, 0.006]} color={color} metal={0.85} rough={0.25} />
        <Box size={[0.07, 0.1, 0.015]} position={[0.01, 0.12, 0.01]} color={COLORS.steel} metal={0.8} />
      </group>
    );
    case 'tape': return (
      <group>
        <Cyl r={0.12} len={0.06} axis="z" color={color} rough={0.5} />
        <Box size={[0.06, 0.05, 0.065]} position={[0.08, -0.11, 0]} color={COLORS.black} />
      </group>
    );
    case 'iron': return (
      <group>
        <Cyl r={0.03} len={0.3} position={[0, 0.12, 0]} color={color} rough={0.5} />
        <Cyl r={0.015} r2={0.004} len={0.22} position={[0, -0.14, 0]} color={COLORS.steel} metal={0.8} />
        <Cyl r={0.006} len={0.2} position={[0, 0.36, 0]} color={COLORS.black} />
      </group>
    );
    case 'crimper': return (
      <group>
        <Box size={[0.05, 0.4, 0.03]} position={[-0.07, 0.08, 0]} rotation={[0, 0, -0.18]} color={color} rough={0.5} />
        <Box size={[0.05, 0.4, 0.03]} position={[0.07, 0.08, 0]} rotation={[0, 0, 0.18]} color={color} rough={0.5} />
        <Box size={[0.13, 0.16, 0.04]} position={[0, -0.2, 0]} color={COLORS.darkSteel} metal={0.7} />
      </group>
    );
    case 'gauge': return (
      <group>
        <Box size={[0.42, 0.1, 0.08]} position={[0, -0.12, 0]} color={COLORS.alu} metal={0.8} />
        {[-0.12, 0.12].map((x, i) => (
          <group key={x} position={[x, 0.06, 0]}>
            <Cyl r={0.1} len={0.05} axis="z" color={i ? COLORS.red : color} />
            <Cyl r={0.085} len={0.052} axis="z" color="#f4f4f0" />
          </group>
        ))}
        {[-0.12, 0, 0.12].map((x, i) => <Cyl key={x} r={0.012} len={0.2} position={[x, -0.27, 0]} color={[COLORS.blue, COLORS.yellow, COLORS.red][i]!} />)}
      </group>
    );
    case 'torch': return (
      <group>
        <Cyl r={0.03} len={0.32} position={[0, 0.1, 0]} color={COLORS.brass} metal={0.8} />
        <Cyl r={0.01} len={0.25} position={[0.04, -0.15, 0]} color={COLORS.copper} metal={0.8} />
        {[-0.03, 0.03].map((x) => <Cyl key={x} r={0.02} len={0.04} axis="x" position={[x * 2, 0.28, 0]} color={x < 0 ? color : COLORS.green} />)}
      </group>
    );
    case 'drill': return (
      <group>
        <Box size={[0.32, 0.12, 0.08]} position={[0, 0.15, 0]} color={color} rough={0.5} round={0.02} />
        <Box size={[0.08, 0.26, 0.07]} position={[0.05, -0.04, 0]} color={COLORS.black} />
        <Box size={[0.16, 0.08, 0.1]} position={[0.05, -0.2, 0]} color={COLORS.black} />
        <Cyl r={0.035} len={0.08} axis="x" position={[-0.2, 0.15, 0]} color={COLORS.darkSteel} metal={0.8} />
      </group>
    );
    case 'allen': return (
      <group>{[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[-0.12 + i * 0.06, 0, 0]}>
          <Box size={[0.015 + i * 0.003, 0.25 + i * 0.05, 0.015]} color={color} metal={0.7} />
          <Box size={[0.06, 0.015 + i * 0.003, 0.015]} position={[0.02, 0.12 + i * 0.025, 0]} color={color} metal={0.7} />
        </group>
      ))}</group>
    );
    case 'scissors': return (
      <group>
        <Box size={[0.03, 0.4, 0.01]} position={[-0.02, -0.08, 0]} rotation={[0, 0, 0.08]} color={color} metal={0.85} />
        <Box size={[0.03, 0.4, 0.01]} position={[0.02, -0.08, 0.01]} rotation={[0, 0, -0.08]} color={color} metal={0.85} />
        {[-0.07, 0.07].map((x) => <Cyl key={x} r={0.06} len={0.02} axis="z" position={[x, 0.18, 0]} color={COLORS.black} open />)}
      </group>
    );
    case 'dial': return (
      <group>
        <Cyl r={0.12} len={0.05} axis="z" position={[0, 0.12, 0]} color={color} metal={0.7} />
        <Cyl r={0.1} len={0.052} axis="z" position={[0, 0.12, 0]} color="#f4f4f0" />
        <Cyl r={0.01} len={0.2} position={[0, -0.08, 0]} color={COLORS.steel} metal={0.85} />
        <Box size={[0.18, 0.12, 0.12]} position={[0, -0.28, 0]} color={COLORS.black} />
      </group>
    );
  }
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------
const BOARD_Z = -0.85;
const slot = (i: number): V3 => [-1.5 + (i % 4) * 1.0, i < 4 ? 1.75 : 0.85, BOARD_Z + 0.06];

const Pegboard = ({ ids, accent }: { ids: string[]; accent: string }) => (
  <group>
    <Box size={[4.4, 2.3, 0.05]} position={[0, 1.2, BOARD_Z]} color="#e6e1d3" rough={0.8} />
    <Box size={[4.4, 0.18, 0.06]} position={[0, 2.4, BOARD_Z + 0.01]} color={accent} rough={0.5} />
    {/* Peg holes */}
    {Array.from({ length: 21 }, (_, x) => Array.from({ length: 10 }, (_, y) => (
      <Box key={`${x}.${y}`} size={[0.02, 0.02, 0.005]} position={[-2.0 + x * 0.2, 0.2 + y * 0.22, BOARD_Z + 0.027]} color="#b9b2a0" shadow={false} />
    )))}
    {/* Painted shadows and hooks: an empty outline shows what is missing */}
    {ids.map((id, i) => {
      const [x, y, z] = slot(i);
      return (
        <group key={id}>
          <Box size={[0.7, 0.85, 0.004]} position={[x, y - 0.12, z - 0.03]} color="#3a4048" rough={0.9} shadow={false} round={0.04} />
          <Cyl r={0.012} len={0.08} axis="z" position={[x, y + 0.27, z - 0.01]} color={COLORS.steel} metal={0.8} />
        </group>
      );
    })}
    <Sticker kind="mandatory" pic="exclaim" caption="5S" size={0.22} position={[1.95, 2.1, BOARD_Z + 0.03]} />
    {/* Uprights down to the bench top */}
    {[-2.15, 2.15].map((x) => <Box key={x} size={[0.08, 2.4, 0.08]} position={[x, 1.2, BOARD_Z - 0.04]} color="#5b6670" metal={0.5} />)}
  </group>
);

function toolPart(id: string, i: number): BiPart {
  const t = TOOLS[id]!;
  const at = slot(i);
  return {
    id, name: t.name, explode: [0, 0.1, 1.1], stage: i * 0.04,
    brief: { what: t.what, does: t.does },
    render: () => <group position={at} scale={1.25}><ToolShape shape={t.shape} color={t.color} /></group>,
    hotspot: { position: [at[0], at[1] + 0.2, at[2] + 0.1], title: t.name, specs: [t.spec], safety: t.safety },
  };
}

const NAMES: Record<string, Txt> = {
  cnc: tx('CNC machining', 'التشغيل بالتحكم الرقمي'), auto: tx('Automotive', 'السيارات'), elec: tx('Electrical installations', 'التركيبات الكهربائية'),
  weld: tx('Welding and fabrication', 'اللحام والتشكيل'), rmg: tx('Garment making', 'صناعة الملابس'), eim: tx('Electromechanical maintenance', 'الصيانة الكهروميكانيكية'),
  prt: tx('Printing', 'الطباعة'), ait: tx('Automation', 'الأتمتة'), iel: tx('Industrial electronics', 'الإلكترونيات الصناعية'),
  csn: tx('Computer systems and networks', 'نظم وشبكات الحاسب'), rac: tx('Refrigeration and air conditioning', 'التبريد والتكييف'),
  ham: tx('Home appliances', 'الأجهزة المنزلية'), oeq: tx('Office equipment', 'المعدات المكتبية'), ave: tx('Audio-visual equipment', 'الأجهزة السمعية والبصرية'),
  iem: tx('Industrial electrical maintenance', 'الصيانة الكهربائية الصناعية'),
};

function makeBoard(trade: string, accent: string): ModelDef {
  const ids = TRADE_TOOLS[trade]!;
  const name = NAMES[trade]!;
  return {
    id: `tools-${trade}`,
    title: tx(`Tool board: ${name.en}`, `لوحة العدد: ${name.ar}`),
    assetTag: `${trade.toUpperCase()} · shadow board`,
    view: { camera: [0.9, 1.7, 5.6], target: [0, 1.1, -0.5] },
    env: {
      unitsPerM: 2.5, floorY: -2.25, stand: 'bench', bay: trade as NonNullable<ModelDef['env']>['bay'],
      stations: [
        { id: 'front', label: tx('At the tool board', 'أمام لوحة العدد'), pos: [0, 1.6], face: Math.PI, pose: 'inspect', reach: [0, 1.2, -0.6] },
        { id: 'left', label: tx('Left half', 'النصف الأيسر'), pos: [-0.5, 1.4], face: Math.PI, pose: 'reach', reach: [-1.0, 1.3, -0.7] },
        { id: 'right', label: tx('Right half', 'النصف الأيمن'), pos: [0.5, 1.4], face: Math.PI, pose: 'reach', reach: [1.0, 1.3, -0.7] },
        { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.4, 2.8], face: -Math.PI / 2, pose: 'idle' },
      ],
    },
    parts: [
      ...ids.map(toolPart),
      {
        id: 'board', name: tx('Shadow board', 'لوحة الظلال'), explode: [0, 0, -0.4], stage: 0.5,
        brief: {
          what: tx('A pegboard with every tool\'s outline painted behind its hook.', 'لوحة مثقبة عليها حدود كل أداة مرسومة خلف خطافها.'),
          does: tx('Shows at a glance what is missing before a machine is restarted, so no tool is left inside it (5S: set in order).', 'تُظهر بنظرة ما ينقص قبل إعادة تشغيل الماكينة، حتى لا تُترك أداة بداخلها (5S: الترتيب).'),
        },
        render: () => <Pegboard ids={ids} accent={accent} />,
        hotspot: { position: [1.95, 2.25, BOARD_Z + 0.1], title: tx('Shadow board', 'لوحة الظلال'), specs: [[tx('Rule', 'القاعدة'), tx('Count the tools back before you sign off the job', 'عدّ العدد قبل توقيع إنهاء العمل')]] },
      },
    ],
  };
}

/** One board per trade, keyed by trade id. */
export const TOOL_BOARDS: Record<string, ModelDef> = Object.fromEntries(
  Object.entries({
    cnc: '#2f8fd8', auto: '#d9463b', elec: '#e8a70a', weld: '#f06721', rmg: '#c2417a', eim: '#3a9d5d', prt: '#7a4fd1', ait: '#0f9fb0',
    iel: '#f08c00', csn: '#1098ad', rac: '#4dabf7', ham: '#e64980', oeq: '#5c7cfa', ave: '#ae3ec9', iem: '#fab005',
  }).map(([trade, accent]) => [trade, makeBoard(trade, accent)]),
);
