'use client';
import { useEffect, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { ApprenticeLogbook, type CheckinOutcome, type LogbookApi, type LogEntry, type OjtShift, type OjtTotals, type Placement } from '@/components/modules/ApprenticeLogbook';
import { flush, queueMedia, queueMutation } from '@/components/modules/outbox';
import { API_BASE } from '@/lib/browserApi';

/** Wires the logbook screen to the API, falling back to the offline outbox when there is no connection. */
export function LogbookClient(props: { placement: Placement | null; totals: OjtTotals | null; shifts: OjtShift[]; entries: LogEntry[] }) {
  const { L, lang } = useL();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => { setOnline(navigator.onLine); if (navigator.onLine) void flush(API_BASE); };
    on(); addEventListener('online', on); addEventListener('offline', on);
    return () => { removeEventListener('online', on); removeEventListener('offline', on); };
  }, []);

  const api: LogbookApi = {
    async checkin(kind, fix) {
      const body = { clientMutationId: crypto.randomUUID(), kind, ...fix };
      const r = navigator.onLine ? await fetch(`${API_BASE}/ojt/checkins`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null) : null;
      if (!r || r.status >= 500) {
        await queueMutation({ clientMutationId: body.clientMutationId, type: 'checkin', payload: body, media: [] });
        return { accepted: false, queued: true, reason: null };
      }
      const out = (await r.json()) as CheckinOutcome & { error?: string };
      return r.status === 409 ? { accepted: false, reason: out.error ?? null } : out;
    },
    async submit(e, photos) {
      const clientMutationId = crypto.randomUUID();
      const media = photos.map(() => ({ localId: crypto.randomUUID() }));
      await Promise.all(photos.map((p, i) => queueMedia({ localId: media[i]!.localId, blob: p.blob, capturedAt: p.capturedAt, width: p.width, height: p.height,
        kind: p.blob.type.startsWith('video') ? 'video' : 'photo', lat: e.latitude, lon: e.longitude })));
      await queueMutation({ clientMutationId, type: 'logbook', payload: { clientMutationId, ...e }, media });
      const res = navigator.onLine ? await flush(API_BASE).catch(() => null) : null;
      const rejected = res?.rejected.find((m) => m.clientMutationId === clientMutationId);
      if (rejected) throw new Error(rejected.rejected?.message ?? rejected.rejected?.code ?? L('Rejected', 'مرفوض'));
      return { queued: !res || res.left > 0 };
    },
    mediaUrl: (id) => `${API_BASE}/media/${id}`,
  };
  return <ApprenticeLogbook ui={{ L, lang }} api={api} online={online} {...props} />;
}
