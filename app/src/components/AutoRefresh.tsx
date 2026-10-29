'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Re-runs the page's server queries every `ms` so live tables stay current. */
export function AutoRefresh({ ms = 5000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => { const t = setInterval(() => router.refresh(), ms); return () => clearInterval(t); }, [router, ms]);
  return null;
}
