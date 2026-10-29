import { PageHead } from '@/components/ui';
import type { MachineRow } from '@/components/modules/WorkshopBoards';
import { callApi } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';
import { MachinesClient } from './MachinesClient';

export const metadata = { title: 'Machines' };
export const dynamic = 'force-dynamic';

export default async function MachinesPage() {
  const s = await requireRole('vocational_trainer');
  const trade = await currentTrade(s);
  const { L } = await getI18n();
  const { machines } = await callApi<{ machines: MachineRow[] }>(s, `/v1/safety/machines?trade=${trade}`).catch(() => ({ machines: [] as MachineRow[] }));
  return (
    <div className="page">
      <PageHead eyebrow={L('Trainer · Workshop', 'المدرب · الورشة')} title={L('Machines & safety passports', 'الماكينات وتصاريح السلامة')}
        sub={L('A machine unlocks only for a learner with the competency and a passed pre-check. Stop any session remotely.', 'لا تُفتح الماكينة إلا لمتدرب لديه الجدارة واجتاز الفحص المسبق. أوقف أي جلسة عن بُعد.')} />
      <MachinesClient key={trade} trade={trade} initial={machines} />
    </div>
  );
}
