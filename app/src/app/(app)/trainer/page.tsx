import { requireRole } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';
import { Floor, type FloorStation, type ObsCriterion } from './Floor';

export const metadata = { title: 'Workshop floor' };
export const dynamic = 'force-dynamic';

export default async function TrainerFloorPage() {
  const s = await requireRole('vocational_trainer');
  const trade = await currentTrade(s);
  const { L } = await getI18n();

  // The trade's workshop and the job-card rubric its trainers observe against.
  const bay = await q1<{ id: string; name: string; name_ar: string | null; rubric_code: string; rubric_title: string; rubric_title_ar: string | null }>(
    `SELECT w.id, w.name, w.name_ar, r.code AS rubric_code, r.title AS rubric_title, r.title_ar AS rubric_title_ar
       FROM workshops w JOIN rubrics r ON r.id = w.observation_rubric_id
      WHERE w.institution_id = $1 AND w.trade_id = $2 ORDER BY w.name LIMIT 1`, [s.institutionId, trade]);
  if (!bay) {
    return <div className="floor"><p className="notice">{L('No workshop is set up for this trade yet.', 'لا توجد ورشة مُعدّة لهذا التخصص بعد.')}</p></div>;
  }
  const cohort = await q1<{ cohort: string | null; cohort_ar: string | null }>(
    `SELECT string_agg(c.name, ', ' ORDER BY c.name) AS cohort, string_agg(COALESCE(c.name_ar, c.name), '، ' ORDER BY c.name) AS cohort_ar
       FROM cohorts c JOIN cohort_members m ON m.cohort_id = c.id AND m.user_id = $1 WHERE c.trade_id = $2`, [s.userId, trade]);

  // One station per learner in the trainer's cohorts of this trade: their station
  // (open checkout), today's signed-off observation, and whether a safety alert is open.
  const stations = await q<FloorStation>(
    `SELECT u.id AS "learnerId", u.full_name AS name, u.full_name_ar AS "nameAr",
            a.asset_tag AS "assetTag", denied.denial_reason AS "denied",
            ev.total_score::float AS score, ev.passed,
            (SELECT count(*)::int FROM safety_alerts sa WHERE sa.learner_id = u.id AND sa.resolved_at IS NULL) AS "openAlerts"
       FROM cohort_members me
       JOIN cohorts c ON c.id = me.cohort_id AND c.trade_id = $2
       JOIN cohort_members m ON m.cohort_id = me.cohort_id AND m.member_role = 'student'
       JOIN users u ON u.id = m.user_id
       LEFT JOIN LATERAL (SELECT wa.asset_tag FROM asset_checkouts ac JOIN workshop_assets wa ON wa.id = ac.asset_id
                           WHERE ac.user_id = u.id AND ac.returned_at IS NULL AND ac.access_granted LIMIT 1) a ON true
       LEFT JOIN LATERAL (SELECT ac.denial_reason FROM asset_checkouts ac
                           WHERE ac.user_id = u.id AND NOT ac.access_granted AND ac.checked_out_at::date = current_date
                           ORDER BY ac.checked_out_at DESC LIMIT 1) denied ON true
       LEFT JOIN LATERAL (SELECT e.total_score, e.passed FROM rubric_evaluations e JOIN rubrics r ON r.id = e.rubric_id
                           WHERE e.learner_id = u.id AND e.subject_type = 'workshop_observation' AND r.code = $3
                             AND e.evaluated_at::date = current_date
                           ORDER BY e.evaluated_at DESC LIMIT 1) ev ON true
      WHERE me.user_id = $1
      ORDER BY a.asset_tag NULLS LAST, u.full_name`, [s.userId, trade, bay.rubric_code]);

  const rubric = await q<ObsCriterion>(
    `SELECT c.key, c.label, c.label_ar AS "labelAr", c.weight::float AS weight, c.is_gate AS "isGate", c.scoring
       FROM rubric_criteria c JOIN rubrics r ON r.id = c.rubric_id
      WHERE r.code = $1 ORDER BY c.is_gate DESC, c.weight DESC, c.key`, [bay.rubric_code]);

  const stock = await q<{ name: string; on_hand: number; reorder_point: number; unit: string }>(
    `SELECT name, on_hand::float, reorder_point::float, unit FROM consumables
      WHERE workshop_id = $1 AND on_hand < reorder_point ORDER BY on_hand / NULLIF(reorder_point, 0)`, [bay.id]);
  const toolsOut = await q1<{ n: number }>(
    `SELECT count(*)::int AS n FROM asset_checkouts ac JOIN workshop_assets a ON a.id = ac.asset_id
      WHERE a.workshop_id = $1 AND ac.returned_at IS NULL AND ac.access_granted AND a.category IN ('tool', 'instrument')`, [bay.id]);
  const lab = await q1<{ title: string; title_ar: string | null; live: number }>(
    `SELECT l.title, l.title_ar,
            (SELECT count(*)::int FROM virtual_lab_sessions s JOIN users u ON u.id = s.learner_id
              WHERE s.lab_id = l.id AND u.institution_id = $1 AND s.status = 'in_progress' AND s.mode = 'assessment') AS live
       FROM virtual_labs l WHERE l.trade_id = $2 ORDER BY l.code LIMIT 1`, [s.institutionId, trade]);

  const jobCode = bay.rubric_code.replace(/^RB-/, '');
  const strip = (t: string | null) => t?.replace(new RegExp(`^${jobCode}\\s+`), '') ?? null;
  return (
    <Floor key={trade} bay={{ name: bay.name, name_ar: bay.name_ar, cohort: cohort?.cohort ?? '', cohort_ar: cohort?.cohort_ar ?? null }}
      job={{ rubricCode: bay.rubric_code, code: jobCode, task: strip(bay.rubric_title) ?? '', taskAr: strip(bay.rubric_title_ar) }}
      stations={stations} rubric={rubric} stock={stock} toolsOut={toolsOut?.n ?? 0}
      lab={lab ? { title: lab.title, titleAr: lab.title_ar } : null} liveExams={lab?.live ?? 0}
      trainer={{ name: s.name, nameAr: s.nameAr }} />
  );
}
