import { PageHead } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';
import { QuestionForm } from './QuestionForm';

export const metadata = { title: 'New question' };

export default async function NewQuestion() {
  await requireRole('academic_teacher');
  const { L } = await getI18n();
  const competencies = await q<{ id: string; code: string; title: string; title_ar: string | null }>(
    `SELECT id, code, title, title_ar FROM competencies WHERE kind = 'element' ORDER BY code`);
  return (
    <div className="page">
      <PageHead eyebrow={L('Academic teacher · Question bank', 'المعلم الأكاديمي · بنك الأسئلة')} title={L('New question', 'سؤال جديد')}
        sub={L('Write it in both languages. Learners see it in theirs once it is approved.', 'اكتبه باللغتين. يراه المتدربون بلغتهم بعد اعتماده.')} />
      <QuestionForm competencies={competencies} />
    </div>
  );
}
