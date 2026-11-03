/**
 * Network rack: swap a failed fibre uplink and service the server. Traps:
 * pulling the server out without the anti-tip feet, looking into a live
 * fibre end, and closing up with the uplink still unplugged.
 */
import { tx } from '../models/kit';
import { networkRack } from '../models/networkRack';
import type { Scenario } from './types';

type V3 = [number, number, number];
const RACK: V3 = [0, -0.4, 0.75];

export const csnSafety: Scenario = {
  id: 'sim-csn-uplink',
  trade: 'csn',
  model: networkRack,
  minutes: 30,
  title: tx('Fix the fibre uplink and service the server', 'أصلح وصلة الألياف وصِن الخادم'),
  brief: tx(
    'The second building has lost its network. The switch shows the fibre uplink down, and the server in the same rack needs a new drive.',
    'فقد المبنى الثاني الشبكة. يظهر السويتش أن وصلة الألياف الصاعدة متوقفة، والخادم في الخزانة نفسها يحتاج قرصًا جديدًا.'),
  task: tx('Find and fix the fibre fault, change the server drive and leave the rack closed and working.', 'حدد عطل الألياف وأصلحه وغيّر قرص الخادم واترك الخزانة مغلقة وتعمل.'),
  params: { door: 0, server: 0, power: 1, fibre: 0, pc: 0 },
  startRunning: true,
  ppe: [
    { key: 'boots', need: 'required', why: tx('A 2U server weighs 25 kg; you lift it on and off its rails.', 'الخادم 2U يزن 25 كجم؛ ترفعه وتنزله عن قضبانه.') },
    { key: 'no-jewellery', need: 'required', why: tx('Rings catch on rack rails and short across live PSU terminals.', 'الخواتم تعلق بقضبان الخزانة وتقصّر بين أطراف المصدر الحية.') },
    { key: 'glasses', need: 'optional', why: tx('Fibre shards when you cleave. Glasses do not protect against the laser itself.', 'شظايا الألياف عند القطع. النظارة لا تحمي من الليزر نفسه.') },
  ],
  actions: [
    {
      id: 'door', station: 'rack', pose: 'reach', reach: RACK, set: { door: 1 }, hideWhen: { done: ['door'] },
      label: tx('Unlock and open the rack door', 'افتح قفل باب الخزانة وافتحه'),
      ok: tx('Door open. Link LED on port 24 (fibre uplink) is off.', 'الباب مفتوح. ليد المنفذ 24 (وصلة الألياف) مطفأ.'),
    },
    {
      id: 'disable', station: 'pc', pose: 'reach', reach: [2.25, -0.3, 0.4],
      label: tx('Shut the uplink port on the switch from the laptop', 'أغلق منفذ الوصلة على السويتش من الحاسب'),
      ok: tx('Port 24 administratively down: the transmitter is off.', 'المنفذ 24 مغلق إداريًا: المرسل مطفأ.'),
    },
    {
      id: 'unplug', station: 'rack', pose: 'reach', reach: RACK, needs: ['door'], set: { fibre: 1 },
      label: tx('Unplug the fibre lead and check its end with the fibre scope', 'افصل كابل الألياف وافحص طرفه بمجهر الألياف'),
      ok: tx('The scope shows a dirty end face: dust on the core. That is the fault.', 'يظهر المجهر وجه طرف متسخًا: غبار على القلب. هذا هو العطل.'),
      hazards: [{
        when: { notDone: ['disable'] },
        outcome: {
          kind: 'incident', id: 'csn-laser', effect: 'arceye', at: [0.4, -0.2, 0.8], toward: 'face', severity: 2,
          title: tx('You looked down a live fibre', 'نظرت في ليف ضوئي حي'),
          what: tx('You held the connector up to the light to look at it. The 1310 nm laser is invisible: there was nothing to see, and nothing to warn you.', 'رفعت الموصل نحو الضوء لتنظر إليه. ليزر 1310 نانومتر غير مرئي: لم يكن هناك ما تراه ولا ما يحذرك.'),
          harm: tx('Invisible infrared lasers burn the retina without pain. Damage is permanent.', 'الليزر تحت الأحمر غير المرئي يحرق الشبكية بلا ألم. والضرر دائم.'),
          rule: tx('Never look into a fibre. Shut the port and use a fibre scope or a power meter.', 'لا تنظر أبدًا في ليف. أغلق المنفذ واستخدم مجهر الألياف أو مقياس القدرة.'),
          ref: 'IEC 60825-2', sign: { kind: 'warning', pic: 'exclaim' },
        },
      }],
    },
    {
      id: 'clean', station: 'rack', pose: 'reach', reach: RACK, needs: ['unplug'], set: { fibre: 0 },
      label: tx('Clean both ends and plug the fibre back in', 'نظّف الطرفين وأعد توصيل الألياف'),
      ok: tx('One-click cleaner on both ends, scope shows a clean core. Plugged in, port enabled: link up at 10 G.', 'نُظف الطرفان بالمنظف، والمجهر يظهر قلبًا نظيفًا. وُصل الكابل وفُعل المنفذ: الوصلة تعمل بسرعة 10 جيجا.'),
    },
    {
      id: 'feet', station: 'front', pose: 'crouch', reach: [0, -2.0, 0.9], hideWhen: { done: ['feet'] },
      label: tx('Wind down the rack\'s anti-tip feet', 'أنزل أرجل منع الانقلاب في الخزانة'),
      ok: tx('Stabiliser feet down on both front corners.', 'أُنزلت أرجل التثبيت في الركنين الأماميين.'),
    },
    {
      id: 'server', station: 'rack', pose: 'reach', reach: RACK, needs: ['door'], set: { server: 1 },
      label: tx('Slide the server out on its rails and change the drive', 'اسحب الخادم على قضبانه وغيّر القرص'),
      ok: tx('Server out, failed drive hot-swapped, the array is rebuilding.', 'خرج الخادم، واستُبدل القرص التالف أثناء التشغيل، والمصفوفة تعيد البناء.'),
      hazards: [{
        when: { notDone: ['feet'] },
        outcome: {
          kind: 'incident', id: 'csn-tip', effect: 'fall', at: [0, 0.6, 0.6], toward: 'face', severity: 3,
          title: tx('The rack tipped forward', 'انقلبت الخزانة للأمام'),
          what: tx('With the heavy UPS at the bottom it felt solid, but 25 kg of server out on its rails moved the centre of gravity past the front feet. The rack rocked onto you.', 'مع وجود UPS الثقيل في الأسفل بدت ثابتة، لكن 25 كجم من الخادم خارج القضبان نقلت مركز الثقل أمام الأرجل الأمامية. مالت الخزانة عليك.'),
          harm: tx('A loaded rack weighs 300–600 kg. Tipping racks crush technicians every year.', 'الخزانة المحملة تزن 300–600 كجم. الخزانات المنقلبة تسحق فنيين كل عام.'),
          rule: tx('Anti-tip feet or a bolted rack before you pull out anything on rails. One item out at a time.', 'أرجل منع الانقلاب أو خزانة مثبتة قبل سحب أي شيء على القضبان. جهاز واحد في كل مرة.'),
          sign: { kind: 'warning', pic: 'exclaim' },
        },
      }],
    },
    {
      id: 'close', station: 'rack', pose: 'reach', reach: RACK, needs: ['server'], set: { server: 0, door: 0 }, goal: true,
      label: tx('Slide the server back, close and lock the door', 'أعد الخادم إلى مكانه وأغلق الباب واقفله'),
      ok: tx('Server in, door locked, ticket closed: building 2 back online, array rebuilt.', 'الخادم في مكانه والباب مقفل والتذكرة مغلقة: المبنى الثاني عاد للشبكة واكتمل بناء المصفوفة.'),
      hazards: [{
        when: { notDone: ['clean'] },
        outcome: {
          kind: 'blocked', id: 'csn-still-down', effect: 'alarm', at: RACK,
          title: tx('The second building is still offline', 'المبنى الثاني ما زال بلا شبكة'),
          what: tx('You closed up without fixing the uplink. The help desk phone is ringing again.', 'أغلقت الخزانة دون إصلاح الوصلة. هاتف الدعم يرن من جديد.'),
          rule: tx('Prove the fault is fixed (link up, ping across) before you close the job.', 'أثبت إصلاح العطل (الوصلة تعمل والاتصال ناجح) قبل إغلاق العمل.'),
          sign: { kind: 'mandatory', pic: 'exclaim' },
        },
      }],
    },
  ],
};
