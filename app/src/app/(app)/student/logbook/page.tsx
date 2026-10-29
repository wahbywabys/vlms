import { Empty, PageHead, Stat } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { tx } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n-server';
import { wblProgress } from '@/lib/queries';
import { CheckIn, NewEntry } from './LogbookForms';

export const metadata = { title: 'Logbook' };
export const dynamic = 'force-dynamic';

const STATUS = { draft: tx('Draft', 'مسودة'), submitted: tx('Awaiting sign-off', 'بانتظار الاعتماد'), approved: tx('Approved', 'معتمد'),
  rejected: tx('Rejected', 'مرفوض'), revision_requested: tx('Changes requested', 'مطلوب تعديل') };

export default async function Logbook() {
  const s = await requireRole('student');
  const { L, ar, pick, date, time } = await getI18n();
  const wbl = await wblProgress(s.userId);
  const entries = await q<{ id: string; work_date: Date; hours: number; task_summary: string; status: keyof typeof STATUS; codes: string[];
    rating: number | null; comment: string | null; signature_hash: string | null }>(
    `SELECT e.id, e.work_date, e.hours::float, e.task_summary, e.status::text AS status,
            ARRAY(SELECT c.code FROM competencies c WHERE c.id = ANY(e.competency_ids) ORDER BY c.code) AS codes,
            so.rating, so.comment, so.signature_hash
       FROM wbl_logbook_entries e JOIN wbl_placements p ON p.id = e.placement_id
       LEFT JOIN LATERAL (SELECT * FROM wbl_signoffs x WHERE x.entry_id = e.id ORDER BY x.signed_at DESC LIMIT 1) so ON true
      WHERE p.learner_id = $1 ORDER BY e.work_date DESC LIMIT 30`, [s.userId]);
  const checkins = await q<{ device_time: Date; inside_geofence: boolean; distance_m: number }>(
    `SELECT c.device_time, c.inside_geofence, round(c.distance_m)::int AS distance_m FROM wbl_checkins c JOIN wbl_placements p ON p.id = c.placement_id
      WHERE p.learner_id = $1 ORDER BY c.device_time DESC LIMIT 5`, [s.userId]);
  const competencies = await q<{ id: string; code: string; title: string; title_ar: string | null }>(
    `SELECT id, code, title, title_ar FROM competencies WHERE kind = 'element' AND code LIKE 'ELEC%' ORDER BY code`);

  return (
    <div className="page">
      <PageHead eyebrow={L('Student · Work-based learning', 'الطالب · التعلم في موقع العمل')} title={L('My logbook', 'سجل تدريبي')}
        sub={wbl ? `${wbl.employer} · ${wbl.site} · ${L('Supervisor', 'المشرف')}: ${ar(wbl.supervisor, wbl.supervisor_ar)}` : undefined} />
      {!wbl ? <Empty>{L('You are not on a placement yet.', 'لست في تدريب ميداني بعد.')}</Empty> : (
        <>
          <div className="kpis">
            <Stat label={L('Approved hours', 'الساعات المعتمدة')} value={wbl.approved_hours} unit={`/${wbl.required_hours}`} />
            <Stat label={L('Awaiting sign-off', 'بانتظار الاعتماد')} value={wbl.pending_hours} unit=" h" sub={L(`${wbl.pending_entries} entries`, `${wbl.pending_entries} سجلات`)} />
            <Stat label={L('Placement ends', 'نهاية التدريب')} value={date(wbl.ends_on)} />
          </div>
          <div className="cols-2">
            <section className="panel"><header className="panel-head"><h2>{L('Check in', 'تسجيل الحضور')}</h2></header>
              <CheckIn />
              <ul className="live-list" style={{ marginTop: 12 }}>
                {checkins.map((c, i) => (
                  <li key={i}><span dir="ltr">{date(c.device_time)} {time(c.device_time)}</span>
                    <span className={`status ${c.inside_geofence ? 'st-ok' : 'st-bad'}`}>{c.inside_geofence ? L('On site', 'في الموقع') : L('Outside', 'خارج الموقع')} · {c.distance_m} m</span></li>
                ))}
              </ul>
            </section>
            <section className="panel"><header className="panel-head"><h2>{L('New entry', 'سجل جديد')}</h2></header>
              <NewEntry competencies={competencies} /></section>
          </div>
          <section className="panel"><header className="panel-head"><h2>{L('Entries', 'السجلات')}</h2></header>
            <ul className="entries">{entries.map((e) => (
              <li key={e.id} className="entry">
                <div className="entry-head"><strong dir="ltr">{date(e.work_date, { weekday: 'short', day: 'numeric', month: 'short' })} · {e.hours} h</strong>
                  <span className={`status st-${e.status}`}>{pick(STATUS[e.status])}{e.rating ? ` · ${'★'.repeat(e.rating)}` : ''}</span></div>
                <p dir="auto">{e.task_summary}</p>
                <p className="muted small mono">{e.codes.join(' · ')}</p>
                {e.comment && <p className="small">“{e.comment}”</p>}
                {e.signature_hash && <span className="hash" dir="ltr">sha256 {e.signature_hash}</span>}
              </li>
            ))}</ul>
          </section>
        </>
      )}
    </div>
  );
}
