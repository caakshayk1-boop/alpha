// Financial regression for the paper accounting: fills, gaps, slippage, costs, stops, holidays, splits, duplicate runs and reproducibility.
// Every expected number is worked out by hand in the comment beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePaper, pnlAt, rebase, SLIPPAGE_PCT, type Bar, type Paper } from '../src/tracker.ts';
import { applyCorrections, emptyLedger, evaluateLedger, record, takenAtFor, type Ledger } from '../src/ledger.ts';
import { planAutoBook } from '../src/autobook.ts';

const IST_OPEN = 9 * 3600 + 15 * 60;                                         // a daily bar is stamped 09:15 India time on its date
const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 1000 - 19800 + IST_OPEN;
const bar = (iso: string, o: number, h: number, l: number, c: number, forming = false): Bar => ({ t: day(iso), o, h, l, c, forming });
const paper = (o: Partial<Paper> = {}): Paper => ({ id: 'p', sym: 'X', engine: 'MOM', asOf: '2026-10-23', ref: 100, stop: 95, horizon: 3, qty: 10, takenAt: takenAtFor('2026-10-23'), ...o });
const COST = 0.25;                                                            // % round trip
const sig = bar('2026-10-23', 99, 101, 98, 100);                              // the signal day, closing at the signal price
const money = (v: number) => Math.round(v * 100) / 100;

test('fill: a pick written at the close fills at the NEXT open plus slippage, never at the signal close or the signal-day bar', () => {
  const v = evaluatePaper(paper(), [sig, bar('2026-10-26', 101, 103, 100, 102)], null, COST);
  assert.equal(v.status, 'open'); assert.equal(v.entry, 101.1);               // 101 x 1.001
  assert.equal(v.entryT, day('2026-10-26'));
  assert.equal(v.signal, 100); assert.equal(v.mark, 102); assert.equal(v.markKind, 'close');   // signal 100, fill 101.1, latest 102: three prices, three fields
});
test('P&L basis: (latest - fill) x qty, minus 0.25% of entry value, minus 0.1% of exit value', () => {
  const v = evaluatePaper(paper(), [sig, bar('2026-10-26', 101, 103, 100, 102)], null, COST);
  // gross (102 - 101.1) x 10 = 9.00 ; costs 0.0025 x 101.1 x 10 = 2.5275 ; exit slippage 0.001 x 102 x 10 = 1.02 ; net 5.4525
  assert.equal(v.pnl, 5.45); assert.equal(v.pct, 0.54); assert.equal(v.r, money(5.4525 / ((101.1 - 95) * 10)));
  assert.equal(pnlAt({ qty: 10, stop: 95 }, 101.1, 102, COST).pnl, v.pnl, 'the what-if slider and the headline use one formula');
  assert.equal(SLIPPAGE_PCT, 0.1);
});
test('gaps: an open more than 2% above the signal close is skipped, and so is an open at or below the stop', () => {
  assert.match(evaluatePaper(paper(), [sig, bar('2026-10-26', 102.5, 104, 102, 103)], null, COST).skipReason ?? '', /2\.5% above the signal close/);
  assert.equal(evaluatePaper(paper(), [sig, bar('2026-10-26', 102, 104, 101, 103)], null, COST).status, 'open', 'exactly 2% is allowed');
  assert.equal(evaluatePaper(paper(), [sig, bar('2026-10-26', 94, 99, 93, 97)], null, COST).skipReason, 'Opened at or below the stop');
});
test('stops: a bar that trades through the stop exits at the stop; a later gap through it exits at the open, which is worse', () => {
  const a = evaluatePaper(paper(), [sig, bar('2026-10-26', 101, 102, 100, 101), bar('2026-10-27', 100, 100.5, 94, 96)], null, COST);
  assert.equal(a.status, 'closed'); assert.equal(a.exit, 95); assert.equal(a.reason, 'Stop'); assert.ok(!a.stopGap);
  const g = evaluatePaper(paper(), [sig, bar('2026-10-26', 101, 102, 100, 101), bar('2026-10-27', 92, 93, 90, 91)], null, COST);
  assert.equal(g.exit, 92); assert.equal(g.stopGap, true); assert.match(g.reason ?? '', /gapped through/);
  assert.ok(g.pnl! < a.pnl!, 'a gap costs more than an orderly stop');
  const same = evaluatePaper(paper(), [sig, bar('2026-10-26', 101, 105, 94, 100)], null, COST);   // one bar spans the stop on the entry day
  assert.equal(same.exit, 95, 'when a bar spans the stop it is the stop that counts');
});
test('time exit: at the close of the Nth session; a forming bar can stop a trade out but never time it out', () => {
  const bars = [sig, bar('2026-10-26', 101, 102, 100, 101), bar('2026-10-27', 101, 103, 100, 102), bar('2026-10-28', 102, 104, 101, 103)];
  const v = evaluatePaper(paper(), bars, null, COST); assert.equal(v.status, 'closed'); assert.equal(v.exit, 103); assert.equal(v.sessions, 3); assert.match(v.reason ?? '', /Time exit after 3 sessions/);
  const forming = evaluatePaper(paper(), [...bars.slice(0, 3), { ...bars[3], forming: true }], null, COST); assert.equal(forming.status, 'open');
  assert.equal(evaluatePaper(paper(), [...bars.slice(0, 3), { ...bars[3], l: 94, forming: true }], null, COST).status, 'closed', 'a forming low through the stop is a stop');
});
test('holidays: sessions are the bars that exist, so a market holiday is never counted as a session', () => {
  // Mon 26 Oct is a holiday here: there is no bar. Entry is Tue 27, session 2 is Wed 28, session 3 is Thu 29.
  const bars = [sig, bar('2026-10-27', 101, 102, 100, 101), bar('2026-10-28', 101, 102, 100, 102), bar('2026-10-29', 102, 104, 101, 103)];
  const v = evaluatePaper(paper(), bars, null, COST); assert.equal(v.sessions, 3); assert.equal(v.exitT, day('2026-10-29')); assert.equal(v.entryT, day('2026-10-27'));
});
test('corporate actions: a 1-for-2 split re-quotes the history, and the paper trade is rebased instead of being stopped out', () => {
  const half = [bar('2026-10-23', 49.5, 50.5, 49, 50), bar('2026-10-26', 50.5, 51.5, 50, 51), bar('2026-10-27', 51, 52, 50.5, 51.5)];   // the same history, quoted after the split
  const unadj = evaluatePaper(paper({ horizon: 9 }), [sig, bar('2026-10-26', 101, 103, 100, 102), bar('2026-10-27', 102, 103, 101, 103)], null, COST);
  const v = evaluatePaper(paper({ horizon: 9 }), half, null, COST);
  assert.equal(v.status, 'open', 'without the rebase the 50.5 open sits below the 95 stop and the trade is skipped'); assert.equal(v.adjFactor, 0.5); assert.equal(v.basis, 'verified');
  assert.equal(v.signal, 50); assert.equal(v.entry, 50.55);                                    // 50.5 x 1.001
  assert.equal(v.pnl, unadj.pnl, 'value, risk and P&L are what they would have been with no split');
  const r = rebase(paper(), half); assert.equal(r.p.qty, 20); assert.equal(r.p.stop, 47.5);
  const bonus = rebase(paper(), [bar('2026-10-23', 49, 51, 48, 50)]); assert.equal(bonus.factor, 0.5);
  const cons = rebase(paper(), [bar('2026-10-23', 495, 505, 490, 500)]); assert.equal(cons.factor, 5); assert.equal(cons.p.qty, 2);     // a reverse split
});
test('corporate actions: rounding noise is not a split, and a missing signal-day bar is said to be unverified', () => {
  assert.equal(rebase(paper(), [bar('2026-10-23', 99, 101, 98, 100.4)]).factor, 1);
  const none = evaluatePaper(paper(), [bar('2026-10-26', 101, 103, 100, 102)], null, COST); assert.equal(none.basis, 'unverified'); assert.equal(none.adjFactor, 1);
});
test('dividends: bars are not dividend-adjusted, so an ex-dividend drop is a real price move and the payout is ignored', () => {
  const v = evaluatePaper(paper({ horizon: 9 }), [sig, bar('2026-10-26', 101, 102, 100, 101), bar('2026-10-27', 98, 99, 97.5, 98)], null, COST);
  assert.ok(v.pnl! < 0); assert.equal(v.mark, 98);
});
test('no bars is waiting, not flat; bars that all pre-date the order are pending', () => {
  assert.equal(evaluatePaper(paper(), null, null, COST).status, 'waiting'); assert.equal(evaluatePaper(paper(), [], null, COST).pnl, null);
  assert.equal(evaluatePaper(paper({ takenAt: day('2026-10-30') }), [sig], null, COST).status, 'pending');
});
test('reproducibility: the same inputs always give the same result, and nothing is mutated', () => {
  const bars = [sig, bar('2026-10-26', 101, 102, 100, 101), bar('2026-10-27', 101, 103, 100, 102)]; const copy = JSON.stringify(bars); const p = paper(); const pc = JSON.stringify(p);
  assert.deepEqual(evaluatePaper(p, bars, null, COST), evaluatePaper(p, bars, null, COST)); assert.equal(JSON.stringify(bars), copy); assert.equal(JSON.stringify(p), pc);
});

/* ---- the nightly ledger and the automatic book ---- */
const run = (picks: { sym: string; score: number }[]) => ({ id: 'MOM' as const, picks: picks.map((x, i) => ({ engine: 'MOM' as const, sym: x.sym, name: x.sym, asOf: '', ref: 100, stop: 95, stopPct: 5, horizon: 3, score: x.score, rank: i + 1, why: [] })), funnel: { universe: 0, eligible: 0, passed: 0, skippedWideStop: 0, picked: picks.length } });
test('duplicate runs: a night is recorded once, an older data day is refused, and re-running changes nothing', () => {
  const l0 = emptyLedger('2026-10-25T00:00:00Z'); const a = record(l0, [run([{ sym: 'A', score: 90 }])], '2026-10-23', 'n1');
  assert.equal(a.added, 1); const b = record(a.ledger, [run([{ sym: 'A', score: 90 }, { sym: 'B', score: 80 }])], '2026-10-23', 'n2');
  assert.equal(b.skipped, 'already recorded'); assert.equal(b.ledger.picks.length, 1, 'picks are never edited or added to by a second run');
  assert.equal(record(a.ledger, [run([{ sym: 'C', score: 70 }])], '2026-10-22', 'n3').skipped, 'stale data');
  const c = record(a.ledger, [run([{ sym: 'C', score: 70 }])], '2026-10-26', 'n4'); assert.equal(c.ledger.picks.length, 2);
});
test('reproducibility: outcomes replayed twice, or from picks listed in a different order, are identical', () => {
  let l: Ledger = emptyLedger('2026-10-25T00:00:00Z');
  l = record(l, [run([{ sym: 'A', score: 90 }, { sym: 'B', score: 80 }, { sym: 'C', score: 70 }])], '2026-10-23', 'n').ledger;
  const bars = { A: [sig, bar('2026-10-26', 101, 102, 100, 101), bar('2026-10-27', 101, 103, 100, 102), bar('2026-10-28', 102, 104, 101, 103)], B: [sig, bar('2026-10-26', 101, 102, 94, 96)], C: null };
  const once = evaluateLedger(l, bars, null, 'now'); const twice = evaluateLedger(once, bars, null, 'now');
  assert.deepEqual(once.outcomes, twice.outcomes); assert.equal(once.outcomes['2026-10-23|MOM|C'].status, 'pending', 'no bars: pending, never flat');
  const shuffled = { ...l, picks: [...l.picks].reverse() }; assert.deepEqual(evaluateLedger(shuffled, bars, null, 'now').outcomes, once.outcomes);
  assert.deepEqual(planAutoBook(once).taken.map((t) => t.pick.sym), planAutoBook({ ...once, picks: [...once.picks].reverse() }).taken.map((t) => t.pick.sym));
});
test('voiding: a corrected night leaves the pick in the record, with the reason, and out of every total and out of the book', () => {
  let l: Ledger = record(emptyLedger('x'), [run([{ sym: 'A', score: 90 }])], '2026-10-23', 'n').ledger;
  l = applyCorrections(l, [{ engine: 'MOM', asOf: '2026-10-23', reason: 'rule bug' }]); assert.equal(l.picks.length, 1); assert.equal(l.voided?.['2026-10-23|MOM|A'], 'rule bug');
  assert.equal(planAutoBook(l).taken.length, 0); assert.match(planAutoBook(l).refused[0].why, /Voided in the record: rule bug/);
  assert.equal(applyCorrections(l, [{ engine: 'MOM', asOf: '2026-10-23', reason: 'again' }]), l, 'applying the same correction twice changes nothing');
});
