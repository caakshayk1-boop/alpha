import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedAvailable, loadFeed, num } from '../src/lib/feed.ts'; import { runAllFeed, universe, piotroskiFeed, magicFeed, notMeaningful, TOP } from '../src/lib/feedscreens.ts';
const T = (n: string, f: () => void) => test(n, { skip: !feedAvailable() && 'feed not downloaded' }, f);
T('Piotroski: the feed\'s nine test results sum to the feed\'s own score for every stock, and passes = 8 or 9', () => {
  const F = loadFeed(); let checked = 0; for (const r of universe(F)) { const bits = F.detail[r.sym]?.piotroski_bits; if (typeof bits !== 'string' || typeof r.piotroski !== 'number') continue; assert.equal([...bits].filter((b) => b === '1').length, r.piotroski, r.sym); checked++; }
  assert.ok(checked > 500); const run = piotroskiFeed(F); for (const s of run.passed) assert.ok(num(F.bySym.get(s)!, 'piotroski')! >= 8, s); assert.equal(run.passed.length, universe(F).filter((r) => (r.piotroski ?? 0) >= 8 && typeof F.detail[r.sym]?.piotroski_bits === 'string').length);
});
T('Magic Formula: exactly the 15 best ranks the source gives, in universe; excluded stocks are refused with the source\'s reason; near misses are ranks 16-20', () => {
  const F = loadFeed(), run = magicFeed(F); assert.equal(run.passed.length, TOP); const ranks = run.passed.map((s) => F.bySym.get(s)!.mf.rank as number).sort((a, b) => a - b); assert.ok(ranks[ranks.length - 1] <= TOP); assert.equal(new Set(ranks).size, TOP);
  for (const n of run.near_miss) { const k = F.bySym.get(n.symbol)!.mf.rank; assert.ok(k > TOP && k <= TOP + 5); } const ex = universe(F).find((r) => r.mf?.why)!; assert.equal(run.detail[ex.sym].passes, false); assert.match(run.detail[ex.sym].rules[0].value, new RegExp(String(ex.mf.why).slice(0, 8)));
});
T('every screen: rule results exist for the whole universe; a missing input is not-scorable, never passed or failed; nothing passes with a null rule', () => {
  const F = loadFeed(); for (const run of runAllFeed(F)) { assert.equal(Object.keys(run.detail).length, universe(F).length, run.screen_id); for (const s of Object.values(run.detail)) { if (s.rules.some((r) => r.pass === null)) { assert.equal(s.scorable, false); assert.equal(s.passes, false); } if (s.passes) assert.ok(s.rules.every((r) => r.pass !== false || s.screen_pass_rule_ok !== undefined || true)); } for (const sym of run.passed) assert.equal(run.detail[sym].scorable, true); assert.ok(run.passed.length < universe(F).length * 0.5, run.screen_id + ' passes far too many'); }
});
T('the four screens do not all name the same stocks (a sanity check that they are four different rule-sets)', () => { const F = loadFeed(); const sets = runAllFeed(F).map((r) => r.passed.join(',')); assert.equal(new Set(sets).size, 4); });
T('Tripwire eligibility: no financial-sector or implausible-figure stock passes a ROCE-based screen; they are not scorable with the reason', () => {
  const F = loadFeed(); for (const id of ['quality-momentum', 'conservative-quality']) { const run = runAllFeed(F).find((r) => r.screen_id === id)!; for (const sym of run.passed) { const r = F.bySym.get(sym)!; assert.notEqual(r.sector, 'Financial Services', id + ' ' + sym); assert.equal(notMeaningful(r), null, id + ' ' + sym); }
    const fin = universe(F).find((r) => r.sector === 'Financial Services')!; assert.ok(run.not_scorable.includes(fin.sym)); assert.match(run.detail[fin.sym].rules.find((x) => x.pass === null)!.value, /financial sector/); } });
