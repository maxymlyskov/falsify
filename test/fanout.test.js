'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeRepo } = require('./helpers');

// History where g.mapper.ts co-changes with f.service.ts in 5 of its 6 commits; h.ts rides along once.
function coChangeRepo(t) {
  const r = makeRepo({ 'src/f.service.ts': 'export const f = 0;\n', 'src/g.mapper.ts': 'export const g = 0;\n', 'src/h.ts': 'export const h = 0;\n' });
  t.after(r.cleanup);
  for (let i = 1; i <= 5; i++) {
    r.write('src/f.service.ts', `export const f = ${i};\n`);
    if (i !== 3) r.write('src/g.mapper.ts', `export const g = ${i};\n`);
    if (i === 2) r.write('src/h.ts', `export const h = ${i};\n`);
    r.commit(`change ${i}`);
  }
  r.branch('work');
  r.write('src/f.service.ts', 'export const f = 99;\n');
  return r;
}

test('a file that co-changed 5/6 times with a changed file is MISSED; a 1/6 file is not', (t) => {
  const r = coChangeRepo(t);
  const { code, result } = r.gate('fanout', 'main');
  assert.equal(code, 1);
  assert.equal(result.code, 'MISSED');
  assert.deepEqual(result.missed.map((m) => [m.file, m.because, m.conf, m.support]), [['src/g.mapper.ts', 'src/f.service.ts', 0.83, 5]]);
  assert.equal(result.thresholds.provenance, 'prior — unmeasured');
});

test('editing the flagged file closes the finding', (t) => {
  const r = coChangeRepo(t);
  r.write('src/g.mapper.ts', 'export const g = 99;\n');
  const { code, result } = r.gate('fanout', 'main');
  assert.equal(code, 0);
  assert.equal(result.pass, true);
});

test('--dismiss turns the gate green and records the reason', (t) => {
  const r = coChangeRepo(t);
  const { code, result } = r.gate('fanout', 'main --dismiss "src/g.mapper.ts=mapper untouched: the change is a constant rename"');
  assert.equal(code, 0);
  assert.deepEqual(result.dismissed, [{ file: 'src/g.mapper.ts', reason: 'mapper untouched: the change is a constant rename' }]);
  assert.equal(result.missed.length, 0);
});

test('static rules from --rules flag an entity change whose DTO and mapper were not touched', (t) => {
  const r = makeRepo({
    'src/entities/Venue.ts': 'export class Venue { id: number; }\n',
    'src/dto/venue.dto.ts': 'export class VenueDto { id: number; }\n',
    'src/mapper/venue.map.ts': 'export const map = (v) => v;\n',
    'rules.json': JSON.stringify([{ when: '^src/entities/([A-Za-z0-9]+)\\.ts$', expect: ['src/dto/$lc1.dto.ts', 'src/mapper/$lc1.map.ts', 'src/missing/$kebab1.ts'], why: 'entity → DTO, mapper' }]),
  });
  t.after(r.cleanup);
  r.branch('work');
  r.write('src/entities/Venue.ts', 'export class Venue { id: number; partyUrl: string; }\n');
  const { result } = r.gate('fanout', 'main --rules rules.json');
  assert.equal(result.pass, false);
  assert.deepEqual(result.static.map((s) => s.file).sort(), ['src/dto/venue.dto.ts', 'src/mapper/venue.map.ts']);
  assert.equal(result.static[0].rule, 'entity → DTO, mapper');
});

test('static rules are read from .claude/falsify.config.json when present', (t) => {
  const r = makeRepo({
    'src/a.ts': 'export const a = 1;\n',
    'src/a.types.ts': 'export type A = number;\n',
    '.claude/falsify.config.json': JSON.stringify({ gates: { fanout: { rules: [{ when: '^src/(\\w+)\\.ts$', expect: ['src/$1.types.ts'], why: 'types mirror' }] } } }),
  });
  t.after(r.cleanup);
  r.branch('work');
  r.write('src/a.ts', 'export const a = 2;\n');
  const { result } = r.gate('fanout', 'main');
  assert.deepEqual(result.static.map((s) => s.file), ['src/a.types.ts']);
});

test('nothing changed is pass:null NO_TARGETS', (t) => {
  const r = makeRepo({ 'a.ts': '1\n' });
  t.after(r.cleanup);
  r.branch('work');
  const { code, result } = r.gate('fanout', 'main');
  assert.equal(code, 0);
  assert.equal(result.pass, null);
  assert.equal(result.code, 'NO_TARGETS');
});
