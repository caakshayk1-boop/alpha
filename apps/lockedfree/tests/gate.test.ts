import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyBook, checkEntry, openTrade, closeTrade, lockState, reviewTrade, journal, canEditRules, processBadges, type Rules, type EntryInput, type Book } from '../src/lib/gate.ts';
const rules: Rules = { accountSize: 500000, riskPct: 1, dailyLossLimit: 3000, maxTradesPerDay: 2, ruleText: 'Two losses and I walk away.', strictUntil: null, setOn: '2026-11-16' };
const ok: EntryInput = { symbol: 'tcs', setup: 'Pullback to 50-day', trigger: 'Close above 3,100', stop: 90, target: 130, riskPct: 1, entryPrice: 100 };
const fresh = (): Book => ({ ...emptyBook(), rules });
test('CHECK 5: every violation is refused — each empty checklist item, no size, no stop', () => {
  for (const k of ['setup', 'trigger', 'stop', 'target', 'riskPct', 'entryPrice', 'symbol'] as const) {
    const bad = { ...ok, [k]: typeof ok[k] === 'number' ? null : '' } as EntryInput; const c = checkEntry(bad, rules);
    assert.equal(c.ok, false, k); assert.equal(openTrade(fresh(), bad, '2026-11-18').book.trades.length, 0, 'no trade is created for ' + k);
  }
  assert.equal(checkEntry({ ...ok, stop: 100 }, rules).ok, false); assert.equal(checkEntry({ ...ok, stop: 0 }, rules).ok, false); assert.equal(checkEntry(ok, null).ok, false);
  assert.equal(checkEntry({ ...ok, entryPrice: 5e6 }, rules).ok, false, 'a size under one share is refused');
});
test('size is computed (500000 x 1% / 10 = 500) and an override needs a reason which is stored', () => {
  assert.equal(checkEntry(ok, rules).qty, 500);
  assert.equal(checkEntry({ ...ok, qtyOverride: 800 }, rules).ok, false);
  const o = checkEntry({ ...ok, qtyOverride: 800, overrideReason: 'conviction' }, rules); assert.equal(o.qty, 800);
  const t = openTrade(fresh(), { ...ok, qtyOverride: 800, overrideReason: 'conviction' }, '2026-11-18').book.trades[0]; assert.equal(t.qty, 800); assert.equal(t.qtyOverrideReason, 'conviction'); assert.equal(t.stop, 90);
});
test('CHECK 6: hitting the daily loss limit locks until the next session and quotes the user\'s own rule', () => {
  let b = openTrade(fresh(), ok, '2026-11-20').book; b = closeTrade(b, b.trades[0].id, 90, '2026-11-20').book;   // -5000 - charges
  const l = lockState(b, '2026-11-20'); assert.equal(l.locked, true); assert.equal(l.reason, 'daily-loss'); assert.equal(l.until, '2026-11-23'); assert.equal(l.quote, 'Two losses and I walk away.');
  assert.equal(openTrade(b, ok, '2026-11-20').book.trades.length, 1, 'cannot open while locked'); assert.match(openTrade(b, ok, '2026-11-20').error!, /locked/);
  assert.equal(lockState(b, '2026-11-23').locked, false);
});
test('max trades per day locks too', () => {
  let b = fresh(); b = openTrade(b, { ...ok, symbol: 'A' }, '2026-11-18').book; b = openTrade(b, { ...ok, symbol: 'B' }, '2026-11-18').book;
  assert.equal(lockState(b, '2026-11-18').reason, 'max-trades');
});
test('exit below the logged stop is tagged rule break at the moment of closing; at or above is not', () => {
  let b = openTrade(fresh(), ok, '2026-11-18').book; assert.equal(closeTrade(b, b.trades[0].id, 85, '2026-11-19').book.trades[0].ruleBreak, true);
  assert.equal(closeTrade(b, b.trades[0].id, 90, '2026-11-19').book.trades[0].ruleBreak, false); assert.equal(closeTrade(b, b.trades[0].id, 120, '2026-11-19').book.trades[0].ruleBreak, false);
});
test('CHECK 7: plan % is computed from reviews and rule breaks, skips are counted, mistake cost sums losses on breaks, dual curves', () => {
  let b: Book = { ...fresh(), rules: { ...rules, maxTradesPerDay: 9, dailyLossLimit: 1e9 } };
  const run = (sym: string, px: number, d: string, rv: 'skip' | boolean) => { b = openTrade(b, { ...ok, symbol: sym }, d).book; const id = b.trades.at(-1)!.id; b = closeTrade(b, id, px, d).book; b = reviewTrade(b, id, rv === 'skip' ? 'skip' : { setupQuality: 4, emotion: 2, followedPlan: rv }); };
  run('A', 120, '2026-11-18', true); run('B', 85, '2026-11-18', false); run('C', 110, '2026-11-18', 'skip'); run('D', 105, '2026-11-18', true);
  const j = journal(b); assert.equal(j.closed, 4); assert.equal(j.assessed, 3); assert.equal(j.followed, 2); assert.equal(j.planPct, 67); assert.equal(j.skipped, 1);
  assert.ok(j.mistakeCost > 0); assert.equal(j.planCurve.length, 2); assert.equal(j.breakCurve.length, 1);
  assert.equal(reviewTrade(b, b.trades[0].id, { setupQuality: 1, emotion: 1, followedPlan: false }).trades[0].review!.followedPlan, true, 'a review cannot be rewritten');
});
test('strict mode: rules can be tightened, never loosened, until the date', () => {
  const b: Book = { ...fresh(), rules: { ...rules, strictUntil: '2027-01-01' } };
  assert.equal(canEditRules(b, '2026-11-18', { ...b.rules!, riskPct: 2 }).ok, false); assert.equal(canEditRules(b, '2026-11-18', { ...b.rules!, riskPct: 0.5 }).ok, true);
  assert.equal(canEditRules(b, '2027-01-01', { ...b.rules!, riskPct: 2 }).ok, true);
});
test('badges attach only to process behaviours', () => { assert.deepEqual(processBadges(fresh(), '2026-11-18'), []); });
