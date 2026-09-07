'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeRepo } = require('./helpers');

const BUSY = (name) => `export function ${name}(a: number) {
  if (a > 1) { if (a > 2) { if (a > 3) { if (a > 4) { if (a > 5) { if (a > 6) { if (a > 7) { if (a > 8) { if (a > 9) { return 1; } } } } } } } } }
  return 0;
}
`;
const CB = (n, depth) => `export function ${n}(xs: number[]) {
  return xs.map((x) => {
    let r = 0;
${Array.from({ length: depth }, (_, i) => `    if (x > ${i}) r++;`).join('\n')}
    return r;
  });
}
`;
const NESTED = (d) => 'export function deep(x: number) {\n'
  + Array.from({ length: d }, (_, i) => '  '.repeat(i + 1) + `if (x > ${i}) {`).join('\n') + '\n'
  + '  '.repeat(d + 1) + 'return 1;\n'
  + Array.from({ length: d }, (_, i) => '  '.repeat(d - i) + '}').join('\n') + '\n  return 0;\n}\n';

function repo(t, files) {
  const r = makeRepo(files);
  t.after(r.cleanup);
  r.branch('work');
  return r;
}

test('an untracked new file is measured; a foreign commit on main is not', (t) => {
  const r = repo(t, { 'src/x.ts': 'export const a = 1;\n' });
  r.checkout('main');
  r.write('src/foreign.ts', BUSY('foreign'));
  r.commit('foreign');
  r.checkout('work');
  r.write('src/new.service.ts', BUSY('busy'));
  const { code, result } = r.gate('complexity', 'main');
  assert.equal(code, 1, result && JSON.stringify(result));
  assert.equal(result.over.length, 1);
  assert.equal(result.over[0].file, 'src/new.service.ts');
  assert.equal(result.over[0].fn, 'busy');
});

test('a new over-threshold callback in fn B is OVER even if fn A held a worse anonymous callback at base', (t) => {
  const r = repo(t, { 'src/a.ts': CB('A', 12) });
  r.write('src/a.ts', CB('A', 12) + CB('B', 11));
  r.commit();
  const { result } = r.gate('complexity', 'main');
  assert.equal(result.pass, false);
  assert.deepEqual(result.over.map((o) => o.fn), ['B#1']);
  assert.equal(result.over[0].cyclomatic, 12);
  assert.equal(result.preexisting.length, 0, 'A#1 was not touched by the diff');
});

test('cognitive complexity gates deep nesting that cyclomatic lets through', (t) => {
  const r = repo(t, { 'src/d.ts': 'export const d = 1;\n' });
  r.write('src/d.ts', NESTED(6));
  r.commit();
  const { result } = r.gate('complexity', 'main');
  assert.equal(result.pass, false);
  assert.equal(result.over[0].cyclomatic, 7);
  assert.equal(result.over[0].cognitive, 21);
  assert.equal(result.thresholds.cyclomatic, 10);
  assert.equal(result.thresholds.cognitive, 15);
});

test('class property arrows are keyed by property name; unchanged over-threshold fns are PREEXISTING', (t) => {
  const cls = (extra) => `export class C {
  handler = (x: number) => {
    let r = 0;
${Array.from({ length: 11 }, (_, i) => `    if (x > ${i}) r++;`).join('\n')}
    return r;${extra}
  };
}
`;
  const r = repo(t, { 'src/c.ts': cls('') });
  r.write('src/c.ts', cls('\n    // touched'));
  r.commit();
  const { code, result } = r.gate('complexity', 'main');
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.deepEqual(result.preexisting.map((p) => p.fn), ['C.handler']);
});

test('a grown pre-existing function is OVER, with its base values reported', (t) => {
  const r = repo(t, { 'src/g.ts': CB('G', 11) });
  r.write('src/g.ts', CB('G', 13));
  r.commit();
  const { result } = r.gate('complexity', 'main');
  assert.equal(result.pass, false);
  assert.equal(result.over[0].fn, 'G#1');
  assert.deepEqual(result.over[0].base, { cyclomatic: 12, cognitive: 11 });
});

test('no TypeScript changed is pass:null NO_TARGETS', (t) => {
  const r = repo(t, { 'src/c.ts': 'export const c = 1;\n' });
  r.write('README.md', 'docs only\n');
  const { code, result } = r.gate('complexity', 'main');
  assert.equal(code, 0);
  assert.equal(result.pass, null);
  assert.equal(result.code, 'NO_TARGETS');
});

test('spec and migration files are excluded', (t) => {
  const r = repo(t, { 'src/c.ts': 'export const c = 1;\n' });
  r.write('src/c.spec.ts', BUSY('specBusy'));
  r.write('src/migrations/001.ts', BUSY('migBusy'));
  const { result } = r.gate('complexity', 'main');
  assert.equal(result.pass, null);
  assert.equal(result.code, 'NO_TARGETS');
});
