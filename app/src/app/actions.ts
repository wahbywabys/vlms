'use server';
import { cookies } from 'next/headers';
import type { Lang } from '@/lib/i18n';

export async function setLang(lang: Lang) {
  (await cookies()).set('lang', lang === 'ar' ? 'ar' : 'en', { path: '/', maxAge: 365 * 24 * 3600, sameSite: 'lax' });
}
