import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aggregate, monthly, rsiSeries, type Pt } from '../src/chart.ts';

const G = JSON.parse(readFileSync(new URL('./fixtures/rsi_golden.json', import.meta.url), 'utf8')) as Record<string, { closes: number[]; rsi: (number | null)[] }>;
test('RSI matches an independent per-step formulation on every golden series', () => {
  for (const [name, g] of Object.entries(G)) {
    const r = rsiSeries(g.closes);
    assert.equal(r.length, g.rsi.length, name);
    r.forEach((v, i) => { const e = g.rsi[i]; if (e == null) assert.equal(v, null, `${name}[${i}]`); else assert.ok(v != null && Math.abs(v - e) < 1e-4, `${name}[${i}] ${v} vs ${e}`); });
  }
});
test('RSI: only gains is 100, only losses is 0, no movement and too little history are null, never 50 or 0', () => {
  assert.equal(rsiSeries(G.up.closes)[14], 100); assert.equal(rsiSeries(G.down.closes)[14], 0);
  assert.equal(rsiSeries(G.flat.closes)[14], null); assert.deepEqual(rsiSeries(G.short.closes), [null, null, null]);
});
const day = (iso: string) => Date.parse(iso + 'T10:00:00Z') / 1000;
const bar = (iso: string, o: number, h: number, l: number, c: number, v: number): Pt => ({ t: day(iso), o, h, l, c, v });
test('a week and a month are one bar: first open, extreme high and low, last close, summed volume', () => {
  const pts = [bar('2026-10-05', 10, 12, 9, 11, 100), bar('2026-10-06', 11, 15, 10, 14, 200), bar('2026-10-09', 14, 14, 8, 9, 50), bar('2026-10-12', 9, 10, 8, 10, 10)];
  const w = aggregate(pts, 'weekly'); assert.equal(w.length, 2);
  assert.deepEqual([w[0].o, w[0].h, w[0].l, w[0].c, w[0].v], [10, 15, 8, 9, 350]);
  const m = monthly(pts); assert.equal(m.length, 1); assert.deepEqual([m[0].o, m[0].h, m[0].l, m[0].c, m[0].v], [10, 15, 8, 10, 360]);
  assert.equal(m[0].t, pts[3].t, 'the bar is stamped with its last day');
});
test('a period in which no day printed a high, low or volume leaves them null instead of using the close', () => {
  const pts: Pt[] = [{ t: day('2026-10-05'), c: 10 }, { t: day('2026-10-06'), c: 11 }];
  const m = aggregate(pts, 'monthly')[0]; assert.equal(m.c, 11); assert.equal(m.h ?? null, null); assert.equal(m.l ?? null, null); assert.equal(m.v ?? null, null);
});
test('daily is the series itself', () => { const pts = [bar('2026-10-05', 1, 2, 1, 2, 3)]; assert.deepEqual(aggregate(pts, 'daily'), pts); });
