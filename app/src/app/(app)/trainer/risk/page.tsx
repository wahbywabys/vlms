import { PageHead } from '@/components/ui';
import { RiskClient } from '@/components/RiskClient';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';

export const metadata = { title: 'Early warning' };
export const dynamic = 'force-dynamic';

export default async function TrainerRisk() {
  const s = await requireRole('vocational_trainer');
  const trade = await currentTrade(s);
  const { L } = await getI18n();
  return (
    <div className="page">
      <PageHead eyebrow={L('Trainer · Learners', 'المدرب · المتدربون')} title={L('Early warning', 'الإنذار المبكر')}
        sub={L('Who is likely to struggle at the final practical, and why. Log what you did about it.', 'من يُرجّح أن يتعثر في الاختبار العملي النهائي ولماذا. سجّل ما قمت به حياله.')} />
      <RiskClient key={trade} trade={trade} canAck />
    </div>
  );
}
