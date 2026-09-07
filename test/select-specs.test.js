'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeRepo } = require('./helpers');

// a.spec → a → b → c ; unrelated.spec → unrelated
const FILES = {
  'tsconfig.json': JSON.stringify({ compilerOptions: { module: 'commonjs', moduleResolution: 'node', baseUrl: '.' } }),
  'src/a.ts': "import { b } from './b';\nexport const a = () => b() + 1;\n",
  'src/b.ts': "import { c } from './c';\nexport const b = () => c() + 1;\n",
  'src/c.ts': 'export const c = () => 1;\n',
  'src/a.spec.ts': "import { a } from './a';\nit('a', () => { if (a() !== 3) throw new Error(); });\n",
  'src/unrelated.ts': 'export const u = 1;\n',
  'src/unrelated.spec.ts': "import { u } from './unrelated';\nit('u', () => { if (u !== 1) throw new Error(); });\n",
};

function repo(t) {
  const r = makeRepo(FILES);
  t.after(r.cleanup);
  r.branch('work');
  return r;
}

test('a change to a direct import selects the spec with via "direct import"', (t) => {
  const r = repo(t);
  r.write('src/a.ts', "import { b } from './b';\nexport const a = () => b() + 2;\n");
  r.commit();
  const { code, result } = r.gate('select-specs', 'main');
  assert.equal(code, 0);
  assert.deepEqual(result.specs, [{ spec: 'src/a.spec.ts', via: 'direct import' }]);
});

test('a change two hops away is selected with the chain named; three hops is outside depth 2', (t) => {
  const r = repo(t);
  r.write('src/b.ts', "import { c } from './c';\nexport const b = () => c() + 2;\n");
  r.commit();
  let { result } = r.gate('select-specs', 'main');
  assert.deepEqual(result.specs, [{ spec: 'src/a.spec.ts', via: 'src/a.ts → src/b.ts' }]);
  r.write('src/b.ts', FILES['src/b.ts']);
  r.write('src/c.ts', 'export const c = () => 2;\n');
  r.commit();
  ({ result } = r.gate('select-specs', 'main'));
  assert.deepEqual(result.specs, []);
  ({ result } = r.gate('select-specs', 'main --depth 3'));
  assert.equal(result.specs[0].via, 'src/a.ts → src/b.ts → src/c.ts');
});

test('a changed spec selects itself; an unrelated change selects nothing', (t) => {
  const r = repo(t);
  r.write('src/unrelated.spec.ts', FILES['src/unrelated.spec.ts'] + "it('u2', () => {});\n");
  r.commit();
  const { result } = r.gate('select-specs', 'main');
  assert.deepEqual(result.specs, [{ spec: 'src/unrelated.spec.ts', via: 'spec changed' }]);
});

test('above --max the answer is ALL', (t) => {
  const r = repo(t);
  r.write('src/c.ts', 'export const c = () => 2;\n');
  r.write('src/a.ts', "import { b } from './b';\nexport const a = () => b() + 3;\n");
  r.commit();
  const { result } = r.gate('select-specs', 'main --max 0');
  assert.equal(result.specs, 'ALL');
  assert.match(result.reason, /exceeded max/);
});

test('no changed source is pass:null NO_TARGETS', (t) => {
  const r = repo(t);
  r.write('README.md', 'x\n');
  r.commit();
  const { code, result } = r.gate('select-specs', 'main');
  assert.equal(code, 0);
  assert.equal(result.pass, null);
  assert.equal(result.code, 'NO_TARGETS');
});
