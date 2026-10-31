/**
 * AI vision cell: clean the camera lens and retrain on a new defect. Traps:
 * reaching in past a muted light curtain, opening the door without stopping,
 * reaching to the pusher with air still in it, and putting a new model live
 * without testing it on known good and bad parts.
 */
import { visionCell } from '../models/visionCell';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const PUSHER: V3 = [0.9, 0.06, -0.3];

export const aitSafety: Scenario = {
  id: 'sim-ait-vision',
  trade: 'ait',
  model: visionCell,
  minutes: 25,
  title: tx('Clean the camera and update the AI model', 'نظّف الكاميرا وحدّث نموذج الذكاء الاصطناعي'),
  brief: tx(
    'The vision cell is rejecting good parts: the lens is dusty and a new batch has a slightly different finish. A colleague muted the light curtain last shift "to save time". The line is running.',
    'خلية الرؤية ترفض قطعًا سليمة: العدسة عليها غبار، والدفعة الجديدة لها تشطيب مختلف قليلًا. زميل عطّل الستارة الضوئية في الوردية السابقة "لتوفير الوقت". والخط يعمل الآن.'),
  task: tx('Make the cell safe, clean the lens, retrain and validate the model, and restart, with no injury and no bad parts shipped.', 'أمّن الخلية ونظّف العدسة وأعد تدريب النموذج وتحقق منه ثم أعد التشغيل، دون إصابة ودون شحن قطع معيبة.'),
  params: { door: 0, curtain: 0, reject: 0 },
  startRunning: true,
  ppe: [
    { key: 'glasses', need: 'required', why: tx('Compressed air and the strobe light at close range.', 'الهواء المضغوط وضوء الوميض عن قرب.') },
    { key: 'boots', need: 'required', why: tx('Parts and fixtures get dropped.', 'القطع والتجهيزات قد تسقط.') },
    { key: 'no-jewellery', need: 'required', why: tx('Rings catch on the belt and the pusher.', 'الخواتم تعلق بالسير والدافع.') },
    { key: 'gloves-nitrile', need: 'optional', why: tx('Lint-free gloves keep fingerprints off the lens.', 'قفازات خالية من الوبر تمنع البصمات على العدسة.') },
  ],
  actions: [
    {
      id: 'reachIn', station: 'infeed', pose: 'reach', reach: [-1.0, 0.1, 0], hideWhen: { done: ['stop'] },
      label: tx('Reach in through the infeed to grab a rejected part', 'مد يدك من المدخل لتأخذ قطعة مرفوضة'),
      detail: tx('The curtain is muted', 'الستارة معطلة'),
      hazards: [{
        when: {},
        outcome: {
          kind: 'incident', id: 'ait-pusher', effect: 'crash', at: PUSHER, toward: 'hand', severity: 2,
          title: tx('The reject pusher fired on your hand', 'انطلق دافع الرفض على يدك'),
          what: tx('With the light curtain muted nothing stopped the cell. The camera saw your hand as a defect and the pusher fired at 6 bar.', 'مع تعطيل الستارة الضوئية لم يوقف شيء الخلية. رأت الكاميرا يدك كعيب فانطلق الدافع بضغط 6 بار.'),
          harm: tx('Pneumatic pushers break fingers and crush hands; muted safety devices are behind most automation injuries.', 'الدوافع الهوائية تكسر الأصابع وتسحق اليد، وتعطيل أجهزة الأمان وراء معظم إصابات الأتمتة.'),
          rule: tx('Never mute or bypass a safety device. Report it and get it restored before work starts.', 'لا تعطّل أي جهاز أمان ولا تتجاوزه أبدًا. أبلغ عنه وأعده للعمل قبل بدء العمل.'),
          ref: 'IEC 61496 · ISO 13849', sign: { kind: 'warning', pic: 'exclaim' },
        },
      }],
      ok: tx('', ''),
    },
    {
      id: 'curtain', station: 'hmi', pose: 'operate', reach: [-1.75, 0.5, 0.62], set: { curtain: 1 },
      label: tx('Report the muted curtain and restore it', 'أبلغ عن الستارة المعطلة وأعد تفعيلها'),
      ok: tx('Mute key removed, curtain test passed with the test rod, logged and reported to the supervisor.', 'نُزع مفتاح التعطيل ونجح اختبار الستارة بقضيب الاختبار، وسُجل وأُبلغ المشرف.'),
    },
    {
      id: 'stop', station: 'hmi', pose: 'operate', reach: [-1.75, 0.5, 0.62], running: false,
      label: tx('Stop the cell from the HMI', 'أوقف الخلية من الشاشة'),
      ok: tx('Conveyor stopped, cell in safe stop.', 'توقف السير والخلية في وضع الإيقاف الآمن.'),
    },
    {
      id: 'air', station: 'pusher', pose: 'inspect', reach: [0.3, -0.3, -0.75], needs: ['stop'],
      label: tx('Dump the air and lock the air valve', 'فرّغ الهواء واقفل صمام الهواء'),
      ok: tx('Dump valve open, gauge at 0 bar, valve padlocked with your tag.', 'صمام التفريغ مفتوح والعداد على 0 بار والصمام مقفل ببطاقتك.'),
    },
    {
      id: 'door', station: 'door', pose: 'reach', reach: [1.05, 0.3, 0.68], set: { door: 1 },
      label: tx('Open the cell door', 'افتح باب الخلية'),
      ok: tx('Door open; the interlock keeps the cell stopped.', 'الباب مفتوح، والقفل البيني يبقي الخلية متوقفة.'),
      hazards: [{
        when: { notDone: ['stop'] },
        outcome: {
          kind: 'blocked', id: 'ait-door', effect: 'alarm', at: [1.15, 0.3, 0.66],
          title: tx('The door interlock stopped the cell', 'أوقف القفل البيني للباب الخلية'),
          what: tx('Opening the door while running tripped the safety relay: an emergency stop, a lost batch and a fault to reset.', 'فتح الباب أثناء التشغيل فصل مرحل الأمان: إيقاف طوارئ ودفعة ضائعة وعطل يحتاج إعادة ضبط.'),
          rule: tx('Stop the cell from the HMI first; the door is a safeguard, not a stop button.', 'أوقف الخلية من الشاشة أولًا؛ الباب وسيلة حماية وليس زر إيقاف.'),
          sign: { kind: 'mandatory', pic: 'exclaim' },
        },
      }],
    },
    {
      id: 'lens', station: 'inside', pose: 'reach', reach: [0.1, 0.8, 0.05], needs: ['door'],
      label: tx('Clean the lens and check the ring light', 'نظّف العدسة وافحص الإضاءة الحلقية'),
      ok: tx('Lens cleaned with a blower and lens tissue; focus and exposure unchanged.', 'نُظفت العدسة بالمنفاخ ومناديل العدسات، والتركيز والتعرض دون تغيير.'),
      hazards: [{
        when: { notDone: ['air'] },
        outcome: {
          kind: 'incident', id: 'ait-stored-air', effect: 'crash', at: PUSHER, toward: 'hand', severity: 2,
          title: tx('Stored air moved the pusher', 'حرّك الهواء المخزن الدافع'),
          what: tx('Your elbow nudged the valve. Air still in the line pushed the cylinder out against your arm.', 'لمس كوعك الصمام. الهواء الباقي في الخط دفع الأسطوانة نحو ذراعك.'),
          rule: tx('Stopping the cell does not remove stored energy. Dump the air and lock the valve before reaching in.', 'إيقاف الخلية لا يزيل الطاقة المخزنة. فرّغ الهواء واقفل الصمام قبل مد يدك.'),
          ref: 'LOTO · stored energy', sign: { kind: 'mandatory', pic: 'lockout' },
        },
      }],
    },
    {
      id: 'retrain', station: 'hmi', pose: 'operate', reach: [-1.75, 0.5, 0.62], needs: ['lens'],
      label: tx('Add 200 labelled pictures of the new batch and retrain', 'أضف 200 صورة موسومة من الدفعة الجديدة وأعد التدريب'),
      ok: tx('Model v3.3 trained: 99.4 % on the held-out set, no rise in false accepts.', 'دُرب النموذج v3.3: ‏99.4٪ على بيانات الاختبار المنفصلة، دون زيادة في القبول الخاطئ.'),
    },
    {
      id: 'live', station: 'hmi', pose: 'operate', reach: [-1.75, 0.5, 0.62], needs: ['retrain'], hideWhen: { done: ['validate'] },
      label: tx('Put the new model live straight away', 'فعّل النموذج الجديد مباشرة'),
      hazards: [{
        when: {},
        outcome: {
          kind: 'blocked', id: 'ait-unvalidated', effect: 'alarm', at: [-1.75, 0.5, 0.62],
          title: tx('Quality stopped the release: not validated', 'أوقفت الجودة الإطلاق: لم يُتحقق منه'),
          what: tx('The new model has not been tested on the golden set of known good and bad parts. A model that passes defects ships them to the customer.', 'لم يُختبر النموذج الجديد على المجموعة المرجعية من القطع السليمة والمعيبة المعروفة. النموذج الذي يمرر العيوب يرسلها للعميل.'),
          rule: tx('Validate every model change on the golden parts, record the result and get sign-off before it goes live.', 'تحقق من كل تغيير في النموذج على القطع المرجعية، وسجل النتيجة واحصل على الاعتماد قبل التفعيل.'),
          sign: { kind: 'warning', pic: 'exclaim' },
        },
      }],
      ok: tx('', ''),
    },
    {
      id: 'validate', station: 'hmi', pose: 'operate', reach: [-1.75, 0.5, 0.62], needs: ['retrain'],
      label: tx('Validate on the golden parts and get sign-off', 'تحقق على القطع المرجعية واحصل على الاعتماد'),
      ok: tx('20 golden parts: 10 good accepted, 10 bad rejected. Change record signed by quality.', '20 قطعة مرجعية: قُبلت 10 سليمة ورُفضت 10 معيبة. وقّعت الجودة سجل التغيير.'),
    },
    {
      id: 'restart', station: 'hmi', pose: 'operate', reach: [-1.75, 0.5, 0.62], needs: ['validate'], set: { door: 0 }, running: true, goal: true,
      label: tx('Close the door, restore air and restart', 'أغلق الباب وأعد الهواء وأعد التشغيل'),
      ok: tx('Door closed, air back, reset, running. False rejects down from 6 % to 0.3 %.', 'أُغلق الباب وعاد الهواء وأُعيد الضبط والخلية تعمل. انخفض الرفض الخاطئ من 6٪ إلى 0.3٪.'),
      hazards: [{
        when: { notDone: ['curtain'] },
        outcome: {
          kind: 'blocked', id: 'ait-curtain-muted', effect: 'alarm', at: [-1.05, 0.3, 0],
          title: tx('Restarted with the light curtain still muted', 'أُعيد التشغيل والستارة الضوئية ما زالت معطلة'),
          what: tx('The supervisor saw the amber light and stopped the cell: the infeed is unguarded.', 'رأى المشرف الضوء الأصفر وأوقف الخلية: المدخل بلا حماية.'),
          rule: tx('Restore and test every safety device before restart.', 'أعد كل أجهزة الأمان واختبرها قبل إعادة التشغيل.'),
          sign: { kind: 'mandatory', pic: 'exclaim' },
        },
      }],
    },
  ],
};
