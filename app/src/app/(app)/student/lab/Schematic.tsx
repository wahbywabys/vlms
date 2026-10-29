'use client';
import { useL } from '@/components/LangProvider';
import type { Diagram, PublicLab, RigState, TestPoint } from '@/lib/lab';

type Props = { lab: PublicLab; rig: RigState; onMeasure: (tp: TestPoint) => void; active?: string };

/** The lab's rig drawing: the hand-drawn DOL ladder, or a block drawing described as data. */
export function Schematic(p: Props) {
  return p.lab.diagram === 'dol' ? <DolLadder {...p} /> : <BlockDiagram {...p} d={p.lab.diagram} />;
}

/** Ladder drawing of the starter, always drawn left-to-right as on a real panel. Test points are the tappable circles. */
function DolLadder({ lab, rig, onMeasure, active }: Props) {
  const { lang, L, pick } = useL();
  const tp = (ref: string) => lab.testPoints.find((t) => t.ref === ref)!;
  // A render helper rather than a component, so points keep focus across renders.
  const pt = ({ r, x, y, label, dx = 0, dy = -16 }: { r: string; x: number; y: number; label: string; dx?: number; dy?: number }) => {
    const t = tp(r);
    const reachable = !t.inside || rig.panelOpen;
    return (
      <g key={r} className={`tp ${active === r ? 'tp-active' : ''} ${reachable ? '' : 'tp-blocked'}`} role="button" tabIndex={0}
        aria-label={L(`Measure ${t.label.en}`, `قِس ${t.label.ar}`)} data-tp={r} onClick={() => onMeasure(t)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMeasure(t); } }}>
        <title>{pick(t.label)}</title>
        <circle cx={x} cy={y} r={18} className="tp-hit" />
        <circle cx={x} cy={y} r={7} className="tp-dot" />
        <text x={x + dx} y={y + dy} textAnchor="middle" className="tp-label">{label}</text>
      </g>
    );
  };
  return (
    <svg className="schematic" viewBox="0 0 640 330" role="group" aria-label={L('DOL starter circuit with test points', 'دائرة بادئ DOL مع نقاط القياس')}>
      {/* Power circuit */}
      {/* Arabic captions are centred so their right-to-left runs (see .schematic text in CSS) stay inside the frame. */}
      <text x={L('16', '320')} y="22" textAnchor={lang === 'ar' ? 'middle' : 'start'} className="sch-cap">{L('POWER · 400 V 3~', 'دائرة القدرة · 400 فولت ثلاثي الأطوار')}</text>
      <rect x="20" y="44" width="56" height="40" rx="4" className="sch-box" /><text x="48" y="69" textAnchor="middle" className="sch-txt">X1</text>
      <line x1="76" y1="64" x2="128" y2="64" className="sch-wire" />
      <rect x="128" y="44" width="64" height="40" rx="4" className={`sch-box ${rig.locked ? 'sch-locked' : ''}`} />
      <text x="160" y="69" textAnchor="middle" className="sch-txt">Q1</text>
      {rig.locked && <g><rect x="136" y="88" width="48" height="22" rx="3" className="tag" /><text x="160" y="103" textAnchor="middle" className="tag-txt">{L('LOCKED', 'مقفول')}</text></g>}
      <line x1="192" y1="64" x2="300" y2="64" className="sch-wire" />
      <rect x="300" y="48" width="70" height="32" rx="4" className="sch-box" /><text x="335" y="69" textAnchor="middle" className="sch-txt">KM1</text>
      <line x1="370" y1="64" x2="420" y2="64" className="sch-wire" />
      <rect x="420" y="48" width="64" height="32" rx="4" className="sch-box" /><text x="452" y="69" textAnchor="middle" className="sch-txt">F2</text>
      <line x1="484" y1="64" x2="548" y2="64" className="sch-wire" />
      <circle cx="574" cy="64" r="26" className="sch-box" /><text x="574" y="62" textAnchor="middle" className="sch-txt">M</text>
      <text x="574" y="77" textAnchor="middle" className="sch-small">3~</text>

      {/* Control circuit (inside the panel) */}
      <text x={L('16', '500')} y="320" textAnchor={lang === 'ar' ? 'middle' : 'start'} className="sch-cap">{L('CONTROL · 230 V', 'دائرة التحكم · 230 فولت')}</text>
      <line x1="210" y1="64" x2="210" y2="120" className="sch-wire" />
      <line x1="60" y1="120" x2="210" y2="120" className="sch-wire" />
      <line x1="60" y1="120" x2="60" y2="226" className="sch-wire" />
      <rect x="48" y="160" width="24" height="40" rx="3" className="sch-box" /><text x="88" y="185" className="sch-txt">F1</text>
      <line x1="60" y1="226" x2="140" y2="226" className="sch-wire" />
      {/* S1 NC */}
      <line x1="140" y1="226" x2="150" y2="226" className="sch-wire" /><line x1="150" y1="218" x2="176" y2="228" className="sch-wire" />
      <line x1="176" y1="218" x2="176" y2="232" className="sch-wire" /><text x="163" y="256" textAnchor="middle" className="sch-txt">S1</text>
      <line x1="176" y1="226" x2="236" y2="226" className="sch-wire" />
      {/* S2 NO, KM1 13-14 hold-in in parallel */}
      <line x1="236" y1="226" x2="246" y2="226" className="sch-wire" /><line x1="246" y1="226" x2="270" y2="212" className="sch-wire" />
      <line x1="272" y1="226" x2="300" y2="226" className="sch-wire" /><text x="259" y="256" textAnchor="middle" className="sch-txt">S2</text>
      <line x1="236" y1="226" x2="236" y2="296" className="sch-wire" /><line x1="300" y1="226" x2="300" y2="296" className="sch-wire" />
      <line x1="236" y1="296" x2="252" y2="296" className="sch-wire" /><line x1="252" y1="296" x2="276" y2="284" className="sch-wire" />
      <line x1="278" y1="296" x2="300" y2="296" className="sch-wire" /><text x="268" y="318" textAnchor="middle" className="sch-small">KM1 13-14</text>
      <line x1="300" y1="226" x2="380" y2="226" className="sch-wire" />
      {/* F2 95-96 NC */}
      <line x1="380" y1="226" x2="390" y2="226" className="sch-wire" /><line x1="390" y1="218" x2="416" y2="228" className="sch-wire" />
      <line x1="416" y1="218" x2="416" y2="232" className="sch-wire" /><text x="403" y="256" textAnchor="middle" className="sch-txt">F2</text>
      <line x1="416" y1="226" x2="470" y2="226" className="sch-wire" />
      {/* KM1 coil */}
      <rect x="470" y="210" width="44" height="32" rx="3" className="sch-box" /><text x="492" y="231" textAnchor="middle" className="sch-txt">KM1</text>
      <line x1="514" y1="226" x2="600" y2="226" className="sch-wire" /><line x1="600" y1="226" x2="600" y2="120" className="sch-wire" />
      <text x="606" y="116" className="sch-small">N</text>

      {!rig.panelOpen && (
        <g className="door">
          <rect x="30" y="132" width="596" height="194" rx="8" />
          <text x="328" y="236" textAnchor="middle">{L('Panel door closed · open it to reach the control circuit', 'باب اللوحة مغلق · افتحه للوصول إلى دائرة التحكم')}</text>
        </g>
      )}

      {pt({ r: 'X1:L1-L2', x: 102, y: 64, label: 'X1 L1–L2', dy: 30 })}
      {pt({ r: 'Q1:load_side', x: 210, y: 92, label: L('Q1 load', 'مخرج Q1'), dx: 34, dy: 4 })}
      {pt({ r: 'Q1:control_supply', x: 60, y: 142, label: L('F1 supply', 'تغذية F1'), dx: 48, dy: 4 })}
      {pt({ r: 'S1:stop_pb', x: 163, y: 200, label: 'S1' })}
      {pt({ r: 'S2:start_pb', x: 259, y: 196, label: 'S2' })}
      {pt({ r: 'F2:95-96', x: 403, y: 200, label: '95–96' })}
      {pt({ r: 'KM1:A1-A2', x: 492, y: 188, label: 'A1–A2' })}
    </svg>
  );
}

/** Block drawing for rigs described as data (api/src/labs). Same test-point behaviour as the DOL ladder. */
function BlockDiagram({ lab, d, rig, onMeasure, active }: Props & { d: Diagram }) {
  const { lang, L, pick } = useL();
  const pt = (p: Diagram['points'][number]) => {
    const t = lab.testPoints.find((x) => x.ref === p.ref)!;
    const reachable = !t.inside || rig.panelOpen;
    return (
      <g key={p.ref} className={`tp ${active === p.ref ? 'tp-active' : ''} ${reachable ? '' : 'tp-blocked'}`} role="button" tabIndex={0}
        aria-label={L(`Measure ${t.label.en}`, `قِس ${t.label.ar}`)} data-tp={p.ref} onClick={() => onMeasure(t)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMeasure(t); } }}>
        <title>{pick(t.label)}</title>
        <circle cx={p.x} cy={p.y} r={18} className="tp-hit" />
        <circle cx={p.x} cy={p.y} r={7} className="tp-dot" />
        <text x={p.x + (p.dx ?? 0)} y={p.y + (p.dy ?? -16)} textAnchor="middle" className="tp-label">{pick(p.label)}</text>
      </g>
    );
  };
  return (
    <svg className="schematic" viewBox="0 0 640 330" role="group" aria-label={L(`${lab.rigTitle.en} with test points`, `${lab.rigTitle.ar} مع نقاط القياس`)}>
      {d.captions.map((c) => (
        <text key={c.text.en} x={lang === 'ar' ? 320 : c.x} y={c.y} textAnchor={lang === 'ar' ? 'middle' : 'start'} className="sch-cap">{pick(c.text)}</text>
      ))}
      <path d={d.wires} className="sch-wire" fill="none" />
      {d.boxes.map((b) => (
        <g key={b.label + b.x}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.round ? Math.min(b.w, b.h) / 2 : 4}
            className={`sch-box ${b.isolator && rig.locked ? 'sch-locked' : ''}`} />
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + (b.sub ? -2 : 5)} textAnchor="middle" className="sch-txt">{b.label}</text>
          {b.sub && <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 14} textAnchor="middle" className="sch-small">{b.sub}</text>}
          {b.isolator && rig.locked && (
            <g><rect x={b.x + b.w / 2 - 24} y={b.y + b.h + 4} width="48" height="22" rx="3" className="tag" />
              <text x={b.x + b.w / 2} y={b.y + b.h + 19} textAnchor="middle" className="tag-txt">{L('LOCKED', 'مقفول')}</text></g>
          )}
        </g>
      ))}
      {!rig.panelOpen && (
        <g className="door">
          <rect x={d.cover.x} y={d.cover.y} width={d.cover.w} height={d.cover.h} rx="8" />
          <text x={d.cover.x + d.cover.w / 2} y={d.cover.y + d.cover.h / 2 + 6} textAnchor="middle">{pick(d.cover.text)}</text>
        </g>
      )}
      {d.points.map(pt)}
    </svg>
  );
}
