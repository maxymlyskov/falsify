'use strict';
// Fixture repo for gate tests: a temp git repo with a base commit, helpers to change files, and a runner
// that executes a gate from bin/ and parses its RESULT line. Every gate test starts here.

const { execSync, spawnSync } = require('node:child_process');

// Minimal shell-style splitter: whitespace separates, double quotes group, \" is a literal quote.
function splitArgs(s) {
  const out = []; let cur = ''; let inQ = false; let has = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '"') { cur += '"'; i++; has = true; continue; }
    if (ch === '"') { inQ = !inQ; has = true; continue; }
    if (!inQ && /\s/.test(ch)) { if (has) { out.push(cur); cur = ''; has = false; } continue; }
    cur += ch; has = true;
  }
  if (has) out.push(cur);
  return out;
}
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'bin');

function makeRepo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'falsify-'));
  const run = (cmd) => execSync(cmd, { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  run('git init -q -b main');
  run('git config user.email test@falsify.local');
  run('git config user.name falsify-test');
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
  // Runs bin/<name> with argv inside the fixture; returns {code, out, result}. Never throws on exit≠0.
  // `args` is a string split shell-style (double quotes group, \" escapes) or an array — no shell is
  // involved, so nested quotes reach the gate intact on every platform.
  const gate = (name, args = '') => {
    const argv = Array.isArray(args) ? args : splitArgs(args);
    const r = spawnSync(process.execPath, [path.join(BIN, name), ...argv], { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    const line = out.trim().split('\n').reverse().find((l) => /_RESULT \{/.test(l));
    const result = line ? JSON.parse(line.slice(line.indexOf('{'))) : null;
    return { code: r.status, out, result };
  };
  const cleanup = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* windows file locks */ } };
  return { dir, run, write, read, commit, branch, checkout, gate, cleanup };
}

// n lines of plausible TypeScript, each unique, so diff counts are exact.
function tsLines(n, prefix = 'x') {
  return Array.from({ length: n }, (_, i) => `export const ${prefix}${i} = ${i};`).join('\n') + '\n';
}

module.exports = { makeRepo, tsLines, BIN };
