'use client';
import { useEffect, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { EarlyWarning, type RiskData } from '@/components/modules/EarlyWarning';
import { apiFetch } from '@/lib/browserApi';

/** Early-warning list for trainers (their cohorts) and the director (everyone). */
export function RiskClient({ trade, canAck }: { trade: string; canAck: boolean }) {
  const { L, lang } = useL();
  const [data, setData] = useState<RiskData | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    apiFetch<RiskData>(`/analytics/early-warning${trade && trade !== 'all' ? `?trade=${trade}` : ''}`).then(setData).catch(() => setErr(true));
  }, [trade]);
  if (err) return <p className="notice notice-danger">{L('The early-warning service is not reachable.', 'خدمة الإنذار المبكر غير متاحة.')}</p>;
  if (!data) return <p className="muted">{L('Scoring learners…', 'جارٍ تقييم المتدربين…')}</p>;
  return <EarlyWarning ui={{ L, lang }} data={data} canAck={canAck}
    onAck={async (id, note) => { await apiFetch(`/analytics/early-warning/${id}/ack`, { body: { note } }); }} />;
}
