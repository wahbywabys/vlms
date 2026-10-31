import { CurriculumView } from '@/components/CurriculumView';
import { PageHead } from '@/components/ui';
import { requireRole, type Role } from '@/lib/auth';
import { loadCurriculum } from '@/lib/curriculum';
import { getI18n } from '@/lib/i18n-server';
import type { Txt } from '@/lib/i18n';
import { currentTrade } from '@/lib/trade';

/** Server page body shared by "My programme" (student) and "Curriculum" (trainer, teacher). */
export async function CurriculumPage({ role, mode, eyebrow, title, sub }: { role: Role; mode: 'own' | 'pick'; eyebrow: Txt; title: Txt; sub: Txt }) {
  const s = await requireRole(role);
  const { pick, L } = await getI18n();
  const cur = await loadCurriculum(await currentTrade(s, mode));
  return (
    <div className="page">
      <PageHead eyebrow={pick(eyebrow)} title={pick(title)} sub={pick(sub)} />
      {cur ? <CurriculumView {...cur} /> : <p className="notice">{L('Programme not found.', 'التخصص غير موجود.')}</p>}
    </div>
  );
}
