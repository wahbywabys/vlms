'use client';
/** "Save to my locker" for any screen, plus the toast that confirms it. See locker.ts. */
import { useEffect, useState } from 'react';
import { LOCKER_SAVED_EVENT, saveToLocker, type LockerDrop } from './locker';
import './locker.css';

const S = {
  en: { save: 'Save to my locker', saved: 'In your locker', toast: 'Saved to your Private locker', fail: 'Could not save to your locker. Try again.' },
  ar: { save: 'احفظ في خزانتي', saved: 'في خزانتك', toast: 'تم الحفظ في خزانتك الخاصة', fail: 'تعذّر الحفظ في خزانتك. حاول مرة أخرى.' },
};

/** A small lock icon, the mark of everything Private. */
export function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LockerButton({ drop, lang = 'en', className = '', compact = false }: { drop: LockerDrop; lang?: 'en' | 'ar'; className?: string; compact?: boolean }) {
  const t = S[lang];
  const key = JSON.stringify([drop.kind, drop.ref ?? drop.title.en]);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <button type="button" className={`lk-save ${saved === key ? 'is-saved' : ''} ${className}`} aria-pressed={saved === key}
      title={t.save} onClick={() => { saveToLocker(drop); setSaved(key); }}>
      <LockIcon size={15} />{!compact && <span>{saved === key ? t.saved : t.save}</span>}
    </button>
  );
}

/** Confirms each save for a few seconds. Mount once per page. */
export function LockerToast({ lang = 'en' }: { lang?: 'en' | 'ar' }) {
  const [msg, setMsg] = useState<{ ok: boolean; title: string; n: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      const { drop, ok } = (e as CustomEvent<{ drop: LockerDrop; ok: boolean }>).detail;
      setMsg((m) => ({ ok, title: drop.title[lang], n: (m?.n ?? 0) + 1 }));
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 3200);
    };
    window.addEventListener(LOCKER_SAVED_EVENT, on);
    return () => { window.removeEventListener(LOCKER_SAVED_EVENT, on); clearTimeout(timer); };
  }, [lang]);
  if (!msg) return null;
  return (
    <div className={`lk-toast ${msg.ok ? '' : 'is-bad'}`} role="status" key={msg.n}>
      <LockIcon size={18} />
      <span><b>{msg.ok ? S[lang].toast : S[lang].fail}</b>{msg.ok && <small>{msg.title}</small>}</span>
    </div>
  );
}
