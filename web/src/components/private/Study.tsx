/** Study: every machine part as a flashcard on a spaced-repetition schedule, a printable study sheet, and the trade's lessons. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModelDef } from '../../models/kit';
import { usePv } from './ctx';
import { deckStats, isDue, logDay, machineName, MASTERED_BOX, partsOf, review, studyQueue, type CatalogTrade, type LockerItem, type PartInfo } from './model';

type DeckId = 'due' | string;

export function Study() {
  const { L, pick, state, catalog, trade, focus, attempts } = usePv();
  const [others, setOthers] = useState(false);
  const [deckId, setDeckId] = useState<DeckId>('due');
  const [view, setView] = useState<'cards' | 'sheet'>('cards');
  const tradeParts = useMemo(() => trade.models.flatMap((m) => partsOf(m, trade)).filter((p) => p.what), [trade]);
  const decks: { trade: CatalogTrade; model: ModelDef; parts: PartInfo[] }[] = useMemo(() => {
    const ts = others ? [trade, ...catalog.trades.filter((t) => t.id !== trade.id)] : [trade];
    const seen = new Set<string>();
    return ts.flatMap((t) => t.models.filter((m) => !seen.has(m.id) && seen.add(m.id)).map((m) => ({ trade: t, model: m, parts: partsOf(m, t).filter((p) => p.what) })));
  }, [others, trade, catalog]);
  const deck = decks.find((d) => d.model.id === deckId);
  const parts = deck ? deck.parts : tradeParts;

  // Arriving from the locker or compare with a part in mind opens its machine.
  useEffect(() => {
    if (!focus.part) return;
    const id = focus.part.split('/')[0]!;
    if (!decks.some((d) => d.model.id === id)) setOthers(true);
    setDeckId(id);
    setView('cards');
  }, [focus.part]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = deckStats(tradeParts, state.cards);
  return (
    <div className="pv-study">
      <aside className="pv-card pv-decks">
        <h2>{L('My decks', 'مجموعاتي')}</h2>
        <button type="button" className="pv-deck" aria-pressed={deckId === 'due'} onClick={() => setDeckId('due')}>
          <span><b>{L('Due today', 'مستحقة اليوم')}</b><small>{L(`All ${pick(trade.name)} machines`, `كل ماكينات ${pick(trade.name)}`)}</small></span>
          <em>{studyQueue(tradeParts, state.cards).length}</em>
          <Meter n={all.mastered} of={all.total} />
        </button>
        {decks.map((d) => {
          const s = deckStats(d.parts, state.cards);
          return (
            <button key={d.model.id} type="button" className="pv-deck" aria-pressed={deckId === d.model.id} onClick={() => setDeckId(d.model.id)}>
              <span><b>{pick(machineName(d.model))}</b><small>{d.trade.id !== trade.id ? `${pick(d.trade.name)} · ` : ''}{L(`${s.total} parts`, `${s.total} قطعة`)}</small></span>
              <em>{s.due + Math.min(8, s.fresh)}</em>
              <Meter n={s.mastered} of={s.total} />
            </button>
          );
        })}
        <label className="pv-check"><input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} />{L('Also show other trades', 'أظهر التخصصات الأخرى أيضًا')}</label>
        <p className="pv-hint">{L('A card you know comes back in 1, 3, 7 then 14 days. One you miss comes back today.', 'البطاقة التي تعرفها تعود بعد 1 ثم 3 ثم 7 ثم 14 يومًا، والتي تخطئ فيها تعود اليوم.')}</p>
      </aside>

      <div className="pv-study-main">
        <div className="pv-bar-row">
          <h2>{deck ? pick(deck.model.title) : L('Cards due today', 'البطاقات المستحقة اليوم')}</h2>
          <div className="pv-seg" role="radiogroup" aria-label={L('View', 'العرض')}>
            <button type="button" role="radio" aria-checked={view === 'cards'} onClick={() => setView('cards')}>{L('Flashcards', 'بطاقات')}</button>
            <button type="button" role="radio" aria-checked={view === 'sheet'} onClick={() => setView('sheet')}>{L('Study sheet', 'ورقة مذاكرة')}</button>
          </div>
        </div>
        {view === 'cards'
          ? <Cards key={`${deckId}:${focus.part ?? ''}`} parts={parts} all={!deck} first={focus.part} />
          : <Sheet parts={parts} title={deck ? pick(deck.model.title) : pick(trade.name)} />}

        <section className="pv-card">
          <h2>{L(`Lessons and simulators · ${trade.name.en}`, `الدروس والمحاكيات · ${trade.name.ar}`)}</h2>
          <ul className="pv-lessons">
            {trade.lessons.map((l) => <LessonRow key={l.id} id={l.id} title={l.title} summary={l.summary} kind="lesson" best={best(attempts, l.id)} />)}
            {trade.safety.map((x) => <LessonRow key={x.id} id={x.id} title={x.title} summary={x.brief} kind="safety" best={best(attempts, x.id)} />)}
          </ul>
        </section>
      </div>
    </div>
  );
}

const best = (as: { ref: string; score: number }[], ref: string) => { const s = as.filter((a) => a.ref === ref).map((a) => a.score); return s.length ? Math.max(...s) : undefined; };

function LessonRow({ id, title, summary, kind, best: b }: { id: string; title: { en: string; ar: string }; summary: { en: string; ar: string }; kind: 'lesson' | 'safety'; best?: number }) {
  const { L, pick, state, add, go } = usePv();
  const saved = state.items.find((i) => i.kind === kind && i.ref?.[kind === 'lesson' ? 'lesson' : 'scenario'] === id);
  return (
    <li>
      <span className={`pv-tag is-${kind}`}>{kind === 'lesson' ? L('Lesson', 'درس') : L('Safety', 'سلامة')}</span>
      <span className="pv-lesson-text"><b>{pick(title)}</b><small>{pick(summary)}</small></span>
      <span className="pv-lesson-best">{b !== undefined ? <><b>{Math.round(b)}</b><small>{L('my best', 'أفضل نتيجة')}</small></> : <small>{L('not tried yet', 'لم تجرّبه بعد')}</small>}</span>
      {saved
        ? <button type="button" className="pv-ghost" onClick={() => go('locker', { item: saved.id })}>{L('In my locker', 'في خزانتي')}</button>
        : <button type="button" className="pv-ghost" onClick={() => add({ kind, title, body: summary, ref: kind === 'lesson' ? { lesson: id } : { scenario: id } })}>{L('Save', 'احفظ')}</button>}
    </li>
  );
}

function Meter({ n, of }: { n: number; of: number }) {
  return <span className="pv-meter" aria-hidden="true"><span style={{ inlineSize: `${of ? (100 * n) / of : 0}%` }} /></span>;
}

/** The note a student wrote for a part, in their own words. */
export const noteFor = (items: LockerItem[], key: string) => items.find((i) => i.kind === 'note' && i.ref?.card === key);

function Cards({ parts, all, first }: { parts: PartInfo[]; all: boolean; first?: string }) {
  const { L, pick, state, update, add, go } = usePv();
  // The session is fixed when it starts, so answering a card does not reshuffle the rest.
  const [queue] = useState(() => {
    const q = all ? studyQueue(parts, state.cards) : [...parts.filter((p) => isDue(state.cards[p.key])), ...parts.filter((p) => !isDue(state.cards[p.key]))];
    const f = first ? parts.find((p) => p.key === first) : undefined;
    return f ? [f, ...q.filter((p) => p.key !== f.key)] : q;
  });
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState({ knew: 0, missed: 0 });
  const p = queue[i];
  const [mine, setMine] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setMine(p ? noteFor(state.items, p.key)?.body ?? '' : ''); }, [p?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (knew: boolean) => {
    if (!p) return;
    update((s) => logDay({ ...s, cards: { ...s.cards, [p.key]: review(s.cards[p.key], knew) } }, { reviews: 1 }));
    setTally((t) => (knew ? { ...t, knew: t.knew + 1 } : { ...t, missed: t.missed + 1 }));
    setFlipped(false);
    setI((n) => n + 1);
  };
  const saveNote = () => {
    if (!p) return;
    const body = mine.trim();
    const cur = noteFor(state.items, p.key);
    if (cur) update((s) => ({ ...s, items: s.items.map((x) => (x.id === cur.id ? { ...x, body, at: new Date().toISOString() } : x)) }));
    else if (body) add({ kind: 'note', title: { en: `My words: ${p.name.en}`, ar: `بكلماتي: ${p.name.ar}` }, body, ref: { card: p.key, model: p.model.id, part: p.id }, tags: [pick(machineName(p.model))] });
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      // Only while this card is on screen (the space keeps hidden tabs mounted).
      if (el.closest('input, textarea, select') || !box.current?.offsetParent || !p) return;
      if (e.key === ' ' || e.key === 'Enter') { if (el.tagName !== 'BUTTON') { e.preventDefault(); setFlipped((f) => !f); } }
      else if (flipped && e.key === '1') answer(false);
      else if (flipped && e.key === '2') answer(true);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  if (!queue.length) return <div className="pv-card pv-empty-big"><b>{L('Nothing due here.', 'لا شيء مستحق هنا.')}</b><span>{L('Every card in this deck is scheduled for later. Pick a machine to study ahead, or practise.', 'كل بطاقات هذه المجموعة مجدولة لاحقًا. اختر ماكينة لتذاكر مسبقًا أو تدرّب.')}</span>
    <button type="button" className="pv-primary" onClick={() => go('practice')}>{L('Practise instead', 'تدرّب بدلًا من ذلك')}</button></div>;

  if (!p) {
    const n = tally.knew + tally.missed;
    return (
      <div className="pv-card pv-empty-big">
        <b>{L('Session done', 'انتهت الجلسة')} · {n ? Math.round((100 * tally.knew) / n) : 0}%</b>
        <span>{L(`You knew ${tally.knew} of ${n}. The ${tally.missed} you missed come back later today.`, `عرفت ${tally.knew} من ${n}. والـ ${tally.missed} التي أخطأت فيها تعود لاحقًا اليوم.`)}</span>
        <button type="button" className="pv-primary" onClick={() => go('practice')}>{L('Test yourself in Practice', 'اختبر نفسك في التدريب')}</button>
      </div>
    );
  }

  const c = state.cards[p.key];
  const savedPart = state.items.some((x) => x.kind === 'part' && x.ref?.part === p.id && (x.ref?.model === p.model.id || x.ref?.asset === p.model.assetTag));
  return (
    <div className="pv-flash" ref={box}>
      <div className="pv-progress" aria-label={L(`Card ${i + 1} of ${queue.length}`, `بطاقة ${i + 1} من ${queue.length}`)}>
        <span style={{ inlineSize: `${(100 * i) / queue.length}%` }} />
        <small>{i + 1} / {queue.length} · ✓ {tally.knew} · ✗ {tally.missed}</small>
      </div>
      <button type="button" className={`pv-flashcard ${flipped ? 'is-flipped' : ''}`} onClick={() => setFlipped((f) => !f)} aria-live="polite"
        aria-label={flipped ? L('Card answer. Press to see the question.', 'إجابة البطاقة. اضغط لرؤية السؤال.') : L('Card question. Press to see the answer.', 'سؤال البطاقة. اضغط لرؤية الإجابة.')}>
        <span className="pv-fc-top">
          <span>{pick(machineName(p.model))}</span>
          <span className="pv-box" title={L('Leitner box', 'صندوق المراجعة')}>{c ? L(`Box ${c.box}`, `صندوق ${c.box}`) : L('New', 'جديدة')}{c && c.box >= MASTERED_BOX ? ' ★' : ''}</span>
        </span>
        {!flipped ? (
          <span className="pv-fc-front">
            <b>{pick(p.name)}</b>
            <span>{L('What is it, and what does it do? Say it out loud, then flip.', 'ما هي، وماذا تفعل؟ قلها بصوت عالٍ ثم اقلب البطاقة.')}</span>
          </span>
        ) : (
          <span className="pv-fc-back">
            <b>{pick(p.name)}</b>
            <em>{L('What it is', 'ما هي')}</em><span>{pick(p.what)}</span>
            <em>{L('What it does', 'ماذا تفعل')}</em><span>{pick(p.does)}</span>
            {p.safety && <span className="pv-safety">⚠ {pick(p.safety)}</span>}
          </span>
        )}
        <span className="pv-fc-hint">{flipped ? L('Did you know it?', 'هل كنت تعرفها؟') : L('Tap or press Space to flip', 'اضغط أو استخدم المسافة للقلب')}</span>
      </button>
      {flipped ? (
        <div className="pv-answer">
          <button type="button" className="pv-miss" onClick={() => answer(false)}><kbd>1</kbd>{L('Not yet', 'ليس بعد')}</button>
          <button type="button" className="pv-knew" onClick={() => answer(true)}><kbd>2</kbd>{L('Knew it', 'عرفتها')}</button>
        </div>
      ) : (
        <div className="pv-answer"><button type="button" className="pv-primary" onClick={() => setFlipped(true)}>{L('Show the answer', 'أظهر الإجابة')}</button></div>
      )}
      <div className="pv-mywords">
        <label htmlFor={`mw-${p.key}`}>{L('In my own words', 'بكلماتي')}</label>
        <textarea id={`mw-${p.key}`} rows={2} value={mine} onChange={(e) => setMine(e.target.value)} onBlur={saveNote} maxLength={2000}
          placeholder={L('Explain this part as you would to a friend. It is saved to your locker.', 'اشرح هذه القطعة كما تشرحها لصديق. تُحفظ في خزانتك.')} />
        <div className="pv-actions">
          <button type="button" className="pv-ghost" onClick={saveNote}>{L('Save my words', 'احفظ كلماتي')}</button>
          <button type="button" className="pv-ghost" disabled={savedPart} onClick={() => add({ kind: 'part', title: p.name, body: `${pick(p.what)}\n${pick(p.does)}`, ref: { model: p.model.id, part: p.id }, tags: [pick(machineName(p.model))] })}>
            {savedPart ? L('Part is in my locker', 'القطعة في خزانتي') : L('Save part to locker', 'احفظ القطعة في الخزانة')}
          </button>
          <button type="button" className="pv-ghost" onClick={() => go('compare', { part: p.key })}>{L('Compare with another part', 'قارنها بقطعة أخرى')}</button>
        </div>
      </div>
    </div>
  );
}

function Sheet({ parts, title }: { parts: PartInfo[]; title: string }) {
  const { L, pick, state } = usePv();
  return (
    <section className="pv-card pv-sheet">
      <div className="pv-bar-row">
        <p className="pv-hint">{L('Everything on one page, with your own words and how well you know each part. Print it or save it as PDF.', 'كل شيء في صفحة واحدة مع كلماتك ومدى معرفتك بكل قطعة. اطبعها أو احفظها PDF.')}</p>
        <button type="button" className="pv-ghost" onClick={() => window.print()}>{L('Print', 'طباعة')}</button>
      </div>
      <h3 className="pv-print-only">{title}</h3>
      <table>
        <thead><tr><th>{L('Part', 'القطعة')}</th><th>{L('What it is', 'ما هي')}</th><th>{L('What it does', 'ماذا تفعل')}</th><th>{L('Me', 'أنا')}</th></tr></thead>
        <tbody>
          {parts.map((p) => {
            const c = state.cards[p.key];
            const note = noteFor(state.items, p.key);
            return (
              <tr key={p.key}>
                <th scope="row">{pick(p.name)}<small>{pick(machineName(p.model))}</small></th>
                <td>{pick(p.what)}</td>
                <td>{pick(p.does)}{note?.body && <small className="pv-note">✎ {note.body}</small>}</td>
                <td><span className={`pv-lvl l${c?.box ?? 0}`}>{c ? (c.box >= MASTERED_BOX ? L('Know it', 'أعرفها') : L(`Box ${c.box}`, `صندوق ${c.box}`)) : L('New', 'جديدة')}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
