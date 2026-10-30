'use client';
import { useEffect, useMemo } from 'react';
import { useL } from '@/components/LangProvider';
import { MachineAccess, type MachineApi } from '@/components/modules/MachineAccess';
import { apiFetch } from '@/lib/browserApi';
import { decodeFrame, fetchPack, learnerOffline } from '@/lib/machineOffline';

const api: MachineApi = {
  scan: (code) => apiFetch(`/safety/scan/${encodeURIComponent(code)}`),
  start: (code) => apiFetch(`/safety/scan/${encodeURIComponent(code)}/precheck`, { body: {} }),
  submit: (attemptId, answers) => apiFetch(`/safety/prechecks/${attemptId}/submit`, { body: { answers } }),
  release: async (lockId) => { await apiFetch(`/safety/locks/${lockId}/release`, { body: {} }); },
};

export function MachineClient({ code, labels, userId }: { code: string | null; labels: { code: string; label: string }[]; userId: string }) {
  const { L, lang } = useL();
  const offline = useMemo(() => learnerOffline(userId), [userId]);
  // Keep the saved list fresh while online, so a scan still works if the network drops.
  useEffect(() => {
    void fetchPack();
    const t = setInterval(() => { if (navigator.onLine) void fetchPack(); }, 10 * 60_000);
    const on = () => void fetchPack();
    addEventListener('online', on);
    return () => { clearInterval(t); removeEventListener('online', on); };
  }, []);
  return <MachineAccess ui={{ L, lang }} api={api} initialCode={code} demoCodes={labels} offline={offline} decodeFrame={decodeFrame}
    photoUrl={(id) => `/api/v1/media/${id}`} twinHref={() => '/student/lab'} />;
}
