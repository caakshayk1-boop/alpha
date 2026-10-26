import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { curateCase, eligibilityOf, meaningful, riskGradeOf, topicOf, isFinancialSector } from '../src/eligibility.ts';
import { isLender } from '../src/screen.ts';
import { buildCtx, evaluate, eligible, type Q } from '../src/quant.ts';

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
test('the engines\' current rule is pinned, so changing it is a decision and not an accident: an unpublished size class counts as not micro', () => {
  const base = { sym: 'X', name: 'X', liquid: true, price: 100, atr_pct: 2 };
  assert.equal(eligible({ ...base, tier: 'micro' } as Q), false);
  assert.equal(eligible({ ...base, tier: undefined } as Q), true);       // 266 liquid names today; see docs/tripwire/OPEN_ITEMS.md, decision D1
  assert.equal(eligible({ ...base, tier: 'mid' } as Q), true);
});
test('one definition: the old name and the new one agree on every sector', () => {
  for (const sector of ['Financial Services', 'Industrials', 'Technology', null, undefined]) assert.equal(isLender({ sector }), isFinancialSector({ sector }));
});
test('topics: the wording the feed uses for one fact lands on one topic', () => {
  assert.equal(topicOf({ t: 'Operating margin compressing', k: 'EBIT margin 62.4%' }).id, 'margin_trend');
  assert.equal(topicOf({ t: 'Latest year contains a margin discontinuity, so its headline ratios are not a run rate', k: 'EBIT margin moved 48pt year on year' }).id, 'margin_jump');
  assert.equal(topicOf({ t: 'Earns 34% on capital employed', k: 'ROCE 33.7% (3Y median)' }).id, 'roce_level');
});
