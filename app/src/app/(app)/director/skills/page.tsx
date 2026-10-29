import { SkillsClient } from '@/components/SkillsClient';
import type { SkillsData } from '@/components/modules/SkillsHeatmap';
import { PageHead } from '@/components/ui';
import { callApi } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';

export const metadata = { title: 'Skills heatmap' };
export const dynamic = 'force-dynamic';

export default async function SkillsPage() {
  const s = await requireRole('director');
  const trade = await currentTrade(s, 'all');
  const { L } = await getI18n();
  const data = await callApi<SkillsData>(s, `/v1/analytics/skills${trade === 'all' ? '' : `?trade=${trade}`}`).catch(() => ({ units: [], grid: [], flow: [] }));
  const fw = await q<{ name: string }>(`SELECT DISTINCT f.code || ' · ' || f.issuing_body AS name FROM competency_frameworks f WHERE ($1 = 'all' OR f.trade_id = $1) ORDER BY 1`, [trade]);
  return (
    <div className="page">
      <PageHead eyebrow={L('Director · Quality', 'المدير · الجودة')} title={L('Skills heatmap', 'خريطة المهارات')}
        sub={L('Novice → Intermediate → Autonomous → Master against the national occupational standard, by element.', 'مبتدئ ← متوسط ← مستقل ← متمكن مقابل المعيار المهني الوطني، حسب العنصر.')} />
      {data.units.length === 0 ? <p className="notice">{L('No competency data yet for this selection.', 'لا توجد بيانات جدارات لهذا الاختيار بعد.')}</p>
        : <SkillsClient data={data} standard={fw.map((f) => f.name).join(' · ')} />}
    </div>
  );
}
