import type { I18n } from '@/lib/i18n';
import type { AssessmentRow } from '@/lib/queries';
import { MODE_LABEL, Result } from './ui';

export function AssessmentTable({ rows, t, learnerCol }: { rows: (AssessmentRow & { learner?: string; learner_ar?: string | null })[]; t: I18n; learnerCol?: boolean }) {
  const { L, ar, pick, date, time } = t;
  return (
    <div className="scroll-x">
      <table className="evals">
        <thead><tr>{learnerCol && <th>{L('Learner', 'المتدرب')}</th>}<th>{L('Assessment', 'التقييم')}</th><th>{L('Source', 'المصدر')}</th>
          <th className="num">{L('Score', 'الدرجة')}</th><th>{L('Result', 'النتيجة')}</th><th>{L('When', 'الوقت')}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kind + r.id}>
              {learnerCol && <td>{ar(r.learner, r.learner_ar)}</td>}
              <td>{ar(r.title, r.title_ar)}</td>
              <td className="muted">{r.kind === 'vlab_session' ? `${L('V-Lab', 'معمل افتراضي')} · ${pick(MODE_LABEL[r.mode ?? ''] ?? { en: r.mode ?? '', ar: r.mode ?? '' })}`
                : `${L('Floor observation', 'ملاحظة في الورشة')}${r.assessor ? ` · ${ar(r.assessor, r.assessor_ar)}` : ''}`}</td>
              <td className="num">{r.score}</td>
              <td><Result passed={r.passed} gates={r.gate_failures} t={t} /></td>
              <td className="muted"><span dir="ltr">{date(r.at)} {time(r.at)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
