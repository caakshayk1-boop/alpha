import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { curateCase, eligibilityOf, meaningful, riskGradeOf, topicOf, isFinancialSector } from '../src/eligibility.ts';
import { isLender } from '../src/screen.ts';
import { buildCtx, evaluate, eligible, type Q } from '../src/quant.ts';
import { rulesFor, rulesOfRecord } from '../src/rules.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));
const gcsl = load('gcsl.json'); const tcs = load('tcs.json');
const cur = (c: typeof gcsl, e: ReturnType<typeof eligibilityOf>) => curateCase({ strengths: c.swot?.s ?? [], flags: c.risk?.flags ?? [], weaknesses: c.swot?.w ?? [] }, e);

test('GCSL regression: a financial-sector name is judged on none of the capital ratios, on either side of the case', () => {
  const e = eligibilityOf(gcsl.row, gcsl.years);
  assert.equal(e.financial, true);
  for (const m of ['roce', 'margin', 'leverage', 'cash', 'cover'] as const) assert.equal(meaningful(e, m), false, m);
  const c = cur(gcsl, e);
  const all = [...c.strengths, ...c.counters].map((x) => `${x.t} ${x.k}`).join(' | ');
  assert.doesNotMatch(all, /capital employed|ROCE|return on capital|operating margin|EBIT margin|margin discontinuity/i, 'no line judges a figure that is withheld');
  assert.ok(c.strengths.some((x) => /revenue compounding/i.test(x.t)), 'figures that do apply stay');
  assert.ok(c.counters.some((x) => /share count/i.test(x.t)) && c.counters.some((x) => /200-day/i.test(x.t)));
  assert.equal(c.hidden.length, 6, 'six lines were about withheld figures, and they are counted rather than lost');
});
test('GCSL regression: the risk grade is not printed as a finding when it is built from withheld ratios', () => {
  const e = eligibilityOf(gcsl.row, gcsl.years); const g = riskGradeOf(gcsl.row, e);
  assert.equal(g.level, null); assert.match(g.note ?? '', /built from ratios that do not apply/);
});
test('GCSL regression: the engine explanation says "financial sector", not "lender", and fails the quality engine for that reason only', () => {
  const row = gcsl.row as Q; const ctx = buildCtx([row]);
  const q = evaluate('QLT', row, ctx); const c = q.criteria.find((x) => /financial-sector/i.test(x.label))!;
  assert.equal(c.pass, false); assert.equal(c.value, 'financial sector');
  assert.ok(!q.criteria.some((x) => /lender/i.test(x.label)));
});
test('an operating company keeps its ROCE strength and its ROCE-trend flag, once each', () => {
  const e = eligibilityOf(tcs.row, tcs.years); assert.equal(e.financial, false);
  const c = cur(tcs, e); assert.equal(c.hidden.length, 0);
  assert.ok(c.strengths.some((x) => /capital employed/i.test(x.t)));
});
test('the same fact on two lists is shown once: a risk flag and a weakness that both say return on capital is falling', () => {
  const e = eligibilityOf({ sector: 'Industrials', tier: 'mid' });
  const c = curateCase({ strengths: [], flags: [{ s: 'high', t: 'Return on capital falling across the statement history', k: 'ROCE 10% vs 15% median' }], weaknesses: [{ t: 'Return on capital has fallen across the statement history, so it is less efficient', k: 'ROCE trend falling over 4 years' }, { t: 'Operating margin has compressed', k: 'EBIT margin 9% vs 12% median' }, { t: 'Operating margin compressing', k: 'EBIT margin 9%' }] }, e);
  assert.equal(c.counters.length, 2); assert.equal(c.merged, 2);
  assert.deepEqual(c.counters.map((x) => x.topic).sort(), ['margin_trend', 'roce_trend']);
  assert.equal(c.counters[0].sev, 'high', 'the flag, with its severity, is the line kept');
});
test('an operating profit above revenue makes margin and ROCE not meaningful in any sector, and cash conversion on a near-zero profit too', () => {
  const years = [{ fy: 'FY26', ebit_margin: 60 }, { fy: 'FY25', ebit_margin: 136.5 }, { fy: 'FY24', ebit_margin: 20 }];
  const e = eligibilityOf({ sector: 'Industrials', tier: 'small' }, years);
  assert.equal(e.metrics.margin.ok, false); assert.equal(e.metrics.roce.ok, false); assert.match(e.metrics.margin.reason ?? '', /FY25/); assert.equal(e.metrics.leverage.ok, true);
  const e2 = eligibilityOf({ sector: 'Industrials', tier: 'small' }, [{ fy: 'FY26', cfo_pat: -23.86 }]); assert.equal(e2.metrics.cash.ok, false); assert.equal(e2.metrics.margin.ok, true);
});
test('size class: an unpublished class is stated, never read as a finding', () => {
  assert.deepEqual(eligibilityOf({ sector: 'Industrials' }).size, { known: false, tier: null, label: 'Size class not published' });
  assert.equal(eligibilityOf({ sector: 'Industrials', tier: 'micro' }).size.label, 'Micro cap');
});
test('the eligibility rule is pinned by version: elig-1 is what was built, elig-2 is the written spec, and the day each applies from is fixed', () => {
  const base = { sym: 'X', name: 'X', liquid: true, price: 100, atr_pct: 2, turnover_cr: 50, tier: 'mid' };
  assert.equal(rulesFor('2026-10-26'), 'elig-1'); assert.equal(rulesFor('2026-10-27'), 'elig-2'); assert.equal(rulesFor('2027-03-01'), 'elig-2'); assert.equal(rulesOfRecord(undefined), 'elig-1', 'a night written before versions existed is elig-1'); assert.equal(rulesOfRecord('elig-2'), 'elig-2'); assert.equal(rulesOfRecord('nonsense'), 'elig-1');
  // elig-1, exactly as built
  assert.equal(eligible({ ...base, tier: 'micro' } as Q, 'elig-1'), false); assert.equal(eligible({ ...base, tier: undefined } as Q, 'elig-1'), true, 'D1 as it was: an unpublished class passed');
  assert.equal(eligible({ ...base, price: 30 } as Q, 'elig-1'), true, 'D3 as it was: no floor'); assert.equal(eligible({ ...base, turnover_cr: 2 } as Q, 'elig-1'), true, 'D2 as it was: the traded value was not read');
  // elig-2, the written spec
  assert.equal(eligible({ ...base } as Q, 'elig-2'), true);
  assert.equal(eligible({ ...base, tier: undefined } as Q, 'elig-2'), false, 'D1: a class that is not published is not shown to be in the index'); assert.equal(eligible({ ...base, tier: 'micro' } as Q, 'elig-2'), false);
  assert.equal(eligible({ ...base, turnover_cr: 9.99 } as Q, 'elig-2'), false, 'D2: just under ₹10 crore'); assert.equal(eligible({ ...base, turnover_cr: 10 } as Q, 'elig-2'), true, 'exactly ₹10 crore passes'); assert.equal(eligible({ ...base, turnover_cr: null } as Q, 'elig-2'), false, 'an unmeasured value is not a pass');
  assert.equal(eligible({ ...base, price: 49.99 } as Q, 'elig-2'), false, 'D3: just under ₹50'); assert.equal(eligible({ ...base, price: 50 } as Q, 'elig-2'), true);
  assert.equal(eligible({ ...base, liquid: false } as Q, 'elig-2'), false, 'the liquid flag still has to hold');
  assert.equal(eligible({ ...base } as Q), true, 'the default is the version in force now');
});
test('the two real names behind the discrepancy: GCSL and SBC (no published class) were Momentum picks under elig-1 and are not eligible under elig-2', () => {
  const gcsl = { sym: 'GCSL', name: 'Gretex', liquid: true, price: 746, atr_pct: 3, turnover_cr: 40, tier: undefined }, sbc = { sym: 'SBC', name: 'SBC', liquid: true, price: 63.7, atr_pct: 3, turnover_cr: 12, tier: undefined };
  for (const r of [gcsl, sbc]) { assert.equal(eligible(r as Q, 'elig-1'), true); assert.equal(eligible(r as Q, 'elig-2'), false); }
});
test('one definition: the old name and the new one agree on every sector', () => {
  for (const sector of ['Financial Services', 'Industrials', 'Technology', null, undefined]) assert.equal(isLender({ sector }), isFinancialSector({ sector }));
});
test('topics: the wording the feed uses for one fact lands on one topic', () => {
  assert.equal(topicOf({ t: 'Operating margin compressing', k: 'EBIT margin 62.4%' }).id, 'margin_trend');
  assert.equal(topicOf({ t: 'Latest year contains a margin discontinuity, so its headline ratios are not a run rate', k: 'EBIT margin moved 48pt year on year' }).id, 'margin_jump');
  assert.equal(topicOf({ t: 'Earns 34% on capital employed', k: 'ROCE 33.7% (3Y median)' }).id, 'roce_level');
});
