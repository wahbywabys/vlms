/**
 * Full-screen helper. Uses the Fullscreen API when the browser allows it; where
 * it is refused (some app views, iPhone Safari, locked-down frames) it falls
 * back to a CSS "maximised" state that fills the window. Esc leaves either one.
 */
import { useCallback, useEffect, useState, type RefObject } from 'react';

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const on = () => setNative(document.fullscreenElement !== null && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, [ref]);

  useEffect(() => {
    if (!fallback) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setFallback(false); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [fallback]);

  const toggle = useCallback(async () => {
    if (native) { await document.exitFullscreen().catch(() => undefined); return; }
    if (fallback) { setFallback(false); return; }
    const el = ref.current;
    try {
      if (!el?.requestFullscreen || !document.fullscreenEnabled) throw new Error('unavailable');
      await el.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      setFallback(true);
    }
  }, [native, fallback, ref]);

  return { isFull: native || fallback, isFallback: fallback, toggle };
}

export function FullscreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="fs-icon">
      {exit
        ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  );
}
