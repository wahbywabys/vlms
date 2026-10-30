/**
 * Where a Private space is kept. The prototype keeps it in the browser; the
 * app keeps it on the server (GET/PUT /v1/private) so it follows the student
 * from the workshop tablet to their phone.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyState, mergeStates, normalize, type PrivateState } from './model';

export interface PrivateAdapter {
  load(): Promise<{ state: PrivateState; rev: number }>;
  /** Resolves with the new revision, or rejects with { conflict: { state, rev } } when another copy saved first. */
  save(state: PrivateState, rev: number): Promise<number>;
  /** Shown under the privacy note: where this copy lives. */
  where: 'device' | 'account';
}

export interface Conflict { conflict: { state: unknown; rev: number } }
const isConflict = (e: unknown): e is Conflict => !!e && typeof e === 'object' && 'conflict' in e;

/** Browser storage, for the prototype and offline demo. Survives reloads on this device only. */
export function localAdapter(key: string, seed?: () => PrivateState): PrivateAdapter {
  return {
    where: 'device',
    async load() {
      try {
        const raw = localStorage.getItem(key);
        if (raw) { const { state, rev } = JSON.parse(raw) as { state: unknown; rev: number }; return { state: normalize(state), rev: rev ?? 0 }; }
      } catch { /* blocked or corrupt storage: start fresh */ }
      return { state: seed?.() ?? emptyState(), rev: 0 };
    },
    async save(state, rev) {
      try { localStorage.setItem(key, JSON.stringify({ state, rev: rev + 1 })); } catch { /* full or blocked: keep it in memory */ }
      return rev + 1;
    },
  };
}

export type SaveStatus = 'loading' | 'saved' | 'saving' | 'offline';

/** The space's state, saved shortly after every change. `update` is safe to call before the first load finishes. */
export function usePrivateState(adapter: PrivateAdapter) {
  const [state, setState] = useState<PrivateState | null>(null);
  const [status, setStatus] = useState<SaveStatus>('loading');
  const rev = useRef(0);
  const pending = useRef<((s: PrivateState) => PrivateState)[]>([]);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<PrivateState | null>(null);
  latest.current = state;

  useEffect(() => {
    let live = true;
    adapter.load().then(({ state: s, rev: r }) => {
      if (!live) return;
      rev.current = r;
      // Anything dropped in before the load finished is applied on top.
      const queued = pending.current.splice(0);
      if (queued.length) dirty.current = true;
      const next = queued.reduce((acc, f) => f(acc), s);
      latest.current = next;
      setState(next);
      setStatus('saved');
    }).catch(() => { if (live) { setState(emptyState()); setStatus('offline'); } });
    return () => { live = false; };
  }, [adapter]);

  const flush = useCallback(async () => {
    const s = latest.current;
    if (!s || !dirty.current) return;
    dirty.current = false;
    setStatus('saving');
    try {
      rev.current = await adapter.save(s, rev.current);
      setStatus(dirty.current ? 'saving' : 'saved');
    } catch (e) {
      if (isConflict(e)) {
        // Another tab or device saved first: keep both sides and save the merge.
        rev.current = e.conflict.rev;
        setState((cur) => (cur ? mergeStates(cur, normalize(e.conflict.state)) : normalize(e.conflict.state)));
        dirty.current = true;
      } else {
        dirty.current = true;
        setStatus('offline');
      }
    }
  }, [adapter]);

  useEffect(() => {
    if (!state || !dirty.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
    return () => clearTimeout(timer.current);
  }, [state, flush]);

  // Retry an offline save when the connection comes back, and save before the page goes away.
  useEffect(() => {
    const on = () => void flush();
    window.addEventListener('online', on);
    window.addEventListener('pagehide', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('pagehide', on); };
  }, [flush]);

  const update = useCallback((f: (s: PrivateState) => PrivateState) => {
    dirty.current = true;
    if (!latest.current) { pending.current.push(f); return; }
    setState((cur) => (cur ? f(cur) : cur));
  }, []);

  return { state, update, status };
}
