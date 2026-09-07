'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeRepo, tsLines } = require('./helpers');

function repoWithChange(t, n, file = 'src/a.ts') {
  const r = makeRepo({ 'src/a.ts': tsLines(1, 'base') });
  t.after(r.cleanup);
  r.branch('work');
  r.write(file, tsLines(n, 'c'));
  r.commit('change');
  return r;
}

test('a small diff passes with no warning', (t) => {
  const r = repoWithChange(t, 14);
  const { code, result } = r.gate('diffsize', 'main');
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.equal(result.warn, undefined);
  assert.equal(result.total, 14 + 1); // 14 added, the 1 base line deleted
});

test('between warn and halt passes with warn:LARGE', (t) => {
  const r = repoWithChange(t, 250);
  const { code, result } = r.gate('diffsize', 'main');
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.equal(result.warn, 'LARGE');
});

test('over the halt threshold fails with SPLIT_REQUIRED and exit 1', (t) => {
  const r = repoWithChange(t, 401);
  const { code, result } = r.gate('diffsize', 'main');
  assert.equal(code, 1);
  assert.equal(result.pass, false);
  assert.equal(result.code, 'SPLIT_REQUIRED');
});

test('--allow turns a halt into a recorded pass', (t) => {
  const r = repoWithChange(t, 401);
  const { code, result } = r.gate('diffsize', 'main --allow "migration plus its fan-out, reviewed in two passes"');
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.match(result.allowed, /migration/);
});

test('spec, migration and lock files are not counted', (t) => {
  const r = makeRepo({ 'src/a.ts': tsLines(1, 'base') });
  t.after(r.cleanup);
  r.branch('work');
  r.write('src/a.spec.ts', tsLines(500, 's'));
  r.write('src/migrations/001.ts', tsLines(500, 'm'));
  r.write('package-lock.json', '{}\n'.repeat(500));
  r.write('src/a.ts', tsLines(3, 'c'));
  r.commit('change');
  const { result } = r.gate('diffsize', 'main');
  assert.deepEqual(result.files.map((f) => f.path), ['src/a.ts']);
  assert.equal(result.pass, true);
});

test('untracked new source files are counted', (t) => {
  const r = makeRepo({ 'src/a.ts': tsLines(1, 'base') });
  t.after(r.cleanup);
  r.branch('work');
  r.write('src/new.ts', tsLines(450, 'n')); // not committed, not staged
  const { code, result } = r.gate('diffsize', 'main');
  assert.equal(code, 1);
  assert.equal(result.code, 'SPLIT_REQUIRED');
});

test('missing base ref is a BAD_ARGS with exit 2', (t) => {
  const r = repoWithChange(t, 3);
  const { code, result } = r.gate('diffsize', '');
  assert.equal(code, 2);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BAD_ARGS');
});
