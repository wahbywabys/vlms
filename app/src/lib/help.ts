/**
 * The in-app Instructions (تعليمات): short step-by-step guides for people who
 * are new to phones and computers. Each guide is one task, a few steps, one
 * picture per step where it helps. Pictures are real screens in
 * public/help/{ar,en}/<name>.webp (retake them with the screenshot script in
 * docs/help.md when a screen changes); `ill` is a drawn picture (HelpArt).
 */
import { tx, type Txt } from './i18n';

export type HelpAudience = 'everyone' | 'student' | 'trainer' | 'teacher' | 'supervisor' | 'director' | 'admin';
export type HelpArt = 'wifi' | 'scan' | 'home' | 'signin' | 'server' | 'sticker' | 'offline' | 'lang';
export interface HelpStep { t: Txt; img?: string; ill?: HelpArt }
export interface HelpGuide { id: string; audience: HelpAudience; title: Txt; intro?: Txt; steps: HelpStep[]; tip?: Txt }

export const AUDIENCES: { key: HelpAudience; label: Txt; icon: string }[] = [
  { key: 'everyone', label: tx('Start here', 'ابدأ من هنا'), icon: '★' },
  { key: 'student', label: tx('Trainee', 'المتدرب'), icon: '🎓' },
  { key: 'trainer', label: tx('Trainer', 'المدرب'), icon: '🛠' },
  { key: 'teacher', label: tx('Teacher', 'المعلم'), icon: '📘' },
  { key: 'supervisor', label: tx('Workplace supervisor', 'مشرف موقع العمل'), icon: '🏭' },
  { key: 'director', label: tx('Manager', 'المدير'), icon: '📊' },
  { key: 'admin', label: tx('Centre server', 'جهاز المركز'), icon: '🖥' },
];

/** Which audience a workspace opens on. */
export const AUDIENCE_FOR_WORKSPACE: Record<string, HelpAudience> = {
  student: 'student', trainer: 'trainer', teacher: 'teacher', supervisor: 'supervisor', director: 'director',
};

export const GUIDES: HelpGuide[] = [
  // ---------------------------------------------------------------- everyone
  {
    id: 'connect', audience: 'everyone',
    title: tx('Open VTC_LMS on your phone for the first time', 'افتح VTC_LMS على موبايلك أول مرة'),
    intro: tx('You only do this once. Ask the trainer if you get stuck.', 'هتعمل ده مرة واحدة بس. لو وقفت في خطوة اسأل المدرب.'),
    steps: [
      { ill: 'wifi', t: tx('Open Wi-Fi on your phone and choose the centre network. Type the Wi-Fi password written on the poster. It is normal if the phone says "No internet".',
        'افتح الواي فاي في الموبايل واختار شبكة المركز. اكتب كلمة سر الواي فاي المكتوبة على الملصق. عادي جدًا لو الموبايل كتب "لا يوجد إنترنت".') },
      { ill: 'scan', img: 'join', t: tx('Open the camera and point it at the square code (QR) on the poster. Tap the link that appears.',
        'افتح الكاميرا ووجّهها على المربع (كود QR) اللي على الملصق. اضغط على الرابط اللي يظهر.') },
      { img: 'login', t: tx('Write your email and password, then tap "Sign in". Your trainer gives you these.',
        'اكتب البريد الإلكتروني وكلمة المرور، واضغط "دخول". المدرب هو اللي بيديهم لك.') },
      { ill: 'home', t: tx('Keep it on your home screen so you find it easily: on Android tap ⋮ then "Add to Home screen"; on iPhone tap Share then "Add to Home Screen".',
        'خلّيه على الشاشة الرئيسية علشان تلاقيه بسهولة: في أندرويد اضغط ⋮ ثم "إضافة إلى الشاشة الرئيسية"، وفي الآيفون اضغط "مشاركة" ثم "إضافة إلى الشاشة الرئيسية".') },
    ],
    tip: tx('Next time, just join the centre Wi-Fi and tap the VTC_LMS icon.', 'المرة الجاية: اتصل بواي فاي المركز واضغط على أيقونة VTC_LMS وخلاص.'),
  },
  {
    id: 'basics', audience: 'everyone',
    title: tx('Arabic or English, big screen, sign out', 'عربي أو إنجليزي، تكبير الشاشة، الخروج'),
    steps: [
      { ill: 'lang', t: tx('Tap "عربي" or "EN" at the top to change the language.', 'اضغط "عربي" أو "EN" فوق علشان تغيّر اللغة.') },
      { t: tx('Tap the square button ⛶ next to it to fill the whole screen. Tap it again to go back.', 'اضغط زرار المربع ⛶ اللي جنبه علشان الشاشة تكبر. اضغطه تاني علشان ترجع.') },
      { t: tx('To sign out (for example on a shared tablet), tap your name or initial at the top, then "Sign out".', 'علشان تخرج (مثلًا على تابلت مشترك)، اضغط على اسمك أو الحرف بتاعك فوق، وبعدين "تسجيل الخروج".') },
    ],
  },
  {
    id: 'offline', audience: 'everyone',
    title: tx('If the connection drops', 'لو الاتصال قطع'),
    steps: [
      { ill: 'offline', t: tx('Keep working. What you save is kept on the device and sent by itself when the Wi-Fi is back.',
        'كمّل شغلك عادي. اللي بتحفظه بيتخزن على الجهاز ويتبعت لوحده لما الواي فاي يرجع.') },
      { t: tx('If a page does not open: check you are on the centre Wi-Fi (not mobile data), then pull down to reload.',
        'لو صفحة مش بتفتح: اتأكد إنك على واي فاي المركز (مش باقة الموبايل)، وبعدين اسحب الشاشة لتحت علشان تتحدث.') },
      { t: tx('Still not working? Tell the trainer: the centre computer may be switched off.', 'لسه مش شغال؟ قول للمدرب: ممكن جهاز المركز يكون مقفول.') },
    ],
  },

  // ----------------------------------------------------------------- student
  {
    id: 'student-home', audience: 'student',
    title: tx('See my progress', 'أشوف تقدّمي'),
    steps: [
      { img: 'student-home', t: tx('After you sign in you see "My progress": your skills, your best V-Lab score, your work-site hours and your certificates.',
        'بعد ما تدخل هتلاقي صفحة "تقدّمي": مهاراتك، وأحسن درجة في المعمل الافتراضي، وساعاتك في موقع العمل، وشهاداتك.') },
      { t: tx('An orange box means a safety skill you still need. Your trainer will help you with it.', 'المربع البرتقالي معناه مهارة سلامة لسه محتاجها. المدرب هيساعدك فيها.') },
    ],
  },
  {
    id: 'student-machine', audience: 'student',
    title: tx('Use a machine in the workshop (scan its sticker)', 'أشغّل ماكينة في الورشة (أمسح الملصق بتاعها)'),
    intro: tx('Every machine has a sticker with a square code. The machine opens for you only after a short safety check.',
      'كل ماكينة عليها ملصق فيه مربع كود. الماكينة بتفتح لك بس بعد فحص سلامة قصير.'),
    steps: [
      { img: 'student-machine-scan', t: tx('Tap "Machine access" at the top, then "Tap to open the camera".', 'اضغط "تشغيل الماكينة" فوق، وبعدين "اضغط لفتح الكاميرا".') },
      { ill: 'sticker', t: tx('Point the camera at the sticker on the machine. If the camera does not work, type the code written under the square and tap "Done".',
        'وجّه الكاميرا على الملصق اللي على الماكينة. لو الكاميرا مش شغالة، اكتب الكود المكتوب تحت المربع واضغط "تم".') },
      { t: tx('Answer the few safety questions. If you pass, the machine is unlocked for your session.', 'جاوب على أسئلة السلامة القليلة. لو نجحت، الماكينة بتتفتح لك طول الجلسة.') },
      { t: tx('When you finish, tap "Finished · lock the machine". Never leave a machine unlocked.', 'لما تخلّص اضغط "انتهيت · اقفل الماكينة". متسيبش ماكينة مفتوحة أبدًا.') },
    ],
    tip: tx('Not allowed? The screen tells you why (for example, a skill you still need). Ask your trainer.', 'مش مسموح لك؟ الشاشة بتقول السبب (مثلًا مهارة لسه محتاجها). اسأل المدرب.'),
  },
  {
    id: 'student-lab', audience: 'student',
    title: tx('Practise in the V-Lab and 3D lessons', 'أتدرب في المعمل الافتراضي والدروس ثلاثية الأبعاد'),
    steps: [
      { img: 'student-lab', t: tx('Tap "V-Lab". Choose a machine to turn it around with your finger, watch a lesson, or try the safety challenge.',
        'اضغط "المعمل الافتراضي". اختار ماكينة وحرّكها بصباعك، أو اتفرج على درس، أو جرّب تحدي السلامة.') },
      { t: tx('Tap any part of the machine to read what it is and what it does. "Section" cuts the machine open so you can see inside.',
        'اضغط على أي جزء في الماكينة علشان تقرا هو إيه وبيعمل إيه. زرار "مقطع" بيفتح الماكينة علشان تشوف جوه.') },
      { t: tx('VR with a phone viewer (Cardboard-style): open the centre\'s https:// address on the phone, tap "Enter VR" and allow motion access. Turn the phone sideways, put it in the viewer and turn your head to look around. Tap the screen to re-centre.',
        'الواقع الافتراضي بنظارة موبايل (زي Cardboard): افتح عنوان المركز اللي بيبدأ بـ https:// على الموبايل، اضغط "دخول الواقع الافتراضي" واسمح بالوصول للحركة. لف الموبايل بالعرض وحطه في النظارة وحرّك راسك علشان تبص حواليك. اضغط الشاشة علشان ترجّع المنظر قدامك.') },
      { t: tx('In "Safety simulator", choose your PPE and do the job step by step. A wrong step shows what happens in a real workshop; tap "Rewind and try again" and do it safely.',
        'في "محاكي السلامة" اختار معدات الوقاية واعمل المهمة خطوة بخطوة. لو خطوة غلط هتشوف اللي بيحصل في الورشة الحقيقية؛ اضغط "ارجع وحاول مرة أخرى" واعملها بأمان.') },
      { t: tx('In the fault test, find what is wrong with the machine safely. Your score comes at the end. (Some programmes have no fault test yet.)',
        'في اختبار الأعطال، دوّر على العطل في الماكينة بأمان. الدرجة بتظهر في الآخر. (بعض التخصصات لسه مفيهاش اختبار أعطال.)') },
    ],
  },
  {
    id: 'student-programme', audience: 'student',
    title: tx('See everything you will learn in your programme', 'أشوف كل اللي هتعلمه في تخصصي'),
    steps: [
      { img: 'student-curriculum', t: tx('Tap "My programme". At the top you see your job after graduation, the hours and the final project.',
        'اضغط "برنامجي". فوق هتلاقي الوظيفة بعد التخرج وعدد الساعات ومشروع التخرج.') },
      { t: tx('Choose the year. K = what you need to know, S = what you need to do with your hands, A = how you behave at work.',
        'اختار السنة. K = اللي لازم تعرفه، S = اللي لازم تعمله بإيدك، A = إزاي تتصرف في الشغل.') },
      { img: 'student-curriculum-open', t: tx('Tap any line to open it and read exactly what you must be able to do. Use the search box to find a word.',
        'اضغط على أي سطر علشان يفتح وتقرا بالظبط المطلوب منك. استخدم خانة البحث علشان تلاقي أي كلمة.') },
    ],
  },
  {
    id: 'student-quiz', audience: 'student',
    title: tx('Take a quiz', 'أحل اختبار'),
    steps: [
      { img: 'student-quiz', t: tx('Tap "Theory quiz". Choose one answer for each question.', 'اضغط "اختبار نظري". اختار إجابة واحدة لكل سؤال.') },
      { t: tx('At the bottom, tap "Submit answers". You see your result right away.', 'تحت خالص اضغط "أرسل الإجابات". النتيجة بتظهر على طول.') },
      { t: tx('"Applied assessment" works the same way, with numbers that are different for each trainee.', '"تقييم تطبيقي" بنفس الطريقة، بس الأرقام مختلفة لكل متدرب.') },
    ],
  },
  {
    id: 'student-logbook', audience: 'student',
    title: tx('Work-site training: check in and write my logbook', 'التدريب في موقع العمل: أسجّل حضوري وأكتب السجل'),
    steps: [
      { img: 'student-logbook', t: tx('At the work site, tap "Logbook", then the big orange button "Check in at site". Allow the location when the phone asks.',
        'في موقع العمل اضغط "سجل التدريب"، وبعدين الزرار البرتقالي الكبير "تسجيل الحضور في الموقع". اسمح بالموقع لما الموبايل يسأل.') },
      { t: tx('Tap "New entry", write what you did today and add a photo if you can. Your supervisor approves it.',
        'اضغط "إدخال جديد"، اكتب عملت إيه النهارده وضيف صورة لو تقدر. المشرف بيعتمدها.') },
      { t: tx('Before you leave, tap "Check out".', 'قبل ما تمشي اضغط "تسجيل الانصراف".') },
    ],
    tip: tx('No signal at the site? It is saved on the phone and sent later.', 'مفيش شبكة في الموقع؟ بيتحفظ على الموبايل ويتبعت بعدين.'),
  },
  {
    id: 'student-private', audience: 'student',
    title: tx('My private space', 'مساحتي الخاصة'),
    steps: [
      { img: 'student-private', t: tx('Tap "🔒 Private". Only you see it. Save parts, notes and results, and revise with flashcards.',
        'اضغط "🔒 خاص". محدش يشوفها غيرك. احفظ فيها قطع وملاحظات ونتايج، وذاكر بالبطاقات.') },
    ],
  },

  // ----------------------------------------------------------------- trainer
  {
    id: 'trainer-floor', audience: 'trainer',
    title: tx('Watch the workshop live and score a trainee', 'أتابع الورشة مباشر وأقيّم متدرب'),
    steps: [
      { img: 'trainer-floor', t: tx('"Workshop floor" shows every station. Green = done, orange = needs you. Safety alerts appear at the top.',
        '"أرضية الورشة" بتعرض كل المحطات. الأخضر = خلص، البرتقالي = محتاجك. تنبيهات السلامة بتظهر فوق.') },
      { t: tx('On an alert, tap "Stopped & briefed" after you deal with it, or "False alarm".', 'في التنبيه اضغط "أوقفت العمل ووجّهت المتدرب" بعد ما تتعامل معاه، أو "إنذار كاذب".') },
      { t: tx('Tap a trainee\'s box to score the job: one tap per item, add a photo, then "Sign off & next".',
        'اضغط على مربع المتدرب علشان تقيّم الشغل: ضغطة لكل بند، ضيف صورة، وبعدين "اعتماد والتالي".') },
    ],
    tip: tx('No Wi-Fi in the workshop corner? Scores wait on the tablet and are sent later.', 'مفيش واي فاي في ركن الورشة؟ التقييمات بتستنى على التابلت وتتبعت بعدين.'),
  },
  {
    id: 'trainer-scan', audience: 'trainer',
    title: tx('Check who may use a machine', 'أعرف مين مسموح له يشغّل ماكينة'),
    steps: [
      { img: 'trainer-machines', t: tx('Tap "Machines". "Live board" shows which machines are open and who is on them; "Stop" locks one.',
        'اضغط "الماكينات". "اللوحة المباشرة" بتعرض الماكينات المفتوحة ومين شغّال عليها، و"إيقاف" بيقفل الماكينة.') },
      { img: 'trainer-scan', t: tx('Tap "Scan a machine" and point the camera at the machine sticker. You see each trainee as Allowed, Needs pre-check or Not allowed.',
        'اضغط "امسح ماكينة" ووجّه الكاميرا على ملصق الماكينة. هتشوف كل متدرب: مسموح، أو محتاج فحص مسبق، أو غير مسموح.') },
    ],
  },
  {
    id: 'trainer-stickers', audience: 'trainer',
    title: tx('Print the machine stickers', 'أطبع ملصقات الماكينات'),
    steps: [
      { img: 'trainer-stickers', t: tx('In "Machines", tap "QR stickers". Choose the centre and the workshop.', 'في "الماكينات" اضغط "ملصقات QR". اختار المركز والورشة.') },
      { ill: 'sticker', t: tx('Tap "Print … stickers". Print on sticker paper and stick each one on the machine whose name and serial number match.',
        'اضغط "اطبع … ملصق". اطبع على ورق ملصقات، والزق كل ملصق على الماكينة اللي اسمها ورقمها التسلسلي مطابق.') },
    ],
    tip: tx('A sticker keeps working even if you change the server or have no internet.', 'الملصق بيفضل شغال حتى لو غيّرت الجهاز أو مفيش إنترنت.'),
  },
  {
    id: 'trainer-curriculum', audience: 'trainer',
    title: tx('Read the programme curriculum', 'أقرا منهج التخصص'),
    steps: [
      { img: 'trainer-curriculum', t: tx('Tap "Curriculum". Choose the programme in the bar at the top, then the year.', 'اضغط "المنهج". اختار التخصص من الشريط اللي فوق، وبعدين السنة.') },
      { t: tx('"S" shows each practical skill with its target level (L1 to L4) and the performance criteria you assess. A red "Safety-critical" tag means the trainee must pass it before using the machine.',
        '"S" بيعرض كل مهارة عملية بالمستوى المطلوب (م1 إلى م4) ومعايير الأداء اللي بتقيّمها. العلامة الحمرا "سلامة حرجة" معناها إن المتدرب لازم ينجح فيها قبل ما يشغّل الماكينة.') },
      { t: tx('"A" shows the attitudes to observe every day, linked to the seven core attitudes at the bottom of the page.',
        '"A" بيعرض الاتجاهات المهنية اللي تلاحظها كل يوم، ومربوطة بالاتجاهات السبعة الأساسية في آخر الصفحة.') },
    ],
  },
  {
    id: 'trainer-vlab', audience: 'trainer',
    title: tx('Give a V-Lab fault exam', 'أعمل امتحان أعطال في المعمل الافتراضي'),
    steps: [
      { img: 'trainer-vlab', t: tx('Tap "V-Lab exams". Choose the trainee, the hidden fault and the time, then "Start exam".',
        'اضغط "امتحانات المعمل". اختار المتدرب والعطل المخفي والوقت، وبعدين "ابدأ الامتحان".') },
      { t: tx('Follow the attempt live on the same page. The score is calculated by itself.', 'تابع المحاولة مباشرة من نفس الصفحة. الدرجة بتتحسب لوحدها.') },
    ],
  },
  {
    id: 'trainer-risk', audience: 'trainer',
    title: tx('Trainees who need help (early warning)', 'المتدربين اللي محتاجين مساعدة (الإنذار المبكر)'),
    steps: [
      { img: 'trainer-risk', t: tx('Tap "Early warning". Red = high risk of failing the final test. Open a name to see why, then write what you did.',
        'اضغط "الإنذار المبكر". الأحمر = خطر عالي يرسب في الاختبار النهائي. افتح الاسم علشان تعرف السبب، واكتب عملت إيه.') },
    ],
  },

  // ----------------------------------------------------------------- teacher
  {
    id: 'teacher-bank', audience: 'teacher',
    title: tx('Write and approve questions', 'أكتب أسئلة وأعتمدها'),
    steps: [
      { img: 'teacher-bank', t: tx('"Question bank" lists every question: draft, in review, approved.', '"بنك الأسئلة" فيه كل الأسئلة: مسودة، قيد المراجعة، معتمد.') },
      { img: 'teacher-new', t: tx('Tap "New question". Choose the type and skill, write it in English and Arabic, then "Save & send to review".',
        'اضغط "سؤال جديد". اختار النوع والجدارة، اكتب السؤال بالإنجليزي والعربي، وبعدين "حفظ وإرسال للمراجعة".') },
      { t: tx('Only approved questions reach the trainees.', 'المتدربين بيشوفوا الأسئلة المعتمدة بس.') },
    ],
  },
  {
    id: 'teacher-curriculum', audience: 'teacher',
    title: tx('Read the programme curriculum', 'أقرا منهج التخصص'),
    steps: [
      { img: 'trainer-curriculum', t: tx('Tap "Curriculum". Choose the programme in the bar at the top.', 'اضغط "المنهج". اختار التخصص من الشريط اللي فوق.') },
      { t: tx('"K" shows the knowledge modules with their hours and learning outcomes: write your questions for these.',
        '"K" بيعرض الوحدات المعرفية بساعاتها ونواتج التعلم: اكتب أسئلتك عليها.') },
    ],
  },

  // -------------------------------------------------------------- supervisor
  {
    id: 'supervisor-signoff', audience: 'supervisor',
    title: tx('Approve a trainee\'s logbook', 'أعتمد سجل المتدرب'),
    steps: [
      { img: 'supervisor-signoff-2', t: tx('Open "Logbook sign-offs". Read each entry and look at the photo.', 'افتح "اعتماد سجلات التدريب". اقرا كل إدخال وبص على الصورة.') },
      { t: tx('Choose the stars, write a short comment, then tap "Approve & sign". Or "Request changes" / "Reject".',
        'اختار النجوم، اكتب تعليق قصير، واضغط "اعتماد وتوقيع". أو "طلب تعديل" / "رفض".') },
    ],
  },

  // ---------------------------------------------------------------- director
  {
    id: 'director-home', audience: 'director',
    title: tx('See the whole centre at a glance', 'أشوف المركز كله في نظرة'),
    steps: [
      { img: 'director-home', t: tx('"Institution overview" shows skills achieved, pass rate, safety incidents, work-site hours and machine use. It refreshes by itself.',
        '"نظرة عامة على المؤسسة" بتعرض الجدارات المتحققة ونسبة النجاح وحوادث السلامة وساعات التدريب الميداني واستخدام الماكينات. بتتحدث لوحدها.') },
      { t: tx('Use the bar under the top to choose one trade or "All trades".', 'استخدم الشريط اللي تحت فوق علشان تختار تخصص واحد أو "كل التخصصات".') },
      { img: 'director-risk', t: tx('"Early warning" lists trainees at risk so you can follow up with the trainers.', '"الإنذار المبكر" بيعرض المتدربين المعرضين للخطر علشان تتابع مع المدربين.') },
    ],
  },
  {
    id: 'director-programs', audience: 'director',
    title: tx('Add a programme and its skills', 'أضيف تخصص ومهاراته'),
    steps: [
      { img: 'director-programs', t: tx('Tap "Programmes & skills", then "Add programme" and "Add skill".', 'اضغط "التخصصات والمهارات"، وبعدين "أضف التخصص" و"أضف مهارة".') },
      { t: tx('Many at once: under "Import from Excel or CSV" download the "Excel template", fill it, choose the file, tap "Check the file" first, then "Import".',
        'لو كتير مرة واحدة: تحت "استيراد من Excel أو CSV" نزّل "نموذج Excel"، املاه، اختار الملف، اضغط "افحص الملف" الأول، وبعدين "استيراد".') },
      { t: tx('The 8 programmes of the WABYS manual are already loaded. Tap a programme to see its profile and every knowledge, skill and attitude by year. To change them in Excel, tap "Download curricula (Excel)", edit, and import the file again.',
        'التخصصات الثمانية من دليل وابيز محمّلة جاهزة. اضغط على أي تخصص علشان تشوف بياناته وكل المعارف والمهارات والاتجاهات لكل سنة. علشان تعدّلها في Excel اضغط "تنزيل المناهج (Excel)"، عدّل، واستورد الملف تاني.') },
    ],
  },
  {
    id: 'director-machines', audience: 'director',
    title: tx('Register the machines and print their stickers', 'أسجّل الماكينات وأطبع ملصقاتها'),
    steps: [
      { img: 'director-machines', t: tx('Tap "Machine register". Each centre fills the machine Excel file (workshop, type, brand, model, serial), then you import it here.',
        'اضغط "سجل الماكينات". كل مركز يملا ملف الإكسل بتاع الماكينات (الورشة، النوع، الماركة، الموديل، الرقم التسلسلي)، وبعدين تستورده هنا.') },
      { img: 'director-stickers', t: tx('Tap "QR stickers", choose the centre and workshop, then "Print … stickers". Each machine gets its own sticker.',
        'اضغط "ملصقات QR"، اختار المركز والورشة، وبعدين "اطبع … ملصق". كل ماكينة ليها ملصق خاص بيها.') },
    ],
  },

  // ------------------------------------------------------------------- admin
  {
    id: 'admin-start', audience: 'admin',
    title: tx('Start the centre computer every morning', 'أشغّل جهاز المركز كل صباح'),
    steps: [
      { ill: 'server', t: tx('Turn on the centre computer and wait one minute.', 'شغّل جهاز المركز واستنى دقيقة.') },
      { t: tx('Double-click "Start VTC_LMS" on the desktop. A small window shows the address and the QR code.', 'دوس مرتين على "Start VTC_LMS" على سطح المكتب. هيظهر شباك صغير فيه العنوان وكود QR.') },
      { img: 'join', t: tx('Leave it on, or print the page from /join and stick it on the wall for everyone.', 'سيبه مفتوح، أو اطبع الصفحة من ‎/join والزقها على الحيطة للكل.') },
    ],
    tip: tx('Keep this computer on during training. Others cannot use VTC_LMS while it is off.', 'خلّي الجهاز ده شغال طول التدريب. لو اتقفل محدش هيقدر يستخدم VTC_LMS.'),
  },
  {
    id: 'admin-sync', audience: 'admin',
    title: tx('Upload to the online dashboard', 'الرفع على لوحة المتابعة أونلاين'),
    steps: [
      { t: tx('Connect the centre computer to the internet when you can (any time of day).', 'وصّل جهاز المركز بالإنترنت لما تقدر (في أي وقت).') },
      { img: 'join', t: tx('Within a minute, the window shows "Synced" and the time of the last upload. Nothing else to do.', 'خلال دقيقة هيظهر في الشباك "متزامن" ووقت آخر رفع. مش محتاج تعمل حاجة تانية.') },
    ],
  },
  {
    id: 'admin-accounts', audience: 'admin',
    title: tx('Add an account, back up', 'أضيف حساب، وأعمل نسخة احتياطية'),
    steps: [
      { t: tx('New account: ask the person who installed VTC_LMS, or follow SETUP.md (section A5) in the package folder.',
        'حساب جديد: اطلب من الشخص اللي ركّب VTC_LMS، أو اتبع ملف SETUP.md (الجزء A5) في فولدر البرنامج.') },
      { t: tx('Once a week, copy the "backups" folder to a USB stick (SETUP.md, section E).', 'مرة في الأسبوع انسخ فولدر "backups" على فلاشة (ملف SETUP.md، الجزء E).') },
    ],
  },
];
