// Copied from app/src/components/modules/types.ts by scripts/sync-modules.sh. Edit the original, not this file.
/**
 * Shared types for the module screens. These components are plain React +
 * Tailwind with no app or prototype imports, so the same files run in the
 * Next.js app and in the clickable prototype (web/src/modules is a copy).
 * Each screen gets its copy through props: `ui.L('English', 'العربية')`.
 */
export interface Ui {
  L: (en: string, ar: string) => string;
  lang: 'en' | 'ar';
}
export interface Bi { en: string; ar: string }
export const pickBi = (ui: Ui, b: Bi | null | undefined) => (b ? (ui.lang === 'ar' ? b.ar || b.en : b.en) : '');
export const pickAr = (ui: Ui, en: string | null | undefined, ar: string | null | undefined) => (ui.lang === 'ar' && ar ? ar : en ?? '');

export type Level = 'not_yet' | 'novice' | 'intermediate' | 'autonomous' | 'master';
export const LEVELS: Level[] = ['not_yet', 'novice', 'intermediate', 'autonomous', 'master'];
export const LEVEL_TXT: Record<Level, Bi> = {
  not_yet: { en: 'Not yet', ar: 'لم يصل بعد' }, novice: { en: 'Novice', ar: 'مبتدئ' }, intermediate: { en: 'Intermediate', ar: 'متوسط' },
  autonomous: { en: 'Autonomous', ar: 'مستقل' }, master: { en: 'Master', ar: 'متمكن' },
};
export const levelIndex = (l: Level) => LEVELS.indexOf(l);

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ');
export const fmt = (ui: Ui, n: number, digits = 0) =>
  n.toLocaleString(ui.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });
