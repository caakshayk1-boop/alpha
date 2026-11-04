import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { isoOfNse, parseNse, mergeFlows, readFlows, validFile, crSigned, FLOW_KEEP, type FlowDay, type FlowFile } from '../src/fiidii.ts';

// the answer NSE gave on 4 Nov 2026 for the 3 Nov session, as received
const NSE = [{ buyValue: '16723.91', category: 'DII', date: '03-Nov-2026', netValue: '-3678.85', sellValue: '20402.76' }, { buyValue: '20970.51', category: 'FII/FPI', date: '03-Nov-2026', netValue: '6836.81', sellValue: '14133.7' }];
const day = (date: string, f: number, d: number): FlowDay => ({ date, fii: { buy: Math.max(f, 0) + 100, sell: Math.max(-f, 0) + 100, net: f }, dii: { buy: Math.max(d, 0) + 100, sell: Math.max(-d, 0) + 100, net: d } });

test('NSE dates: dd-Mon-yyyy becomes an ISO day, anything else is refused', () => {
  assert.equal(isoOfNse('03-Nov-2026'), '2026-11-03'); assert.equal(isoOfNse(' 3-nov-2026 '), '2026-11-03');
  for (const bad of ['31-Feb-2026', '2026-11-03', '03/11/2026', '03-Xyz-2026', '', null, undefined, 20261103]) assert.equal(isoOfNse(bad), null, String(bad));
});
test('the real NSE answer parses to the two nets, and net equals buy minus sell', () => {
  const d = parseNse(NSE)!; assert.equal(d.date, '2026-11-03');
  assert.deepEqual(d.fii, { buy: 20970.51, sell: 14133.7, net: 6836.81 }); assert.deepEqual(d.dii, { buy: 16723.91, sell: 20402.76, net: -3678.85 });
  assert.ok(Math.abs(d.fii.buy - d.fii.sell - d.fii.net) < 0.01 && Math.abs(d.dii.buy - d.dii.sell - d.dii.net) < 0.01);
  assert.ok(parseNse(NSE.map((r) => ({ ...r, buyValue: Number(r.buyValue).toLocaleString('en-IN', { maximumFractionDigits: 2 }) }))), 'figures with thousands separators are read');
});
test('anything that is not whole and consistent is refused, never repaired', () => {
  const bad: unknown[] = [null, {}, [], [NSE[0]], [NSE[1]], [NSE[0], NSE[0]], [...NSE, NSE[1]],
    [NSE[0], { ...NSE[1], date: '02-Nov-2026' }], [NSE[0], { ...NSE[1], netValue: '6000' }], [NSE[0], { ...NSE[1], buyValue: 'n/a' }], [NSE[0], { ...NSE[1], sellValue: '' }],
    [NSE[0], { ...NSE[1], buyValue: '-5', netValue: '-14138.7' }], [NSE[0], { ...NSE[1], date: 'yesterday' }], [NSE[0], { ...NSE[1], category: 'PRO' }]];
  for (const b of bad) assert.equal(parseNse(b), null, JSON.stringify(b).slice(0, 80));
});
test('history: one row per date, oldest first, capped, and a damaged old file is ignored', () => {
  const a = day('2026-11-02', -500, 300), b = day('2026-11-03', 200, -100);
  let f = mergeFlows(null, a, '2026-11-03T00:00:00Z'); f = mergeFlows(f, b, '2026-11-04T00:00:00Z');
  assert.deepEqual(f.rows.map((r) => r.date), ['2026-11-02', '2026-11-03']); assert.equal(f.schema, 'tripwire-fiidii/1');
  const again = mergeFlows(f, { ...b, fii: { ...b.fii, net: 250, buy: 350 } }, '2026-11-04T01:00:00Z'); assert.equal(again.rows.length, 2, 'a date is stored once'); assert.equal(again.rows[1].fii.net, 250, 'the later fetch of the same date replaces it');
  const many = Array.from({ length: FLOW_KEEP + 8 }, (_, i) => day(`2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, i, -i)).reduce<FlowFile | null>((acc, r) => mergeFlows(acc, r, 'now'), null)!;
  assert.equal(many.rows.length, FLOW_KEEP); assert.ok(many.rows.every((r, i, x) => !i || x[i - 1].date < r.date), 'sorted, no duplicates');
  assert.equal(mergeFlows({ schema: 'tripwire-fiidii/1', rows: 'broken' } as unknown as FlowFile, a, 'now').rows.length, 1, 'a damaged old file is replaced, not carried');
});
test('the reading says what was reported: five cases, a flat case, and a window only from three sessions', () => {
  assert.equal(readFlows([]), null);
  assert.equal(readFlows([parseNse(NSE)!])!.line, 'FIIs bought ₹6,837 cr while DIIs sold ₹3,679 cr.');
  assert.equal(readFlows([day('2026-11-02', -6000, 3000)])!.line, 'DIIs bought ₹3,000 cr, absorbing 50% of the ₹6,000 cr FIIs sold.');
  assert.equal(readFlows([day('2026-11-02', -2000, 3000)])!.line, 'DIIs bought ₹3,000 cr, more than the ₹2,000 cr FIIs sold.');
  assert.equal(readFlows([day('2026-11-02', 1500, 700)])!.line, 'Both were net buyers: FIIs ₹1,500 cr, DIIs ₹700 cr.');
  assert.equal(readFlows([day('2026-11-02', -1500, -700)])!.line, 'Both were net sellers: FIIs ₹1,500 cr, DIIs ₹700 cr.');
  assert.match(readFlows([day('2026-11-02', 0.2, 900)])!.line, /^FIIs were flat and DIIs were net buyers/);
  assert.equal(readFlows([day('2026-11-02', 1, 1), day('2026-11-03', 2, 2)])!.window, null, 'two sessions are not a window');
  const w = readFlows([day('2026-10-30', -100, 50), day('2026-11-02', -200, 100), day('2026-11-03', 6836.81, -3678.85)])!.window;
  assert.equal(w, 'Last 3 sessions: FIIs +₹6,537 cr, DIIs −₹3,529 cr.', 'recomputed: -100-200+6836.81 = 6536.81; 50+100-3678.85 = -3528.85');
  assert.ok(!/will|forecast|expect|likely|signal/i.test(readFlows([parseNse(NSE)!])!.line + ' ' + (w ?? '')), 'it describes, it does not predict');
  assert.equal(crSigned(0), '₹0 cr'); assert.equal(crSigned(-1234.5), '−₹1,235 cr'); assert.equal(crSigned(99999.5), '+₹1,00,000 cr');
});
test('the stored file is valid and holds the 3 Nov figures as NSE gave them', { skip: !existsSync(new URL('../ledger/fiidii.json', import.meta.url)) }, () => {
  const f = JSON.parse(readFileSync(new URL('../ledger/fiidii.json', import.meta.url), 'utf8')); assert.ok(validFile(f));
  const d = f.rows.find((r: FlowDay) => r.date === '2026-11-03'); assert.ok(d); assert.equal(d.fii.net, 6836.81); assert.equal(d.dii.net, -3678.85);
});
