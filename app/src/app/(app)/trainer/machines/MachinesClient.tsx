'use client';
import { useEffect, useState } from 'react';
import { StickerSheet, type StickerMachine } from '@/components/admin/StickerSheet';
import { useL } from '@/components/LangProvider';
import { MachineBoard, type MachineRow } from '@/components/modules/WorkshopBoards';
import { apiFetch } from '@/lib/browserApi';
import { MachineRoster } from './MachineRoster';

export function MachinesClient({ trade, initial, userId }: { trade: string; initial: MachineRow[]; userId: string }) {
  const { L, lang } = useL();
  const [machines, setMachines] = useState(initial);
  const [view, setView] = useState<'board' | 'scan' | 'stickers'>('board');
  const [all, setAll] = useState<StickerMachine[] | null>(null);
  const load = () => apiFetch<{ machines: MachineRow[] }>(`/safety/machines?trade=${trade}`).then((r) => setMachines(r.machines)).catch(() => undefined);
  useEffect(() => { if (view !== 'board') return; const t = setInterval(load, 5000); return () => clearInterval(t); }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (view === 'stickers' && !all) void apiFetch<{ machines: StickerMachine[] }>('/safety/machines?trade=all').then((r) => setAll(r.machines)).catch(() => setAll([])); }, [view, all]);
  const TABS = [['board', L('Live board', 'اللوحة المباشرة')], ['scan', L('Scan a machine', 'امسح ماكينة')], ['stickers', L('QR stickers', 'ملصقات QR')]] as const;
  return (
    <>
      <div className="tabs no-print" role="tablist">
        {TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? 'primary' : 'ghost'} onClick={() => setView(k)}>{label}</button>)}
      </div>
      {view === 'board' && <MachineBoard ui={{ L, lang }} machines={machines} labels={false}
        onStop={async (lockId, reason) => { await apiFetch(`/safety/locks/${lockId}/release`, { body: { revoke: true, reason } }); await load(); }} />}
      {view === 'scan' && <MachineRoster userId={userId} />}
      {view === 'stickers' && (all ? <StickerSheet machines={all} /> : <p className="muted">{L('Loading…', 'جارٍ التحميل…')}</p>)}
    </>
  );
}
