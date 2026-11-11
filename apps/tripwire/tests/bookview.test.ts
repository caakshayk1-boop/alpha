// The Book's display logic (src/bookview.ts, 11 Nov 2026): the order rows need attention in, the missing-nights note, the per-trade R bars, and the old addresses of the Book's views.
// No clock: every date is a literal fed to pure functions that read only the NSE calendar table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attention, byAttention, nearWord, missingNights, missingNightsLine, rBars, bookView, NEAR_PCT, type AttnInput } from '../src/bookview.ts';

const row = (key: string, o: Partial<AttnInput>): AttnInput => ({ status: 'open', mark: 100, stop: 90, t1: 120, t2: 140, t1Hit: false, t2Hit: false, key, ...o });

test('attention: distance to the stop and to the next unfilled target, in percent of what is booked', () => {
  const a = attention(row('A', { mark: 100, stop: 98, t1: 110 }));
  assert.equal(a.toStop, 2.04); assert.equal(a.toTarget, 10); assert.equal(a.next, 'T1'); assert.equal(a.near, 'stop'); assert.equal(a.group, 0);
  const b = attention(row('B', { mark: 100, stop: 80, t1: 102, t1Hit: false }));
  assert.equal(b.near, 'target'); assert.equal(b.group, 1);
  const c = attention(row('C', { t1Hit: true, t2: 105 })); assert.equal(c.next, 'T2'); assert.equal(c.toTarget, 5);
  const d = attention(row('D', { t1Hit: true, t2Hit: true })); assert.equal(d.next, null); assert.equal(d.toTarget, null);
  assert.equal(attention(row('E', { mark: null })).toStop, null, 'no price, no distance (never zero)');
  assert.equal(attention(row('F', { status: 'pending' })).group, 3); assert.equal(attention(row('G', { status: 'closed' })).group, 4); assert.equal(attention(row('H', { status: 'skipped' })).group, 4);
  assert.equal(NEAR_PCT, 3);
});

test('byAttention: nearest stop first, then nearest target, then other open by stop distance, then waiting, then finished; stable', () => {
  const rows = [
    row('far', { mark: 100, stop: 80, t1: 130 }),
    row('closed', { status: 'closed' }),
    row('stop2', { mark: 100, stop: 98.5 }),
    row('wait', { status: 'waiting', mark: null }),
    row('tgt', { mark: 100, stop: 80, t1: 101 }),
    row('stop1', { mark: 100, stop: 99.5 }),
    row('mid', { mark: 100, stop: 90, t1: 130 }),
    row('noprice', { mark: null }),
    row('tgt2', { mark: 100, stop: 85, t1: 102.5 }),
  ];
  assert.deepEqual(byAttention(rows, (r) => r).map((r) => r.key), ['stop1', 'stop2', 'tgt', 'tgt2', 'mid', 'far', 'noprice', 'wait', 'closed']);
  const same = [row('b', {}), row('a', {})]; assert.deepEqual(byAttention(same, (r) => r).map((r) => r.key), ['a', 'b'], 'ties fall back to the key');
  assert.deepEqual(byAttention([], (r: AttnInput) => r), []);
});

test('nearWord: says how near, in words, and says a mark under the stop rather than hiding it', () => {
  assert.deepEqual(nearWord(attention(row('a', { mark: 100, stop: 98.8 }))), { kind: 'stop', text: '1.2% above its stop' });
  assert.deepEqual(nearWord(attention(row('b', { mark: 90, stop: 95 }))), { kind: 'stop', text: 'At or below its stop' });
  assert.deepEqual(nearWord(attention(row('c', { mark: 100, stop: 80, t1: 102 }))), { kind: 'target', text: '2.0% from T1' });
  assert.deepEqual(nearWord(attention(row('d', { mark: 100, stop: 80, t1Hit: true, t2: 101 }))), { kind: 'target', text: '1.0% from T2' });
  assert.equal(nearWord(attention(row('e', {}))), null); assert.equal(nearWord(attention(row('f', { status: 'pending' }))), null);
});

test('missingNights: sessions inside the record with no night; weekends and NSE holidays are never missing', () => {
  // the real record: 3 Nov then 6 Nov 2026, so Wed 4 and Thu 5 Nov were sessions with no night
  const days = ['2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-06', '2026-11-09'];
  assert.deepEqual(missingNights(days), ['2026-11-04', '2026-11-05']);
  assert.deepEqual(missingNights(['2026-11-09', '2026-11-11']), [], 'Tue 10 Nov 2026 is an NSE holiday (Diwali-Balipratipada), not a gap');
  assert.deepEqual(missingNights(['2026-10-30', '2026-11-02']), [], 'a weekend is not a gap');
  assert.deepEqual(missingNights(['2026-10-23']), []); assert.deepEqual(missingNights([]), []);
  assert.deepEqual(missingNights(['2026-11-06', '2026-11-02', '2026-11-03', '2026-11-03']), ['2026-11-04', '2026-11-05'], 'order and duplicates do not matter');
  assert.deepEqual(missingNights(['2026-10-19', '2026-10-21']), [], 'Tue 20 Oct 2026 is Dussehra');
});

test('missingNightsLine: says "not recorded" in words and invents nothing', () => {
  assert.equal(missingNightsLine([]), null);
  assert.equal(missingNightsLine(['2026-11-04', '2026-11-05']), 'Wed 4 Nov and Thu 5 Nov 2026: not recorded. The record has no night for those sessions, and nothing was filled in for them.');
  assert.match(missingNightsLine(['2026-11-04'])!, /^Wed 4 Nov 2026: not recorded. The record has no night for that session, and nothing was filled in for it\.$/);
  assert.match(missingNightsLine(['2026-11-02', '2026-11-04', '2026-11-05'])!, /Mon 2 Nov, Wed 4 Nov and Thu 5 Nov 2026/);
});

test('rBars: one bar per closed trade, oldest exit first, height against the largest |R|, sign kept', () => {
  const b = rBars([{ id: 'x', label: 'X', r: 2, day: '2026-11-05' }, { id: 'y', label: 'Y', r: -1, day: '2026-11-02' }, { id: 'z', label: 'Z', r: 0, day: '2026-11-03' }]);
  assert.deepEqual(b.map((x) => x.id), ['y', 'z', 'x']); assert.deepEqual(b.map((x) => x.h), [50, 0, 100]); assert.deepEqual(b.map((x) => x.tone), ['down', 'flat', 'up']);
  assert.deepEqual(rBars([]), []);
});

test('bookView: three views, and every old address lands on one of them', () => {
  assert.deepEqual(bookView(null), { view: 'positions', anchor: null });
  assert.deepEqual(bookView('positions'), { view: 'positions', anchor: null });
  assert.deepEqual(bookView('tracker'), { view: 'positions', anchor: null }, 'the old Mine tab');
  assert.deepEqual(bookView('auto'), { view: 'positions', anchor: null }, 'the old Auto tab');
  assert.deepEqual(bookView('picks'), { view: 'picks', anchor: null });
  assert.deepEqual(bookView('record'), { view: 'record', anchor: null });
  assert.deepEqual(bookView('evidence'), { view: 'record', anchor: 'evidence' }, 'Evidence is a section inside Record');
  assert.deepEqual(bookView('nonsense'), { view: 'positions', anchor: null });
});
