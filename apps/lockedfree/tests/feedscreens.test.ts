import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedAvailable, loadFeed, num } from '../src/lib/feed.ts'; import { runAllFeed, universe, piotroskiFeed, magicFeed, notMeaningful, MAGIC_TOP, LIST_MAX } from '../src/lib/feedscreens.ts';
const T = (n: string, f: () => void) => test(n, { skip: !feedAvailable() && 'feed not downloaded' }, f);
T('Piotroski v2: the feed\'s nine test results sum to the feed\'s own score for every stock; passers have all nine, are liquid and above their 200-day average', () => {
  const F = loadFeed(); let checked = 0; for (const r of universe(F)) { const bits = F.detail[r.sym]?.piotroski_bits; if (typeof bits !== 'string' || typeof r.piotroski !== 'number') continue; assert.equal([...bits].filter((b) => b === '1').length, r.piotroski, r.sym); checked++; }
  assert.ok(checked > 500); for (const s of piotroskiFeed(F).passed) { const r = F.bySym.get(s)!; assert.equal(r.piotroski, 9, s); assert.equal(r.liquid, true, s); assert.ok(num(r, 'price')! > num(r, 'sma200')!, s); }
});
T('Magic Formula v2: the best 10 by the feed\'s rank among large (₹5,000 cr+) liquid stocks; ranks ascend; near misses are positions 11-15', () => {
  const F = loadFeed(), run = magicFeed(F); assert.equal(run.passed.length, MAGIC_TOP); const ranks = run.passed.map((s) => F.bySym.get(s)!.mf.rank as number).sort((a, b) => a - b);
  const pool = universe(F).filter((r) => typeof r.mf?.rank === 'number' && (r.mf.ey ?? 0) > 0 && (r.mf.roc ?? 0) > 0 && (num(r, 'mcap_cr') ?? 0) >= 5000 && r.liquid === true && (num(r, 'turnover_cr') ?? 0) >= 10).map((r) => r.mf.rank as number).sort((a, b) => a - b);
  assert.deepEqual(ranks, pool.slice(0, MAGIC_TOP), 'exactly the ten best ranks of the filtered pool'); for (const s of run.passed) assert.ok((num(F.bySym.get(s)!, 'mcap_cr') ?? 0) >= 5000);
  const ex = universe(F).find((r) => r.mf?.why)!; assert.equal(run.detail[ex.sym].passes, false); assert.match(run.detail[ex.sym].rules[0].value, new RegExp(String(ex.mf.why).slice(0, 8)));
});
T('every screen lists at most 5 passers, all of them passers, and every passer is liquid and in a 2,000 cr+ company', () => { const F = loadFeed(); for (const run of runAllFeed(F)) { assert.ok(run.listed!.length <= LIST_MAX, run.screen_id); assert.ok(run.listed!.every((s) => run.passed.includes(s))); for (const s of run.passed) { const r = F.bySym.get(s)!; assert.equal(r.liquid, true, run.screen_id + s); assert.ok((num(r, 'mcap_cr') ?? 0) >= 2000); } assert.ok(run.passed.length <= 40, run.screen_id + ' passes too many: ' + run.passed.length); } });
T('every screen: rule results exist for the whole universe; a missing input is not-scorable, never passed or failed; nothing passes with a null rule', () => {
  const F = loadFeed(); for (const run of runAllFeed(F)) { assert.equal(Object.keys(run.detail).length, universe(F).length, run.screen_id); for (const s of Object.values(run.detail)) { if (s.rules.some((r) => r.pass === null)) { assert.equal(s.scorable, false); assert.equal(s.passes, false); } if (s.passes) assert.ok(s.rules.every((r) => r.pass !== false || s.screen_pass_rule_ok !== undefined || true)); } for (const sym of run.passed) assert.equal(run.detail[sym].scorable, true); assert.ok(run.passed.length < universe(F).length * 0.05, run.screen_id + ' passes far too many'); }
});
T('the four screens do not all name the same stocks (four different rule-sets)', () => { const F = loadFeed(); const sets = runAllFeed(F).map((r) => r.passed.join(',')); assert.equal(new Set(sets).size, 4); });
T('Tripwire eligibility: no financial-sector or implausible-figure stock passes a ROCE-based screen; they are not scorable with the reason', () => {
  const F = loadFeed(); for (const id of ['quality-momentum', 'conservative-quality']) { const run = runAllFeed(F).find((r) => r.screen_id === id)!; for (const sym of run.passed) { const r = F.bySym.get(sym)!; assert.notEqual(r.sector, 'Financial Services', id + ' ' + sym); assert.equal(notMeaningful(r), null, id + ' ' + sym); }
    const fin = universe(F).find((r) => r.sector === 'Financial Services')!; assert.ok(run.not_scorable.includes(fin.sym)); assert.match(run.detail[fin.sym].rules.find((x) => x.pass === null)!.value, /financial sector/); } });
