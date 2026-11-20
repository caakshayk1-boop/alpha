import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, describe, evaluateWorkflows, describeWorkflow } from '../scripts/freshness.mjs';

const FRI_0845 = Date.parse('2026-11-20T03:15:00Z');   // Friday 08:45 IST: the newest finished session is Thursday 19 Nov
const feeds = (screen, regime = '2026-11-18', baro = '2026-11-18') => ({ screen: { price_date: screen }, regime: { today: { date: regime } }, barometer: { today: { nifty_date: baro } } });
const by = (rows, n) => rows.find((r) => r.name === n);

test('a screen on the newest finished session is fine; one session behind is stale (the 20 Nov case: screen on 18 Nov, newest 19 Nov)', () => {
  assert.equal(by(evaluate(feeds('2026-11-19'), FRI_0845), 'screen').ok, true);
  const r = by(evaluate(feeds('2026-11-18'), FRI_0845), 'screen'); assert.equal(r.ok, false); assert.equal(r.behind, 1);
  assert.match(describe(r), /STALE screen: 2026-11-18; newest finished session 2026-11-19; 1 session behind \(allowed 0\)/);
});
test('regime and barometer may trail by one session, not two', () => {
  assert.equal(by(evaluate(feeds('2026-11-19', '2026-11-18', '2026-11-18'), FRI_0845), 'regime').ok, true);
  assert.equal(by(evaluate(feeds('2026-11-19', '2026-11-17', '2026-11-17'), FRI_0845), 'barometer').ok, false);
});
test('a weekend and the morning after a weekend point at Friday; Monday morning with Friday data is current', () => {
  const sat = Date.parse('2026-11-21T04:00:00Z'), mon = Date.parse('2026-11-23T03:15:00Z');
  assert.equal(by(evaluate(feeds('2026-11-20'), sat), 'screen').ok, true);
  assert.equal(by(evaluate(feeds('2026-11-20'), mon), 'screen').ok, true);
  assert.equal(by(evaluate(feeds('2026-11-19'), mon), 'screen').behind, 1);
});
test('an exchange holiday is not a missed build: 24 Nov 2026 is an NSE holiday, so on Wed 25 Nov the newest finished session is Mon 23 Nov', () => {
  const wed = Date.parse('2026-11-25T03:15:00Z');
  const ok = by(evaluate(feeds('2026-11-23'), wed), 'screen'); assert.equal(ok.newest, '2026-11-23'); assert.equal(ok.behind, 0); assert.equal(ok.ok, true);
  const late = by(evaluate(feeds('2026-11-20'), wed), 'screen'); assert.equal(late.behind, 1, 'Monday 23 Nov is the one missing session; the holiday counts for none'); assert.equal(late.ok, false);
});
test('a missing feed or an unreadable date is stale, never assumed fine', () => {
  const rows = evaluate({ screen: null, regime: { today: {} }, barometer: { today: { nifty_date: 'n/a' } } }, FRI_0845);
  for (const r of rows) { assert.equal(r.ok, false, r.name); assert.equal(r.behind, null); }
  assert.match(describe(rows[0]), /STALE screen: no readable date/);
});

test('a producing workflow that is not active fails the check and says what to click; unreadable state is reported, not failed', () => {
  const rows = evaluateWorkflows({ 'stock_screen.yml': 'disabled_manually', 'regime.yml': 'active', 'barometer.yml': null });
  const by2 = (f) => rows.find((r) => r.file === f);
  assert.equal(by2('stock_screen.yml').ok, false); assert.match(describeWorkflow(by2('stock_screen.yml')), /OFF {3}stock_screen.yml: disabled_manually\. It makes: screen, screen-detail, swot\. Enable it: .*Enable workflow/);
  assert.equal(by2('regime.yml').ok, true);
  assert.equal(by2('barometer.yml').ok, true); assert.equal(by2('barometer.yml').unknown, true); assert.match(describeWorkflow(by2('barometer.yml')), /^UNKNOWN/);
  assert.equal(by2('newspaper.yml').unknown, true, 'a workflow with no state given is unknown, not assumed active');
});
