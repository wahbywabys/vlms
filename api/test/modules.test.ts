import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluate, ExprError, parse } from '../src/services/expr.js';
import { judge, screen } from '../src/services/geofence.js';
import { distanceTo, gradeHotspots, type Hotspot } from '../src/services/hotspotGrader.js';
import { grade, instantiate, lint, parseAnswer, seedFor, type ParamSpec } from '../src/services/paramEngine.js';
import { gradePrecheck, serve, type PrecheckItem } from '../src/services/precheck.js';
import { assess } from '../src/services/riskModel.js';

describe('formula evaluator', () => {
  it('follows precedence, right-associative powers and functions', () => {
    assert.equal(evaluate('2 + 3 * 4', {}), 14);
    assert.equal(evaluate('2 ^ 3 ^ 2', {}), 512);
    assert.equal(evaluate('-x ^ 2', { x: 3 }), -9);
    assert.ok(Math.abs(evaluate('1000 * vc / (pi * d)', { vc: 180, d: 40 }) - 1432.39) < 0.01);
    assert.ok(Math.abs(evaluate('cosd(60)', {}) - 0.5) < 1e-12);
  });
  it('refuses anything that is not arithmetic', () => {
    assert.throws(() => parse('process.exit()'), ExprError);
    assert.throws(() => parse('constructor["x"]'), ExprError);
    assert.throws(() => evaluate('unknown + 1', {}), ExprError);
    assert.throws(() => evaluate('1 / 0', {}), ExprError);
  });
});

describe('parameterised questions', () => {
  const body = { template: 'Ø{{n}} ±{{tol}}, measured {{m:3}}', answer_expr: 'n - m', derived: { m: 'n + sg * e' }, constraint: 'e - tol' };
  const params: ParamSpec[] = [
    { name: 'n', min: 20, max: 40, step: 5 }, { name: 'tol', min: 0, max: 0, step: 1, choices: [0.02, 0.05] },
    { name: 'e', min: 0.03, max: 0.12, step: 0.005 }, { name: 'sg', min: 0, max: 0, step: 1, choices: [-1, 1] },
  ];
  it('is deterministic per learner and differs between learners', () => {
    const a1 = instantiate(body, params, seedFor('q', 1, 'learner-a', 'exam'), { abs: 0.002 });
    const a2 = instantiate(body, params, seedFor('q', 1, 'learner-a', 'exam'), { abs: 0.002 });
    assert.deepEqual(a1, a2);
    const others = ['b', 'c', 'd', 'e', 'f'].map((x) => instantiate(body, params, seedFor('q', 1, `learner-${x}`, 'exam')).stem);
    assert.ok(new Set([a1.stem, ...others]).size >= 4, 'neighbours should see different numbers');
  });
  it('keeps every draw inside the constraint and renders decimals', () => {
    for (let s = 1; s < 300; s++) {
      const i = instantiate(body, params, s);
      assert.ok(i.values['e']! > i.values['tol']!);
      assert.match(i.stem, /measured \d+\.\d{3}$/);
    }
  });
  it('grades against the absolute or relative band', () => {
    assert.equal(grade({ answer: 1432.4, absTol: null, relTol: 0.02 }, '1410').correct, true);
    assert.equal(grade({ answer: 1432.4, absTol: null, relTol: 0.02 }, '1400').correct, false);
    assert.equal(grade({ answer: -0.035, absTol: 0.002, relTol: null }, '−0,036').correct, true);
    assert.equal(parseAnswer('٠٫٠٥ mm'), 0.05);
    assert.equal(grade({ answer: 1, absTol: 0.1, relTol: null }, '').correct, false);
  });
  it('lints unknown variables and degenerate ranges', () => {
    assert.deepEqual(lint(body, params), []);
    assert.match(lint({ template: 'x', answer_expr: 'V / R' }, [{ name: 'V', min: 1, max: 10, step: 1 }])[0]!, /unknown variable "R"/);
    assert.match(lint({ template: 'x', answer_expr: 'V' }, [{ name: 'V', min: 5, max: 5, step: 1 }])[0]!, /distinct instance/);
  });
});

describe('schematic hotspots', () => {
  const spots: Hotspot[] = [
    { key: 'OL', role: 'target', shape: 'circle', cx: 400, cy: 320, r: 26, tolerance: 10 },
    { key: 'COIL', role: 'distractor', shape: 'rect', x: 376, y: 368, w: 48, h: 36, tolerance: 6 },
    { key: 'TRI', role: 'target', shape: 'polygon', points: [[0, 0], [100, 0], [0, 100]] },
  ];
  it('measures distance to circles, rectangles and polygons', () => {
    assert.ok(distanceTo(spots[0]!, { x: 400, y: 320 }) < 0);
    assert.equal(Math.round(distanceTo(spots[0]!, { x: 400, y: 360 })), 14);
    assert.ok(distanceTo(spots[1]!, { x: 390, y: 380 }) < 0);
    assert.ok(distanceTo(spots[2]!, { x: 10, y: 10 }) < 0);
    assert.ok(distanceTo(spots[2]!, { x: 80, y: 80 }) > 0);
  });
  it('credits each target once, names distractors and charges stray pins', () => {
    const full = gradeHotspots(spots, [{ x: 401, y: 352 }, { x: 10, y: 10 }]);
    assert.equal(full.correct, true);
    assert.equal(full.score, 2);
    const wrong = gradeHotspots(spots, [{ x: 400, y: 385 }, { x: 10, y: 10 }, { x: 12, y: 12 }], { maxPins: 3, extraPinPenalty: 0.5 });
    assert.deepEqual(wrong.missed, ['OL']);
    assert.deepEqual(wrong.distractorHits, ['COIL']);
    assert.equal(wrong.score, 0.5);
  });
});

describe('geofence', () => {
  const site = { latitude: 30.2935, longitude: 31.7432, radiusM: 200 };
  const now = new Date('2026-11-02T08:00:00Z');
  it('allows the fix accuracy (capped) as slack', () => {
    assert.equal(judge(site, { latitude: 30.2935 + 0.0019, longitude: 31.7432, accuracyM: 20, at: now }).inside, true);   // ~211 m
    assert.equal(judge(site, { latitude: 30.2935 + 0.0025, longitude: 31.7432, accuracyM: 500, at: now }).inside, false); // ~278 m, slack capped at 50
  });
  it('refuses mocked or inaccurate fixes and flags skew and impossible travel', () => {
    assert.deepEqual(screen({ latitude: 0, longitude: 0, accuracyM: 150, at: now }, { now, isMocked: true }).refuse, ['mock_location', 'low_accuracy']);
    assert.deepEqual(screen({ latitude: 0, longitude: 0, accuracyM: 5, at: new Date(now.getTime() - 3600_000) }, { now }).flags, ['clock_skew']);
    const prev = { latitude: 30.0444, longitude: 31.2357, at: new Date(now.getTime() - 600_000) };  // Cairo, 10 min earlier
    assert.ok(screen({ latitude: 30.2935, longitude: 31.7432, accuracyM: 5, at: now }, { now, previous: prev }).flags.includes('impossible_travel'));
    assert.deepEqual(screen({ latitude: 0, longitude: 0, accuracyM: 5, at: new Date(now.getTime() - 80 * 3600_000) }, { now, queuedOffline: true }).refuse, ['stale_replay']);
  });
});

describe('machine pre-check', () => {
  const items: PrecheckItem[] = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
    id, critical: i < 2, correct: 'x', prompt: { en: id, ar: id }, options: [{ id: 'x', en: 'x', ar: 'x' }, { id: 'y', en: 'y', ar: 'y' }],
  }));
  const def = { items, drawCount: 3, passMark: 100 };
  it('always serves the critical items and never the answer', () => {
    const served = serve(def, 'attempt-1');
    assert.equal(served.length, 3);
    assert.ok(served.some((s) => s.id === 'a') && served.some((s) => s.id === 'b'));
    assert.ok(served.every((s) => !('correct' in s)));
  });
  it('fails on any critical miss whatever the score', () => {
    const r = gradePrecheck({ ...def, passMark: 60 }, ['a', 'b', 'c'], { a: 'y', b: 'x', c: 'x' });
    assert.equal(r.passed, false);
    assert.deepEqual(r.criticalMissed, ['a']);
    assert.equal(gradePrecheck(def, ['a', 'b', 'c'], { a: 'x', b: 'x', c: 'x' }).passed, true);
  });
});

describe('early-warning model', () => {
  it('rates a steady learner low and a slipping one high, with reasons', () => {
    const ok = assess({ attendanceRate: 0.97, floorAvg: 86, gateFails: 0, vlabPassRate: 0.9, quizPct: 85, ojtPace: 1.1 });
    assert.equal(ok.band, 'low');
    const bad = assess({ attendanceRate: 0.62, floorAvg: 55, gateFails: 2, vlabPassRate: 0.3, quizPct: 35, daysToFinal: 14 });
    assert.equal(bad.band, 'high');
    assert.equal(bad.urgent, true);
    assert.equal(bad.factors[0]!.key, 'attendanceRate');
  });
  it('treats missing signals as neutral', () => {
    assert.equal(assess({}).band, 'low');
  });
});
