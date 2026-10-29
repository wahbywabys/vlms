import { RiskClient } from '@/components/RiskClient';
import { PageHead } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';

export const metadata = { title: 'Early warning' };
export const dynamic = 'force-dynamic';

export default async function DirectorRisk() {
  const s = await requireRole('director');
  const trade = await currentTrade(s, 'all');
  const { L } = await getI18n();
  return (
    <div className="page">
      <PageHead eyebrow={L('Director · Learners', 'المدير · المتدربون')} title={L('Early warning', 'الإنذار المبكر')}
        sub={L('Built from workshop rubrics, V-Lab telemetry, theory quizzes, attendance and OJT hours.', 'مبني على تقييمات الورشة وبيانات المعمل الافتراضي والاختبارات النظرية والحضور وساعات التدريب الميداني.')} />
      <RiskClient key={trade} trade={trade} canAck={false} />
    </div>
  );
}
