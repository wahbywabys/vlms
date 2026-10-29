import { LearnerList } from '@/components/LearnerList';
import { requireRole } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';

export const metadata = { title: 'Learners' };

export default async function Page() {
  const s = await requireRole('director');
  const { L } = await getI18n();
  const trade = await currentTrade(s, 'all');
  return <LearnerList institutionId={s.institutionId} trade={trade === 'all' ? null : trade} base="/director/learners" eyebrow={L('Director', 'المدير')} />;
}
