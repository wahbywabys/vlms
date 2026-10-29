'use server';
import { randomUUID } from 'node:crypto';
import { requireRole } from '@/lib/auth';
import { db, q } from '@/lib/db';

export interface QuizResult { score: number; max: number; items: { id: string; correct: boolean; key: string | number; given: string }[] }

/**
 * Grades a theory quiz on the server against the withheld answer keys,
 * stores each attempt against the exact question version, and appends
 * question_attempt evidence to the learner's competency ledger.
 */
export async function gradeQuiz(_prev: QuizResult | null, form: FormData): Promise<QuizResult> {
  const s = await requireRole('student');
  const ids = String(form.get('ids') ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const items = await q<{ id: string; version: number; type: string; answer_key: { correct?: string; value?: number }; abs_tolerance: number | null; max_points: number; competency_ids: string[] }>(
    `SELECT qn.id, v.version, qn.type::text AS type, v.answer_key, v.abs_tolerance::float, v.max_points::float,
            ARRAY(SELECT qc.competency_id FROM question_competencies qc WHERE qc.question_id = qn.id) AS competency_ids
       FROM questions qn JOIN question_versions v ON v.question_id = qn.id AND v.version = qn.current_version
      WHERE qn.id = ANY($1::uuid[]) AND qn.status = 'approved' AND qn.institution_id = $2`, [ids, s.institutionId]);
  const quizId = randomUUID();
  const out: QuizResult = { score: 0, max: 0, items: [] };
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const it of items) {
      const given = String(form.get(`q_${it.id}`) ?? '').trim();
      let correct = false;
      if (it.type === 'calculation') {
        const v = Number(given.replace(',', '.').replace('٫', '.'));
        correct = given !== '' && Number.isFinite(v) && Math.abs(v - (it.answer_key.value ?? NaN)) <= (it.abs_tolerance ?? 0) + 1e-9;
      } else correct = given === it.answer_key.correct;
      const points = correct ? it.max_points : 0;
      out.score += points; out.max += it.max_points;
      out.items.push({ id: it.id, correct, key: it.answer_key.correct ?? it.answer_key.value ?? '', given });
      await client.query(
        `INSERT INTO question_attempts (question_id, version, learner_id, assessment_id, response, points_awarded, is_correct)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [it.id, it.version, s.userId, quizId, { answer: given }, points, correct]);
      for (const c of it.competency_ids) {
        await client.query(
          `INSERT INTO competency_evidence (learner_id, competency_id, source_type, source_id, score) VALUES ($1, $2, 'question_attempt', $3, $4)`,
          [s.userId, c, quizId, correct ? 100 : 0]);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return out;
}
