import test from 'node:test';
import assert from 'node:assert/strict';
import { levelsFor } from '../src/levels.ts';

const pick = (o: object = {}) => ({ sym: 'TCS', asOf: '2026-10-27', horizon: 20, ref: 100, stop: 90, ...o });

test('a swing pick draws the signal close, the stop and its two targets (1.5R and 3R)', () => {
  const l = levelsFor('TCS', [pick()]);
  assert.deepEqual(l.map((x) => [x.label, x.v]), [['Signal close', 100], ['Stop', 90], ['T1 at signal close', 115], ['T2 at signal close', 130]]);
});
test('a short-term pick uses 1R and 2R; a long one 2R and 4R', () => {
  assert.deepEqual(levelsFor('TCS', [pick({ horizon: 5 })]).filter((x) => x.kind === 'target').map((x) => x.v), [110, 120]);
  assert.deepEqual(levelsFor('TCS', [pick({ horizon: 60 })]).filter((x) => x.kind === 'target').map((x) => x.v), [120, 140]);
});
test('a pick written before the policy that is still unfinished draws live levels (the ladder was backfilled to it)', () => {
  assert.deepEqual(levelsFor('TCS', [pick({ asOf: '2026-10-01' })]).map((x) => x.label), ['Signal close', 'Stop', 'T1 at signal close', 'T2 at signal close']);
});
test('a pick written before the policy that has FINISHED draws its two levels as REFERENCE (orientation only, never traded)', () => {
  const l = levelsFor('TCS', [pick({ asOf: '2026-10-01', final: true })]);
  assert.deepEqual(l.map((x) => x.kind), ['signal', 'stop', 'target', 'target']);
  assert.deepEqual(l.filter((x) => x.kind === 'target').map((x) => [x.label, x.v, x.ref]), [['T1 ref at signal close', 115, true], ['T2 ref at signal close', 130, true]]);
});
test('the newest pick for the name wins; other names and broken picks draw nothing', () => {
  assert.equal(levelsFor('TCS', [pick({ asOf: '2026-10-28', ref: 200, stop: 180 }), pick()])[0].v, 200);
  assert.deepEqual(levelsFor('INFY', [pick()]), []);
  assert.deepEqual(levelsFor('TCS', [pick({ stop: 120 })]), []);
});
