/**
 * Welding & fabrication. The V-Lab is a MIG/MAG weld-defect test: the test
 * bead shows a defect and the learner traces it to gas, tip, polarity or
 * liner, without touching the wire drive while the welder is live.
 */
import { tx } from '../i18n';
import { heatmap } from './shared';
import type { Trade } from './types';
import { migLab } from '../../../../api/src/labs/mig';

export const weld: Trade = {
  id: 'weld',
  code: 'WELD',
  name: tx('Welding & fabrication', 'اللحام والتشكيل'),
  icon: 'M4 20l6-6M10 14l3 3M13 17l7-7-3-3-7 7M15 4l1 2M19 3l-1 2M21 7l-2 1',
  framework: { code: 'NTQF-WELD-L3', title: tx('Welding & Fabrication Technician L3', 'فني لحام وتشكيل — المستوى 3') },
  units: [
    { code: 'U01', title: tx('Hot-work & fume safety', 'سلامة الأعمال الساخنة والأبخرة') },
    { code: 'U02', title: tx('Reading weld symbols', 'قراءة رموز اللحام') },
    { code: 'U03', title: tx('MMA (stick) welding', 'لحام القوس اليدوي (MMA)') },
    { code: 'U04', title: tx('MIG/MAG welding', 'لحام MIG/MAG') },
    { code: 'U05', title: tx('TIG welding', 'لحام TIG') },
    { code: 'U06', title: tx('Weld inspection & defects', 'فحص اللحام وعيوبه') },
  ],
  bay: {
    name: tx('Welding Bay 3', 'ورشة اللحام 3'),
    cohort: tx('Welding & fabrication Y1-C', 'اللحام والتشكيل، السنة الأولى ج'),
    trainer: tx('Eng. Sherif Ali', 'م. شريف علي'), trainerInitials: tx('SA', 'ش'),
    jobCards: 'JC-W305, JC-W309',
  },
  learner: { name: tx('Hassan Gamal', 'حسن جمال'), initials: tx('HG', 'ح') },
  stations: (() => {
    const FILLET = tx('Fillet weld 10 mm plate, PB (2F), MAG', 'لحام زاوية لوح 10 مم، وضع PB ‏(2F)، MAG');
    const BUTT = tx('Butt weld 6 mm plate, PA (1G)', 'لحام تناكبي لوح 6 مم، وضع PA ‏(1G)');
    return [
      { no: 1, learner: tx('Hassan Gamal', 'حسن جمال'), jobCard: 'JC-W305', task: FILLET, status: 'working' },
      { no: 2, learner: tx('Mohamed Saber', 'محمد صابر'), jobCard: 'JC-W305', task: FILLET, status: 'alert' },
      { no: 3, learner: tx('Ali Mahmoud', 'علي محمود'), jobCard: 'JC-W309', task: BUTT, status: 'done', score: 81, passed: true },
      { no: 4, learner: tx('Eman Fekry', 'إيمان فكري'), jobCard: 'JC-W305', task: FILLET, status: 'working' },
      { no: 5, learner: tx('Waleed Hany', 'وليد هاني'), jobCard: 'JC-W309', task: BUTT, status: 'working' },
      { no: 6, learner: tx('Mahmoud Essam', 'محمود عصام'), jobCard: 'JC-W305', task: FILLET, status: 'idle' },
      { no: 7, learner: tx('Reem Ashraf', 'ريم أشرف'), jobCard: 'JC-W309', task: BUTT, status: 'working' },
      { no: 8, learner: tx('Ibrahim Said', 'إبراهيم سعيد'), jobCard: 'JC-W305', task: FILLET, status: 'done', score: 66, passed: false },
    ];
  })(),
  obsRubric: [
    { key: 'ppe', label: tx('PPE worn (helmet shade 11, leather gloves, FR jacket)', 'ارتداء معدات الوقاية (خوذة درجة تعتيم 11، قفازات جلدية، سترة مقاومة للهب)'), kind: 'gate' },
    { key: 'hot_work', label: tx('Fume extraction on, screens closed, no flammables', 'شفط الأبخرة يعمل، الستائر مغلقة، لا مواد قابلة للاشتعال'), kind: 'gate' },
    { key: 'prep', label: tx('Joint preparation & fit-up', 'تجهيز الوصلة والتركيب'), kind: 'rating', weight: 20 },
    // Fillet leg on 10 mm plate: 6 mm, −0.5 / +1.0 mm.
    { key: 'leg', label: tx('Fillet leg length 6 mm', 'طول ساق لحام الزاوية 6 مم'), kind: 'tolerance', weight: 30,
      nominal: 6, lower: -0.5, upper: 1, unit: 'mm', measure: tx('Measured leg length in mm', 'طول الساق المقاس بالمليمتر') },
    { key: 'visual', label: tx('Visual: no undercut, porosity or cracks', 'الفحص البصري: لا تآكل حواف ولا مسامية ولا شروخ'), kind: 'rating', weight: 30 },
    { key: 'housekeeping', label: tx('Housekeeping & cylinder storage', 'النظافة وتخزين الأسطوانات'), kind: 'rating', weight: 20 },
  ],
  obsNote: tx('e.g. Even travel speed; watch the stick-out on the second run', 'مثال: سرعة تقدم منتظمة؛ انتبه لطول السلك البارز في المرور الثاني'),
  initialAlert: { stationNo: 2, learner: tx('Mohamed Saber', 'محمد صابر'),
    text: tx('Welding with the fume extraction arm switched off', 'يلحم وذراع شفط الأبخرة متوقف') },
  assets: [
    { tag: 'MIG-01', name: tx('MIG/MAG welding booth', 'كابينة لحام MIG/MAG'), pct: 91 },
    { tag: 'MIG-02', name: tx('MIG/MAG welding booth', 'كابينة لحام MIG/MAG'), pct: 84 },
    { tag: 'TIG-01', name: tx('TIG welding booth', 'كابينة لحام TIG'), pct: 57 },
    { tag: 'PLAS-01', name: tx('Plasma cutter', 'ماكينة قطع بلازما'), pct: 44 },
    { tag: 'MMA-03', name: tx('MMA welding booth', 'كابينة لحام MMA'), pct: 31 },
  ],
  consumables: [
    { code: 'WIRE-1.0', name: tx('ER70S-6 MIG wire 1.0 mm', 'سلك لحام ER70S-6 ‏1.0 مم'), onHand: 30, reorderAt: 45, unit: tx('kg', 'كجم') },
    { code: 'GAS-M21', name: tx('Ar/CO₂ M21 cylinders', 'أسطوانات غاز Ar/CO₂ ‏M21'), onHand: 3, reorderAt: 2, unit: tx('cyl', 'أسطوانة') },
    { code: 'TIP-1.0', name: tx('Contact tips 1.0 mm', 'أطراف تلامس 1.0 مم'), onHand: 48, reorderAt: 25, unit: tx('pcs', 'قطعة') },
  ],
  bank: [
    { id: 'Q-3051', unit: 'U04', stem: tx('For MAG on mild steel with solid wire, the torch should be…', 'في لحام MAG للصلب الطري بسلك مصمت يكون المشعل…'), p: 0.12, d: 0.21 },
    { id: 'Q-3077', unit: 'U06', stem: tx('Undercut along the toe of a fillet is usually caused by…', 'تآكل الحافة عند قدم لحام الزاوية سببه غالبًا…'), p: 0.63, d: 0.35 },
    { id: 'Q-3012', unit: 'U01', stem: tx('Minimum helmet shade for MIG at 200 A is…', 'أقل درجة تعتيم للخوذة في لحام MIG عند 200 أمبير هي…'), p: 0.87, d: 0.18 },
    { id: 'Q-3102', unit: 'U02', stem: tx('On the weld symbol shown, the flag at the bend means…', 'في رمز اللحام الموضح، العلم عند الانحناء يعني…'), p: 0.41, d: 0.13 },
  ],
  heatmap: heatmap([84, 63, 71, 67, 50, 58], 4),
  heatNote: tx('Weakest unit: U05 TIG welding. TIG-01 has spare hours to run an extra practice block.',
    'أضعف وحدة: U05 لحام TIG. لدى TIG-01 ساعات متاحة لتنظيم فترة تدريب إضافية.'),
  assetNote: tx('MIG-01 runs above 85% and MMA-03 sits under 35%: move JC-W309 root runs to MMA-03.',
    'كابينة MIG-01 تعمل فوق 85% وMMA-03 تحت 35%: انقل مرور الجذر في JC-W309 إلى MMA-03.'),
  overview: { learners: 158, attainment: 66, utilisation: 61, wbl: 77 },
  seedEvals: [
    { learner: tx('Ali Mahmoud', 'علي محمود'), mode: 'Exam', score: 84, passed: true, gateFailures: [], at: tx('Today 08:30', 'اليوم 08:30') },
    { learner: tx('Ibrahim Said', 'إبراهيم سعيد'), mode: 'Exam', score: 54, passed: false, gateFailures: ['loto'], at: tx('Yesterday 14:05', 'أمس 14:05') },
  ],
  lab: migLab,
};
