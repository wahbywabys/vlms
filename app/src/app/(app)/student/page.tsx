import Link from 'next/link';
import { AssessmentTable } from '@/components/AssessmentTable';
import { CompetencyTable } from '@/components/CompetencyTable';
import { Empty, PageHead, Stat } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';
import { assessments, competencyProfile, credentials, learner, wblProgress } from '@/lib/queries';

export const metadata = { title: 'My progress' };

export default async function StudentHome() {
  const s = await requireRole('student');
  const t = await getI18n();
  const { L, ar, date } = t;
  const [me, profile, history, wbl, creds] = await Promise.all([
    learner(s.userId, s.institutionId), competencyProfile(s.userId), assessments(s.userId, 8), wblProgress(s.userId), credentials(s.userId),
  ]);
  const competent = profile.filter((c) => c.level === 'autonomous' || c.level === 'master').length;
  const safetyGaps = profile.filter((c) => c.is_safety_critical && (c.level === 'not_yet' || c.level === 'novice'));
  const vlab = history.filter((h) => h.kind === 'vlab_session');
  const best = vlab.length ? Math.max(...vlab.map((v) => v.score)) : null;
  const first = ar(s.name, s.nameAr).split(' ')[0];

  return (
    <div className="page">
      <PageHead eyebrow={`${L('Student', 'الطالب')} · ${ar(me?.cohort, me?.cohort_ar)}`} title={L(`Welcome back, ${first}`, `أهلًا بعودتك يا ${first}`)}
        sub={L('Your competency record across virtual labs, the workshop floor and your placement.', 'سجل جداراتك عبر المعامل الافتراضية وأرضية الورشة وموقع التدريب.')}>
        <Link className="button" href="/student/private">🔒 {L('My private space', 'مساحتي الخاصة')}</Link>
        <Link className="button primary" href="/student/lab">{L('Open the V-Lab', 'افتح المعمل الافتراضي')}</Link>
      </PageHead>

      <div className="kpis">
        <Stat label={L('Competent elements', 'عناصر الجدارة المحققة')} value={competent} unit={`/${profile.length}`}
          sub={L('autonomous or master', 'مستقل أو متمكن')} />
        <Stat label={L('Best V-Lab exam', 'أفضل امتحان افتراضي')} value={best ?? '—'} sub={L(`${vlab.length} scored attempts`, `${vlab.length} محاولات مقيّمة`)} />
        <Stat label={L('Placement hours', 'ساعات التدريب الميداني')} value={wbl ? Math.round(wbl.approved_hours) : '—'} unit={wbl ? `/${wbl.required_hours}` : undefined}
          sub={wbl && wbl.pending_entries ? L(`${wbl.pending_entries} entries awaiting sign-off`, `${wbl.pending_entries} سجلات بانتظار الاعتماد`) : undefined} />
        <Stat label={L('Micro-credentials', 'الشهادات المصغّرة')} value={creds.length} sub={creds[0] ? creds[0].title : L('none yet', 'لا يوجد بعد')} />
      </div>

      {safetyGaps.length > 0 && (
        <p className="notice notice-block">
          {L('Safety-critical elements still below autonomous: ', 'عناصر سلامة حرجة لم تصل إلى مستوى مستقل بعد: ')}
          {safetyGaps.map((g) => ar(g.title, g.title_ar)).join(' · ')}.{' '}
          {L('Machines that need them stay locked to your badge until they are signed off.', 'تبقى الماكينات التي تتطلبها مقفولة على بطاقتك حتى يتم اعتمادها.')}
        </p>
      )}

      <div className="dash-grid">
        <section className="panel wide">
          <header className="panel-head"><h2>{L('My competencies', 'جداراتي')}</h2>
            <span className="muted">{L('Virtual evidence counts up to autonomous; master needs your workplace supervisor.', 'الأدلة الافتراضية تصل حتى مستوى مستقل؛ ومستوى متمكن يتطلب مشرف موقع العمل.')}</span></header>
          <CompetencyTable rows={profile} t={t} />
        </section>
        <section className="panel">
          <header className="panel-head"><h2>{L('Recent assessments', 'أحدث التقييمات')}</h2></header>
          {history.length ? <AssessmentTable rows={history} t={t} /> : <Empty>{L('No assessments yet. Try a guided V-Lab attempt.', 'لا توجد تقييمات بعد. جرّب محاولة موجّهة في المعمل الافتراضي.')}</Empty>}
        </section>
        <section className="panel">
          <header className="panel-head"><h2>{L('Work placement', 'التدريب في موقع العمل')}</h2></header>
          {wbl ? (
            <div className="wbl">
              <p><strong>{wbl.employer}</strong><br /><span className="muted">{wbl.site} · {L('Supervisor', 'المشرف')}: {ar(wbl.supervisor, wbl.supervisor_ar)}</span></p>
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={wbl.required_hours} aria-valuenow={wbl.approved_hours}>
                <span className="progress-fill" style={{ width: `${Math.min(100, (100 * wbl.approved_hours) / wbl.required_hours)}%` }} />
                <span className="progress-pending" style={{ width: `${Math.min(100, (100 * wbl.pending_hours) / wbl.required_hours)}%` }} />
              </div>
              <p className="muted small">{L(`${wbl.approved_hours} h approved · ${wbl.pending_hours} h pending · ends ${date(wbl.ends_on)}`,
                `${wbl.approved_hours} ساعة معتمدة · ${wbl.pending_hours} ساعة قيد الاعتماد · ينتهي ${date(wbl.ends_on)}`)}</p>
              <Link className="button" href="/student/logbook">{L('Open my logbook', 'افتح سجل التدريب')}</Link>
            </div>
          ) : <Empty>{L('No placement yet.', 'لا يوجد تدريب ميداني بعد.')}</Empty>}
        </section>
      </div>
    </div>
  );
}
