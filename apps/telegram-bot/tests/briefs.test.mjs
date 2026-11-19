import test from 'node:test';
import assert from 'node:assert/strict';
import { dueSlot, digestFeeds, snapshot, changes, compose, pickCandidates, SLOTS } from '../briefs.js';

const at = (iso) => Date.parse(iso);
const [MORNING, OPEN, CLOSE] = SLOTS;

// 2026-11-16 is a Monday; 2026-11-21 a Saturday. Malaysia is UTC+8, so 08:00 MYT is 00:00 UTC.
test('slots fire Mon-Fri at 08:00, 12:00 and 18:30 Malaysia time, with a 60-minute window', () => {
  assert.deepEqual(dueSlot(at('2026-11-16T00:00:00Z')).key, '2026-11-16:morning');
  assert.equal(dueSlot(at('2026-11-16T00:30:00Z')).slot.id, 'morning');
  assert.equal(dueSlot(at('2026-11-16T00:59:00Z')).slot.id, 'morning');
  assert.equal(dueSlot(at('2026-11-16T01:00:00Z')), null, '09:00 MYT: window over');
  assert.equal(dueSlot(at('2026-11-16T04:00:00Z')).slot.id, 'open');
  assert.equal(dueSlot(at('2026-11-16T10:00:00Z')), null, '18:00 MYT is before the 18:30 slot');
  assert.equal(dueSlot(at('2026-11-16T10:30:00Z')).slot.id, 'close');
  assert.equal(dueSlot(at('2026-11-16T11:00:00Z')).slot.id, 'close', '19:00 MYT is the retry tick');
  assert.equal(dueSlot(at('2026-11-16T11:30:00Z')), null);
  assert.equal(dueSlot(at('2026-11-21T00:00:00Z')), null, 'Saturday');
  assert.equal(dueSlot(at('2026-11-22T04:00:00Z')), null, 'Sunday');
});
test('the weekday and date are the Malaysia ones, not UTC', () => {
  // Friday 23:30 UTC is already Saturday 07:30 MYT: no morning brief, and nothing on Sunday morning either.
  assert.equal(dueSlot(at('2026-11-20T23:30:00Z')), null);
  assert.equal(dueSlot(at('2026-11-22T00:00:00Z')), null);
  // Sunday 16:00 UTC is Monday 00:00 MYT: not a slot, but Sunday 00:00 UTC (08:00 MYT Sunday) is also nothing.
  assert.equal(dueSlot(at('2026-11-15T16:00:00Z')), null);
});

const NOW = at('2026-11-19T04:10:00Z'); // Thu 12:10 MYT = 09:40 IST
const pulse = (ptIso, live = true) => ({ quotes: {
  NIFTY: { px: 25200, prev: 25000, pt: Date.parse(ptIso) / 1000, live },
  BANKNIFTY: { px: 52000, prev: 52500, live },
  VIX: { px: 14.5, prev: 15, live },
} });
const feeds = (over = {}) => ({
  pulse: pulse('2026-11-19T04:00:00Z'),
  signals: { gate: { on: true, passed: 4, checks: [1, 2, 3, 4] }, data_through: '2026-11-18', signals: [{ sym: 'TCS' }], record: { closed: 3, wins: 2, total_r: 1.5 }, alertable: false, alert_why: 'Alerts off: not significant.' },
  ledger: { ledger: { days: [{ asOf: '2026-11-18', engines: { MOM: { picked: 5 }, QLT: { picked: 5 } } }], outcomes: { '2026-10-23|MOM|GCSL': { status: 'open', pct: 10 }, '2026-10-23|QLT|INFY': { status: 'open', pct: 2 }, '2026-10-20|ST|ZZZ': { status: 'closed', pct: 5 } } } },
  rulebook: { as_of: '2026-11-17', aggregates: [{ n_open: 3, n_closed: 1 }, { n_open: 2, n_closed: 0 }], book_days: [{ screen_id: 'all', date: '2026-11-16', equity: 1 }, { screen_id: 'all', date: '2026-11-17', equity: 100, unrealised: 40 }] },
  hubPulse: { built_on: '2026-11-19', sectors_day: [{ name: 'IT', median: 1.2 }, { name: 'Banks', median: -0.8 }, { name: 'Pharma', median: 0.1 }], breadth: { up: 600, down: 300, counted: 950 } },
  ...over,
});

test('digestFeeds reduces raw feeds to a small state and never invents a number', () => {
  const st = digestFeeds(feeds(), NOW);
  assert.equal(st.hub.gateOn, true);
  assert.deepEqual(st.hub.syms, ['TCS']);
  assert.equal(st.tw.open, 2);
  assert.equal(st.tw.picked, 10);
  assert.equal(st.tw.avgPct, 6);
  assert.deepEqual(st.tw.openSyms, ['GCSL', 'INFY']);
  assert.equal(st.lf.open, 5);
  assert.equal(st.lf.closed, 1);
  assert.equal(st.lf.equity, 100, 'latest book day, not the first');
  assert.equal(st.apex.lead.name, 'IT');
  assert.equal(st.apex.lag.name, 'Banks');
  const none = digestFeeds({ pulse: null, signals: null, ledger: null, rulebook: null, hubPulse: null }, NOW);
  assert.deepEqual(none, { market: null, hub: null, tw: null, lf: null, apex: null, flows: null });
});

test('changes name exactly what moved since the last brief', () => {
  const prev = snapshot(digestFeeds(feeds(), NOW));
  const cur = digestFeeds(feeds({
    signals: { gate: { on: false, passed: 2, checks: [1, 2, 3, 4] }, data_through: '2026-11-19', signals: [{ sym: 'INFY' }] },
    ledger: { ledger: { days: [{ asOf: '2026-11-19', engines: { MOM: { picked: 3 } } }], outcomes: { '2026-10-23|MOM|GCSL': { status: 'open', pct: 1 } } } },
  }), NOW);
  const c = changes(prev, cur);
  assert.deepEqual(c.Alpha, ['Gate flipped ON → OFF', 'New signal: INFY', 'No longer open: TCS', 'New session data through 2026-11-19']);
  assert.deepEqual(c.Tripwire, ['New ledger day 2026-11-19: 3 picked', 'Open paper picks 2 → 1']);
  assert.deepEqual(c.Rulebook, []);
  assert.deepEqual(c.ApexPro, []);
  assert.equal(changes(null, cur), null, 'no previous brief means no change list');
});

test('first brief says so; later briefs collapse quiet sites into one line', () => {
  const st = digestFeeds(feeds(), NOW);
  const first = compose(OPEN, st, null, [], NOW).text;
  assert.match(first, /First brief/);
  assert.match(first, /Gate ON · 1 signal · Nifty \+0\.80% · VIX 14\.5/);
  const later = compose(OPEN, st, snapshot(st), [], NOW).text;
  assert.match(later, /No change: Alpha, Tripwire, Rulebook, ApexPro/);
  assert.doesNotMatch(later, /First brief/);
});

test('a dead source is named and the rest of the brief still goes out', () => {
  const st = digestFeeds(feeds({ ledger: null, hubPulse: null }), NOW);
  const t = compose(CLOSE, st, snapshot(st), [], NOW).text;
  assert.match(t, /Source unavailable: Tripwire, ApexPro/);
  assert.match(t, /Nifty: 25,200/);
  assert.doesNotMatch(t, /Tripwire paper picks/);
});

test('no trading today (holiday): the open and close briefs say so, and a quiet one is one line', () => {
  const st = digestFeeds(feeds({ pulse: pulse('2026-11-18T10:00:00Z', false) }), NOW);
  const t = compose(OPEN, st, null, [], NOW).text;
  assert.match(t, /No trading data for today yet/);
  const quiet = compose(CLOSE, st, snapshot(st), [], NOW).text;
  assert.match(quiet, /No changes since the last brief\. No trading data for today\./);
  assert.equal(quiet.split('\n').length, 3);
});

test('the morning brief shows last close and why hub alerts are off', () => {
  const st = digestFeeds(feeds({ pulse: pulse('2026-11-18T10:00:00Z', false) }), at('2026-11-19T00:05:00Z'));
  const t = compose(MORNING, st, null, [], at('2026-11-19T00:05:00Z')).text;
  assert.match(t, /Last close<\/b> \(2026-11-18/);
  assert.match(t, /Hub alerts are off\. Not significant\./);
});

const ev = (id, sig, sym, extra = {}) => ({ eventClusterId: id, headline: `Story ${id} <b>`, significance: sig, publishedAt: '2026-11-19T02:00:00Z', canonicalUrl: `https://n.example/${id}`, sourceTitle: 'Src', entities: sym ? [{ sym }] : [], ...extra });

test('news: your signal stocks get a boost, one company fills at most two slots', () => {
  const st = digestFeeds(feeds(), NOW);
  const events = [ev('a', 0.9, 'ZZZ'), ev('b', 0.85, 'ZZZ'), ev('c', 0.8, 'ZZZ'), ev('d', 0.7, 'TCS'), ev('e', 0.6, 'GCSL'), ev('f', 0.5, null)];
  const c = pickCandidates(events, NOW, st);
  assert.deepEqual(c.map((x) => x.eventClusterId), ['d', 'a', 'b', 'e', 'f'], 'TCS (in your signals) jumps ahead; c dropped: third story about ZZZ');
  assert.equal(c.find((x) => x.eventClusterId === 'd').mine, true);
  assert.equal(c.find((x) => x.eventClusterId === 'a').mine, false);
});

test('news text is escaped, links only if short and http(s), and the message stays under the limit', () => {
  const st = digestFeeds(feeds(), NOW);
  const items = pickCandidates([ev('a', 1, 'TCS'), ev('b', 0.9, null, { canonicalUrl: 'javascript:alert(1)' }), ev('c', 0.8, null, { canonicalUrl: 'https://x.example/' + 'q'.repeat(400) })], NOW, st);
  const t = compose(OPEN, st, null, items, NOW).text;
  assert.match(t, /1\. ★ <a href="https:\/\/n\.example\/a">Story a &lt;b&gt;<\/a>/);
  assert.doesNotMatch(t, /javascript:/);
  assert.doesNotMatch(t, /qqqq/);
  const many = Array.from({ length: 5 }, (_, i) => ev('n' + i, 1, null, { headline: 'H'.repeat(900), canonicalUrl: 'https://x.example/' + i }));
  const big = compose(CLOSE, st, snapshot(st), many, NOW);
  assert.ok(big.text.length <= 3800, `length ${big.text.length}`);
  assert.ok(big.shown.length < 5, 'trailing stories dropped, never a cut tag');
  assert.equal((big.text.match(/<a /g) || []).length, (big.text.match(/<\/a>/g) || []).length);
});

test('every brief carries the four site buttons', () => {
  const st = digestFeeds(feeds(), NOW);
  const { buttons } = compose(OPEN, st, null, [], NOW);
  assert.deepEqual(buttons.map((b) => b[0]), ['Tripwire', 'Alpha', 'Rulebook', 'ApexPro']);
  assert.ok(buttons.every((b) => /^https:\/\/[a-z]+\.askakshay\.com$/.test(b[1])));
});
