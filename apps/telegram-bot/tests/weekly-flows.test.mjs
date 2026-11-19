import test from 'node:test';
import assert from 'node:assert/strict';
import { composeWeekly } from '../weekly.js';
import { digestFeeds, compose, SLOTS, dueSlot } from '../briefs.js';

const NOW = Date.parse('2026-11-21T01:00:00Z'); // Sat 09:00 MYT
test('the weekly slot is Saturday 09:00 Malaysia time only', () => {
  assert.equal(dueSlot(NOW).slot.id, 'weekly');
  assert.equal(dueSlot(Date.parse('2026-11-21T04:00:00Z')), null);
  assert.equal(dueSlot(Date.parse('2026-11-14T01:00:00Z')).key, '2026-11-14:weekly');
  assert.equal(dueSlot(Date.parse('2026-11-19T01:00:00Z')), null, 'Thursday 09:00 is not a slot');
  assert.equal(dueSlot(Date.parse('2026-11-22T01:00:00Z')), null, 'Sunday');
});
test('weekly review: counts only the last 7 days and says when there is nothing to compare', () => {
  const t = composeWeekly({
    ledger: { ledger: { picks: [{ asOf: '2026-11-19' }, { asOf: '2026-11-10' }, { asOf: '2026-11-18' }], outcomes: {
      a: { status: 'open', pct: 10, t1Hit: true }, b: { status: 'open', pct: 0 },
      c: { status: 'closed', exitDay: '2026-11-17', r: 2, reason: 'Target 2' }, d: { status: 'closed', exitDay: '2026-11-17', r: -1, reason: 'Stop' }, e: { status: 'closed', exitDay: '2026-10-01', r: 5, reason: 'Target 2' } } } },
    rulebook: { as_of: '2026-11-20', aggregates: [{ n_open: 3, n_closed: 1 }], book_days: [{ screen_id: 'all', date: '2026-11-13', equity: 100 }, { screen_id: 'all', date: '2026-11-20', equity: 130 }] },
    signals: { gate: { on: false }, record: { closed: 0, wins: 0, total_r: 0 }, gate_history: [{ on: true }, { on: false }, { on: true }, { on: false }, { on: false }, { on: true }] },
  }, NOW).text;
  assert.match(t, /Window: 2026-11-14 to 2026-11-21/);
  assert.match(t, /2 new picks this week · 2 open \(average move since entry \+5\.00%, target 1 hit on 1\)/);
  assert.match(t, /2 closed this week: 1 winners · 1 R in total \(Target 2, Stop\)/);
  assert.match(t, /equity 130 \(\+30 since 2026-11-13\)/);
  assert.match(t, /ON on 2 of the last 5 sessions/);
  const bare = composeWeekly({ ledger: null, rulebook: null, signals: null }, NOW).text;
  assert.equal((bare.match(/n\/a \(/g) || []).length, 3);
  const one = composeWeekly({ rulebook: { aggregates: [], book_days: [{ screen_id: 'all', date: '2026-11-20', equity: 5 }] } }, NOW).text;
  assert.match(one, /no earlier day to compare/);
});
test('close brief carries money flow with its dates and units as published', () => {
  const st = digestFeeds({
    fiidii: { rows: [{ date: '2026-11-17', fii: { net: 1 }, dii: { net: 2 } }, { date: '2026-11-18', fii: { net: 6836.81 }, dii: { net: -3678.85 } }] },
    breadth: { as_of: '2026-11-18', n: 916, up: 127, mixed: 647, down: 142 },
    macro: { quotes: { BRENT: { px: 89.64, prev: 89.17, live: true }, GOLD: { px: 3674.6, prev: 3741.9, live: true }, BTC: { px: 62371.74, prev: 62987.29, live: true }, USDMYR: { px: 4.11, prev: 4.11, live: false } } },
  }, NOW);
  const t = compose(SLOTS[2], st, null, [], NOW).text;
  assert.match(t, /FII net 6,837 · DII net -3,679 \(NSE provisional, 2026-11-18; as published, unit not stated\)/);
  assert.match(t, /Breadth \(2026-11-18\): 127 up, 142 down, 647 mixed of 916/);
  assert.match(t, /Brent 89\.64 \(\+0\.53%\) · Gold 3,674.6 \(-1\.80%\) · BTC 62,372 \(-0\.98%\) · USD\/MYR 4\.11 \(\+0\.00%, not live\)/);
  assert.doesNotMatch(compose(SLOTS[0], st, null, [], NOW).text, /FII net/, 'only the close brief');
});
