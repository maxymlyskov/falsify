'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeRepo } = require('./helpers');
const { fingerprint } = require('../lib/runrec');

const BIN = path.join(__dirname, '..', 'bin', 'stop-hook');

function runHook(dir, input) {
  const r = spawnSync(process.execPath, [BIN], { cwd: dir, encoding: 'utf8', input: JSON.stringify(input) });
  const decision = r.stdout && r.stdout.trim() ? JSON.parse(r.stdout.trim()) : null;
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, decision };
}

function writeRecord(dir, ticket, rec) {
  const cacheDir = path.join(dir, '.claude', '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const file = path.join(cacheDir, `falsify-run-${ticket}.json`);
  fs.writeFileSync(file, JSON.stringify(rec, null, 2));
  return file;
}

function readRecord(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const ok = (extra = {}) => ({ result: { ok: true, pass: true, ...extra }, tier: 'A' });

// A below-HIGH run record: G4 is missing entirely, so the scorecard would call it a hard-gate failure.
function belowHighRecord(overrides = {}) {
  return {
    ticket: 'T-9', kind: 'feature', started: new Date().toISOString(), rounds: 1,
    steps: { 1: { started: new Date().toISOString() }, 6: { started: new Date().toISOString() } },
    gates: {
      G0: ok({ total: 14 }), G1: ok({ baseCount: 0, branchCount: 0 }), TAMPER: ok({ findings: [] }),
      G2: ok({ missed: [], static: [], dismissed: [] }), G3: ok({ behaviors: 1 }),
      G5: ok({ checked: 1, over: [], preexisting: [] }), G6: ok({ killed: 1, tried: 1, candidates: 1, survivors: [], equivalent: [] }),
      G7: ok({ text: 'proven' }), G8: ok({ fixes: 0 }),
      QA: { steps: 2, stepsA: 2, edge: 0, house: 0, fired: 0, blocking: 0 },
    },
    ...overrides,
  };
}

function repo(t) {
  const r = makeRepo({ 'README.md': 'hello\n' });
  t.after(r.cleanup);
  return r;
}

test('no run records → the stop is allowed', (t) => {
  const r = repo(t);
  const { code, stdout, decision } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.equal(code, 0);
  assert.equal(stdout, '');
  assert.equal(decision, null);
});

test('an open run below HIGH is blocked with its state and the record counts the block', (t) => {
  const r = repo(t);
  const file = writeRecord(r.dir, 'T-9', belowHighRecord());
  const { code, decision } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.equal(code, 0);
  assert.ok(decision, 'expected a block decision');
  assert.equal(decision.decision, 'block');
  assert.match(decision.reason, /ticket T-9/);
  assert.match(decision.reason, /no score yet/);
  assert.match(decision.reason, /block 1\/10/);
  assert.match(decision.reason, /runrec .*score.*until HIGH/s);
  const saved = readRecord(file);
  assert.equal(saved.stop.blocks, 1);
});

test('a pending question lets exactly one stop through', (t) => {
  const r = repo(t);
  const file = writeRecord(r.dir, 'T-9', belowHighRecord({ pendingQuestion: true }));
  const first = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.equal(first.decision, null);
  const afterFirst = readRecord(file);
  assert.equal(afterFirst.pendingQuestion, false);
  const second = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.ok(second.decision, 'second stop should be blocked again');
});

test('a halted or ended run lets the stop through', (t) => {
  const r = repo(t);
  writeRecord(r.dir, 'T-9', belowHighRecord({ ended: new Date().toISOString(), halt: { code: 'NOT_CONFIGURED', message: null, at: new Date().toISOString() } }));
  const { decision } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.equal(decision, null);
});

test('a record owned by another session is ignored', (t) => {
  const r = repo(t);
  writeRecord(r.dir, 'T-9', belowHighRecord({ session: 'other-session' }));
  const { decision } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.equal(decision, null);
});

test('two stops with no progress in between halt the run as NO_PROGRESS', (t) => {
  const r = repo(t);
  const rec = belowHighRecord();
  const file = writeRecord(r.dir, 'T-9', rec);
  // Prime the record as if one prior stop already found no change (same:1), matching the fingerprint
  // the next invocation will compute since nothing in the repo or record changes between the two.
  const fp = fingerprint(rec, r.dir);
  const primed = readRecord(file);
  primed.stop = { blocks: 1, last: fp, same: 1 };
  fs.writeFileSync(file, JSON.stringify(primed, null, 2));
  const { decision } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.equal(decision, null, 'a halt prints nothing, same as an allowed stop');
  const saved = readRecord(file);
  assert.equal(saved.halt.code, 'NO_PROGRESS');
  assert.ok(saved.ended);
});

test('a run past its wall ceiling halts as OVER_BUDGET', (t) => {
  const r = repo(t);
  const longAgo = new Date(Date.now() - 300 * 60000).toISOString(); // 300m ago, default ceiling 240m
  const file = writeRecord(r.dir, 'T-9', belowHighRecord({ started: longAgo }));
  const { decision } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.equal(decision, null);
  const saved = readRecord(file);
  assert.equal(saved.halt.code, 'OVER_BUDGET');
});

test('a HIGH score still blocks until the run is ended, with the finish instruction', (t) => {
  const r = repo(t);
  const rec = belowHighRecord();
  // The record file must already exist on disk before the fingerprint is taken: an untracked run
  // record is itself part of `git status --porcelain`, so computing the fingerprint pre-write and
  // reading it back post-write (as the hook does) would see two different trees and call it stale.
  const file = writeRecord(r.dir, 'T-9', rec);
  rec.score = { score: 95, verdict: 'HIGH', at: new Date().toISOString() };
  rec.score.fingerprint = fingerprint(rec, r.dir);
  fs.writeFileSync(file, JSON.stringify(rec, null, 2));
  const { decision } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.ok(decision, 'expected a block decision');
  assert.match(decision.reason, /score HIGH 95/);
  assert.match(decision.reason, /Finish the run: open the PR/);
  assert.doesNotMatch(decision.reason, /\(stale\)/);
  const saved = readRecord(file);
  assert.ok(!saved.ended);
});

test('a stale score is shown as stale', (t) => {
  const r = repo(t);
  const rec = belowHighRecord();
  rec.score = { score: 95, verdict: 'HIGH', at: new Date().toISOString(), fingerprint: 'not-the-current-fingerprint' };
  writeRecord(r.dir, 'T-9', rec);
  const { decision } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.ok(decision, 'expected a block decision');
  assert.match(decision.reason, /score HIGH 95 \(stale\)/);
});

test('an internal error allows the stop and is logged', (t) => {
  const r = repo(t);
  // A read-only record (a file another process holds, on Windows): claiming it for the session throws
  // on write — an uncaught failure inside the hook, which is exactly what the outer catch exists for.
  const rec = belowHighRecord();
  writeRecord(r.dir, 'T-9', rec);
  const recFile = path.join(r.dir, '.claude', '.cache', 'falsify-run-T-9.json');
  fs.chmodSync(recFile, 0o444);
  t.after(() => { try { fs.chmodSync(recFile, 0o666); } catch (e) { /* already gone */ } });
  const { code, decision, stderr } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.equal(code, 0);
  assert.equal(decision, null);
  assert.equal(stderr, '');
  const errLog = path.join(r.dir, '.claude', '.cache', 'stop-hook.err');
  assert.ok(fs.existsSync(errLog), 'expected an error log to be written');
  assert.match(fs.readFileSync(errLog, 'utf8'), /EPERM|EACCES/);
});

test('a passing QA entry is read as QA even when it carries a tier, as the scorecard reads it', (t) => {
  const r = repo(t);
  const rec = belowHighRecord();
  rec.gates.QA = { steps: 5, stepsA: 5, edge: 3, house: 0, fired: 0, blocking: 0, tier: 'A', round: 1 };
  writeRecord(r.dir, 'T-9', rec);
  const { decision } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.equal(decision.decision, 'block');
  assert.doesNotMatch(decision.reason, /QA (FAIL|n\/a)/);
});

test('with two open records the most recently written one is acted on, not a stale one', (t) => {
  const r = repo(t);
  const stale = writeRecord(r.dir, 'AAA', belowHighRecord({ ticket: 'AAA' }));
  const past = new Date(Date.now() - 3600 * 1000);
  fs.utimesSync(stale, past, past);
  writeRecord(r.dir, 'ZZZ', belowHighRecord({ ticket: 'ZZZ' }));
  const { decision } = runHook(r.dir, { session_id: 's1', cwd: r.dir });
  assert.match(decision.reason, /ticket ZZZ/);
  assert.equal(readRecord(stale).session, undefined);
});
