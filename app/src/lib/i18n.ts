/**
 * Bilingual (English / Arabic) helpers. Copy lives next to the code that uses
 * it as `L('English', 'العربية')`; data rows carry `name` / `name_ar` pairs.
 * Arabic switches the whole document to dir="rtl"; circuit drawings,
 * telemetry and engineering values stay left-to-right, as printed on site.
 */
export type Lang = 'en' | 'ar';
export interface Txt { en: string; ar: string }

export const tx = (en: string, ar: string): Txt => ({ en, ar });

export function makeL(lang: Lang) {
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const pick = (t: Txt) => t[lang];
  /** Pick the Arabic column when present, else fall back to English. */
  const ar = (en: string | null | undefined, arText: string | null | undefined) => (lang === 'ar' && arText ? arText : en ?? '');
  const num = (n: number, digits = 0) => n.toLocaleString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const date = (d: Date | string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
    new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', opts);
  const time = (d: Date | string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return { lang, L, pick, ar, num, date, time };
}
export type I18n = ReturnType<typeof makeL>;
