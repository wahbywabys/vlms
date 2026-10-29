import { PageHead } from '@/components/ui';
import type { StockRow } from '@/components/modules/WorkshopBoards';
import { callApi } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';
import { StoresClient } from './StoresClient';

export const metadata = { title: 'Stores' };
export const dynamic = 'force-dynamic';

export default async function StoresPage() {
  const s = await requireRole('vocational_trainer');
  const trade = await currentTrade(s);
  const { L } = await getI18n();
  const { consumables } = await callApi<{ consumables: StockRow[] }>(s, `/v1/workshop/consumables?trade=${trade}`).catch(() => ({ consumables: [] as StockRow[] }));
  return (
    <div className="page">
      <PageHead eyebrow={L('Trainer · Workshop', 'المدرب · الورشة')} title={L('Consumables & stores', 'المستهلكات والمخزن')}
        sub={L('Each signed-off job issues its bill of materials. The forecast adds the bookings for the next 7 days.', 'كل مهمة معتمدة تصرف قائمة موادها. التوقع يضيف الحجوزات للأيام السبعة القادمة.')} />
      <StoresClient key={trade} items={consumables} />
    </div>
  );
}
