'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeRepo, tsLines } = require('./helpers');
const git = require('../lib/git');

test('changedFiles diffs against the merge-base, not the tip of the base branch', (t) => {
  const r = makeRepo({ 'src/a.ts': tsLines(3, 'a') });
  t.after(r.cleanup);
  r.branch('work');
  r.write('src/a.ts', tsLines(5, 'a'));
  r.commit('branch change');
  // main moves ahead with an unrelated file after the branch point
  r.checkout('main');
  r.write('src/foreign.ts', tsLines(40, 'f'));
  r.commit('foreign');
  r.checkout('work');
  const { files } = git.changedFiles('main', { cwd: r.dir, exts: ['.ts'] });
  assert.deepEqual(files.map((f) => f.path), ['src/a.ts']);
  assert.deepEqual(files[0].added, [4, 5]);
});

test('changedFiles reports untracked files with every line added', (t) => {
  const r = makeRepo({ 'src/a.ts': tsLines(1, 'a') });
  t.after(r.cleanup);
  r.branch('work');
  r.write('src/new.ts', tsLines(7, 'n'));
  const { files } = git.changedFiles('main', { cwd: r.dir, exts: ['.ts'] });
  const n = files.find((f) => f.path === 'src/new.ts');
  assert.ok(n && n.untracked);
  assert.equal(n.added.length, 8); // 7 lines + trailing newline split
});

test('parseUnifiedDiff records rename origins and deletions', () => {
  const diff = [
    'diff --git a/old.ts b/new.ts',
    '--- a/old.ts',
    '+++ b/new.ts',
    '@@ -3,2 +3,3 @@',
    '-x', '-y', '+a', '+b', '+c',
  ].join('\n');
  const [f] = git.parseUnifiedDiff(diff);
  assert.equal(f.path, 'new.ts');
  assert.equal(f.oldPath, 'old.ts');
  assert.deepEqual(f.added, [3, 4, 5]);
  assert.equal(f.deleted, 2);
});
