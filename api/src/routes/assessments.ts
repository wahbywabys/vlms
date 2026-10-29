/**
 * Theory and technical assessment
 *
 *   POST /v1/assessments                 start a sitting: serve the learner's items
 *   POST /v1/assessments/:id/submit      grade every served item on the server
 *   POST /v1/questions/preview           (teacher) lint a parameterised item and show sample instances
 *
 * Item types served:
 *   mcq          options, key withheld
 *   calculation  fixed numbers, absolute/relative tolerance
 *   parametric   a calculation with variables: each learner gets their own
 *                values (and tolerance band) from question_instances
 *   hotspot      a schematic; the learner drops pins on the fault(s)
 *
 * Answer keys, instance answers and hotspot regions never leave the server
 * before submission. Each graded item is a question_attempt and appends
 * evidence to the competency it assesses.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { isStaff } from '../lib/auth.js';
import { withTx, type Db, type Tx } from '../lib/db.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { gradeHotspots, type Hotspot } from '../services/hotspotGrader.js';
import { grade, instantiate, lint, seedFor, type ParametricBody, type ParamSpec } from '../services/paramEngine.js';

interface ItemRow {
  id: string; version: number; type: string; stem: string; body: Record<string, unknown>; answer_key: { correct?: string; value?: number };
  abs_tolerance: number | null; rel_tolerance: number | null; max_points: number; code: string | null; competency_ids: string[];
  params: ParamSpec[] | null;
}

const ITEM_SQL = `
  SELECT qn.id, v.version, qn.type::text AS type, v.stem, v.body, v.answer_key, v.abs_tolerance::float, v.rel_tolerance::float, v.max_points::float,
         (SELECT c.code FROM question_competencies qc JOIN competencies c ON c.id = qc.competency_id WHERE qc.question_id = qn.id ORDER BY c.code LIMIT 1) AS code,
         ARRAY(SELECT qc.competency_id FROM question_competencies qc WHERE qc.question_id = qn.id) AS competency_ids,
         (SELECT jsonb_agg(jsonb_build_object('name', p.name, 'min', p.min_value::float, 'max', p.max_value::float, 'step', p.step::float,
                                              'unit', p.unit, 'choices', p.choices) ORDER BY p.name)
            FROM question_parameters p WHERE p.question_id = qn.id AND p.version = v.version) AS params
    FROM questions qn JOIN question_versions v ON v.question_id = qn.id AND v.version = qn.current_version`;

const isParametric = (r: ItemRow) => r.type === 'calculation' && typeof r.body['answer_expr'] === 'string';

async function hotspotsFor(tx: Tx | Db, r: ItemRow) {
  const { rows } = await tx.query<{ key: string; role: 'target' | 'distractor'; shape: Hotspot['shape']; geometry: Record<string, unknown>; tolerance: number;
    points: number; label: string | null; label_ar: string | null; feedback: { en: string; ar: string } | null; schematic_id: string }>(
    `SELECT key, role, shape, geometry, tolerance::float, points::float, label, label_ar, feedback, schematic_id
       FROM schematic_hotspots WHERE question_id = $1 AND version = $2 ORDER BY key`, [r.id, r.version]);
  const spots = rows.map((h) => ({ key: h.key, role: h.role, shape: h.shape, ...h.geometry, tolerance: h.tolerance, credit: h.points,
    label: h.label ?? h.key, labelAr: h.label_ar, feedback: h.feedback ?? undefined } as Hotspot & { labelAr: string | null }));
  const sch = rows[0] ? (await tx.query<{ code: string; title: string; title_ar: string | null; kind: string; view_box: string; svg: string | null }>(
    `SELECT code, title, title_ar, kind, view_box, svg FROM schematics WHERE id = $1`, [rows[0].schematic_id])).rows[0] : undefined;
  return { spots, schematic: sch };
}

export function assessmentsRouter(deps: { db: Db }) {
  const router = Router();

  const Start = z.object({ trade: z.string().max(24).optional(), limit: z.number().int().min(1).max(30).default(12) });
  router.post('/v1/assessments', async (req: Request, res) => {
    const p = req.principal!;
    if (!p.roles.includes('student')) throw forbidden('Only learners sit assessments');
    const body = Start.parse(req.body ?? {});
    const out = await withTx(deps.db, async (tx) => {
      const trade = body.trade ?? (await tx.query<{ trade_id: string }>(`SELECT trade_id FROM v_user_trades WHERE user_id = $1 LIMIT 1`, [p.userId])).rows[0]?.trade_id ?? null;
      const { rows } = await tx.query<ItemRow>(
        `${ITEM_SQL}
          WHERE qn.institution_id = $1 AND qn.status = 'approved' AND qn.type IN ('mcq', 'calculation', 'hotspot')
            AND ($2::text IS NULL OR NOT EXISTS (SELECT 1 FROM question_competencies qc WHERE qc.question_id = qn.id)
                 OR EXISTS (SELECT 1 FROM question_competencies qc JOIN competencies c ON c.id = qc.competency_id
                            JOIN competency_frameworks f ON f.id = c.framework_id WHERE qc.question_id = qn.id AND f.trade_id = $2))
          ORDER BY qn.type = 'hotspot', (v.body ? 'answer_expr'), qn.bloom, qn.created_at
          LIMIT $3`, [p.institutionId, trade, body.limit]);
      const sess = await tx.query<{ id: string }>(
        `INSERT INTO assessment_sessions (learner_id, trade_id, question_ids) VALUES ($1, $2, $3) RETURNING id`,
        [p.userId, trade, rows.map((r) => r.id)]);
      const assessmentId = sess.rows[0]!.id;
      const items = [];
      for (const r of rows) {
        const base = { id: r.id, code: r.code ?? '', maxPoints: r.max_points, stem: r.stem, stemAr: (r.body['stem_ar'] as string) ?? null };
        if (r.type === 'mcq') items.push({ ...base, type: 'mcq', options: r.body['options'] ?? [] });
        else if (isParametric(r)) {
          const b = r.body as unknown as ParametricBody;
          const seed = seedFor(r.id, r.version, p.userId, assessmentId);
          const inst = instantiate(b, r.params ?? [], seed, { abs: r.abs_tolerance, rel: r.rel_tolerance });
          await tx.query(
            `INSERT INTO question_instances (question_id, version, learner_id, assessment_id, seed, parameter_values, rendered_stem, rendered_stem_ar,
                                             answer_value, abs_tolerance, rel_tolerance)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [r.id, r.version, p.userId, assessmentId, seed, inst.values, inst.stem, inst.stemAr, inst.answer, inst.absTol, inst.relTol]);
          items.push({ ...base, type: 'parametric', stem: inst.stem, stemAr: inst.stemAr, unit: inst.unit, decimals: b.answer_decimals ?? null, values: inst.values });
        } else if (r.type === 'calculation') items.push({ ...base, type: 'calculation', unit: (r.body['unit'] as string) ?? null });
        else {
          const { spots, schematic } = await hotspotsFor(tx, r);
          items.push({ ...base, type: 'hotspot', maxPins: (r.body['max_pins'] as number) ?? spots.filter((s) => s.role === 'target').length + 1,
            targets: spots.filter((s) => s.role === 'target').length,
            schematic: schematic ? { code: schematic.code, title: schematic.title, titleAr: schematic.title_ar, kind: schematic.kind, viewBox: schematic.view_box, svg: schematic.svg } : null });
        }
      }
      return { assessmentId, trade, items };
    });
    res.status(201).json(out);
  });

  const Pin = z.object({ x: z.number().finite(), y: z.number().finite() });
  const Submit = z.object({ responses: z.record(z.union([z.string().max(64), z.object({ pins: z.array(Pin).max(10) })])) });
  router.post('/v1/assessments/:id/submit', async (req: Request, res) => {
    const p = req.principal!;
    const id = z.string().uuid().parse(req.params['id']);
    const { responses } = Submit.parse(req.body);
    const out = await withTx(deps.db, async (tx) => {
      const s = (await tx.query<{ learner_id: string; question_ids: string[]; submitted_at: Date | null }>(
        `SELECT learner_id, question_ids, submitted_at FROM assessment_sessions WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!s || s.learner_id !== p.userId) throw notFound('Assessment');
      if (s.submitted_at) throw conflict('already_submitted', 'This assessment was already submitted');
      const { rows } = await tx.query<ItemRow>(`${ITEM_SQL} WHERE qn.id = ANY($1::uuid[])`, [s.question_ids]);
      let score = 0, max = 0;
      const results = [];
      for (const r of rows) {
        const resp = responses[r.id];
        let correct = false, points = 0;
        let detail: Record<string, unknown> = {};
        if (r.type === 'mcq') {
          correct = typeof resp === 'string' && resp === r.answer_key.correct;
          detail = { key: r.answer_key.correct, given: resp ?? null };
        } else if (isParametric(r)) {
          const inst = (await tx.query<{ id: string; answer_value: number; abs_tolerance: number | null; rel_tolerance: number | null; parameter_values: Record<string, number> }>(
            `SELECT id, answer_value::float, abs_tolerance::float, rel_tolerance::float, parameter_values FROM question_instances
              WHERE question_id = $1 AND learner_id = $2 AND assessment_id = $3`, [r.id, p.userId, id])).rows[0];
          if (!inst) continue;
          const g = grade({ answer: inst.answer_value, absTol: inst.abs_tolerance, relTol: inst.rel_tolerance }, typeof resp === 'string' ? resp : null);
          correct = g.correct;
          detail = { key: Math.round(g.expected * 1e6) / 1e6, band: g.band, given: g.given, deviation: g.deviation, values: inst.parameter_values, instanceId: inst.id };
        } else if (r.type === 'calculation') {
          const g = grade({ answer: r.answer_key.value ?? NaN, absTol: r.abs_tolerance, relTol: r.rel_tolerance }, typeof resp === 'string' ? resp : null);
          correct = g.correct;
          detail = { key: r.answer_key.value, band: g.band, given: g.given };
        } else {
          const { spots } = await hotspotsFor(tx, r);
          const pins = typeof resp === 'object' && resp ? resp.pins : [];
          const g = gradeHotspots(spots, pins, { maxPins: r.body['max_pins'] as number | undefined, extraPinPenalty: (r.body['extra_pin_penalty'] as number) ?? 0.5 });
          correct = g.correct;
          points = r.max_points * (g.maxScore ? g.score / g.maxScore : 0);
          detail = { ...g, pins, regions: spots.map((sp) => ({ ...sp })) };
        }
        if (r.type !== 'hotspot') points = correct ? r.max_points : 0;
        points = Math.round(points * 100) / 100;
        score += points; max += r.max_points;
        const at = await tx.query<{ id: string }>(
          `INSERT INTO question_attempts (question_id, version, learner_id, assessment_id, parameter_values, response, points_awarded, is_correct)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [r.id, r.version, p.userId, id, (detail['values'] as object) ?? {}, { answer: resp ?? null }, points, correct]);
        if (detail['instanceId']) await tx.query(`UPDATE question_instances SET attempt_id = $2 WHERE id = $1`, [detail['instanceId'], at.rows[0]!.id]);
        for (const c of r.competency_ids) {
          await tx.query(
            `INSERT INTO competency_evidence (learner_id, competency_id, source_type, source_id, score) VALUES ($1, $2, 'question_attempt', $3, $4)`,
            [p.userId, c, at.rows[0]!.id, r.max_points ? Math.round((100 * points) / r.max_points) : 0]);
        }
        results.push({ id: r.id, type: isParametric(r) ? 'parametric' : r.type, correct, points, maxPoints: r.max_points, ...detail });
      }
      await tx.query(`UPDATE assessment_sessions SET submitted_at = now(), score = $2, max_score = $3 WHERE id = $1`, [id, score, max]);
      return { assessmentId: id, score: Math.round(score * 100) / 100, max, items: results };
    });
    res.json(out);
  });

  const Preview = z.object({
    body: z.object({ template: z.string().min(5).max(2000), template_ar: z.string().max(2000).optional(), answer_expr: z.string().min(1).max(500),
      unit: z.string().max(12).optional(), derived: z.record(z.string().max(300)).optional(), constraint: z.string().max(300).optional(),
      abs_tol_expr: z.string().max(300).optional(), answer_decimals: z.number().int().min(0).max(6).optional() }),
    params: z.array(z.object({ name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,15}$/), min: z.number(), max: z.number(), step: z.number().positive(),
      unit: z.string().max(12).nullish(), choices: z.array(z.number()).max(20).nullish() })).max(12),
    absTol: z.number().min(0).nullish(), relTol: z.number().min(0).max(1).nullish(),
  });
  router.post('/v1/questions/preview', (req: Request, res) => {
    if (!isStaff(req.principal!)) throw forbidden();
    const b = Preview.parse(req.body);
    const issues = lint(b.body, b.params);
    const samples = issues.length ? [] : [11, 22, 33].map((sd) => {
      const i = instantiate(b.body, b.params, sd, { abs: b.absTol, rel: b.relTol });
      return { stem: i.stem, stemAr: i.stemAr, values: i.values, answer: Math.round(i.answer * 1e6) / 1e6, band: Math.max(i.absTol ?? 0, Math.abs(i.answer) * (i.relTol ?? 0)) };
    });
    res.json({ ok: issues.length === 0, issues, samples });
  });

  return router;
}
