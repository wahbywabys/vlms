'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLang } from '@/app/actions';
import { useL } from './LangProvider';

export function LangToggle() {
  const { lang } = useL();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: 'en' | 'ar') => {
    if (l === lang) return;
    // Flip the document at once; the server re-render follows with translated data.
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    start(async () => { await setLang(l); router.refresh(); });
  };
  return (
    <div className="lang" role="radiogroup" aria-label="Language · اللغة" aria-busy={pending}>
      <button type="button" role="radio" aria-checked={lang === 'en'} lang="en" onClick={() => choose('en')}>EN</button>
      <button type="button" role="radio" aria-checked={lang === 'ar'} lang="ar" onClick={() => choose('ar')}>عربي</button>
    </div>
  );
}
