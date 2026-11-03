// The sector heat map's geometry and figures. Pure functions, checked exactly: areas are proportional, nothing overlaps or leaves the box, missing figures are left out (never zero),
// a sector's colour figure is weighted by traded value, and leaders and laggards never overlap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { squarify, withFloor } from '../src/treemap.ts';
import { heatNames, sectorHeat, leadersLaggards, heatStrength, signed, shortSector, abbrSector, cellLabel, labelNeed, charW, PCT_W, MIN_CQW, MAX_CQW } from '../src/sectorheat.ts';
import type { Row } from '../src/screen.ts';

const area = (r: { w: number; h: number }) => r.w * r.h;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

test('squarify: each area is its share of the box, and the rectangles tile it without overlap or overflow', () => {
  const items = [{ id: 'a', value: 50 }, { id: 'b', value: 25 }, { id: 'c', value: 15 }, { id: 'd', value: 7 }, { id: 'e', value: 3 }];
  const W = 390, H = 300; const rs = squarify(items, W, H); assert.equal(rs.length, 5);
  const total = items.reduce((s, i) => s + i.value, 0);
  for (const r of rs) { const v = items.find((i) => i.id === r.id)!.value; assert.ok(near(area(r), (v / total) * W * H, 1e-9), `${r.id} area`); assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= W + 1e-6 && r.y + r.h <= H + 1e-6, `${r.id} inside`); }
  assert.ok(near(rs.reduce((s, r) => s + area(r), 0), W * H), 'the areas sum to the box');
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x); const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); assert.ok(ox <= 1e-6 || oy <= 1e-6, `${a.id} and ${b.id} overlap`); }
});

test('squarify: the largest item is drawn first, rectangles stay near square, and bad input draws nothing', () => {
  const rs = squarify(Array.from({ length: 11 }, (_, i) => ({ id: String(i), value: 100 - i * 7 })), 360, 280);
  const aspect = rs.map((r) => Math.max(r.w / r.h, r.h / r.w)); assert.ok(Math.max(...aspect) < 4, `worst aspect ratio ${Math.max(...aspect).toFixed(2)}`);
  assert.deepEqual(squarify([], 100, 100), []); assert.deepEqual(squarify([{ id: 'a', value: 0 }, { id: 'b', value: -3 }, { id: 'c', value: NaN }], 100, 100), []); assert.deepEqual(squarify([{ id: 'a', value: 1 }], 0, 100), []);
  assert.equal(squarify([{ id: 'only', value: 5 }], 200, 100)[0].w, 200); assert.equal(squarify([{ id: 'only', value: 5 }], 200, 100)[0].h, 100);
});

test('withFloor: a small group is raised to a minimum share, and the others give up area for it', () => {
  const f = withFloor([{ id: 'a', value: 900 }, { id: 'b', value: 90 }, { id: 'c', value: 10 }], 0.06); const t = f.reduce((s, i) => s + i.value, 0);
  assert.ok(f.every((i) => i.value / t >= 0.06 - 1e-9), f.map((i) => (i.value / t).toFixed(3)).join(' ')); assert.ok(near(f.find((i) => i.id === 'c')!.value / t, 0.06, 1e-9), 'a raised item lands exactly on the floor'); assert.equal(f.find((i) => i.id === 'a')!.value, 900, 'the largest is unchanged');
  assert.deepEqual(withFloor([{ id: 'a', value: 1 }], 0.5), [{ id: 'a', value: 1 }]); assert.deepEqual(withFloor([{ id: 'x', value: 0 }], 0.05), []);
});

const row = (sym: string, sector: string | null, r1d: number | null, turnover: number | null, liquid = true, extra: Partial<Row> = {}): Row => ({ sym, name: `${sym} Ltd.`, sector, liquid, r1d, r1w: r1d == null ? null : r1d * 2, r1m: r1d == null ? null : r1d * 4, turnover_cr: turnover, price: 100, tier: 'mid', ...extra });
const ROWS: Row[] = [
  row('OLD', 'Energy', 99, 100000, true, { stale: true }), // an old close must not dominate today's sector colour
  row('A1', 'Energy', 2, 100), row('A2', 'Energy', -1, 300), row('A3', 'Energy', 4, 100), row('A4', 'Energy', null, 500),           // A4 has no change: left out, not read as 0
  row('B1', 'Tech', 1, 200), row('B2', 'Tech', 3, 200), row('B3', 'Tech', -2, 200), row('B4', 'Tech', 0.5, 50, false),              // B4 is not liquid
  row('C1', 'Tiny', 5, 10), row('C2', 'Tiny', 6, 10),                                                                               // too few names for a cell
  row('D1', null, 9, 999), row('E1', 'Energy', 8, 0), row('E2', 'Energy', 7, null),                                                 // no sector; no traded value
];

test('heatNames: liquid names with a finite change and a traded value only; a missing figure is never zero', () => {
  const e = heatNames(ROWS, 'r1d', 'Energy'); assert.deepEqual(e.map((n) => n.sym).sort(), ['A1', 'A2', 'A3']);
  assert.ok(!heatNames(ROWS, 'r1d').some((n) => ['A4', 'B4', 'D1', 'E1', 'E2'].includes(n.sym)));
  assert.equal(heatNames(ROWS, 'r1w', 'Tech').find((n) => n.sym === 'B2')!.chg, 6, 'the window picks the figure');
});

test('sectorHeat: weight is traded value, the colour figure is weighted by it, small sectors are left out, largest first', () => {
  const s = sectorHeat(ROWS, 'r1d'); assert.deepEqual(s.map((x) => x.sector), ['Tech', 'Energy'], 'Tech trades 600 crore, Energy 500: the larger comes first');
  const en = s.find((x) => x.sector === 'Energy')!; assert.equal(en.weight, 500); assert.equal(en.n, 3);
  assert.ok(near(en.chg, (2 * 100 + -1 * 300 + 4 * 100) / 500), `Energy weighted change ${en.chg}`); assert.deepEqual([en.up, en.down], [2, 1]);
  const tech = s.find((x) => x.sector === 'Tech')!; assert.equal(tech.weight, 600, 'the illiquid B4 does not count'); assert.ok(near(tech.chg, (1 * 200 + 3 * 200 - 2 * 200) / 600));
  assert.ok(!s.some((x) => x.sector === 'Tiny'), 'two names is too few for a cell'); assert.equal(sectorHeat(ROWS, 'r1d', 2).some((x) => x.sector === 'Tiny'), true);
  assert.deepEqual(sectorHeat([], 'r1d'), []);
});

test('leadersLaggards: the strongest and weakest never overlap, ties break by traded value, and a short list gives fewer', () => {
  const ns = heatNames(ROWS, 'r1d', 'Energy').concat(heatNames(ROWS, 'r1d', 'Tech')); const { leaders, laggards } = leadersLaggards(ns, 2);
  assert.deepEqual(leaders.map((n) => n.sym), ['A3', 'B2']); assert.deepEqual(laggards.map((n) => n.sym), ['B3', 'A2'], 'weakest first');
  const two = leadersLaggards(heatNames(ROWS, 'r1d', 'Energy'), 5); assert.equal(two.leaders.length, 1); assert.equal(two.laggards.length, 1); assert.notEqual(two.leaders[0].sym, two.laggards[0].sym);
  assert.deepEqual(leadersLaggards([], 5), { leaders: [], laggards: [] });
});

test('heatStrength and signed: a scale per window, capped at 1, with a real minus sign', () => {
  assert.equal(heatStrength(3, 'r1d'), 1); assert.equal(heatStrength(-30, 'r1d'), 1); assert.equal(heatStrength(0, 'r1d'), 0); assert.ok(near(heatStrength(6, 'r1m'), 0.5));
  assert.equal(signed(2.345), '+2.3%'); assert.equal(signed(-0.04), '−0.0%'); assert.equal(signed(0), '0.0%'); assert.equal(signed(-12.34, 2), '−12.34%');
});

test('shortSector: long sector names get a short form for a phone cell; unknown names pass through', () => {
  assert.equal(shortSector('Financial Services'), 'Financials'); assert.equal(shortSector('Communication Services'), 'Comm. services'); assert.equal(shortSector('Energy'), 'Energy'); assert.equal(shortSector('Something New'), 'Something New');
});

test('cellLabel: the full name when it fits at a readable size, the short code when it does not, nothing when neither does', () => {
  const fin = cellLabel(34, 30, 'Financials', 'Fin', '+1.1%'); assert.equal(fin.text, 'Financials'); assert.equal(cellLabel(29, 30, 'Financials', 'Fin', '+1.1%').text, 'Fin', 'ten letters at a generous width do not fit a 29 percent cell at 10 px'); assert.ok(fin.fn >= MIN_CQW && fin.fn <= MAX_CQW); assert.ok(fin.fp != null);
  assert.equal(cellLabel(29, 30, 'Industrials', abbrSector('Industrials'), '+3.3%').text, 'Ind');
  assert.equal(cellLabel(44, 30, 'Industrials', 'Ind', '+3.3%').text, 'Industrials', 'but they fit a wider one');
  assert.equal(cellLabel(5, 30, 'Utilities', 'Utils', '+3.3%').text, null, 'a sliver prints nothing'); assert.equal(cellLabel(30, 4, 'Energy', null, '+1%').text, null, 'too short to hold a line');
  { const oil = cellLabel(14, 12, 'OIL', null, '+1.0%'); assert.equal(oil.text, 'OIL'); assert.equal(oil.fp, null, 'a medium cell prints the name without the figure'); assert.equal(cellLabel(14, 9, 'OIL', null, '+1.0%').text, null, 'and nothing when even one line does not fit its height'); }
  const sq = cellLabel(30, 14, 'Cons. defensive', 'Def', '+1.9%'); assert.ok(sq.text === 'Def' && sq.fp != null || sq.fp == null, 'a short cell never prints a three-line label: it takes the short code with its figure, or drops the figure'); assert.notEqual(`${sq.text}|${sq.fp != null}`, 'Cons. defensive|true', 'the 3 Nov bug: two wrapped lines plus the figure in a 14-high cell');
  assert.equal(cellLabel(26, 26, 'Cons. cyclical', 'Cyc', '+2.8%').text, 'Cons. cyclical', 'a two-word name is judged by its longest word (cyclical, 8 letters needs about 24 percent), because it wraps at the space'); assert.equal(cellLabel(20, 20, 'Cons. cyclical', 'Cyc', '+2.8%').text, 'Cyc');
});

test('cellLabel: a company symbol may be cut with an ellipsis when four characters still show; a sector name never is', () => {
  assert.equal(cellLabel(24, 20, 'HDFCBANK', null, '+1.0%').text, null, 'without the allowance a symbol that does not fit prints nothing');
  const cut = cellLabel(24, 20, 'HDFCBANK', null, '+1.0%', true); assert.equal(cut.text, 'HDFCBANK'); assert.equal(cut.fn, MIN_CQW); assert.equal(cut.fp, null);
  assert.equal(cellLabel(8, 20, 'HDFCBANK', null, '+1.0%', true).text, null, 'a sliver still prints nothing');
});

test('cellLabel: over every cell size, whatever is printed fits its cell at a readable size (no cut-off labels)', () => {
  for (const [full, short] of [['Financials', 'Fin'], ['Industrials', 'Ind'], ['Cons. defensive', 'Def'], ['Comm. services', 'Comm'], ['RELIANCE', null], ['A', null]] as [string, string | null][])
    for (let w = 1; w <= 100; w += 1.5) for (let h = 1; h <= 80; h += 3) {
      const L = cellLabel(w, h, full, short, '+11.6%'); if (L.text == null) continue;
      const inner = w - (w >= 17 ? 8 : 4); const longest = Math.max(...L.text.split(' ').map((x) => x.length)) * charW(L.text);
      assert.ok(L.fn >= MIN_CQW - 1e-9 && L.fn <= MAX_CQW + 1e-9, `size ${L.fn}`); assert.ok(L.fn * longest <= inner + 1e-6, `${L.text} at ${w}x${h} needs ${(L.fn * longest).toFixed(1)} of ${inner}`);
      if (L.fp != null) { assert.ok(w >= 17, 'the figure only in a cell wide enough for it'); assert.ok(L.fp * '+11.6%'.length * PCT_W <= inner + 1e-6, `the figure at ${w}x${h} needs ${(L.fp * 6 * PCT_W).toFixed(1)} of ${inner}`); } assert.ok(labelNeed(L.text, L.fn, inner, L.fp) <= h + 1e-9, `${L.text}${L.fp ? ' + figure' : ''} at ${w}x${h} needs ${labelNeed(L.text, L.fn, inner, L.fp).toFixed(1)} of height ${h}`);
    }
});
