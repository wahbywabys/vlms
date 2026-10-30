/**
 * Industrial sewing machine: change a blunt needle and sew a test seam.
 * Traps: changing the needle with the silent servo still switched on, the
 * finger guard taken off, sewing with long hair loose, pulling the cloth
 * through by hand and the eye shield left up when the needle hits a pin.
 */
import { lockstitch } from '../models/lockstitch';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const NEEDLE: V3 = [-0.52, 0.06, 0.06];

export const rmgSafety: Scenario = {
  id: 'sim-rmg-needle',
  trade: 'rmg',
  model: lockstitch,
  minutes: 8,
  title: tx('Change the needle and sew a test seam', 'غيّر الإبرة وخِط درزة تجريبية'),
  brief: tx(
    'The needle on line 2 is blunt and skipping stitches. The servo motor is silent, so the machine looks off even when it is on. Someone has left the finger guard on the table.',
    'إبرة الماكينة في الخط 2 أصبحت غير حادة وتقفز الغرز. محرك السيرفو صامت، فتبدو الماكينة مطفأة حتى وهي تعمل. وأحدهم ترك واقي الأصابع على الطاولة.'),
  task: tx('Change the needle, refit the guards and sew a 30 cm test seam, with no injury.', 'غيّر الإبرة وأعد تركيب الواقيات وخِط درزة تجريبية طولها 30 سم، دون أي إصابة.'),
  params: { foot: 0, guard: 0, shield: 0 },
  startRunning: false,
  ppe: [
    { key: 'glasses', need: 'optional', why: tx('A broken needle can fly towards the face; the eye shield is the main protection.', 'الإبرة المكسورة قد تتطاير نحو الوجه؛ واقي العين هو الحماية الأساسية.') },
    { key: 'boots', need: 'required', why: tx('Closed shoes: dropped scissors and needles.', 'حذاء مغلق: المقصات والإبر قد تسقط.') },
    { key: 'no-jewellery', need: 'required', why: tx('Bracelets and long chains catch in the handwheel and belt.', 'الأساور والسلاسل الطويلة تعلق بعجلة اليد والسير.') },
    { key: 'cuffs', need: 'required', why: tx('Loose sleeves and long hair must be tied back from the needle and wheel.', 'الأكمام الواسعة والشعر الطويل يجب ربطها بعيدًا عن الإبرة والعجلة.') },
    { key: 'gloves-leather', need: 'forbidden', why: tx('Gloves stop you feeling the cloth and are pulled under the foot.', 'القفازات تمنعك من الإحساس بالقماش وتُسحب تحت القدم.') },
  ],
  actions: [
    {
      id: 'off', station: 'power', pose: 'crouch', reach: [1.12, -0.48, 0.1],
      label: tx('Switch the motor off at the box', 'أطفئ المحرك من صندوق المفتاح'),
      ok: tx('Display dark. Pressing the treadle does nothing now.', 'الشاشة مطفأة. الضغط على الدواسة لا يفعل شيئًا الآن.'),
    },
    {
      id: 'needle', station: 'needle', pose: 'reach', reach: [-0.52, 0.12, 0.1],
      label: tx('Loosen the clamp and change the needle', 'فك المسمار وغيّر الإبرة'),
      ok: tx('New DB×1 size 14 needle, long groove to the left, pushed fully up and clamped.', 'إبرة جديدة DB×1 مقاس 14، المجرى الطويل لليسار، مدفوعة للأعلى تمامًا ومثبتة.'),
      hazards: [{
        when: { notDone: ['off'] },
        outcome: {
          kind: 'incident', id: 'rmg-needle-finger', effect: 'cut', at: NEEDLE, toward: 'hand', severity: 2,
          title: tx('The needle went through a finger', 'دخلت الإبرة في الإصبع'),
          what: tx('Your foot rested on the treadle while you reached in. The silent servo was on: the needle drove down through your fingertip.', 'استقرت قدمك على الدواسة وأنت تمد يدك. كان السيرفو الصامت يعمل: نزلت الإبرة في طرف إصبعك.'),
          harm: tx('Needle-through-finger is the most common injury in garment factories; the needle often breaks inside the bone.', 'دخول الإبرة في الإصبع أشهر إصابة في مصانع الملابس، وكثيرًا ما تنكسر الإبرة داخل العظم.'),
          rule: tx('Switch the motor off before threading, changing the needle or the bobbin, or clearing a jam. Silent does not mean off.', 'أطفئ المحرك قبل لضم الخيط أو تغيير الإبرة أو البوبينة أو فك أي انحشار. الصمت لا يعني أنها مطفأة.'),
          ref: 'ISO 10821', sign: { kind: 'warning', pic: 'exclaim' },
        },
      }],
    },
    {
      id: 'guard', station: 'needle', pose: 'reach', reach: [-0.52, 0.14, 0.12], set: { guard: 1 },
      label: tx('Refit the finger guard', 'أعد تركيب واقي الأصابع'),
      ok: tx('Finger guard screwed on in front of the needle.', 'واقي الأصابع مثبت بالمسمار أمام الإبرة.'),
    },
    {
      id: 'shield', station: 'needle', pose: 'reach', reach: [-0.52, 0.32, 0.2], set: { shield: 1 },
      label: tx('Lower the eye shield', 'أنزل واقي العين'),
      ok: tx('Shield down between your eyes and the needle.', 'الواقي منخفض بين عينيك والإبرة.'),
    },
    {
      id: 'on', station: 'power', pose: 'crouch', reach: [1.12, -0.48, 0.1], needs: ['needle'],
      label: tx('Switch the motor on', 'شغّل المحرك'),
      ok: tx('Display lit, needle position up. Feet off the treadle.', 'الشاشة مضاءة والإبرة في الوضع العلوي. القدم بعيدة عن الدواسة.'),
    },
    {
      id: 'sew', station: 'seat', pose: 'operate', reach: [-0.52, 0.05, 0.25], needs: ['on'], running: true,
      label: tx('Sew the test seam, guiding the cloth with flat hands', 'خِط الدرزة التجريبية ووجّه القماش بكفين مبسوطين'),
      ok: tx('Even 3 mm stitches. Hands flat, fingers 2 cm from the needle; the feed dog did the pulling.', 'غرز منتظمة 3 مم. الكفان مبسوطان والأصابع على بعد 2 سم من الإبرة، وأسنان التغذية هي التي تسحب.'),
      hazards: [
        {
          when: { notDone: ['guard'] },
          outcome: {
            kind: 'incident', id: 'rmg-no-guard', effect: 'cut', at: NEEDLE, toward: 'hand', severity: 2,
            title: tx('A finger slipped under the needle', 'انزلق إصبع تحت الإبرة'),
            what: tx('Guiding a thick seam, your finger slid towards the foot. With no finger guard, the needle hit it at 4000 stitches a minute.', 'أثناء توجيه درزة سميكة انزلق إصبعك نحو القدم. بلا واقي أصابع، ضربته الإبرة بسرعة 4000 غرزة في الدقيقة.'),
            rule: tx('The finger guard stays on. Report a missing guard before you sew.', 'واقي الأصابع يبقى مركبًا. أبلغ عن الواقي المفقود قبل الخياطة.'),
            ref: 'ISO 10821', sign: { kind: 'warning', pic: 'exclaim' },
          },
        },
        {
          when: { notWearing: ['cuffs'] },
          outcome: {
            kind: 'incident', id: 'rmg-hair', effect: 'entangle', at: [0.66, 0.6, 0.0], toward: 'face', severity: 2,
            title: tx('Hair caught in the handwheel', 'علق الشعر بعجلة اليد'),
            what: tx('Leaning in to watch the stitch, loose hair touched the turning handwheel and was wound in.', 'عند الانحناء لمراقبة الغرزة، لمس الشعر المنسدل عجلة اليد الدوارة فالتف حولها.'),
            harm: tx('Hair entanglement can tear the scalp.', 'التفاف الشعر قد يمزق فروة الرأس.'),
            rule: tx('Tie back long hair and fasten cuffs before you sit at the machine.', 'اربط الشعر الطويل وأغلق الأكمام قبل الجلوس على الماكينة.'),
            sign: { kind: 'mandatory', pic: 'hairnet' },
          },
        },
        {
          when: { notDone: ['shield'], notWearing: ['glasses'] },
          outcome: {
            kind: 'incident', id: 'rmg-needle-break', effect: 'projectile', at: NEEDLE, toward: 'face', severity: 2,
            title: tx('The needle hit a pin and broke', 'اصطدمت الإبرة بدبوس وانكسرت'),
            what: tx('A pin was left in the seam. The needle struck it, snapped, and the tip flew towards your eye; the shield was up.', 'تُرك دبوس في الدرزة. ضربته الإبرة فانكسرت وطار طرفها نحو عينك؛ والواقي مرفوع.'),
            rule: tx('Take pins out before they reach the foot, and keep the eye shield down.', 'انزع الدبابيس قبل وصولها إلى القدم، وأبقِ واقي العين منخفضًا.'),
            sign: { kind: 'mandatory', pic: 'glasses' },
          },
        },
      ],
    },
    {
      id: 'pull', station: 'seat', pose: 'operate', reach: [-0.52, 0.05, 0.12], needs: ['on'],
      label: tx('Pull the cloth through faster by hand', 'اسحب القماش باليد لتسرع'),
      detail: tx('The seam is thick', 'الدرزة سميكة'),
      hazards: [{
        when: {},
        outcome: {
          kind: 'incident', id: 'rmg-pull', effect: 'projectile', at: NEEDLE, toward: 'face', severity: 2,
          title: tx('The needle bent, hit the plate and broke', 'انثنت الإبرة واصطدمت باللوح وانكسرت'),
          what: tx('Pulling the cloth bent the needle; it hit the needle plate and shattered.', 'سحب القماش ثنى الإبرة فاصطدمت بلوح الإبرة وتحطمت.'),
          rule: tx('Let the feed dog move the cloth. Only guide it. Use a heavier needle and a walking foot for thick seams.', 'دع أسنان التغذية تحرك القماش ووجّهه فقط. استخدم إبرة أكبر وقدمًا متحركة للدرزات السميكة.'),
          sign: { kind: 'warning', pic: 'flying' },
        },
      }],
      ok: tx('', ''),
    },
    {
      id: 'done', station: 'power', pose: 'crouch', reach: [1.12, -0.48, 0.1], needs: ['sew'], running: false, goal: true,
      label: tx('Switch off and record the needle change', 'أطفئ المحرك وسجّل تغيير الإبرة'),
      ok: tx('Off, needle down, old needle in the sharps box and logged. Test seam passed.', 'أُطفئ والإبرة لأسفل، والإبرة القديمة في صندوق الأدوات الحادة ومسجلة. الدرزة التجريبية ناجحة.'),
    },
  ],
};
