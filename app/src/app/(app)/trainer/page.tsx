import { requireRole } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { Floor, type FloorStation, type ObsCriterion } from './Floor';

export const metadata = { title: 'Workshop floor' };
export const dynamic = 'force-dynamic';

export default async function TrainerFloorPage() {
  const s = await requireRole('vocational_trainer');
  const bay = await q1<{ name: string; name_ar: string | null; cohort: string; cohort_ar: string | null }>(
    `SELECT w.name, w.name_ar, c.name AS cohort, c.name_ar AS cohort_ar
       FROM workshops w, cohorts c JOIN cohort_members m ON m.cohort_id = c.id AND m.user_id = $2
      WHERE w.institution_id = $1 AND w.name = 'CNC Bay 2' LIMIT 1`, [s.institutionId, s.userId]);

  // One station per learner in the trainer's cohort: their lathe (open checkout),
  // today's signed-off observation, and whether a safety alert is open.
  const stations = await q<FloorStation>(
    `SELECT u.id AS "learnerId", u.full_name AS name, u.full_name_ar AS "nameAr",
            a.asset_tag AS "assetTag", denied.denial_reason AS "denied",
            ev.total_score::float AS score, ev.passed,
            (SELECT count(*)::int FROM safety_alerts sa WHERE sa.learner_id = u.id AND sa.resolved_at IS NULL) AS "openAlerts"
       FROM cohort_members me
       JOIN cohort_members m ON m.cohort_id = me.cohort_id AND m.member_role = 'student'
       JOIN users u ON u.id = m.user_id
       LEFT JOIN LATERAL (SELECT wa.asset_tag FROM asset_checkouts ac JOIN workshop_assets wa ON wa.id = ac.asset_id
                           WHERE ac.user_id = u.id AND ac.returned_at IS NULL AND ac.access_granted LIMIT 1) a ON true
       LEFT JOIN LATERAL (SELECT ac.denial_reason FROM asset_checkouts ac
                           WHERE ac.user_id = u.id AND NOT ac.access_granted AND ac.checked_out_at::date = current_date
                           ORDER BY ac.checked_out_at DESC LIMIT 1) denied ON true
       LEFT JOIN LATERAL (SELECT e.total_score, e.passed FROM rubric_evaluations e JOIN rubrics r ON r.id = e.rubric_id
                           WHERE e.learner_id = u.id AND e.subject_type = 'workshop_observation' AND r.code = 'RB-JC-118'
                             AND e.evaluated_at::date = current_date
                           ORDER BY e.evaluated_at DESC LIMIT 1) ev ON true
      WHERE me.user_id = $1
      ORDER BY a.asset_tag NULLS LAST, u.full_name`, [s.userId]);

  const rubric = await q<ObsCriterion>(
    `SELECT c.key, c.label, c.weight::float AS weight, c.is_gate AS "isGate", c.scoring
       FROM rubric_criteria c JOIN rubrics r ON r.id = c.rubric_id
      WHERE r.code = 'RB-JC-118' ORDER BY c.is_gate DESC, c.weight DESC, c.key`);

  const stock = await q<{ name: string; on_hand: number; reorder_point: number; unit: string }>(
    `SELECT c.name, c.on_hand::float, c.reorder_point::float, c.unit FROM consumables c JOIN workshops w ON w.id = c.workshop_id
      WHERE w.institution_id = $1 AND c.on_hand < c.reorder_point ORDER BY c.on_hand / NULLIF(c.reorder_point, 0)`, [s.institutionId]);
  const toolsOut = await q1<{ n: number }>(
    `SELECT count(*)::int AS n FROM asset_checkouts ac JOIN workshop_assets a ON a.id = ac.asset_id
      WHERE ac.returned_at IS NULL AND ac.access_granted AND a.category IN ('tool', 'instrument')`);
  const liveVlab = await q1<{ n: number }>(
    `SELECT count(*)::int AS n FROM virtual_lab_sessions s JOIN users u ON u.id = s.learner_id
      WHERE u.institution_id = $1 AND s.status = 'in_progress' AND s.mode = 'assessment'`, [s.institutionId]);

  return (
    <Floor bay={bay ?? { name: 'Workshop', name_ar: null, cohort: '', cohort_ar: null }} stations={stations} rubric={rubric}
      stock={stock} toolsOut={toolsOut?.n ?? 0} liveExams={liveVlab?.n ?? 0} trainer={{ name: s.name, nameAr: s.nameAr }} />
  );
}
