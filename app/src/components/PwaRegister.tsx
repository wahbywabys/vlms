'use client';
import { useEffect } from 'react';
import { flush, readRelay, saveRelay } from '@/components/modules/outbox';
import { API_BASE } from '@/lib/browserApi';

/**
 * Replays the offline outbox whenever the device reconnects (and every two
 * minutes, since moving between Wi-Fi networks does not always fire
 * "online"), picks up the relay token for the online hub while on the centre
 * network, and registers the service worker where the browser allows one
 * (HTTPS or localhost).
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    const replay = () => void flush(API_BASE).catch(() => undefined);
    addEventListener('online', replay);
    const timer = setInterval(replay, 120_000);

    // Refresh the relay token once a day while signed in on the centre network.
    const saved = readRelay();
    if (location.pathname !== '/login' && location.pathname !== '/join' && (!saved?.savedAt || Date.now() - Date.parse(saved.savedAt) > 86400_000)) {
      void fetch('/api/center/relay', { cache: 'no-store' }).then(async (r) => {
        if (r.status === 200) saveRelay(await r.json());
        else if (r.status === 204) saveRelay(null);
      }).catch(() => undefined);
    }

    let onMsg: ((e: MessageEvent) => void) | null = null;
    if ('serviceWorker' in navigator) {
      // A shared tablet: once someone signs out, drop the pages kept for offline use.
      if (location.pathname === '/login') { void caches.delete('vtc-pages-v1'); saveRelay(null); }
      void navigator.serviceWorker.register('/sw.js').then((reg) => {
        const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
        addEventListener('offline', () => void sync?.register('vtc-outbox').catch(() => undefined));
      }).catch(() => undefined);
      onMsg = (e: MessageEvent) => { if (e.data?.type === 'flush-outbox') replay(); };
      navigator.serviceWorker.addEventListener('message', onMsg);
    } else if (location.pathname === '/login') {
      saveRelay(null);
    }
    return () => {
      if (onMsg) navigator.serviceWorker.removeEventListener('message', onMsg);
      removeEventListener('online', replay);
      clearInterval(timer);
    };
  }, []);
  return null;
}
