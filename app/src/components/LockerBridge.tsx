'use client';
/**
 * Student workspace: carries "Save to my locker" drops and finished attempts
 * from any screen to the student's Private space on the server, and confirms
 * each save with a toast. See components/locker.ts.
 */
import { useEffect } from 'react';
import { apiFetch } from '@/lib/browserApi';
import { useL } from './LangProvider';
import { LockerToast } from './LockerButton';
import { ATTEMPT_EVENT, LOCKER_EVENT, lockerSaved, type AttemptRecord, type LockerDrop } from './locker';

export function LockerBridge() {
  const { lang } = useL();
  useEffect(() => {
    const onDrop = (e: Event) => {
      const drop = (e as CustomEvent<LockerDrop>).detail;
      apiFetch('/private/items', { body: drop }).then(() => lockerSaved(drop, true), () => lockerSaved(drop, false));
    };
    // Attempts are kept quietly; a lost one only means one point fewer on a trend line.
    const onAttempt = (e: Event) => { apiFetch('/private/history', { body: (e as CustomEvent<AttemptRecord>).detail }).catch(() => undefined); };
    window.addEventListener(LOCKER_EVENT, onDrop);
    window.addEventListener(ATTEMPT_EVENT, onAttempt);
    return () => { window.removeEventListener(LOCKER_EVENT, onDrop); window.removeEventListener(ATTEMPT_EVENT, onAttempt); };
  }, []);
  return <LockerToast lang={lang} />;
}
