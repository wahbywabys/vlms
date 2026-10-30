import { PageHead } from '@/components/ui';
import { callApi } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';
import { RegisterClient, type Center, type RegMachine } from './RegisterClient';

export const metadata = { title: 'Machine register' };
export const dynamic = 'force-dynamic';

export default async function MachineRegisterPage() {
  const s = await requireRole('director');
  const { L } = await getI18n();
  const [m, c] = await Promise.all([
    callApi<{ machines: RegMachine[] }>(s, '/v1/admin/machines').catch(() => ({ machines: [] as RegMachine[] })),
    callApi<{ centers: Center[] }>(s, '/v1/admin/centers').catch(() => ({ centers: [] as Center[] })),
  ]);
  return (
    <div className="page">
      <PageHead eyebrow={L('Director · Administration', 'المدير · الإدارة')} title={L('Machine register', 'سجل الماكينات')}
        sub={L('Every real machine in every centre, linked to the 3D twin learners practise on. Import the inventory template, then print a QR sticker for each machine.',
          'كل ماكينة حقيقية في كل مركز، مربوطة بالنموذج ثلاثي الأبعاد الذي يتدرب عليه المتدرب. استورد نموذج الحصر ثم اطبع ملصق QR لكل ماكينة.')} />
      <RegisterClient initial={m.machines} centers={c.centers} />
    </div>
  );
}
