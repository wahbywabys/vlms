/**
 * Washing machine: it will not drain. Traps: opening it while plugged in,
 * draining near live parts, and returning it without the safety test.
 */
import { tx } from '../models/kit';
import { washingMachine } from '../models/washingMachine';
import type { Scenario } from './types';

type V3 = [number, number, number];
const PUMP: V3 = [0.5, -1.7, 0.6];
const BACK: V3 = [2.25, -1.6, 0.3];

export const hamSafety: Scenario = {
  id: 'sim-ham-drain',
  trade: 'ham',
  model: washingMachine,
  minutes: 45,
  title: tx('Repair a washing machine that will not drain', 'أصلح غسالة لا تصرف المياه'),
  brief: tx(
    'A customer\'s washing machine stopped mid-cycle with error E21 (drain fault). The drum is full of water and the door is locked.',
    'توقفت غسالة أحد العملاء في منتصف الدورة بكود E21 (عطل الصرف). الحلة مملوءة بالماء والباب مقفل.'),
  task: tx('Make it safe, clear the drain, test it and hand it back safe.', 'اجعلها آمنة ونظّف الصرف واختبرها وسلّمها آمنة.'),
  params: { top: 0, plug: 1, water: 1, door: 0, pat: 0 },
  startRunning: false,
  ppe: [
    { key: 'boots', need: 'required', why: tx('Up to 15 litres of water come out on the floor; non-slip soles.', 'حتى 15 لترًا من الماء تخرج على الأرض؛ نعل مانع للانزلاق.') },
    { key: 'gloves-leather', need: 'optional', why: tx('The sheet-metal edges inside are sharp. Take them off for the electrical tests.', 'حواف الصاج الداخلية حادة. انزعها في الاختبارات الكهربائية.') },
    { key: 'no-jewellery', need: 'required', why: tx('Rings on wet hands near 230 V terminals.', 'الخواتم في أيدٍ مبللة بجوار أطراف 230 فولت.') },
  ],
  actions: [
    {
      id: 'unplug', station: 'back', pose: 'crouch', reach: BACK, set: { plug: 0 }, hideWhen: { done: ['unplug'] },
      label: tx('Pull the plug out of the socket', 'اسحب القابس من المقبس'),
      ok: tx('Unplugged and the plug is where you can see it. The display is dark.', 'فُصل القابس وهو أمام عينيك. الشاشة مطفأة.'),
    },
    {
      id: 'drain', station: 'pump', pose: 'crouch', reach: PUMP, set: { water: 0 },
      label: tx('Drain the drum through the emergency hose into a tray', 'صرّف الحلة عبر خرطوم الطوارئ في صينية'),
      ok: tx('About 12 litres into the tray, towels down. The door lock releases after a minute.', 'خرج نحو 12 لترًا في الصينية والمناشف على الأرض. يفتح قفل الباب بعد دقيقة.'),
      hazards: [{
        when: { notDone: ['unplug'] },
        outcome: {
          kind: 'incident', id: 'ham-wet-live', effect: 'shock', at: PUMP, toward: 'hand', severity: 3,
          title: tx('Water ran over live terminals', 'سال الماء على أطراف مكهربة'),
          what: tx('The machine was still plugged in. Water from the filter ran over the pump connector and through your wet hand to the floor.', 'كانت الغسالة ما زالت موصلة. سال الماء من المرشح على موصل المضخة ومر عبر يدك المبللة إلى الأرض.'),
          harm: tx('Water and 230 V is the most common way appliance repairers are killed.', 'الماء مع 230 فولت أكثر طريقة يموت بها فنيو الأجهزة.'),
          rule: tx('Unplug before you open, drain or touch anything: switching off is not enough.', 'افصل القابس قبل الفتح أو الصرف أو اللمس: الإطفاء لا يكفي.'),
          sign: { kind: 'warning', pic: 'electric' },
        },
      }],
    },
    {
      id: 'top', station: 'inside', pose: 'reach', reach: [0.2, 0.0, 0.3], set: { top: 1 }, hideWhen: { done: ['top'] },
      label: tx('Take off the top panel', 'فك اللوح العلوي'),
      ok: tx('Two screws out, panel slid back and off.', 'فُك المسماران وسُحب اللوح للخلف.'),
      hazards: [{
        when: { notDone: ['unplug'] },
        outcome: {
          kind: 'incident', id: 'ham-live', effect: 'shock', at: [0.2, 0.0, 0.3], toward: 'hand', severity: 2,
          title: tx('You touched the live mains filter', 'لمست مرشح الكهرباء المكهرب'),
          what: tx('The suppressor at the back top is live whenever the machine is plugged in, even switched off.', 'مرشح التداخل في أعلى الخلف مكهرب ما دامت الغسالة موصلة، حتى وهي مطفأة.'),
          rule: tx('Unplug first.', 'افصل القابس أولًا.'),
          sign: { kind: 'warning', pic: 'electric' },
        },
      }],
    },
    {
      id: 'filter', station: 'pump', pose: 'crouch', reach: PUMP, needs: ['drain'],
      label: tx('Clear the pump filter and check the impeller and coil', 'نظف مرشح المضخة وافحص الريشة والملف'),
      ok: tx('A coin and a sock in the filter. Impeller turns freely; pump coil 170 Ω, good.', 'عملة وجورب في المرشح. الريشة تدور بحرية؛ ملف المضخة 170 أوم، سليم.'),
    },
    {
      id: 'refit', station: 'inside', pose: 'reach', reach: [0.2, 0.0, 0.3], needs: ['filter'], set: { top: 0 }, hideWhen: { done: ['refit'] },
      label: tx('Refit the filter and the top panel, with its earth lead', 'أعد المرشح واللوح العلوي مع سلك الأرضي'),
      ok: tx('Filter tight, top panel on with its earth tag connected.', 'المرشح مربوط واللوح العلوي مركب وسلك الأرضي موصل.'),
    },
    {
      id: 'pat', station: 'tester', pose: 'operate', reach: [2.35, -1.0, 0.4], needs: ['refit'], set: { pat: 1 },
      label: tx('Safety-test the machine: earth bond, insulation and leakage', 'اختبر سلامة الغسالة: الأرضي والعزل والتسرب'),
      ok: tx('Earth bond 0.09 Ω, insulation > 200 MΩ, leakage 0.6 mA. PASS label on.', 'الأرضي 0.09 أوم والعزل أكبر من 200 ميجا أوم والتسرب 0.6 مللي أمبير. لُصق ملصق النجاح.'),
    },
    {
      id: 'handover', station: 'back', pose: 'crouch', reach: BACK, needs: ['refit'], set: { plug: 1, pat: 0, water: 1 }, running: true, goal: true,
      label: tx('Plug in, run a rinse-and-spin and hand it back', 'وصّل الغسالة وشغّل دورة شطف وعصر وسلّمها'),
      ok: tx('Fills, drains in 40 s, spins to 1400 rpm. No E21. Customer signs the job sheet.', 'تملأ وتصرف في 40 ثانية وتعصر حتى 1400 لفة. لا كود E21. يوقع العميل على ورقة العمل.'),
      hazards: [{
        when: { notDone: ['pat'] },
        outcome: {
          kind: 'blocked', id: 'ham-no-test', effect: 'alarm', at: BACK,
          title: tx('Handed back without a safety test', 'سُلمت دون اختبار السلامة'),
          what: tx('Your supervisor stopped the handover: an untested appliance does not leave the workshop. (This one was fine. The next might have a loose earth.)', 'أوقف المشرف التسليم: الجهاز غير المختبر لا يخرج من الورشة. (هذه كانت سليمة، والتالية قد يكون أرضيها مفكوكًا.)'),
          rule: tx('Every repaired appliance gets earth, insulation and leakage tests before it goes back.', 'كل جهاز مُصلح يُختبر للأرضي والعزل والتسرب قبل تسليمه.'),
          ref: 'IEC 62638 · VDE 0701', sign: { kind: 'mandatory', pic: 'exclaim' },
        },
      }],
    },
  ],
};
