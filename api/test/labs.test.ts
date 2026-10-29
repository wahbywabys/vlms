import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LABS, publicCatalogue, readMeter, rigFrom, runObservation, stepDone } from '../src/labs/index.js';
import { evaluate, type TelemetryEvent } from '../src/services/rubricEngine.js';

/** A careful learner: PPE, run, outside readings, isolate, open, inside readings in order, diagnose, fix one part. */
function perfectRun(lab: (typeof LABS)[number], fault: (typeof LABS)[number]['faults'][number]) {
  const events: TelemetryEvent[] = [];
  const t0 = new Date('2026-10-29T08:00:00Z');
  const push = (verb: string, objectRef: string | null = null, value: Record<string, unknown> = {}) =>
    events.push({ seq: events.length + 1, occurredAt: new Date(t0.getTime() + events.length * 10_000), verb, objectRef, value });
  const measure = (ref: string) => {
    const m = readMeter(lab, ref, [fault.componentRef], rigFrom(events));
    assert.ok(!('live' in m && m.live), `${lab.code} ${ref} should be safe to measure here`);
    push('measured', ref, { reading: m.reading, unit: m.unit });
  };
  const inside = (ref: string) => lab.testPoints.find((t) => t.ref === ref)!.inside;
  push('ppe_donned');
  push('start_pressed', 'run');
  const check = lab.rubric.criteria.find((c) => c.key === 'supply')!.scoring as { objectRef: string };
  // Follow the expected path; isolate and open up just before the first point that needs it.
  const path = fault.correctIsolationSteps;
  const firstInside = path.findIndex(inside);
  if (path[0] !== check.objectRef) measure(check.objectRef);
  path.forEach((ref, i) => {
    if (i === firstInside) { push('loto_applied', lab.isolation.ref); push('panel_opened', 'enclosure'); }
    measure(ref);
  });
  push('diagnosis_submitted', fault.componentRef, { faultCode: fault.code });
  push('component_replaced', fault.componentRef);
  return { events, startedAt: t0, submittedAt: new Date(t0.getTime() + 600_000) };
}

describe('lab catalogue', () => {
  for (const lab of LABS) {
    it(`${lab.code}: every fault can be found and a careful attempt scores 100`, () => {
      for (const fault of lab.faults) {
        const run = perfectRun(lab, fault);
        const res = evaluate(lab.rubric, run.events, { ...run, faults: [fault] });
        assert.equal(res.totalScore, 100, `${fault.code}: ${JSON.stringify(res.criteria.filter((c) => c.score < 100))}`);
        assert.ok(lab.components.some((c) => c.ref === fault.componentRef), `${fault.code} component is diagnosable`);
        assert.ok(lab.conditions.some((c) => c.value === fault.condition), `${fault.code} condition is offered`);
        // The last isolation step reads differently with and without the fault: the fault is detectable.
        const last = fault.correctIsolationSteps.at(-1)!;
        const rig = { ppe: true, locked: true, panelOpen: true, replaced: [] };
        assert.notEqual(readMeter(lab, last, [fault.componentRef], rig).display, readMeter(lab, last, [], rig).display, `${fault.code} at ${last}`);
        assert.deepEqual(runObservation(lab, [fault.componentRef], { ...rig, locked: false }), fault.symptom);
      }
    });

    it(`${lab.code}: test points and steps are consistent`, () => {
      const refs = new Set(lab.testPoints.map((t) => t.ref));
      for (const f of lab.faults) for (const r of f.correctIsolationSteps) assert.ok(refs.has(r), `${f.code} step ${r}`);
      if (lab.diagram !== 'dol') for (const p of lab.diagram.points) assert.ok(refs.has(p.ref), `diagram point ${p.ref}`);
      // Touching an inside point while not isolated is the hazard.
      const insideRef = lab.testPoints.find((t) => t.inside)!.ref;
      assert.equal(readMeter(lab, insideRef, [], { ppe: true, locked: false, panelOpen: true, replaced: [] }).live, true);
      assert.ok(stepDone(lab.steps[0]!.done, [], { ppe: true }));
      assert.ok(!stepDone(lab.steps.at(-1)!.done, [], { ppe: true }));
      // The public catalogue carries no readings or answers.
      const pub = JSON.stringify(publicCatalogue(lab));
      assert.ok(!pub.includes('correctIsolationSteps'));
      for (const f of lab.faults) assert.ok(!pub.includes(f.symptom.en), `${f.code} symptom leaks`);
    });
  }
});
