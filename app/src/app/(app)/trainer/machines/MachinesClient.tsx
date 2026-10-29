'use client';
import { useEffect, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { MachineBoard, type MachineRow } from '@/components/modules/WorkshopBoards';
import { apiFetch } from '@/lib/browserApi';

export function MachinesClient({ trade, initial }: { trade: string; initial: MachineRow[] }) {
  const { L, lang } = useL();
  const [machines, setMachines] = useState(initial);
  const load = () => apiFetch<{ machines: MachineRow[] }>(`/safety/machines?trade=${trade}`).then((r) => setMachines(r.machines)).catch(() => undefined);
  useEffect(() => { const t = setInterval(load, 5000); return () => clearInterval(t); }); // eslint-disable-line react-hooks/exhaustive-deps
  return <MachineBoard ui={{ L, lang }} machines={machines}
    scanUrl={(code) => `${location.origin}/student/machine?code=${encodeURIComponent(code)}`}
    onStop={async (lockId, reason) => { await apiFetch(`/safety/locks/${lockId}/release`, { body: { revoke: true, reason } }); await load(); }} />;
}
