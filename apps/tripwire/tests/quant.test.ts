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

import { sliceRange, monthly, downsample, stats, geometry, nearest, dateLabel, type Pt } from '../src/chart.ts';
const DAYS = 86400; const START = Date.UTC(2014, 0, 1, 4) / 1000;
const series = (n: number, f: (i: number) => number): Pt[] => Array.from({ length: n }, (_, i) => ({ t: START + i * DAYS, c: f(i) }));
test('chart: a range is the window ending at the last point, and says when the history is shorter', () => {
  const s = series(4000, (i) => 100 + i); const y1 = sliceRange(s, '1Y'); assert.ok(y1.pts.length >= 365 && y1.pts.length <= 367); assert.ok(y1.covers);
  assert.equal(sliceRange(s, 'Max').pts.length, 4000);
  const short = series(800, (i) => 100 + i); assert.equal(sliceRange(short, '10Y').covers, false); assert.equal(sliceRange(short, '10Y').pts.length, 800);
  assert.deepEqual(sliceRange([], '1Y'), { pts: [], covers: false });
});
test('chart: monthly keeps the last close of each calendar month, including the unfinished one', () => {
  const m = monthly(series(90, (i) => i)); assert.equal(m.length, 3);
  assert.equal(m[0].c, 30);                            // 1 Jan + 30 days = 31 Jan
  assert.equal(m[2].c, 89);
});
test('chart: downsampling keeps the endpoints and never loses a peak or a trough', () => {
  const s = series(5000, (i) => 100 + Math.sin(i / 40) * 10); s[2503] = { ...s[2503], c: 500 }; s[1201] = { ...s[1201], c: 1 };
  const d = downsample(s, 600); assert.ok(d.length <= 800); assert.equal(d[0], s[0]); assert.equal(d[d.length - 1], s[4999]);
  assert.equal(Math.max(...d.map((p) => p.c)), 500); assert.equal(Math.min(...d.map((p) => p.c)), 1);
  assert.ok(d.every((p, i) => !i || p.t > d[i - 1].t));      // still in time order
  assert.equal(downsample(s.slice(0, 10), 600).length, 10);
});
test('chart: the period return, high, low and CAGR are exact', () => {
  const s = series(3653, (i) => 100 * Math.pow(2, i / 3652.5)); const st = stats(s)!;
  assert.ok(Math.abs(st.ret - 100) < 0.2); assert.ok(Math.abs(st.cagr! - 7.18) < 0.1); assert.equal(st.hi.c, s[3652].c); assert.equal(st.lo.c, 100);
  assert.equal(stats(series(400, (i) => i + 1))!.cagr, null);   // under two years: no annualised figure
  assert.equal(stats(series(1, () => 1)), null);
});
test('chart: geometry is time-proportional, stays inside its box, and log differs from linear', () => {
  const s = series(2000, (i) => 100 * Math.pow(1.001, i)); const lin = geometry(s, false)!, log = geometry(s, true)!;
  assert.ok(lin.ys.every((y) => y >= 12 - 1e-9 && y <= 288 + 1e-9)); assert.equal(lin.xs[0], 0); assert.ok(Math.abs(lin.xs[lin.xs.length - 1] - 1000) < 1e-9);
  assert.ok(Math.abs(log.ys[1000] - (12 + 276 / 2)) < 1);                // exponential growth is a straight line on a log scale: the midpoint sits mid-height
  assert.ok(Math.abs(lin.ys[1000] - log.ys[1000]) > 20);
  const flat = geometry(series(10, () => 50), false)!; assert.ok(flat.ys.every((y) => Number.isFinite(y)));
  assert.equal(geometry(series(1, () => 1), false), null);
  const gap: Pt[] = [{ t: 0, c: 1 }, { t: 100, c: 2 }, { t: 1000, c: 3 }]; assert.ok(Math.abs(geometry(gap, false)!.xs[1] - 100) < 1e-9);   // a gap in time is a gap on the page
});
test('chart: scrubbing finds the closest point and clamps at the edges', () => {
  const s = series(11, (i) => i); assert.equal(nearest(s, 0), 0); assert.equal(nearest(s, 1), 10); assert.equal(nearest(s, 0.5), 5); assert.equal(nearest(s, -3), 0); assert.equal(nearest(s, 9), 10); assert.equal(nearest([], 0.5), -1);
  assert.equal(dateLabel(Date.UTC(2026, 9, 23, 4) / 1000), '23 Oct 2026'); assert.equal(dateLabel(Date.UTC(2026, 9, 23, 4) / 1000, true), 'Oct 2026');
});

import { parseChart } from '../worker.js';
test('worker: a long history keeps only days with a real close, and refuses a thin one', () => {
  const ts = Array.from({ length: 60 }, (_, i) => 1_500_000_000 + i * 86400); const cl = ts.map((_, i) => (i === 5 ? null : 100 + i));
  const p = parseChart({ timestamp: ts, indicators: { quote: [{ close: cl }] } })!; assert.equal(p.t.length, 59); assert.ok(!p.c.includes(0));
  assert.equal(parseChart({ timestamp: ts.slice(0, 10), indicators: { quote: [{ close: cl.slice(0, 10) }] } }), null); assert.equal(parseChart(undefined), null);
});

import { emptyLedger, record, evaluateLedger, summarizeLedger, takenAtFor, pickId, MIN_TRADES } from '../src/ledger.ts';
import type { Run } from '../src/quant.ts';
const run = (id: string, syms: string[]): Run => ({ id: id as never, picks: syms.map((s, i) => ({ engine: id as never, sym: s, name: s, sector: 'T', asOf: '2026-10-23', ref: 100, stop: 95, stopPct: 5, horizon: 3, score: 90 - i, rank: i + 1, why: [] })), funnel: { universe: 988, eligible: 750, passed: 30, skippedWideStop: 1, picked: syms.length } });
test('ledger: a night is recorded once, in order, with its empty engines too', () => {
  let l = emptyLedger('2026-10-23T18:00:00Z'); const a = record(l, [run('MOM', ['A', 'B']), run('QLT', [])], '2026-10-23', 'n1'); l = a.ledger;
  assert.equal(a.added, 2); assert.equal(l.days.length, 1); assert.equal(l.days[0].engines.QLT.picked, 0);        // a night with no pick is still a record
  assert.equal(record(l, [run('MOM', ['A', 'B'])], '2026-10-23', 'n2').skipped, 'already recorded');
  assert.equal(record(l, [run('MOM', ['C'])], '2026-10-22', 'n2').skipped, 'stale data'); assert.equal(record(l, [], 'garbage', 'n').skipped, 'stale data');
  const b = record(l, [run('MOM', ['C'])], '2026-10-26', 'n3'); assert.equal(b.ledger.picks.length, 3); assert.equal(l.picks.length, 2);   // the old ledger is not mutated
});
test('ledger: picks are filled after the close of their day, and a final outcome is never recomputed', () => {
  const l0 = record(emptyLedger('x'), [run('MOM', ['A', 'B', 'C'])], '2026-10-23', 'n').ledger; const t0 = takenAtFor('2026-10-23');
  assert.equal(new Date(t0 * 1000).toISOString(), '2026-10-23T10:00:00.000Z');
  const D = 86400; const bar = (i: number, o: number, h: number, lo: number, c: number): Bar => ({ t: t0 + i * D - 6 * 3600, o, h, l: lo, c });   // 09:15 IST each following day
  const bars = { A: [bar(1, 100, 104, 99, 103), bar(2, 103, 105, 101, 104), bar(3, 104, 108, 103, 107)], B: [bar(1, 100, 101, 90, 92)], C: null };
  const nifty = [bar(1, 1000, 1010, 995, 1005), bar(2, 1005, 1012, 1000, 1010), bar(3, 1010, 1020, 1008, 1015)];
  const l1 = evaluateLedger(l0, bars, nifty, 'n1');
  assert.equal(l1.outcomes[pickId('2026-10-23', 'MOM', 'A')].status, 'closed'); assert.equal(l1.outcomes[pickId('2026-10-23', 'MOM', 'A')].reason, 'Time exit after 3 sessions');
  assert.equal(l1.outcomes[pickId('2026-10-23', 'MOM', 'B')].reason, 'Stop'); assert.equal(l1.outcomes[pickId('2026-10-23', 'MOM', 'C')].status, 'pending');
  const a = l1.outcomes[pickId('2026-10-23', 'MOM', 'A')]; assert.equal(a.niftyPct, Math.round(((1015 / 1000) - 1) * 10000) / 100); assert.equal(a.final, true);
  const l2 = evaluateLedger(l1, { A: [bar(1, 1, 1, 1, 1)], B: null, C: bars.A }, null, 'n2');
  assert.deepEqual(l2.outcomes[pickId('2026-10-23', 'MOM', 'A')], a);           // final outcomes are never rewritten
  assert.equal(l2.outcomes[pickId('2026-10-23', 'MOM', 'C')].status, 'closed');  // a pending one is filled once its bars arrive
});
test('ledger: the summary withholds average R, win rate and excess until thirty trades have closed', () => {
  let l = emptyLedger('x');
  const picks = Array.from({ length: 31 }, (_, i) => ({ id: 'p' + i, engine: 'MOM', sym: 'S' + i, asOf: 'd', ref: 100, stop: 95, horizon: 3, score: 1, rank: 1 }));
  l = { ...l, days: [{ asOf: 'd', recorded: 'n', engines: {} }], picks, outcomes: Object.fromEntries(picks.slice(0, 29).map((p, i) => [p.id, { status: 'closed', final: true, r: i % 2 ? -1 : 1.5, pct: 2, niftyPct: 1 } as never])) };
  let s = summarizeLedger(l); assert.equal(s.all.closed, 29); assert.equal(s.all.avgR, null); assert.equal(s.all.winRate, null); assert.equal(s.all.avgExcess, null); assert.equal(s.all.pending, 2);
  l.outcomes[picks[29].id] = { status: 'closed', final: true, r: 1, pct: 2, niftyPct: 1 } as never; s = summarizeLedger(l);
  assert.equal(s.all.closed, MIN_TRADES); assert.ok(s.all.avgR !== null && s.all.winRate !== null && s.all.avgExcess === 1);
  assert.equal(s.engines.find((e) => e.engine === 'QLT')!.picks, 0);
});

import { compareSeries, geometryPair } from '../src/chart.ts';
test('compare: both lines are indexed to 100 at the first Nifty day, a holiday carries forward, early days are reported', () => {
  const pts: Pt[] = [{ t: 0, c: 50, n: null }, { t: 1, c: 100, n: 1000 }, { t: 2, c: 120, n: null }, { t: 3, c: 150, n: 1100 }];
  const c = compareSeries(pts)!; assert.equal(c.trimmed, true); assert.equal(c.a[0].c, 100); assert.equal(c.b[0].c, 100); assert.equal(c.a.length, 3);
  assert.equal(c.b[1].c, 100);                         // no Nifty figure on day 2: the previous close is carried, not zero
  assert.ok(Math.abs(c.stock - 50) < 1e-9 && Math.abs(c.nifty - 10) < 1e-9 && Math.abs(c.diff - 40) < 1e-9);
  assert.equal(compareSeries([{ t: 0, c: 1 }, { t: 1, c: 2 }]), null);       // no Nifty at all: nothing to compare
  assert.equal(compareSeries([{ t: 0, c: 1, n: 5 }]), null);
});
test('compare: the pair shares one scale and one time axis', () => {
  const a: Pt[] = [{ t: 0, c: 100 }, { t: 10, c: 300 }], b: Pt[] = [{ t: 0, c: 100 }, { t: 10, c: 150 }];
  const g = geometryPair(a, b, false)!; assert.ok(g.ysA[1] < g.ysB[1]);         // 300 plots higher (smaller y) than 150
  assert.equal(g.ysA[0], g.ysB[0]); assert.equal(g.xs[1], 1000); assert.ok(g.ysA.every((y) => y >= 12 - 1e-9 && y <= 288 + 1e-9));
  assert.equal(geometryPair(a, b.slice(0, 1), false), null);
});
test('worker: the Nifty is matched to the stock by Indian calendar day, never filled from another day', () => {
  const ts = Array.from({ length: 40 }, (_, i) => 1_600_000_000 + i * 86400); const cl = ts.map((_, i) => 100 + i);
  const nifty = { timestamp: ts.filter((_, i) => i !== 7).map((x) => x + 3600), indicators: { quote: [{ close: ts.filter((_, i) => i !== 7).map((_, i) => 10000 + i) }] } };
  const p = parseChart({ timestamp: ts, indicators: { quote: [{ close: cl }] } }, nifty)!; assert.equal(p.n!.length, 40); assert.equal(p.n![7], null); assert.equal(p.n![8], 10007);
  assert.equal(parseChart({ timestamp: ts, indicators: { quote: [{ close: cl }] } }, undefined)!.n, null);
});

import { trendOf, filterRows, NO_FILTER, type Row } from '../src/screen.ts';
test('trend tag: Alpha\'s uptrend rule, its mirror for down, mixed otherwise, untagged when a figure is missing', () => {
  assert.equal(trendOf({ price: 120, sma50: 110, sma200: 100 }).trend, 'up');
  assert.equal(trendOf({ price: 80, sma50: 90, sma200: 100 }).trend, 'down');
  assert.equal(trendOf({ price: 105, sma50: 110, sma200: 100 }).trend, 'mixed');     // below the 50-day but the averages are rising
  assert.equal(trendOf({ price: 110, sma50: 110, sma200: 100 }).trend, 'mixed');     // strict inequalities, as on the site
  assert.equal(trendOf({ price: 100, sma50: 90, sma200: 95 }).trend, 'mixed');
  assert.equal(trendOf({ price: 120, sma50: null, sma200: 100 }).trend, null); assert.equal(trendOf({ price: NaN, sma50: 1, sma200: 1 }).trend, null);
  assert.match(trendOf({ price: 120, sma50: 110, sma200: 100 }).detail, /50-day above the 200-day/);
});
test('trend filter: matches the tag, and a name with no averages is counted as unmeasured, not as mixed', () => {
  const rows: Row[] = [{ sym: 'U', name: 'U', price: 120, sma50: 110, sma200: 100 }, { sym: 'D', name: 'D', price: 80, sma50: 90, sma200: 100 }, { sym: 'M', name: 'M', price: 105, sma50: 110, sma200: 100 }, { sym: 'X', name: 'X', price: 5 }];
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, trend: 'up' }).rows.map((r) => r.sym), ['U']);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, trend: 'down' }).rows.map((r) => r.sym), ['D']);
  const mixed = filterRows(rows, { ...NO_FILTER, trend: 'mixed' }); assert.deepEqual(mixed.rows.map((r) => r.sym), ['M']); assert.equal(mixed.unmeasured, 1);
  assert.equal(filterRows(rows, { ...NO_FILTER, trend: undefined } as never).rows.length, 4);        // a saved screen from before the tag still works
});

import { parseIntraday } from '../worker.js';
test('worker: an intraday print is live only when it is under 25 minutes old; thin or priceless data is refused', () => {
  const base = 1_761_000_000; const ts = Array.from({ length: 10 }, (_, i) => base + i * 300);
  const res = { timestamp: ts, indicators: { quote: [{ close: ts.map((_, i) => (i === 3 ? null : 100 + i)) }] }, meta: { regularMarketPrice: 109.456, regularMarketTime: ts[9], chartPreviousClose: 99.5 } };
  const live = parseIntraday(res, (ts[9] + 600) * 1000)!; assert.equal(live.live, true); assert.equal(live.px, 109.46); assert.equal(live.prev, 99.5); assert.equal(live.t.length, 9);
  assert.equal(parseIntraday(res, (ts[9] + 3600) * 1000)!.live, false);          // an hour old: the market is not trading
  assert.equal(parseIntraday({ ...res, meta: { regularMarketPrice: 5 } }, 0), null);   // no previous close: no day change can be stated
  assert.equal(parseIntraday({ timestamp: [1], indicators: { quote: [{ close: [1] }] }, meta: res.meta }, 0), null); assert.equal(parseIntraday(undefined), null);
});

import { tvUrl, tvSymbol, tvIndexUrl } from '../src/tv.ts';
import { sessionNow } from '../src/market.ts';
import { pnlAt, rLevel } from '../src/tracker.ts';
test('tradingview: NSE symbols, the & and - spellings, and the index links', () => {
  assert.equal(tvUrl('TCS'), 'https://www.tradingview.com/chart/?symbol=NSE%3ATCS');
  assert.equal(tvSymbol('M&M'), 'M_M'); assert.equal(tvSymbol('bajaj-auto'), 'BAJAJ_AUTO');
  assert.ok(tvUrl('M&M').includes('NSE%3AM_M') && !tvUrl('M&M').includes('&M'));
  assert.ok(tvIndexUrl('NIFTY').includes('NSE%3ANIFTY') && tvIndexUrl('VIX').includes('INDIAVIX'));
});
test('session: the Indian clock, weekends and the next open; live prints override the clock', () => {
  const at = (iso: string) => Date.parse(iso);            // times below are UTC; IST = UTC + 5:30
  assert.equal(sessionNow(at('2026-10-26T05:00:00Z')).phase, 'open');                    // Mon 10:30 IST
  assert.match(sessionNow(at('2026-10-26T05:00:00Z')).detail, /closes in 5h 00m/);
  assert.equal(sessionNow(at('2026-10-26T03:40:00Z')).phase, 'pre');                     // Mon 09:10 IST
  const sat = sessionNow(at('2026-10-24T06:00:00Z')); assert.equal(sat.phase, 'closed'); assert.match(sat.detail, /Mon 9:15/);
  assert.match(sessionNow(at('2026-10-26T11:00:00Z')).detail, /tomorrow 9:15/);          // Mon 16:30 IST
  assert.match(sessionNow(at('2026-10-26T01:00:00Z')).detail, /opens today 9:15/);       // Mon 06:30 IST
  assert.equal(sessionNow(at('2026-10-26T05:00:00Z'), false).label, 'No live prints');    // clock says open, the feed says quiet: a holiday
  assert.equal(sessionNow(at('2026-10-24T06:00:00Z'), true).phase, 'open');
});
test('what-if: the slider arithmetic equals the tracker headline, and the ladder is in risk units', () => {
  const p: Paper = { id: 'a', sym: 'X', engine: 'MOM', asOf: 'd', ref: 100, stop: 95, horizon: 20, qty: 100, takenAt: T0 + 0.5 * D };
  const v = evaluatePaper(p, [bar(1, 100, 104, 99, 102), bar(2, 102, 106, 101, 105)], null, 0.25);
  const w = pnlAt(p, v.entry!, v.mark!, 0.25); assert.equal(w.pnl, v.pnl); assert.equal(w.r, v.r); assert.equal(w.pct, v.pct);
  assert.equal(pnlAt(p, 100, 95, 0).r, -1.02);                                           // at the stop: -1R plus the 0.1 percent slippage on the way out
  assert.ok(pnlAt(p, 100, 110, 0.25).pnl < 1000);                                        // costs always reduce it
  assert.equal(rLevel(95, 100, 95), -1); assert.equal(rLevel(100, 100, 95), 0); assert.equal(rLevel(105, 100, 95), 1); assert.equal(rLevel(100, 95, 95), null);
});
