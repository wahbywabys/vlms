'use server';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Supervisor decision on a logbook entry: an immutable wbl_signoffs row with
 * a signature hash over the entry payload (the DB trigger moves the entry's
 * status). Approval also counts as workplace evidence: it verifies the
 * entry's competencies, and an autonomous learner rated 4+ reaches master.
 */
export async function decide(form: FormData) {
  const s = await requireRole('industry_supervisor');
  const entryId = String(form.get('entry'));
  const decision = String(form.get('decision'));
  const rating = Number(form.get('rating') ?? 0) || null;
  const comment = String(form.get('comment') ?? '').trim() || null;
  if (!/^[0-9a-f-]{36}$/.test(entryId) || !['approved', 'rejected', 'revision_requested'].includes(decision)) return;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const e = (await client.query<{ id: string; learner_id: string; work_date: Date; hours: string; task_summary: string; competency_ids: string[]; media: { sha256: string }[] }>(
      `SELECT e.id, p.learner_id, e.work_date, e.hours, e.task_summary, e.competency_ids, e.media
         FROM wbl_logbook_entries e JOIN wbl_placements p ON p.id = e.placement_id
        WHERE e.id = $1 AND p.supervisor_id = $2 AND e.status = 'submitted' FOR UPDATE OF e`, [entryId, s.userId])).rows[0];
    if (!e) { await client.query('ROLLBACK'); return; }
    const payload = JSON.stringify({ entry: e.id, date: e.work_date, hours: e.hours, task: e.task_summary, media: e.media.map((m) => m.sha256), decision, rating, supervisor: s.userId });
    const signature = createHash('sha256').update(payload).digest('hex');
    await client.query(
      `INSERT INTO wbl_signoffs (entry_id, supervisor_id, decision, rating, comment, signature_hash) VALUES ($1, $2, $3, $4, $5, $6)`,
      [entryId, s.userId, decision, rating, comment, signature]);
    if (decision === 'approved') {
      for (const c of e.competency_ids) {
        await client.query(
          `INSERT INTO competency_evidence (learner_id, competency_id, source_type, source_id, score, level_awarded, assessor_id)
           VALUES ($1, $2, 'wbl_logbook', $3, $4, NULL, $5)`, [e.learner_id, c, e.id, rating ? rating * 20 : null, s.userId]);
        await client.query(
          `INSERT INTO learner_competencies (learner_id, competency_id, level, evidence_count, last_assessed_at, verified_by)
           VALUES ($1, $2, 'novice', 1, now(), $3)
           ON CONFLICT (learner_id, competency_id) DO UPDATE
             SET verified_by = EXCLUDED.verified_by, evidence_count = learner_competencies.evidence_count + 1,
                 last_assessed_at = now(), updated_at = now(),
                 level = CASE WHEN learner_competencies.level = 'autonomous' AND $4::int >= 4 THEN 'master'::proficiency_level
                              ELSE learner_competencies.level END`,
          [e.learner_id, c, s.userId, rating ?? 0]);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  revalidatePath('/supervisor');
}
