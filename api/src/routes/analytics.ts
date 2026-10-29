/**
 * Analytics for trainers and the executive dashboard
 *
 *   GET  /v1/analytics/early-warning?trade=&cohort=   learners ranked by risk, with reasons
 *   POST /v1/analytics/early-warning/:id/ack          a trainer records the action taken
 *   GET  /v1/analytics/skills?trade=&cohort=          cohort × unit level matrix (heatmap)
 *   GET  /v1/analytics/skills/learners/:id            one learner's radar and level history
 *
 * Early warning reads v_learner_signals (floor rubrics, V-Lab sessions and
 * safety alerts, quizzes, class attendance, OJT hours) and scores it with
 * services/riskModel.ts. Each run stores one snapshot per learner per day,
 * so the inputs are kept for refitting the model on real outcomes.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { isStaff, type Principal } from '../lib/auth.js';
import type { Db } from '../lib/db.js';
import { forbidden, notFound } from '../lib/errors.js';
import { assess, explain, MODEL_VERSION, type Signals } from '../services/riskModel.js';

const canSeeAll = (p: Principal) => isStaff(p) || p.roles.includes('director');
const Filter = z.object({ trade: z.string().max(24).optional(), cohort: z.string().uuid().optional() });

interface SignalRow {
  learner_id: string; full_name: string; full_name_ar: string | null; cohort_id: string; cohort: string; cohort_ar: string | null; trade_id: string;
  final_practical_on: Date | null; attendance_rate: number | null; floor_avg: number | null; floor_trend: number | null; gate_fails: number | null;
  vlab_pass_rate: number | null; safety_violations: number | null; quiz_pct: number | null; ojt_pace: number | null; days_inactive: number | null;
}

export function analyticsRouter(deps: { db: Db }) {
  const router = Router();

  router.get('/v1/analytics/early-warning', async (req: Request, res) => {
    const p = req.principal!;
    if (!canSeeAll(p)) throw forbidden();
    const f = Filter.parse(req.query);
    const { rows } = await deps.db.query<SignalRow>(
      `SELECT s.*, u.full_name, u.full_name_ar, c.name AS cohort, c.name_ar AS cohort_ar
         FROM v_learner_signals s JOIN users u ON u.id = s.learner_id JOIN cohorts c ON c.id = s.cohort_id
        WHERE s.institution_id = $1 AND ($2::text IS NULL OR s.trade_id = $2) AND ($3::uuid IS NULL OR s.cohort_id = $3)
          AND ($4 OR EXISTS (SELECT 1 FROM cohort_members me WHERE me.cohort_id = s.cohort_id AND me.user_id = $5))`,
      [p.institutionId, f.trade ?? null, f.cohort ?? null, p.roles.includes('director'), p.userId]);

    const learners = [];
    for (const r of rows) {
      const daysToFinal = r.final_practical_on ? Math.ceil((new Date(r.final_practical_on).getTime() - Date.now()) / 86400_000) : null;
      const signals: Signals = {
        attendanceRate: r.attendance_rate, floorAvg: r.floor_avg, floorTrend: r.floor_trend, gateFails: r.gate_fails,
        vlabPassRate: r.vlab_pass_rate, safetyViolations: r.safety_violations, quizPct: r.quiz_pct, ojtPace: r.ojt_pace,
        daysInactive: r.days_inactive, daysToFinal,
      };
      const risk = assess(signals);
      const snap = await deps.db.query<{ id: string; acknowledged_by: string | null; action_note: string | null }>(
        `INSERT INTO risk_snapshots (learner_id, probability, band, signals, factors, model_version) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (learner_id, computed_on, model_version)
           DO UPDATE SET probability = EXCLUDED.probability, band = EXCLUDED.band, signals = EXCLUDED.signals, factors = EXCLUDED.factors
         RETURNING id, acknowledged_by, action_note`,
        [r.learner_id, risk.probability, risk.band, signals, JSON.stringify(risk.factors), MODEL_VERSION]);
      learners.push({
        learnerId: r.learner_id, name: r.full_name, nameAr: r.full_name_ar, cohortId: r.cohort_id, cohort: r.cohort, cohortAr: r.cohort_ar, tradeId: r.trade_id,
        daysToFinal, signals, ...risk, reasons: risk.factors.slice(0, 3).map(explain),
        snapshotId: snap.rows[0]!.id, acknowledged: Boolean(snap.rows[0]!.acknowledged_by), actionNote: snap.rows[0]!.action_note,
      });
    }
    learners.sort((a, b) => b.probability - a.probability);
    const trend = await deps.db.query(
      `SELECT computed_on AS day, count(*) FILTER (WHERE band = 'high')::int AS high, count(*) FILTER (WHERE band = 'watch')::int AS watch
         FROM risk_snapshots rs JOIN users u ON u.id = rs.learner_id
        WHERE u.institution_id = $1 AND computed_on >= current_date - 28 AND rs.learner_id = ANY($2::uuid[])
        GROUP BY computed_on ORDER BY computed_on`, [p.institutionId, rows.map((r) => r.learner_id)]);
    res.json({ model: MODEL_VERSION, learners, trend: trend.rows });
  });

  const Ack = z.object({ note: z.string().trim().min(3).max(500) });
  router.post('/v1/analytics/early-warning/:id/ack', async (req: Request, res) => {
    const p = req.principal!;
    if (!isStaff(p)) throw forbidden();
    const id = z.string().uuid().parse(req.params['id']);
    const { note } = Ack.parse(req.body);
    const { rowCount } = await deps.db.query(
      `UPDATE risk_snapshots rs SET acknowledged_by = $2, action_note = $3 FROM users u
        WHERE rs.id = $1 AND u.id = rs.learner_id AND u.institution_id = $4`, [id, p.userId, note, p.institutionId]);
    if (!rowCount) throw notFound('Snapshot');
    res.json({ id, acknowledged: true });
  });

  router.get('/v1/analytics/skills', async (req: Request, res) => {
    const p = req.principal!;
    if (!canSeeAll(p)) throw forbidden();
    const f = Filter.parse(req.query);
    const { rows } = await deps.db.query(
      `SELECT h.cohort_id AS "cohortId", c.name AS cohort, c.name_ar AS "cohortAr", h.trade_id AS "tradeId", h.competency_id AS "competencyId",
              h.code, h.title, h.title_ar AS "titleAr", h.unit_code AS "unitCode", h.unit_title AS "unitTitle", h.unit_title_ar AS "unitTitleAr", h.not_yet::int AS "notYet", h.novice::int, h.intermediate::int, h.autonomous::int,
              h.master::int, h.learners::int, h.mean_level AS "meanLevel"
         FROM v_skills_heatmap h JOIN cohorts c ON c.id = h.cohort_id
        WHERE c.institution_id = $1 AND ($2::text IS NULL OR h.trade_id = $2) AND ($3::uuid IS NULL OR h.cohort_id = $3)
        ORDER BY c.name, h.code`, [p.institutionId, f.trade ?? null, f.cohort ?? null]);
    // Learner × unit grid for the selected scope (rows of the heatmap).
    const grid = await deps.db.query(
      `SELECT u.id AS "learnerId", u.full_name AS name, u.full_name_ar AS "nameAr", c.id AS "cohortId", comp.code,
              COALESCE(lc.level::text, 'not_yet') AS level, lc.score::float AS score
         FROM cohorts c JOIN cohort_members m ON m.cohort_id = c.id AND m.member_role = 'student' JOIN users u ON u.id = m.user_id
         JOIN competency_frameworks fw ON fw.trade_id = c.trade_id JOIN competencies comp ON comp.framework_id = fw.id AND comp.kind = 'element'
         LEFT JOIN learner_competencies lc ON lc.learner_id = u.id AND lc.competency_id = comp.id
        WHERE c.institution_id = $1 AND ($2::text IS NULL OR c.trade_id = $2) AND ($3::uuid IS NULL OR c.id = $3)
        ORDER BY u.full_name, comp.code`, [p.institutionId, f.trade ?? null, f.cohort ?? null]);
    // Monthly movement: how many learner-units reached each level per week.
    const flow = await deps.db.query(
      `SELECT date_trunc('week', h.changed_at)::date AS week, h.level::text, count(*)::int AS n
         FROM competency_level_history h JOIN users u ON u.id = h.learner_id
         JOIN competencies comp ON comp.id = h.competency_id JOIN competency_frameworks fw ON fw.id = comp.framework_id
        WHERE u.institution_id = $1 AND ($2::text IS NULL OR fw.trade_id = $2) AND h.changed_at >= now() - interval '12 weeks'
        GROUP BY 1, 2 ORDER BY 1`, [p.institutionId, f.trade ?? null]);
    res.json({ units: rows, grid: grid.rows, flow: flow.rows });
  });

  router.get('/v1/analytics/skills/learners/:id', async (req: Request, res) => {
    const p = req.principal!;
    const id = z.string().uuid().parse(req.params['id']);
    if (id !== p.userId && !canSeeAll(p)) throw forbidden();
    const radar = await deps.db.query(
      `SELECT comp.code, comp.title, comp.title_ar AS "titleAr", COALESCE(lc.level::text, 'not_yet') AS level, lc.score::float AS score,
              round(avg(CASE lc2.level WHEN 'not_yet' THEN 0 WHEN 'novice' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'autonomous' THEN 3 WHEN 'master' THEN 4 END), 2)::float AS "cohortMean"
         FROM users u JOIN v_user_trades t ON t.user_id = u.id
         JOIN competency_frameworks fw ON fw.trade_id = t.trade_id JOIN competencies comp ON comp.framework_id = fw.id AND comp.kind = 'element'
         LEFT JOIN learner_competencies lc ON lc.learner_id = u.id AND lc.competency_id = comp.id
         LEFT JOIN cohort_members me ON me.user_id = u.id AND me.member_role = 'student'
         LEFT JOIN cohort_members peers ON peers.cohort_id = me.cohort_id AND peers.member_role = 'student'
         LEFT JOIN learner_competencies lc2 ON lc2.learner_id = peers.user_id AND lc2.competency_id = comp.id
        WHERE u.id = $1 AND u.institution_id = $2
        GROUP BY comp.code, comp.title, comp.title_ar, lc.level, lc.score ORDER BY comp.code`, [id, p.institutionId]);
    const history = await deps.db.query(
      `SELECT comp.code, h.level::text, h.changed_at AS "changedAt" FROM competency_level_history h
         JOIN competencies comp ON comp.id = h.competency_id WHERE h.learner_id = $1 ORDER BY h.changed_at`, [id]);
    res.json({ radar: radar.rows, history: history.rows });
  });

  return router;
}
