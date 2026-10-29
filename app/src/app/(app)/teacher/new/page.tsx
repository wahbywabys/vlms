import { PageHead } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { currentTrade } from '@/lib/trade';
import { q } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';
import { QuestionForm } from './QuestionForm';

export const metadata = { title: 'New question' };

export default async function NewQuestion() {
  const s = await requireRole('academic_teacher');
  const trade = await currentTrade(s);
  const { L } = await getI18n();
  const competencies = await q<{ id: string; code: string; title: string; title_ar: string | null }>(
    `SELECT c.id, c.code, c.title, c.title_ar FROM competencies c JOIN competency_frameworks f ON f.id = c.framework_id
      WHERE c.kind = 'element' AND f.trade_id = $1 ORDER BY c.code`, [trade]);
  return (
    <div className="page">
      <PageHead eyebrow={L('Academic teacher · Question bank', 'المعلم الأكاديمي · بنك الأسئلة')} title={L('New question', 'سؤال جديد')}
        sub={L('Write it in both languages. Learners see it in theirs once it is approved.', 'اكتبه باللغتين. يراه المتدربون بلغتهم بعد اعتماده.')} />
      <QuestionForm competencies={competencies} />
    </div>
  );
}
