import 'server-only';
import { cookies } from 'next/headers';
import { makeL, type Lang } from './i18n';

/** The `lang` cookie, else DEFAULT_LANG (a centre server sets ar), else English. */
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get('lang')?.value ?? process.env.DEFAULT_LANG;
  return c === 'ar' ? 'ar' : 'en';
}
export async function getI18n() {
  return makeL(await getLang());
}
