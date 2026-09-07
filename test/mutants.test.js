'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeRepo } = require('./helpers');

const BASE_TS = 'export const f = (a: number, b: number) => a > b;\n';
const ADDED_TS = BASE_TS + 'export const g = (a: number, b: number) => a >= b;\n';
const q = (s) => `"${s.replace(/"/g, '\\"')}"`;

// A "suite" that fails, mocha-style, whenever the added line was mutated.
const KILLING_CMD = `node -e "const s=require('fs').readFileSync('src/x.ts','utf8'); if(!s.includes('a >= b')){console.log('  1 failing');process.exit(1)} console.log('  1 passing')" src/x.spec.ts`;

function repoWithAddedLine(t, extra = {}) {
  const r = makeRepo({ 'package.json': '{}', 'src/x.ts': BASE_TS, 'src/x.spec.ts': '// spec\n', ...extra });
  t.after(r.cleanup);
  r.branch('work');
  r.write('src/x.ts', ADDED_TS);
  return r;
}

test('a mutant that makes the suite fail is killed; the file is restored', (t) => {
  const r = repoWithAddedLine(t);
  const { code, result } = r.gate('mutants', `main ${q(KILLING_CMD)} 4 --skip-baseline`);
  assert.equal(code, 0, JSON.stringify(result));
  assert.equal(result.pass, true);
  assert.equal(result.killed, 1);
  assert.equal(result.tried, 1);
  assert.equal(result.baseline, 'asserted-by-caller');
  assert.equal(r.read('src/x.ts'), ADDED_TS);
});

test('a non-zero exit without a failing line is INCONCLUSIVE, never a kill', (t) => {
  const r = repoWithAddedLine(t);
  const { code, result } = r.gate('mutants', `main ${q('node -e "process.exit(1)" src/x.spec.ts')} 4 --skip-baseline`);
  assert.equal(code, 1);
  assert.equal(result.code, 'INCONCLUSIVE');
  assert.equal(result.inconclusive, 1);
  assert.equal(result.killed, 0);
});

test('--fail-regex overrides the failure grammar; jest and vitest grammars work by default', (t) => {
  const r = repoWithAddedLine(t);
  const jest = KILLING_CMD.replace('1 failing', 'Tests:       1 failed, 3 passed');
  let { result } = r.gate('mutants', `main ${q(jest)} 4 --skip-baseline`);
  assert.equal(result.killed, 1, JSON.stringify(result));
  const custom = KILLING_CMD.replace('1 failing', 'BOOM');
  ({ result } = r.gate('mutants', `main ${q(custom)} 4 --skip-baseline --fail-regex BOOM`));
  assert.equal(result.killed, 1);
});

test('a surviving mutant fails the gate and is named with file, line and operator', (t) => {
  const r = repoWithAddedLine(t);
  const { code, result } = r.gate('mutants', `main ${q('node -e 0 src/x.spec.ts')} 4 --skip-baseline`);
  assert.equal(code, 1);
  assert.equal(result.code, 'SURVIVORS');
  assert.deepEqual(result.survivors, [{ file: 'src/x.ts', line: 2, op: 'ROR', from: '>=', to: '<' }]);
});

test('--equivalent moves a survivor out of the verdict and records the reason', (t) => {
  const r = repoWithAddedLine(t);
  const { code, result } = r.gate('mutants', `main ${q('node -e 0 src/x.spec.ts')} 4 --skip-baseline --equivalent "src/x.ts:2=g is a documented alias of f"`);
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.equal(result.equivalent[0].reason, 'g is a documented alias of f');
});

test('zero candidates is pass:null NO_TARGETS, not a pass', (t) => {
  const r = makeRepo({ 'package.json': '{}', 'src/x.ts': BASE_TS, 'src/x.spec.ts': '' });
  t.after(r.cleanup);
  r.branch('work');
  r.write('src/x.ts', BASE_TS + 'export const h = 1;\n');
  const { code, result } = r.gate('mutants', `main ${q('node -e 0 src/x.spec.ts')} 4 --skip-baseline`);
  assert.equal(code, 0);
  assert.equal(result.pass, null);
  assert.equal(result.code, 'NO_TARGETS');
});

test('a spec path that does not exist from the resolved cwd is SPEC_NOT_FOUND', (t) => {
  const r = repoWithAddedLine(t);
  const { code, result } = r.gate('mutants', `main ${q(KILLING_CMD.replace('src/x.spec.ts', 'src/nope.spec.ts'))} 4 --skip-baseline`);
  assert.equal(code, 2);
  assert.equal(result.code, 'SPEC_NOT_FOUND');
  assert.equal(result.killed, undefined);
});

test('in a monorepo the command runs from the app root that owns the candidate', (t) => {
  const r = makeRepo({ 'server/package.json': '{}', 'server/src/x.ts': BASE_TS, 'server/src/x.spec.ts': '' });
  t.after(r.cleanup);
  r.branch('work');
  r.write('server/src/x.ts', ADDED_TS);
  const { result } = r.gate('mutants', `main ${q(KILLING_CMD)} 4 --skip-baseline`);
  assert.equal(result.cwd, 'server', JSON.stringify(result));
  assert.equal(result.killed, 1);
});

test('a run past the bound is a timeout, not a kill, unless --timeout-kills; the file is restored', (t) => {
  const r = repoWithAddedLine(t);
  const slow = 'node -e "setTimeout(()=>{},8000)" src/x.spec.ts';
  let { result } = r.gate('mutants', `main ${q(slow)} 4 --skip-baseline --timeout 1`);
  assert.equal(result.timeouts, 1);
  assert.equal(result.killed, 0);
  assert.equal(result.code, 'TIMEOUTS');
  ({ result } = r.gate('mutants', `main ${q(slow)} 4 --skip-baseline --timeout 1 --timeout-kills`));
  assert.equal(result.killed, 1);
  assert.equal(result.pass, true);
  assert.equal(r.read('src/x.ts'), ADDED_TS);
});

test('a baseline that is already red is BASELINE_RED, exit 2', (t) => {
  const r = repoWithAddedLine(t);
  const { code, result } = r.gate('mutants', `main ${q('node -e "console.log(\'1 failing\');process.exit(1)" src/x.spec.ts')} 4`);
  assert.equal(code, 2);
  assert.equal(result.code, 'BASELINE_RED');
});

test('a stale journal (hash mismatch) is reported and left alone; a matching one is restored', (t) => {
  const r = repoWithAddedLine(t);
  const journal = path.join(r.dir, '.claude', '.cache', 'mutants-journal.json');
  fs.mkdirSync(path.dirname(journal), { recursive: true });
  fs.writeFileSync(journal, JSON.stringify({ branch: 'other', headSha: 'deadbeef', files: { 'src/x.ts': { original: 'export const stale = true;\n', mutatedSha1: '0'.repeat(40) } } }));
  let { out, result } = r.gate('mutants', `main ${q(KILLING_CMD)} 4 --skip-baseline`);
  assert.match(out, /JOURNAL_STALE src\/x\.ts/);
  assert.equal(r.read('src/x.ts'), ADDED_TS);
  assert.equal(JSON.parse(fs.readFileSync(journal, 'utf8')).stale['src/x.ts'].original, 'export const stale = true;\n');
  assert.equal(result.ok, true);

  const mutated = ADDED_TS.replace('a >= b', 'a < b');
  r.write('src/x.ts', mutated);
  fs.writeFileSync(journal, JSON.stringify({ branch: 'work', headSha: 'x', files: { 'src/x.ts': { original: ADDED_TS, mutatedSha1: crypto.createHash('sha1').update(mutated).digest('hex') } } }));
  ({ out } = r.gate('mutants', `main ${q(KILLING_CMD)} 4 --skip-baseline`));
  assert.match(out, /RECOVERED {2}src\/x\.ts/);
  assert.equal(r.read('src/x.ts'), ADDED_TS);
});

test('an untracked new file is a candidate; a foreign commit on main is not', (t) => {
  const r = makeRepo({ 'package.json': '{}', 'src/x.ts': BASE_TS, 'src/x.spec.ts': '' });
  t.after(r.cleanup);
  r.branch('work');
  r.checkout('main');
  r.write('src/foreign.ts', 'export const z = (a: number) => a < 2;\n');
  r.commit('foreign');
  r.checkout('work');
  r.write('src/new.service.ts', 'export const n = (a: number) => a > 1;\n');
  const cmd = `node -e "const s=require('fs').readFileSync('src/new.service.ts','utf8'); if(!s.includes('a > 1')){console.log('  1 failing');process.exit(1)} console.log('  1 passing')" src/x.spec.ts`;
  const { out, result } = r.gate('mutants', `main ${q(cmd)} 4 --skip-baseline`);
  assert.equal(result.candidates, 1, out);
  assert.equal(result.killed, 1);
  assert.doesNotMatch(out, /foreign\.ts/);
});

const FOUR_OPS = (n) => `export const a${n} = (x: number, y: number) => x > y;
export const b${n} = (x: number, y: number) => x + y;
export const c${n} = (p: boolean, q: boolean) => p && q;
export const d${n} = (x: number) => x === ${n};
console.log('ready', ${n} > 0);
`;

test('12 candidates across 3 files, max 4 → one per file at least; console.* lines are arid', (t) => {
  const r = makeRepo({ 'package.json': '{}', 'src/x.spec.ts': '' });
  t.after(r.cleanup);
  r.branch('work');
  for (const n of [1, 2, 3]) r.write(`src/f${n}.ts`, FOUR_OPS(n));
  const { result } = r.gate('mutants', `main ${q('node -e 0 src/x.spec.ts')} 4 --skip-baseline`);
  assert.equal(result.candidates, 12);
  assert.equal(result.tried, 4);
  assert.equal(new Set(result.sampled.map((m) => m.file)).size, 3);
  assert.ok(result.sampled.every((m) => m.line !== 5), 'the console.log line is never a candidate');
});

test('UOI on a boolean-context identifier, literal flip, and SBR on a call statement are candidates', (t) => {
  const r = makeRepo({ 'package.json': '{}', 'src/x.spec.ts': '' });
  t.after(r.cleanup);
  r.branch('work');
  r.write('src/g.ts', `export class G {
  emitter = { emit: (s: string) => s };
  logger = { warn: (s: string) => s };
  run(flag: boolean) {
    if (flag) {
      this.emitter.emit('x');
      this.logger.warn('arid');
    }
    const ok = true;
    return ok;
  }
}
`);
  const { result } = r.gate('mutants', `main ${q('node -e 0 src/x.spec.ts')} 10 --skip-baseline`);
  assert.deepEqual(result.sampled.map((m) => `${m.line}:${m.op}`).sort(), ['5:UOI', '6:SBR', '9:UOI']);
});
