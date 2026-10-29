import Link from 'next/link';
import { getI18n } from '@/lib/i18n-server';
import { cohortLearners } from '@/lib/queries';
import { PageHead } from './ui';

export async function LearnerList({ institutionId, base, eyebrow }: { institutionId: string; base: string; eyebrow: string }) {
  const { L, ar } = await getI18n();
  const rows = await cohortLearners(institutionId);
  return (
    <div className="page">
      <PageHead eyebrow={eyebrow} title={L('Learners', 'المتدربون')} sub={L(`${rows.length} learners`, `${rows.length} متدربًا`)} />
      <section className="panel">
        <div className="scroll-x">
          <table className="data">
            <thead><tr><th>{L('Learner', 'المتدرب')}</th><th>{L('Cohort', 'المجموعة')}</th><th className="num">{L('Competent', 'محقق')}</th>
              <th className="num">{L('Latest score', 'آخر درجة')}</th><th>{L('Safety', 'السلامة')}</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><Link className="row-link" href={`${base}/${r.id}`}>{ar(r.name, r.name_ar)}</Link><br /><span className="muted small" dir="ltr">{r.email}</span></td>
                <td>{ar(r.cohort, r.cohort_ar)}</td>
                <td className="num">{r.competent}/{r.elements}</td>
                <td className="num">{r.last_score ?? '—'}</td>
                <td>{r.open_alerts > 0 ? <span className="status st-bad">▲ {L(`${r.open_alerts} open alert`, `${r.open_alerts} تنبيه مفتوح`)}</span> : <span className="status st-ok">{L('Clear', 'لا تنبيهات')}</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
