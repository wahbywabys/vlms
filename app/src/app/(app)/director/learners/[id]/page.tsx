import { LearnerProfile } from '@/components/LearnerProfile';
import { requireRole } from '@/lib/auth';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole('director');
  const { id } = await params;
  return <LearnerProfile id={id} institutionId={s.institutionId} back="/director/learners" />;
}
