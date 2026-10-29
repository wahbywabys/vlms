import { Empty, PageHead } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';
import { Quiz, type QuizItem } from './Quiz';

export const metadata = { title: 'Theory quiz' };
export const dynamic = 'force-dynamic';

export default async function QuizPage() {
  const s = await requireRole('student');
  const { L } = await getI18n();
  // Answer keys stay on the server: only stems and options are sent to the browser.
  const rows = await q<{ id: string; type: 'mcq' | 'calculation'; stem: string; body: { stem_ar?: string; unit?: string; options?: QuizItem['options'] }; code: string }>(
    `SELECT qn.id, qn.type::text AS type, v.stem, v.body,
            (SELECT c.code FROM question_competencies qc JOIN competencies c ON c.id = qc.competency_id WHERE qc.question_id = qn.id LIMIT 1) AS code
       FROM questions qn JOIN question_versions v ON v.question_id = qn.id AND v.version = qn.current_version
      WHERE qn.institution_id = $1 AND qn.status = 'approved' AND qn.type IN ('mcq', 'calculation')
      ORDER BY qn.bloom, qn.created_at`, [s.institutionId]);
  const items: QuizItem[] = rows.map((r) => ({ id: r.id, type: r.type, stem: r.stem, stemAr: r.body.stem_ar ?? null, unit: r.body.unit ?? null, code: r.code ?? '', options: r.body.options ?? [] }));
  return (
    <div className="page">
      <PageHead eyebrow={L('Student · Theory', 'الطالب · النظري')} title={L('Motor control theory check', 'اختبار نظري في تحكم المحركات')}
        sub={L('Approved items from your teacher’s question bank, marked on the server.', 'أسئلة معتمدة من بنك أسئلة معلمك، تُصحَّح على الخادم.')} />
      {items.length ? <Quiz items={items} /> : <Empty>{L('No approved questions yet.', 'لا توجد أسئلة معتمدة بعد.')}</Empty>}
    </div>
  );
}
