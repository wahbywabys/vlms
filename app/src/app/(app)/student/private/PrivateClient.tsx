'use client';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useL } from '@/components/LangProvider';
import type { AttemptRecord } from '@/components/locker';
import type { Catalog, PrivateState } from '@/components/private/model';
import type { PrivateAdapter } from '@/components/private/store';
import { apiFetch } from '@/lib/browserApi';
import type { Txt } from '@/lib/i18n';
import { LEARNING } from '@/lib/learning';

// The compare tab draws machines in 3D, so the space loads in the browser only.
const PrivateSpace = dynamic(() => import('@/components/private/PrivateSpace').then((m) => m.PrivateSpace), { ssr: false });

/** Saves through /api/v1/private; a 409 hands back the stored copy so the space can merge it. */
const serverAdapter: PrivateAdapter = {
  where: 'account',
  load: () => apiFetch<{ state: PrivateState; rev: number }>('/private'),
  async save(state, rev) {
    const r = await fetch('/api/v1/private', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state, rev }), cache: 'no-store' });
    const body = await r.json().catch(() => null) as { rev?: number; conflict?: { state: unknown; rev: number } } | null;
    if (r.status === 409 && body?.conflict) throw { conflict: body.conflict };
    if (!r.ok || typeof body?.rev !== 'number') throw new Error(`save failed (${r.status})`);
    return body.rev;
  },
};

export function PrivateClient({ trade, trades, owner, attempts }: { trade: string; trades: { id: string; name: Txt }[]; owner: Txt; attempts: AttemptRecord[] }) {
  const { lang } = useL();
  const catalog = useMemo<Catalog>(() => ({
    home: trade,
    trades: trades.filter((t) => LEARNING[t.id]).map((t) => ({ id: t.id, name: t.name, ...LEARNING[t.id]! })),
  }), [trade, trades]);
  if (!catalog.trades.length) return <p className="notice">No study material for your trade yet.</p>;
  return <div className="page"><PrivateSpace lang={lang} catalog={catalog} owner={{ name: owner }} adapter={serverAdapter} attempts={attempts} /></div>;
}
