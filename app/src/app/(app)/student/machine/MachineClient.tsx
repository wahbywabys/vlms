'use client';
import { useL } from '@/components/LangProvider';
import { MachineAccess, type MachineApi } from '@/components/modules/MachineAccess';
import { apiFetch } from '@/lib/browserApi';

const api: MachineApi = {
  scan: (code) => apiFetch(`/safety/scan/${encodeURIComponent(code)}`),
  start: (code) => apiFetch(`/safety/scan/${encodeURIComponent(code)}/precheck`, { body: {} }),
  submit: (attemptId, answers) => apiFetch(`/safety/prechecks/${attemptId}/submit`, { body: { answers } }),
  release: async (lockId) => { await apiFetch(`/safety/locks/${lockId}/release`, { body: {} }); },
};

export function MachineClient({ code, labels }: { code: string | null; labels: { code: string; label: string }[] }) {
  const { L, lang } = useL();
  return <MachineAccess ui={{ L, lang }} api={api} initialCode={code} demoCodes={labels} />;
}
