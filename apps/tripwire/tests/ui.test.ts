import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, defaultRange, geometry, nearestX, rangeAvailability, sliceRange, spanWord, type Pt } from '../src/chart.ts';
import { plural } from '../src/fmt.ts';
import { ownershipTree } from '../src/intel.ts';
import { sectorPeers } from '../src/similar.ts';
import { SERVICES, hapticsNote, publicStatus } from '../src/services.ts';
import type { Row } from '../src/screen.ts';
import type { Inst } from '../src/data.ts';

const DAY = 86400;
/** weekday bars ending 2026-10-23, with open, high, low and volume */
function series(n: number): Pt[] {
  const out: Pt[] = []; let t = Date.UTC(2026, 9, 23, 4) / 1000 - n * 1.45 * DAY, px = 100, i = 0;
  while (out.length < n) { t += DAY; const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue; const o = px; px *= 1 + 0.0006 + Math.sin(i++ / 11) * 0.012; out.push({ t, c: px, o, h: Math.max(o, px) * 1.012, l: Math.min(o, px) * 0.988, v: 1e5 }); }
  return out;
}

test('candles: every body and wick lies inside [0, W], and clear of the price-tag gutter, at every range and frame', () => {
  const all = series(3800);
  for (const range of ['1Y', '3Y', '5Y', '10Y', 'Max'] as const) for (const frame of ['daily', 'weekly', 'monthly'] as const) for (const gutter of [0, 160]) {
    const pts = aggregate(sliceRange(all, range).pts, frame); if (pts.length < 2) continue;
    const g = geometry(pts, false, 1000, 300, 12, true, { bars: true, gutter })!;
    pts.forEach((_, k) => { const x = g.xs[k]; assert.ok(x - g.barW / 2 >= 0, `${range} ${frame}: bar ${k} body starts at ${x - g.barW / 2}`); assert.ok(x + g.barW / 2 <= g.W - gutter, `${range} ${frame} gutter ${gutter}: bar ${k} ends at ${x + g.barW / 2}`); assert.ok(x >= 0 && x <= g.W, 'the wick'); });
    assert.ok(g.barW >= 1.2 && g.barW <= 18);
    pts.forEach((p, k) => { assert.ok(g.yOf(p.h!) >= 0 && g.yOf(p.l!) <= g.H, `${range} ${frame}: bar ${k} wick inside the plot vertically`); });
  }
});
test('candles: without bars the line still spans the full width (nothing changes for the line view)', () => {
  const pts = series(300); const g = geometry(pts, false, 1000, 300, 12, false)!; assert.equal(g.xs[0], 0); assert.equal(g.xs[g.xs.length - 1], 1000); assert.equal(g.barW, 0);
});
test('geometry: a monthly view of 5 years keeps the first and the last candle whole (the owner\'s screenshot)', () => {
  const m = aggregate(sliceRange(series(1700), '5Y').pts, 'monthly'); const g = geometry(m, false, 1000, 300, 12, true, { bars: true, gutter: 180 })!;
  assert.ok(g.xs[0] - g.barW / 2 >= 0 && g.xs[g.xs.length - 1] + g.barW / 2 <= 1000 - 180);
});
test('nearestX picks the closest point, also from the padded margins and the gutter', () => {
  const xs = [10, 20, 40, 80]; assert.equal(nearestX(xs, 0), 0); assert.equal(nearestX(xs, 31), 2); assert.equal(nearestX(xs, 500), 3); assert.equal(nearestX([], 5), -1);
});
test('ranges: a range the history cannot fill is unavailable and says how much there is; the default is never 10Y on 14 months', () => {
  const short = series(300); const a = rangeAvailability(short); assert.ok(a.find((r) => r.id === '1Y')!.available === (sliceRange(short, '1Y').covers));
  const m14 = series(14 * 21); const av = rangeAvailability(m14);
  assert.equal(av.find((r) => r.id === '10Y')!.available, false); assert.match(av.find((r) => r.id === '10Y')!.note!, /^10Y: only 1[34] months of history$/); assert.equal(av.find((r) => r.id === 'Max')!.available, true);
  assert.equal(defaultRange(m14), 'Max'); assert.equal(defaultRange(series(3000)), '10Y'); assert.equal(defaultRange([]), 'Max');
  assert.equal(spanWord(14 / 12), '14 months'); assert.equal(spanWord(5), '5.0 years'); assert.equal(spanWord(12.4), '12 years');
});
test('plural: the count and the right form', () => {
  assert.equal(plural(1, 'company', 'companies'), '1 company'); assert.equal(plural(0, 'company', 'companies'), '0 companies'); assert.equal(plural(6, 'statement-based line'), '6 statement-based lines'); assert.equal(plural(2, 'line'), '2 lines'); assert.equal(plural(988, 'company', 'companies'), '988 companies'); assert.equal(plural(1234, 'name'), '1,234 names');
});
const inst = (o: Partial<Inst>): Inst => ({ quality: 'complete', ...o });
test('ownership: the PETRONET figures nest (promoter + public = 100, FII + DII = institutions, mutual funds inside DII) and the derived line says so', () => {
  const t = ownershipTree(inst({ promoter: 50, publicHold: 50, fii: 25.98, dii: 14.21, insti: 40.19, mf: 12.65 }))!; assert.equal(t.nested, true);
  const pub = t.nodes.find((x) => x.key === 'public')!; const insti = pub.children!.find((x) => x.key === 'insti')!; assert.deepEqual(insti.children!.map((x) => x.key), ['fii', 'dii']);
  assert.deepEqual(insti.children!.find((x) => x.key === 'dii')!.children!.map((x) => x.key), ['mf']);
  const other = pub.children!.find((x) => x.key === 'other')!; assert.ok(other.derived && Math.abs(other.pct - 9.81) < 0.01);
});
test('ownership: figures that do not obey the nesting are shown flat with a note that the groups may overlap, never nested on trust', () => {
  const bad = ownershipTree(inst({ promoter: 60, publicHold: 50, fii: 10, dii: 5, insti: 15, mf: 3 }))!; assert.equal(bad.nested, false); assert.match(bad.basis, /may overlap/);
  const mfBig = ownershipTree(inst({ promoter: 50, publicHold: 50, fii: 10, dii: 5, insti: 15, mf: 9 }))!; assert.equal(mfBig.nested, false);
  const noTotal = ownershipTree(inst({ promoter: 50, publicHold: 50, fii: 10, dii: 5 }))!; assert.equal(noTotal.nested, false);
  assert.equal(ownershipTree(null), null);
});
const R = (sym: string, sector: string | null, tier: string | null, turnover: number, liquid = true) => ({ sym, name: sym, sector, tier, turnover_cr: turnover, liquid }) as Row;
test('same-sector peers: same sector and size class, liquid, by traded value; no sector or size class is said, not guessed', () => {
  const rows = [R('A', 'Tech', 'large', 10), R('B', 'Tech', 'large', 50), R('C', 'Tech', 'large', 30, false), R('D', 'Tech', 'small', 99), R('E', 'Energy', 'large', 99), R('F', null, 'large', 1), R('G', 'Tech', null, 1)];
  assert.deepEqual(sectorPeers('A', rows)!.list.map((r) => r.sym), ['B']); assert.match(sectorPeers('F', rows)!.why, /no sector/); assert.match(sectorPeers('G', rows)!.why, /size class/); assert.equal(sectorPeers('ZZ', rows), null);
  assert.match(sectorPeers('E', rows)!.why, /No other liquid/);
});
test('services: a device-dependent service is never "Working" when this device cannot use it, and configuration is stated apart from capability', () => {
  const lock = SERVICES.find((s) => s.id === 'lock')!; assert.ok(lock.device);
  const no = publicStatus(lock, null, false); assert.equal(no.word, 'Configured'); assert.match(no.deviceLine!, /not supported in this browser/); assert.notEqual(no.tone, 'lime');
  const yes = publicStatus(lock, null, true); assert.equal(yes.word, 'Configured'); assert.match(yes.deviceLine!, /supported/); assert.equal(publicStatus(lock, null, null).deviceLine, 'This device: checking');
  assert.equal(publicStatus(SERVICES.find((s) => s.id === 'backup')!, null, null).word, 'Working');
  assert.equal(publicStatus(SERVICES.find((s) => s.id === 'prices')!, { ok: false }, null).word, 'Not answering'); assert.equal(publicStatus(SERVICES.find((s) => s.id === 'sync')!, null, null).word, 'Not built');
});
test('haptics: the note never claims a tap that was not verified', () => {
  assert.match(hapticsNote('vibrate'), /not been verified/); assert.match(hapticsNote('ios-switch'), /not been verified/); assert.match(hapticsNote('none'), /Not supported/);
});
test('aggregate keeps whole bars at the edges (the last monthly bar is the days so far)', () => {
  const m = aggregate(series(200), 'monthly'); assert.ok(m.length >= 8); assert.ok(m.every((b) => b.h! >= b.c && b.l! <= b.c));
});
