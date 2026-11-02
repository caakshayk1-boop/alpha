// The shared chart system, offline: the takeaway sentences, drawdown, series alignment and coverage, the table that must agree with the chart, the opening view, trade-offs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { alignIndexed, compareSeries, sliceRange, type Pt, type Series } from '../src/chart.ts';
import { arrowOf, cagr, compareTakeaway, financialsTakeaway, maxDrawdown, netMargin, priceTakeaway, signedPct, windowReturn, windowWords } from '../src/charts/takeaway.ts';
import { coverageOf, drawdownLines, tradeoffs } from '../src/charts/compare.ts';
import { buildTable, cellText, pickRows, tableNote } from '../src/charts/table.ts';
import { chartStart } from '../src/charts/defaults.ts';
import { markerPath, spreadLabels, styleOf } from '../src/charts/series.ts';

const D = 86400, T0 = Date.UTC(2025, 0, 1, 4) / 1000;
const pts = (cs: number[], step = D, t0 = T0): { t: number; c: number }[] => cs.map((c, i) => ({ t: t0 + i * step, c }));

test('signed percentages: true minus, no sign on a value that rounds to zero, arrows are a second cue', () => {
  assert.equal(signedPct(12.345), '+12.3%'); assert.equal(signedPct(-4.56), '−4.6%'); assert.equal(signedPct(0.01), '0.0%'); assert.equal(signedPct(-0.04), '0.0%'); assert.equal(signedPct(NaN), '—');
  assert.deepEqual([arrowOf(2), arrowOf(-2), arrowOf(0), arrowOf(null)], ['▲', '▼', '■', '■']);
});
test('window return: first to last close; undefined for a single point or a non-positive first close', () => {
  assert.equal(windowReturn(pts([100, 110]))!.ret.toFixed(6), '10.000000'); assert.equal(windowReturn(pts([100])), null); assert.equal(windowReturn(pts([0, 10])), null); assert.equal(windowReturn(pts([-5, 10])), null);
});
test('max drawdown: the deepest fall from the running peak, its peak and trough, and whether it was regained', () => {
  const d = maxDrawdown(pts([100, 120, 90, 110, 130, 100]))!;
  assert.equal(d.depth.toFixed(4), '-25.0000'); assert.equal(d.peak.c, 120); assert.equal(d.trough.c, 90); assert.equal(d.recovered, true);
  assert.equal(d.now.toFixed(4), (-100 * (1 - 100 / 130)).toFixed(4), 'the last close against the highest close');
  const open = maxDrawdown(pts([100, 80, 85]))!; assert.equal(open.depth.toFixed(1), '-20.0'); assert.equal(open.recovered, false);
  assert.equal(maxDrawdown(pts([1, 2, 3, 4]))!.depth, 0, 'a series that only rises never fell');
  assert.equal(maxDrawdown(pts([5])), null);
});
test('max drawdown ignores a zero or negative close instead of dividing by it', () => {
  const d = maxDrawdown(pts([100, 0, 50, -3, 80]))!; assert.ok(Number.isFinite(d.depth)); assert.equal(d.depth.toFixed(1), '-50.0');
});
test('window words name the range, or the history that exists when it is shorter', () => {
  assert.equal(windowWords('1Y', true, 1), 'the last year'); assert.equal(windowWords('3Y', true, 3), 'the last 3 years');
  assert.equal(windowWords('5Y', false, 0.5), 'the 6 months of history held'); assert.equal(windowWords('Max', true, 7), 'the 7.0 years of history held');
});
test('price takeaway against a benchmark: the return, the gap in percentage points, the deepest fall and the data-through date', () => {
  const s = pts([100, 110, 105, 120]); const n = pts([100, 101, 102, 104]);
  const t = priceTakeaway({ sym: 'TCS', pts: s, bench: n, words: 'the last year' })!;
  assert.equal(t.headline, 'TCS rose 20.0% over the last year, against +4.0% for the Nifty 50: 16.0 percentage points ahead of it.');
  assert.match(t.lines[0], /^The deepest fall from a peak inside the window was −4\.5% /); assert.match(t.lines[0], /a later close regained that peak/);
  assert.equal(t.dataThrough, `Closes through ${new Date((s[3].t + 19800) * 1000).getUTCDate()} Jan 2025`);
  assert.deepEqual([t.facts.ret!.toFixed(1), t.facts.bench!.toFixed(1), t.facts.diff!.toFixed(1)], ['20.0', '4.0', '16.0']);
});
test('price takeaway: behind, level, flat, and no benchmark', () => {
  assert.match(priceTakeaway({ sym: 'X', pts: pts([100, 90]), bench: pts([100, 105]), words: 'the last year' })!.headline, /^X fell 10\.0% over the last year, against \+5\.0% for the Nifty 50: 15\.0 percentage points behind it\.$/);
  assert.match(priceTakeaway({ sym: 'X', pts: pts([100, 105]), bench: pts([100, 105]), words: 'w' })!.headline, /level with it\.$/);
  assert.match(priceTakeaway({ sym: 'X', pts: pts([100, 100.02]), words: 'w' })!.headline, /^X was flat over w \(0\.0%\)\.$/);
  assert.equal(priceTakeaway({ sym: 'X', pts: pts([100, 105]), words: 'the last year' })!.headline, 'X rose 5.0% over the last year (+5.0%).');
  assert.equal(priceTakeaway({ sym: 'X', pts: pts([100]), words: 'w' }), null);
});
test('the takeaway makes no causal claim, forecast, score or recommendation', () => {
  const all = [priceTakeaway({ sym: 'X', pts: pts([100, 80, 120]), bench: pts([100, 99, 101]), words: 'the last year' })!, compareTakeaway({ t: pts([1, 2, 3]).map((p) => p.t), lines: [{ id: 'A', v: [100, 90, 120] }, { id: 'B', v: [100, 101, 99] }], nifty: [100, 100, 101], words: 'the last year' })!]
    .flatMap((t) => [t.headline, ...t.lines]).join(' ');
  for (const bad of [/because/i, /due to/i, /driven/i, /will /i, /likely/i, /expect/i, /forecast/i, /outlook/i, /confidence/i, /score/i, /buy|sell|hold\b/i, /winner|best|worst/i]) assert.doesNotMatch(all, bad, String(bad));
});
test('price takeaway is a function of the displayed series only: the same series gives the same text, a changed point changes it', () => {
  const a = priceTakeaway({ sym: 'X', pts: pts([100, 110, 90, 120]), words: 'w' })!, b = priceTakeaway({ sym: 'X', pts: pts([100, 110, 90, 120]), words: 'w' })!, c = priceTakeaway({ sym: 'X', pts: pts([100, 110, 90, 121]), words: 'w' })!;
  assert.deepEqual(a, b); assert.notEqual(a.headline, c.headline);
});
test('a series that never closed below an earlier high says so', () => { assert.match(priceTakeaway({ sym: 'X', pts: pts([1, 2, 3]), words: 'w' })!.lines[0], /never closed below an earlier high/); });
test('compare takeaway: every return and every deepest fall, the Nifty included, and no winner named', () => {
  const t = pts([0, 0, 0, 0]).map((_, i) => T0 + i * D);
  const c = compareTakeaway({ t, lines: [{ id: 'TCS', v: [100, 110, 120, 130] }, { id: 'INFY', v: [100, 90, 95, 99] }], nifty: [100, 101, 102, 103], words: 'the last year' })!;
  assert.equal(c.headline, 'Over the last year, price change: TCS +30.0%, INFY −1.0%, Nifty 50 +3.0%.');
  assert.equal(c.lines[0], 'Deepest fall from a peak inside the window: TCS 0.0%, INFY −10.0%, Nifty 50 0.0%.');
  assert.deepEqual(c.rows.map((r) => r.id), ['TCS', 'INFY', 'Nifty 50']);
});

// ---- alignment and coverage ----
const ser = (id: string, n: number, startOffsetDays: number, level = 100, step = 0.5): Series => { const t: number[] = [], c: number[] = []; for (let i = 0; i < n; i++) { t.push(T0 + (startOffsetDays + i) * D); c.push(level + i * step); } return { id, t, c }; };
test('alignment keeps only days every name traded, indexes each to 100 on the first shared day', () => {
  const a = ser('A', 400, 0), b = ser('B', 300, 100); const al = alignIndexed([a, b], 'Max')!;
  assert.equal(al.t.length, 300); assert.equal(al.t[0], b.t[0]);
  assert.deepEqual(al.lines.map((l) => l.v[0]), [100, 100]);
  assert.equal(al.lines[0].v[299].toFixed(6), (((100 + 399 * 0.5) / (100 + 100 * 0.5)) * 100).toFixed(6));
});
test('alignment drops a day one name skipped rather than drawing across it', () => {
  const a = ser('A', 50, 0), b = ser('B', 50, 0); b.t.splice(20, 1); b.c.splice(20, 1);
  const al = alignIndexed([a, b], 'Max')!; assert.equal(al.t.length, 49); assert.ok(!al.t.includes(a.t[20]));
  const cov = coverageOf([a, b], al, 'Max'); assert.equal(cov.leftOut, 1); assert.match(cov.notes.join(' '), /1 day on which not every name has a close is left out/);
});
test('coverage: a new listing shortens the window and the note names it, the start date and the range asked for', () => {
  const a = ser('OLD', 1300, 0), b = ser('NEW', 120, 1180); const al = alignIndexed([a, b], '3Y')!; const cov = coverageOf([a, b], al, '3Y');
  assert.equal(cov.shorter, true); assert.equal(al.t.length, 120); assert.equal(cov.byName.find((x) => x.id === 'NEW')!.limiting, true); assert.equal(cov.byName.find((x) => x.id === 'OLD')!.limiting, false);
  assert.match(cov.notes[0], /^The window is 4 months, not 3Y: NEW \(from \d+ \w{3} \d{4}\) has no earlier closes in this data/);
});
test('coverage: a full-length window raises no shortening note; Max never does', () => {
  const a = ser('A', 900, 0), b = ser('B', 900, 0);
  assert.deepEqual(coverageOf([a, b], alignIndexed([a, b], '1Y')!, '1Y').notes, []); assert.equal(coverageOf([a, b], alignIndexed([a, b], 'Max')!, 'Max').shorter, false);
});
test('coverage: a name whose latest close is older is named, and the window ends on the shared date', () => {
  const a = ser('A', 400, 0), b = ser('B', 396, 0); const al = alignIndexed([a, b], '1Y')!; const cov = coverageOf([a, b], al, '1Y');
  assert.equal(al.t[al.t.length - 1], b.t[395]); assert.match(cov.notes.join(' '), /B's latest close is .*earlier than .* for the others/);
});
test('drawdown lines: zero at the start, never positive, the Nifty included, and the deepest value equals maxDrawdown of the same line', () => {
  const t = [T0, T0 + D, T0 + 2 * D, T0 + 3 * D]; const al = { t, lines: [{ id: 'A', v: [100, 120, 90, 110] }], nifty: [100, 100, 95, 99] };
  const dd = drawdownLines(al); assert.deepEqual(dd.map((x) => x.id), ['A', 'Nifty 50']); assert.equal(dd[0].v[0], 0);
  assert.ok(dd.every((l) => l.v.every((v) => v <= 0)));
  assert.equal(Math.min(...dd[0].v).toFixed(6), maxDrawdown(t.map((tt, i) => ({ t: tt, c: al.lines[0].v[i] })))!.depth.toFixed(6));
});
test('benchmark gap: a comparison with a missing Nifty carries the previous close forward and says the window starts at the first Nifty close', () => {
  const p: Pt[] = [{ t: T0, c: 10 }, { t: T0 + D, c: 11, n: 100 }, { t: T0 + 2 * D, c: 12, n: null }, { t: T0 + 3 * D, c: 13, n: 110 }];
  const c = compareSeries(p)!; assert.equal(c.trimmed, true); assert.equal(c.a[0].c, 100); assert.equal(c.b[1].c, 100, 'carried, not zero'); assert.ok(Math.abs(c.b[2].c - 110) < 1e-9);
});

// ---- table / chart agreement ----
test('table rows always include the first, last, highest and lowest drawn points, ascending and unique', () => {
  const v = Array.from({ length: 500 }, (_, i) => 100 + Math.sin(i / 20) * 30 + i * 0.05); const rows = pickRows(v, 24);
  assert.equal(rows[0], 0); assert.equal(rows[rows.length - 1], 499);
  assert.ok(rows.includes(v.indexOf(Math.max(...v)))); assert.ok(rows.includes(v.indexOf(Math.min(...v))));
  assert.ok(rows.length <= 24); assert.deepEqual(rows, [...new Set(rows)].sort((a, b) => a - b));
});
test('a short series is listed whole', () => { assert.deepEqual(pickRows([1, 2, 3], 24), [0, 1, 2]); assert.deepEqual(pickRows([], 24), []); });
test('chart and table agree: the table is built from the drawn values, so its extremes are the chart\'s extremes and its last row is the last drawn point', () => {
  const win = sliceRange(Array.from({ length: 700 }, (_, i) => ({ t: T0 + i * D, c: 100 + Math.sin(i / 15) * 20 + i * 0.1 })), '1Y').pts;
  const tbl = buildTable(win.map((p) => p.t), [{ key: 'c', label: 'Close', v: win.map((p) => p.c) }]);
  const listed = tbl.shown.map((i) => win[i].c);
  assert.equal(Math.max(...listed), Math.max(...win.map((p) => p.c))); assert.equal(Math.min(...listed), Math.min(...win.map((p) => p.c)));
  assert.equal(tbl.shown[tbl.shown.length - 1], win.length - 1); assert.equal(cellText(tbl.cols[0], win.length - 1), win[win.length - 1].c.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  assert.match(tableNote(tbl, 'daily closes'), new RegExp(`^${tbl.shown.length} of the ${win.length} daily closes drawn on the chart`));
});
test('a missing value is a dash in the table, never a zero', () => { assert.equal(cellText({ key: 'n', label: 'n', v: [null, NaN, 0] }, 0), '—'); assert.equal(cellText({ key: 'n', label: 'n', v: [null, NaN, 0] }, 1), '—'); assert.equal(cellText({ key: 'n', label: 'n', v: [null, NaN, 0] }, 2), '0.00'); });

// ---- the opening view ----
const hist = (days: number, nifty: 'all' | 'none' | 'late'): Pt[] => Array.from({ length: days }, (_, i) => ({ t: T0 + i * D, c: 100 + i * 0.1, n: nifty === 'none' ? null : nifty === 'late' && i < days - 100 ? null : 20000 + i }));
test('a new person opens on one year, stock against the Nifty, when the history fills a year and the Nifty is held', () => {
  const s = chartStart(hist(900, 'all'), undefined, false); assert.deepEqual([s.range, s.vs, s.why], ['1Y', true, 'default-1y-vs-nifty']);
});
test('no Nifty, a Nifty that starts late, or an instrument: one year as a plain price line, not a benchmark view', () => {
  assert.equal(chartStart(hist(900, 'none'), undefined, false).vs, false); assert.equal(chartStart(hist(900, 'late'), undefined, false).vs, false); assert.equal(chartStart(hist(900, 'all'), undefined, true).vs, false);
});
test('under a year of history: the longest range that exists, as a price line', () => { const s = chartStart(hist(120, 'all'), undefined, false); assert.equal(s.range, 'Max'); assert.equal(s.vs, false); });
test('a saved choice wins when the history can fill it; an unfillable one falls back', () => {
  assert.deepEqual(chartStart(hist(1300, 'all'), { range: '3Y', vs: false }, false), { range: '3Y', vs: false, why: 'saved' });
  assert.equal(chartStart(hist(900, 'all'), { range: '10Y' }, false).range, '1Y');
  assert.equal(chartStart(hist(900, 'all'), { vs: false }, false).vs, false, 'a saved "price only" is kept on a new range too');
});

// ---- trade-offs, financials, identity ----
test('trade-offs: who is ahead on which measured row, ties and unmeasured rows skipped, and the line says no ranking is given', () => {
  const t = tradeoffs([
    { group: 'g', label: 'ROCE', best: 'high', vals: [{ id: 'A', v: 30 }, { id: 'B', v: 20 }] },
    { group: 'g', label: 'PE', best: 'low', vals: [{ id: 'A', v: 30 }, { id: 'B', v: 20 }] },
    { group: 'g', label: 'growth', best: 'high', vals: [{ id: 'A', v: 10 }, { id: 'B', v: 10 }] },
    { group: 'g', label: 'debt', best: 'low', vals: [{ id: 'A', v: 1 }, { id: 'B', v: null }] },
  ], ['A', 'B']);
  assert.deepEqual(t.byName, [{ id: 'A', ahead: ['higher ROCE'] }, { id: 'B', ahead: ['lower PE'] }]); assert.deepEqual(t.skipped, ['growth', 'debt']);
  assert.match(t.sentence, /no overall ranking is given/); assert.doesNotMatch(t.sentence, /winner|best|better/i);
});
test('trade-offs with nothing measured for both says so instead of inventing a lead', () => { assert.match(tradeoffs([{ group: 'g', label: 'x', best: 'high', vals: [{ id: 'A', v: 1 }, { id: 'B', v: undefined }] }], ['A', 'B']).sentence, /do not separate these names/); });
test('financials takeaway: revenue, profit and margin over the years held; a loss has no yearly rate; a gap is not filled', () => {
  const f = financialsTakeaway([{ fy: 'FY22', rev_cr: 1000, pat_cr: 100 }, { fy: 'FY23', rev_cr: null, pat_cr: 120 }, { fy: 'FY24', rev_cr: 1210, pat_cr: 121 }]);
  assert.match(f.lines[0], /^Revenue went from ₹1,000 cr in FY22 to ₹1,210 cr in FY24, \+10\.0% a year over 2 years\.$/);
  assert.match(f.lines[1], /^Profit after tax went from ₹100 cr in FY22 to ₹121 cr in FY24, \+10\.0% a year\.$/ );
  assert.match(f.lines[2], /^Net margin .* went from 10\.0% to 10\.0%, unchanged\.$/);
  const loss = financialsTakeaway([{ fy: 'FY23', rev_cr: 100, pat_cr: -20 }, { fy: 'FY24', rev_cr: 120, pat_cr: 10 }]);
  assert.match(loss.lines[1], /from a loss of ₹20 cr in FY23 to ₹10 cr in FY24; a yearly rate is not defined across a loss or a zero/);
  assert.match(financialsTakeaway([]).lines[0], /No annual statements are held/); assert.match(financialsTakeaway([{ fy: 'FY24', rev_cr: 5 }]).lines[0], /Too few years/);
});
test('a lender\'s margins are left out of the financials takeaway when the screen withholds them', () => {
  const y = [{ fy: 'FY23', rev_cr: 100, pat_cr: 10 }, { fy: 'FY24', rev_cr: 120, pat_cr: 30 }];
  assert.equal(financialsTakeaway(y).lines.length, 3); assert.equal(financialsTakeaway(y, { margins: false }).lines.length, 2); assert.ok(!financialsTakeaway(y, { margins: false }).lines.join(' ').includes('margin'));
});
test('cagr and net margin refuse zero, negative and missing ends', () => {
  assert.equal(cagr(100, 121, 2)!.toFixed(4), '10.0000'); assert.equal(cagr(0, 5, 2), null); assert.equal(cagr(-5, 5, 2), null); assert.equal(cagr(5, -1, 2), null); assert.equal(cagr(null, 5, 1), null);
  assert.equal(netMargin({ fy: 'x', pat_cr: 10, rev_cr: 100 }), 10); assert.equal(netMargin({ fy: 'x', pat_cr: 10, rev_cr: 0 }), null); assert.equal(netMargin({ fy: 'x', pat_cr: null, rev_cr: 5 }), null); assert.equal(netMargin({ fy: 'x', pat_cr: -10, rev_cr: 100 }), -10);
});
test('series identity is stable: slot 0 is always the same colour and marker, the benchmark is always dashed grey, and no slot is red, green or lime', () => {
  assert.deepEqual(styleOf(0, 'A'), { slot: 0, color: 'var(--series-1)', dash: '', marker: 'circle', width: 2.25, label: 'A' });
  assert.equal(styleOf(-1, 'Nifty 50').dash, '6 4'); assert.equal(styleOf(-1, 'Nifty 50').color, 'var(--ink-3)');
  const colours = [0, 1, 2].map((k) => styleOf(k, '').color); assert.equal(new Set(colours).size, 3); assert.equal(new Set([0, 1, 2].map((k) => styleOf(k, '').marker)).size, 3);
  for (const c of colours) assert.doesNotMatch(c, /up|down|accent|lime/);
});
test('marker paths are closed shapes; labels are spread apart without crossing and stay inside the plot', () => {
  for (const m of ['circle', 'square', 'triangle', 'diamond'] as const) assert.match(markerPath(m, 10, 10), /Z$/);
  const s = spreadLabels([0.5, 0.52, 0.51, 0.99]); const sorted = [...s].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] >= 0.0899); assert.ok(sorted[0] >= 0.04 - 1e-9 && sorted[sorted.length - 1] <= 0.96 + 1e-9);
  assert.ok(s[0] < s[2] && s[2] < s[1], 'order is kept');
});
