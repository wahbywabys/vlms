import { requireRole } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { VLab, type RecentAttempt } from './VLab';

export const metadata = { title: 'V-Lab' };

export default async function LabPage() {
  const s = await requireRole('student');
  // An exam the trainer started takes priority over an unfinished practice attempt.
  const open = await q1<{ id: string; mode: string }>(
    `SELECT s.id, s.mode::text AS mode FROM virtual_lab_sessions s JOIN virtual_labs l ON l.id = s.lab_id
      WHERE s.learner_id = $1 AND l.code = 'VLAB-DOL-STARTER' AND s.status = 'in_progress'
      ORDER BY (s.mode = 'assessment') DESC, s.started_at DESC LIMIT 1`, [s.userId]);
  const recent = await q<RecentAttempt>(
    `SELECT s.id, s.mode::text AS mode, s.final_score::float AS score, s.passed, s.started_at AS at
       FROM virtual_lab_sessions s WHERE s.learner_id = $1 AND s.status IN ('evaluated', 'aborted')
      ORDER BY s.started_at DESC LIMIT 6`, [s.userId]);
  return <VLab initialSessionId={open?.id ?? null} examFromTrainer={open?.mode === 'assessment'}
    recent={recent.map((r) => ({ ...r, at: new Date(r.at).toISOString() }))} />;
}
