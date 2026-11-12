// 12 Nov 2026 (Tripwire 2.0, 2.2 and 2.3): bar status, quote is not a fill, and the dates that session boundaries decide. Acceptance §5.7 and the session half of §5.8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barStatus, completedBars, barsCaption, provisionalOf } from '../src/ledgerview.ts';
import { evaluatePaper, DEFAULT_COST, type Bar, type Paper, type View } from '../src/tracker.ts';
import { markOpen } from '../src/positionstate.ts';

const ist = (iso: string, h: number, m = 0) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), h, m) - 330 * 60000;
const T = (d: string) => Date.parse(`${d}T03:45:00Z`) / 1000;   // 09:15 IST of that day
const bar = (d: string, o: number, h: number, l: number, c: number, forming = false): Bar => ({ t: T(d), o, h, l, c, ...(forming ? { forming: true } : {}) });

test('§5.7 bar status: confirmed, forming, stale, missing, at the IST session boundary', () => {
  const wed = bar('2026-11-11', 100, 101, 99, 100);
  assert.equal(barStatus(wed, ist('2026-11-11', 15, 59)), 'forming', 'at 15:59 IST the session is still on');
  assert.equal(barStatus(wed, ist('2026-11-11', 16, 0)), 'confirmed', 'from 16:00 IST it is closed');
  assert.equal(barStatus({ ...wed, forming: true }, ist('2026-11-12', 8)), 'forming', 'the provider says forming: it is forming');
  assert.equal(barStatus(wed, ist('2026-11-12', 8)), 'confirmed', 'the next morning it is the last finished session');
  assert.equal(barStatus(wed, ist('2026-11-13', 17)), 'stale', 'a later session has finished and has no bar here');
  assert.equal(barStatus(null, ist('2026-11-12', 8)), 'missing'); assert.equal(barStatus({ t: NaN }, ist('2026-11-12', 8)), 'missing');
});
test('§5.8 holidays, weekends and a delayed provider: no bar is "stale" for a session that never happened', () => {
  const mon = bar('2026-11-09', 100, 101, 99, 100);
  assert.equal(barStatus(mon, ist('2026-11-10', 20)), 'confirmed', 'Tue 10 Nov is Diwali: NSE is shut, Monday is the last session');
  assert.equal(barStatus(mon, ist('2026-11-10', 11)), 'confirmed');
  const fri = bar('2026-11-13', 100, 101, 99, 100); assert.equal(barStatus(fri, ist('2026-11-15', 12)), 'confirmed', 'a Sunday: Friday is the last session');
  assert.equal(barStatus(mon, ist('2026-11-12', 8)), 'stale', 'Wed 11 Nov finished and the provider has not delivered it: stale, said so');
});
test('§5.7 a completed-close view leaves a forming bar out, and the caption says what is provisional and when it was observed', () => {
  const now = ist('2026-11-12', 11, 5); const bars = [bar('2026-11-11', 100, 101, 99, 100), bar('2026-11-12', 100, 103, 99, 102, true)];
  assert.deepEqual(completedBars(bars, now).map((b) => b.t), [bars[0].t]);
  const c = barsCaption(bars, now); assert.equal(c.through, '2026-11-11'); assert.match(c.provisional!, /2026-11-12 is still forming, observed 11:05 IST/); assert.equal(c.status, 'forming');
  assert.equal(barsCaption(bars.slice(0, 1), ist('2026-11-12', 8)).provisional, null); assert.equal(barsCaption([], now).status, 'missing');
});

const paper = (o: Partial<Paper> = {}): Paper => ({ id: 'p', sym: 'X', engine: 'QLT', asOf: '2026-11-02', ref: 100, stop: 90, horizon: 3, qty: 100, takenAt: Date.parse('2026-11-02T10:00:00Z') / 1000, ...o });
test('§5.7 a live quote never becomes a fill, a stop or a time exit', () => {
  // no bar after the signal day: a quote of 105 cannot fill the entry
  assert.equal(evaluatePaper(paper(), [bar('2026-11-02', 99, 101, 98, 100)], { px: 105, t: T('2026-11-03') + 100 }, DEFAULT_COST).status, 'pending');
  // an open position and a quote below the stop: still open, not stopped
  const bars = [bar('2026-11-02', 99, 101, 98, 100), bar('2026-11-03', 100, 101, 99, 100.5)];
  const v = evaluatePaper(paper(), bars, { px: 85, t: T('2026-11-03') + 600 }, DEFAULT_COST); assert.equal(v.status, 'open'); assert.equal(v.markKind, 'live');
  // the horizon is reached on a forming last bar: no time exit until it is complete
  const hz = [bar('2026-11-02', 99, 101, 98, 100), bar('2026-11-03', 100, 101, 99, 100), bar('2026-11-04', 100, 101, 99, 100), bar('2026-11-05', 100, 101, 99, 100, true)];
  assert.equal(evaluatePaper(paper({ horizon: 3 }), hz, null, DEFAULT_COST).status, 'open', 'the forming bar is the 3rd session: no time exit yet');
  assert.equal(evaluatePaper(paper({ horizon: 3 }), hz.map((b) => ({ ...b, forming: false })), null, DEFAULT_COST).status, 'closed', 'the same bar, complete, does exit');
});
test('§5.2 a quote above T1 is a mark, not a fill: it changes price and P&L only, never the status, the ladder, the shares or the stop', () => {
  const p = paper({ horizon: 30, targets: { t1R: 1, t2R: 2 } });
  const bars = [bar('2026-11-02', 99, 101, 98, 100), bar('2026-11-03', 100, 101, 99, 100.5), bar('2026-11-04', 100.5, 101.5, 100, 101)];
  const v = evaluatePaper(p, bars, null, DEFAULT_COST); assert.equal(v.status, 'open'); assert.equal(v.ladder?.t1Hit, false);
  const q = markOpen(v, p, { px: v.ladder!.t1 + 3, t: T('2026-11-04') + 3000 }, DEFAULT_COST);
  assert.equal(q.status, 'open'); assert.equal(q.ladder?.t1Hit, false, 'T1 is not booked by a quote'); assert.equal(q.ladder?.qtyLeft, v.ladder?.qtyLeft); assert.equal(q.ladder?.stop, v.ladder?.stop, 'the stop is not raised by a quote');
  assert.equal(q.ladder?.booked, v.ladder?.booked); assert.ok(q.mark! > v.mark!, 'only the mark moved'); assert.equal(q.markKind, 'live');
});
test('a result that came from a bar still forming is labelled provisional; a confirmed one is not', () => {
  const p = paper({ horizon: 30, targets: { t1R: 1, t2R: 2 } });
  const bars = [bar('2026-11-02', 99, 101, 98, 100), bar('2026-11-03', 100, 101, 99, 100.5), bar('2026-11-04', 100.5, 140, 100, 112, true)];
  const v: View = evaluatePaper(p, bars, null, DEFAULT_COST); assert.equal(v.ladder?.t1Hit, true);
  assert.match(provisionalOf(v, bars)!, /target fill on a bar still forming \(2026-11-04\): provisional/);
  assert.equal(provisionalOf(v, bars.map((b) => ({ ...b, forming: false }))), null);
  const stopped = evaluatePaper(paper({ horizon: 30 }), [bar('2026-11-02', 99, 101, 98, 100), bar('2026-11-03', 100, 101, 80, 85, true)], null, DEFAULT_COST);
  assert.equal(stopped.status, 'closed'); assert.match(provisionalOf(stopped, [bar('2026-11-02', 99, 101, 98, 100), bar('2026-11-03', 100, 101, 80, 85, true)])!, /Exit on a bar still forming/);
});
