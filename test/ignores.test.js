'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeRepo, tsLines } = require('./helpers');

test('--detect in a repository with no GitHub remote reports foreign', (t) => {
  const r = makeRepo({ 'src/a.ts': tsLines(1, 'a') });
  t.after(r.cleanup);
  const { code, result } = r.gate('ignores', '--detect');
  assert.equal(code, 0);
  assert.equal(result.ownership, 'foreign');
});

test('--write foreign reports the exclude file and the added paths', (t) => {
  const r = makeRepo({ 'src/a.ts': tsLines(1, 'a') });
  t.after(r.cleanup);
  const first = r.gate('ignores', '--write foreign');
  assert.equal(first.code, 0);
  assert.deepEqual(first.result.added, ['.claude/falsify.config.json', '.claude/falsify-qa-calibration.md', '.claude/.cache/']);
  assert.ok(first.result.file);
  const second = r.gate('ignores', '--write foreign');
  assert.equal(second.code, 0);
  assert.deepEqual(second.result.added, []);
});

test('an unknown ownership value is BAD_ARGS, exit 2', (t) => {
  const r = makeRepo({ 'src/a.ts': tsLines(1, 'a') });
  t.after(r.cleanup);
  const { code, result } = r.gate('ignores', '--write bogus');
  assert.equal(code, 2);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BAD_ARGS');
});
