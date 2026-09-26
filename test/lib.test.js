'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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

test('ownership is own only for write access on a repo that is not a fork', () => {
  assert.equal(git.ownership({ viewerPermission: 'ADMIN', isFork: false }), 'own');
  assert.equal(git.ownership({ viewerPermission: 'MAINTAIN', isFork: false }), 'own');
  assert.equal(git.ownership({ viewerPermission: 'WRITE', isFork: false }), 'own');
});

test('ownership is foreign for a fork, read access, or no answer', () => {
  assert.equal(git.ownership({ viewerPermission: 'ADMIN', isFork: true }), 'foreign');
  assert.equal(git.ownership({ viewerPermission: 'READ', isFork: false }), 'foreign');
  assert.equal(git.ownership(null), 'foreign');
});

test('writeIgnores on a foreign repo appends falsify\'s paths to the exclude file and changes no tracked file', (t) => {
  const r = makeRepo({ 'src/a.ts': tsLines(1, 'a') });
  t.after(r.cleanup);
  git.writeIgnores(r.dir, 'foreign');
  r.write('.claude/falsify.config.json', '{}\n');
  r.write('.claude/falsify-qa-calibration.md', '# calibration\n');
  r.write('.claude/.cache/x.txt', 'x\n');
  assert.equal(r.run('git status --porcelain').trim(), '');
  assert.equal(fs.existsSync(path.join(r.dir, '.gitignore')), false);
});

test('writeIgnores on an own repo adds .claude/.cache/ to .gitignore once', (t) => {
  const r = makeRepo({ 'src/a.ts': tsLines(1, 'a') });
  t.after(r.cleanup);
  const first = git.writeIgnores(r.dir, 'own');
  assert.deepEqual(first.added, ['.claude/.cache/']);
  const contents = fs.readFileSync(path.join(r.dir, '.gitignore'), 'utf8');
  assert.equal(contents.split('\n').filter((l) => l.trim() === '.claude/.cache/').length, 1);
  const second = git.writeIgnores(r.dir, 'own');
  assert.deepEqual(second.added, []);
  const contents2 = fs.readFileSync(path.join(r.dir, '.gitignore'), 'utf8');
  assert.equal(contents2.split('\n').filter((l) => l.trim() === '.claude/.cache/').length, 1);
});

test('writeIgnores appends to an existing .gitignore without a blank line or a merged line', (t) => {
  const r = makeRepo({ '.gitignore': 'node_modules/\n' });
  t.after(r.cleanup);
  git.writeIgnores(r.dir, 'own');
  assert.equal(fs.readFileSync(path.join(r.dir, '.gitignore'), 'utf8'), 'node_modules/\n.claude/.cache/\n');
  r.write('.gitignore', 'dist/');
  git.writeIgnores(r.dir, 'own');
  assert.equal(fs.readFileSync(path.join(r.dir, '.gitignore'), 'utf8'), 'dist/\n.claude/.cache/\n');
});

test('writeIgnores in a linked worktree writes the common exclude file', (t) => {
  const r = makeRepo({ 'src/a.ts': tsLines(1, 'a') });
  t.after(r.cleanup);
  const wtDir = path.join(os.tmpdir(), `falsify-wt-${process.pid}-${Date.now()}`);
  r.run(`git worktree add ${JSON.stringify(wtDir)} -b wt`);
  t.after(() => {
    try { r.run(`git worktree remove --force ${JSON.stringify(wtDir)}`); } catch (e) { /* main repo may already be gone */ }
    try { fs.rmSync(wtDir, { recursive: true, force: true }); } catch (e2) { /* windows file locks */ }
  });
  assert.equal(fs.statSync(path.join(wtDir, '.git')).isFile(), true);
  const result = git.writeIgnores(wtDir, 'foreign');
  assert.deepEqual(result.added, ['.claude/falsify.config.json', '.claude/falsify-qa-calibration.md', '.claude/.cache/']);
  const exclude = fs.readFileSync(path.join(r.dir, '.git', 'info', 'exclude'), 'utf8');
  assert.match(exclude, /\.claude\/falsify\.config\.json/);
  assert.match(exclude, /\.claude\/falsify-qa-calibration\.md/);
  assert.match(exclude, /\.claude\/\.cache\//);
});

test('changedFiles includes an extensionless node script when .js files are asked for', (t) => {
  const r = makeRepo({ 'bin/tool': '#!/usr/bin/env node\nconsole.log(1);\n', 'bin/run.sh': '#!/usr/bin/env bash\necho 1\n', 'bin/NOTES': 'plain text\n' });
  t.after(r.cleanup);
  r.branch('work');
  r.write('bin/tool', '#!/usr/bin/env node\nconsole.log(2);\n');
  r.write('bin/run.sh', '#!/usr/bin/env bash\necho 2\n');
  r.write('bin/NOTES', 'more text\n');
  r.commit('change');
  const { files } = git.changedFiles('main', { cwd: r.dir, exts: ['.js'] });
  assert.deepEqual(files.map((f) => f.path), ['bin/tool']);
});

test('changedFiles keeps extension matches next to node scripts and skips a deleted script', (t) => {
  const r = makeRepo({ 'bin/old': '#!/usr/bin/env node\nconsole.log(0);\n', 'src/a.js': 'module.exports = 1;\n' });
  t.after(r.cleanup);
  r.branch('work');
  r.run('git rm -q bin/old');
  r.write('src/a.js', 'module.exports = 2;\n');
  r.write('bin/new', '#!/usr/bin/env node\nconsole.log(1);\n');
  const { files } = git.changedFiles('main', { cwd: r.dir, exts: ['.js'] });
  assert.deepEqual(files.map((f) => f.path).sort(), ['bin/new', 'src/a.js']);
});

test('changedFiles skips an extensionless path that is not a readable file', (t) => {
  const sub = makeRepo({ 'README': 'x\n' });
  t.after(sub.cleanup);
  const r = makeRepo({ 'src/a.js': 'module.exports = 1;\n' });
  t.after(r.cleanup);
  r.branch('work');
  r.run(`git -c protocol.file.allow=always submodule add -q "${sub.dir.split('\\').join('/')}" vendor`);
  const { files } = git.changedFiles('main', { cwd: r.dir, exts: ['.js'] });
  assert.equal(files.some((f) => f.path === 'vendor'), false);
});

test('changedFiles treats a nodejs shebang as a node script', (t) => {
  const r = makeRepo({ 'README.md': 'x\n' });
  t.after(r.cleanup);
  r.branch('work');
  r.write('bin/legacy', '#!/usr/bin/nodejs\nconsole.log(1);\n');
  const { files } = git.changedFiles('main', { cwd: r.dir, exts: ['.js'] });
  assert.deepEqual(files.map((f) => f.path), ['bin/legacy']);
});
