'use client';
import { useActionState, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { createQuestion } from '../actions';

const ERR: Record<string, [string, string]> = {
  stem: ['Write a question stem of at least 10 characters.', 'اكتب نص سؤال لا يقل عن 10 أحرف.'],
  competency: ['Pick the competency this item assesses.', 'اختر الجدارة التي يقيسها السؤال.'],
  options: ['Give at least two options.', 'أدخل خيارين على الأقل.'],
  correct: ['Mark which option is correct.', 'حدد الخيار الصحيح.'],
  answer: ['Enter the numeric answer.', 'أدخل الإجابة الرقمية.'],
};

export function QuestionForm({ competencies }: { competencies: { id: string; code: string; title: string; title_ar: string | null }[] }) {
  const { L, ar } = useL();
  const [type, setType] = useState<'mcq' | 'calculation'>('mcq');
  const [state, action, pending] = useActionState(createQuestion, null);
  const err = state?.error ? ERR[state.error] : null;
  return (
    <form action={action} className="form panel">
      <div className="form-row">
        <label className="field"><span>{L('Type', 'النوع')}</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value as 'mcq' | 'calculation')}>
            <option value="mcq">{L('Multiple choice', 'اختيار من متعدد')}</option>
            <option value="calculation">{L('Calculation (with tolerance)', 'حسابي (مع تفاوت مسموح)')}</option>
          </select></label>
        <label className="field"><span>{L('Bloom level', 'مستوى بلوم')}</span>
          <select name="bloom" defaultValue="apply">
            {['remember', 'understand', 'apply', 'analyze', 'evaluate'].map((b) => <option key={b} value={b}>{b}</option>)}
          </select></label>
        <label className="field"><span>{L('Competency', 'الجدارة')}</span>
          <select name="competency" defaultValue="">
            <option value="">{L('Choose…', 'اختر…')}</option>
            {competencies.map((c) => <option key={c.id} value={c.id}>{c.code} · {ar(c.title, c.title_ar)}</option>)}
          </select></label>
      </div>
      <label className="field"><span>{L('Stem (English)', 'نص السؤال (إنجليزي)')}</span><textarea name="stem" rows={3} dir="ltr" lang="en" /></label>
      <label className="field"><span>{L('Stem (Arabic)', 'نص السؤال (عربي)')}</span><textarea name="stem_ar" rows={3} dir="rtl" lang="ar" /></label>
      {type === 'mcq' ? (
        <fieldset className="options">
          <legend className="eyebrow">{L('Options · mark the correct one', 'الخيارات · حدّد الصحيح')}</legend>
          {['a', 'b', 'c', 'd'].map((id) => (
            <div key={id} className="option-row">
              <input type="radio" name="correct" value={id} aria-label={L(`Option ${id} is correct`, `الخيار ${id} صحيح`)} />
              <input type="text" name={`opt_${id}`} placeholder={L(`Option ${id.toUpperCase()} (English)`, `الخيار ${id.toUpperCase()} (إنجليزي)`)} dir="ltr" lang="en" />
              <input type="text" name={`opt_${id}_ar`} placeholder={L(`Option ${id.toUpperCase()} (Arabic)`, `الخيار ${id.toUpperCase()} (عربي)`)} dir="rtl" lang="ar" />
            </div>
          ))}
        </fieldset>
      ) : (
        <div className="form-row">
          <label className="field"><span>{L('Answer', 'الإجابة')}</span><input type="text" name="answer" inputMode="decimal" dir="ltr" /></label>
          <label className="field"><span>{L('± Tolerance', '± التفاوت')}</span><input type="text" name="tolerance" inputMode="decimal" dir="ltr" defaultValue="0.1" /></label>
          <label className="field"><span>{L('Unit', 'الوحدة')}</span><input type="text" name="unit" dir="ltr" placeholder="A" /></label>
        </div>
      )}
      {err && <p className="notice notice-danger" role="alert">{L(err[0], err[1])}</p>}
      <div className="form-actions">
        <button type="submit" name="intent" value="review" className="primary" disabled={pending}>{L('Save & send to review', 'حفظ وإرسال للمراجعة')}</button>
        <button type="submit" name="intent" value="draft" disabled={pending}>{L('Save as draft', 'حفظ كمسودة')}</button>
      </div>
    </form>
  );
}
