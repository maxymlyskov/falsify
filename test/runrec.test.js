'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { BIN } = require('./helpers');

// A HIGH-scoring run record, same shape as test/scorecard.test.js's fixture.
const ok = (extra = {}) => ({ result: { ok: true, pass: true, ...extra }, tier: 'A' });
function highRecord(overrides = {}) {
  return {
    ticket: 'T-1', kind: 'bug', verdict: 'CONFIRMED-BUG', started: '2026-09-08T09:00:00Z', ended: null, rounds: 2,
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

function writeRecord(rec) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'falsify-rr-')), 'run.json');
  fs.writeFileSync(f, JSON.stringify(rec));
  return f;
}

function runrec(file, args) {
  const argv = Array.isArray(args) ? args : args.split(' ').filter(Boolean);
  const r = spawnSync(process.execPath, [path.join(BIN, 'runrec'), file, ...argv], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const line = out.trim().split('\n').reverse().find((l) => /_RESULT \{/.test(l));
  return { code: r.status, out, result: line ? JSON.parse(line.slice(line.indexOf('{'))) : null };
}

test('question sets pendingQuestion', () => {
  const f = writeRecord(highRecord());
  const { code, result } = runrec(f, 'question');
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  const saved = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(saved.pendingQuestion, true);
});

test('halt records the code and ends the run', () => {
  const f = writeRecord(highRecord());
  const { code, result } = runrec(f, ['halt', 'DIAGNOSIS_UNCONFIRMED', 'no', 'repro']);
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  const saved = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(saved.halt.code, 'DIAGNOSIS_UNCONFIRMED');
  assert.equal(saved.halt.message, 'no repro');
  assert.ok(saved.halt.at);
  assert.ok(saved.ended);
});

test('end marks the run ended', () => {
  const f = writeRecord(highRecord());
  const { code, result } = runrec(f, 'end');
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  const saved = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.ok(saved.ended);
  assert.equal(saved.halt, undefined);
});

test('score stores the scorecard verdict with the current fingerprint', () => {
  const f = writeRecord(highRecord());
  const { code, result, out } = runrec(f, 'score');
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.equal(result.score.verdict, 'HIGH');
  assert.match(out, /^## Confidence/m); // the scorecard's own block passes through first
  const saved = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(saved.score.score, 100);
  assert.equal(saved.score.verdict, 'HIGH');
  assert.ok(saved.score.fingerprint);
  assert.equal(typeof saved.score.fingerprint, 'string');
});

test('an unknown verb is BAD_ARGS, exit 2', () => {
  const f = writeRecord(highRecord());
  const { code, result } = runrec(f, 'frobnicate');
  assert.equal(code, 2);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BAD_ARGS');
});

test('a missing verb is BAD_ARGS, exit 2', () => {
  const f = writeRecord(highRecord());
  const { code, result } = runrec(f, []);
  assert.equal(code, 2);
  assert.equal(result.code, 'BAD_ARGS');
});

test('an unreadable record is BAD_RECORD, exit 2', () => {
  const f = writeRecord(highRecord());
  fs.writeFileSync(f, '{ not json');
  const { code, result } = runrec(f, 'end');
  assert.equal(code, 2);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BAD_RECORD');
});

test('resume releases the record so the next session claims it, with fresh stop counters', () => {
  const f = writeRecord(highRecord({ session: 'old-session', stop: { blocks: 7, last: 'x', same: 1 } }));
  const { code, result } = runrec(f, 'resume');
  assert.equal(code, 0);
  assert.equal(result.action, 'resume');
  const saved = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(saved.session, undefined);
  assert.equal(saved.stop, undefined);
});
