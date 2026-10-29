/**
 * Offline outbox for the floor tablet and the apprentice phone.
 *
 * Writes made without a connection are kept in IndexedDB (photos as Blobs, so
 * a dozen evidence shots survive a reload or a flat battery), then replayed
 * when the device is back online:
 *
 *   1. each queued photo is uploaded to POST {base}/media (idempotent on its
 *      clientMutationId, so a retry after a dropped response is harmless);
 *   2. its server id is put into the queued write in place of the local id;
 *   3. the writes go to POST {base}/sync in one batch, oldest first. The
 *      server answers applied / duplicate / rejected per item; applied and
 *      duplicate items leave the queue, rejected ones are kept with the reason
 *      so the screen can show them, and 5xx keeps everything for next time.
 *
 * The same mutation types as /v1/sync: observation, checkin, logbook, consumable.
 */
export type MutationType = 'observation' | 'checkin' | 'logbook' | 'consumable';
export interface QueuedMedia { localId: string; blob: Blob; capturedAt: string; width?: number; height?: number;
  kind?: 'photo' | 'video' | 'signature'; lat?: number; lon?: number; serverId?: string }
export interface QueuedMutation {
  clientMutationId: string; type: MutationType; payload: Record<string, unknown>; createdAt: string;
  /** Photos this write references: the local id, and the criterion for floor observations. */
  media: { localId: string; criterionKey?: string }[];
  rejected?: { code: string; message?: string };
}

const DB = 'vtc-outbox', VERSION = 1;
const open = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open(DB, VERSION);
  r.onupgradeneeded = () => {
    r.result.createObjectStore('media', { keyPath: 'localId' });
    r.result.createObjectStore('mutations', { keyPath: 'clientMutationId' });
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function run<T>(store: 'media' | 'mutations', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => { res(req.result); db.close(); };
    t.onerror = () => { rej(t.error); db.close(); };
  });
}

export const queueMedia = (m: QueuedMedia) => run('media', 'readwrite', (s) => s.put(m));
export const dropMedia = (localId: string) => run('media', 'readwrite', (s) => s.delete(localId));
export const queueMutation = (m: Omit<QueuedMutation, 'createdAt'>) => run('mutations', 'readwrite', (s) => s.put({ ...m, createdAt: new Date().toISOString() }));
export const dropMutation = (id: string) => run('mutations', 'readwrite', (s) => s.delete(id));
export const listMutations = async () =>
  ((await run('mutations', 'readonly', (s) => s.getAll())) as QueuedMutation[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
export const pendingCount = async () => (await listMutations()).filter((m) => !m.rejected).length;

/** Put the server's media ids into a queued write, in the shape each type expects. */
function withMedia(m: QueuedMutation, ids: Map<string, string>) {
  const refs = m.media.map((r) => ({ ...r, mediaId: ids.get(r.localId)! }));
  if (m.type === 'observation') return { ...m.payload, media: refs.map((r) => ({ mediaId: r.mediaId, ...(r.criterionKey ? { criterionKey: r.criterionKey } : {}) })) };
  if (m.type === 'logbook') return { ...m.payload, media: refs.map((r) => r.mediaId) };
  return m.payload;
}

export interface FlushResult { applied: number; duplicate: number; rejected: QueuedMutation[]; left: number }

/** Replay the queue. Safe to call often; concurrent calls share one run. */
let running: Promise<FlushResult> | null = null;
export function flush(base: string): Promise<FlushResult> {
  running ??= doFlush(base).finally(() => { running = null; });
  return running;
}

async function doFlush(base: string): Promise<FlushResult> {
  const queue = (await listMutations()).filter((m) => !m.rejected);
  const out: FlushResult = { applied: 0, duplicate: 0, rejected: [], left: queue.length };
  if (!queue.length) return out;
  const ids = new Map<string, string>();
  const ready: QueuedMutation[] = [];
  for (const m of queue) {
    let ok = true;
    for (const ref of m.media) {
      if (ids.has(ref.localId)) continue;
      const qm = (await run('media', 'readonly', (s) => s.get(ref.localId))) as QueuedMedia | undefined;
      if (!qm) { ok = false; break; }
      if (!qm.serverId) {
        const r = await fetch(`${base}/media`, { method: 'POST', body: qm.blob, headers: {
          'content-type': qm.blob.type || 'image/jpeg', 'x-client-mutation-id': qm.localId, 'x-captured-at': qm.capturedAt,
          ...(qm.kind ? { 'x-kind': qm.kind } : {}), ...(qm.width ? { 'x-width': String(qm.width), 'x-height': String(qm.height ?? 0) } : {}),
          ...(qm.lat !== undefined ? { 'x-lat': String(qm.lat), 'x-lon': String(qm.lon) } : {}),
        } }).catch(() => null);
        if (!r?.ok) return out;               // still offline, or the server is down: try again later
        qm.serverId = ((await r.json()) as { id: string }).id;
        await queueMedia(qm);
      }
      ids.set(ref.localId, qm.serverId);
    }
    if (ok) ready.push(m);
    else { m.rejected = { code: 'media_missing', message: 'A photo for this record was lost on the device' }; await queueMutation(m); out.rejected.push(m); }
  }
  for (let i = 0; i < ready.length; i += 100) {
    const batch = ready.slice(i, i + 100);
    const r = await fetch(`${base}/sync`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mutations: batch.map((m) => ({ type: m.type, payload: withMedia(m, ids) })) }) }).catch(() => null);
    if (!r?.ok) break;
    const { results } = (await r.json()) as { results: { clientMutationId: string | null; status: 'applied' | 'duplicate' | 'rejected'; error?: { code: string; message?: string } }[] };
    for (const [k, res] of results.entries()) {
      const m = batch[k]!;
      if (res.status === 'rejected') { m.rejected = { code: res.error?.code ?? 'rejected', message: res.error?.message }; await queueMutation(m); out.rejected.push(m); }
      else {
        out[res.status]++;
        await dropMutation(m.clientMutationId);
        for (const ref of m.media) await dropMedia(ref.localId);
      }
    }
  }
  out.left = await pendingCount();
  return out;
}
