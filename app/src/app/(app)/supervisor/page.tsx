import { Empty, PageHead, Stat } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { tx } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n-server';
import { decide } from './actions';

export const metadata = { title: 'Logbook sign-offs' };
export const dynamic = 'force-dynamic';

const DECISION = { approved: tx('Approved', 'معتمد'), rejected: tx('Rejected', 'مرفوض'), revision_requested: tx('Revision requested', 'مطلوب تعديل') };

export default async function SupervisorPage() {
  const s = await requireRole('industry_supervisor');
  const { L, ar, pick, date, num } = await getI18n();
  const placements = await q<{ id: string; name: string; name_ar: string | null; site: string; required_hours: number; approved_hours: number; pending_hours: number;
    ends_on: Date; checkins: number; outside: number }>(
    `SELECT p.id, u.full_name AS name, u.full_name_ar AS name_ar, es.name AS site, p.required_hours,
            v.approved_hours::float, v.pending_hours::float, p.ends_on,
            (SELECT count(*)::int FROM wbl_checkins c WHERE c.placement_id = p.id) AS checkins,
            (SELECT count(*)::int FROM wbl_checkins c WHERE c.placement_id = p.id AND NOT c.inside_geofence) AS outside
       FROM wbl_placements p JOIN users u ON u.id = p.learner_id JOIN employer_sites es ON es.id = p.site_id
       JOIN v_wbl_hours_progress v ON v.placement_id = p.id
      WHERE p.supervisor_id = $1 ORDER BY u.full_name`, [s.userId]);
  const pending = await q<{ id: string; name: string; name_ar: string | null; work_date: Date; hours: number; task_summary: string; codes: string[]; submitted_at: Date; inside: boolean | null; media: { mediaId: string; type: string; captured_at: string }[] }>(
    `SELECT e.id, u.full_name AS name, u.full_name_ar AS name_ar, e.work_date, e.hours::float, e.task_summary, e.submitted_at, e.media,
            ARRAY(SELECT c.code FROM competencies c WHERE c.id = ANY(e.competency_ids) ORDER BY c.code) AS codes,
            (SELECT bool_and(c.inside_geofence) FROM wbl_checkins c WHERE c.placement_id = e.placement_id AND c.device_time::date = e.work_date) AS inside
       FROM wbl_logbook_entries e JOIN wbl_placements p ON p.id = e.placement_id JOIN users u ON u.id = p.learner_id
      WHERE p.supervisor_id = $1 AND e.status = 'submitted' ORDER BY e.work_date`, [s.userId]);
  const recent = await q<{ id: string; name: string; name_ar: string | null; work_date: Date; decision: keyof typeof DECISION; rating: number | null; signature_hash: string; signed_at: Date }>(
    `SELECT so.id, u.full_name AS name, u.full_name_ar AS name_ar, e.work_date, so.decision::text AS decision, so.rating, so.signature_hash, so.signed_at
       FROM wbl_signoffs so JOIN wbl_logbook_entries e ON e.id = so.entry_id JOIN wbl_placements p ON p.id = e.placement_id JOIN users u ON u.id = p.learner_id
      WHERE so.supervisor_id = $1 ORDER BY so.signed_at DESC LIMIT 8`, [s.userId]);
  const hoursPending = pending.reduce((a, p) => a + p.hours, 0);

  return (
    <div className="page">
      <PageHead eyebrow={L('Workplace supervisor · Nile Electro-Mechanical Co.', 'مشرف موقع العمل · شركة النيل الكهروميكانيكية')} title={L('Logbook sign-offs', 'اعتماد سجلات التدريب')}
        sub={L('Each decision is stored as its own signed, unchangeable record for the quality auditors. Approving also verifies the competencies the apprentice practised.',
          'يُحفظ كل قرار كسجل موقّع غير قابل للتعديل لمدققي الجودة. والاعتماد يوثّق أيضًا الجدارات التي مارسها المتدرب.')} />
      <div className="kpis">
        <Stat label={L('Apprentices', 'المتدربون')} value={placements.length} />
        <Stat label={L('Awaiting your sign-off', 'بانتظار اعتمادك')} value={pending.length} tone={pending.length ? 'warn' : 'ok'} sub={L(`${num(hoursPending)} hours`, `${num(hoursPending)} ساعة`)} />
        <Stat label={L('Check-ins outside the site', 'تسجيلات حضور خارج الموقع')} value={placements.reduce((a, p) => a + p.outside, 0)}
          sub={L('GPS geofence, checked by the server', 'نطاق GPS، يتحقق منه الخادم')} />
      </div>
      <section className="panel">
        <header className="panel-head"><h2>{L('Pending entries', 'سجلات بانتظار الاعتماد')}</h2></header>
        {pending.length === 0 ? <Empty>{L('All caught up.', 'لا شيء معلّق.')}</Empty> : (
          <ul className="entries">
            {pending.map((e) => (
              <li key={e.id} className="entry">
                <div className="entry-head">
                  <strong>{ar(e.name, e.name_ar)} · <span dir="ltr">{date(e.work_date, { weekday: 'short', day: 'numeric', month: 'short' })}</span> · {L(`${e.hours} h`, `${e.hours} ساعة`)}</strong>
                  <span className="small">{e.inside === null ? <span className="status st-draft">{L('No check-in', 'لا يوجد تسجيل حضور')}</span>
                    : e.inside ? <span className="status st-ok">✓ {L('Checked in on site', 'سجّل الحضور في الموقع')}</span>
                    : <span className="status st-bad">▲ {L('Checked in outside the geofence', 'سجّل الحضور خارج النطاق')}</span>}</span>
                </div>
                <p dir="auto">{e.task_summary}</p>
                <p className="muted small mono">{e.codes.join(' · ')}</p>
                {e.media.some((m) => m.mediaId) && (
                  <div className="evidence-strip">
                    {e.media.filter((m) => m.mediaId).map((m) => m.type === 'video'
                      ? <video key={m.mediaId} src={`/api/v1/media/${m.mediaId}`} controls preload="none" />
                      : <a key={m.mediaId} href={`/api/v1/media/${m.mediaId}`} target="_blank" rel="noreferrer" title={new Date(m.captured_at).toLocaleString('en-GB')}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/v1/media/${m.mediaId}`} alt={L('Evidence photo', 'صورة دليل')} loading="lazy" /></a>)}
                  </div>
                )}
                <form action={decide} className="entry-actions">
                  <input type="hidden" name="entry" value={e.id} />
                  <label className="field"><span>{L('Rating', 'التقييم')}</span>
                    <select name="rating" defaultValue="4">{[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{'★'.repeat(r)}</option>)}</select></label>
                  <label className="field" style={{ flex: 1, minWidth: 200 }}><span>{L('Comment', 'تعليق')}</span><textarea name="comment" rows={1} /></label>
                  <button name="decision" value="approved" className="primary">{L('Approve & sign', 'اعتماد وتوقيع')}</button>
                  <button name="decision" value="revision_requested">{L('Ask for changes', 'طلب تعديل')}</button>
                  <button name="decision" value="rejected" className="ghost danger">{L('Reject', 'رفض')}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="dash-grid">
        <section className="panel">
          <header className="panel-head"><h2>{L('Apprentices on placement', 'المتدربون في الموقع')}</h2></header>
          <table className="data">
            <thead><tr><th>{L('Apprentice', 'المتدرب')}</th><th>{L('Hours', 'الساعات')}</th><th className="num">{L('Check-ins', 'الحضور')}</th></tr></thead>
            <tbody>{placements.map((p) => (
              <tr key={p.id}><td>{ar(p.name, p.name_ar)}<br /><span className="muted small">{p.site} · {L('ends', 'ينتهي')} {date(p.ends_on)}</span></td>
                <td style={{ minWidth: 160 }}><div className="progress"><span className="progress-fill" style={{ width: `${(100 * p.approved_hours) / p.required_hours}%` }} />
                  <span className="progress-pending" style={{ width: `${(100 * p.pending_hours) / p.required_hours}%` }} /></div>
                  <span className="small muted" dir="ltr">{p.approved_hours} / {p.required_hours} h</span></td>
                <td className="num">{p.checkins}{p.outside ? <span className="bad-text"> · {p.outside} ▲</span> : ''}</td></tr>
            ))}</tbody>
          </table>
        </section>
        <section className="panel">
          <header className="panel-head"><h2>{L('Your recent decisions', 'قراراتك الأخيرة')}</h2></header>
          <ul className="entries">{recent.map((r) => (
            <li key={r.id} className="entry">
              <div className="entry-head"><span>{ar(r.name, r.name_ar)} · <span dir="ltr">{date(r.work_date)}</span></span>
                <span className={`status st-${r.decision}`}>{pick(DECISION[r.decision])}{r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}</span></div>
              <span className="hash" dir="ltr">sha256 {r.signature_hash}</span>
            </li>
          ))}</ul>
        </section>
      </div>
    </div>
  );
}
