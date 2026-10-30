import { PageHead } from '@/components/ui';
import { callApi } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';
import { ProgramsClient, type Program } from './ProgramsClient';

export const metadata = { title: 'Programmes & skills' };
export const dynamic = 'force-dynamic';

export default async function ProgramsPage() {
  const s = await requireRole('director');
  const { L } = await getI18n();
  const { programs } = await callApi<{ programs: Program[] }>(s, '/v1/admin/programs').catch(() => ({ programs: [] as Program[] }));
  return (
    <div className="page">
      <PageHead eyebrow={L('Director · Administration', 'المدير · الإدارة')} title={L('Programmes & skills', 'التخصصات والمهارات')}
        sub={L('Add a specialisation and its skills (unit → element → criterion) yourself, or import them from the Excel template.',
          'أضف التخصص ومهاراته (وحدة ← عنصر ← معيار) بنفسك، أو استوردها من نموذج Excel.')} />
      <ProgramsClient initial={programs} />
    </div>
  );
}
