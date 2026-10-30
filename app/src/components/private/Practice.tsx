'use client';
/** Practice: short quizzes from the parts, the lessons' checkpoints, the safety rules and your own mistakes. Kept privately, never graded. */
import { useMemo, useRef, useState } from 'react';
import { newId } from '../locker';
import { usePv } from './ctx';
import { addAttempt, buildQuiz, lessonQuestions, logDay, mistakeQuestions, partQuestions, partsOf, practiceRef, safetyQuestions, type Question, type Source } from './model';
import { Trend } from './Compare';

const SOURCES: { id: Source; en: string; ar: string }[] = [
  { id: 'parts', en: 'Machine parts', ar: 'أجزاء الماكينات' },
  { id: 'lessons', en: 'Lesson checkpoints', ar: 'نقاط تحقق الدروس' },
  { id: 'safety', en: 'Safety rules', ar: 'قواعد السلامة' },
  { id: 'mistakes', en: 'My mistakes', ar: 'أخطائي' },
];
const LENGTHS = [5, 10, 15];

interface Run { qs: Question[]; i: number; picked: (number | null)[]; started: number; sources: Source[]; done?: { secs: number; score: number } }

export function Practice() {
  const { L, pick, state, trade, update, add, attempts, lang } = usePv();
  const [sources, setSources] = useState<Source[]>(['parts', 'lessons', 'safety']);
  const [n, setN] = useState(10);
  const [run, setRun] = useState<Run | null>(null);
  const [keep, setKeep] = useState(true);
  const savedMistakes = useRef(new Set<string>());

  const pools = useMemo<Record<Source, Question[]>>(() => ({
    parts: partQuestions(trade.models.flatMap((m) => partsOf(m, trade))),
    lessons: lessonQuestions(trade.lessons),
    safety: safetyQuestions(trade.safety),
    mistakes: mistakeQuestions(state.items),
  }), [trade, state.items]);

  const start = (src = sources) => {
    const qs = buildQuiz(pools, src, n);
    savedMistakes.current = new Set();
    setRun({ qs, i: 0, picked: qs.map(() => null), started: Date.now(), sources: src });
  };

  const saveMistake = (q: Question) => {
    if (savedMistakes.current.has(q.id) || q.source === 'mistakes') return;
    savedMistakes.current.add(q.id);
    add({ kind: 'mistake', title: q.prompt, body: `${pick(q.options[q.answer])}${q.explain ? `\n${pick(q.explain)}` : ''}`, ref: { q: q.id },
      value: { q }, tags: [q.context ? pick(q.context) : '', L('Mistake', 'خطأ')].filter(Boolean) });
  };

  const choose = (k: number) => {
    if (!run || run.picked[run.i] !== null) return;
    const q = run.qs[run.i]!;
    if (k !== q.answer && keep) saveMistake(q);
    setRun({ ...run, picked: run.picked.map((p, j) => (j === run.i ? k : p)) });
  };

  const next = () => {
    if (!run) return;
    if (run.i + 1 < run.qs.length) { setRun({ ...run, i: run.i + 1 }); return; }
    const right = run.qs.filter((q, j) => run.picked[j] === q.answer).length;
    const score = Math.round((100 * right) / run.qs.length);
    const secs = Math.round((Date.now() - run.started) / 1000);
    const bySource = SOURCES.filter((s) => run.qs.some((q) => q.source === s.id)).map((s) => {
      const qs = run.qs.map((q, j) => ({ q, ok: run.picked[j] === q.answer })).filter((x) => x.q.source === s.id);
      return { key: s.id, label: { en: s.en, ar: s.ar }, score: Math.round((100 * qs.filter((x) => x.ok).length) / qs.length) };
    });
    const names = run.sources.map((s) => SOURCES.find((x) => x.id === s)!);
    // Stored straight into the space (not through the page-wide event), so "vs last time" sees it at once.
    const attempt = { id: newId(), at: new Date().toISOString(), kind: 'practice' as const, ref: practiceRef(run.sources), score, mode: `${run.qs.length}q`,
      title: { en: `Practice · ${names.map((x) => x.en).join(', ')}`, ar: `تدريب · ${names.map((x) => x.ar).join('، ')}` },
      criteria: bySource, detail: { en: `${right}/${run.qs.length} right in ${fmtSecs(secs, 'en')}`, ar: `${right}/${run.qs.length} صحيحة في ${fmtSecs(secs, 'ar')}` } };
    update((s) => logDay(addAttempt(s, attempt), { practice: 1 }));
    setRun({ ...run, done: { secs, score } });
  };

  if (!run) {
    const ref = practiceRef(sources);
    const past = attempts.filter((a) => a.kind === 'practice' && a.ref === ref);
    return (
      <div className="pv-grid pv-practice-setup">
        <section className="pv-card">
          <h2>{L('Set up a practice round', 'جهّز جولة تدريب')}</h2>
          <p className="pv-hint">{L('Nobody sees these scores. Get it wrong here so you get it right on the floor.', 'لا أحد يرى هذه الدرجات. أخطئ هنا لتصيب على أرضية الورشة.')}</p>
          <fieldset className="pv-sources">
            <legend>{L('Questions from', 'الأسئلة من')}</legend>
            {SOURCES.map((s) => (
              <label key={s.id} className={pools[s.id].length ? '' : 'is-off'}>
                <input type="checkbox" checked={sources.includes(s.id)} disabled={!pools[s.id].length}
                  onChange={(e) => setSources((xs) => (e.target.checked ? [...xs, s.id] : xs.filter((x) => x !== s.id)))} />
                <span><b>{L(s.en, s.ar)}</b><small>{L(`${pools[s.id].length} questions`, `${pools[s.id].length} سؤال`)}</small></span>
              </label>
            ))}
          </fieldset>
          <div className="pv-seg" role="radiogroup" aria-label={L('Length', 'عدد الأسئلة')}>
            {LENGTHS.map((x) => <button key={x} type="button" role="radio" aria-checked={n === x} onClick={() => setN(x)}>{x} {L('questions', 'أسئلة')}</button>)}
          </div>
          <label className="pv-check"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />{L('Keep what I get wrong in my locker, to practise again', 'احفظ ما أخطئ فيه في خزانتي لأتدرب عليه مرة أخرى')}</label>
          <div className="pv-actions">
            <button type="button" className="pv-primary" disabled={!sources.some((s) => pools[s].length)} onClick={() => start()}>{L('Start practice', 'ابدأ التدريب')}</button>
            {pools.mistakes.length > 0 && <button type="button" onClick={() => start(['mistakes'])}>{L(`Redo my ${pools.mistakes.length} mistakes`, `أعد أخطائي (${pools.mistakes.length})`)}</button>}
          </div>
        </section>
        <section className="pv-card">
          <h2>{L('This mix, over time', 'هذه المجموعة عبر الوقت')}</h2>
          {past.length ? <Trend points={[...past].reverse().map((a) => ({ at: a.at, score: a.score }))} /> : <p className="pv-empty">{L('Your scores for this mix of questions will show here.', 'ستظهر هنا درجاتك لهذه المجموعة من الأسئلة.')}</p>}
          <p className="pv-hint">{lang === 'ar' ? 'كل جولة تُحفظ في «قارن» لتقارن أي جولتين.' : 'Every round is kept under Compare, so you can put any two side by side.'}</p>
        </section>
      </div>
    );
  }

  if (run.done) {
    const prev = attempts.filter((a) => a.kind === 'practice' && a.ref === practiceRef(run.sources))[1];
    const diff = prev ? run.done.score - prev.score : null;
    return (
      <section className="pv-card pv-result">
        <div className="pv-result-head">
          <span className={`pv-score big ${run.done.score >= 80 ? 'ok' : run.done.score >= 50 ? 'mid' : 'low'}`}>{run.done.score}</span>
          <div>
            <h2>{run.done.score >= 80 ? L('Strong round', 'جولة قوية') : run.done.score >= 50 ? L('Getting there', 'تقترب') : L('Good practice: now you know what to study', 'تدريب مفيد: الآن تعرف ماذا تذاكر')}</h2>
            <p>{fmtSecs(run.done.secs, lang)}{diff !== null && <> · <b className={diff >= 0 ? 'pv-up' : 'pv-down'}>{diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}</b> {L('vs last time', 'مقارنة بالمرة السابقة')}</>}</p>
          </div>
        </div>
        <ol className="pv-review">
          {run.qs.map((q, j) => {
            const ok = run.picked[j] === q.answer;
            return (
              <li key={q.id} className={ok ? 'ok' : 'bad'}>
                <span>{ok ? '✓' : '✗'}</span>
                <div><b>{pick(q.prompt)}</b>{!ok && <small>{L('Answer', 'الإجابة')}: {pick(q.options[q.answer])}</small>}</div>
                {!ok && !keep && q.source !== 'mistakes' && <button type="button" className="pv-ghost" onClick={() => saveMistake(q)}>{L('Keep', 'احفظ')}</button>}
              </li>
            );
          })}
        </ol>
        <div className="pv-actions">
          <button type="button" className="pv-primary" onClick={() => start(run.sources)}>{L('Another round', 'جولة أخرى')}</button>
          <button type="button" onClick={() => setRun(null)}>{L('Change questions', 'غيّر الأسئلة')}</button>
        </div>
      </section>
    );
  }

  const q = run.qs[run.i]!;
  const picked = run.picked[run.i];
  return (
    <section className="pv-card pv-quiz">
      <div className="pv-progress"><span style={{ inlineSize: `${(100 * run.i) / run.qs.length}%` }} /><small>{run.i + 1} / {run.qs.length}</small></div>
      {q.context && <p className="pv-eyebrow">{pick(q.context)} · {L(SOURCES.find((s) => s.id === q.source)!.en, SOURCES.find((s) => s.id === q.source)!.ar)}</p>}
      <h2>{pick(q.prompt)}</h2>
      <div className="pv-options" role="radiogroup">
        {q.options.map((o, k) => {
          const cls = picked === null ? '' : k === q.answer ? 'is-right' : k === picked ? 'is-wrong' : 'is-dim';
          return <button key={k} type="button" role="radio" aria-checked={picked === k} className={cls} onClick={() => choose(k)} disabled={picked !== null}>
            <span>{String.fromCharCode(65 + k)}</span>{pick(o)}</button>;
        })}
      </div>
      {picked !== null && (
        <div className={`pv-feedback ${picked === q.answer ? 'ok' : 'bad'}`} role="status">
          <b>{picked === q.answer ? L('Right.', 'صحيح.') : L('Not quite.', 'ليس تمامًا.')}</b> {q.explain && pick(q.explain)}
          {picked !== q.answer && keep && q.source !== 'mistakes' && <small>{L('Kept in your locker under My mistakes.', 'حُفظ في خزانتك ضمن أخطائي.')}</small>}
        </div>
      )}
      <div className="pv-actions">
        <button type="button" className="pv-primary" disabled={picked === null} onClick={next}>{run.i + 1 < run.qs.length ? L('Next', 'التالي') : L('See my result', 'اعرض نتيجتي')}</button>
        <button type="button" className="pv-ghost" onClick={() => setRun(null)}>{L('Stop', 'توقف')}</button>
      </div>
    </section>
  );
}

const fmtSecs = (s: number, lang: 'en' | 'ar') => {
  const m = Math.floor(s / 60), r = s % 60;
  return lang === 'ar' ? `${m ? `${m} د ` : ''}${r} ث` : `${m ? `${m} min ` : ''}${r} s`;
};
