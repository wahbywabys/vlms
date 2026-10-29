import { LearnerList } from '@/components/LearnerList';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';

export const metadata = { title: 'Learners' };

export default async function Page() {
  const s = await requireRole('director');
  const { L } = await getI18n();
  return <LearnerList institutionId={s.institutionId} base="/director/learners" eyebrow={L('Director', 'المدير')} />;
}
