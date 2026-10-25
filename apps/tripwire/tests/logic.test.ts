import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizePlan } from '../src/planner.ts';
import { filterRows, sortRows, NO_FILTER, type Row } from '../src/screen.ts';
import { DEFAULTS, addEntry, editEntry, current, reviewDue, savePlan, markPaperFill, closePlan, saveCompare, recordSnap, changesSince, weeklyReview, journalCsv, parseState, mergeStates, toggleFollow, exportJson } from '../src/store.ts';
import { METRICS, glossarySearch } from '../src/metrics.ts';
import { ENGINES } from '../src/engines.ts';

const base = { equity: 1_000_000, cash: 1_000_000, riskPct: 0.5, entry: 100, stop: 95, maxPositionPct: 15, costRoundTripPct: 0.4 };

test('planner: risk-bound quantity, capital, risk and costs', () => {
  const p = sizePlan({ ...base, maxPositionPct: 100 });
  assert.ok(p.ok); if (!p.ok) return;
  assert.equal(p.qty, 1000);                    // 5000 risk / 5 per share
  assert.equal(p.binding, 'risk');
  assert.equal(p.capital, 100000); assert.equal(p.risk, 5000); assert.equal(p.costs, 400);
  assert.deepEqual(p.targets.map((t) => t.price), [110, 120]);
  assert.equal(p.targets[0].net, 10 * 1000 - 400);
});
test('planner: each cap can bind, and liquidity is 1% of traded value', () => {
  const pos = sizePlan({ ...base });                              // 15% of 1M = 150k / 100 = 1500, risk allows 1000
  assert.ok(pos.ok && pos.qty === 1000);
  const cash = sizePlan({ ...base, cash: 20000, maxPositionPct: 100 }); assert.ok(cash.ok && cash.binding === 'cash' && cash.qty === 200);
  const position = sizePlan({ ...base, riskPct: 5, maxPositionPct: 2 }); assert.ok(position.ok && position.binding === 'position' && position.qty === 200);
  const liq = sizePlan({ ...base, maxPositionPct: 100, tradedValue: 5_000_000 }); assert.ok(liq.ok && liq.binding === 'liquidity' && liq.qty === 500);
  const noliq = sizePlan({ ...base, maxPositionPct: 100 }); assert.ok(noliq.ok && noliq.limits.some((l) => /Liquidity is unknown/.test(l)));
});
test('planner: invalid input is refused, never rounded into a plan', () => {
  for (const bad of [{ stop: 100 }, { stop: 101 }, { entry: -1 }, { entry: 0 }, { equity: NaN }, { riskPct: 6 }, { riskPct: 0 }, { maxPositionPct: 101 }, { costRoundTripPct: -1 }]) {
    const r = sizePlan({ ...base, ...bad } as never); assert.equal(r.ok, false, JSON.stringify(bad));
  }
  const tiny = sizePlan({ ...base, cash: 50 }); assert.equal(tiny.ok, false);
  assert.match((tiny as { error: string }).error, /less than one share/);
});

const rows: Row[] = [
  { sym: 'AAA', name: 'Alpha Ltd', sector: 'Technology', tier: 'large', pe: 12, roce_med: 25, rs3m: 5, from_high: -1, r3m: 9, turnover_cr: 50 },
  { sym: 'BBB', name: 'Beta Bank', sector: 'Financial Services', tier: 'large', pe: 45, roce_med: 30, rs3m: -4, from_high: -20 },
  { sym: 'CCC', name: 'Gamma Ltd', sector: 'Technology', tier: 'small', pe: null, roce_med: null, rs3m: null, from_high: null },
  { sym: 'DDD', name: 'Delta Ltd', sector: 'Energy', tier: 'mid', pe: -3, roce_med: 22, rs3m: 12, from_high: -4 },
];
test('discover: filters count what they could not measure and never treat missing as a pass', () => {
  const cheap = filterRows(rows, { ...NO_FILTER, value: 'cheap' });
  assert.deepEqual(cheap.rows.map((r) => r.sym), ['AAA']);          // DDD has a negative PE, CCC has none
  assert.equal(cheap.unmeasured, 1);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, quality: 'high' }).rows.map((r) => r.sym), ['AAA', 'DDD']);   // the bank is excluded by the lender rule
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, q: 'beta' }).rows.map((r) => r.sym), ['BBB']);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, momentum: 'near-high' }).rows.map((r) => r.sym), ['AAA', 'DDD']);
});
test('discover: missing sorts last in both directions', () => {
  assert.deepEqual(sortRows(rows, 'pe', 'asc').map((r) => r.sym), ['DDD', 'AAA', 'BBB', 'CCC']);
  assert.deepEqual(sortRows(rows, 'pe', 'desc').map((r) => r.sym), ['BBB', 'AAA', 'DDD', 'CCC']);
  assert.equal(sortRows(rows, 'rs3m', 'desc')[3].sym, 'CCC');
});

const v = (o: Partial<Parameters<typeof addEntry>[2]> = {}) => ({ thesis: 'T', support: 'S', counter: 'C', decision: 'Watch', invalidation: 'Below 95', trigger: 'Results', reviewOn: '2026-11-01', ...o });
test('journal: edits append a version and never rewrite history', () => {
  const { s, id } = addEntry(DEFAULTS, 'TCS', v(), new Date('2026-10-20T10:00:00Z'));
  const same = editEntry(s, id, v(), new Date('2026-10-21T10:00:00Z'));
  assert.equal(same.entries[0].versions.length, 1);                  // nothing changed, nothing added
  const s2 = editEntry(s, id, v({ thesis: 'T2' }), new Date('2026-10-22T10:00:00Z'));
  assert.equal(s2.entries[0].versions.length, 2);
  assert.equal(s2.entries[0].versions[0].thesis, 'T');
  assert.equal(current(s2.entries[0]).thesis, 'T2');
});
test('journal: review dates use the Indian calendar day', () => {
  const { s } = addEntry(DEFAULTS, 'TCS', v({ reviewOn: '2026-10-25' }));
  const e = s.entries[0];
  assert.equal(reviewDue(e, '2026-10-26'), 'overdue'); assert.equal(reviewDue(e, '2026-10-25'), 'today'); assert.equal(reviewDue(e, '2026-10-24'), 'later');
  assert.equal(reviewDue({ ...e, archived: true }, '2026-10-26'), null);
  assert.equal(reviewDue({ ...e, versions: [{ ...e.versions[0], reviewOn: null }] }, '2026-10-26'), null);
});
test('plans: saved is not filled, filled is only set by the user, revisions count', () => {
  let s = savePlan(DEFAULTS, { sym: 'TCS', entry: 100, stop: 95, qty: 10, riskPct: 0.5, expiry: null, note: '' });
  const id = s.plans[0].id; assert.equal(s.plans[0].status, 'saved'); assert.equal(s.plans[0].rev, 1);
  s = closePlan(s, id); assert.equal(s.plans[0].status, 'saved');     // cannot close what was never filled
  s = savePlan(s, { id, sym: 'TCS', entry: 101, stop: 95, qty: 10, riskPct: 0.5, expiry: null, note: 'moved' }); assert.equal(s.plans[0].rev, 2);
  s = markPaperFill(s, id); assert.equal(s.plans[0].status, 'paper-filled'); s = closePlan(s, id); assert.equal(s.plans[0].status, 'closed');
});
test('compare: needs two, dedupes regardless of order', () => {
  let s = saveCompare(DEFAULTS, ['A']); assert.equal(s.compares.length, 0);
  s = saveCompare(s, ['A', 'B']); s = saveCompare(s, ['B', 'A']); assert.equal(s.compares.length, 1);
});
test('changes since last look: only against a stored earlier day', () => {
  let s = toggleFollow(DEFAULTS, 'TCS');
  const now = { TCS: { day: '2026-10-23', px: 105, rsi: 71, rs3m: 3, from_high: -1 } };
  assert.deepEqual(changesSince(s, now), []);                         // no earlier snapshot: nothing invented
  s = recordSnap(s, 'TCS', { day: '2026-10-22', px: 100, rsi: 65, rs3m: 2, from_high: -6 });
  const c = changesSince(s, now); assert.equal(c.length, 1);
  assert.ok(c[0].crossed.includes('RSI crossed 70')); assert.equal(Math.round(c[0].pxPct!), 5); assert.equal(c[0].since, '2026-10-22');
  const again = recordSnap(s, 'TCS', { day: '2026-10-22', px: 999, rsi: 1, rs3m: 0, from_high: 0 }); assert.equal(again.snaps.TCS.length, 1);   // one per data day
  assert.deepEqual(changesSince(s, { TCS: { day: '2026-10-23', px: 100.5, rsi: 66, rs3m: 2, from_high: -6 } }), []);   // a quiet day reports nothing
});
test('weekly review counts process, not returns', () => {
  const { s } = addEntry(DEFAULTS, 'TCS', v({ invalidation: '' }), new Date('2026-10-24T05:00:00Z'));
  const w = weeklyReview(s, '2026-10-26'); assert.equal(w.decisionsTouched, 1); assert.equal(w.entriesWithoutInvalidation, 1); assert.equal(w.thesesChanged, 0);
  assert.ok(!('returns' in w) && !('pnl' in w));
});
test('export: csv neutralises formulas and keeps every version; json round-trips; foreign shapes are refused', () => {
  const { s } = addEntry(DEFAULTS, 'TCS', v({ thesis: '=HYPERLINK("x")', support: 'a,b' }));
  const csv = journalCsv(s); assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('"a,b"'));
  assert.equal(parseState(exportJson(s))!.entries.length, 1);
  assert.equal(parseState('{"v":99}'), null); assert.equal(parseState('nope'), null); assert.equal(parseState('{"v":1,"follows":1}'), null);
});
test('merge: a guest and an account keep every record, the longer history wins', () => {
  const a = addEntry(DEFAULTS, 'TCS', v()).s; const id = a.entries[0].id;
  const b = { ...editEntry(a, id, v({ thesis: 'later' })), follows: ['INFY'] };
  const m = mergeStates({ ...a, follows: ['TCS'] }, b);
  assert.equal(m.entries.length, 1); assert.equal(m.entries[0].versions.length, 2); assert.deepEqual(m.follows.sort(), ['INFY', 'TCS']);
});
test('copy: no definition or engine reason promises returns', () => {
  const bad = /guarantee|sure[- ]?shot|risk[- ]free|will (rise|fall|go up)|win(ning)? probability/i;
  for (const m of METRICS) assert.ok(!bad.test(m.what + (m.caution ?? '')), m.id);
  for (const e of ENGINES) assert.ok(!bad.test(e.why), e.id);
  assert.ok(ENGINES.every((e) => e.state !== 'VALIDATED') && ENGINES.length === 6);
  assert.ok(glossarySearch('roce').length >= 1 && glossarySearch('').length === 0);
});

import { lastFinishedSession, sessionsBehind, freshness } from '../src/fresh.ts';
import { breadth, checklistFor } from '../src/insight.ts';
test('freshness: the last finished session depends on the Indian clock', () => {
  assert.equal(lastFinishedSession(new Date('2026-10-23T11:00:00Z')), '2026-10-23');    // Fri 16:30 IST, closed
  assert.equal(lastFinishedSession(new Date('2026-10-23T08:00:00Z')), '2026-10-22');    // Fri 13:30 IST, still open
  assert.equal(lastFinishedSession(new Date('2026-10-25T10:00:00Z')), '2026-10-23');    // Sunday
  assert.equal(sessionsBehind('2026-10-23', new Date('2026-10-25T10:00:00Z')), 0);
  assert.equal(sessionsBehind('2026-10-22', new Date('2026-10-25T10:00:00Z')), 1);
  assert.equal(sessionsBehind('2026-10-20', new Date('2026-10-25T10:00:00Z')), 3);
  assert.equal(sessionsBehind(null), null); assert.equal(freshness('garbage').word, 'Unknown');
});
test('insight: breadth counts measured liquid rows only; checklist cites its own figures', () => {
  const b = breadth([{ sym: 'A', name: 'A', liquid: true, price: 10, sma50: 9 }, { sym: 'B', name: 'B', liquid: true, price: 8, sma50: 9 }, { sym: 'C', name: 'C', liquid: true, price: 8, sma50: null }, { sym: 'D', name: 'D', liquid: false, price: 8, sma50: 1 }]);
  assert.equal(b.n, 2); assert.equal(b.pct, 50);
  assert.equal(breadth([]).pct, null);
  const c = checklistFor({ sym: 'X', name: 'X', rsi: 74, vol_spike: 2.5, pe: 45, from_high: -25, risk_lvl: 'HIGH', has_stmts: false, last_date: '2026-10-23' }, '2026-10-25');
  assert.ok(c.some((t) => /RSI is 74/.test(t)) && c.some((t) => /2\.5x/.test(t)) && c.some((t) => /PE is 45/.test(t)) && c.some((t) => /No financial statements/.test(t)));
  assert.ok(c[0].startsWith('Write what would make you wrong'));
});
