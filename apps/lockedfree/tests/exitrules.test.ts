import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNext, emptyLedger, validate, type Bars, type RunIn, type Ledger } from '../src/lib/ledger.ts';
import { RULES, timeLimit, ruleText } from '../src/lib/exitrules.ts';

const bar = (o: number, h: number, l: number, c: number) => ({ o, h, l, c });
const go = (screen: string, bars: Bars, asOf: string, runs: RunIn[] = []) => {
  const run: RunIn = { screen_id: screen, run_date: '2026-11-17', passed: ['A'], universe_n: 900, not_scorable_n: 0 };
  let L: Ledger = emptyLedger('signal-close', 100000);
  L = buildNext(L, { as_of: '2026-11-17', built_on: 'x', runs: [run], bars, benchmark_close: null, screens: [{ id: screen, name: screen, version: 2, started_on: '2026-11-17' }] });
  L = buildNext(L, { as_of: asOf, built_on: 'x', runs, bars, benchmark_close: null }); assert.deepEqual(validate(L), []); return L.picks[0];
};
const flat = (d: string) => bar(100, 101, 99, 100);

test('each engine has its own rule and every rule caps the hold at one month', () => {
  assert.equal(new Set(Object.values(RULES).map((r) => `${r.stop_pct}/${r.target_pct}/${r.trailing}/${r.exit_on_drop}`)).size, 4);
  for (const r of Object.values(RULES)) assert.equal(r.max_months, 1);
  assert.match(ruleText('quality-momentum'), /trailing stop/); assert.match(ruleText('magic-formula'), /held even if the screen drops it/);
});
test('time limit: same day next month, then back to a trading session; year-end and short months', () => {
  assert.equal(timeLimit('2026-11-17'), '2026-12-17'); assert.equal(timeLimit('2026-01-31'), '2026-02-27');     // 28 Feb 2026 is a Saturday
  assert.equal(timeLimit('2026-12-10'), '2027-01-08'); // 10 Jan 2027 is a Sunday -> Friday 8 Jan
});
test('target: a session whose high reaches +20% exits at the target; a gap above it exits at the open', () => {
  let p = go('piotroski', { A: { '2026-11-17': flat(''), '2026-11-18': bar(101, 121, 100, 119) } }, '2026-11-18'); assert.equal(p.status, 'closed'); assert.equal(p.exit_reason, 'target'); assert.equal(p.fills[1].price, 120);
  p = go('piotroski', { A: { '2026-11-17': flat(''), '2026-11-18': bar(125, 126, 124, 125) } }, '2026-11-18'); assert.equal(p.exit_reason, 'gap-target'); assert.equal(p.fills[1].price, 125);
});
test('stop and target in the same session: the stop is assumed first', () => {
  const p = go('piotroski', { A: { '2026-11-17': flat(''), '2026-11-18': bar(100, 125, 79, 100) } }, '2026-11-18'); assert.equal(p.exit_reason, 'stop'); assert.equal(p.fills[1].price, 80);
});
test('each engine uses its own stop and target', () => {
  assert.equal(go('magic-formula', { A: { '2026-11-17': flat('') } }, '2026-11-17').stop, 85); assert.equal(go('conservative-quality', { A: { '2026-11-17': flat('') } }, '2026-11-17').stop, 82);
  assert.equal(go('magic-formula', { A: { '2026-11-17': flat(''), '2026-11-18': bar(100, 116, 99, 110) } }, '2026-11-18').fills[1].price, 115);
});
test('trailing stop: follows the highest close, never loosens, exits when the low reaches it', () => {
  const bars: Bars = { A: { '2026-11-17': flat(''), '2026-11-18': bar(100, 110, 100, 110), '2026-11-19': bar(110, 125, 108, 125), '2026-11-20': bar(120, 121, 93, 95) } };
  const p = go('quality-momentum', bars, '2026-11-20');        // peak close 125 -> trail 93.75; low 93 reaches it
  assert.equal(p.exit_reason, 'stop'); assert.equal(p.fills[1].price, 93.75); assert.equal(p.stop, 75);       // R stays measured to the ORIGINAL 25% stop
});
test('time exit: a call that goes nowhere leaves at the close of the month limit, not later', () => {
  const bars: Bars = { A: { '2026-11-17': flat(''), '2026-12-16': flat(''), '2026-12-17': bar(100, 102, 99, 101), '2026-12-18': flat('') } };
  const p = go('piotroski', bars, '2026-12-18'); assert.equal(p.exit_reason, 'time'); assert.equal(p.fills[1].date, '2026-12-17'); assert.equal(p.fills[1].price, 101);
});
test('Magic Formula is held when the screen drops it; the others leave', () => {
  const drop: RunIn = { screen_id: '', run_date: '2026-11-18', passed: [], universe_n: 900, not_scorable_n: 0 };
  const bars: Bars = { A: { '2026-11-17': flat(''), '2026-11-18': flat(''), '2026-11-19': flat('') } };
  assert.equal(go('magic-formula', bars, '2026-11-19', [{ ...drop, screen_id: 'magic-formula' }]).status, 'open');
  assert.equal(go('piotroski', bars, '2026-11-19', [{ ...drop, screen_id: 'piotroski' }]).exit_reason, 'dropped');
});
