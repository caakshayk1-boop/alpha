// Signals: what the TypeScript marks do against the disclosed daily-bar rules, and the Signals workspace's pure view logic.
// Run with: node --experimental-strip-types --test tests/plan.test.ts
//
// The daily-bar rules (stop first on a bar that spans the stop and a target; T1 and T2 both filling on one bar; a gap through the
// stop filling at the open) are implemented ONLY in engines/swing.py walk() and tested in engines/tests/test_swing.py (cases 1, 2,
// 6 and A16). lib/plan.ts mark() sees one latest price, not a bar, so it cannot apply them. These tests pin what it does instead,
// so the page's wording ("provisional, not an execution event") stays true: it never books an event, it advances one step at a
// time, and it marks R at the price it is given.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide, mark } from '../src/lib/plan.ts';
import { LIFECYCLE, costR, evidence, gateFunnel, grossNet, istStamp, nextRun, setupReasons, swingLifecycle, tNeeded } from '../src/lib/signalsView.ts';
import { STATE_WORD, V3_REGISTRY, lifecycleRows, copyViolations } from '../src/lib/enginesV3.ts';
import type { Sig, SignalsFeed } from '../src/lib/types.ts';

const base: Sig = { id: 'swing:X:2026-10-14', engine: 'swing', sym: 'X', name: 'X Ltd', sector: 'Tech', setup: 'Pullback', date: '2026-10-14', ref_price: 100, sl: 95,
  risk_pct: 5, t1_plan: 110, t2_plan: 120, max_hold: 30, why: [], first_seen: '2026-10-14', status: 'open', half: false,
  entry: 100, entry_date: '2026-10-15', t1: 110, t2: 120, risk: 5, stop_now: 95, remaining: 1, last_close: 104, last_close_date: '2026-10-19',
  events: [{ date: '2026-10-15', kind: 'entry', price: 100, fraction: 1 }] };
const at = (price: number) => ({ price, source: 'live' as const, session: '2026-10-21', at: Date.UTC(2026, 9, 21, 5, 0) / 1000 });
const feed = JSON.parse(readFileSync('public/signals.json', 'utf8')) as SignalsFeed;

test('mark: a price through the stop is a stop mark at that price, as a gap fills at the open (never at the stop level)', () => {
  const m = mark(base, at(93));
  assert.equal(m.state, 'stop-hit');
  assert.equal(m.r, -1.4, 'marked at 93, not at the 95 stop: worse than −1R, as a gap-through fill would be');
  assert.ok(m.live, 'a live price, so the page labels the state provisional');
});
test('mark: the stop is checked before any target (the precedence the bar rule uses)', () => {
  // A raised stop above T1 cannot happen in the plan; it is the only way to give one price both conditions.
  const m = mark({ ...base, stop_now: 112 }, at(111));
  assert.equal(m.state, 'stop-hit', 'stop first');
});
test('mark: beyond T2 before T1 is booked reads T1 reached, one step at a time (the evening run books both on one bar)', () => {
  const m = mark(base, at(121));
  assert.equal(m.state, 't1-hit');
  assert.equal(m.r, 4.2, 'R at the price, the whole position still open: no half is booked by a mark');
  assert.equal(m.half, false);
  assert.match(decide(base, m, '2026-10-19')!.headline, /Sell half at T1/);
  const booked = { ...base, half: true, stop_now: 102.5, events: [...base.events, { date: '2026-10-16', kind: 't1' as const, price: 110, fraction: 0.5 }] };
  assert.equal(mark(booked, at(121)).state, 't2-hit');
});
test('mark: never records an execution event; only the feed (the evening run) carries events', () => {
  const s = structuredClone(base);
  for (const p of [93, 111, 121]) mark(s, at(p));
  assert.deepEqual(s.events, base.events);
  assert.equal(s.half, false);
});
test('mark: open marks are before costs; the cost in R is one round trip of the entry value over the risk', () => {
  const m = mark(base, at(110));
  assert.equal(m.r, 2);
  assert.ok(Math.abs(costR(100, 5, 0.25)! - 0.05) < 1e-12);
  const gn = grossNet(-1.05, 100, 5, 0.25);
  assert.equal(gn.net, -1.05); assert.ok(Math.abs(gn.gross! + 1) < 1e-12, 'gross = net + cost, the engine\'s own booking');
  assert.equal(grossNet(null, 100, 5, 0.25).gross, null, 'no net, no gross');
  assert.equal(grossNet(-1, undefined, 5, 0.25).gross, null, 'no entry, no cost: nothing is invented');
});

test('lifecycle: one vocabulary for Swing v2 and v3', () => {
  assert.deepEqual([...new Set(Object.values(STATE_WORD))].sort(), [...LIFECYCLE].sort());
  assert.equal(swingLifecycle({ alertable: false }), 'Paper');
  assert.equal(swingLifecycle({ alertable: true }), 'Validated');
  const by = Object.fromEntries(V3_REGISTRY.map((r) => [r.id, r.state]));
  assert.deepEqual(by, { E1: 'RESEARCH', E2: 'RETIRED', E3: 'RETIRED', E4: 'RETIRED', E5: 'RESEARCH', E6: 'BLOCKED_DATA', E7: 'PAPER' });
  assert.ok(V3_REGISTRY.every((r) => !/\d+(\.\d+)?R\b|%/.test(r.why)), 'the decision record carries no figure');
  assert.equal(lifecycleRows(null).source, 'record');
  assert.deepEqual(copyViolations(JSON.stringify(V3_REGISTRY)), []);
});

test('gate funnel: counts from gate_history, per-check counts only for the latest session', () => {
  const g = gateFunnel(feed);
  assert.equal(g.sessions, feed.gate_history.length);
  assert.equal(g.on, feed.gate_history.filter((x) => x.on).length);
  assert.equal(g.passed, feed.gate.passed);
  assert.equal(g.total, 4);
  assert.equal(g.failed.length, 4 - feed.gate.passed);
  const syn = gateFunnel({ gate: feed.gate, gate_history: [{ d: '2026-10-01', on: true }, { d: '2026-10-02', on: false }, { d: '2026-10-05', on: false }] });
  assert.deepEqual([syn.sessions, syn.on, syn.offRun, syn.from, syn.to], [3, 1, 2, '2026-10-01', '2026-10-05']);
});

test('empty setups: every reason is kept apart, and only the gate and stale input block a new setup', () => {
  const off = { ...feed, gate: { ...feed.gate, on: false, passed: 1 }, alertable: false };
  const r = setupReasons(off, { state: 'delayed', lagSessions: 1, reference: '2026-10-21' }, false);
  assert.deepEqual(r.map((x) => x.key), ['gate', 'data', 'validation', 'publication']);
  assert.deepEqual(r.filter((x) => x.blocking).map((x) => x.key), ['gate', 'data']);
  assert.match(r[0].text, /1 of 4 checks pass/);
  assert.match(r[1].text, /1 session behind the expected 21 Oct 2026 session/);
  assert.match(r[2].text, /alerts are off/);
  assert.match(r[3].text, /v3 research engines are not/);
  const cur = setupReasons({ ...off, gate: { ...feed.gate, on: true, passed: 4 } }, { state: 'current', lagSessions: 0, reference: off.data_through }, true);
  assert.deepEqual(cur.filter((x) => x.blocking), [], 'gate on, data current: nothing blocks; an empty book is then the stock rules');
  assert.deepEqual(copyViolations(JSON.stringify([r, cur])), []);
});

test('next expected run: the next evening slot (18:00, 20:00, 22:30 IST) on a weekday', () => {
  assert.equal(nextRun(new Date('2026-10-22T04:30:00Z')).toISOString(), '2026-10-22T12:30:00.000Z', 'Thu 10:00 IST -> Thu 18:00 IST');
  assert.equal(nextRun(new Date('2026-10-22T15:00:00Z')).toISOString(), '2026-10-22T17:00:00.000Z', 'Thu 20:30 IST -> Thu 22:30 IST');
  assert.equal(nextRun(new Date('2026-10-23T17:30:00Z')).toISOString(), '2026-10-26T12:30:00.000Z', 'Fri 23:00 IST -> Mon 18:00 IST');
  assert.equal(istStamp(new Date('2026-10-22T12:30:00Z')), 'Thu 22 Oct, 18:00 IST');
});

test('alert evidence: read from the feed, not written down; the t switch is one row among several', () => {
  const ev = evidence(feed);
  const h = feed.backtest!.rules.holdout;
  assert.deepEqual(ev.map((e) => e.key), ['t', 'n', 'months', 'exp', 'cost', 'fwd']);
  assert.ok(ev[1].value.startsWith(`${h.n} `), 'sample size from the feed');
  assert.ok(ev[3].value.includes((h.expectancy_r! < 0 ? '−' : '+') + Math.abs(h.expectancy_r!).toFixed(2)), 'expectancy from the feed');
  assert.ok(ev[3].basis.includes(h.profit_factor!.toFixed(2)), 'profit factor from the feed');
  assert.equal(ev[0].verdict, (h.clustered_t_clustered ?? -Infinity) >= tNeeded(feed.alert_why) ? 'pass' : 'fail');
  assert.equal(ev[4].verdict, 'absent', 'no cost stress is published for Swing v2, and the row says so');
  assert.equal(tNeeded('Alerts off: the holdout month-clustered t is -0.91, needs +2.0.'), 2);
  assert.equal(tNeeded('no number here'), 2);
  assert.deepEqual(copyViolations(JSON.stringify(ev)), []);
});

test('wording guardrails: a setup is a rule match on paper, never a buy call; v3 shows one line, not four empty boxes', () => {
  const pend = { ...base, status: 'pending' as const, entry: undefined, entry_date: undefined, risk: undefined, events: [] };
  const d = decide(pend, mark(pend, null), '2026-10-19')!;
  assert.doesNotMatch(`${d.headline} ${d.detail}`, /\bbuy\b/i);
  assert.match(d.detail, /rule stop/);
  const src = ['src/components/signals/SetupCard.tsx', 'src/components/signals/PaperRecord.tsx', 'src/components/signals/SignalsWorkspace.tsx'].map((f) => readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(src, /\bBuy\b/, 'no "Buy" in setup copy');
  assert.match(src, /Rule match: \{criteria\} of \{criteria\} criteria met/);
  assert.match(src, /paper rule-verification log, not a model portfolio/);
  assert.ok(readFileSync('src/components/EnginesV3.tsx', 'utf8').includes("'v3 records open when the first engine passes validation. The bar is a holdout t of +2.0, published either way.'"));
});
