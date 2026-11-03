/**
 * The 15 WABYS programmes (manual Rev 1.1) with their K/S/A units by year.
 * Reads the same JSON the API's migration 007 is built from, so the prototype
 * and the live app show the same curriculum.
 */
import { useMemo, useState } from 'react';
import manual from '../../../db/curricula/wabys-2026.json';
import { useL } from './store';
import type { Txt } from './i18n';

interface Item { code: string; year: number; ksa: 'K' | 'S' | 'A'; title: Txt; hours: number | null; criteria: Txt[] }
interface Programme {
  code: string; trade: string; accent: string; name: Txt; occupation: Txt; overview: Txt; eqf: string; hours: number;
  occupations: Txt; standards: string; equipment: Txt; tracks: Txt[]; capstone: Txt; items: Item[]; new: boolean;
  duration: Txt; adopts: Txt | null;
}
const M = manual as unknown as { edition: string; years: Record<string, Txt>; domains: Record<string, Txt>; programs: Programme[] };
const PROGRAMMES = [...M.programs].sort((a, b) => a.code.localeCompare(b.code));

export function Programmes() {
  const { L, pick } = useL();
  const [code, setCode] = useState(PROGRAMMES[0]!.code);
  const [year, setYear] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const p = PROGRAMMES.find((x) => x.code === code)!;
  const byKsa = useMemo(() => {
    const items = p.items.filter((i) => i.year === year);
    return (['K', 'S', 'A'] as const).map((k) => ({ k, items: items.filter((i) => i.ksa === k) })).filter((g) => g.items.length);
  }, [p, year]);
  const total = (y: number) => p.items.filter((i) => i.year === y).reduce((s, i) => s + (i.hours ?? 0), 0);

  return (
    <div className="progs" style={{ ['--pa' as string]: p.accent }}>
      <section className="panel progs-intro">
        <div className="panel-head">
          <h2>{L('Programmes', 'البرامج')} <span className="progs-count">{PROGRAMMES.length}</span></h2>
          <span className="muted">{L('WABYS curriculum manual · ', 'دليل مناهج وابيز · ')}{M.edition}</span>
        </div>
        <div className="progs-grid" role="radiogroup" aria-label={L('Programme', 'البرنامج')}>
          {PROGRAMMES.map((x) => (
            <button key={x.code} type="button" role="radio" aria-checked={x.code === code} style={{ ['--pa' as string]: x.accent }}
              onClick={() => { setCode(x.code); setYear(1); setOpen(null); }}>
              <b>{x.code}</b>
              <span>{pick(x.name)}</span>
              {x.new && <em>{L('New', 'جديد')}</em>}
            </button>
          ))}
        </div>
      </section>

      <section className="panel progs-detail">
        <div className="progs-title">
          <span className="progs-code">{p.code}</span>
          <div>
            <h2>{pick(p.name)}</h2>
            <p className="muted">{pick(p.occupation)} · {p.eqf} · {pick(p.duration)}</p>
          </div>
        </div>
        <p className="progs-overview">{pick(p.overview)}</p>
        <dl className="progs-facts">
          <div><dt>{L('Career paths', 'المسارات المهنية')}</dt><dd>{pick(p.occupations)}</dd></div>
          <div><dt>{L('Standards', 'المعايير')}</dt><dd dir="ltr">{p.standards}</dd></div>
          <div><dt>{L('Workshop equipment', 'تجهيزات الورشة')}</dt><dd>{pick(p.equipment)}</dd></div>
          {p.tracks.length > 0 && <div><dt>{L('Year 3 tracks', 'مسارات السنة الثالثة')}</dt><dd>{p.tracks.map(pick).join(' · ')}</dd></div>}
          {p.adopts && <div><dt>{L('Shared units', 'الوحدات المشتركة')}</dt><dd>{pick(p.adopts)}</dd></div>}
          <div><dt>{L('Capstone project', 'مشروع التخرج')}</dt><dd>{pick(p.capstone)}</dd></div>
        </dl>

        <div className="progs-years" role="tablist">
          {Object.keys(M.years).map((y) => (
            <button key={y} type="button" role="tab" aria-selected={year === +y} onClick={() => { setYear(+y); setOpen(null); }}>
              {pick(M.years[y]!)} <small>{total(+y)} {L('h', 'س')}</small>
            </button>
          ))}
        </div>

        {byKsa.map((g) => (
          <div key={g.k} className={`progs-ksa ksa-${g.k}`}>
            <h3><span>{g.k}</span>{pick(M.domains[g.k]!)} <small>{g.items.length}</small></h3>
            <ul>
              {g.items.map((i) => (
                <li key={i.code}>
                  <button type="button" aria-expanded={open === i.code} onClick={() => setOpen(open === i.code ? null : i.code)}>
                    <code>{i.code}</code><span>{pick(i.title)}</span>{i.hours ? <small>{i.hours} {L('h', 'س')}</small> : null}
                  </button>
                  {open === i.code && i.criteria.length > 0 && (
                    <ol>{i.criteria.map((c, n) => <li key={n}>{pick(c)}</li>)}</ol>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
