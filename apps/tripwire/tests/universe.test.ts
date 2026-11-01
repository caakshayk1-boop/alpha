import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { universeReport } from '../src/universe.ts';
import { eligible, type Q } from '../src/quant.ts';

const r = (o: Partial<Q>): Q => ({ sym: 'X' + Math.random(), name: 'X', liquid: true, price: 100, atr_pct: 2, tier: 'mid', sma50: 90, sma200: 80, has_stmts: true, turnover_cr: 30, sector: 'Industrials', ...o }) as Q;

test('universe: every name is in exactly one size class, and the engine waterfall ends at the number the engines use', () => {
  const rows = [r({ tier: 'large' }), r({ tier: 'mid' }), r({ tier: 'small' }), r({ tier: 'micro' }), r({ tier: undefined }), r({ liquid: false }), r({ price: null }), r({ atr_pct: null }), r({ sma200: null })];
  const u = universeReport(rows, '2026-10-23', '2026-10-25');
  assert.equal(u.tiers.large + u.tiers.mid + u.tiers.small + u.tiers.micro + u.tiers.unknown, u.total);
  assert.equal(u.engineEligible, rows.filter((x) => eligible(x as Q, u.rules)).length);
  assert.equal(u.waterfall[u.waterfall.length - 1].left, u.engineEligible);
  assert.equal(u.waterfall.reduce((a, w) => a + w.removed, 0), u.total - u.engineEligible, 'every exclusion is counted once, in the step that removed it');
  assert.equal(u.indexSized, 7); assert.equal(u.withAverages, 8); assert.equal(u.liquidWithAverages, 7);
});
test('universe: each published discrepancy is reported with the count of names the old rule admitted and the new one removes, and says where it was resolved', () => {
  const rows = [r({ tier: undefined, price: 40, turnover_cr: 3 }), r({ liquid: false, turnover_cr: 120 }), r({ tier: 'mid', price: 100, turnover_cr: 50 })];
  const u = universeReport(rows, '2026-10-27', null); const by = Object.fromEntries(u.conflicts.map((c) => [c.id, c]));
  assert.equal(by.D1.count, 1); assert.equal(by.D2.count, 1); assert.equal(by.D3.count, 1);
  assert.match(by.D2.actual, /median or a mean/); assert.match(by.D1.decision, /Resolved in elig-2 from 2026-10-27/);
  assert.equal(u.engineEligible, 1, 'under elig-2 only the mid cap with a published class, ₹100 and ₹50 crore a day is eligible'); assert.equal(u.engineEligibleElig1, 2);
  assert.equal(universeReport(rows, '2026-10-23', null).rules, 'elig-1', 'a screen of the day before the cut-over is read under the old rule');
});
const real = new URL('../dist/data/screen.json', import.meta.url);
test('universe on the built screen (runs after a build; skipped before one)', { skip: !existsSync(real) }, () => {
  const s = JSON.parse(readFileSync(real, 'utf8')); const u = universeReport(s.rows, s.as_of, s.built_on);
  assert.equal(u.total, s.count); assert.equal(u.engineEligible, s.rows.filter((x: Q) => eligible(x, u.rules)).length);
  assert.equal(u.tiers.large + u.tiers.mid + u.tiers.small + u.tiers.micro + u.tiers.unknown, u.total);
});

import { aggregateBreadth } from '../worker.js';
test('2.2 the trend map gap: every row has one reason, the lines add up, and the count is exactly the Worker\'s own n', () => {
  const base = { liquid: true, price: 100, sma20: 99, sma50: 95, sma200: 90, r3m: 5, sector: 'Industrials' };
  const rows: any[] = [...Array.from({ length: 12 }, (_, i) => ({ sym: 'A' + i, ...base })), { sym: 'NL', ...base, liquid: false }, { sym: 'N200', ...base, sma200: null }, { sym: 'N50', ...base, sma50: null }, { sym: 'N3M', ...base, r3m: null },
    { sym: 'BANK', ...base, sector: 'Financial Services' }, { sym: 'NOSEC', ...base, sector: null }];
  const g = universeReport(rows as any, '2026-10-30', '2026-11-01').breadthGap;
  assert.deepEqual([g.total, g.notLiquid, g.noShortAverage, g.no200, g.no3m, g.counted], [18, 1, 1, 1, 1, 14]);
  assert.equal(g.total, g.counted + g.notLiquid + g.noShortAverage + g.no200 + g.no3m, 'the lines add up');
  assert.equal(aggregateBreadth(rows).n, g.counted, 'the explanation counts what the Worker counts');
  const ind = g.sectors.find((s) => s.k === 'Industrials')!; assert.deepEqual([ind.screen, ind.counted], [16, 12]);
  assert.deepEqual(aggregateBreadth(rows).sectors.map((s: any) => [s.k, s.n]), [['Industrials', 12]], 'a sector under 8 counted names is not listed');
});
test('2.2 on the real screen, when one is built: the gap lines add up and equal the Worker\'s n', { skip: !existsSync(new URL('../dist/data/screen.json', import.meta.url)) }, () => {
  const scr = JSON.parse(readFileSync(new URL('../dist/data/screen.json', import.meta.url), 'utf8')); const g = universeReport(scr.rows, scr.as_of, scr.built_on).breadthGap;
  assert.equal(g.total, scr.rows.length); assert.equal(g.total, g.counted + g.notLiquid + g.noShortAverage + g.no200 + g.no3m); assert.equal(aggregateBreadth(scr.rows).n, g.counted);
});
