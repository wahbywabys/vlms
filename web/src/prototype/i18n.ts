/**
 * Bilingual (English / Arabic) helpers. Copy lives next to the code that uses
 * it as `L('English', 'العربية')`; sample data carries `Txt` pairs. Arabic
 * switches the whole document to dir="rtl"; circuit drawings, telemetry and
 * engineering values stay left-to-right, as they are printed on site.
 */
export type Lang = 'en' | 'ar';
export interface Txt { en: string; ar: string }

export const tx = (en: string, ar: string): Txt => ({ en, ar });

export function makeL(lang: Lang) {
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const pick = (t: Txt) => t[lang];
  return { lang, L, pick };
}
