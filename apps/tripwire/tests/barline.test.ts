// The price chart's last-bar caption (13 Nov 2026, v5; master prompt 2.3b leftover): a bar still forming says so, a stale or missing series is stated, a confirmed one prints nothing extra.
// The clock is a parameter: nothing here reads the live one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { barLine } from '../src/barline.ts';

const ist = (iso: string, h: number, m = 0) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), h, m) - 330 * 60000;
const T = (d: string) => Date.parse(`${d}T03:45:00Z`) / 1000;   // 09:15 IST of that day
const bar = (d: string, forming = false) => ({ t: T(d), ...(forming ? { forming: true } : {}) });

test('a last bar whose session is still on says "Last bar still forming", with the day and the time it was seen', () => {
  const now = ist('2026-11-12', 11, 5); const l = barLine([bar('2026-11-11'), bar('2026-11-12')], now);
  assert.equal(l.status, 'forming'); assert.match(l.text!, /^Last bar still forming: 12 Nov 2026 is provisional until its session closes \(seen 11:05 IST\)\.$/); assert.match(l.detail!, /2026-11-12 is still forming, observed 11:05 IST/);
});
test('a provider that marks the bar forming is believed, even after the clock says the session is over', () => {
  assert.equal(barLine([bar('2026-11-11'), bar('2026-11-12', true)], ist('2026-11-12', 17, 0)).status, 'forming');
});
test('the same bar after 16:00 IST is confirmed, and a confirmed last bar prints nothing extra', () => {
  const l = barLine([bar('2026-11-11'), bar('2026-11-12')], ist('2026-11-12', 16, 0)); assert.equal(l.status, 'confirmed'); assert.equal(l.text, null); assert.equal(l.detail, 'Confirmed through 2026-11-12');
});
test('a series that ends before the last finished session is stale, said with its own last day', () => {
  const l = barLine([bar('2026-11-09'), bar('2026-11-11')], ist('2026-11-13', 17, 0)); assert.equal(l.status, 'stale'); assert.match(l.text!, /^Last bar is 11 Nov 2026: a newer session has finished and its bar is not in this data yet\.$/);
});
test('weekends and a listed holiday do not make a bar stale', () => {
  assert.equal(barLine([bar('2026-11-13')], ist('2026-11-15', 12)).status, 'confirmed', 'a Sunday: Friday is the last session');
  assert.equal(barLine([bar('2026-11-09')], ist('2026-11-10', 20)).status, 'confirmed', 'Tue 10 Nov is Diwali: NSE is shut, Monday is the last session');
});
test('no bars, or an unreadable time, is "No daily bars to show."', () => {
  for (const b of [[], null, undefined, [{ t: NaN }]]) { const l = barLine(b as never, ist('2026-11-12', 11)); assert.equal(l.status, 'missing'); assert.equal(l.text, 'No daily bars to show.'); }
});
test('the caption makes no prediction and is wired into the price chart', () => {
  const l = barLine([bar('2026-11-12')], ist('2026-11-12', 11)); assert.doesNotMatch(l.text!, /will|expect|likely|forecast|target|should/i);
  const src = readFileSync(fileURLToPath(new URL('../src/screens/PriceChart.tsx', import.meta.url)), 'utf8'); assert.match(src, /barLine\(all, Date\.now\(\)\)/); assert.match(src, /data-bar-status/);
});
