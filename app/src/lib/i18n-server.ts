import 'server-only';
import { cookies } from 'next/headers';
import { makeL, type Lang } from './i18n';

export async function getLang(): Promise<Lang> {
  return (await cookies()).get('lang')?.value === 'ar' ? 'ar' : 'en';
}
export async function getI18n() {
  return makeL(await getLang());
}
