'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeRepo } = require('./helpers');

const SPEC = [
  "describe('deposit', () => {",
  "  it('charges $50 for a 2-lane package', () => {",
  '    expect(calc(2)).to.equal(50);',
  '  });',
  "  it('charges nothing for a 1-lane package', () => {",
  '    expect(calc(1)).to.equal(0);',
  '  });',
  '});',
  '',
].join('\n');

function repo(t) {
  const r = makeRepo({ 'src/deposit.spec.ts': SPEC, 'src/deposit.ts': 'export const calc = (n) => n >= 2 ? 50 : 0;\n' });
  t.after(r.cleanup);
  r.branch('work');
  return r;
}

test('an appended it() is not tampering', (t) => {
  const r = repo(t);
  r.write('src/deposit.spec.ts', SPEC.replace('});\n', "  it('charges $50 at exactly 2 lanes', () => {\n    expect(calc(2)).to.equal(50);\n  });\n});\n"));
  r.commit();
  const { code, result } = r.gate('tamper', 'main');
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.deepEqual(result.findings, []);
});

test('a removed it() is a removed-test finding', (t) => {
  const r = repo(t);
  r.write('src/deposit.spec.ts', SPEC.replace("  it('charges nothing for a 1-lane package', () => {\n    expect(calc(1)).to.equal(0);\n  });\n", ''));
  r.commit();
  const { code, result } = r.gate('tamper', 'main');
  assert.equal(code, 1);
  assert.equal(result.code, 'TEST_TAMPERED');
  assert.equal(result.findings[0].kind, 'removed-test');
});

test('.skip and .only are findings', (t) => {
  const r = repo(t);
  r.write('src/deposit.spec.ts', SPEC.replace("it('charges nothing", "it.skip('charges nothing").replace("it('charges $50", "it.only('charges $50"));
  r.commit();
  const { result } = r.gate('tamper', 'main');
  assert.deepEqual(result.findings.map((f) => f.kind).sort(), ['skipped', 'skipped']);
});

test('a changed expected literal is a changed-expectation, not a removal', (t) => {
  const r = repo(t);
  r.write('src/deposit.spec.ts', SPEC.replace('expect(calc(2)).to.equal(50);', 'expect(calc(2)).to.equal(0);'));
  r.commit();
  const { result } = r.gate('tamper', 'main');
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].kind, 'changed-expectation');
  assert.match(result.findings[0].text, /equal\(50\).*→.*equal\(0\)/);
});

test('a removed expect line is a removed-assertion', (t) => {
  const r = repo(t);
  r.write('src/deposit.spec.ts', SPEC.replace('    expect(calc(1)).to.equal(0);\n', ''));
  r.commit();
  const { result } = r.gate('tamper', 'main');
  assert.equal(result.findings[0].kind, 'removed-assertion');
});

test('a moved test (removed and re-added verbatim) is not a finding', (t) => {
  const r = repo(t);
  const lines = SPEC.split('\n');
  const first = lines.slice(1, 4); const second = lines.slice(4, 7);
  r.write('src/deposit.spec.ts', [lines[0], ...second, ...first, ...lines.slice(7)].join('\n'));
  r.commit();
  const { result } = r.gate('tamper', 'main');
  assert.equal(result.pass, true);
});

test('an empty catch added to a test file is a finding', (t) => {
  const r = repo(t);
  r.write('src/deposit.spec.ts', SPEC.replace('    expect(calc(1)).to.equal(0);', '    try { expect(calc(1)).to.equal(0); } catch (e) {}'));
  r.commit();
  const { result } = r.gate('tamper', 'main');
  assert.ok(result.findings.some((f) => f.kind === 'empty-catch'));
});

test('a deleted test file is a removed-file finding', (t) => {
  const r = repo(t);
  r.run('git rm -q src/deposit.spec.ts');
  r.commit();
  const { result } = r.gate('tamper', 'main');
  assert.equal(result.findings[0].kind, 'removed-file');
});

test('--accept records a legitimate rewrite and passes', (t) => {
  const r = repo(t);
  r.write('src/deposit.spec.ts', SPEC.replace('    expect(calc(1)).to.equal(0);\n', ''));
  r.commit();
  const first = r.gate('tamper', 'main');
  const { file, line } = first.result.findings[0];
  const { code, result } = r.gate('tamper', `main --accept "${file}:${line}=assertion moved into the shared helper in this diff"`);
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.equal(result.accepted.length, 1);
});

test('changes in non-test files are ignored', (t) => {
  const r = repo(t);
  r.write('src/deposit.ts', 'export const calc = (n) => n > 2 ? 50 : 0;\n');
  r.commit();
  const { result } = r.gate('tamper', 'main');
  assert.equal(result.pass, true);
  assert.deepEqual(result.testFiles, []);
});
