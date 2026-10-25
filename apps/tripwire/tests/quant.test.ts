import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENGINES, buildCtx, evaluate, mom12_1, pctMap, runAll, runEngine, type Q } from '../src/quant.ts';
import { evaluatePaper, summarize, type Bar, type Paper } from '../src/tracker.ts';

const base = (o: Partial<Q>): Q => ({ sym: 'X', name: 'X', sector: 'Technology', tier: 'large', liquid: true, price: 100, atr_pct: 2, sma200: 80, rs3m: 5, r1y: 40, r1m: 5, from_high: -3, r6m: 20, sd1y: 20, piotroski: 8, roce_med: 25, de: 0.3, risk_lvl: 'LOW', mf: { rank: 5, of: 100 }, ...o });

test('percentiles: ties share, missing is absent, never zero', () => {
  const m = pctMap([base({ sym: 'A', r6m: 1 }), base({ sym: 'B', r6m: 2 }), base({ sym: 'C', r6m: 2 }), base({ sym: 'D', r6m: null })], (r) => r.r6m);
  assert.equal(m.get('A'), (0 + 0.5) / 3 * 100); assert.equal(m.get('B'), (1 + 0.5 * 2) / 3 * 100); assert.equal(m.get('B'), m.get('C')); assert.ok(!m.has('D'));
});
test('12-1 momentum skips the latest month and needs both figures', () => {
  assert.ok(Math.abs(mom12_1(base({ r1y: 50, r1m: 10 }))! - ((1.5 / 1.1 - 1) * 100)) < 1e-9);
  assert.equal(mom12_1(base({ r1y: null })), null); assert.equal(mom12_1(base({ r1m: -100 })), null);
});
const universe = (): Q[] => Array.from({ length: 40 }, (_, i) => base({ sym: 'S' + i, name: 'S' + i, sector: 'Sec' + (i % 8), r1y: 10 + i * 3, r1m: 2, from_high: -30 + i, r6m: i - 5, sd1y: 50 - i, piotroski: 4 + (i % 6), roce_med: 8 + i, mf: { rank: i + 1, of: 40 } }));
test('momentum: top-fifth scorers that pass the trend filters are picked, best first, with a stop below the close', () => {
  const rows = universe(); const ctx = buildCtx(rows); const run = runEngine('MOM', rows, ctx, '2026-10-23');
  assert.ok(run.picks.length >= 1 && run.picks.length <= 5);
  assert.deepEqual(run.picks.map((p) => p.sym), [...run.picks].sort((a, b) => b.score - a.score).map((p) => p.sym));
  for (const p of run.picks) { assert.ok(p.stop < p.ref); assert.ok(p.score >= 80); assert.equal(p.horizon, 20); assert.ok(p.stopPct <= 12); }
  assert.equal(run.picks[0].sym, 'S39');
});
test('a failed filter excludes even a top scorer, and an unmeasured one is not a pass', () => {
  const rows = universe(); rows[39] = { ...rows[39], sma200: 150 };                 // below its 200-day
  const ctx = buildCtx(rows); assert.ok(!runEngine('MOM', rows, ctx, 'd').picks.some((p) => p.sym === 'S39'));
  const rows2 = universe(); rows2[39] = { ...rows2[39], sma200: null };
  const ev = evaluate('MOM', rows2[39], buildCtx(rows2)); assert.equal(ev.pass, false); assert.ok(ev.criteria.some((c) => c.pass === null));
});
test('eligibility: illiquid, micro cap and no-ATR names never reach any engine', () => {
  const rows = [...universe(), base({ sym: 'ILL', liquid: false }), base({ sym: 'MIC', tier: 'micro' }), base({ sym: 'NOA', atr_pct: null })];
  const { ctx, picks } = runAll(rows, 'd'); assert.ok(!ctx.elig.some((r) => ['ILL', 'MIC', 'NOA'].includes(r.sym))); assert.ok(!picks.some((p) => ['ILL', 'MIC', 'NOA'].includes(p.sym)));
});
test('quality: lenders and weak scorers are out; stop is wider and the horizon longer', () => {
  const rows = universe(); rows[39] = { ...rows[39], sector: 'Financial Services' };
  const ctx = buildCtx(rows); const run = runEngine('QLT', rows, ctx, 'd');
  assert.ok(!run.picks.some((p) => p.sym === 'S39')); for (const p of run.picks) { assert.equal(p.horizon, 60); assert.ok(p.why.some((w) => /Piotroski/.test(w))); }
  assert.ok(run.picks.every((p) => rows.find((r) => r.sym === p.sym)!.piotroski! >= 7));
});
test('steady uptrend: only the calm and rising, never a HIGH risk grade', () => {
  const rows = universe(); rows[39] = { ...rows[39], risk_lvl: 'HIGH' };
  const run = runEngine('LVT', rows, buildCtx(rows), 'd');
  assert.ok(!run.picks.some((p) => p.sym === 'S39')); for (const p of run.picks) assert.equal(p.horizon, 40);
});
test('a name that would need a stop wider than the engine allows is skipped and counted', () => {
  const rows = universe().map((r) => ({ ...r, atr_pct: 9 })); const run = runEngine('MOM', rows, buildCtx(rows), 'd');
  assert.equal(run.picks.length, 0); assert.ok(run.funnel.skippedWideStop > 0);
});
test('sector cap: at most two picks from one sector in an engine', () => {
  const rows = universe().map((r) => ({ ...r, sector: 'Same' })); const run = runEngine('MOM', rows, buildCtx(rows), 'd'); assert.ok(run.picks.length <= 2);
});
test('three engines at most, with a stated theory, rules and horizon each', () => {
  assert.equal(ENGINES.length, 3); for (const e of ENGINES) { assert.ok(e.theory.length > 10 && e.how.length === 3 && e.horizon > 0); assert.ok(!/guarantee|sure[- ]?shot|risk[- ]free|will (rise|fall)|win(ning)? probability/i.test(e.how.join(' ') + e.line)); }
});

// ---- tracker ----
const D = 86400; const T0 = 1_760_000_000;
const bar = (i: number, o: number, h: number, l: number, c: number, forming = false): Bar => ({ t: T0 + i * D, o, h, l, c, forming });
const paper = (o: Partial<Paper> = {}): Paper => ({ id: 'p', sym: 'X', engine: 'MOM', asOf: 'd', ref: 100, stop: 95, horizon: 3, qty: 100, takenAt: T0 + 0.5 * D, ...o });
test('tracker: no bars means waiting, not flat; no later session means pending', () => {
  assert.equal(evaluatePaper(paper(), null, null, 0.25).status, 'waiting'); assert.equal(evaluatePaper(paper(), null, null, 0.25).pnl, null);
  assert.equal(evaluatePaper(paper({ takenAt: T0 + 9 * D }), [bar(0, 100, 101, 99, 100)], null, 0.25).status, 'pending');
});
test('tracker: fills at the first open after it was taken, never at the past', () => {
  const v = evaluatePaper(paper(), [bar(0, 90, 120, 80, 100), bar(1, 101, 103, 100, 102)], null, 0);   // bar 0 began before takenAt: its prices are not available to the trader
  assert.equal(v.status, 'open'); assert.equal(v.entryT, T0 + D); assert.ok(Math.abs(v.entry! - 101.101) < 0.01);
});
test('tracker: a gap above 2% or an open at the stop is skipped with its reason', () => {
  assert.equal(evaluatePaper(paper(), [bar(1, 103, 104, 102, 103)], null, 0).status, 'skipped');
  assert.match(evaluatePaper(paper(), [bar(1, 94, 96, 93, 95)], null, 0).skipReason!, /at or below the stop/);
});
test('tracker: stop beats everything on a bar that spans it, and a gap through exits at the open', () => {
  const v = evaluatePaper(paper(), [bar(1, 100, 130, 94, 120)], null, 0); assert.equal(v.status, 'closed'); assert.equal(v.exit, 95); assert.equal(v.reason, 'Stop');
  const g = evaluatePaper(paper(), [bar(1, 100, 101, 99, 100), bar(2, 90, 92, 88, 91)], null, 0); assert.equal(g.exit, 90); assert.equal(g.stopGap, true); assert.ok(g.r! < -1);
});
test('tracker: time exit at the close of session N, costs and slippage are charged, R is net', () => {
  const bars = [bar(1, 100, 104, 99, 102), bar(2, 102, 106, 101, 105), bar(3, 105, 109, 104, 108)];
  const v = evaluatePaper(paper(), bars, null, 0.25); assert.equal(v.status, 'closed'); assert.equal(v.reason, 'Time exit after 3 sessions'); assert.equal(v.sessions, 3); assert.equal(v.exit, 108);
  const fill = 100 * 1.001, gross = (108 - fill) * 100, cost = 0.0025 * fill * 100 + 0.001 * 108 * 100;
  assert.ok(Math.abs(v.pnl! - (gross - cost)) < 0.02); assert.ok(v.r! > 0 && v.r! < gross / ((fill - 95) * 100));
});
test('tracker: an open position marks to the live price only when it is newer than the last bar', () => {
  const bars = [bar(1, 100, 104, 99, 102), bar(2, 102, 106, 101, 105, true)];
  const live = evaluatePaper(paper(), bars, { px: 107, t: T0 + 2 * D + 3600 }, 0); assert.equal(live.status, 'open'); assert.equal(live.markKind, 'live'); assert.equal(live.mark, 107);
  const stale = evaluatePaper(paper(), [bar(1, 100, 104, 99, 102)], { px: 50, t: T0 }, 0); assert.equal(stale.markKind, 'close'); assert.equal(stale.mark, 102);
  assert.equal(evaluatePaper(paper({ horizon: 2 }), bars, null, 0).status, 'open');          // a forming bar never completes a time exit
});
test('tracker: a forming bar whose low breaches the stop does stop the position out', () => {
  assert.equal(evaluatePaper(paper(), [bar(1, 100, 101, 99, 100), bar(2, 99, 100, 94, 96, true)], null, 0).status, 'closed');
});
test('summary: expectancy is withheld until thirty closed trades', () => {
  const closed = Array.from({ length: 5 }, (_, i) => ({ id: 'c' + i, status: 'closed', r: i % 2 ? -1 : 2, pnl: 100, sessions: 3, left: 0, mark: 1, markKind: 'close', pct: 1 }) as never);
  const s = summarize(closed); assert.equal(s.closed, 5); assert.equal(s.avgR, null); assert.equal(s.enough, false); assert.equal(s.totalR, 4);
});

import { parseYahoo } from '../worker.js';
test('worker: bars with a missing field are dropped, a live session is marked forming, the live price is kept', () => {
  const day = (d: number) => Date.UTC(2026, 9, d, 3, 45) / 1000;           // 09:15 IST
  const mk = (n: number) => Array.from({ length: n }, (_, i) => day(5 + i));
  const res = { timestamp: mk(8), indicators: { quote: [{ open: [1, 1, 1, 1, 1, 1, 1, 1], high: [2, 2, 2, 2, 2, 2, 2, 2], low: [1, 1, 1, 1, 1, 1, 1, 1], close: [1, 1, null, 1, 1, 1, 1, 1.5] }] }, meta: { regularMarketPrice: 1.567, regularMarketTime: day(12) + 3600 } };
  const during = parseYahoo(res, Date.UTC(2026, 9, 12, 7, 0));               // 12:30 IST on the last bar's day
  assert.equal(during!.t.length, 7); assert.equal(during!.forming, true); assert.deepEqual(during!.live, { px: 1.57, t: day(12) + 3600 });
  assert.equal(parseYahoo(res, Date.UTC(2026, 9, 12, 11, 0))!.forming, false);     // 16:30 IST: closed
  assert.equal(parseYahoo({ timestamp: [1], indicators: { quote: [{}] } }), null);
  assert.equal(parseYahoo(null), null);
});
