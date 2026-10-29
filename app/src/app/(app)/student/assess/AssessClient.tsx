'use client';
import { useCallback, useEffect, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { AssessmentPlayer, type Graded, type Sitting } from '@/components/modules/AssessmentPlayer';
import { apiFetch } from '@/lib/browserApi';

export function AssessClient({ trade }: { trade: string }) {
  const { L, lang } = useL();
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const [err, setErr] = useState(false);
  const start = useCallback(() => {
    setSitting(null); setErr(false);
    apiFetch<Sitting>('/assessments', { body: { trade, limit: 10 } }).then(setSitting).catch(() => setErr(true));
  }, [trade]);
  useEffect(start, [start]);
  if (err) return <p className="notice notice-danger">{L('Could not start the assessment. Try again.', 'تعذّر بدء التقييم. حاول مرة أخرى.')}</p>;
  if (!sitting) return <p className="muted">{L('Preparing your questions…', 'جارٍ تجهيز أسئلتك…')}</p>;
  return <AssessmentPlayer key={sitting.assessmentId} ui={{ L, lang }} sitting={sitting} onRestart={start}
    onSubmit={(responses) => apiFetch<Graded>(`/assessments/${sitting.assessmentId}/submit`, { body: { responses } })} />;
}
