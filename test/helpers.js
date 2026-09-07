'use strict';
// Fixture repo for gate tests: a temp git repo with a base commit, helpers to change files, and a runner
// that executes a gate from bin/ and parses its RESULT line. Every gate test starts here.

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'bin');

function makeRepo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'burden-'));
  const run = (cmd) => execSync(cmd, { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  run('git init -q -b main');
  run('git config user.email test@burden.local');
  run('git config user.name burden-test');
  run('git config commit.gpgsign false');
  const write = (p, content) => {
    const f = path.join(dir, p);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
  };
  const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
  for (const [p, c] of Object.entries(files)) write(p, c);
  run('git add -A');
  run('git commit -q --allow-empty -m "base"');
  const commit = (msg = 'change') => { run('git add -A'); run(`git commit -q --allow-empty -m "${msg}"`); };
  const branch = (name = 'work') => run(`git checkout -q -b ${name}`);
  const checkout = (name) => run(`git checkout -q ${name}`);
  // Runs bin/<name> <args> inside the fixture; returns {code, out, result}. Never throws on exit≠0.
  const gate = (name, args = '') => {
    let out = ''; let code = 0;
    try {
      out = execSync(`node "${path.join(BIN, name)}" ${args}`, { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      out = `${e.stdout || ''}${e.stderr || ''}`;
      code = e.status;
    }
    const line = out.trim().split('\n').reverse().find((l) => /_RESULT \{/.test(l));
    const result = line ? JSON.parse(line.slice(line.indexOf('{'))) : null;
    return { code, out, result };
  };
  const cleanup = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* windows file locks */ } };
  return { dir, run, write, read, commit, branch, checkout, gate, cleanup };
}

// n lines of plausible TypeScript, each unique, so diff counts are exact.
function tsLines(n, prefix = 'x') {
  return Array.from({ length: n }, (_, i) => `export const ${prefix}${i} = ${i};`).join('\n') + '\n';
}

module.exports = { makeRepo, tsLines, BIN };
