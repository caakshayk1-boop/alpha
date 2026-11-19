import test from 'node:test';
import assert from 'node:assert/strict';
import { isQuiet, isMarketHours, ledgerAlerts, gateAlerts, watchAlerts, alertMessage } from '../alerts.js';

const at = (iso) => Date.parse(iso);
test('quiet hours are 23:00-07:30 Malaysia time; the market window is Mon-Fri 11:45-18:00 MYT', () => {
  assert.equal(isQuiet(at('2026-11-19T15:00:00Z')), true, '23:00 MYT');
  assert.equal(isQuiet(at('2026-11-19T23:29:00Z')), true, '07:29 MYT');
  assert.equal(isQuiet(at('2026-11-19T23:30:00Z')), false, '07:30 MYT');
  assert.equal(isQuiet(at('2026-11-19T14:59:00Z')), false, '22:59 MYT');
  assert.equal(isMarketHours(at('2026-11-19T03:45:00Z')), true, '11:45 MYT Thursday');
  assert.equal(isMarketHours(at('2026-11-19T03:44:00Z')), false);
  assert.equal(isMarketHours(at('2026-11-19T09:59:00Z')), true, '17:59 MYT');
  assert.equal(isMarketHours(at('2026-11-19T10:00:00Z')), false, '18:00 MYT');
  assert.equal(isMarketHours(at('2026-11-21T04:00:00Z')), false, 'Saturday');
});

const P = (id, sym, engine = 'MOM', rank = 1) => ({ id, sym, engine, rank, score: 90, asOf: '2026-11-10', stop: 100 });
const ledger = (picks, outcomes) => ({ ledger: { picks, outcomes } });

test('ledger: the first run records a baseline and says nothing', () => {
  const r = ledgerAlerts(null, ledger([P('a', 'TCS')], { a: { status: 'open' } }));
  assert.deepEqual(r.lines, []);
  assert.deepEqual(r.snap, { ids: ['a'], out: { a: ['open', 0] } });
});
test('ledger: target 1, close and a new pick are each reported once', () => {
  const prev = { ids: ['a', 'b'], out: { a: ['open', 0], b: ['open', 0] } };
  const now = ledger([P('a', 'TCS'), P('b', 'INFY', 'QLT'), P('c', 'WIPRO', 'ST', 3)], {
    a: { status: 'open', t1Hit: true, pct: 8.5, entry: 100, r: 1.1 },
    b: { status: 'closed', reason: 'Stop', pct: -4, r: -1 },
    c: { status: 'pending' },
  });
  const r = ledgerAlerts(prev, now);
  assert.equal(r.lines.length, 3);
  assert.match(r.lines.find((x) => /new pick/.test(x)), /WIPRO.*ST rank 3/);
  assert.match(r.lines.find((x) => /target 1/.test(x)), /TCS.*\+8\.50% since entry 100 · 1\.1 R · stop 100/);
  assert.match(r.lines.find((x) => /closed/.test(x)), /INFY.*Stop · -4\.00% · -1 R/);
  const again = ledgerAlerts(r.snap, now);
  assert.deepEqual(again.lines, [], 'same ledger, no second alert');
});
test('ledger: a big day of new picks is one summary line, skipped and void are silent', () => {
  const picks = Array.from({ length: 15 }, (_, i) => P('p' + i, 'S' + i, ['MOM', 'QLT', 'ST'][i % 3], (i % 5) + 1));
  const r = ledgerAlerts({ ids: [], out: {} }, ledger(picks, { p0: { status: 'skipped' }, p1: { status: 'void' } }));
  assert.equal(r.lines.length, 1);
  assert.match(r.lines[0], /15 new picks \(MOM 5, QLT 5, ST 5\); rank 1: S0, S5, S10/);
});

test('gate: flips and signal changes are reported, with the hub\'s own "alerts off" caveat', () => {
  assert.deepEqual(gateAlerts(null, { gate: { on: false }, signals: [] }).lines, []);
  const prev = { on: false, syms: [] };
  const r = gateAlerts(prev, { gate: { on: true }, signals: [{ sym: 'INFY' }], alertable: false });
  assert.match(r.lines[0], /gate flipped OFF → ON/);
  assert.match(r.lines[1], /new signal: INFY/);
  assert.match(r.lines[2], /hub says its own alerts are off/);
  assert.deepEqual(gateAlerts(r.snap, { gate: { on: true }, signals: [{ sym: 'INFY' }] }).lines, []);
  assert.equal(gateAlerts(prev, { gate: { on: true }, signals: [], alertable: true }).lines.length, 1, 'no caveat when the hub alerts are on');
});

const W = [{ sym: 'INFY', since: at('2026-11-19T00:00:00Z') }];
const NOW = at('2026-11-19T05:00:00Z');
const tick = (px, prev, live = true) => ({ quotes: { INFY: { px, prev, live } } });
test('watch: a 3% move alerts once a day per direction, only while the market is open and the quote is live', () => {
  const a = watchAlerts({ watch: W, tick: tick(96, 100), nowMs: NOW, market: true });
  assert.match(a.lines[0], /INFY<\/b> -4\.00% vs previous close \(96\)/);
  assert.equal(watchAlerts({ watch: W, tick: tick(96, 100), alerted: a.alerted, nowMs: NOW + 3e5, market: true }).lines.length, 0, 'not again');
  assert.equal(watchAlerts({ watch: W, tick: tick(102, 100), nowMs: NOW, market: true }).lines.length, 0, 'under 3%');
  assert.equal(watchAlerts({ watch: W, tick: tick(96, 100), nowMs: NOW, market: false }).lines.length, 0, 'market closed');
  assert.equal(watchAlerts({ watch: W, tick: tick(96, 100, false), nowMs: NOW, market: true }).lines.length, 0, 'stale quote');
});
test('watch: RSI alerts on a crossing only, never on the first reading', () => {
  const rsi = (v) => ({ rows: { INFY: [v, 50, 50] } });
  const first = watchAlerts({ watch: W, rsi: rsi(75), nowMs: NOW, market: true });
  assert.equal(first.lines.length, 0);
  assert.equal(first.wrsi.INFY, 75);
  const up = watchAlerts({ watch: W, rsi: rsi(71), wrsi: { INFY: 66 }, nowMs: NOW, market: true });
  assert.match(up.lines[0], /crossed above 70 \(71\)/);
  const down = watchAlerts({ watch: W, rsi: rsi(29), wrsi: { INFY: 35 }, nowMs: NOW, market: true });
  assert.match(down.lines[0], /crossed below 30/);
  assert.equal(watchAlerts({ watch: W, rsi: rsi(72), wrsi: { INFY: 71 }, nowMs: NOW, market: true }).lines.length, 0, 'already above');
});
test('watch: news only for watched stocks, only after you started watching, once each', () => {
  const ev = (id, sym, iso) => ({ eventClusterId: id, headline: 'H ' + id + ' <x>', publishedAt: iso, sourceTitle: 'S', entities: [{ sym }] });
  const events = [ev('1', 'INFY', '2026-11-19T03:00:00Z'), ev('2', 'INFY', '2026-11-18T03:00:00Z'), ev('3', 'TCS', '2026-11-19T03:00:00Z')];
  const a = watchAlerts({ watch: W, events, nowMs: NOW, market: false });
  assert.equal(a.lines.length, 1);
  assert.match(a.lines[0], /Watch news on <b>INFY<\/b>: H 1 &lt;x&gt;/);
  assert.deepEqual(a.newsIds, ['1']);
  assert.equal(watchAlerts({ watch: W, events, alerted: a.alerted, nowMs: NOW, market: false }).lines.length, 0);
});

test('alert message: one ping, capped at 8 lines with a count of the rest', () => {
  const m = alertMessage(Array.from({ length: 11 }, (_, i) => 'L' + i), at('2026-11-19T05:00:00Z'));
  assert.match(m, /Alerts \(11\) · Thu 19 Nov 13:00 MYT/);
  assert.match(m, /\+3 more/);
  assert.equal((m.match(/^• /gm) || []).length, 8);
});
