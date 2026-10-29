/**
 * Shared in-memory state for the prototype, so actions on one screen show up
 * on the others: a V-Lab safety violation reaches the trainer's alert rail,
 * and a scored attempt reaches the director's evaluation list.
 * In production this is the API + Redis alert channel; nothing persists here.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SEED_EVALS, type EvalRow, type Station } from './data';
import { isTradeId, tradeById, TRADES, type Trade, type TradeId } from './trades';
import { makeL, tx, type Lang, type Txt } from './i18n';

export type Role = 'trainer' | 'student' | 'director';

export interface Alert {
  id: string;
  trade: TradeId;
  at: string;
  stationNo?: number;
  learner: Txt;
  source: 'RFID' | 'V-Lab';
  text: Txt;
  /** How the trainer resolved it; unresolved alerts stay on top. */
  resolution?: string;
}

export interface VlabLive { learner: Txt; mode: 'Guided' | 'Exam'; events: number; status: 'idle' | 'in progress' | 'submitted' }

interface Store {
  lang: Lang;
  setLang: (l: Lang) => void;
  role: Role;
  setRole: (r: Role) => void;
  /** The specialisation the trainer and student screens show. */
  trade: Trade;
  setTrade: (id: TradeId) => void;
  /** The director can also look across every trade at once. */
  dirTrade: TradeId | 'all';
  setDirTrade: (id: TradeId | 'all') => void;
  online: boolean;
  toggleOnline: () => void;
  queued: number;
  queueWrite: () => void;
  /** Stations of the active trade. */
  stations: Station[];
  updateStation: (no: number, patch: Partial<Station>) => void;
  alerts: Alert[];
  raiseAlert: (a: Omit<Alert, 'id' | 'at'>) => void;
  resolveAlert: (id: string, resolution: string) => void;
  /** Fault the trainer injects into the next V-Lab attempt, per trade. */
  faultCodes: Record<TradeId, string>;
  setFaultCode: (trade: TradeId, c: string) => void;
  evals: EvalRow[];
  addEval: (e: Omit<EvalRow, 'id' | 'at' | 'live'>) => void;
  vlabs: Record<TradeId, VlabLive>;
  setVlab: (trade: TradeId, v: Partial<VlabLive>) => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;
/** `L('English', 'عربي')` and `pick(txt)` for the current language. */
export const useL = () => makeL(useStore().lang);

export const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
let nextId = 1;

const byTrade = <T,>(f: (t: Trade) => T) => Object.fromEntries(TRADES.map((t) => [t.id, f(t)])) as Record<TradeId, T>;

/** Hash is `#role` or `#role/trade`, so a role and trade can be linked directly. */
function readHash(): { role?: Role; trade?: TradeId } {
  const [r, t] = location.hash.slice(1).split('/');
  return {
    role: r === 'trainer' || r === 'student' || r === 'director' ? r : undefined,
    trade: t && isTradeId(t) ? t : undefined,
  };
}

function savedTrade(): TradeId {
  const fromHash = readHash().trade;
  if (fromHash) return fromHash;
  try { const t = localStorage.getItem('vlms-trade'); if (t && isTradeId(t)) return t; } catch { /* storage unavailable */ }
  return TRADES[0]!.id;
}

function savedLang(): Lang {
  try { return localStorage.getItem('vlms-lang') === 'ar' ? 'ar' : 'en'; } catch { return 'en'; }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(savedLang);
  const [role, setRole] = useState<Role>(() => readHash().role ?? 'trainer');
  const [tradeId, setTrade] = useState<TradeId>(savedTrade);
  const [dirTrade, setDirTrade] = useState<TradeId | 'all'>('all');
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [allStations, setStations] = useState(() => byTrade((t) => t.stations));
  const [alerts, setAlerts] = useState<Alert[]>(() => TRADES.map((t, i) => ({
    id: `a0-${t.id}`, trade: t.id, at: `09:${String(37 - i * 6).padStart(2, '0')}`, source: 'RFID' as const, ...t.initialAlert,
  })));
  const [faultCodes, setFaultCodes] = useState(() => byTrade((t) => t.lab.faults[0]!.code));
  const [evals, setEvals] = useState(SEED_EVALS);
  const [vlabs, setVlabs] = useState(() => byTrade<VlabLive>((t) => ({ learner: t.learner.name, mode: 'Guided', events: 0, status: 'idle' })));
  const trade = tradeById(tradeId);

  // Arabic flips the whole document to right-to-left.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('vlms-lang', lang); } catch { /* storage unavailable: language just isn't remembered */ }
  }, [lang]);

  // Hash routing so a role and trade can be linked directly (#trainer/cnc, #student/weld, #director).
  useEffect(() => {
    const want = `#${role}/${tradeId}`;
    if (location.hash !== want) history.replaceState(null, '', want);
    try { localStorage.setItem('vlms-trade', tradeId); } catch { /* storage unavailable: trade just isn't remembered */ }
  }, [role, tradeId]);
  useEffect(() => {
    const on = () => {
      const h = readHash();
      if (h.role) setRole(h.role);
      if (h.trade) setTrade(h.trade);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  // Coming back online flushes the queue after a short sync.
  useEffect(() => {
    if (!online || queued === 0) return;
    const t = setTimeout(() => setQueued(0), 1200);
    return () => clearTimeout(t);
  }, [online, queued]);

  const queueWrite = useCallback(() => setQueued((q) => q + 1), []);
  const updateStation = useCallback((no: number, patch: Partial<Station>) =>
    setStations((all) => ({ ...all, [tradeId]: all[tradeId]!.map((x) => (x.no === no ? { ...x, ...patch } : x)) })), [tradeId]);
  const setFaultCode = useCallback((t: TradeId, c: string) => setFaultCodes((f) => ({ ...f, [t]: c })), []);
  const raiseAlert = useCallback((a: Omit<Alert, 'id' | 'at'>) =>
    setAlerts((l) => [{ ...a, id: `a${nextId++}`, at: clock() }, ...l]), []);
  const resolveAlert = useCallback((id: string, resolution: string) =>
    setAlerts((l) => l.map((a) => (a.id === id ? { ...a, resolution } : a))), []);
  const addEval = useCallback((e: Omit<EvalRow, 'id' | 'at' | 'live'>) =>
    setEvals((l) => [{ ...e, id: `e${nextId++}`, at: tx(`Today ${clock()}`, `اليوم ${clock()}`), live: true }, ...l]), []);
  const setVlab = useCallback((t: TradeId, v: Partial<VlabLive>) => setVlabs((s) => ({ ...s, [t]: { ...s[t]!, ...v } })), []);
  const stations = allStations[tradeId]!;

  const value = useMemo<Store>(() => ({
    lang, setLang, role, setRole, trade, setTrade, dirTrade, setDirTrade, online, toggleOnline: () => setOnline((o) => !o), queued, queueWrite,
    stations, updateStation, alerts, raiseAlert, resolveAlert, faultCodes, setFaultCode,
    evals, addEval, vlabs, setVlab,
  }), [lang, role, trade, dirTrade, online, queued, queueWrite, stations, updateStation, alerts, raiseAlert, resolveAlert, faultCodes, setFaultCode, evals, addEval, vlabs, setVlab]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
