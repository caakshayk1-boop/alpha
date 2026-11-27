// 27 Nov 2026: a night that finds several unrecorded sessions records each, in order, exactly as on-time nights would have.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNext, buildCatchUp, sessionsToRecord, emptyLedger, validate, assertAppendOnly, type Bars, type RunIn, type Ledger } from '../src/lib/ledger.ts';
import { isSession } from '../src/lib/calendar.ts';

const bar = (o: number, h: number, l: number, c: number) => ({ o, h, l, c });
const run = (date: string, passed: string[]): RunIn => ({ screen_id: 'pio', run_date: date, passed, universe_n: 900, not_scorable_n: 40 });
const SC = [{ id: 'pio', name: 'Piotroski', version: 1, started_on: '2026-11-20' }];
// 20 Nov signal, entry at the 23 Nov open; 24 Nov is an NSE holiday; 25 and 26 Nov trade. On the 26th AAA's low goes through its stop.
const BARS: Bars = { AAA: { '2026-11-20': bar(99, 101, 98, 100), '2026-11-23': bar(102, 105, 101, 104), '2026-11-25': bar(104, 108, 103, 107), '2026-11-26': bar(106, 107, 60, 70) } };
const BENCH: Record<string, number> = { '2026-11-20': 1000, '2026-11-23': 1010, '2026-11-25': 1020, '2026-11-26': 1030 };
const BUILT = '2026-11-27T00:00:00Z';
const night = (L: Ledger, d: string, runs: RunIn[] = []) => buildNext(L, { as_of: d, built_on: BUILT, runs, bars: BARS, benchmark_close: BENCH[d], screens: SC });
const upTo23 = () => night(night(emptyLedger('next-open', 100000), '2026-11-20', [run('2026-11-20', ['AAA'])]), '2026-11-23');
const catchUp = (prev: Ledger, asOf: string, runs: RunIn[] = []) => buildCatchUp(prev, { as_of: asOf, built_on: BUILT, runs, bars: BARS, benchmark: BENCH, screens: SC }, isSession);

test('the sessions to record skip holidays, weekends and a first ledger, and always end on the benchmark day', () => {
  assert.deepEqual(sessionsToRecord('2026-11-23', '2026-11-26', BENCH, isSession), ['2026-11-25', '2026-11-26']);
  assert.deepEqual(sessionsToRecord('2026-11-23', '2026-11-26', { ...BENCH, '2026-11-24': 1, '2026-11-28': 1 }, isSession), ['2026-11-25', '2026-11-26'], 'a holiday and a Saturday are not sessions even if a benchmark value appears');
  assert.deepEqual(sessionsToRecord(null, '2026-11-26', BENCH, isSession), ['2026-11-26'], 'a first ledger records one day, never a year of history');
  assert.deepEqual(sessionsToRecord('2026-11-26', '2026-11-26', BENCH, isSession), ['2026-11-26'], 'a same-day rerun');
  assert.deepEqual(sessionsToRecord('2026-11-26', '2026-11-25', BENCH, isSession), ['2026-11-25'], 'an older benchmark day is left to the existing "older than the ledger" refusal');
  assert.deepEqual(sessionsToRecord('2026-11-25', '2026-11-26', BENCH, isSession), ['2026-11-26'], 'an ordinary night records one session');
});

test('catching up two sessions gives exactly what two on-time nights would have', () => {
  const prev = upTo23();
  const onTime = night(night(prev, '2026-11-25'), '2026-11-26');
  const steps = catchUp(prev, '2026-11-26');
  assert.deepEqual(steps.map((s) => s.date), ['2026-11-25', '2026-11-26']);
  assert.equal(JSON.stringify(steps.at(-1)!.ledger), JSON.stringify(onTime));
});

test('each recorded day is valued as of that day: the 26th stop-out does not reach back into the 25th', () => {
  const steps = catchUp(upTo23(), '2026-11-26');
  const d25 = steps[0].ledger, d26 = steps[1].ledger;
  assert.equal(d25.picks[0].status, 'open', 'still open on the 25th');
  assert.equal(d26.picks[0].status, 'closed', 'stopped out on the 26th');
  const eq = (L: Ledger, d: string) => L.book_days.find((b) => b.date === d && b.screen_id === 'all')!;
  assert.equal(eq(d25, '2026-11-25').benchmark_close, 1020); assert.equal(eq(d26, '2026-11-26').benchmark_close, 1030, 'each day carries its own benchmark close');
  assert.ok(eq(d25, '2026-11-25').unrealised > 0, 'the 25th closed above entry');
  assert.ok(eq(d26, '2026-11-26').realised < 0, 'the 26th booked the stop');
});

test('every step is valid and append-only, and history is untouched', () => {
  const prev = upTo23(); let before = prev;
  for (const s of catchUp(prev, '2026-11-26')) { assert.deepEqual(validate(s.ledger), []); assert.deepEqual(assertAppendOnly(before, s.ledger), []); before = s.ledger; }
  assert.deepEqual(before.book_days.filter((b) => b.screen_id === 'all').map((b) => b.date), ['2026-11-20', '2026-11-23', '2026-11-25', '2026-11-26']);
});

test('a weekly run is applied at its own date; a run dated after the last day still applies on the last', () => {
  const prev = upTo23();
  const steps = catchUp(prev, '2026-11-26', [run('2026-11-25', ['AAA']), run('2026-11-27', ['AAA'])]);
  const at = (i: number) => steps[i].ledger.runs.map((r) => r.run_date);
  assert.deepEqual(at(0), ['2026-11-20', '2026-11-25'], 'the 25 Nov run is in by the 25 Nov step, the 27 Nov run is not yet');
  assert.deepEqual(at(1), ['2026-11-20', '2026-11-25', '2026-11-27'], 'a later-dated run still lands on the last step, as it did before');
});

test('running the same night twice records nothing new', () => {
  const once = catchUp(upTo23(), '2026-11-26').at(-1)!.ledger;
  const again = catchUp(once, '2026-11-26');
  assert.equal(again.length, 1);
  assert.equal(again[0].ledger.book_days.length, once.book_days.length);
  assert.deepEqual(assertAppendOnly(once, again[0].ledger), []);
});
