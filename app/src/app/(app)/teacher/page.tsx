import Link from 'next/link';
import { Empty, PageHead, Stat } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { tx } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';
import { setQuestionStatus } from './actions';

export const metadata = { title: 'Question bank' };
export const dynamic = 'force-dynamic';

const STATUS = { draft: tx('Draft', 'مسودة'), in_review: tx('In review', 'قيد المراجعة'), approved: tx('Approved', 'معتمد'), retired: tx('Retired', 'مسحوب') };
const TYPE = { mcq: tx('Multiple choice', 'اختيار من متعدد'), calculation: tx('Calculation', 'حسابي') } as Record<string, { en: string; ar: string }>;
const BLOOM: Record<string, { en: string; ar: string }> = {
  remember: tx('Remember', 'تذكّر'), understand: tx('Understand', 'فهم'), apply: tx('Apply', 'تطبيق'),
  analyze: tx('Analyse', 'تحليل'), evaluate: tx('Evaluate', 'تقويم'), create: tx('Create', 'إبداع'),
};

export default async function QuestionBank({ searchParams }: { searchParams: Promise<{ status?: string; created?: string }> }) {
  const s = await requireRole('academic_teacher');
  const { L, pick, date } = await getI18n();
  const sp = await searchParams;
  const trade = await currentTrade(s);
  const filter = sp.status && sp.status in STATUS ? sp.status : null;
  const rows = await q<{ id: string; type: string; bloom: string; status: keyof typeof STATUS; ai_generated: boolean; stem: string; stem_ar: string | null;
    codes: string[]; author: string; reviewer: string | null; updated_at: Date; attempts: number; p: number | null }>(
    `SELECT qn.id, qn.type::text AS type, qn.bloom::text AS bloom, qn.status, qn.ai_generated, v.stem, v.body->>'stem_ar' AS stem_ar,
            ARRAY(SELECT c.code FROM question_competencies qc JOIN competencies c ON c.id = qc.competency_id WHERE qc.question_id = qn.id) AS codes,
            a.full_name AS author, r.full_name AS reviewer, qn.updated_at,
            (SELECT count(*)::int FROM question_attempts t WHERE t.question_id = qn.id) AS attempts,
            (SELECT round(avg(CASE WHEN t.is_correct THEN 1.0 ELSE 0 END), 2)::float FROM question_attempts t WHERE t.question_id = qn.id) AS p
       FROM questions qn JOIN question_versions v ON v.question_id = qn.id AND v.version = qn.current_version
       JOIN users a ON a.id = qn.author_id LEFT JOIN users r ON r.id = qn.reviewed_by
      WHERE qn.institution_id = $1 AND ($2::text IS NULL OR qn.status::text = $2)
        AND (NOT EXISTS (SELECT 1 FROM question_competencies qc WHERE qc.question_id = qn.id)
             OR EXISTS (SELECT 1 FROM question_competencies qc JOIN competencies c ON c.id = qc.competency_id
                        JOIN competency_frameworks f ON f.id = c.framework_id WHERE qc.question_id = qn.id AND f.trade_id = $3))
      ORDER BY array_position(ARRAY['in_review','draft','approved','retired'], qn.status::text), qn.updated_at DESC`,
    [s.institutionId, filter, trade]);
  const counts = await q<{ status: string; n: number }>(
    `SELECT qn.status::text, count(*)::int AS n FROM questions qn WHERE qn.institution_id = $1
        AND (NOT EXISTS (SELECT 1 FROM question_competencies qc WHERE qc.question_id = qn.id)
             OR EXISTS (SELECT 1 FROM question_competencies qc JOIN competencies c ON c.id = qc.competency_id
                        JOIN competency_frameworks f ON f.id = c.framework_id WHERE qc.question_id = qn.id AND f.trade_id = $2)) GROUP BY 1`, [s.institutionId, trade]);
  const n = (k: string) => counts.find((c) => c.status === k)?.n ?? 0;

  return (
    <div className="page">
      <PageHead eyebrow={L('Academic teacher · Assessment', 'المعلم الأكاديمي · التقييم')} title={L('Question bank', 'بنك الأسئلة')}
        sub={L('Items move from draft to review to approved. AI-drafted items cannot be approved without a named human reviewer (enforced by the database).',
          'تنتقل الأسئلة من مسودة إلى مراجعة إلى اعتماد. لا يمكن اعتماد سؤال مولّد بالذكاء الاصطناعي دون مراجع بشري مسمّى (تفرضه قاعدة البيانات).')}>
        <Link className="button primary" href="/teacher/new">{L('New question', 'سؤال جديد')}</Link>
      </PageHead>
      {sp.created && <p className="notice notice-info" role="status">{L('Question saved.', 'تم حفظ السؤال.')}</p>}
      <div className="kpis">
        <Stat label={pick(STATUS.approved)} value={n('approved')} sub={L('live in learner quizzes', 'متاحة في اختبارات المتدربين')} />
        <Stat label={pick(STATUS.in_review)} value={n('in_review')} tone={n('in_review') ? 'warn' : undefined} sub={L('waiting for you', 'بانتظارك')} />
        <Stat label={pick(STATUS.draft)} value={n('draft')} />
        <Stat label={pick(STATUS.retired)} value={n('retired')} />
      </div>
      <nav className="tabs" aria-label={L('Filter', 'تصفية')}>
        <Link className="button" href="/teacher" aria-current={!filter ? 'page' : undefined}>{L('All', 'الكل')}</Link>
        {Object.entries(STATUS).map(([k, v]) => <Link key={k} className="button" href={`/teacher?status=${k}`} aria-current={filter === k ? 'page' : undefined}>{pick(v)}</Link>)}
      </nav>
      <section className="panel">
        {rows.length === 0 ? <Empty>{L('No questions here.', 'لا توجد أسئلة هنا.')}</Empty> : (
          <div className="scroll-x">
            <table className="data">
              <thead><tr><th>{L('Question', 'السؤال')}</th><th>{L('Type · Bloom', 'النوع · بلوم')}</th><th>{L('Competency', 'الجدارة')}</th>
                <th className="num">{L('Attempts · p', 'المحاولات · p')}</th><th>{L('Status', 'الحالة')}</th><th>{L('Action', 'إجراء')}</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ maxWidth: 460 }}>{L(r.stem, r.stem_ar ?? r.stem)}{r.ai_generated && <span className="ai-tag">{L('AI draft', 'مسودة ذكاء اصطناعي')}</span>}
                    <br /><span className="muted small">{r.author}{r.reviewer ? ` · ${L('reviewed by', 'راجعه')} ${r.reviewer}` : ''} · {date(r.updated_at)}</span></td>
                  <td>{pick(TYPE[r.type] ?? tx(r.type, r.type))}<br /><span className="muted small">{pick(BLOOM[r.bloom] ?? tx(r.bloom, r.bloom))}</span></td>
                  <td className="mono small">{r.codes.join(', ')}</td>
                  <td className="num">{r.attempts}{r.p !== null ? ` · ${r.p.toFixed(2)}` : ''}</td>
                  <td><span className={`status st-${r.status}`}>{pick(STATUS[r.status])}</span></td>
                  <td>
                    <form action={setQuestionStatus} className="form-actions">
                      <input type="hidden" name="id" value={r.id} />
                      {r.status === 'draft' && <button name="to" value="in_review">{L('Send to review', 'أرسل للمراجعة')}</button>}
                      {r.status === 'in_review' && <><button name="to" value="approved" className="primary">{L('Approve', 'اعتماد')}</button>
                        <button name="to" value="draft" className="ghost">{L('Back to draft', 'إعادة لمسودة')}</button></>}
                      {r.status === 'approved' && <button name="to" value="retired" className="ghost">{L('Retire', 'سحب')}</button>}
                      {r.status === 'retired' && <button name="to" value="draft" className="ghost">{L('Reopen', 'إعادة فتح')}</button>}
                    </form>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
