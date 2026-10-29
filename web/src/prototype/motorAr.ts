/** Arabic copy for the induction-motor explorer: part names, spec cards and the explorer's controls. */
import type { ExplorerStrings, PartSpec } from '../components/MachineExplorer';
import { inductionMotorParts } from '../models/inductionMotor';
import { tx, type ModelDef } from '../models/kit';

/** Keeps part numbers like 6205-2Z in left-to-right order inside Arabic text. */
const ltr = (t: string) => `\u2066${t}\u2069`;

const AR: Record<string, { name: string; title: string; specs: Record<string, string>; safety?: string }> = {
  terminal_lid: { name: 'غطاء صندوق الأطراف', title: 'صندوق الأطراف (U1 · V1 · W1)',
    specs: { 'التوصيل': 'Δ 400 V / Y 690 V', 'عزم ربط القناطر': '2.5 N·m', 'جلبة الكابل': 'M25 × 1.5، IP55' },
    safety: 'افصل التغذية واقفلها وأثبت انعدام الجهد (LOTO) قبل فك هذا الغطاء.' },
  fan_cover: { name: 'غطاء المروحة', title: 'غطاء المروحة',
    specs: { 'الخامة': 'صاج مكبوس 1.0 مم', 'التثبيت': '3 مسامير M5', 'الحماية': 'واقي أصابع IP55' } },
  fan: { name: 'مروحة التبريد', title: 'مروحة التبريد',
    specs: { 'الخامة': 'بولي بروبلين مقوّى بالزجاج 30%', 'التثبيت': 'حلقة زنق DIN 471 – 24', 'الدوران': 'في الاتجاهين' } },
  nde_shield: { name: 'الغطاء الطرفي (الجهة الخلفية)', title: 'الغطاء الطرفي NDE',
    specs: { 'الخامة': 'حديد زهر EN-GJL-200', 'المسامير': '4 × M8، ‏25 N·m (ربط متقاطع)', 'التمركز': 'تجميع H7' } },
  de_shield: { name: 'الغطاء الطرفي (جهة الإدارة)', title: 'الغطاء الطرفي DE',
    specs: { 'الخامة': 'حديد زهر EN-GJL-200', 'المسامير': '4 × M8، ‏25 N·m (ربط متقاطع)', 'الفك': 'استخدم مسامير الدفع، ولا تستخدم العتلة أبدًا' } },
  nde_bearing: { name: `رولمان ${ltr('6205-2Z')} (NDE)`, title: 'رولمان الجهة الخلفية',
    specs: { 'النوع': '6205-2Z/C3', 'المقاس': '25 × 52 × 15 مم', 'التزييت': 'مغلق، مشحّم مدى العمر', 'عمر L10': '≈ 40 000 ساعة' } },
  de_bearing: { name: `رولمان ${ltr('6206-2Z')} (DE)`, title: 'رولمان جهة الإدارة',
    specs: { 'النوع': '6206-2Z/C3', 'المقاس': '30 × 62 × 16 مم', 'التركيب': 'تسخين بالحث حتى 110 °C', 'الأداة': 'ساحبة رولمان فقط' },
    safety: 'ارتدِ قفازات مقاومة للحرارة عند التعامل مع الرولمان الساخن.' },
  stator_frame: { name: 'العضو الثابت والهيكل', title: 'العضو الثابت والهيكل',
    specs: { 'القدرة': '7.5 kW، ‏4 أقطاب، 1455 لفة/دقيقة', 'العزل': 'فئة F (ارتفاع حرارة فئة B)', 'مقاس الهيكل': 'IEC 132M', 'الكفاءة': 'IE3 – 89.6 %' },
    safety: 'اختبار الميجر عند 500 V DC بعد إعادة اللف: ≥ 100 MΩ بين الطور والأرضي.' },
  rotor: { name: 'العضو الدوار والعمود', title: 'عضو دوار قفصي',
    specs: { 'القفص': 'ألومنيوم مصبوب بالضغط، قضبان مائلة', 'طرف العمود': 'Ø38 k6 × 80 مم', 'الخابور': 'DIN 6885 10 × 8 × 70', 'الاتزان': 'نصف خابور، G2.5' } },
};

export const inductionMotorPartsAr: PartSpec[] = inductionMotorParts.map((p) => {
  const a = AR[p.id];
  if (!a || !p.hotspot) return p;
  return { ...p, name: a.name, hotspot: { ...p.hotspot, title: a.title, specs: a.specs, safety: a.safety ?? p.hotspot.safety } };
});

export const explorerStringsAr: ExplorerStrings = {
  digitalTwin: 'التوأم الرقمي', viewModes: 'أوضاع العرض', xray: 'أشعة سينية', cutaway: 'مقطع', run: 'تشغيل', stop: 'إيقاف',
  assemble: 'تجميع', explode: 'تفكيك', explodedView: 'العرض المفكك', component: 'المكوّن',
  datasheet: 'فتح ورقة البيانات ←', hint: 'اضغط على دبوس مرقّم أو على قطعة لعرض مواصفاتها.',
  vr: 'دخول الواقع الافتراضي', vrExit: 'خروج من الواقع الافتراضي',
  vrStereoNote: 'لا توجد نظارة واقع افتراضي، لذا هذا هو العرض المجسم: ضع الهاتف في نظارة VR (مثل Cardboard) واسحب للنظر حولك.',
  vrHeadset: 'واقع افتراضي غامر على نظارتك. انزعها أو اضغط «خروج» للعودة.',
};

/** The induction motor as a switchable model (its Arabic comes from the table above). */
export const motorModel: ModelDef = {
  id: 'induction-motor',
  title: tx('3-phase induction motor · IEC 132M', 'محرك حثي ثلاثي الأطوار · IEC 132M'),
  assetTag: 'WS-ELEC-07 · MTR-0132',
  parts: [],
  specs: (lang) => (lang === 'ar' ? inductionMotorPartsAr : inductionMotorParts),
};
