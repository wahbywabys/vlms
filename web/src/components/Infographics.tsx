/**
 * Infographic cards that slide in over a lesson (and the safety simulator):
 * do / don't lists, a big number, numbered steps that reveal one by one, a
 * safety sign with its rule, a spec table and a worked formula. Plain DOM over
 * the 3D, so they stay sharp and are read by screen readers.
 */
import type { Txt } from '../models/kit';
import { signDataURL, type Pictogram, type SignKind } from '../models/textures';

type Lang = 'en' | 'ar';

export type LessonCard = { id: string; at: number; until: number; side?: 'start' | 'end'; title?: Txt } & (
  | { kind: 'dodont'; do: Txt[]; dont: Txt[] }
  | { kind: 'stat'; value: string; label: Txt; tone?: 'ok' | 'warn' | 'bad' }
  | { kind: 'steps'; items: Txt[] }
  | { kind: 'sign'; sign: SignKind; pic: Pictogram; text: Txt; code?: string }
  | { kind: 'spec'; rows: [Txt, string | Txt][] }
  | { kind: 'formula'; expr: string; lines?: string[]; note: Txt }
);

const DO = { en: 'Do', ar: 'افعل' };
const DONT = { en: "Don't", ar: 'لا تفعل' };

export function SignIcon({ kind, pic, size = 44 }: { kind: SignKind; pic: Pictogram; size?: number }) {
  return <img className="ig-sign" src={signDataURL(kind, pic)} width={size} height={size} alt="" aria-hidden="true" />;
}

/** One card. `progress` (0..1 through its time window) reveals steps one by one. */
export function InfoCard({ card, lang, progress = 1 }: { card: LessonCard; lang: Lang; progress?: number }) {
  const p = (t: Txt) => t[lang];
  const v = (x: string | Txt) => (typeof x === 'string' ? x : p(x));
  return (
    <div className={`ig-card ig-${card.kind}${card.kind === 'stat' && card.tone ? ` is-${card.tone}` : ''}`} role="note">
      {card.title && <p className="ig-title">{p(card.title)}</p>}
      {card.kind === 'dodont' && (
        <div className="ig-cols">
          <div className="ig-do"><b>✓ {p(DO)}</b><ul>{card.do.map((d, i) => <li key={i}>{p(d)}</li>)}</ul></div>
          <div className="ig-dont"><b>✗ {p(DONT)}</b><ul>{card.dont.map((d, i) => <li key={i}>{p(d)}</li>)}</ul></div>
        </div>
      )}
      {card.kind === 'stat' && (<div className="ig-statbox"><b dir="ltr">{card.value}</b><span>{p(card.label)}</span></div>)}
      {card.kind === 'steps' && (
        <ol className="ig-steps">
          {card.items.map((it, i) => {
            const shown = progress * (card.items.length + 0.6) >= i + 0.3;
            const now = shown && progress * (card.items.length + 0.6) < i + 1.3;
            return <li key={i} className={`${shown ? 'is-shown' : ''}${now ? ' is-now' : ''}`}><span>{i + 1}</span>{p(it)}</li>;
          })}
        </ol>
      )}
      {card.kind === 'sign' && (
        <div className="ig-signrow"><SignIcon kind={card.sign} pic={card.pic} size={64} /><div><p>{p(card.text)}</p>{card.code && <small dir="ltr">{card.code}</small>}</div></div>
      )}
      {card.kind === 'spec' && (
        <dl className="ig-spec">{card.rows.map(([k, val], i) => <div key={i}><dt>{p(k)}</dt><dd>{v(val)}</dd></div>)}</dl>
      )}
      {card.kind === 'formula' && (
        <div className="ig-formula">
          <code dir="ltr">{card.expr}</code>
          {card.lines?.map((l, i) => <code key={i} dir="ltr" className="ig-line">{l}</code>)}
          <p>{p(card.note)}</p>
        </div>
      )}
    </div>
  );
}

/** The cards showing at time `t`, stacked on their side of the stage. */
export function CardStack({ cards, t, lang }: { cards: LessonCard[]; t: number; lang: Lang }) {
  const on = cards.filter((c) => t >= c.at && t <= c.until);
  if (!on.length) return null;
  const side = (s?: 'start' | 'end') => on.filter((c) => (c.side ?? 'end') === s);
  return (
    <>
      {(['start', 'end'] as const).map((s) => side(s).length ? (
        <div key={s} className={`ig-stack ig-${s}`} aria-live="polite">
          {side(s).map((c) => <InfoCard key={c.id} card={c} lang={lang} progress={(t - c.at) / Math.max(0.1, c.until - c.at)} />)}
        </div>
      ) : null)}
    </>
  );
}
