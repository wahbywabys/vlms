'use client';
/** My desk: today's plan, a focus timer, goals, the week at a glance and what is pinned. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePv } from './ctx';
import { KindIcon, KIND_LABEL } from './Locker';
import { deckStats, lastDays, logDay, partsOf, streak, studyQueue, type Goal } from './model';
import { newId } from '../locker';

export function Desk() {
  const { L, pick, state, trade, go, attempts, date } = usePv();
  const parts = useMemo(() => trade.models.flatMap((m) => partsOf(m, trade)).filter((p) => p.what), [trade]);
  const deck = deckStats(parts, state.cards);
  const queue = studyQueue(parts, state.cards).length;
  const week = lastDays(state, 7);
  const weekMins = week.reduce((n, d) => n + d.log.mins, 0);
  const days = streak(state);
  const practice = attempts.filter((a) => a.kind === 'practice');
  const best = practice.length ? Math.max(...practice.map((a) => a.score)) : null;
  const pinned = state.items.filter((i) => i.pinned);
  const recent = attempts.slice(0, 5);

  return (
    <div className="pv-desk">
      <ul className="pv-kpis">
        <li><span>{L('Cards to review today', 'بطاقات للمراجعة اليوم')}</span><b>{queue}</b>
          <small>{L(`${deck.mastered} of ${deck.total} parts mastered`, `أتقنت ${deck.mastered} من ${deck.total} قطعة`)}</small></li>
        <li><span>{L('In my locker', 'في خزانتي')}</span><b>{state.items.length}</b>
          <small>{L(`${pinned.length} pinned`, `${pinned.length} مثبّتة`)}</small></li>
        <li><span>{L('Focused study this week', 'مذاكرة مركّزة هذا الأسبوع')}</span><b>{weekMins}<i>{L(' min', ' د')}</i></b>
          <small>{L(`${week.reduce((n, d) => n + d.log.reviews, 0)} cards reviewed`, `${week.reduce((n, d) => n + d.log.reviews, 0)} بطاقة روجعت`)}</small></li>
        <li><span>{L('Study streak', 'أيام متتالية')}</span><b>{days}<i>{L(days === 1 ? ' day' : ' days', ' يوم')}</i></b>
          <small>{days ? L('Keep it going today', 'حافظ عليها اليوم') : L('Study today to start one', 'ذاكر اليوم لتبدأ')}</small></li>
        <li><span>{L('Best practice score', 'أفضل نتيجة تدريب')}</span><b>{best ?? '—'}{best !== null && <i>%</i>}</b>
          <small>{L(`${practice.length} practice runs`, `${practice.length} جولات تدريب`)}</small></li>
      </ul>

      <div className="pv-grid">
        <section className="pv-card pv-today">
          <h2>{L('Today', 'اليوم')}</h2>
          <div className="pv-next">
            <button type="button" className="pv-big" onClick={() => go('study')} disabled={!queue}>
              <b>{queue ? L(`Review ${queue} cards`, `راجع ${queue} بطاقة`) : L('All cards reviewed', 'راجعت كل البطاقات')}</b>
              <small>{L(`${trade.models.length} machines of ${trade.name.en}`, `${trade.models.length} ماكينات في ${trade.name.ar}`)}</small>
            </button>
            <button type="button" className="pv-big" onClick={() => go('practice')}>
              <b>{L('Quick practice', 'تدريب سريع')}</b>
              <small>{L('10 questions, not graded', '10 أسئلة بدون تقييم')}</small>
            </button>
            <button type="button" className="pv-big" onClick={() => go('compare')}>
              <b>{L('Compare my attempts', 'قارن محاولاتي')}</b>
              <small>{L(`${attempts.length} attempts kept`, `${attempts.length} محاولة محفوظة`)}</small>
            </button>
          </div>
          <Goals />
        </section>

        <section className="pv-card">
          <h2>{L('Focus timer', 'مؤقّت التركيز')}</h2>
          <FocusTimer />
        </section>

        <section className="pv-card">
          <h2>{L('My week', 'أسبوعي')}</h2>
          <WeekChart />
        </section>

        <section className="pv-card">
          <h2>{L('Pinned', 'المثبّتة')}</h2>
          {pinned.length ? (
            <ul className="pv-list">
              {pinned.slice(0, 6).map((i) => (
                <li key={i.id}><button type="button" className="pv-row" onClick={() => go('locker', { item: i.id })}>
                  <KindIcon kind={i.kind} /><span><b>{pick(i.title)}</b><small>{pick(KIND_LABEL[i.kind])} · {date(i.at)}</small></span>
                </button></li>
              ))}
            </ul>
          ) : <p className="pv-empty">{L('Pin anything in your locker to keep it here.', 'ثبّت أي شيء في خزانتك ليظهر هنا.')}</p>}
        </section>

        <section className="pv-card">
          <h2>{L('Latest attempts', 'آخر المحاولات')}</h2>
          {recent.length ? (
            <ul className="pv-list">
              {recent.map((a) => (
                <li key={a.id}><button type="button" className="pv-row" onClick={() => go('compare', { compare: a.ref })}>
                  <span className={`pv-score ${a.score >= 80 ? 'ok' : a.score >= 50 ? 'mid' : 'low'}`}>{Math.round(a.score)}</span>
                  <span><b>{pick(a.title)}</b><small>{pick(KIND_ATTEMPT[a.kind])} · {date(a.at, true)}</small></span>
                </button></li>
              ))}
            </ul>
          ) : <p className="pv-empty">{L('Finish a lesson, a safety run, a V-Lab attempt or a practice quiz and it is kept here for you.',
            'أكمل درسًا أو محاكاة سلامة أو محاولة في المعمل الافتراضي أو تدريبًا، وستُحفظ هنا لك.')}</p>}
        </section>
      </div>
    </div>
  );
}

export const KIND_ATTEMPT = {
  vlab: { en: 'V-Lab', ar: 'المعمل الافتراضي' },
  lesson: { en: 'Lesson', ar: 'درس' },
  safety: { en: 'Safety simulator', ar: 'محاكي السلامة' },
  practice: { en: 'Practice', ar: 'تدريب' },
};

function Goals() {
  const { L, state, update } = usePv();
  const [text, setText] = useState('');
  const set = (f: (g: Goal[]) => Goal[]) => update((s) => ({ ...s, goals: f(s.goals) }));
  const open = state.goals.filter((g) => !g.done);
  const done = state.goals.filter((g) => g.done);
  return (
    <div className="pv-goals">
      <h3>{L('My goals', 'أهدافي')} <small>{done.length}/{state.goals.length}</small></h3>
      <ul>
        {[...open, ...done].map((g) => (
          <li key={g.id} className={g.done ? 'is-done' : ''}>
            <label><input type="checkbox" checked={g.done} onChange={() => set((gs) => gs.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)))} />
              <span>{g.text}</span></label>
            <button type="button" className="pv-x" aria-label={L('Remove goal', 'احذف الهدف')} onClick={() => set((gs) => gs.filter((x) => x.id !== g.id))}>×</button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (!t) return; set((gs) => [...gs, { id: newId(), text: t.slice(0, 160), done: false, at: new Date().toISOString() }]); setText(''); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Add a goal, e.g. “Name every part of the lathe by Thursday”', 'أضف هدفًا، مثل «أعرف كل أجزاء المخرطة قبل الخميس»')}
          aria-label={L('New goal', 'هدف جديد')} maxLength={160} />
        <button type="submit" disabled={!text.trim()}>{L('Add', 'أضف')}</button>
      </form>
    </div>
  );
}

const PRESETS = [15, 25, 45];

function FocusTimer() {
  const { L, update, trade, pick } = usePv();
  const [mins, setMins] = useState(25);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [topic, setTopic] = useState('');
  const logged = useRef(0);
  const total = mins * 60;

  useEffect(() => {
    if (!running) return;
    const end = Date.now() + left * 1000;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setRunning(false);
    }, 500);
    return () => clearInterval(t);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // Log whole minutes as they pass, so stopping early still counts.
  useEffect(() => {
    const done = Math.floor((total - left) / 60);
    if (done > logged.current) { update((s) => logDay(s, { mins: done - logged.current })); logged.current = done; }
  }, [left, total, update]);

  const reset = (m = mins) => { setRunning(false); setMins(m); setLeft(m * 60); logged.current = 0; };
  const pct = 1 - left / total;
  const R = 54, C = 2 * Math.PI * R;
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  return (
    <div className="pv-timer">
      <svg viewBox="0 0 128 128" className="pv-ring" role="img" aria-label={L(`${mm}:${ss} left`, `متبقٍ ${mm}:${ss}`)}>
        <circle cx="64" cy="64" r={R} className="pv-ring-bg" />
        <circle cx="64" cy="64" r={R} className="pv-ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 64 64)" />
        <text x="64" y="70" textAnchor="middle" direction="ltr">{mm}:{ss}</text>
      </svg>
      <div className="pv-timer-side">
        <div className="pv-seg" role="radiogroup" aria-label={L('Length', 'المدة')}>
          {PRESETS.map((m) => <button key={m} type="button" role="radio" aria-checked={mins === m} disabled={running} onClick={() => reset(m)}>{m} {L('min', 'د')}</button>)}
        </div>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={L(`What are you studying? e.g. ${pick(trade.models[0]?.title).split(' · ')[0]}`, `ماذا تذاكر؟ مثل ${pick(trade.models[0]?.title).split(' · ')[0]}`)}
          aria-label={L('Topic', 'الموضوع')} maxLength={80} />
        <div className="pv-actions">
          {left === 0 ? <button type="button" className="pv-primary" onClick={() => reset()}>{L('Done! Start another', 'أحسنت! ابدأ جلسة أخرى')}</button> : (
            <button type="button" className="pv-primary" onClick={() => setRunning((r) => !r)}>{running ? L('Pause', 'إيقاف مؤقت') : left < total ? L('Resume', 'استئناف') : L('Start focusing', 'ابدأ التركيز')}</button>
          )}
          <button type="button" onClick={() => reset()} disabled={left === total}>{L('Reset', 'إعادة')}</button>
        </div>
        <p className="pv-hint">{L('Phone face down, one topic, then a 5-minute break. Every minute counts towards your week.',
          'ضع الهاتف مقلوبًا، موضوع واحد، ثم استراحة 5 دقائق. كل دقيقة تُحسب في أسبوعك.')}</p>
      </div>
    </div>
  );
}

function WeekChart() {
  const { L, state, lang } = usePv();
  const week = lastDays(state, 7);
  const max = Math.max(30, ...week.map((d) => d.log.mins));
  const day = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short' });
  return (
    <div className="pv-week">
      <ul aria-label={L('Minutes of focused study and cards reviewed, last 7 days', 'دقائق المذاكرة المركّزة والبطاقات المراجعة، آخر 7 أيام')}>
        {week.map((d, i) => (
          <li key={d.key} className={i === 6 ? 'is-today' : ''}>
            {d.log.reviews + d.log.practice > 0 ? <i title={L(`${d.log.reviews} cards · ${d.log.practice} practice`, `${d.log.reviews} بطاقة · ${d.log.practice} تدريب`)}>{d.log.reviews + d.log.practice}</i> : <span />}
            <span className="pv-bar" style={{ blockSize: `${(100 * d.log.mins) / max}%` }} title={`${d.log.mins} min`} />
            <b>{d.log.mins || ''}</b>
            <small>{day.format(d.date)}</small>
          </li>
        ))}
      </ul>
      <p className="pv-hint">{L('Bars: focused minutes. Dots: cards reviewed and practice runs.', 'الأعمدة: دقائق التركيز. الدوائر: البطاقات المراجعة وجولات التدريب.')}</p>
    </div>
  );
}
