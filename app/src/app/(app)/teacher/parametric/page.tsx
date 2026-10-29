import { PageHead } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';
import { ParametricClient } from './ParametricClient';

export const metadata = { title: 'Parameterised question' };

export default async function ParametricPage() {
  const s = await requireRole('academic_teacher');
  const trade = await currentTrade(s);
  const { L, ar } = await getI18n();
  const competencies = await q<{ id: string; code: string; title: string; title_ar: string | null }>(
    `SELECT c.id, c.code, c.title, c.title_ar FROM competencies c JOIN competency_frameworks f ON f.id = c.framework_id
      WHERE c.kind = 'element' AND f.trade_id = $1 ORDER BY c.code`, [trade]);
  return (
    <div className="page">
      <PageHead eyebrow={L('Academic teacher · Question bank', 'المعلم الأكاديمي · بنك الأسئلة')} title={L('Parameterised calculation', 'مسألة حسابية بمتغيرات')}
        sub={L('Every learner gets their own numbers, so answers cannot be copied, and each is marked against its own tolerance band.', 'يحصل كل متدرب على أرقامه الخاصة فلا يمكن نسخ الإجابات، وتُصحح كل إجابة ضمن نطاق التفاوت الخاص بها.')} />
      <ParametricClient competencies={competencies.map((c) => ({ id: c.id, label: `${c.code} · ${ar(c.title, c.title_ar)}` }))} />
    </div>
  );
}
