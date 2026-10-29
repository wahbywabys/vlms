import { LearnerList } from '@/components/LearnerList';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';

export const metadata = { title: 'Learners' };

export default async function Page() {
  const s = await requireRole('vocational_trainer');
  const { L } = await getI18n();
  return <LearnerList institutionId={s.institutionId} base="/trainer/learners" eyebrow={L('Trainer', 'المدرب')} />;
}
