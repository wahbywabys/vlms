'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';

const UUID = /^[0-9a-f-]{36}$/;

/** draft → in_review → approved (→ retired). Approval records the human reviewer. */
export async function setQuestionStatus(form: FormData) {
  const s = await requireRole('academic_teacher');
  const id = String(form.get('id'));
  const to = String(form.get('to'));
  if (!UUID.test(id) || !['in_review', 'approved', 'retired', 'draft'].includes(to)) return;
  await db.query(
    `UPDATE questions SET status = $3::item_status,
            reviewed_by = CASE WHEN $3 = 'approved' THEN $2::uuid ELSE reviewed_by END
      WHERE id = $1 AND institution_id = $4`,
    [id, s.userId, to, s.institutionId]);
  revalidatePath('/teacher');
}

export async function createQuestion(_prev: { error?: string } | null, form: FormData): Promise<{ error?: string }> {
  const s = await requireRole('academic_teacher');
  const type = String(form.get('type')) === 'calculation' ? 'calculation' : 'mcq';
  const bloom = String(form.get('bloom') ?? 'apply');
  const competencyId = String(form.get('competency') ?? '');
  const stem = String(form.get('stem') ?? '').trim();
  const stemAr = String(form.get('stem_ar') ?? '').trim();
  const submit = form.get('intent') === 'review';
  if (stem.length < 10) return { error: 'stem' };
  if (!UUID.test(competencyId)) return { error: 'competency' };

  let body: Record<string, unknown>, key: Record<string, unknown>, absTol: number | null = null;
  if (type === 'mcq') {
    const options = ['a', 'b', 'c', 'd']
      .map((id) => ({ id, en: String(form.get(`opt_${id}`) ?? '').trim(), ar: String(form.get(`opt_${id}_ar`) ?? '').trim() }))
      .filter((o) => o.en);
    const correct = String(form.get('correct') ?? '');
    if (options.length < 2) return { error: 'options' };
    if (!options.some((o) => o.id === correct)) return { error: 'correct' };
    body = { stem_ar: stemAr || null, options };
    key = { correct };
  } else {
    const value = Number(String(form.get('answer') ?? '').replace(',', '.'));
    absTol = Number(String(form.get('tolerance') ?? '0').replace(',', '.')) || 0;
    if (!Number.isFinite(value)) return { error: 'answer' };
    body = { stem_ar: stemAr || null, unit: String(form.get('unit') ?? '').trim() || null };
    key = { value };
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query<{ id: string }>(
      `INSERT INTO questions (institution_id, type, bloom, status, author_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [s.institutionId, type, bloom, submit ? 'in_review' : 'draft', s.userId])).rows[0]!;
    await client.query(
      `INSERT INTO question_versions (question_id, version, stem, body, answer_key, abs_tolerance, max_points) VALUES ($1, 1, $2, $3, $4, $5, $6)`,
      [row.id, stem, body, key, absTol, type === 'calculation' ? 2 : 1]);
    await client.query(`INSERT INTO question_competencies (question_id, competency_id) VALUES ($1, $2)`, [row.id, competencyId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  revalidatePath('/teacher');
  redirect('/teacher?created=1');
}

