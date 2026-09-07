'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

// The wrapper is exercised with a fake `gh` on PATH that echoes its argv, so no network and no auth.
const BIN = path.join(__dirname, '..', 'bin', 'gh-cli');
function run(args, { withFakeGh = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'falsify-gh-'));
  if (withFakeGh) { fs.writeFileSync(path.join(dir, 'gh'), '#!/usr/bin/env bash\necho "gh $*"\n'); fs.chmodSync(path.join(dir, 'gh'), 0o755); }
  const r = spawnSync('bash', [BIN, ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

test('no verb, unknown verb, and forbidden verbs are USAGE with exit 2', () => {
  for (const args of [[], ['merge'], ['pr-merge', '1'], ['repo', 'delete'], ['push', '--force']]) {
    const { code, out } = run(args);
    assert.equal(code, 2, args.join(' '));
    assert.match(out, /^USAGE/m);
  }
});

test('pr-create requires base, title and an existing body file; passes --draft through', () => {
  const body = path.join(os.tmpdir(), `falsify-body-${process.pid}.md`);
  fs.writeFileSync(body, '# body\n');
  let r = run(['pr-create', '--base', 'main', '--title', 'fix: x']);
  assert.equal(r.code, 2);
  r = run(['pr-create', '--base', 'main', '--title', 'fix: x', '--body-file', body, '--draft']);
  assert.equal(r.code, 0);
  assert.match(r.out, /^gh pr create --base main --title fix: x --body-file .*--draft$/m);
  r = run(['pr-create', '--base', 'main', '--title', 'fix: x', '--body-file', body, '--force']);
  assert.equal(r.code, 2);
});

test('numeric verbs reject non-numbers and extra arguments', () => {
  assert.equal(run(['pr-ready', 'abc']).code, 2);
  assert.equal(run(['pr-checks', '12', '--watch', '--extra']).code, 2);
  const r = run(['pr-checks', '12', '--watch']);
  assert.equal(r.code, 0);
  assert.match(r.out, /^gh pr checks 12 --watch$/m);
  assert.match(run(['issue-view', '7']).out, /^gh issue view 7 --json /m);
});
