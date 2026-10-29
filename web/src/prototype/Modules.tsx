/**
 * The module screens (shared with the app, see web/src/modules) running on
 * the in-memory demo API: trainer machines, stores and early warning; the
 * student's machine access, applied assessment and phone OJT logbook; the
 * director's skills heatmap and early warning.
 */
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { assessmentDemo, demoSubscribe, demoVersion, logbookDemo, machineDemo, riskDemo, skillsDemo, storesDemo } from '../demo/demo';
import { ApprenticeLogbook } from '../modules/ApprenticeLogbook';
import { AssessmentPlayer } from '../modules/AssessmentPlayer';
import { EarlyWarning } from '../modules/EarlyWarning';
import { MachineAccess } from '../modules/MachineAccess';
import { SkillsHeatmap } from '../modules/SkillsHeatmap';
import type { Ui } from '../modules/types';
import { MachineBoard, StoresBoard } from '../modules/WorkshopBoards';
import '../modules/tw.css';
import { useL, useStore } from './store';
import { TRADES } from './trades';
import { PageHeader } from './ui';

const useDemo = () => useSyncExternalStore(demoSubscribe, demoVersion);
function useUi(): Ui { const { L, lang } = useL(); return { L, lang }; }

function Page({ crumbs, title, meta, children }: { crumbs: string[]; title: ReactNode; meta?: ReactNode; children: ReactNode }) {
  return <div className="module-page"><PageHeader crumbs={crumbs} title={title} meta={meta} />{children}</div>;
}

export function TrainerMachines() {
  useDemo();
  const { trade } = useStore();
  const ui = useUi(), { L, pick } = useL();
  const m = useMemo(() => machineDemo(trade), [trade]);
  return (
    <Page crumbs={[L('Workshops', 'الورش'), pick(trade.bay.name)]} title={L('Machines & safety passports', 'الماكينات وتصاريح السلامة')}
      meta={L('A machine unlocks only for a learner with the competency and a passed pre-check. Stop any session remotely.', 'لا تُفتح الماكينة إلا لمتدرب لديه الجدارة واجتاز الفحص المسبق. أوقف أي جلسة عن بُعد.')}>
      <MachineBoard ui={ui} machines={m.rows()} onStop={m.stop} scanUrl={(code) => `https://vtc.example/student/machine?code=${code}`} />
    </Page>
  );
}

export function TrainerStores() {
  useDemo();
  const { trade } = useStore();
  const ui = useUi(), { L, pick } = useL();
  const s = storesDemo(trade);
  return (
    <Page crumbs={[L('Workshops', 'الورش'), pick(trade.bay.name)]} title={L('Consumables & stores', 'المستهلكات والمخزن')}
      meta={L('Each signed-off job issues its bill of materials; the forecast adds the next 7 days of bookings.', 'كل مهمة معتمدة تصرف قائمة موادها؛ والتوقع يضيف حجوزات الأيام السبعة القادمة.')}>
      <StoresBoard key={trade.id} ui={ui} items={s.rows} onReceive={s.receive} />
    </Page>
  );
}

export function RiskScreen({ all }: { all?: boolean }) {
  useDemo();
  const { trade, dirTrade } = useStore();
  const ui = useUi(), { L } = useL();
  const trades = all ? (dirTrade === 'all' ? TRADES : TRADES.filter((t) => t.id === dirTrade)) : [trade];
  const d = riskDemo(trades);
  return (
    <Page crumbs={[all ? L('Institution', 'المؤسسة') : L('Learners', 'المتدربون')]} title={L('Early warning', 'الإنذار المبكر')}
      meta={L('Predicted risk at the final practical, from workshop rubrics, V-Lab telemetry, quizzes, attendance and OJT hours.', 'الخطر المتوقع في الاختبار العملي النهائي، من تقييمات الورشة وبيانات المعمل الافتراضي والاختبارات والحضور وساعات التدريب الميداني.')}>
      <EarlyWarning key={trades.map((t) => t.id).join()} ui={ui} data={d} canAck={!all} onAck={d.ack} />
    </Page>
  );
}

export function StudentMachine() {
  const { trade } = useStore();
  const ui = useUi(), { L, pick } = useL();
  const m = useMemo(() => machineDemo(trade), [trade]);
  return (
    <Page crumbs={[pick(trade.bay.name)]} title={L('Machine access', 'تشغيل الماكينة')}
      meta={L('Scan the QR label, pass the safety pre-check, and the machine unlocks for your session. Try your own bench, a busy one and one in maintenance.', 'امسح ملصق QR واجتز فحص السلامة المسبق، فتُفتح الماكينة لجلستك. جرّب محطتك ومحطة مشغولة وأخرى في الصيانة.')}>
      <div className="phone"><MachineAccess key={trade.id} ui={ui} api={m.api} demoCodes={m.demoCodes} /></div>
    </Page>
  );
}

export function StudentAssess() {
  const { trade } = useStore();
  const ui = useUi(), { L, pick } = useL();
  const [n, setN] = useState(0);
  const a = useMemo(() => assessmentDemo(trade, trade.learner.name.en + n), [trade, n]);
  return (
    <Page crumbs={[pick(trade.name)]} title={L('Applied assessment', 'تقييم تطبيقي')}
      meta={L('Each learner gets their own numbers and is marked against their own tolerance band; faults are found by pinning them on the drawing.', 'لكل متدرب أرقامه الخاصة وتُصحح إجابته ضمن نطاق تفاوته؛ وتُحدد الأعطال بوضع دبابيس على المخطط.')}>
      <div className="narrow"><AssessmentPlayer key={a.sitting.assessmentId} ui={ui} sitting={a.sitting} onSubmit={a.submit} onRestart={() => setN((x) => x + 1)} /></div>
    </Page>
  );
}

export function ApprenticePhone() {
  const { trade, online } = useStore();
  const ui = useUi(), { L, pick } = useL();
  const d = useMemo(() => logbookDemo(trade, () => onlineRef.current), [trade]);
  onlineRef.current = online;
  return (
    <Page crumbs={[L('Work-based learning', 'التعلم في موقع العمل'), pick(trade.learner.name)]} title={L('OJT logbook', 'سجل التدريب الميداني')}
      meta={L('The apprentice’s phone: geofenced check-in and out at the employer’s site, entries with photos, supervisor sign-off. Use the demo GPS buttons, and the Online pill on the floor screen to go offline.', 'هاتف المتدرب: تسجيل الحضور والانصراف داخل نطاق موقع جهة العمل، وإدخالات بالصور، واعتماد المشرف. استخدم أزرار GPS التجريبية، وزر الاتصال في شاشة الورشة للعمل دون اتصال.')}>
      <div className="phone"><ApprenticeLogbook key={trade.id} ui={ui} api={d.api} placement={d.placement} totals={d.totals} shifts={d.shifts} entries={d.entries} online={online} /></div>
    </Page>
  );
}
const onlineRef = { current: true };

export function DirectorSkills() {
  const { dirTrade } = useStore();
  const ui = useUi(), { L } = useL();
  const trades = dirTrade === 'all' ? TRADES : TRADES.filter((t) => t.id === dirTrade);
  const d = useMemo(() => skillsDemo(trades), [dirTrade]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Page crumbs={[L('Institution', 'المؤسسة'), L('Quality', 'الجودة')]} title={L('Skills heatmap', 'خريطة المهارات')}
      meta={L('Novice → Intermediate → Autonomous → Master against the national occupational standard, by element.', 'مبتدئ ← متوسط ← مستقل ← متمكن مقابل المعيار المهني الوطني، حسب العنصر.')}>
      <SkillsHeatmap key={dirTrade} ui={ui} data={d} loadLearner={d.radar} standard={trades.map((t) => t.framework.code).join(' · ')} />
    </Page>
  );
}
