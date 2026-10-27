import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePanel, gunzip, type LabPanel } from '../src/lab/panel.ts';
import { makeCtx, feature } from '../src/lab/features.ts';
import { runStrategy, stats, strategyKey, matchesNow, isHoldout, STEP, SLIP, COST_RT, type Strategy } from '../src/lab/engine.ts';
import { judge, tRequired, zQuantile } from '../src/lab/verdict.ts';

const panelOf = (closes: (j: number, i: number) => number, N = 40, T = 900, first: (j: number) => number = () => 0): LabPanel => {
  const C = new Float64Array(N * T).fill(NaN); const dates: string[] = [];
  for (let i = 0; i < T; i++) { const d = new Date(Date.UTC(2020, 0, 1) + i * 86400000); dates.push(d.toISOString().slice(0, 10)); }
  for (let j = 0; j < N; j++) for (let i = first(j); i < T; i++) C[j * T + i] = closes(j, i);
  return { built: 'x', dates, syms: Array.from({ length: N }, (_, j) => `S${j}`), T, N, first: Array.from({ length: N }, (_, j) => first(j)), C };
};
const noise = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 4294967296 - 0.5); }; };
const walk = (N: number, T: number, seed: number, drift: (j: number) => number = () => 0) => {
  const r = noise(seed); const tab = Array.from({ length: N }, (_, j) => { const a = [100 + j]; for (let i = 1; i < T; i++) a.push(a[i - 1] * (1 + drift(j) + r() * 0.03)); return a; }); return (j: number, i: number) => tab[j][i];
};
const strat = (o: Partial<Strategy> = {}): Strategy => ({ conds: [{ m: 'r3m', op: 'gte', v: 0 }], rankBy: 'r3m', rankDir: 'desc', positions: 5, horizon: 20, stopPct: 8, ...o });

test('lab panel: the golden file written by the Python side decodes to the figures it was built from', async () => {
  const meta = JSON.parse(readFileSync(new URL('./fixtures/lab_panel_golden.json', import.meta.url), 'utf8')); const b = readFileSync(new URL('./fixtures/lab_panel_golden.bin.gz', import.meta.url));
  const p = decodePanel(meta, await gunzip(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
  assert.deepEqual([p.N, p.T], [2, 4]);
  assert.deepEqual([...p.C.slice(0, 4)], [10, 10.5, 10.25, 11], 'AAA');
  assert.ok(Number.isNaN(p.C[4]), 'BBB is absent before it listed'); assert.deepEqual([...p.C.slice(5, 8)], [20.25, 20.5, 20.5], 'BBB, with the flat session carried');
});

test('features: returns, averages, highs and lows are read from closes and are null until the history exists', () => {
  const p = panelOf((j, i) => 100 * Math.pow(1.001, i), 3, 400, (j) => (j === 2 ? 300 : 0)); const c = makeCtx(p);
  const near = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
  near(feature(c, 'r1m', 0, 399), (Math.pow(1.001, 21) - 1) * 100); near(feature(c, 'r1y', 0, 399), (Math.pow(1.001, 252) - 1) * 100);
  near(feature(c, 'from_high', 0, 399), 0); near(feature(c, 'from_low', 0, 399), (Math.pow(1.001, 251) - 1) * 100);
  assert.ok((feature(c, 'dist50', 0, 399) ?? 0) > 0, 'a steady riser sits above its 50-day');
  assert.equal(feature(c, 'r1y', 2, 399), null, 'a name listed 99 sessions ago has no year');
  assert.equal(feature(c, 'r1w', 0, 3), null);
  const up = feature(c, 'rsi', 0, 399); assert.equal(up, 100, 'a series that only rises has an RSI of 100');
  const flat = makeCtx(panelOf(() => 50, 2, 300)); assert.equal(feature(flat, 'rsi', 0, 299), 50, 'no movement is neutral');
});

test('engine: on flat prices every trade loses exactly the costs and the exit slippage, and is a time exit', async () => {
  const p = panelOf(() => 100, 10, 700); const c = makeCtx(p);
  const r = await runStrategy(c, strat({ conds: [{ m: 'dist200', op: 'gte', v: -1 }], rankBy: 'dist200' }));
  assert.ok(r.trades.length > 10);
  const want = (1 - SLIP) / (1 + SLIP) - 1 - COST_RT;
  for (const t of r.trades) { assert.equal(t.why, 'time'); assert.ok(Math.abs(t.ret - want) < 1e-9, `${t.ret} vs ${want}`); assert.equal(t.exitI - t.entryI, 20); }
});

test('engine: the ladder is stop first, half at Target 1 then break-even, the rest at Target 2; a time exit takes what is left', async () => {
  const p = panelOf(() => 100, 6, 400); const T = p.T; const start = 254;          // the first rebalance is day 253, so a rule that fires then enters on 254
  for (let i = 0; i < T; i++) p.C[i] = 100 * (1 + 0.0001 * Math.min(i, 253));   // name 0 drifts up so it ranks first; the rest are flat
  const fill = p.C[start] * (1 + SLIP), risk = fill * 0.08, t1 = fill + 1.5 * risk;
  p.C[start + 1] = fill * 1.02; p.C[start + 2] = t1 * 1.001; p.C[start + 3] = fill * 1.01; p.C[start + 4] = fill * 0.9;
  for (let i = start + 5; i < T; i++) p.C[i] = fill * 0.9;
  const r = await runStrategy(makeCtx(p), strat({ conds: [{ m: 'r1w', op: 'gte', v: -50 }], rankBy: 'r1w', positions: 1, stopPct: 8 }));
  const tr = r.trades.find((t) => t.j === 0 && t.entryI === start)!; assert.ok(tr, 'the scripted entry was taken');
  assert.equal(tr.t1, true); assert.equal(tr.why, 'break-even', 'after Target 1 the stop sits at the fill, so the fall is a break-even stop');
  const want = 0.5 * (t1 / fill - 1) + 0.5 * ((fill * 0.9) * (1 - SLIP) / fill - 1) - COST_RT;
  assert.ok(Math.abs(tr.ret - want) < 1e-9, `${tr.ret} vs ${want}`);
  assert.equal(tr.exitI, start + 4, 'the stop is seen on the close that falls through it');
});

test('engine: no look-ahead. Changing prices after day D changes nothing about a trade that was entered a horizon earlier', async () => {
  const f = walk(40, 900, 7, (j) => (j < 8 ? 0.0006 : 0)); const a = await runStrategy(makeCtx(panelOf(f)), strat());
  const D = 700; const g = (j: number, i: number) => (i > D ? 1e9 * (1 + (j % 3)) : f(j, i)); const b = await runStrategy(makeCtx(panelOf(g)), strat());
  const early = (r: { trades: { entryI: number; exitI: number; sym: string; ret: number }[] }) => r.trades.filter((t) => t.exitI < D).map((t) => `${t.sym}:${t.entryI}:${t.exitI}:${t.ret.toFixed(8)}`);
  assert.deepEqual(early(a), early(b)); assert.ok(early(a).length > 20);
});

test('engine: never more positions than allowed, never the same name twice at once, an unlisted name is never bought before it has the history', async () => {
  const f = walk(40, 900, 3, (j) => (j % 2 ? 0.0004 : 0)); const p = panelOf(f, 40, 900, (j) => (j >= 30 ? 600 : 0)); const r = await runStrategy(makeCtx(p), strat({ positions: 3 }));
  const live = new Map<number, number>(); let maxOpen = 0;
  for (const t of [...r.trades].sort((x, y) => x.entryI - y.entryI)) { for (const [k, x] of live) if (x < t.entryI) live.delete(k); assert.ok(!live.has(t.j), 'the same name twice'); live.set(t.j, t.exitI); maxOpen = Math.max(maxOpen, live.size); assert.ok(t.entryI >= p.first[t.j] + 63, 'bought with no history'); }
  assert.ok(maxOpen <= 3, `${maxOpen} positions at once`);
});

test('verdict: the bar rises with every variant tried (2.0, then 2.7 after eight), and a rule that worked then stopped is not called supported', () => {
  assert.ok(Math.abs(zQuantile(0.975) - 1.959964) < 1e-4); assert.equal(tRequired(1), 2); assert.equal(tRequired(8), 2.73); assert.ok(tRequired(50) > tRequired(8));
  const good = { n: 200, meanNet: 0.01, meanExcess: 0.012, t: 3.1, months: 80 }, weak = { n: 60, meanNet: -0.002, meanExcess: -0.003, t: -0.4, months: 30 };
  assert.equal(judge(good, good, good, 1).word, 'supported');
  assert.equal(judge(good, good, weak, 1).word, 'worked then stopped');
  assert.equal(judge({ ...good, t: 2.2 }, good, good, 8).word, 'not supported', 't of 2.2 clears 2.0 but not the 2.73 needed after eight variants');
  assert.equal(judge({ ...good, n: 12 }, good, good, 1).word, 'too few trades');
});

test('lab honesty: random walks are not supported across seeds, even choosing the best of several variants honestly counted', async () => {
  let supported = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const c = makeCtx(panelOf(walk(40, 1500, seed * 11), 40, 1500)); const r = await runStrategy(c, strat());
    const all = stats(r.trades), dev = stats(r.trades, (t) => !isHoldout(t)), hold = stats(r.trades, isHoldout);
    if (judge(all, dev, hold, 1).word === 'supported') supported++;
  }
  assert.ok(supported <= 1, `${supported} of 6 random walks were called supported`);
});

test('lab power: a planted momentum effect is found and called supported', async () => {
  const r = noise(21); const N = 40, T = 1500; const drift = new Float64Array(N).fill(0);       // a slow regime per name that persists: the winners keep winning
  const tab = Array.from({ length: N }, () => [100]); for (let i = 1; i < T; i++) for (let j = 0; j < N; j++) { if (i % 120 === 1) drift[j] = (r() * 2) * 0.004; tab[j].push(tab[j][i - 1] * (1 + drift[j] + r() * 0.02)); }
  const p = panelOf((j, i) => tab[j][i], N, T); const c = makeCtx(p); const res = await runStrategy(c, strat({ horizon: 20, stopPct: 12 }));
  const all = stats(res.trades), dev = stats(res.trades, (t) => !isHoldout(t)), hold = stats(res.trades, isHoldout);
  assert.ok((all.meanExcess ?? 0) > 0 && (all.t ?? 0) > 2, `excess ${all.meanExcess} t ${all.t}`);
  assert.equal(judge(all, dev, hold, 1).word, 'supported');
});

test('lab keys and matches: the same rule is one variant however its conditions are ordered, and today\'s matches obey the rule', async () => {
  const a = strat({ conds: [{ m: 'r3m', op: 'gte', v: 5 }, { m: 'rsi', op: 'lte', v: 70 }] }), b = strat({ conds: [{ m: 'rsi', op: 'lte', v: 70 }, { m: 'r3m', op: 'gte', v: 5 }] });
  assert.equal(strategyKey(a), strategyKey(b)); assert.notEqual(strategyKey(a), strategyKey({ ...a, stopPct: 5 }));
  const c = makeCtx(panelOf(walk(40, 600, 9, (j) => (j < 10 ? 0.002 : 0)), 40, 600)); const m = matchesNow(c, strat({ conds: [{ m: 'r3m', op: 'gte', v: 8 }] }));
  assert.ok(m.every((x) => (feature(c, 'r3m', Number(x.sym.slice(1)), 599) ?? -1) >= 8)); assert.deepEqual(m.map((x) => x.rank), [...m.map((x) => x.rank)].sort((x, y) => y - x)); void STEP;
});

import { readLab, writeLab, recordRun, PRESETS, DEFAULT_STRATEGY } from '../src/lab/store.ts';
import { LAB_KEYS } from '../src/lab/features.ts';
import { metricOf } from '../src/screener.ts';
test('lab store: the count of different rules rises only for a new one, survives a reload, and a broken file starts clean', () => {
  const mem: Record<string, string> = {}; const st = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
  let s = readLab(st); assert.deepEqual(s, { draft: null, tried: [] });
  let r = recordRun(s, DEFAULT_STRATEGY); assert.equal(r.tried, 1); writeLab(st, r.state);
  r = recordRun(readLab(st), DEFAULT_STRATEGY); assert.equal(r.tried, 1, 'the same rule again is not a new variant');
  r = recordRun(r.state, { ...DEFAULT_STRATEGY, stopPct: 5 }); assert.equal(r.tried, 2);
  mem['tripwire:lab:v1'] = '{not json'; assert.deepEqual(readLab(st), { draft: null, tried: [] });
  assert.deepEqual(readLab(null), { draft: null, tried: [] });
});
test('lab presets and keys: every figure a preset or the Lab uses exists in Discover with a label, so a condition reads the same in both', () => {
  for (const k of LAB_KEYS) assert.ok(metricOf(k), k);
  for (const p of PRESETS) for (const c of [...p.s.conds.map((x) => x.m), p.s.rankBy]) assert.ok(LAB_KEYS.includes(c), `${p.id}: ${c} is not a price-only figure`);
});

test('engine: the equity curve ends exactly where the trades say it should (the sum of every trade\'s net return over the number of slots)', async () => {
  const r = await runStrategy(makeCtx(panelOf(walk(40, 1200, 5, (j) => (j < 10 ? 0.001 : 0)), 40, 1200)), strat({ positions: 5 }));
  const want = 1 + r.trades.reduce((a, t) => a + t.ret, 0) / 5; const got = r.equity[r.equity.length - 1];
  assert.ok(Math.abs(got - want) < 1e-9, `${got} vs ${want}`);
});
