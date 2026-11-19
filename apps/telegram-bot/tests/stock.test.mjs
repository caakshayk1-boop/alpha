import test from 'node:test';
import assert from 'node:assert/strict';
import { stockBrief, trend, storiesFor } from '../stock.js';
import { handle } from '../commands.js';

const NOW = Date.parse('2026-11-19T10:00:00Z');
const closes = Array.from({ length: 60 }, (_, i) => 100 + i); // 100..159
const FEEDS = {
  'https://tripwire.askakshay.com/api/tick?s=INFY': { quotes: { INFY: { px: 160, prev: 158, pt: 1795082100, live: false } } },
  'https://tripwire.askakshay.com/api/bars?s=INFY': { bars: { INFY: { c: closes, h: closes.map((x) => x + 2), l: closes.map((x) => x - 2) } } },
  'https://tripwire.askakshay.com/api/rsi': { rows: { INFY: [44.1, 47.1, 43.1] } },
  'https://tripwire.askakshay.com/api/ledger': { ledger: { picks: [
    { id: 'a', engine: 'MOM', sym: 'INFY', asOf: '2026-11-01', rank: 2, score: 90, stop: 140 },
    { id: 'b', engine: 'QLT', sym: 'INFY', asOf: '2026-11-10', rank: 1, score: 80, stop: 150 },
    { id: 'c', engine: 'ST', sym: 'TCS', asOf: '2026-11-10', rank: 1, score: 80, stop: 1 }],
  outcomes: { a: { status: 'closed', pct: 5, r: 1.2, entry: 142, t1Hit: true }, b: { status: 'open', pct: -2, r: -0.4, entry: 150 } } } },
  'https://tripwire.askakshay.com/api/news': { events: [
    { eventClusterId: '1', headline: 'Infosys wins <deal>', publishedAt: '2026-11-18T10:00:00Z', canonicalUrl: 'https://n.example/1', sourceTitle: 'S', entities: [{ sym: 'INFY', name: 'Infosys Ltd.' }] },
    { eventClusterId: '2', headline: 'Infosys wins <deal>', publishedAt: '2026-11-18T09:00:00Z', entities: [{ sym: 'INFY' }] },
    { eventClusterId: '3', headline: 'Old story', publishedAt: '2026-10-01T10:00:00Z', entities: [{ sym: 'INFY' }] },
    { eventClusterId: '4', headline: 'Other company', publishedAt: '2026-11-18T10:00:00Z', entities: [{ sym: 'TCS' }] }] },
};
const deps = (over = {}, fail = []) => ({ getJSON: async (u) => { if (fail.includes(u) || !(u in { ...FEEDS, ...over })) throw new Error('HTTP 404'); return { ...FEEDS, ...over }[u]; } });

test('trend: range, returns and averages come only from the bars given', () => {
  const t = trend({ c: closes, h: closes.map((x) => x + 2), l: closes.map((x) => x - 2) });
  assert.equal(t.sessions, 60);
  assert.equal(t.hi, 161);
  assert.equal(t.lo, 98);
  assert.equal(t.w1, ((159 - 154) / 154) * 100);
  assert.equal(t.sma20, 149.5);
  assert.equal(t.sma50, 134.5);
  assert.equal(trend({ c: [1, 2, 3] }), null);
  assert.equal(trend({ c: closes.slice(-30) }).sma50, null, 'no 50-day average from 30 bars');
});

test('a full brief: price, trend, RSI, the stock\'s own picks newest first, de-duplicated recent news', async () => {
  const t = await stockBrief(deps(), 'infy', NOW);
  assert.match(t, /^<b>INFY<\/b> · Infosys Ltd\./);
  assert.match(t, /Price 160 \(\+1\.27% vs 158\) · not live · last tick 2026-11-19 15:25 IST/);
  assert.match(t, /Last 60 sessions: low 98 · high 161/);
  assert.match(t, /RSI 14: daily 44\.1 · weekly 47\.1 · monthly 43\.1/);
  const qlt = t.indexOf('QLT · picked 2026-11-10');
  const mom = t.indexOf('MOM · picked 2026-11-01');
  assert.ok(qlt > 0 && mom > qlt, 'newest pick first');
  assert.doesNotMatch(t, /ST · picked/, 'another stock\'s pick must not appear');
  assert.match(t, /closed · \+5\.00% since entry 142 · 1\.2 R · stop 140 · target 1 hit/);
  assert.equal((t.match(/Infosys wins &lt;deal&gt;/g) || []).length, 1, 'same headline once, escaped');
  assert.doesNotMatch(t, /Old story|Other company/);
  assert.doesNotMatch(t, /Fundamentals/, 'no fundamentals row without hub data');
});

test('a stock with no pick or news says so; failed feeds show n/a, never zero', async () => {
  const t = await stockBrief(deps({}, ['https://tripwire.askakshay.com/api/rsi', 'https://tripwire.askakshay.com/api/ledger', 'https://tripwire.askakshay.com/api/news']), 'INFY', NOW);
  assert.match(t, /RSI 14: n\/a/);
  assert.match(t, /n\/a \(ledger unavailable\)/);
  assert.match(t, /n\/a \(news feed unavailable\)/);
  const none = await stockBrief(deps({ 'https://tripwire.askakshay.com/api/ledger': { ledger: { picks: [], outcomes: {} } } }), 'INFY', NOW);
  assert.match(none, /Not picked by any Tripwire engine yet\./);
});

test('unknown or malformed symbols get a calm answer', async () => {
  assert.match(await stockBrief(deps(), 'ZZZ', NOW), /^No data for ZZZ\./);
  assert.match(await stockBrief(deps(), 'bad sym!', NOW), /^Usage: \/stock SYMBOL/);
  assert.match(await stockBrief(deps(), '', NOW), /^Usage: \/stock SYMBOL/);
});

test('a hub fundamentals line is added when the hub answers', async () => {
  const t = await stockBrief(deps({ 'https://alpha.askakshay.com/c/INFY.json': { row: { name: 'Infosys <Ltd>', sector: 'Technology', tier: 'large', fy: 'FY26', roce: 46.5, roe: 33.9, de: 0.1, rev_cagr: null } } }), 'INFY', NOW);
  assert.match(t, /^<b>INFY<\/b> · Infosys &lt;Ltd&gt;/);
  assert.match(t, /Fundamentals<\/b> \(Alpha hub, FY26\): Technology · large · ROCE 46\.5% · ROE 33\.9% · D\/E 0\.1 · Rev CAGR n\/a/);
});

test('/stock through the command handler uses the brief when it is wired in', async () => {
  const d = { ...deps(), stockBrief };
  assert.match(await handle('/stock infy', d), /Tripwire paper ledger/);
  assert.match(await handle('/stock', d), /^Usage: \/stock SYMBOL/);
});

test('storiesFor: last 7 days, this stock only, newest first, max 3', () => {
  const ev = Array.from({ length: 5 }, (_, i) => ({ headline: 'H' + i, publishedAt: new Date(NOW - i * 3600e3).toISOString(), entities: [{ sym: 'INFY' }] }));
  assert.deepEqual(storiesFor(ev, 'INFY', NOW).map((e) => e.headline), ['H0', 'H1', 'H2']);
});
