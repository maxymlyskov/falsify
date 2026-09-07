'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { BIN } = require('./helpers');

const ok = (extra = {}) => ({ result: { ok: true, pass: true, ...extra }, tier: 'A' });
function record(overrides = {}) {
  return {
    ticket: 'T-1', kind: 'bug', verdict: 'CONFIRMED-BUG', started: '2026-09-08T09:00:00Z', ended: '2026-09-08T09:09:41Z', rounds: 2,
    probe: { spec: 'src/deposit.spec.ts', it: 'charges $50 for a 2-lane package', expected: 50, actual: 0 },
    steps: { 1: { started: '2026-09-08T09:00:00Z', ended: '2026-09-08T09:01:00Z' }, 7: { started: '2026-09-08T09:03:00Z', ended: '2026-09-08T09:08:00Z' } },
    gates: {
      G0: ok({ total: 14 }), G1: ok({ baseCount: 0, branchCount: 0 }), TAMPER: ok({ findings: [] }),
      G2: ok({ missed: [], static: [], dismissed: [] }), G3: ok({ behaviors: 1 }),
      G4: ok({ specs: [{}, {}], passing: 489, failing: 0 }), G5: ok({ checked: 3, over: [], preexisting: [], worst: { fn: 'calculateDeposit', cyclomatic: 7, cognitive: 9 }, thresholds: { cyclomatic: 10, cognitive: 15 } }),
      G6: ok({ killed: 3, tried: 3, candidates: 3, survivors: [], equivalent: [] }), G7: ok({ text: 'G4 whole owning spec ran' }), G8: ok({ fixes: 0 }),
      QA: { steps: 5, stepsA: 5, edge: 3, house: 6, fired: 0, blocking: 0 },
    },
    ...overrides,
  };
}
function run(rec) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'falsify-sc-')), 'run.json');
  fs.writeFileSync(f, JSON.stringify(rec));
  const r = spawnSync(process.execPath, [path.join(BIN, 'scorecard'), f], { encoding: 'utf8' });
  const out = `${r.stdout}${r.stderr}`;
  const line = out.trim().split('\n').reverse().find((l) => /_RESULT \{/.test(l));
  return { code: r.status, out, result: line ? JSON.parse(line.slice(line.indexOf('{'))) : null };
}

test('every row executed → 100, HIGH, and the block is printed', () => {
  const { code, out, result } = run(record());
  assert.equal(code, 0);
  assert.equal(result.score, 100);
  assert.equal(result.verdict, 'HIGH');
  assert.match(out, /^## Confidence/m);
  assert.match(out, /Diagnosis {5}CONFIRMED-BUG — probe deposit\.spec\.ts .*expected 50 got 0 +\[A\]/);
  assert.match(out, /Mutation +killed 3 of 3 tried \(candidates 3\)/);
  assert.match(out, /Score 100 \/ 100 · Verdict HIGH · rounds 2 · wall 9m41s/);
  assert.match(out, /## Cost[\s\S]*7 Battery {6}5m00s/);
});

test('one hard gate failing → 0, NOT SHIPPABLE, exit 1, the gate named', () => {
  const rec = record();
  rec.gates.G4 = { result: { ok: true, pass: false, code: 'FAILING', specs: [{}], passing: 400, failing: 3 }, tier: 'A' };
  const { code, out, result } = run(rec);
  assert.equal(code, 1);
  assert.equal(result.score, 0);
  assert.equal(result.verdict, 'NOT SHIPPABLE');
  assert.deepEqual(result.hardFailed, ['G4']);
  assert.match(out, /hard gate\(s\) failed: G4 \(FAILING\)/);
});

test('Regression at tier B alone is 93.2 HIGH; Regression + Fan-out at tier B is 88.6 MEDIUM', () => {
  const rec = record();
  rec.gates.G4 = { result: null, tier: 'B', reason: 'scoped — CI runs the suite' };
  let { result } = run(rec);
  assert.equal(result.score, 93.2); // (110 - 7.5) / 110 — the bug Diagnosis row is in the denominator
  assert.equal(result.verdict, 'HIGH');
  rec.gates.G2 = { result: null, tier: 'B', reason: 'static list only (budget)' };
  ({ result } = run(rec));
  assert.equal(result.score, 88.6); // two inherited rows on important dimensions is where PRs go wrong
  assert.equal(result.verdict, 'MEDIUM');
});

test('the ticket dimension at tier B caps HIGH to MEDIUM', () => {
  const rec = record({ ticketDimension: 'Regression' });
  rec.gates.G4 = { result: null, tier: 'B', reason: 'scoped' };
  const { result } = run(rec);
  assert.equal(result.score, 93.2);
  assert.equal(result.verdict, 'MEDIUM');
  assert.match(result.capped, /Regression/);
});

test('pass:null rows are excluded from the denominator; a hard pass:null on G3 fails', () => {
  const rec = record();
  rec.gates.G6 = { result: { ok: true, pass: null, code: 'NO_TARGETS' }, tier: 'A' };
  let { result } = run(rec);
  assert.equal(result.score, 100);
  assert.equal(result.rows.Mutation.tier, '—');
  rec.gates.G3 = { result: { ok: true, pass: null, code: 'NO_TARGETS' }, tier: 'A' };
  ({ result } = run(rec));
  assert.equal(result.verdict, 'NOT SHIPPABLE');
});

test('equivalent marks beyond half the tried mutants drop Mutation to tier B', () => {
  const rec = record();
  rec.gates.G6 = ok({ killed: 1, tried: 4, candidates: 4, survivors: [], equivalent: [{}, {}, {}] });
  const { result } = run(rec);
  assert.equal(result.rows.Mutation.tier, 'B');
  assert.equal(result.score, 93.2);
});

test('QA with a blocking finding is a hard fail; QA value is the fraction of [A] steps', () => {
  const rec = record();
  rec.gates.QA = { steps: 5, stepsA: 5, blocking: 1 };
  let { result } = run(rec);
  assert.equal(result.verdict, 'NOT SHIPPABLE');
  rec.gates.QA = { steps: 4, stepsA: 2, blocking: 0 };
  ({ result } = run(rec));
  assert.equal(result.rows.QA.value, 0.5);
  assert.equal(result.score, 95.5);
});

test('a feature run has no Diagnosis row', () => {
  const rec = record({ kind: 'feature', verdict: null, probe: null });
  const { result } = run(rec);
  assert.equal(result.rows.Diagnosis, undefined);
  assert.equal(result.denominator, 90);
  assert.equal(result.score, 100);
});

test('missing record or weights is ok:false with exit 2', () => {
  const r = spawnSync(process.execPath, [path.join(BIN, 'scorecard'), 'nope.json'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /BAD_RECORD/);
});
