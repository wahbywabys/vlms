import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getI18n } from '@/lib/i18n-server';
import { assessments, competencyProfile, credentials, learner, wblProgress, type CompetencyRow } from '@/lib/queries';
import { CompetencyTable } from './CompetencyTable';
import { AssessmentTable } from './AssessmentTable';
import { Empty, PageHead, Stat } from './ui';

/** A learner's record as staff see it: competencies, assessments, placement. */
export async function LearnerProfile({ id, institutionId, back }: { id: string; institutionId: string; back: string }) {
  const t = await getI18n();
  const { L, ar } = t;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const who = await learner(id, institutionId);
  if (!who) notFound();
  const [profile, history, wbl, creds] = await Promise.all([competencyProfile(id), assessments(id), wblProgress(id), credentials(id)]);
  const competent = profile.filter((c) => c.level === 'autonomous' || c.level === 'master').length;
  return (
    <div className="page">
      <p><Link href={back} className="back">{L('← All learners', 'جميع المتدربين →')}</Link></p>
      <PageHead eyebrow={`${L('Learner record', 'سجل المتدرب')} · ${ar(who.cohort, who.cohort_ar)}`} title={ar(who.name, who.name_ar)}
        sub={<span dir="ltr">{who.email}{who.badge ? ` · ${who.badge}` : ''}</span>} />
      <div className="kpis">
        <Stat label={L('Competent elements', 'عناصر الجدارة المحققة')} value={competent} unit={`/${profile.length}`} />
        <Stat label={L('Assessments', 'التقييمات')} value={history.length} sub={history[0] ? `${L('latest', 'الأحدث')} ${history[0].score}` : undefined} />
        <Stat label={L('Placement hours', 'ساعات التدريب الميداني')} value={wbl ? Math.round(wbl.approved_hours) : '—'} unit={wbl ? `/${wbl.required_hours}` : undefined} />
        <Stat label={L('Micro-credentials', 'الشهادات المصغّرة')} value={creds.length} sub={creds[0]?.title} />
      </div>
      <div className="dash-grid">
        <section className="panel wide"><header className="panel-head"><h2>{L('Competency profile', 'ملف الجدارات')}</h2></header>
          <CompetencyTable rows={profile as CompetencyRow[]} t={t} /></section>
        <section className="panel wide"><header className="panel-head"><h2>{L('Assessment history', 'سجل التقييمات')}</h2></header>
          {history.length ? <AssessmentTable rows={history} t={t} /> : <Empty>{L('No assessments yet.', 'لا توجد تقييمات بعد.')}</Empty>}</section>
      </div>
    </div>
  );
}
