/**
 * Shared in-memory state for the prototype, so actions on one screen show up
 * on the others: a V-Lab safety violation reaches the trainer's alert rail,
 * and a scored attempt reaches the director's evaluation list.
 * In production this is the API + Redis alert channel; nothing persists here.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SEED_EVALS, STATIONS, type EvalRow, type Station } from './data';

export type Role = 'trainer' | 'student' | 'director';

export interface Alert {
  id: string;
  at: string;
  stationNo?: number;
  learner: string;
  source: 'RFID' | 'V-Lab';
  text: string;
  /** How the trainer resolved it; unresolved alerts stay on top. */
  resolution?: string;
}

export interface VlabLive { learner: string; mode: 'Guided' | 'Exam'; events: number; status: 'idle' | 'in progress' | 'submitted' }

interface Store {
  role: Role;
  setRole: (r: Role) => void;
  online: boolean;
  toggleOnline: () => void;
  queued: number;
  queueWrite: () => void;
  stations: Station[];
  updateStation: (no: number, patch: Partial<Station>) => void;
  alerts: Alert[];
  raiseAlert: (a: Omit<Alert, 'id' | 'at'>) => void;
  resolveAlert: (id: string, resolution: string) => void;
  faultCode: string;
  setFaultCode: (c: string) => void;
  evals: EvalRow[];
  addEval: (e: Omit<EvalRow, 'id' | 'at' | 'live'>) => void;
  vlab: VlabLive;
  setVlab: (v: Partial<VlabLive>) => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
let nextId = 1;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(() => {
    const h = location.hash.slice(1);
    return h === 'student' || h === 'director' ? h : 'trainer';
  });
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [stations, setStations] = useState(STATIONS);
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: 'a0', at: '09:37', stationNo: 5, learner: 'Karim Fathy', source: 'RFID', text: 'Guard open while spindle running' },
  ]);
  const [faultCode, setFaultCode] = useState('F-OL-OPEN');
  const [evals, setEvals] = useState(SEED_EVALS);
  const [vlab, setVlabState] = useState<VlabLive>({ learner: 'Omar Lotfy', mode: 'Guided', events: 0, status: 'idle' });

  // Hash routing so a role can be linked directly (#trainer, #student, #director).
  useEffect(() => {
    if (location.hash.slice(1) !== role) history.replaceState(null, '', `#${role}`);
  }, [role]);
  useEffect(() => {
    const on = () => {
      const h = location.hash.slice(1);
      if (h === 'trainer' || h === 'student' || h === 'director') setRole(h);
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
    setStations((s) => s.map((x) => (x.no === no ? { ...x, ...patch } : x))), []);
  const raiseAlert = useCallback((a: Omit<Alert, 'id' | 'at'>) =>
    setAlerts((l) => [{ ...a, id: `a${nextId++}`, at: clock() }, ...l]), []);
  const resolveAlert = useCallback((id: string, resolution: string) =>
    setAlerts((l) => l.map((a) => (a.id === id ? { ...a, resolution } : a))), []);
  const addEval = useCallback((e: Omit<EvalRow, 'id' | 'at' | 'live'>) =>
    setEvals((l) => [{ ...e, id: `e${nextId++}`, at: `Today ${clock()}`, live: true }, ...l]), []);
  const setVlab = useCallback((v: Partial<VlabLive>) => setVlabState((s) => ({ ...s, ...v })), []);

  const value = useMemo<Store>(() => ({
    role, setRole, online, toggleOnline: () => setOnline((o) => !o), queued, queueWrite,
    stations, updateStation, alerts, raiseAlert, resolveAlert, faultCode, setFaultCode,
    evals, addEval, vlab, setVlab,
  }), [role, online, queued, queueWrite, stations, updateStation, alerts, raiseAlert, resolveAlert, faultCode, evals, addEval, vlab, setVlab]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
