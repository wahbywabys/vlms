'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { makeL, type Lang } from '@/lib/i18n';

const Ctx = createContext<Lang>('en');

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

/** `L('English', 'عربي')`, `pick(txt)`, `ar(en, ar)` and number/date formatting for the current language. */
export function useL() {
  const lang = useContext(Ctx);
  return useMemo(() => makeL(lang), [lang]);
}
