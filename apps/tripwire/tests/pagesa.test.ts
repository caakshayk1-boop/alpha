// Phase 4, lane A (Today, Markets, Discover, Signals, Auto and Record): the market takeaway, the sample walkthrough, sector ranking, research presets, the pick ladder and its paper assumptions,
// P&L attribution, the realised curve and the plain reading of a short record. All offline, all pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { marketTakeaway, DISAGREE_MOVE_PCT, VIX_MENTION_PCT } from '../src/takeaway.ts';
import { FORBIDDEN } from '../src/brief.ts';
import { SAMPLE_NOTICE, SAMPLE_STEPS, SAMPLE_TITLE } from '../src/samplewalk.ts';
import { rankSectors, sectorsFromRows } from '../src/sectorrank.ts';
import { MIN_SECTOR } from '../shared/breadthrule.js';
import { PRESETS, activePreset, applyPreset, clearPreset, isPresetOn, presetCount, presetCriteria, presetState, condWords } from '../src/presets.ts';
import { DEFAULT_STATE, parseDiscover, serialiseDiscover, runScreen } from '../src/discoverstate.ts';
import { pickLadderInput, paperAssumptions, ladderModel } from '../src/ladder.ts';
import { targetPrices } from '../src/levels.ts';
import { SLIPPAGE_PCT, GAP_SKIP_PCT } from '../src/tracker.ts';
import { attribute, realisedCurve, readRecord } from '../src/attribution.ts';
import { reconciles } from '../src/contribution.ts';
import { MIN_TRADES } from '../src/ledger.ts';
import type { Row } from '../src/screen.ts';

/* ---------------- the takeaway ---------------- */
const base = { niftyCh: 0.9, vixCh: -1, upPct: 54, downPct: 12, nTrend: 812, live: false, behind: 0 };
// 11 Nov 2026 (revamp v2): the sentence says the index move and whether breadth agrees; it no longer restates the breadth shares (the gauge beside it shows them) nor the screen's lag (the banner says it).
test('takeaway: the index move and whether breadth agrees, all from the inputs; the shares are not restated', () => {
  const t = marketTakeaway(base)!;
  assert.equal(t.text, 'Nifty +0.9% at the last close, and breadth agrees.'); assert.equal(t.word, 'Broad strength'); assert.equal(t.disagree, false);
  assert.ok(!/\d+% of|uptrend|downtrend/.test(t.text), 'the breadth shares are left to the gauge');
  assert.equal(marketTakeaway({ ...base, live: true })!.text, 'Nifty +0.9%, and breadth agrees.', 'a live print is not called a close');
  assert.equal(marketTakeaway({ ...base, live: true, niftyCh: 1.4, upPct: 4, downPct: 45 })!.text, 'Nifty +1.4%, but breadth is weak.');
  assert.equal(marketTakeaway({ ...base, live: true, niftyCh: 1.4, upPct: 40, downPct: 30 })!.text, 'Nifty +1.4%; breadth is mixed.');
  assert.equal(marketTakeaway({ ...base, live: true, niftyCh: 0.2, upPct: 60, downPct: 10 })!.text, 'Nifty +0.2%; breadth is strong.', 'a flat index neither agrees nor disagrees');
});
test('takeaway: the index and the breadth are said to disagree only past the printed threshold', () => {
  const up = marketTakeaway({ ...base, niftyCh: 1.2, upPct: 20, downPct: 50 })!; assert.equal(up.disagree, true); assert.match(up.text, /, but breadth is weak\.$/);
  assert.equal(marketTakeaway({ ...base, niftyCh: DISAGREE_MOVE_PCT - 0.1, upPct: 20, downPct: 50 })!.disagree, false, 'a flat index agrees with anything');
  const dn = marketTakeaway({ ...base, niftyCh: -1.1, upPct: 60, downPct: 10 })!; assert.equal(dn.disagree, true);
  assert.equal(marketTakeaway({ ...base, niftyCh: 1.1, upPct: 40, downPct: 30 })!.disagree, false, 'mixed breadth neither agrees nor disagrees');
});
test('takeaway: the VIX is mentioned only when it moved enough; a stale screen is NOT restated (the banner says it once); missing parts are left out', () => {
  assert.ok(!/VIX/.test(marketTakeaway({ ...base, vixCh: VIX_MENTION_PCT - 0.1 })!.text)); assert.match(marketTakeaway({ ...base, vixCh: -VIX_MENTION_PCT })!.text, /India VIX −5\.0%/);
  assert.ok(!/behind|session/.test(marketTakeaway({ ...base, behind: 2 })!.text + marketTakeaway({ ...base, behind: 1 })!.text), 'the lag is said by the banner, not again in the sentence');
  const noBreadth = marketTakeaway({ ...base, upPct: null, downPct: null, nTrend: 0 })!; assert.equal(noBreadth.parts.breadth, false); assert.equal(noBreadth.text, 'Nifty +0.9% at the last close.');
  const noIndex = marketTakeaway({ ...base, niftyCh: null })!; assert.equal(noIndex.parts.index, false); assert.equal(noIndex.text, 'Breadth is strong.');
  assert.equal(marketTakeaway(base)!.text, marketTakeaway({ ...base })!.text, 'deterministic: the same inputs give the same sentence');
  assert.equal(marketTakeaway({ ...base, shares: true })!.text, 'Nifty +0.9% at the last close, and breadth agrees. 54% of 812 liquid names are in an uptrend and 12% in a downtrend.', 'a page with no gauge (Markets) asks for the shares');
  assert.equal(marketTakeaway({ ...base, niftyCh: null, upPct: null, downPct: null, nTrend: 0 }), null, 'nothing measured, nothing said');
});
test('takeaway: never predicts, advises or explains a cause, across a sweep of inputs', () => {
  for (const n of [-3, -0.8, 0, 0.6, 2.4]) for (const [u, d] of [[60, 10], [40, 30], [15, 55], [0, 0]]) for (const v of [-9, 0, 7]) for (const live of [true, false]) {
    const t = marketTakeaway({ niftyCh: n, vixCh: v, upPct: u, downPct: d, nTrend: 800, live, behind: 1 }); assert.ok(t && !FORBIDDEN.test(t.text), t?.text);
  }
});

/* ---------------- the sample walkthrough ---------------- */
test('sample walkthrough: clearly labelled, and holds no figure, no company and no record', () => {
  const all = [SAMPLE_TITLE, SAMPLE_NOTICE, ...SAMPLE_STEPS.flatMap((s) => [s.title, s.body, s.example ?? ''])].join(' ');
  assert.match(SAMPLE_TITLE, /sample/i); assert.match(SAMPLE_NOTICE, /not a real company, price, signal or record/); assert.match(SAMPLE_NOTICE, /nothing here is saved/);
  assert.ok(!/\d/.test(all), 'no digit anywhere: nothing that could pass for data'); assert.ok(!/₹|\$|%/.test(all)); assert.ok(!/\b[A-Z]{3,}\b/.test(all.replace(/\bNSE\b/g, '')), 'no ticker-like word');
  for (const s of SAMPLE_STEPS) if (s.example) assert.match(s.example, /^Sample wording:/);
  assert.equal(SAMPLE_STEPS.length, 4);
});

/* ---------------- sectors ---------------- */
test('sector ranking: strongest net first, ties by sample then name, and a sector under MIN_SECTOR is not ranked', () => {
  assert.equal(MIN_SECTOR, 8);
  const r = rankSectors([{ k: 'B', n: 20, up: 50, down: 10 }, { k: 'A', n: 30, up: 50, down: 10 }, { k: 'C', n: 9, up: 10, down: 60 }, { k: 'Tiny', n: MIN_SECTOR - 1, up: 100, down: 0 }]);
  assert.deepEqual(r.ranked.map((s) => s.k), ['A', 'B', 'C']); assert.deepEqual(r.ranked.map((s) => s.rank), [1, 2, 3]); assert.deepEqual(r.ranked.map((s) => s.net), [40, 40, -50]);
  assert.deepEqual(r.below, [{ k: 'Tiny', n: 7 }]); assert.equal(rankSectors([{ k: 'X', n: MIN_SECTOR, up: 1, down: 1 }]).ranked.length, 1, 'exactly the minimum is ranked');
});
test('sector ranking counts from the rows: liquid names with a trend only', () => {
  const up = { liquid: true, price: 110, sma20: 105, sma50: 100, sma200: 90, r3m: 5 } as Partial<Row>; const down = { liquid: true, price: 80, sma20: 85, sma50: 90, sma200: 100, r3m: -5 } as Partial<Row>;
  const rows = [...Array.from({ length: 3 }, (_, i) => ({ sym: `U${i}`, name: 'x', sector: 'S', ...up })), { sym: 'D', name: 'x', sector: 'S', ...down }, { sym: 'NL', name: 'x', sector: 'S', ...up, liquid: false }, { sym: 'NT', name: 'x', sector: 'S', liquid: true }] as Row[];
  const s = sectorsFromRows(rows); assert.equal(s.length, 1); assert.equal(s[0].n, 4); assert.equal(s[0].up, 75); assert.equal(s[0].down, 25);
});

/* ---------------- presets ---------------- */
const row = (o: Partial<Row>): Row => ({ sym: 'X', name: 'X', liquid: true, ...o } as Row);
test('presets: criteria are built from the filter state and printed in words', () => {
  const by = Object.fromEntries(PRESETS.map((p) => [p.id, presetCriteria(p)]));
  assert.deepEqual(by.leaders, ['Trend: Uptrend', 'Ahead of the Nifty, 3 months']);
  assert.deepEqual(by['quality-fair'], ['PE 15 or less', 'Median ROCE 20%+ (financial sector left out)']);
  assert.deepEqual(by['debt-light'], ['Median ROCE 20%+ (financial sector left out)', 'Debt to equity at most 0.50']);
  assert.deepEqual(by.pullback, ['Trend: Uptrend', 'RSI (14) at least 35', 'RSI (14) at most 50']); assert.deepEqual(by.washed, ['Trend: Downtrend', 'RSI (14) at most 30']);
  assert.equal(condWords({ m: 'de', op: 'lte', v: 0.5 }), 'Debt to equity at most 0.50');
  for (const p of PRESETS) { assert.ok(p.id && p.title && p.line); assert.ok(!/\b(best|top|buy|sell|recommend|winner)\b/i.test(`${p.title} ${p.line}`), p.id); }
});
test('presets: URL parity. A preset is only filters, so its link round-trips and the same preset is recognised after a reload', () => {
  for (const p of PRESETS) {
    const st = applyPreset(DEFAULT_STATE, p); const q = serialiseDiscover(st); const back = parseDiscover(q);
    assert.deepEqual(back.ignored, [], p.id); assert.equal(serialiseDiscover(back.state), q, p.id); assert.equal(activePreset(back.state)?.id, p.id, p.id);
    assert.equal(serialiseDiscover(presetState(p)), q);
  }
});
test('presets: choosing one replaces the quick filters and conditions but keeps the search, sector, size, sort, view and picks; clearing leaves those too', () => {
  const mine = { ...DEFAULT_STATE, q: 'tata', sector: 'IT', tier: 'large', view: 'table' as const, sort: { key: 'rs3m' as const, dir: 'desc' as const }, pick: ['TCS'], trend: 'down' as const, cond: [{ m: 'pe' as const, op: 'lte' as const, v: 20 }], show: 72 };
  const a = applyPreset(mine, PRESETS[0]); assert.deepEqual([a.q, a.sector, a.tier, a.view, a.sort.key, a.pick.join()], ['tata', 'IT', 'large', 'table', 'rs3m', 'TCS']);
  assert.equal(a.trend, 'up'); assert.deepEqual(a.cond, []); assert.equal(a.show, 24); assert.ok(isPresetOn(a, PRESETS[0])); assert.ok(!isPresetOn(a, PRESETS[1]));
  assert.equal(activePreset(clearPreset(a)), null); assert.equal(clearPreset(a).q, 'tata'); assert.equal(activePreset(DEFAULT_STATE), null);
  assert.equal(activePreset({ ...a, cond: [{ m: 'pe', op: 'lte', v: 20 }] }), null, 'an extra condition is no longer exactly the preset');
});
test('presets: the count is the Discover pipeline\'s count, and a name with no figure is left out, never zero', () => {
  const rows = [row({ sym: 'A', price: 110, sma20: 105, sma50: 100, sma200: 90, r3m: 5, rs3m: 3, rsi: 40 }), row({ sym: 'B', price: 110, sma20: 105, sma50: 100, sma200: 90, r3m: 5, rs3m: -2, rsi: 40 }), row({ sym: 'C', price: 110, sma20: 105, sma50: 100, sma200: 90, r3m: 5, rs3m: 3 })];
  const lead = PRESETS.find((p) => p.id === 'leaders')!; const c = presetCount(rows, lead); assert.equal(c.n, runScreen(rows, presetState(lead)).ordered.length); assert.equal(c.n, 2); assert.equal(c.of, 3);
  const pull = PRESETS.find((p) => p.id === 'pullback')!; const p = presetCount(rows, pull); assert.equal(p.n, 2, 'A and B have RSI 40'); assert.ok(p.unmeasured >= 1, 'C has no RSI and is counted as unmeasured, not as a match');
});

/* ---------------- the pick ladder and its paper assumptions ---------------- */
test('a pick\'s ladder uses the booked target arithmetic, from the signal close, with nothing hit', () => {
  const pick = { asOf: '2026-10-29', horizon: 20, ref: 100, stop: 95 }; const i = pickLadderInput(pick)!; const t = targetPrices(pick, false, null)!;
  assert.equal(i.basis, 'signal'); assert.equal(i.entry, 100); assert.equal(i.stop, 95); assert.equal(i.t1, Math.round(t.t1 * 100) / 100); assert.equal(i.t2, Math.round(t.t2 * 100) / 100); assert.ok(i.t1 > 100 && i.t2 > i.t1);
  assert.equal(i.t1Hit || i.t2Hit, false); assert.equal(i.mark, null); const m = ladderModel(i); assert.equal(m.basis, 'signal'); assert.ok(m.notes.some((n) => /worked from the signal close/.test(n))); assert.equal(m.marker, null);
  assert.equal(pickLadderInput({ asOf: '2026-10-29', horizon: 20, ref: 90, stop: 95 }), null, 'a stop above the close has no ladder');
});
test('paper assumptions state the constants the tracker applies, and say it is paper', () => {
  const a = paperAssumptions(20, 0.25).join(' '); assert.match(a, /Paper only/); assert.ok(a.includes(`${SLIPPAGE_PCT}% slippage`)); assert.ok(a.includes(`more than ${GAP_SKIP_PCT}% above the signal close`)); assert.match(a, /0\.25% round trip/); assert.match(a, /session 20/);
});
test('the renames are everywhere in the app: "Add paper trade" and "Evidence", and the old words are gone from the source', () => {
  const dir = new URL('../src/', import.meta.url); const files: string[] = [];
  const walk = (d: URL) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(new URL(`${e.name}/`, d)); else if (/\.(tsx?|css)$/.test(e.name)) files.push(new URL(e.name, d).pathname); } }; walk(dir);
  const src = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  assert.ok(!/Take it myself/.test(src)); assert.ok(!/label: 'Proof'/.test(src)); assert.ok(/Add paper trade/.test(src)); assert.ok(/title="Evidence and method"/.test(src));   // 11 Nov 2026: Evidence is a section of the Record, not a tab
});

/* ---------------- attribution ---------------- */
const pos = (id: string, engine: string, status: string, pnl: number | null, r: number | null = null) => ({ id, sym: id.toUpperCase(), engine, status, pnl, r });
test('attribution: engines and positions each add up to the total, signed, to the paisa', () => {
  const rows = [pos('a', 'MOM', 'open', 1200.55), pos('b', 'MOM', 'open', -300.1), pos('c', 'QLT', 'open', 40.05), pos('d', 'QLT', 'closed', -810.35, -1.03), pos('e', 'MOM', 'closed', 2500.1, 2.4), pos('w', 'MOM', 'waiting', null), pos('z', 'MOM', 'open', null),
    ...Array.from({ length: 12 }, (_, i) => pos(`p${i}`, i % 2 ? 'QLT' : 'MOM', 'open', (i % 3 ? 1 : -1) * (10.07 + i * 3.31)))];
  const a = attribute(rows, (e) => ({ MOM: 'Momentum', QLT: 'Quality' } as Record<string, string>)[e] ?? e, 8);
  const paise = (v: number) => Math.round(v * 100); const total = rows.filter((r) => r.pnl != null && (r.status === 'open' || r.status === 'closed')).reduce((s, r) => s + paise(r.pnl!), 0);
  assert.equal(paise(a.total), total); assert.equal(a.byEngine.reduce((s, e) => s + paise(e.total), 0), total); assert.ok(a.engineReconciles); assert.ok(a.positionsReconcile); assert.ok(reconciles(a.positions));
  assert.equal(paise(a.realised + a.unrealised), total); assert.equal(a.unpriced, 1, 'the open position with no figure is named, not zero-filled; a waiting one is not a position yet');
  assert.ok(a.positions.rows.some((r) => r.value < 0), 'a loss is in the first view'); assert.ok(a.positions.other); assert.deepEqual(a.byEngine.map((e) => e.label).sort(), ['Momentum', 'Quality']);
  const mom = a.byEngine.find((e) => e.engine === 'MOM')!; assert.equal(mom.closed, 1); assert.ok(mom.losses < 0 && mom.gains > 0);
});
test('attribution: a closed position with no R is not counted (same rule as the book\'s summary); nothing priced gives no engines', () => {
  assert.equal(attribute([pos('a', 'MOM', 'closed', 10, null)]).byEngine.length, 0); assert.equal(attribute([]).total, 0);
});

/* ---------------- the realised curve ---------------- */
test('realised curve: running total by exit day, a running peak, and the largest drop from it', () => {
  const c = realisedCurve([{ id: '1', exitDay: '2026-10-27', r: 2 }, { id: '2', exitDay: '2026-10-28', r: -1.03 }, { id: '3', exitDay: '2026-10-28', r: -1.03 }, { id: '4', exitDay: '2026-10-29', r: 0.5 }, { id: '5', exitDay: null, r: 3 }, { id: '6', exitDay: '2026-10-30', r: null }]);
  assert.equal(c.trades, 4, 'a trade with no exit day or no R is not on the curve'); assert.deepEqual(c.points.map((p) => p.cum), [2, -0.06, 0.44]); assert.deepEqual(c.points.map((p) => p.peak), [2, 2, 2]);
  assert.deepEqual(c.points.map((p) => p.drop), [0, 2.06, 1.56]); assert.deepEqual(c.maxDrop, { r: 2.06, from: '2026-10-27', to: '2026-10-28' }); assert.equal(c.total, 0.44);
  assert.equal(c.points[1].n, 2);
});
test('realised curve: no trades is no curve; a run of losses is a drop from the start (zero), not from nothing', () => {
  const none = realisedCurve([]); assert.equal(none.points.length, 0); assert.equal(none.total, null); assert.equal(none.maxDrop, null);
  const l = realisedCurve([{ id: '1', exitDay: '2026-10-27', r: -1.03 }, { id: '2', exitDay: '2026-10-28', r: -1.03 }]); assert.deepEqual(l.maxDrop, { r: 2.06, from: null, to: '2026-10-28' }); assert.equal(l.total, -2.06);
  assert.equal(realisedCurve([{ id: '1', exitDay: '2026-10-27', r: 1 }, { id: '2', exitDay: '2026-10-28', r: 1 }]).maxDrop, null, 'only gains: no drop');
});

/* ---------------- reading a short record ---------------- */
test('record reading: a short record says it cannot tell, in numbers; it never says a strategy works', () => {
  const four = readRecord([-1.03, -1.03, -1.03, -1.03]); assert.equal(four.enough, false); const t = four.lines.join(' ');
  /* 12 Nov 2026: worded as resolved observations (ledgerview.ts); the intent, a short record is read as too short to tell, is unchanged */
  assert.match(t, /4 resolved observations have closed: 0 in profit, 4 at a loss, −4\.12R in total/); assert.match(t, new RegExp(`4 of ${MIN_TRADES} observations`)); assert.match(t, /cannot show whether the rules work/); assert.match(t, /Open positions are not in these figures/);
  assert.equal(readRecord([]).enough, false); assert.match(readRecord([]).lines[0], /Nothing has closed yet/);
});
test('record reading: it names a total that rests on one trade, and past the minimum it still says a minimum is not proof', () => {
  /* 12 Nov 2026: "observation", not "trade" (ledgerview.ts); intent unchanged */
  const one = readRecord([3, -1, -1, -0.5]).lines.join(' '); assert.match(one, /best single observation is \+3\.00R\. Without it the total would be −2\.50R, so the total rests on that one trade/);
  const many = readRecord(Array.from({ length: MIN_TRADES }, (_, i) => (i % 2 ? -1 : 1.5))); assert.equal(many.enough, true); assert.match(many.lines.join(' '), /minimum is not proof/);
  for (const rs of [[], [1], [-1, -1, -1], Array.from({ length: 40 }, (_, i) => (i % 3 ? 1 : -1))]) for (const l of readRecord(rs).lines) assert.ok(!/\b(proven|validated|reliable|guarantee|edge|profitable strategy)\b/i.test(l), l);
});
