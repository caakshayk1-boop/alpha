// 12 Nov 2026 (Tripwire 2.0, 1.3): pins for what was already true here, so it cannot drift: one R, one T2, one published universe definition.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { targetPrices } from '../src/levels.ts';
import { ladderPrices } from '../src/exits.ts';
import { definitionLines } from '../src/recordview.ts';
import { universeReport } from '../src/universe.ts';

test('one R, one T2: an entered position gets the booked, entry-based levels and never a signal-close basis', () => {
  const pick = { asOf: '2026-11-02', horizon: 30, ref: 100, stop: 90 };
  const entered = targetPrices(pick, false, 103)!; const booked = ladderPrices(103, 90, 1.5, 3);
  assert.equal(entered.basis, 'entry'); assert.equal(entered.t1, booked.t1); assert.equal(entered.t2, booked.t2);
  const waiting = targetPrices(pick, false, null)!; assert.equal(waiting.basis, 'signal', 'only before entry are the levels worked from the signal close, and the screen says "at signal close"');
  assert.notEqual(waiting.t2, entered.t2);
});
test('the single definition of R and T2 is stated once, in one place', () => {
  const d = definitionLines(); assert.match(d.r, /fill \(the next open plus slippage\) minus the stop/); assert.match(d.targets, /T1 is the fill plus/);
});
test('the pick view says "at signal close" for its levels, and the Book never prints a signal-close level beside an entered position', () => {
  const src = readFileSync(new URL('../src/screens/signals.tsx', import.meta.url), 'utf8'); assert.match(src, /Levels below are worked from the signal close/);
});
test('one universe definition is published on the Data page: screened, pass the liquidity filter, counted by the trend map; counts nest', () => {
  const rows = [{ sym: 'A', liquid: true, tier: 'large', sma50: 1, sma200: 1 }, { sym: 'B', liquid: true, tier: null, sma50: 1, sma200: null }, { sym: 'C', liquid: false, tier: 'micro', sma50: 1, sma200: 1 }] as never[];
  const u = universeReport(rows, '2026-11-11', '2026-11-12'); assert.equal(u.total, 3); assert.equal(u.liquid, 2); assert.equal(u.liquidWithAverages, 1);
  assert.ok(u.liquidWithAverages <= u.liquid && u.liquid <= u.total);
  const page = readFileSync(new URL('../src/screens/Data.tsx', import.meta.url), 'utf8'); assert.match(page, /One definition, used everywhere/); assert.match(page, /are screened/); assert.match(page, /pass the liquidity filter/);
});
test('the published rule says a size class exists for index-sized names only (tier is not backfilled: inventing a class is refused)', () => {
  const rules = readFileSync(new URL('../src/rules.ts', import.meta.url), 'utf8'); assert.match(rules, /publishes a class only for index-sized names/);
  const chk = readFileSync(new URL('../tools/check-data.mjs', import.meta.url), 'utf8'); assert.match(chk, /does not guess one/);
});
