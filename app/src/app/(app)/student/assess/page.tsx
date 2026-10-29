import { PageHead } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';
import { AssessClient } from './AssessClient';

export const metadata = { title: 'Applied assessment' };
export const dynamic = 'force-dynamic';

export default async function AssessPage() {
  const s = await requireRole('student');
  const trade = await currentTrade(s, 'own');
  const { L } = await getI18n();
  return (
    <div className="page">
      <PageHead eyebrow={L('Student · Assessment', 'الطالب · التقييم')} title={L('Applied assessment', 'تقييم تطبيقي')}
        sub={L('Calculations use your own numbers, and you find faults by pinning them on the drawing.', 'المسائل الحسابية بأرقام خاصة بك، وتحدد الأعطال بوضع دبابيس على المخطط.')} />
      <AssessClient trade={trade} />
    </div>
  );
}
