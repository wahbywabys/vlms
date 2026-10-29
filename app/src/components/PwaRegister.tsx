'use client';
import { useEffect } from 'react';
import { flush } from '@/components/modules/outbox';
import { API_BASE } from '@/lib/browserApi';

/** Registers the service worker and replays the offline outbox whenever the device reconnects. */
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    // A shared tablet: once someone signs out, drop the pages kept for offline use.
    if (location.pathname === '/login') void caches.delete('vtc-pages-v1');
    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
      addEventListener('offline', () => void sync?.register('vtc-outbox').catch(() => undefined));
    }).catch(() => undefined);
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'flush-outbox') void flush(API_BASE).catch(() => undefined); };
    navigator.serviceWorker.addEventListener('message', onMsg);
    const online = () => void flush(API_BASE).catch(() => undefined);
    addEventListener('online', online);
    return () => { navigator.serviceWorker.removeEventListener('message', onMsg); removeEventListener('online', online); };
  }, []);
  return null;
}
