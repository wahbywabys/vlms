import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { labForTrade } from '@/lib/labs';
import { currentTrade, trades } from '@/lib/trade';
import type { AttemptRecord } from '@/components/locker';
import { PrivateClient } from './PrivateClient';

export const metadata = { title: 'Private' };

/** The student's own space. The space itself is loaded in the browser from /v1/private; the server adds their scored V-Lab attempts to compare. */
export default async function PrivatePage() {
  const s = await requireRole('student');
  const trade = await currentTrade(s, 'own');
  const [all, lab] = await Promise.all([trades(), labForTrade(s, trade)]);
  const rows = await q<{ id: string; code: string; title: string; title_ar: string | null; mode: string; score: number; passed: boolean | null; at: Date; criteria: Record<string, { score: number }> | null }>(
    `SELECT s.id, l.code, l.title, l.title_ar, s.mode::text AS mode, s.final_score::float AS score, s.passed, s.started_at AS at, e.criterion_scores AS criteria
       FROM virtual_lab_sessions s JOIN virtual_labs l ON l.id = s.lab_id
       LEFT JOIN LATERAL (SELECT criterion_scores FROM rubric_evaluations
                           WHERE subject_type = 'vlab_session' AND subject_id = s.id ORDER BY evaluated_at DESC LIMIT 1) e ON true
      WHERE s.learner_id = $1 AND s.status = 'evaluated' AND s.final_score IS NOT NULL
      ORDER BY s.started_at DESC LIMIT 40`, [s.userId]);
  const labels = lab?.catalogue?.criterionLabels ?? {};
  const attempts: AttemptRecord[] = rows.map((r) => ({
    id: `vlab:${r.id}`, at: new Date(r.at).toISOString(), kind: 'vlab', ref: r.code, title: { en: r.title, ar: r.title_ar ?? r.title },
    score: r.score, passed: r.passed ?? undefined, mode: r.mode,
    criteria: Object.entries(r.criteria ?? {}).map(([key, v]) => ({ key, label: labels[key] ?? { en: key, ar: key }, score: Math.round(Number(v?.score ?? 0)) })),
  }));
  return <PrivateClient trade={trade} trades={all.map((t) => ({ id: t.id, name: { en: t.name, ar: t.name_ar ?? t.name } }))}
    owner={{ en: s.name, ar: s.nameAr ?? s.name }} attempts={attempts} />;
}
