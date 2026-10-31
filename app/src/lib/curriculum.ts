import 'server-only';
import { q, q1 } from './db';
import { curriculumFramework, curriculumTree, type CoreAttitude, type CurriculumComp, type ProgramProfile } from './curriculumTree';

/** One programme's curriculum for the read-only pages: profile, the year/K/S/A tree and the seven core attitudes. */
export async function loadCurriculum(tradeId: string) {
  const t = await q1<{ id: string; name: string; name_ar: string | null; program_code: string | null; accent: string | null; profile: ProgramProfile | null }>(
    `SELECT id, name, name_ar, program_code, accent, profile FROM trades WHERE id = $1`, [tradeId]);
  if (!t) return null;
  const rows = await q<CurriculumComp>(
    `SELECT f.code AS framework, c.code, c.kind, p.code AS "parentCode", c.title, c.title_ar AS "titleAr", c.is_safety_critical AS "safetyCritical",
            c.nominal_hours::float AS hours, c.ksa, c.year, c.target_level AS "targetLevel", c.core_attitude AS "coreAttitude"
       FROM competencies c JOIN competency_frameworks f ON f.id = c.framework_id LEFT JOIN competencies p ON p.id = c.parent_id
      WHERE f.trade_id = $1`, [tradeId]);
  const attitudes = await q<CoreAttitude>(`SELECT code, name, name_ar AS "nameAr", indicators, indicators_ar AS "indicatorsAr" FROM core_attitudes ORDER BY code`);
  return {
    name: { en: t.name, ar: t.name_ar ?? t.name }, code: t.program_code, accent: t.accent, profile: t.profile,
    units: curriculumTree(rows, curriculumFramework(rows)), attitudes,
  };
}
