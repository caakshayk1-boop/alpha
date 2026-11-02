import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyPoints, missingEvidence, reportFacts, thesisBlock } from '../src/reportview.ts';
import { bannerSlot, hintSaysBanner } from '../src/bannerslot.ts';
import { openAllForPrint, restoreAfterPrint } from '../src/printmode.ts';

const full = { row: { next_earnings: '2026-11-08', pe_pctile: 40, stale: false, last_date: '2026-10-30' }, years: [{ fy: 'FY23' }, { fy: 'FY24' }, { fy: 'FY25' }, { fy: 'FY26' }],
  inst: { promoter: 50, fii: 10, dii: 12, period: 'Sep 2026', series: [{ p: 'a', f: 1, d: 1 }, { p: 'b', f: 1, d: 1 }] }, eligibility: { notes: [] }, chart: { points: 900, hasNifty: true, hasVolume: true }, thesisCount: 1 };
const ids = (i: Parameters<typeof missingEvidence>[0]) => missingEvidence(i).map((m) => m.id);

test('a company with everything still lists what no company here has: events and a valuation series', () => {
  assert.deepEqual(ids(full), ['events', 'valuation', 'ownership']);
  assert.match(missingEvidence(full)[0].detail, /No dividend, split, filing or announcement/);
  assert.match(missingEvidence(full)[1].detail, /percentile/);
});
test('absent data is named from the data that is absent, never invented', () => {
  const m = missingEvidence({ ...full, row: { ...full.row, next_earnings: null, pe_pctile: null }, inst: null, years: [{ fy: 'FY26' }], chart: { points: 120, hasNifty: false, hasVolume: false }, thesisCount: 0, eligibility: { notes: ['ROCE is withheld for a lender.'] } });
  const got = m.map((x) => x.id);
  for (const k of ['events', 'valuation', 'ownership', 'statements', 'withheld', 'benchmark', 'history', 'volume', 'thesis']) assert.ok(got.includes(k as never), k);
  assert.match(m.find((x) => x.id === 'events')!.detail, /No dated event of any kind/);
  assert.match(m.find((x) => x.id === 'valuation')!.detail, /None\./);
  assert.match(m.find((x) => x.id === 'ownership')!.detail, /No shareholding pattern/);
  assert.match(m.find((x) => x.id === 'statements')!.detail, /^1 fiscal year is held/);
  assert.match(m.find((x) => x.id === 'history')!.detail, /120 daily closes/);
});
test('ownership: a snapshot without earlier quarters is a gap; no statements and no chart are said plainly', () => {
  assert.match(missingEvidence({ ...full, inst: { ...full.inst, series: [] } }).find((x) => x.id === 'ownership')!.detail, /Only the latest shareholding snapshot \(Sep 2026\)/);
  assert.match(missingEvidence({ ...full, years: [] }).find((x) => x.id === 'statements')!.detail, /^None are held/);
  assert.match(missingEvidence({ ...full, chart: null }).find((x) => x.id === 'history')!.detail, /could not be read/);
  assert.ok(ids({ ...full, row: { ...full.row, stale: true } }).includes('stale'));
});
test('key points: first, last, highest and lowest close; ties keep the earlier day; too short is empty', () => {
  const k = keyPoints([{ t: 1, c: 10 }, { t: 2, c: 30 }, { t: 3, c: 5 }, { t: 4, c: 30 }, { t: 5, c: 12 }]);
  assert.deepEqual(k.map((x) => [x.id, x.t, x.c]), [['first', 1, 10], ['last', 5, 12], ['high', 2, 30], ['low', 3, 5]]);
  assert.deepEqual(keyPoints([{ t: 1, c: 1 }]), []);
  assert.deepEqual(keyPoints([{ t: 1, c: NaN }, { t: 2, c: 3 }]), []);
});
test('facts carry a source; a fact the app does not hold is simply absent', () => {
  const f = reportFacts({ name: 'X', lastDate: '2026-10-30', price: '₹10', nextEarnings: null, fy: null, builtOn: '2026-10-31' });
  assert.deepEqual(f.map((x) => x.label), ['Last close in the data', 'Screen built']); assert.ok(f.every((x) => x.source.length > 10));
});
const v = (o: object) => ({ at: '2026-10-01', thesis: '', support: '', counter: '', decision: '', invalidation: '', trigger: '', reviewOn: null, ...o });
test('thesis block: the newest entry and its current version; empty is the one-line note', () => {
  assert.deepEqual(thesisBlock([]).note, 'No thesis recorded.');
  assert.equal(thesisBlock([{ versions: [v({})] }]).present, false);
  const t = thesisBlock([{ versions: [v({ thesis: 'old' }), v({ thesis: 'new', invalidation: 'below 100', reviewOn: '2026-12-01' })] }, { versions: [v({ thesis: 'other' })] }]);
  assert.equal(t.present, true); assert.equal(t.versions, 2); assert.equal(t.others, 1);
  assert.deepEqual(t.lines.map((l) => l.label), ['Thesis', 'Invalidation (wrong if)', 'Review date']); assert.equal(t.lines[0].text, 'new');
});
test('banner slot: reserved while the answer is pending and likely, never hidden when due, gone when not needed', () => {
  const now = Date.parse('2026-11-02T06:00:00Z');
  assert.equal(bannerSlot({ online: true, loading: true, hasData: false, behind: null, hintDay: null, now }), 'reserve');
  assert.equal(bannerSlot({ online: true, loading: true, hasData: false, behind: null, hintDay: '2026-10-26', now }), 'reserve');
  assert.equal(bannerSlot({ online: true, loading: true, hasData: false, behind: null, hintDay: '2026-10-30', now }), 'none');
  assert.equal(bannerSlot({ online: true, loading: false, hasData: true, behind: 5 }), 'show');
  assert.equal(bannerSlot({ online: true, loading: false, hasData: true, behind: 1 }), 'none');
  assert.equal(bannerSlot({ online: true, loading: false, hasData: true, behind: null }), 'none');
  assert.equal(bannerSlot({ online: true, loading: false, hasData: false, behind: null }), 'none');
  assert.equal(bannerSlot({ online: false, loading: true, hasData: false, behind: null }), 'none');
  assert.equal(hintSaysBanner('garbage', now), true);
});
test('print expansion opens only what it finds closed, skips data-print-closed, and restores exactly that', () => {
  const mk = (open: boolean, keep = false) => { const attrs = new Map<string, string>(); if (open) attrs.set('open', ''); if (keep) attrs.set('data-print-closed', ''); return { attrs, setAttribute: (k: string, x: string) => attrs.set(k, x), removeAttribute: (k: string) => attrs.delete(k) }; };
  const ds = [mk(false), mk(true), mk(false, true)];
  const root = { querySelectorAll: (sel: string) => ({ forEach: (fn: (d: unknown) => void) => ds.filter((d) => sel.includes('data-print-opened') ? d.attrs.has('data-print-opened') : !d.attrs.has('open') && !d.attrs.has('data-print-closed')).forEach(fn) }) } as never;
  assert.equal(openAllForPrint(root), 1); assert.ok(ds[0].attrs.has('open')); assert.ok(!ds[2].attrs.has('open'));
  assert.equal(restoreAfterPrint(root), 1); assert.ok(!ds[0].attrs.has('open')); assert.ok(ds[1].attrs.has('open'));
});
