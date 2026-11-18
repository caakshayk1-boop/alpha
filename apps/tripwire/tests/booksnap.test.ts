import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appendSnapshot, bookSeries, emptySnapFile, snapshotOf } from '../src/booksnap.ts';
import { summarizeLedger, type Ledger } from '../src/ledger.ts';

const P = (id: string, engine: string, sym = id) => ({ id: `2026-11-02|${engine}|${sym}`, engine, sym, asOf: '2026-11-02', ref: 100, stop: 95, horizon: 20, score: 90, rank: 1 });
function ledger(): Ledger {
  const picks = [P('a', 'MOM'), P('b', 'MOM'), P('c', 'QLT'), P('d', 'QLT'), P('e', 'QLT'), P('f', 'LVT'), P('g', 'ST')];
  return { schema: 'tripwire-ledger/1', started: '2026-11-02', updated: '2026-11-18T00:00:00Z', cost: 0.25, days: [], picks, voided: { [picks[4].id]: 'bug' },
    outcomes: {
      [picks[0].id]: { status: 'open', final: false, markDay: '2026-11-17', r: 1.5, t1Hit: true },
      [picks[1].id]: { status: 'open', final: false, markDay: '2026-11-17', r: -0.25 },
      [picks[2].id]: { status: 'closed', final: true, exitDay: '2026-11-16', r: -1.04 },
      [picks[3].id]: { status: 'open', final: false, markDay: '2026-11-16' },              // no mark in R: counted as unmarked, adds nothing
      [picks[4].id]: { status: 'closed', final: true, exitDay: '2026-11-10', r: 9 },        // voided: out of every figure
      [picks[5].id]: { status: 'open', final: false, markDay: '2026-11-17', r: 7 },         // retired engine: out
      [picks[6].id]: { status: 'closed', final: true, exitDay: '2026-11-12', r: 2.2 },
    } } as unknown as Ledger;
}

test('the snapshot counts what summarizeLedger counts: voided and retired are out, an unmarked position adds nothing', () => {
  const s = snapshotOf(ledger())!;
  assert.equal(s.day, '2026-11-17');
  assert.equal(s.open, 3); assert.equal(s.unmarked, 1); assert.equal(s.t1, 1);
  assert.equal(s.openR, 1.25); assert.equal(s.closed, 2); assert.equal(s.closedR, 1.16);
  assert.deepEqual(Object.keys(s.engines), ['MOM', 'QLT', 'ST']);
  assert.deepEqual(s.engines.MOM, { open: 2, openR: 1.25, t1: 1, closed: 0, closedR: 0 });
  assert.deepEqual(s.engines.QLT, { open: 1, openR: 0, t1: 0, closed: 1, closedR: -1.04 });
});
test('the per-engine rows add up to the book totals', () => {
  const s = snapshotOf(ledger())!; const e = Object.values(s.engines);
  assert.equal(e.reduce((a, x) => a + x.open, 0), s.open); assert.equal(Math.round(e.reduce((a, x) => a + x.openR, 0) * 100) / 100, s.openR); assert.equal(Math.round(e.reduce((a, x) => a + x.closedR, 0) * 100) / 100, s.closedR);
});
test('an empty ledger has no day to name', () => { assert.equal(snapshotOf({ ...ledger(), picks: [], outcomes: {}, voided: {} } as Ledger), null); });
test('append is write-once per day, ordered, and never rewrites a day', () => {
  const s = snapshotOf(ledger())!; const a = appendSnapshot(null, s, '2026-11-18T01:00:00Z');
  assert.equal(a.added, true); assert.equal(a.file.started, '2026-11-18'); assert.equal(a.file.days.length, 1);
  const again = appendSnapshot(a.file, { ...s, openR: 99 }, '2026-11-18T03:00:00Z');
  assert.equal(again.added, false); assert.equal(again.file.days[0].openR, 1.25, 'the first row of a day stands');
  const earlier = appendSnapshot(a.file, { ...s, day: '2026-11-16' }, '2026-11-18T03:00:00Z');
  assert.deepEqual(earlier.file.days.map((d) => d.day), ['2026-11-16', '2026-11-17']);
});
test('the series is closed R plus open R, per session', () => {
  const s = snapshotOf(ledger())!; const pts = bookSeries(appendSnapshot(emptySnapFile('2026-11-18'), s, 'x').file);
  assert.deepEqual(pts, [{ day: '2026-11-17', closedR: 1.16, openR: 1.25, total: 2.41 }]);
  assert.deepEqual(bookSeries(null), []);
  assert.deepEqual(bookSeries({ ok: false, error: 'x' } as never), [], 'an error envelope with no days is an empty series, not an exception');
});
test('on the real ledger the snapshot agrees with summarizeLedger, the figure the Record already prints', () => {
  const l = JSON.parse(readFileSync(new URL('../ledger/ledger.json', import.meta.url), 'utf8')) as Ledger; const s = snapshotOf(l)!; const all = summarizeLedger(l).all;
  assert.equal(s.closed, all.closed); assert.equal(s.closedR, all.totalR); assert.equal(s.open, all.open);
  assert.equal(Object.values(s.engines).reduce((a, x) => a + x.open, 0), s.open);
});
