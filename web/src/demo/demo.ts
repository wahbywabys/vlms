/**
 * In-memory stand-in for the VTC_LMS API, so the prototype runs the module
 * screens with no server. It uses the API's own engines (pre-check draw and
 * grading, parametric questions, hotspot grading, geofence, early-warning
 * model), and the pre-checks, schematics and parametric items are a snapshot
 * of the demo database (fixtures.json), so the numbers match the real app.
 * State lives for the page's lifetime; a reload starts fresh.
 */
import { judge, screen, haversineM } from '../../../api/src/services/geofence';
import { gradeHotspots, type Hotspot } from '../../../api/src/services/hotspotGrader';
import { grade, hashSeed, instantiate, type ParamSpec, type ParametricBody } from '../../../api/src/services/paramEngine';
import { gradePrecheck, serve, type PrecheckItem } from '../../../api/src/services/precheck';
import { assess, explain, MODEL_VERSION, type Signals } from '../../../api/src/services/riskModel';
import type { CheckinOutcome, Fix, LogbookApi, LogEntry, OjtShift, OjtTotals, Placement } from '../modules/ApprenticeLogbook';
import type { Graded, Item, ItemResult, Response, Sitting } from '../modules/AssessmentPlayer';
import type { RiskData, RiskLearner } from '../modules/EarlyWarning';
import type { LockView, MachineApi, MachineInfo, ServedQuestion } from '../modules/MachineAccess';
import type { HeatCell, HeatUnit, RadarPoint, SkillsData } from '../modules/SkillsHeatmap';
import { LEVELS, type Level } from '../modules/types';
import type { MachineRow, StockRow } from '../modules/WorkshopBoards';
import type { Trade } from '../prototype/trades';
import fixtures from './fixtures.json';

interface PrecheckFx { code: string; title: string; titleAr: string; trade: string; items: PrecheckItem[]; drawCount: number; passMark: number; unlockMinutes: number; passportHours: number }
interface SchematicFx { code: string; trade: string; title: string; titleAr: string; viewBox: string; svg: string;
  question: { stem: string; body: Record<string, unknown>; maxPoints: number }; spots: (Hotspot & { label: string })[] }
interface ParamFx { id: string; trade: string; body: ParametricBody & { stem_ar?: string }; abs: number | null; rel: number | null; maxPoints: number; params: ParamSpec[] }
const FX = fixtures as unknown as { prechecks: PrecheckFx[]; schematics: SchematicFx[]; parametric: ParamFx[] };

/** Deterministic 0..1 from a string, so a reload shows the same demo. */
const rand = (s: string) => (hashSeed(s) % 100_000) / 100_000;
const uuid = () => crypto.randomUUID();

// ── tiny observable store so every screen re-renders on a change ───────────
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
export const demoSubscribe = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const demoVersion = () => version;
const changed = () => { version++; listeners.forEach((l) => l()); };

// ── machines, pre-checks and locks ─────────────────────────────────────────
const PREFIX: Record<string, string> = { cnc: 'CNC2-L', auto: 'AUTO1-B', elec: 'ELEC-BTH-', weld: 'WELD3-B' };
const KIND: Record<string, [string, string]> = { cnc: ['CNC lathe', 'مخرطة CNC'], auto: ['Vehicle bay', 'خليج مركبة'], elec: ['Wiring booth', 'كابينة توصيلات'], weld: ['MIG welding booth', 'كابينة لحام MIG'] };
interface Lock { id: string; tag: string; learner: { en: string; ar: string }; state: 'unlock_pending' | 'unlocked'; endsAt: number; pin?: string }
interface Machine { tag: string; trade: string; name: string; status: 'available' | 'maintenance'; qr: string; hardware: boolean }
const machines = new Map<string, Machine>();
const locks = new Map<string, Lock>();
const passports = new Map<string, number>();   // tag → valid until (the demo learner's)
const failedToday = new Map<string, number>();
const attempts = new Map<string, { tag: string; served: string[]; trade: string }>();

function ensureMachines(t: Trade) {
  if ([...machines.values()].some((m) => m.trade === t.id)) return;
  const pc = FX.prechecks.find((p) => p.trade === t.id)!;
  for (const s of t.stations) {
    const tag = PREFIX[t.id]! + String(s.no).padStart(2, '0');
    machines.set(tag, { tag, trade: t.id, name: `${KIND[t.id]![0]} ${s.no}`, status: s.no === 11 ? 'maintenance' : 'available',
      qr: 'VTC-' + hashSeed('qr-' + tag).toString(16).toUpperCase().slice(0, 10).padStart(10, '0'), hardware: s.no === 1 });
    // Learners already at work hold a live unlock; the demo learner's own bench (their station) is free.
    if (s.status === 'working' && s.learner.en !== t.learner.name.en && s.no !== 11) {
      locks.set(tag, { id: uuid(), tag, learner: s.learner, state: 'unlocked', endsAt: Date.now() + (40 + rand(tag) * 100) * 60_000 });
    }
  }
  void pc;
}
const own = (t: Trade) => PREFIX[t.id]! + String(t.stations.find((s) => s.learner.en === t.learner.name.en)?.no ?? 4).padStart(2, '0');
const lockView = (l: Lock): LockView => ({ id: l.id, state: l.state, sessionEndsAt: new Date(l.endsAt).toISOString(), tokenExpiresAt: null, unlockedAt: null, ...(l.pin ? { pin: l.pin } : {}) });

export function machineDemo(t: Trade) {
  ensureMachines(t);
  const pc = FX.prechecks.find((p) => p.trade === t.id)!;
  const find = (code: string) => {
    const m = [...machines.values()].find((x) => x.qr === code || x.tag === code.toUpperCase());
    if (!m) throw { status: 404, code: 'not_found' };
    return m;
  };
  const info = (m: Machine): MachineInfo => {
    const lock = locks.get(m.tag);
    const mine = lock && lock.learner.en === t.learner.name.en ? lock : null;
    const blockers = [m.status === 'maintenance' ? 'machine_maintenance' : null, lock && !mine ? 'machine_in_use' : null, m.trade !== t.id ? 'missing_competency' : null].filter(Boolean) as string[];
    const valid = (passports.get(m.tag) ?? 0) > Date.now();
    return {
      machine: { tag: m.tag, name: m.name, status: m.status, workshop: t.bay.name.en, workshopAr: t.bay.name.ar, controller: m.hardware ? 'hardware' : 'virtual', requiredCompetency: { code: `${t.code}-L3-U01-E1`, title: t.units[0]!.title.en } },
      precheck: { code: pc.code, title: pc.title, titleAr: pc.titleAr, questions: Math.max(pc.drawCount, pc.items.filter((i) => i.critical).length), unlockMinutes: pc.unlockMinutes },
      eligible: blockers.length === 0, blockers, passport: valid ? { id: m.tag, validUntil: new Date(passports.get(m.tag)!).toISOString() } : null, lock: mine ? lockView(mine) : null,
    };
  };
  const unlock = (m: Machine): LockView => {
    const l: Lock = { id: uuid(), tag: m.tag, learner: t.learner.name, state: m.hardware ? 'unlock_pending' : 'unlocked', endsAt: Date.now() + pc.unlockMinutes * 60_000,
      ...(m.hardware ? { pin: String(Math.floor(rand(uuid()) * 1e6)).padStart(6, '0') } : {}) };
    locks.set(m.tag, l); changed();
    return lockView(l);
  };
  const api: MachineApi = {
    scan: async (code) => info(find(code)),
    start: async (code) => {
      const m = find(code);
      const i = info(m);
      if (!i.eligible) throw { status: 403, code: 'not_eligible', details: { blockers: i.blockers } };
      if (i.passport) return { reused: true, passport: i.passport, lock: i.lock ?? unlock(m) };
      const id = uuid();
      const items = serve({ items: pc.items, drawCount: pc.drawCount, passMark: pc.passMark }, id) as ServedQuestion[];
      attempts.set(id, { tag: m.tag, served: items.map((x) => x.id), trade: t.id });
      return { reused: false, attemptId: id, expiresAt: new Date(Date.now() + 600_000).toISOString(), title: pc.title, titleAr: pc.titleAr, items };
    },
    submit: async (attemptId, answers) => {
      const a = attempts.get(attemptId)!;
      const result = gradePrecheck({ items: pc.items, drawCount: pc.drawCount, passMark: pc.passMark }, a.served, answers);
      if (!result.passed) { failedToday.set(a.tag, (failedToday.get(a.tag) ?? 0) + 1); changed(); return { result, passport: null, lock: null }; }
      const until = Date.now() + pc.passportHours * 3600_000;
      passports.set(a.tag, until);
      return { result, passport: { id: a.tag, validUntil: new Date(until).toISOString() }, lock: unlock(machines.get(a.tag)!) };
    },
    release: async (lockId) => { for (const [k, l] of locks) if (l.id === lockId) locks.delete(k); changed(); },
  };
  const demoCodes = (() => {
    const tags = [own(t), [...locks.keys()].find((k) => machines.get(k)?.trade === t.id), PREFIX[t.id]! + '11'].filter(Boolean) as string[];
    // Station 11 (the machine under maintenance) only exists in trades with 11 or more stations.
    return tags.filter((tag) => machines.has(tag)).map((tag) => ({ code: machines.get(tag)!.qr, label: tag }));
  })();
  const rows = (): MachineRow[] => [...machines.values()].filter((m) => m.trade === t.id).map((m) => {
    const l = locks.get(m.tag);
    return { tag: m.tag, name: m.name, status: m.status, qrCode: m.qr, tradeId: m.trade, hardware: m.hardware, controllerSeenAt: m.hardware ? new Date(Date.now() - 20_000).toISOString() : null,
      precheckCode: pc.code, competencyCode: `${t.code}-L3-U01-E1`, lockId: l?.id ?? null, lockState: l?.state ?? null, sessionEndsAt: l ? new Date(l.endsAt).toISOString() : null, unlockedAt: null,
      learnerId: l ? l.learner.en : null, learnerName: l?.learner.en ?? null, learnerNameAr: l?.learner.ar ?? null,
      validPassports: l ? 1 : 0, failedToday: failedToday.get(m.tag) ?? 0 };
  });
  return { api, demoCodes, rows, stop: async (lockId: string) => api.release(lockId) };
}

// ── stores forecast ────────────────────────────────────────────────────────
const received = new Map<string, number>();
export function storesDemo(t: Trade): { rows: StockRow[]; receive: (id: string, qty: number) => Promise<void> } {
  const rows = t.consumables.map((c, i): StockRow => {
    const lead = i === 2 ? 10 : 5;
    const burn = Math.round((c.reorderAt / (lead + 2)) * 10) / 10;
    const booked = Math.round(burn * 7 * (0.8 + rand(c.code) * 0.5) * 10) / 10;
    const onHand = c.onHand + (received.get(c.code) ?? 0);
    const daily = Math.max(burn, booked / 7);
    const cover = daily ? Math.round((onHand / daily) * 10) / 10 : null;
    const status = cover !== null && cover < lead ? 'critical' : onHand <= c.reorderAt ? 'reorder' : 'ok';
    return { id: c.code, tradeId: t.id, sku: c.code, name: c.name.en, unit: c.unit.en, onHand, reorderPoint: c.reorderAt, leadTimeDays: lead, burnPerDay: burn,
      booked7d: booked, shortfall14d: Math.max(0, Math.round((daily * 14 - onHand) * 10) / 10), daysOfCover: cover, status, hazardClass: /fluid|gas|cyl/i.test(c.name.en) ? 'GHS07' : null, usedBy: t.bay.jobCards };
  });
  return { rows, receive: async (id, qty) => { received.set(id, (received.get(id) ?? 0) + qty); changed(); } };
}

// ── early warning ──────────────────────────────────────────────────────────
const acks = new Map<string, string>();
export function riskDemo(trades: Trade[]): RiskData & { ack: (id: string, note: string) => Promise<void> } {
  const learners: RiskLearner[] = [];
  for (const t of trades) {
    for (const s of t.stations) {
      const k = `${t.id}:${s.no}`, r = rand(k);
      const weak = s.status === 'alert' || s.no === 11, watch = !weak && r > 0.82;
      const signals: Signals = {
        attendanceRate: weak ? 0.66 + r * 0.08 : watch ? 0.84 : 0.9 + r * 0.09,
        floorAvg: s.score ?? (weak ? 55 + r * 6 : watch ? 66 : 72 + r * 18), floorTrend: weak ? -9 : watch ? -6 : r * 6 - 2,
        gateFails: weak ? 1 : 0, vlabPassRate: weak ? 0.25 : watch ? 0.5 : 0.7 + r * 0.3, safetyViolations: weak ? 2 : 0,
        quizPct: weak ? 42 : watch ? 58 : 65 + r * 30, ojtPace: watch ? 0.78 : 0.95 + r * 0.15, daysInactive: weak ? 9 : Math.round(r * 4),
        daysToFinal: 18,
      };
      const risk = assess(signals);
      learners.push({ learnerId: k, name: s.learner.en, nameAr: s.learner.ar, cohort: t.bay.cohort.en, cohortAr: t.bay.cohort.ar, tradeId: t.id,
        probability: risk.probability, band: risk.band, urgent: risk.urgent, daysToFinal: 18, reasons: risk.factors.slice(0, 3).map(explain),
        signals: signals as RiskLearner['signals'], snapshotId: k, acknowledged: acks.has(k), actionNote: acks.get(k) ?? null });
    }
  }
  learners.sort((a, b) => b.probability - a.probability);
  return { model: MODEL_VERSION, learners, trend: [], ack: async (id, note) => { acks.set(id, note); changed(); } };
}

// ── skills heatmap ─────────────────────────────────────────────────────────
function levelFor(t: Trade, stationNo: number, unit: number, el: number): Level {
  const st = t.stations.find((s) => s.no === stationNo)!;
  const base = (st.score ?? 72) / 100 + (st.status === 'alert' ? -0.25 : 0) - unit * 0.06;
  const v = base + rand(`${t.id}${stationNo}${unit}${el}`) * 0.6 - 0.25;
  return v > 0.95 ? 'master' : v > 0.72 ? 'autonomous' : v > 0.5 ? 'intermediate' : v > 0.3 ? 'novice' : 'not_yet';
}
export function skillsDemo(trades: Trade[]): SkillsData & { radar: (learnerId: string) => Promise<RadarPoint[]> } {
  const units: HeatUnit[] = [], grid: HeatCell[] = [];
  for (const t of trades) {
    const els = t.units.flatMap((u, ui) => [1, 2].map((e) => ({ code: `${t.code}-L3-${u.code}-E${e}`, unit: u, ui, e })));
    for (const el of els) {
      const counts: Record<Level, number> = { not_yet: 0, novice: 0, intermediate: 0, autonomous: 0, master: 0 };
      for (const s of t.stations) {
        const lv = levelFor(t, s.no, el.ui, el.e);
        counts[lv]++;
        grid.push({ learnerId: `${t.id}:${s.no}`, name: s.learner.en, nameAr: s.learner.ar, cohortId: t.id, code: el.code, level: lv, score: null });
      }
      units.push({ cohortId: t.id, cohort: t.bay.cohort.en, cohortAr: t.bay.cohort.ar, competencyId: el.code, code: el.code,
        title: `${el.unit.title.en} · element ${el.e}`, titleAr: `${el.unit.title.ar} · العنصر ${el.e}`, unitCode: `${t.code}-L3-${el.unit.code}`,
        unitTitle: el.unit.title.en, unitTitleAr: el.unit.title.ar, notYet: counts.not_yet, novice: counts.novice, intermediate: counts.intermediate,
        autonomous: counts.autonomous, master: counts.master, learners: t.stations.length, meanLevel: null });
    }
  }
  const flow = Array.from({ length: 10 }, (_, w) => LEVELS.slice(1).map((level, k) => ({
    week: new Date(Date.now() - (9 - w) * 7 * 86400_000).toISOString().slice(0, 10), level, n: Math.round((2 + w * 0.9) * (1 - k * 0.22) * (0.7 + rand(`${w}${k}`) * 0.6)),
  }))).flat();
  const IDX: Record<Level, number> = { not_yet: 0, novice: 1, intermediate: 2, autonomous: 3, master: 4 };
  return { units, grid, flow, radar: async (id) => {
    const cohort = id.split(':')[0]!;
    return units.filter((u) => u.cohortId === cohort).map((u) => {
      const cells = grid.filter((c) => c.code === u.code);
      const mine = cells.find((c) => c.learnerId === id)!;
      return { code: u.code, title: u.title, titleAr: u.titleAr, level: mine.level, score: null, cohortMean: cells.reduce((a, c) => a + IDX[c.level], 0) / cells.length };
    });
  } };
}

// ── assessment (parametric + schematic pinpointing + safety MCQs) ──────────
export function assessmentDemo(t: Trade, learnerId: string) {
  const sittingId = uuid();
  const items: Item[] = [];
  const answers = new Map<string, { kind: 'mcq'; correct: string } | { kind: 'param'; answer: number; abs: number | null; rel: number | null } | { kind: 'hot'; spots: Hotspot[]; maxPins?: number; penalty: number }>();
  for (const p of FX.parametric.filter((q) => q.trade === t.id)) {
    const inst = instantiate(p.body, p.params, hashSeed(`${p.id}|${learnerId}|${sittingId}`), { abs: p.abs, rel: p.rel });
    items.push({ id: p.id, code: `${t.code}-PARAM`, maxPoints: p.maxPoints, type: 'parametric', stem: inst.stem, stemAr: inst.stemAr, unit: inst.unit, decimals: p.body.answer_decimals ?? null });
    answers.set(p.id, { kind: 'param', answer: inst.answer, abs: inst.absTol, rel: inst.relTol });
  }
  for (const s of FX.schematics.filter((x) => x.trade === t.id)) {
    const body = s.question.body as { stem_ar?: string; max_pins?: number; extra_pin_penalty?: number };
    const id = `hot-${s.code}`;
    items.push({ id, code: s.code, maxPoints: s.question.maxPoints, type: 'hotspot', stem: s.question.stem, stemAr: body.stem_ar ?? null,
      maxPins: body.max_pins ?? 2, targets: s.spots.filter((x) => x.role === 'target').length,
      schematic: { code: s.code, title: s.title, titleAr: s.titleAr, kind: 'wiring', viewBox: s.viewBox, svg: s.svg } });
    answers.set(id, { kind: 'hot', spots: s.spots, maxPins: body.max_pins, penalty: body.extra_pin_penalty ?? 0.5 });
  }
  const pc = FX.prechecks.find((p) => p.trade === t.id)!;
  for (const q of pc.items.slice(0, 2)) {
    items.push({ id: `mcq-${q.id}`, code: pc.code, maxPoints: 1, type: 'mcq', stem: q.prompt.en.replace(/…$/, ':'), stemAr: q.prompt.ar.replace(/…$/, ':'), options: q.options });
    answers.set(`mcq-${q.id}`, { kind: 'mcq', correct: q.correct });
  }
  const sitting: Sitting = { assessmentId: sittingId, items };
  const submit = async (responses: Record<string, Response>): Promise<Graded> => {
    let score = 0, max = 0;
    const out: ItemResult[] = items.map((it) => {
      const a = answers.get(it.id)!, r = responses[it.id];
      let res: ItemResult;
      if (a.kind === 'mcq') res = { id: it.id, type: 'mcq', correct: r === a.correct, points: r === a.correct ? it.maxPoints : 0, maxPoints: it.maxPoints, key: a.correct };
      else if (a.kind === 'param') {
        const g = grade({ answer: a.answer, absTol: a.abs, relTol: a.rel }, typeof r === 'string' ? r : null);
        res = { id: it.id, type: 'parametric', correct: g.correct, points: g.correct ? it.maxPoints : 0, maxPoints: it.maxPoints, key: Math.round(g.expected * 1e4) / 1e4, band: g.band, given: g.given, deviation: g.deviation };
      } else {
        const pins = typeof r === 'object' && r ? r.pins : [];
        const g = gradeHotspots(a.spots, pins, { maxPins: a.maxPins, extraPinPenalty: a.penalty });
        res = { id: it.id, type: 'hotspot', correct: g.correct, points: Math.round(it.maxPoints * (g.maxScore ? g.score / g.maxScore : 0) * 100) / 100, maxPoints: it.maxPoints,
          pins, regions: a.spots as ItemResult['regions'], missed: g.missed, distractorHits: g.distractorHits };
      }
      score += res.points; max += it.maxPoints;
      return res;
    });
    return { score: Math.round(score * 100) / 100, max, items: out };
  };
  return { sitting, submit };
}

// ── apprentice OJT logbook ─────────────────────────────────────────────────
const SITES: Record<string, Placement> = {
  cnc: { site: 'Precision Parts Co. · Badr City, Hall 2', siteAr: 'شركة الأجزاء الدقيقة · مدينة بدر، العنبر 2', employer: 'Precision Parts Co.', radiusM: 250, latitude: 30.1272, longitude: 31.7193, supervisor: 'Eng. Sherif Adly' },
  auto: { site: 'Nasr City service centre', siteAr: 'مركز خدمة مدينة نصر', employer: 'Cairo Motors', radiusM: 150, latitude: 30.0561, longitude: 31.33, supervisor: 'Eng. Hany Mourad' },
  elec: { site: '10th of Ramadan plant, Hall C', siteAr: 'مصنع العاشر من رمضان، العنبر C', employer: 'Nile Electro-Mechanical Co.', radiusM: 250, latitude: 30.2935, longitude: 31.7432, supervisor: 'Eng. Tamer Saad' },
  weld: { site: 'Ataka shipyard, fabrication shop', siteAr: 'ترسانة عتاقة، ورشة التصنيع', employer: 'Suez Steel Structures', radiusM: 300, latitude: 29.9566, longitude: 32.4842, supervisor: 'Eng. Waleed Hassan' },
};
const ojt = new Map<string, { totals: OjtTotals; shifts: OjtShift[]; entries: LogEntry[]; open: { id: string; at: number } | null }>();

function ojtState(t: Trade) {
  if (!ojt.has(t.id)) {
    const site = SITES[t.id]!;
    const shifts: OjtShift[] = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(Date.now() - (i + 1) * 2.5 * 86400_000); d.setHours(8, 2 + Math.round(rand(`${t.id}s${i}`) * 12), 0, 0);
      const minutes = 420 + Math.round(rand(`${t.id}m${i}`) * 60);
      const flagged = i === 3;
      return { id: `s${i}`, openedAt: d.toISOString(), closedAt: new Date(d.getTime() + minutes * 60_000).toISOString(), minutes, verified: !flagged, status: 'closed',
        flags: flagged ? ['checkout_outside'] : [], inDistanceM: 20 + Math.round(rand(`${t.id}d${i}`) * 60), outDistanceM: flagged ? site.radiusM + 140 : 30, site: site.site };
    });
    const tasks = [
      ['Assisted the maintenance technician on a planned stop; logged readings on the job sheet.', 'ساعدت فني الصيانة في توقف مخطط؛ سجلت القراءات في ورقة العمل.'],
      ['Worked under supervision on the line; checked my work against the drawing before handover.', 'عملت تحت الإشراف على الخط؛ راجعت عملي مقابل الرسم قبل التسليم.'],
      ['Toolbox talk on PPE and lock-out; inspected and tagged portable tools.', 'حديث سلامة عن معدات الوقاية والعزل؛ فحصت ووسمت العدد اليدوية.'],
    ];
    const entries: LogEntry[] = tasks.map(([en], i) => ({
      id: `e${i}`, workDate: shifts[i]!.openedAt.slice(0, 10), hours: Math.round((shifts[i]!.minutes ?? 420) / 30) / 2, summary: en!, status: i === 0 ? 'submitted' : 'approved', media: [],
      signoff: i === 0 ? null : { decision: 'approved', comment: i === 1 ? 'Good, careful work.' : null, signedAt: new Date(new Date(shifts[i]!.closedAt!).getTime() + 30 * 60_000).toISOString(),
        hash: hashSeed(`sig${t.id}${i}`).toString(16).padStart(14, '0') + hashSeed(`sig2${t.id}${i}`).toString(16).padStart(14, '0') },
    }));
    const verified = 64 + Math.round(rand(t.id) * 20);
    ojt.set(t.id, { totals: { required_hours: 120, verified_hours: verified, unverified_hours: 7.5, expected_hours: verified + 4, on_site: false }, shifts, entries, open: null });
  }
  return ojt.get(t.id)!;
}

export function logbookDemo(t: Trade, online: () => boolean) {
  const st = ojtState(t), site = SITES[t.id]!;
  let prev: Fix | null = null;
  const api: LogbookApi = {
    demoFix: (inside) => {
      const off = inside ? 0.00018 : 0.0045;   // ≈ 20 m vs ≈ 500 m north of the gate
      return { latitude: site.latitude + off, longitude: site.longitude + 0.0001, accuracyM: 12, deviceTime: new Date().toISOString(), isMocked: false, source: 'demo' };
    },
    checkin: async (kind, fix): Promise<CheckinOutcome> => {
      if (!online()) return { accepted: false, queued: true, reason: null };
      const at = new Date(fix.deviceTime);
      const s = screen({ latitude: fix.latitude, longitude: fix.longitude, accuracyM: fix.accuracyM, at }, { now: new Date(), isMocked: fix.isMocked,
        previous: prev ? { latitude: prev.latitude, longitude: prev.longitude, accuracyM: prev.accuracyM, at: new Date(prev.deviceTime) } : null });
      const j = judge({ latitude: site.latitude, longitude: site.longitude, radiusM: site.radiusM }, { latitude: fix.latitude, longitude: fix.longitude, accuracyM: fix.accuracyM, at });
      const distanceM = Math.round(haversineM(site.latitude, site.longitude, fix.latitude, fix.longitude));
      if (s.refuse.length) return { accepted: false, reason: s.refuse[0]!, flags: s.flags, inside: j.inside, distanceM, radiusM: site.radiusM, totals: st.totals };
      prev = fix;
      if (kind === 'in') {
        if (st.open) return { accepted: false, reason: 'already_checked_in' };
        st.open = { id: uuid(), at: Date.now() };
        st.totals = { ...st.totals, on_site: true };
      } else {
        if (!st.open) return { accepted: false, reason: 'not_checked_in' };
        const minutes = Math.max(1, Math.round((Date.now() - st.open.at) / 60_000));
        st.shifts = [{ id: st.open.id, openedAt: new Date(st.open.at).toISOString(), closedAt: new Date().toISOString(), minutes, verified: j.inside, status: 'closed',
          flags: j.inside ? [] : ['checkout_outside'], inDistanceM: 20, outDistanceM: distanceM, site: site.site }, ...st.shifts];
        st.totals = { ...st.totals, on_site: false, [j.inside ? 'verified_hours' : 'unverified_hours']: Math.round((st.totals[j.inside ? 'verified_hours' : 'unverified_hours'] + minutes / 60) * 10) / 10 };
        st.open = null;
      }
      changed();
      return { accepted: true, inside: j.inside, distanceM, radiusM: site.radiusM, reason: j.inside ? null : 'outside_geofence', flags: s.flags, totals: st.totals };
    },
    submit: async (e, photos) => {
      st.entries = [{ id: uuid(), workDate: e.workDate, hours: e.hours, summary: e.summary, status: 'submitted', queued: !online(), signoff: null,
        media: photos.map((p) => ({ mediaId: p.url, type: p.blob.type.startsWith('video') ? 'video' : 'photo' })) }, ...st.entries];
      return { queued: !online() };
    },
  };
  return { api, placement: site, totals: st.totals, shifts: st.shifts, entries: st.entries };
}
