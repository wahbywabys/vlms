import { AutoRefresh } from '@/components/AutoRefresh';
import { Empty, MODE_LABEL, PageHead, Result } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { FAULTS } from '@/lib/dol';
import { getI18n } from '@/lib/i18n-server';
import { StartExam } from './StartExam';

export const metadata = { title: 'V-Lab exams' };
export const dynamic = 'force-dynamic';

export default async function TrainerVlab() {
  const s = await requireRole('vocational_trainer', 'academic_teacher');
  const t = await getI18n();
  const { L, ar, pick, time, date } = t;
  const learners = await q<{ id: string; name: string; nameAr: string | null }>(
    `SELECT u.id, u.full_name AS name, u.full_name_ar AS "nameAr" FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
      WHERE u.institution_id = $1 ORDER BY u.full_name`, [s.institutionId]);
  const live = await q<{ id: string; name: string; name_ar: string | null; mode: string; faults: string[]; started_at: Date; time_limit_s: number | null;
    events: number; last_verb: string | null; last_ref: string | null; gate_alerts: number }>(
    `SELECT s.id, u.full_name AS name, u.full_name_ar AS name_ar, s.mode::text AS mode,
            ARRAY(SELECT f.code FROM lab_faults f WHERE f.id = ANY(s.injected_fault_ids)) AS faults,
            s.started_at, s.time_limit_s,
            (SELECT count(*)::int FROM vlab_telemetry t WHERE t.session_id = s.id) AS events,
            (SELECT t.verb FROM vlab_telemetry t WHERE t.session_id = s.id ORDER BY t.seq DESC LIMIT 1) AS last_verb,
            (SELECT t.object_ref FROM vlab_telemetry t WHERE t.session_id = s.id ORDER BY t.seq DESC LIMIT 1) AS last_ref,
            (SELECT count(*)::int FROM safety_alerts a WHERE a.session_id = s.id) AS gate_alerts
       FROM virtual_lab_sessions s JOIN users u ON u.id = s.learner_id
      WHERE u.institution_id = $1 AND s.status = 'in_progress'
      ORDER BY s.started_at DESC`, [s.institutionId]);
  const done = await q<{ id: string; name: string; name_ar: string | null; mode: string; faults: string[]; score: number; passed: boolean; gate_failures: string[]; at: Date }>(
    `SELECT s.id, u.full_name AS name, u.full_name_ar AS name_ar, s.mode::text AS mode,
            ARRAY(SELECT f.code FROM lab_faults f WHERE f.id = ANY(s.injected_fault_ids)) AS faults,
            e.total_score::float AS score, e.passed, e.gate_failures, e.evaluated_at AS at
       FROM virtual_lab_sessions s JOIN users u ON u.id = s.learner_id
       JOIN rubric_evaluations e ON e.subject_type = 'vlab_session' AND e.subject_id = s.id
      WHERE u.institution_id = $1 ORDER BY e.evaluated_at DESC LIMIT 15`, [s.institutionId]);
  const faultTitle = (code: string) => { const f = FAULTS.find((x) => x.code === code); return f ? pick(f.title) : code; };

  return (
    <div className="page">
      <AutoRefresh ms={4000} />
      <PageHead eyebrow={L('Trainer · V-Lab', 'المدرب · المعمل الافتراضي')} title={L('DOL starter fault exams', 'امتحانات أعطال بادئ DOL')}
        sub={L('Inject a fault, watch attempts stream in, and see the rubric engine’s verdict. This page refreshes itself.',
          'ازرع عطلًا، وتابع المحاولات لحظة بلحظة، واطّلع على حكم محرك المعايير. تتحدث هذه الصفحة تلقائيًا.')} />
      <div className="dash-grid">
        <section className="panel"><header className="panel-head"><h2>{L('Start an exam', 'ابدأ امتحانًا')}</h2></header>
          <StartExam learners={learners} /></section>
        <section className="panel"><header className="panel-head"><h2>{L('Live attempts', 'المحاولات الجارية')}</h2>
          <span className="muted">{L(`${live.length} in progress`, `${live.length} جارية`)}</span></header>
          {live.length === 0 ? <Empty>{L('Nobody is in the V-Lab right now.', 'لا أحد في المعمل الافتراضي الآن.')}</Empty> : (
            <ul className="live-list">
              {live.map((l) => (
                <li key={l.id}>
                  <span><strong>{ar(l.name, l.name_ar)}</strong> · {pick(MODE_LABEL[l.mode]!)}{l.mode === 'assessment' && l.faults[0] ? ` · ${l.faults[0]}` : ''}<br />
                    <span className="muted small mono" dir="ltr">{l.events} events{l.last_verb ? ` · last: ${l.last_verb}${l.last_ref ? ` → ${l.last_ref}` : ''}` : ''}</span></span>
                  <span className="small">{l.gate_alerts > 0 && <span className="res res-fail">▲ {L(`${l.gate_alerts} gate`, `${l.gate_alerts} شرط أمان`)}</span>}{' '}
                    <span className="muted" dir="ltr">{time(l.started_at)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel wide"><header className="panel-head"><h2>{L('Scored attempts', 'المحاولات المقيّمة')}</h2></header>
          <div className="scroll-x">
            <table className="evals">
              <thead><tr><th>{L('Learner', 'المتدرب')}</th><th>{L('Mode', 'الوضع')}</th><th>{L('Injected fault', 'العطل المزروع')}</th>
                <th className="num">{L('Score', 'الدرجة')}</th><th>{L('Result', 'النتيجة')}</th><th>{L('When', 'الوقت')}</th></tr></thead>
              <tbody>{done.map((d) => (
                <tr key={d.id}><td>{ar(d.name, d.name_ar)}</td><td>{pick(MODE_LABEL[d.mode]!)}</td><td className="small">{d.faults.map(faultTitle).join(', ')}</td>
                  <td className="num">{d.score}</td><td><Result passed={d.passed} gates={d.gate_failures} t={t} /></td>
                  <td className="muted"><span dir="ltr">{date(d.at)} {time(d.at)}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
