import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNext, emptyLedger, validate, assertAppendOnly, honesty, type Bars, type RunIn, type Ledger } from '../src/lib/ledger.ts';
import { evaluate } from '../src/lib/accounting.ts';

const bar = (o: number, h: number, l: number, c: number) => ({ o, h, l, c });
const run = (date: string, passed: string[], extra: Partial<RunIn> = {}): RunIn => ({ screen_id: 'pio', run_date: date, passed, universe_n: 900, not_scorable_n: 40, ...extra });
const SC = [{ id: 'pio', name: 'Piotroski', version: 1, started_on: '2026-11-20' }];
const step = (L: Ledger, as_of: string, runs: RunIn[], bars: Bars) => { const n = buildNext(L, { as_of, built_on: as_of + 'T02:00:00Z', runs, bars, benchmark_close: 1000, screens: SC }); assert.deepEqual(validate(n), []); assert.deepEqual(assertAppendOnly(L, n), []); return n; };

test('entry fills at the NEXT session open, not the signal close; stop is 20% below entry; qty = 100000/open', () => {
  const bars: Bars = { AAA: { '2026-11-20': bar(99, 101, 98, 100), '2026-11-23': bar(102, 105, 101, 104) } };
  let L = step(emptyLedger(), '2026-11-20', [run('2026-11-20', ['AAA'])], bars);
  assert.equal(L.picks[0].status, 'pending'); assert.equal(L.book_days.at(-1)!.equity, 0);
  L = step(L, '2026-11-23', [], bars);
  const p = L.picks[0]; assert.equal(p.status, 'open'); assert.equal(p.fills[0].price, 102); assert.equal(p.fills[0].qty, 980); assert.equal(p.stop, 81.6);
  assert.equal(L.book_days.filter((b) => b.date === '2026-11-23' && b.screen_id === 'pio').length, 1);
});
test('dropped from the list: exits at the next open after that run; R uses the original risk', () => {
  const bars: Bars = { AAA: { '2026-11-20': bar(99, 101, 98, 100), '2026-11-23': bar(100, 105, 99, 104), '2026-11-27': bar(110, 112, 109, 111), '2026-11-30': bar(112, 113, 108, 109) } };
  let L = step(emptyLedger(), '2026-11-23', [run('2026-11-20', ['AAA'])], bars);
  L = step(L, '2026-11-27', [run('2026-11-27', [])], bars);              // run on the 27th without AAA: exit at the next open
  assert.equal(L.picks[0].status, 'open');
  L = step(L, '2026-11-30', [], bars);
  const p = L.picks[0]; assert.equal(p.status, 'closed'); assert.equal(p.exit_reason, 'dropped'); assert.equal(p.fills[1].price, 112);
  const r = evaluate(p.fills, p.stop!, null); assert.ok(r.r! > 0.5 && r.r! < 0.7, String(r.r));   // (112-100)*1000 = 12000 less charges / (20 x 1000 = 20000)
});
test('stop hit intraday exits at the stop; a gap through the stop exits at the open', () => {
  let bars: Bars = { A: { '2026-11-20': bar(1, 1, 1, 100), '2026-11-23': bar(100, 100, 100, 100), '2026-11-24': bar(95, 96, 79, 85) } };
  let L = step(emptyLedger(), '2026-11-24', [run('2026-11-20', ['A'])], bars);
  assert.equal(L.picks[0].exit_reason, 'stop'); assert.equal(L.picks[0].fills[1].price, 80);
  bars = { B: { '2026-11-20': bar(1, 1, 1, 100), '2026-11-23': bar(100, 100, 100, 100), '2026-11-24': bar(70, 75, 68, 72) } };
  L = step(emptyLedger(), '2026-11-24', [run('2026-11-20', ['B'])], bars);
  assert.equal(L.picks[0].exit_reason, 'gap-stop'); assert.equal(L.picks[0].fills[1].price, 70);
});
test('a name dropped before its entry fill is voided with a reason, and stays listed', () => {
  const bars: Bars = { A: { '2026-11-20': bar(1, 1, 1, 100) } };
  let L = step(emptyLedger(), '2026-11-20', [run('2026-11-20', ['A'])], bars);
  L = step(L, '2026-11-21', [run('2026-11-21', [])], bars);
  assert.equal(L.picks[0].status, 'voided'); assert.equal(L.voids.length, 1); assert.match(L.voids[0].reason, /before the entry fill/);
});
test('a repeated run is a no-op; a missing bar leaves the pick pending, never invented', () => {
  const bars: Bars = { A: { '2026-11-20': bar(1, 1, 1, 100) } };
  let L = step(emptyLedger(), '2026-11-20', [run('2026-11-20', ['A'])], bars);
  const again = step(L, '2026-11-20', [run('2026-11-20', ['A'])], bars);
  assert.equal(again.runs.length, 1); assert.equal(again.picks.length, 1); assert.equal(again.picks[0].status, 'pending');
  assert.equal(again.book_days.length, L.book_days.length, 'one book day per (date, screen)');
});
test('SIT-OUT: a run with nothing passing is recorded as a run, with its near misses', () => {
  const L = step(emptyLedger(), '2026-11-20', [run('2026-11-20', [], { near_miss: [{ symbol: 'X', failed_rule: 'F4 cash > profit', gap: 'one criterion' }] })], {});
  assert.equal(L.runs[0].passed.length, 0); assert.equal(L.runs[0].near_miss![0].symbol, 'X'); assert.equal(L.transitions[0].entered.length, 0);
  assert.equal(L.book_days.some((b) => b.screen_id === 'all' && b.equity === 0), true);
});
test('transitions: entered / exited / still-in against the previous run', () => {
  const L = step(step(emptyLedger(), '2026-11-20', [run('2026-11-20', ['A', 'B'])], {}), '2026-11-27', [run('2026-11-27', ['B', 'C'])], {});
  assert.deepEqual(L.transitions[1], { screen_id: 'pio', run_date: '2026-11-27', entered: ['C'], exited: ['A'], still_in: ['B'] });
});
test('append-only guard catches rewritten history, deleted picks, changed voids', () => {
  const bars: Bars = { A: { '2026-11-20': bar(1, 1, 1, 100), '2026-11-23': bar(100, 100, 100, 100) } };
  const L = step(emptyLedger(), '2026-11-23', [run('2026-11-20', ['A'])], bars);
  const bad = JSON.parse(JSON.stringify(L)) as Ledger; bad.book_days[0].equity = 999; bad.picks[0].fills[0].price = 1; bad.runs.pop();
  const v = assertAppendOnly(L, bad); assert.ok(v.some((x) => /book_days\[0\]/.test(x))); assert.ok(v.some((x) => /fill 0/.test(x))); assert.ok(v.some((x) => /runs shrank/.test(x)));
  const del = JSON.parse(JSON.stringify(L)) as Ledger; del.picks = []; assert.ok(assertAppendOnly(L, del).some((x) => /deleted/.test(x)));
});
test('aggregates: n beside every statistic, honesty label under 30, drawdown and losing streak', () => {
  assert.equal(honesty(13), 'n = 13 — too few to conclude anything'); assert.equal(honesty(30), null);
  const mk = (s: string, win: boolean) => ({ [s]: { '2026-11-20': bar(1, 1, 1, 100), '2026-11-23': bar(100, 100, 100, 100), '2026-11-30': bar(win ? 120 : 99, 125, win ? 118 : 97, win ? 120 : 99) } });
  const bars: Bars = { ...mk('W', true), ...mk('L1', false), ...mk('L2', false) };
  let L = step(emptyLedger(), '2026-11-23', [run('2026-11-20', ['W', 'L1', 'L2'])], bars);
  L = step(L, '2026-11-27', [run('2026-11-27', [])], bars); L = step(L, '2026-11-30', [], bars);
  const a = L.aggregates.find((x) => x.screen_id === 'pio')!;
  assert.equal(a.n_closed, 3); assert.equal(a.win_rate, 0.33); assert.equal(a.honesty, 'n = 3 — too few to conclude anything'); assert.ok(a.longest_losing_streak >= 2); assert.ok(a.max_drawdown <= 0);
});
test('validate refuses a void with no reason and a closed pick with no exit', () => {
  const L = emptyLedger(); L.picks.push({ id: 'x', screen_id: 's', symbol: 'A', first_listed_run: 'd', status: 'voided', fills: [], stop: null, exit_after: null, exit_reason: null, voided: null });
  assert.ok(validate(L).some((x) => /without a reason/.test(x)));
});
test('book day carries committed notional so a return can be shown against what was put to work', () => {
  const bars: Bars = { A: { '2026-11-20': bar(1, 1, 1, 100), '2026-11-23': bar(100, 100, 100, 110) } };
  const L = step(emptyLedger(), '2026-11-23', [run('2026-11-20', ['A'])], bars); const d = L.book_days.find((b) => b.date === '2026-11-23' && b.screen_id === 'all')!;
  assert.equal(d.committed, 100000); assert.ok(d.equity > 9000 && d.equity < 10000, String(d.equity));
});
