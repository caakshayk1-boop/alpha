import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePaper, type Bar, type Paper } from '../src/tracker.ts';

/** A second, independent implementation of the rules in docs/tripwire/PAPER_ACCOUNTING.md, written from the document and not from the code, compared against the tracker on random
 *  bar paths. If the document and the code ever disagree, or a refactor changes a rule, one of them fails here. */
const COST = 0.25, SLIP = 0.1;
const r2 = (x: number) => Math.round(x * 100) / 100;
function oracle(p: { ref: number; stop: number; horizon: number; qty: number; targets: { t1R: number; t2R: number } | null }, bars: Bar[]) {
  if (!bars.length) return { status: 'pending' as const };
  const first = bars[0]; const fill = r2(first.o * (1 + SLIP / 100));
  if (first.o > p.ref * 1.02) return { status: 'skipped' as const }; if (first.o <= p.stop) return { status: 'skipped' as const };
  const fees = (COST / 100) * fill * p.qty; let stop = p.stop; let left = p.qty; let booked = 0; let t1 = false;
  const risk = fill - p.stop; const T1 = p.targets ? r2(fill + p.targets.t1R * risk) : Infinity, T2 = p.targets ? r2(fill + p.targets.t2R * risk) : Infinity; const q1 = Math.floor(p.qty / 2);
  const done = (px: number, market: boolean) => ({ status: 'closed' as const, exit: r2(px), pnl: booked + (px - fill) * left - fees - (market ? (SLIP / 100) * px * left : 0) });
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (i > 0 && b.o <= stop) return done(b.o, true);
    if (b.l <= stop) return done(stop, true);
    let justT1 = false;
    if (p.targets && !t1 && b.h >= T1) { const px = Math.max(T1, b.o); if (q1 > 0) { booked += (px - fill) * q1; left -= q1; } t1 = true; justT1 = true; stop = Math.max(stop, fill); }
    if (p.targets && t1 && b.h >= T2 && (!justT1 || b.o >= T2)) { const px = Math.max(T2, b.o); booked += (px - fill) * left; left = 0; return { status: 'closed' as const, exit: r2(px), pnl: booked - fees }; }
    if (i + 1 >= p.horizon) return done(b.c, true);
  }
  const last = bars[bars.length - 1]; return { status: 'open' as const, mark: r2(last.c), pnl: booked + (last.c - fill) * left - fees - (SLIP / 100) * last.c * left };
}
const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

test('paper accounting: the tracker equals an independent implementation of the written rules on 600 random paths, with and without the profit ladder', () => {
  let closed = 0, open = 0, skipped = 0, t1s = 0, t2s = 0;
  for (let n = 0; n < 600; n++) {
    const r = rng(n * 7919 + 1); const ref = 100 * (0.5 + r()); const stopPct = 0.03 + r() * 0.09; const stop = r2(ref * (1 - stopPct)); const horizon = 3 + Math.floor(r() * 25); const qty = 1 + Math.floor(r() * 400);
    const targets = n % 2 ? { t1R: [1, 1.5, 2][n % 3], t2R: [2, 3, 4][n % 3] } : null; const taken = 1_000_000;
    let px = ref * (1 + (r() - 0.35) * 0.04); const bars: Bar[] = []; const len = 1 + Math.floor(r() * 40);
    for (let k = 0; k < len; k++) { const o = r2(px * (1 + (r() - 0.5) * 0.02)); const c = r2(o * (1 + (r() - 0.48) * 0.05)); const h = r2(Math.max(o, c) * (1 + r() * 0.025)); const l = r2(Math.min(o, c) * (1 - r() * 0.025)); bars.push({ t: taken + (k + 1) * 86400, o, h, l, c, forming: false }); px = c; }
    const p: Paper = { id: 'x', sym: 'X', engine: 'MOM', asOf: '2026-10-23', ref: r2(ref), stop, horizon, qty, takenAt: taken, targets };
    const v = evaluatePaper(p, bars, null, COST); const o = oracle({ ref: r2(ref), stop, horizon, qty, targets }, bars);
    assert.equal(v.status, o.status, `case ${n}: status`);
    if (o.status === 'skipped') { skipped++; continue; }
    if (o.status === 'closed') { closed++; assert.ok(Math.abs((v.exit ?? NaN) - o.exit!) < 0.011, `case ${n}: exit ${v.exit} vs ${o.exit}`); if (v.ladder?.t1Hit) t1s++; if (v.ladder?.t2Hit) t2s++; }
    if (o.status === 'open') { open++; assert.ok(Math.abs((v.mark ?? NaN) - o.mark!) < 0.011, `case ${n}: mark`); }
    if (o.status !== 'pending') assert.ok(Math.abs((v.pnl ?? NaN) - o.pnl!) < 0.02, `case ${n} (${targets ? 'ladder' : 'plain'}): pnl ${v.pnl} vs ${o.pnl!.toFixed(2)}`);
  }
  assert.ok(closed > 150 && open > 20 && skipped > 5 && t1s > 20 && t2s > 5, `the random paths must exercise every branch: closed ${closed}, open ${open}, skipped ${skipped}, T1 ${t1s}, T2 ${t2s}`);
});

test('paper accounting: invariants that hold on any path: zero move costs exactly the fees and the exit slippage; a higher exit never lowers P&L; R is P&L over risk; evaluating twice or in another order changes nothing', () => {
  const taken = 1_000_000, p: Paper = { id: 'f', sym: 'X', engine: 'MOM', asOf: 'd', ref: 100, stop: 90, horizon: 5, qty: 100, takenAt: taken, targets: null };
  const flat = (o: number): Bar[] => Array.from({ length: 5 }, (_, k) => ({ t: taken + (k + 1) * 86400, o, h: o, l: o, c: o, forming: false }));
  const v = evaluatePaper(p, flat(100), null, COST); const fill = 100.1; assert.equal(v.status, 'closed');
  assert.ok(Math.abs(v.pnl! - ((100 - fill) * 100 - 0.0025 * fill * 100 - 0.001 * 100 * 100)) < 0.02, `a flat path loses the open's slippage, the costs and the exit slippage, got ${v.pnl}`);
  const rise = (x: number): Bar[] => flat(100).map((b, k) => (k ? { ...b, o: x, h: x, l: x, c: x } : b)); const up = evaluatePaper(p, rise(105), null, COST), up2 = evaluatePaper(p, rise(110), null, COST); assert.ok(up2.pnl! > up.pnl! && up.pnl! > v.pnl!, 'P&L rises with the price');
  assert.ok(Math.abs(v.r! - v.pnl! / ((fill - 90) * 100)) < 0.011, 'R is P&L over the rupees at risk');
  const a = JSON.stringify(evaluatePaper(p, flat(103), null, COST)), b = JSON.stringify(evaluatePaper(p, flat(103), null, COST)); assert.equal(a, b, 'the same bars give the same answer');
});
