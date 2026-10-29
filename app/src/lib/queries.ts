import 'server-only';
import { q, q1 } from './db';

export type Level = 'not_yet' | 'novice' | 'intermediate' | 'autonomous' | 'master';
export const LEVELS: Level[] = ['not_yet', 'novice', 'intermediate', 'autonomous', 'master'];

export interface LearnerRow { id: string; name: string; name_ar: string | null; email: string; badge: string | null }

export async function learner(id: string, institutionId: string) {
  return q1<LearnerRow & { cohort: string | null; cohort_ar: string | null }>(
    `SELECT u.id, u.full_name AS name, u.full_name_ar AS name_ar, u.email::text AS email, u.safety_badge_uid AS badge,
            c.name AS cohort, c.name_ar AS cohort_ar
       FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
       LEFT JOIN cohort_members m ON m.user_id = u.id LEFT JOIN cohorts c ON c.id = m.cohort_id
      WHERE u.id = $1 AND u.institution_id = $2`, [id, institutionId]);
}

export interface CompetencyRow {
  unit_code: string; unit_title: string; unit_title_ar: string | null; framework: string;
  code: string; title: string; title_ar: string | null; is_safety_critical: boolean;
  level: Level; score: number | null; evidence_count: number; last_assessed_at: Date | null; verified: boolean;
}

/**
 * Every element of the learner's trade frameworks (all frameworks when they have
 * no trade), plus any other element they hold evidence for, with their level.
 */
export async function competencyProfile(learnerId: string) {
  return q<CompetencyRow>(
    `SELECT u.code AS unit_code, u.title AS unit_title, u.title_ar AS unit_title_ar, f.code AS framework,
            e.code, e.title, e.title_ar, e.is_safety_critical,
            COALESCE(lc.level, 'not_yet') AS level, lc.score::float AS score, COALESCE(lc.evidence_count, 0) AS evidence_count,
            lc.last_assessed_at, lc.verified_by IS NOT NULL AS verified
       FROM competencies e
       JOIN competencies u ON u.id = e.parent_id
       JOIN competency_frameworks f ON f.id = e.framework_id
       LEFT JOIN learner_competencies lc ON lc.competency_id = e.id AND lc.learner_id = $1
      WHERE e.kind = 'element'
        AND (lc.learner_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM v_user_trades WHERE user_id = $1)
             OR f.trade_id IN (SELECT trade_id FROM v_user_trades WHERE user_id = $1))
      ORDER BY f.code, u.code, e.code`, [learnerId]);
}

export interface AssessmentRow {
  kind: 'vlab_session' | 'workshop_observation' | 'quiz';
  id: string; title: string; title_ar: string | null; mode: string | null;
  score: number; passed: boolean; gate_failures: string[]; at: Date; assessor: string | null; assessor_ar: string | null;
}

export async function assessments(learnerId: string, limit = 20) {
  return q<AssessmentRow>(
    `SELECT e.subject_type AS kind, e.subject_id AS id,
            COALESCE(l.title, r.title) AS title, l.title_ar, s.mode::text AS mode,
            e.total_score::float AS score, e.passed, e.gate_failures, e.evaluated_at AS at,
            ev.full_name AS assessor, ev.full_name_ar AS assessor_ar
       FROM rubric_evaluations e
       JOIN rubrics r ON r.id = e.rubric_id
       LEFT JOIN virtual_lab_sessions s ON e.subject_type = 'vlab_session' AND s.id = e.subject_id
       LEFT JOIN virtual_labs l ON l.id = s.lab_id
       LEFT JOIN users ev ON ev.id = e.evaluator_id
      WHERE e.learner_id = $1
      ORDER BY e.evaluated_at DESC LIMIT $2`, [learnerId, limit]);
}

export async function wblProgress(learnerId: string) {
  return q1<{ placement_id: string; employer: string; site: string; supervisor: string; supervisor_ar: string | null;
    required_hours: number; approved_hours: number; pending_hours: number; starts_on: Date; ends_on: Date; pending_entries: number }>(
    `SELECT p.id AS placement_id, em.name AS employer, es.name AS site, su.full_name AS supervisor, su.full_name_ar AS supervisor_ar,
            p.required_hours, v.approved_hours::float, v.pending_hours::float, p.starts_on, p.ends_on,
            (SELECT count(*)::int FROM wbl_logbook_entries e WHERE e.placement_id = p.id AND e.status = 'submitted') AS pending_entries
       FROM wbl_placements p
       JOIN v_wbl_hours_progress v ON v.placement_id = p.id
       JOIN employer_sites es ON es.id = p.site_id JOIN employers em ON em.id = es.employer_id
       JOIN users su ON su.id = p.supervisor_id
      WHERE p.learner_id = $1 ORDER BY p.starts_on DESC LIMIT 1`, [learnerId]);
}

export async function credentials(learnerId: string) {
  return q<{ code: string; title: string; issued_at: Date }>(
    `SELECT m.code, m.title, c.issued_at FROM learner_credentials c JOIN micro_credentials m ON m.id = c.credential_id
      WHERE c.learner_id = $1 ORDER BY c.issued_at DESC`, [learnerId]);
}

/** Learners of the institution, of one trade unless `trade` is null. */
export async function cohortLearners(institutionId: string, trade: string | null = null) {
  return q<LearnerRow & { cohort: string; cohort_ar: string | null; competent: number; elements: number; last_score: number | null; open_alerts: number }>(
    `SELECT u.id, u.full_name AS name, u.full_name_ar AS name_ar, u.email::text AS email, u.safety_badge_uid AS badge,
            c.name AS cohort, c.name_ar AS cohort_ar,
            (SELECT count(*)::int FROM learner_competencies lc WHERE lc.learner_id = u.id AND lc.level IN ('autonomous', 'master')) AS competent,
            (SELECT count(*)::int FROM competencies k JOIN competency_frameworks f ON f.id = k.framework_id
              WHERE k.kind = 'element' AND (c.trade_id IS NULL OR f.trade_id = c.trade_id)) AS elements,
            (SELECT e.total_score::float FROM rubric_evaluations e WHERE e.learner_id = u.id ORDER BY e.evaluated_at DESC LIMIT 1) AS last_score,
            (SELECT count(*)::int FROM safety_alerts a WHERE a.learner_id = u.id AND a.resolved_at IS NULL) AS open_alerts
       FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
       JOIN cohort_members m ON m.user_id = u.id JOIN cohorts c ON c.id = m.cohort_id
      WHERE u.institution_id = $1 AND ($2::text IS NULL OR c.trade_id = $2)
      ORDER BY u.full_name`, [institutionId, trade]);
}
