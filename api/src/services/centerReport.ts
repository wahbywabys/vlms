/**
 * What a centre reports to the cloud hub besides its activity statements:
 * headline numbers (the same ones the director's dashboard leads with) and a
 * learner roster with each learner's latest early-warning band. Both cover
 * every institution on this server; usually that is one centre.
 *
 * Risk is scored fresh from v_learner_signals with the early-warning model,
 * so the cloud sees it even on days nobody opened the early-warning screen.
 */
import type { Db } from '../lib/db.js';
import { assess } from './riskModel.js';

export interface TradeKpis {
  trade: string; learners: number; floorAvg30d: number | null; vlabPassRate30d: number | null; atRisk: number;
}
export interface CenterKpis {
  institutionId: string; institution: string; code: string; takenAt: string;
  learners: number; staff: number; activeLearners7d: number; vlabSessions7d: number; vlabPassRate30d: number | null;
  floorObservations7d: number; floorAvg30d: number | null; openSafetyAlerts: number; ojtCheckins7d: number;
  risk: { low: number; watch: number; high: number };
  trades: TradeKpis[];
}
export interface RosterRow {
  learnerId: string; institutionId: string; name: string; nameAr: string | null; cohort: string | null; trade: string | null;
  riskBand: string | null; riskProbability: number | null; riskOn: string | null; lastActiveAt: string | null;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

type Band = 'low' | 'watch' | 'high';
/** Today's early-warning band for every learner with signals. */
export async function currentRisk(db: Db): Promise<Map<string, { band: Band; probability: number }>> {
  const { rows } = await db.query(`SELECT * FROM v_learner_signals`);
  const out = new Map<string, { band: Band; probability: number }>();
  for (const r of rows) {
    const daysToFinal = r.final_practical_on ? Math.ceil((new Date(r.final_practical_on).getTime() - Date.now()) / 86400_000) : null;
    const risk = assess({
      attendanceRate: r.attendance_rate, floorAvg: r.floor_avg, floorTrend: r.floor_trend, gateFails: r.gate_fails,
      vlabPassRate: r.vlab_pass_rate, safetyViolations: r.safety_violations, quizPct: r.quiz_pct, ojtPace: r.ojt_pace,
      daysInactive: r.days_inactive, daysToFinal,
    });
    out.set(r.learner_id, { band: risk.band, probability: risk.probability });
  }
  return out;
}

export async function centerKpis(db: Db, risk?: Map<string, { band: Band }>): Promise<CenterKpis[]> {
  risk ??= await currentRisk(db);
  const riskRows = [...risk].map(([id, r]) => ({ id, band: r.band }));
  const { rows } = await db.query(
    `WITH learners AS (
       SELECT DISTINCT u.id, u.institution_id, c.trade_id
         FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
         LEFT JOIN cohort_members m ON m.user_id = u.id LEFT JOIN cohorts c ON c.id = m.cohort_id
        WHERE u.is_active),
     risk AS (
       SELECT (x->>'id')::uuid AS learner_id, x->>'band' AS band FROM jsonb_array_elements($1::jsonb) x),
     evals AS (
       SELECT e.learner_id, e.subject_type, e.total_score, e.passed, e.evaluated_at FROM rubric_evaluations e
        WHERE e.evaluated_at > now() - interval '30 days'),
     active AS (
       SELECT learner_id FROM virtual_lab_sessions WHERE started_at > now() - interval '7 days'
       UNION SELECT learner_id FROM evals WHERE evaluated_at > now() - interval '7 days'
       UNION SELECT pl.learner_id FROM wbl_checkins ci JOIN wbl_placements pl ON pl.id = ci.placement_id WHERE ci.server_time > now() - interval '7 days'
       UNION SELECT learner_id FROM safety_precheck_attempts WHERE submitted_at > now() - interval '7 days')
     SELECT i.id, i.name, i.code,
       (SELECT count(DISTINCT id) FROM learners l WHERE l.institution_id = i.id) AS learners,
       (SELECT count(DISTINCT u.id) FROM users u JOIN user_roles r ON r.user_id = u.id
         WHERE u.institution_id = i.id AND u.is_active AND r.role IN ('vocational_trainer', 'academic_teacher')) AS staff,
       (SELECT count(*) FROM active a JOIN users u ON u.id = a.learner_id WHERE u.institution_id = i.id) AS active7,
       (SELECT count(*) FROM virtual_lab_sessions s JOIN users u ON u.id = s.learner_id
         WHERE u.institution_id = i.id AND s.started_at > now() - interval '7 days') AS vlab7,
       (SELECT round(100.0 * avg(e.passed::int), 1) FROM evals e JOIN users u ON u.id = e.learner_id
         WHERE u.institution_id = i.id AND e.subject_type = 'vlab_session') AS vlab_pass,
       (SELECT count(*) FROM evals e JOIN users u ON u.id = e.learner_id
         WHERE u.institution_id = i.id AND e.subject_type = 'workshop_observation' AND e.evaluated_at > now() - interval '7 days') AS floor7,
       (SELECT round(avg(e.total_score), 1) FROM evals e JOIN users u ON u.id = e.learner_id
         WHERE u.institution_id = i.id AND e.subject_type = 'workshop_observation') AS floor_avg,
       (SELECT count(*) FROM safety_alerts sa WHERE sa.institution_id = i.id AND sa.resolved_at IS NULL) AS alerts,
       (SELECT count(*) FROM wbl_checkins ci JOIN wbl_placements pl ON pl.id = ci.placement_id JOIN users u ON u.id = pl.learner_id
         WHERE u.institution_id = i.id AND ci.server_time > now() - interval '7 days') AS ojt7,
       (SELECT jsonb_object_agg(band, n) FROM (SELECT rk.band, count(*) AS n FROM risk rk JOIN users u ON u.id = rk.learner_id
         WHERE u.institution_id = i.id GROUP BY rk.band) b) AS risk,
       (SELECT coalesce(jsonb_agg(t ORDER BY t.trade), '[]') FROM (
          SELECT l.trade_id AS trade, count(DISTINCT l.id) AS learners,
                 (SELECT round(avg(e.total_score), 1) FROM evals e JOIN learners l2 ON l2.id = e.learner_id
                   WHERE l2.trade_id = l.trade_id AND l2.institution_id = i.id AND e.subject_type = 'workshop_observation') AS "floorAvg30d",
                 (SELECT round(100.0 * avg(e.passed::int), 1) FROM evals e JOIN learners l2 ON l2.id = e.learner_id
                   WHERE l2.trade_id = l.trade_id AND l2.institution_id = i.id AND e.subject_type = 'vlab_session') AS "vlabPassRate30d",
                 count(DISTINCT l.id) FILTER (WHERE rk.band = 'high') AS "atRisk"
            FROM learners l LEFT JOIN risk rk ON rk.learner_id = l.id
           WHERE l.institution_id = i.id AND l.trade_id IS NOT NULL GROUP BY l.trade_id) t) AS trades
     FROM institutions i ORDER BY i.code`, [JSON.stringify(riskRows)]);
  const takenAt = new Date().toISOString();
  return rows.map((r) => ({
    institutionId: r.id, institution: r.name, code: r.code, takenAt,
    learners: Number(r.learners), staff: Number(r.staff), activeLearners7d: Number(r.active7), vlabSessions7d: Number(r.vlab7),
    vlabPassRate30d: num(r.vlab_pass), floorObservations7d: Number(r.floor7), floorAvg30d: num(r.floor_avg),
    openSafetyAlerts: Number(r.alerts), ojtCheckins7d: Number(r.ojt7),
    risk: { low: Number(r.risk?.low ?? 0), watch: Number(r.risk?.watch ?? 0), high: Number(r.risk?.high ?? 0) },
    trades: (r.trades as Record<string, unknown>[]).map((t) => ({
      trade: String(t['trade']), learners: Number(t['learners']), floorAvg30d: num(t['floorAvg30d']),
      vlabPassRate30d: num(t['vlabPassRate30d']), atRisk: Number(t['atRisk']),
    })),
  }));
}

export async function learnerRoster(db: Db, risk?: Map<string, { band: Band; probability: number }>): Promise<RosterRow[]> {
  risk ??= await currentRisk(db);
  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await db.query(
    `SELECT u.id, u.institution_id, u.full_name, u.full_name_ar, c.name AS cohort, c.trade_id,
            greatest((SELECT max(started_at) FROM virtual_lab_sessions s WHERE s.learner_id = u.id),
                     (SELECT max(evaluated_at) FROM rubric_evaluations e WHERE e.learner_id = u.id),
                     (SELECT max(submitted_at) FROM safety_precheck_attempts a WHERE a.learner_id = u.id)) AS last_active
       FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
       LEFT JOIN LATERAL (SELECT c.* FROM cohort_members m JOIN cohorts c ON c.id = m.cohort_id
                           WHERE m.user_id = u.id ORDER BY c.starts_on DESC LIMIT 1) c ON true
      WHERE u.is_active ORDER BY u.full_name`);
  return rows.map((r) => {
    const rk = risk.get(r.id);
    return {
      learnerId: r.id, institutionId: r.institution_id, name: r.full_name, nameAr: r.full_name_ar, cohort: r.cohort, trade: r.trade_id,
      riskBand: rk?.band ?? null, riskProbability: rk ? Number(rk.probability) : null, riskOn: rk ? today : null,
      lastActiveAt: r.last_active ? new Date(r.last_active).toISOString() : null,
    };
  });
}
