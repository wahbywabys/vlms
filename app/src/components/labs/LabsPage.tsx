import { requireRole, type Role } from '@/lib/auth';
import { tx, type Txt } from '@/lib/i18n';
import { LEARNING_META } from '@/lib/learningMeta';
import { currentTrade, trades } from '@/lib/trade';
import { LabsBrowser } from './LabsBrowser';

/** Server wrapper: the programmes that have labs, and the one to open first (the learner's own, or the trade bar's). */
export async function LabsPage({ role, mode, eyebrow }: { role: Role; mode: 'own' | 'pick' | 'all'; eyebrow: Txt }) {
  const s = await requireRole(role);
  const [all, current] = await Promise.all([trades(), currentTrade(s, mode)]);
  const programmes = all.filter((t) => LEARNING_META[t.id]).map((t) => ({ id: t.id, code: t.code, name: tx(t.name, t.name_ar ?? t.name) }));
  return <LabsBrowser programmes={programmes} initial={current} eyebrow={eyebrow} />;
}
