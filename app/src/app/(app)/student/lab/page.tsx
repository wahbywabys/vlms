import { requireRole } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';
import { labForTrade } from '@/lib/labs';
import { currentTrade } from '@/lib/trade';
import { VLab, type RecentAttempt } from './VLab';

export const metadata = { title: 'V-Lab' };

export default async function LabPage() {
  const s = await requireRole('student');
  const { L } = await getI18n();
  const lab = await labForTrade(s, await currentTrade(s, 'own'));
  if (!lab?.catalogue) {
    return <div className="lab"><p className="notice notice-danger">{lab
      ? L('The V-Lab service is not reachable right now. Try again in a minute.', 'خدمة المعمل الافتراضي غير متاحة الآن. حاول بعد دقيقة.')
      : L('Your trade has no V-Lab yet.', 'لا يوجد معمل افتراضي لتخصصك بعد.')}</p></div>;
  }
  // An exam the trainer started takes priority over an unfinished practice attempt.
  const open = await q1<{ id: string; mode: string }>(
    `SELECT s.id, s.mode::text AS mode FROM virtual_lab_sessions s JOIN virtual_labs l ON l.id = s.lab_id
      WHERE s.learner_id = $1 AND l.code = $2 AND s.status = 'in_progress'
      ORDER BY (s.mode = 'assessment') DESC, s.started_at DESC LIMIT 1`, [s.userId, lab.code]);
  const recent = await q<RecentAttempt>(
    `SELECT s.id, s.mode::text AS mode, s.final_score::float AS score, s.passed, s.started_at AS at
       FROM virtual_lab_sessions s JOIN virtual_labs l ON l.id = s.lab_id
      WHERE s.learner_id = $1 AND l.code = $2 AND s.status IN ('evaluated', 'aborted')
      ORDER BY s.started_at DESC LIMIT 6`, [s.userId, lab.code]);
  return <VLab lab={lab.catalogue} initialSessionId={open?.id ?? null} examFromTrainer={open?.mode === 'assessment'}
    recent={recent.map((r) => ({ ...r, at: new Date(r.at).toISOString() }))} />;
}
