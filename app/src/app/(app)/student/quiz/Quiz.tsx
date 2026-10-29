'use client';
import { useActionState } from 'react';
import { useL } from '@/components/LangProvider';
import { gradeQuiz } from './actions';

export interface QuizItem { id: string; type: 'mcq' | 'calculation'; stem: string; stemAr: string | null; unit: string | null; code: string;
  options: { id: string; en: string; ar: string }[] }

export function Quiz({ items }: { items: QuizItem[] }) {
  const { L, ar } = useL();
  const [res, action, pending] = useActionState(gradeQuiz, null);
  const r = (id: string) => res?.items.find((x) => x.id === id);
  return (
    <form action={action} className="quiz">
      <input type="hidden" name="ids" value={items.map((i) => i.id).join(',')} />
      {res && (
        <div className={`result-head ${res.score / res.max >= 0.7 ? 'v-pass' : 'v-fail'} panel`} role="status">
          <span className="v-score">{Math.round((100 * res.score) / Math.max(1, res.max))}</span>
          <span><strong>{L(`${res.score} of ${res.max} points`, `${res.score} من ${res.max} نقطة`)}</strong><br />
            <small>{L('Saved to your record. Each answer is evidence on the competency it assesses.', 'حُفظت في سجلك. كل إجابة دليل على الجدارة التي تقيسها.')}</small></span>
        </div>
      )}
      {items.map((it, n) => {
        const got = r(it.id);
        return (
          <section key={it.id} className="panel q-card">
            <div className="q-meta"><span>{L(`Question ${n + 1}`, `السؤال ${n + 1}`)}</span><span className="mono">{it.code}</span>
              {got && <span className={got.correct ? 'saved' : 'bad-text'}>{got.correct ? `✓ ${L('Correct', 'صحيح')}` : `✗ ${L('Not quite', 'غير صحيح')}`}</span>}</div>
            <fieldset disabled={Boolean(res)}>
              <legend>{ar(it.stem, it.stemAr)}</legend>
              {it.type === 'mcq' ? it.options.map((o) => (
                <label key={o.id} className={`q-opt ${got ? (o.id === got.key ? 'correct' : o.id === got.given ? 'wrong' : '') : ''}`}>
                  <input type="radio" name={`q_${it.id}`} value={o.id} required /> {ar(o.en, o.ar)}
                </label>
              )) : (
                <label className="field"><span>{L('Your answer', 'إجابتك')}{it.unit ? ` (${it.unit})` : ''}</span>
                  <input name={`q_${it.id}`} inputMode="decimal" dir="ltr" required style={{ maxWidth: 220 }} />
                  {got && !got.correct && <small className="muted" dir="ltr">{L('Expected', 'المتوقع')}: {String(got.key)} {it.unit}</small>}</label>
              )}
            </fieldset>
          </section>
        );
      })}
      {!res && <button type="submit" className="primary" disabled={pending}>{pending ? L('Marking…', 'جارٍ التصحيح…') : L('Submit answers', 'أرسل الإجابات')}</button>}
      {res && <a className="button" href="/student/quiz">{L('Take it again', 'أعد الاختبار')}</a>}
    </form>
  );
}
