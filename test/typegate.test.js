'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeRepo } = require('./helpers');

// A stand-in type checker so the tests need no `typescript` install. It reports, in tsc's --pretty
// false format, one error in b.ts whenever a.ts contains the word BREAK (the "changed a type in a.ts,
// the unchanged consumer b.ts now fails" case), and one error in c.ts whenever c.ts contains OLDERR.
const FAKE_TSC = `
const fs = require('fs');
const a = fs.existsSync('src/a.ts') ? fs.readFileSync('src/a.ts', 'utf8') : '';
const c = fs.existsSync('src/c.ts') ? fs.readFileSync('src/c.ts', 'utf8') : '';
let code = 0;
if (a.includes('BREAK')) { console.log("src/b.ts(3,7): error TS2322: Type 'number | null' is not assignable to type 'number'."); code = 2; }
if (c.includes('OLDERR')) { console.log("src/c.ts(1,1): error TS7006: Parameter 'x' implicitly has an 'any' type."); code = 2; }
process.exit(code);
`;

function repo(t, files = {}) {
  const r = makeRepo({
    'tsconfig.json': '{}',
    'fake-tsc.js': FAKE_TSC,
    'src/a.ts': 'export const a: number = 1;\n',
    'src/b.ts': 'import { a } from "./a"; export const b = a + 1;\n',
    'src/c.ts': 'export const c = 1;\n',
    ...files,
  });
  t.after(r.cleanup);
  r.branch('work');
  return r;
}
const TSC = '--tsc "node fake-tsc.js" --no-cache';

test('no errors on either side passes', (t) => {
  const r = repo(t);
  r.write('src/a.ts', 'export const a: number = 2;\n');
  r.commit();
  const { code, result } = r.gate('typegate', `main ${TSC}`);
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.equal(result.baseCount, 0);
});

test('an error in an UNCHANGED file caused by the diff is NEW_ERRORS', (t) => {
  const r = repo(t);
  r.write('src/a.ts', 'export const a: number | null = null; // BREAK\n');
  r.commit();
  const { code, result } = r.gate('typegate', `main ${TSC}`);
  assert.equal(code, 1);
  assert.equal(result.code, 'NEW_ERRORS');
  assert.equal(result.new[0].file, 'src/b.ts');
  assert.equal(result.new[0].code, 'TS2322');
});

test('a pre-existing error on the base is not this branch\'s fault', (t) => {
  const r = repo(t, { 'src/c.ts': 'export const c = (x) => x; // OLDERR\n' });
  r.write('src/a.ts', 'export const a: number = 3;\n');
  r.commit();
  const { code, result } = r.gate('typegate', `main ${TSC}`);
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.equal(result.baseCount, 1);
  assert.equal(result.branchCount, 1);
});

test('fixing a base error is reported as fixed', (t) => {
  const r = repo(t, { 'src/c.ts': 'export const c = (x) => x; // OLDERR\n' });
  r.write('src/c.ts', 'export const c = (x: number) => x;\n');
  r.commit();
  const { result } = r.gate('typegate', `main ${TSC}`);
  assert.equal(result.pass, true);
  assert.equal(result.fixed, 1);
  assert.equal(result.branchCount, 0);
});

test('no tsconfig anywhere is pass:null NO_TYPESCRIPT, exit 0', (t) => {
  const r = makeRepo({ 'src/a.js': 'module.exports = 1;\n' });
  t.after(r.cleanup);
  r.branch('work');
  const { code, result } = r.gate('typegate', 'main --no-cache');
  assert.equal(code, 0);
  assert.equal(result.pass, null);
  assert.equal(result.code, 'NO_TYPESCRIPT');
});

test('--roots selects sub-projects', (t) => {
  const r = makeRepo({ 'server/tsconfig.json': '{}', 'server/fake-tsc.js': 'process.exit(0)', 'web/tsconfig.json': '{}', 'web/fake-tsc.js': 'process.exit(0)' });
  t.after(r.cleanup);
  r.branch('work');
  const { result } = r.gate('typegate', 'main --roots server,web --tsc "node fake-tsc.js" --no-cache');
  assert.deepEqual(result.roots, ['server', 'web']);
  assert.equal(result.pass, true);
});
