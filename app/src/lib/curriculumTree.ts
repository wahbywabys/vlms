import type { Txt } from './i18n';

/**
 * The programme curriculum as the WABYS manual lays it out: per year, three
 * domains (K knowledge modules, S practical skills, A professional attitudes);
 * each item (an element in the competency tree) carries its learning outcomes
 * or performance criteria. Shared by the director's programmes page and the
 * read-only "My programme" / "Curriculum" pages.
 */
export type Ksa = 'K' | 'S' | 'A';
export interface CurriculumComp {
  code: string; kind: 'unit' | 'element' | 'criterion'; parentCode: string | null; title: string; titleAr: string | null;
  safetyCritical?: boolean; hours?: number | null; ksa?: Ksa | null; year?: number | null; targetLevel?: string | null;
  coreAttitude?: string | null; framework?: string;
}
export interface CoreAttitude { code: string; name: string; nameAr: string | null; indicators: string | null; indicatorsAr: string | null }
export interface ProgramProfile {
  eqf?: string; hours?: number; source?: Txt; occupation?: Txt; occupations?: Txt; overview?: Txt; equipment?: Txt;
  standards?: string; tracks?: Txt[]; capstone?: Txt;
}
export interface CurriculumItem { code: string; title: Txt; ksa: Ksa; year: number; hours: number | null; level: string | null; core: string | null; safety: boolean; criteria: { code: string; text: Txt }[] }
export interface CurriculumUnit { code: string; title: Txt; year: number; ksa: Ksa; items: CurriculumItem[] }

export const YEARS: Record<number, Txt> = {
  1: { en: 'Year 1 · Foundation, Safety & Core Principles', ar: 'السنة الأولى · الأساسيات والسلامة والمبادئ الجوهرية' },
  2: { en: 'Year 2 · Advanced Operations & Systems', ar: 'السنة الثانية · العمليات والأنظمة المتقدمة' },
  3: { en: 'Year 3 · Specialization, Automation, Troubleshooting & Capstone', ar: 'السنة الثالثة · التخصص والأتمتة وتتبع الأعطال ومشروع التخرج' },
};
export const DOMAINS: Record<Ksa, { short: Txt; long: Txt }> = {
  K: { short: { en: 'Knowledge', ar: 'المعارف' }, long: { en: 'Knowledge modules', ar: 'الوحدات المعرفية' } },
  S: { short: { en: 'Skills', ar: 'المهارات' }, long: { en: 'Practical skill competencies', ar: 'الجدارات المهارية العملية' } },
  A: { short: { en: 'Attitudes', ar: 'الاتجاهات' }, long: { en: 'Professional attitudes & workplace etiquette', ar: 'الاتجاهات المهنية وآداب مكان العمل' } },
};
/** Skill performance levels used in the manual's S tables. */
export const LEVELS: Record<string, Txt> = {
  L1: { en: 'L1 · Assisted', ar: 'م1 · يؤدي بمساعدة' },
  L2: { en: 'L2 · Guided', ar: 'م2 · يؤدي بتوجيه' },
  L3: { en: 'L3 · Independent', ar: 'م3 · يؤدي باستقلالية' },
  L4: { en: 'L4 · Expert / coach', ar: 'م4 · خبير / مدرب لغيره' },
};

const t = (en: string, ar: string | null): Txt => ({ en, ar: ar || en });
const KSA = new Set(['K', 'S', 'A']);

/** Builds the year/domain tree from flat competency rows. Rows of other frameworks (the older NTQF ones) are left out when `framework` is given. */
export function curriculumTree(rows: CurriculumComp[], framework?: string): CurriculumUnit[] {
  const mine = framework ? rows.filter((r) => !r.framework || r.framework === framework) : rows;
  const kids = new Map<string, CurriculumComp[]>();
  for (const r of mine) if (r.parentCode) kids.set(r.parentCode, [...(kids.get(r.parentCode) ?? []), r]);
  const byCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code, 'en', { numeric: true });
  return mine.filter((u) => u.kind === 'unit' && u.ksa && KSA.has(u.ksa) && u.year)
    .map((u) => ({
      code: u.code, title: t(u.title, u.titleAr), year: u.year!, ksa: u.ksa!,
      items: (kids.get(u.code) ?? []).filter((e) => e.kind === 'element').sort(byCode).map((e) => ({
        code: e.code, title: t(e.title, e.titleAr), ksa: (e.ksa ?? u.ksa)!, year: e.year ?? u.year!, hours: e.hours ?? null,
        level: e.targetLevel ?? null, core: e.coreAttitude ?? null, safety: !!e.safetyCritical,
        criteria: (kids.get(e.code) ?? []).sort(byCode).map((c) => ({ code: c.code, text: t(c.title, c.titleAr) })),
      })),
    }))
    .sort((a, b) => a.year - b.year || 'KSA'.indexOf(a.ksa) - 'KSA'.indexOf(b.ksa));
}

/** The framework a programme's curriculum comes from: the WABYS one when present, else the newest listed. */
export function curriculumFramework(rows: CurriculumComp[]): string | undefined {
  const fw = [...new Set(rows.map((r) => r.framework).filter(Boolean) as string[])];
  return fw.find((f) => f.startsWith('WABYS-')) ?? fw[0];
}
