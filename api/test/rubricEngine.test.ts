import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectGateViolations, evaluate, lcsLength, withinTolerance, type Rubric, type TelemetryEvent } from '../src/services/rubricEngine.js';

const t0 = new Date('2026-11-02T08:00:00Z');
let n = 0;
const ev = (verb: string, objectRef?: string, value: Record<string, unknown> = {}): TelemetryEvent => ({
  seq: ++n, occurredAt: new Date(t0.getTime() + n * 1000), verb, objectRef, value,
});

const rubric: Rubric = {
  id: 'r1',
  passThreshold: 70,
  criteria: [
    { key: 'loto', label: 'LOTO first', weight: 10, isGate: true, scoring: { rule: 'precedes', first: 'loto_applied', then: ['panel_opened'] } },
    { key: 'diagnosis', label: 'Diagnosis', weight: 40, isGate: false, scoring: { rule: 'fault_diagnosed', componentOnlyCredit: 50 } },
    { key: 'isolation', label: 'Isolation', weight: 30, isGate: false, scoring: { rule: 'isolation_steps' } },
    { key: 'supply', label: 'Supply', weight: 10, isGate: false, scoring: { rule: 'measurement_tolerance', objectRef: 'X1', expected: 400, relTol: 0.05 } },
    { key: 'parts', label: 'Parts', weight: 10, isGate: false, scoring: { rule: 'penalty_per', verb: 'component_replaced', per: 50, ignoreFaultyComponents: true } },
  ],
};
const fault = { code: 'F-OL-OPEN', componentRef: 'F2', correctIsolationSteps: ['X1', 'Q1', 'S1', 'F2'] };
const ctx = { startedAt: t0, submittedAt: new Date(t0.getTime() + 600_000), faults: [fault] };

describe('rubric engine', () => {
  it('scores a model answer at 100 and passes', () => {
    n = 0;
    const events = [
      ev('loto_applied'), ev('panel_opened'),
      ev('measured', 'X1', { reading: 398 }), ev('measured', 'Q1', { reading: 230 }),
      ev('measured', 'S1', { reading: 0 }), ev('measured', 'F2', { reading: 1e9 }),
      ev('component_replaced', 'F2'), ev('diagnosis_submitted', 'F2', { faultCode: 'F-OL-OPEN' }),
    ];
    const r = evaluate(rubric, events, ctx);
    assert.equal(r.totalScore, 100);
    assert.equal(r.passed, true);
    assert.deepEqual(r.gateFailures, []);
  });

  it('fails the session on a safety gate even with a high score', () => {
    n = 0;
    const events = [
      ev('panel_opened'), ev('loto_applied'),
      ev('measured', 'X1', { reading: 400 }), ev('measured', 'Q1'), ev('measured', 'S1'), ev('measured', 'F2'),
      ev('diagnosis_submitted', 'F2', { faultCode: 'F-OL-OPEN' }),
    ];
    const r = evaluate(rubric, events, ctx);
    assert.equal(r.totalScore, 90);
    assert.equal(r.passed, false);
    assert.deepEqual(r.gateFailures, ['loto']);
    assert.deepEqual(r.criteria.find((c) => c.key === 'loto')!.evidenceSeqs, [1]);
  });

  it('gives partial credit, tolerance bands and part-swap penalties', () => {
    n = 0;
    const events = [
      ev('loto_applied'), ev('measured', 'X1', { reading: 430 }), // 7.5% off → 2× band → 50
      ev('measured', 'S1'), ev('component_replaced', 'K1'),       // healthy contactor swapped → -50
      ev('diagnosis_submitted', 'F2', { faultCode: 'WRONG' }),    // right component, wrong code → 50
    ];
    const r = evaluate(rubric, events, ctx);
    const by = Object.fromEntries(r.criteria.map((c) => [c.key, c.score]));
    assert.deepEqual(by, { loto: 100, diagnosis: 50, isolation: 50, supply: 50, parts: 50 });
    assert.equal(r.passed, false);
  });

  it('only alerts on violations introduced by the new batch', () => {
    n = 0;
    const prior = [ev('panel_opened')];
    const first = detectGateViolations(rubric, [], prior, { startedAt: t0, faults: [fault] });
    assert.equal(first.length, 1);
    const later = detectGateViolations(rubric, prior, [ev('measured', 'X1')], { startedAt: t0, faults: [fault] });
    assert.equal(later.length, 0);
  });

  it('helpers', () => {
    assert.equal(lcsLength(['a', 'x', 'b', 'c'], ['a', 'b', 'c']), 3);
    assert.equal(lcsLength(['c', 'b', 'a'], ['a', 'b', 'c']), 1);
    assert.equal(withinTolerance(25.04, 25.0, 0.05), true);
    assert.equal(withinTolerance(25.06, 25.0, 0.05), false);
  });
});
