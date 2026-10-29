/** Screen 1 — Trainer Tablet Floor View (docs/ui-blueprint.md §1). */
import { useEffect, useMemo, useState } from 'react';
import { withinTolerance } from '../../../api/src/services/rubricEngine';
import { BAY, FLOOR_FOOTER, OBS_PASS, OBS_RUBRIC, type ObsCriterion, type StationStatus } from './data';
import { FAULTS } from './dolStarter';
import { useStore } from './store';

type Marks = Record<string, string | number | undefined>;
interface Evidence { name: string; url: string; hash: string }

const GLYPH: Record<StationStatus, string> = { done: '✓', working: '●', alert: '▲', idle: '○' };
const STATUS_LABEL: Record<StationStatus, string> = { done: 'Signed off', working: 'Working', alert: 'Alert', idle: 'Idle' };

function toleranceScore(c: Extract<ObsCriterion, { kind: 'tolerance' }>, v: number) {
  // Same helper the API uses: centre of the band ± half its width.
  const expected = c.nominal + (c.lower + c.upper) / 2;
  const half = (c.upper - c.lower) / 2;
  return withinTolerance(v, expected, half) ? 100 : withinTolerance(v, expected, half * 2) ? 50 : 0;
}

function scoreMarks(m: Marks) {
  let weighted = 0, weights = 0, complete = true, gateFail = false;
  for (const c of OBS_RUBRIC) {
    const v = m[c.key];
    if (v === undefined || v === '') { complete = false; continue; }
    if (c.kind === 'gate') { if (v === 'fail') gateFail = true; continue; }
    const s = c.kind === 'rating' ? (Number(v) / 4) * 100 : toleranceScore(c, Number(v));
    weighted += s * c.weight; weights += c.weight;
  }
  const score = weights ? Math.round(weighted / weights) : 0;
  return { complete, gateFail, score, passed: !gateFail && score >= OBS_PASS };
}

async function sha256(file: File) {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function TrainerFloor() {
  const { online, toggleOnline, queued, queueWrite, stations, updateStation, alerts, resolveAlert, faultCode, setFaultCode, vlab } = useStore();
  const [sel, setSel] = useState(4);
  const [marks, setMarks] = useState<Record<number, Marks>>({ 4: { ppe: 'pass', setup: 3 } });
  const [evidence, setEvidence] = useState<Record<number, Evidence[]>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const openAlerts = alerts.filter((a) => !a.resolution);
  const alertStations = new Set(openAlerts.map((a) => a.stationNo));
  const statusOf = (no: number, s: StationStatus): StationStatus => (alertStations.has(no) ? 'alert' : s === 'alert' ? 'working' : s);

  const station = stations.find((s) => s.no === sel)!;
  const m = marks[sel] ?? {};
  const result = useMemo(() => scoreMarks(m), [m]);
  const setMark = (k: string, v: string | number) => setMarks((all) => ({ ...all, [sel]: { ...all[sel], [k]: v } }));

  useEffect(() => { setNoteOpen(false); }, [sel]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const signOff = () => {
    updateStation(sel, { status: 'done', score: result.score, passed: result.passed });
    if (online) setToast(`Station ${sel} signed off · saved`); else { queueWrite(); setToast(`Station ${sel} signed off · queued until online`); }
    const next = stations.find((s) => s.no > sel && s.status !== 'done') ?? stations.find((s) => s.status !== 'done' && s.no !== sel);
    if (next) setSel(next.no);
  };

  const addEvidence = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const hash = await sha256(f);
    setEvidence((e) => ({ ...e, [sel]: [...(e[sel] ?? []), { name: f.name, url: URL.createObjectURL(f), hash }] }));
    if (!online) queueWrite();
  };

  const done = stations.filter((s) => s.status === 'done').length;

  return (
    <div className="floor">
      <div className="floor-head">
        <div>
          <p className="eyebrow">Trainer · Floor view</p>
          <h1>{BAY.name} · {BAY.cohort}</h1>
          <p className="muted">09:40 · {done} of {stations.length} stations signed off · {BAY.trainer}</p>
        </div>
        <div className="head-pills">
          <button type="button" className={`pill ${online ? 'pill-ok' : 'pill-off'}`} onClick={toggleOnline}
            title="Tap to simulate losing the workshop Wi-Fi">
            <span aria-hidden="true">{online ? '●' : '○'}</span> {online ? 'Online' : 'Offline'}
            <span className="pill-sub">{queued > 0 ? (online ? `syncing ${queued}…` : `${queued} queued`) : '0 queued'}</span>
          </button>
          <span className={`pill ${openAlerts.length ? 'pill-alert' : ''}`}><span aria-hidden="true">▲</span> {openAlerts.length} alert{openAlerts.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="floor-grid">
        <section className="floor-left" aria-label="Workshop floor">
          {openAlerts.length > 0 && (
            <div className="alerts" role="alert">
              {openAlerts.map((a) => (
                <div key={a.id} className="alert-card">
                  <button type="button" className="alert-main" onClick={() => a.stationNo && setSel(a.stationNo)}>
                    <span className="alert-icon" aria-hidden="true">▲</span>
                    <span>
                      <strong>{a.stationNo ? `Stn ${a.stationNo} · ` : ''}{a.learner}</strong>
                      <span className="alert-text">{a.text}</span>
                      <small>{a.source} · {a.at}</small>
                    </span>
                  </button>
                  <div className="alert-actions">
                    <button type="button" onClick={() => resolveAlert(a.id, 'Stopped work, briefed learner')}>Stopped &amp; briefed</button>
                    <button type="button" className="ghost" onClick={() => resolveAlert(a.id, 'Checked, false alarm')}>False alarm</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="stations" role="listbox" aria-label="Stations">
            {stations.map((s) => {
              const st = statusOf(s.no, s.status);
              return (
                <button key={s.no} type="button" role="option" aria-selected={s.no === sel}
                  className={`stn stn-${st}`} onClick={() => setSel(s.no)}>
                  <span className="stn-no">{s.no}</span>
                  <span className="stn-glyph" aria-hidden="true">{GLYPH[st]}</span>
                  <span className="stn-name">{s.learner.split(' ')[0]}</span>
                  <span className="stn-state">{st === 'done' && s.score !== undefined ? `${s.score} · ${s.passed ? 'Pass' : 'Not yet'}` : STATUS_LABEL[st]}</span>
                </button>
              );
            })}
          </div>
          <ul className="legend" aria-label="Legend">
            {(['done', 'working', 'alert', 'idle'] as StationStatus[]).map((k) => (
              <li key={k}><span className={`lg lg-${k}`} aria-hidden="true">{GLYPH[k]}</span>{STATUS_LABEL[k]}</li>
            ))}
          </ul>

          <div className="vlab-card">
            <div>
              <p className="eyebrow">V-Lab · live</p>
              <strong>{vlab.learner} · DOL starter fault test</strong>
              <p className="muted">{vlab.mode} mode · {vlab.status} · {vlab.events} telemetry events</p>
            </div>
            <label className="field">
              <span>Fault injected for the next attempt</span>
              <select id="inject-fault" value={faultCode} onChange={(e) => setFaultCode(e.target.value)}>
                {FAULTS.map((f) => <option key={f.code} value={f.code}>{f.code} · {f.title}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="obs" aria-label={`Station ${sel} observation`}>
          <header className="obs-head">
            <p className="eyebrow">Station {station.no} · Job card {station.jobCard}</p>
            <h2>{station.learner}</h2>
            <p className="muted">Task: {station.task}</p>
          </header>

          <div className="rubric">
            {OBS_RUBRIC.map((c) => (
              <div key={c.key} className={`row ${c.kind === 'gate' ? 'row-gate' : ''}`}>
                <div className="row-label">
                  {c.label}
                  {c.kind === 'gate' && <span className="gate">Gate</span>}
                </div>
                {c.kind === 'gate' && (
                  <div className="seg" role="radiogroup" aria-label={c.label}>
                    <button type="button" role="radio" aria-checked={m[c.key] === 'pass'} className="seg-pass" onClick={() => setMark(c.key, 'pass')}>✓ Pass</button>
                    <button type="button" role="radio" aria-checked={m[c.key] === 'fail'} className="seg-fail" onClick={() => setMark(c.key, 'fail')}>✗ Fail</button>
                  </div>
                )}
                {c.kind === 'rating' && (
                  <div className="seg" role="radiogroup" aria-label={c.label}>
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={m[c.key] === n} onClick={() => setMark(c.key, n)}>{n}</button>
                    ))}
                  </div>
                )}
                {c.kind === 'tolerance' && <ToleranceInput c={c} value={m[c.key]} onChange={(v) => setMark(c.key, v)} id={`tol-${sel}`} />}
              </div>
            ))}
          </div>

          <div className="evidence">
            <label className="btn-file">
              <input id={`ev-${sel}`} type="file" accept="image/*" capture="environment" onChange={(e) => { void addEvidence(e.target.files); e.target.value = ''; }} />
              <span aria-hidden="true">◉</span> Evidence photo
            </label>
            <button type="button" className="ghost" aria-expanded={noteOpen} onClick={() => setNoteOpen((o) => !o)}>✎ Note</button>
            {(evidence[sel] ?? []).map((e) => (
              <figure key={e.hash} className="thumb">
                <img src={e.url} alt={`Evidence: ${e.name}`} />
                <figcaption className="mono" title={e.hash}>sha256 {e.hash.slice(0, 10)}…</figcaption>
              </figure>
            ))}
          </div>
          {noteOpen && (
            <textarea id={`note-${sel}`} className="note" rows={2} placeholder="e.g. Good tool-height setting; remind about chip hook"
              value={notes[sel] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [sel]: e.target.value }))} />
          )}

          <footer className="obs-foot">
            <div className={`verdict ${!result.complete ? '' : result.passed ? 'v-pass' : 'v-fail'}`} aria-live="polite">
              <span className="v-score">{result.complete ? result.score : '—'}</span>
              <span>
                {!result.complete ? 'Score every row to sign off'
                  : result.gateFail ? 'Not yet · safety gate failed' : result.passed ? 'Pass' : `Not yet · below ${OBS_PASS}`}
              </span>
            </div>
            <button type="button" className="primary" disabled={!result.complete || station.status === 'done'} onClick={signOff}>
              {station.status === 'done' ? 'Signed off' : 'Sign off & next station →'}
            </button>
          </footer>
        </section>
      </div>

      <footer className="floor-foot">
        {FLOOR_FOOTER.map((f) => (
          <span key={f.label} className={f.warn ? 'warn' : ''}><b>{f.label}</b> {f.value}</span>
        ))}
      </footer>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function ToleranceInput({ c, value, onChange, id }: {
  c: Extract<ObsCriterion, { kind: 'tolerance' }>; value: string | number | undefined; onChange: (v: string) => void; id: string;
}) {
  const v = value === undefined || value === '' ? null : Number(value);
  const s = v === null || Number.isNaN(v) ? null : toleranceScore(c, v);
  const lo = (c.nominal + c.lower).toFixed(3), hi = (c.nominal + c.upper).toFixed(3);
  return (
    <div className="tol">
      <label htmlFor={id} className="sr-only">Measured diameter in mm</label>
      <input id={id} inputMode="decimal" placeholder={c.nominal.toFixed(3)} value={value ?? ''}
        onChange={(e) => onChange(e.target.value.replace(',', '.'))}
        className={s === null ? '' : s === 100 ? 'in' : s === 50 ? 'near' : 'out'} />
      <span className="mono tol-band">{lo}–{hi} {c.unit}</span>
      {s !== null && <span className={`tol-flag ${s === 100 ? 'ok' : 'bad'}`}>{s === 100 ? '✓ In tolerance' : s === 50 ? '◐ Within 2×' : '✗ Out'}</span>}
    </div>
  );
}
