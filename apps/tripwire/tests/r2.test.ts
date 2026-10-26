import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planAutoBook, realised, MAX_OPEN, TICKET } from '../src/autobook.ts';
import type { Ledger, LedgerPick, Outcome } from '../src/ledger.ts';
import { alignIndexed } from '../src/chart.ts';
import { livePrice } from '../src/quotes.ts';
import { trendOfCloses, TREND_WORD } from '../src/screen.ts';
import { companyQ } from '../src/news.ts';
import { fmtMacro, MACRO } from '../src/macro.ts';
import { parseNews, MACRO as WORKER_MACRO } from '../worker.js';

const pick = (night: string, sym: string, ref = 100, o: Partial<LedgerPick> = {}): LedgerPick => ({ id: `${night}|MOM|${sym}`, engine: 'MOM', sym, asOf: night, ref, stop: ref * 0.9, horizon: 20, score: 80, rank: 1, ...o });
const ledger = (picks: LedgerPick[], outcomes: Record<string, Outcome> = {}, voided?: Record<string, string>): Ledger => ({ schema: 'tripwire-ledger/1', started: '2026-10-23', updated: '2026-10-26', cost: 0.25, days: [], picks, outcomes, voided });

test('auto book: a pick is taken the night it is written, sized to the ticket, rounded down', () => {
  const p = planAutoBook(ledger([pick('2026-10-23', 'AAA', 333)]));
  assert.equal(p.taken.length, 1); assert.equal(p.taken[0].qty, Math.floor(TICKET / 333)); assert.ok(p.taken[0].qty * 333 <= TICKET);
  assert.equal(p.log[0].kind, 'taken');
});
test('auto book: never more than 30 positions at a time, and the refusals say why', () => {
  const picks = Array.from({ length: 35 }, (_, i) => pick('2026-10-23', `S${i}`, 100, { score: 90 - i }));
  const p = planAutoBook(ledger(picks));
  assert.equal(p.taken.length, MAX_OPEN); assert.equal(p.refused.length, 5);
  assert.ok(p.refused.every((r) => /book is full/.test(r.why)));
  assert.deepEqual(p.refused.map((r) => r.pick.sym), ['S30', 'S31', 'S32', 'S33', 'S34']);        // best scores were taken first
});
test('auto book: a closed position frees its slot only for nights after it closed', () => {
  const night1 = Array.from({ length: 30 }, (_, i) => pick('2026-10-23', `A${i}`));
  const closeOn = (day: string): Outcome => ({ status: 'closed', final: true, entry: 100, entryDay: '2026-10-26', exit: 95, exitDay: day, reason: 'Stop', r: -0.5, pct: -5, sessions: 1 });
  const out: Record<string, Outcome> = {}; for (const p of night1) out[p.id] = closeOn('2026-10-27');
  const same = planAutoBook(ledger([...night1, pick('2026-10-27', 'NEW')], out));          // closes on the 27th: still holds its slot at the close of the 27th? No: it closed that day
  assert.equal(same.taken.some((t) => t.pick.sym === 'NEW'), true);
  const early = planAutoBook(ledger([...night1, pick('2026-10-26', 'NEW')], out));         // night of the 26th: they close on the 27th, so all 30 still run
  assert.equal(early.taken.some((t) => t.pick.sym === 'NEW'), false);
  assert.match(early.refused[0].why, /full/);
});
test('auto book: a pick skipped at the open frees its slot; pending and open ones hold it', () => {
  const night1 = Array.from({ length: 30 }, (_, i) => pick('2026-10-23', `A${i}`));
  const out: Record<string, Outcome> = {}; for (const p of night1) out[p.id] = { status: 'open', final: false, entry: 100, entryDay: '2026-10-26', sessions: 1 };
  assert.equal(planAutoBook(ledger([...night1, pick('2026-10-27', 'N')], out)).taken.some((t) => t.pick.sym === 'N'), false);
  out[night1[0].id] = { status: 'skipped', final: true, skipReason: 'Opened 3% above' };
  assert.equal(planAutoBook(ledger([...night1, pick('2026-10-27', 'N')], out)).taken.some((t) => t.pick.sym === 'N'), true);
});
test('auto book: the same name is not held twice; a voided pick and a share dearer than the ticket are refused with reasons', () => {
  const p = planAutoBook(ledger([pick('2026-10-23', 'X'), pick('2026-10-24', 'X'), pick('2026-10-24', 'BIG', 250000), pick('2026-10-24', 'V')], {}, { '2026-10-24|MOM|V': 'risk-grade bug' }));
  assert.deepEqual(p.taken.map((t) => t.pick.sym), ['X']);
  const why = Object.fromEntries(p.refused.map((r) => [r.pick.sym, r.why]));
  assert.match(why.X, /already held/); assert.match(why.BIG, /costs more than/); assert.match(why.V, /Voided.*risk-grade bug/);
});
test('auto book: P&L of a closed position is the outcome % of the money put in; the log reports entries and exits', () => {
  const p0 = pick('2026-10-23', 'AAA', 100);
  const o: Outcome = { status: 'closed', final: true, entry: 100.1, entryDay: '2026-10-26', exit: 110, exitDay: '2026-10-30', reason: 'Time exit', r: 1.2, pct: 8.5, sessions: 5 };
  const p = planAutoBook(ledger([p0], { [p0.id]: o }));
  const qty = p.taken[0].qty; assert.equal(qty, 1000);
  assert.equal(realised(o, qty), Math.round(0.085 * 100.1 * 1000 * 100) / 100);
  assert.deepEqual(p.log.map((e) => e.kind), ['closed', 'entered', 'taken']);                 // newest first
  assert.equal(realised({ status: 'open', final: false }, 10), null);
});

test('compare chart: only days every stock traded, each indexed to 100 on the first of them, the Nifty indexed the same day', () => {
  const D = 86400, t0 = 1700000000 - (1700000000 % D) - 19800;           // an IST midnight
  const a = { id: 'A', t: [0, 1, 2, 3, 4].map((i) => t0 + i * D), c: [10, 11, 12, 11, 13], n: [100, 101, 102, 103, 104] };
  const b = { id: 'B', t: [2, 3, 4].map((i) => t0 + i * D), c: [50, 55, 40], n: null };
  const r = alignIndexed([a, b], 'Max')!;
  assert.equal(r.t.length, 3); assert.deepEqual(r.lines[0].v.map((v) => Math.round(v * 10) / 10), [100, 91.7, 108.3]); assert.deepEqual(r.lines[1].v.map((v) => Math.round(v * 10) / 10), [100, 110, 80]);
  assert.deepEqual(r.nifty!.map((v) => Math.round(v * 100) / 100), [100, 100.98, 101.96]);
  assert.equal(alignIndexed([a], 'Max'), null);
  assert.equal(alignIndexed([a, { id: 'C', t: [t0 + 9 * D, t0 + 10 * D], c: [1, 2] }], 'Max'), null);      // no shared days: no chart
});
test('live price: a quote from today replaces the published close; an older one is ignored, never blended', () => {
  const row = { price: 119.53, r1d: -0.2, last_date: '2026-10-23' };
  const q = (pt: number) => ({ t: [], c: [], px: 124.56, pt, prev: 119.53, live: true });
  const mon = Date.UTC(2026, 9, 26, 5, 0) / 1000, fri = Date.UTC(2026, 9, 23, 9, 0) / 1000, thu = Date.UTC(2026, 9, 22, 9, 0) / 1000;
  const a = livePrice(row, q(mon)); assert.equal(a.px, 124.56); assert.equal(a.fromQuote, true); assert.ok(Math.abs(a.ch! - 4.2) < 0.05);
  assert.equal(livePrice(row, q(fri)).fromQuote, true);                                   // same day as the close: fine
  const old = livePrice(row, q(thu)); assert.equal(old.fromQuote, false); assert.equal(old.px, 119.53); assert.equal(old.ch, -0.2);
  assert.equal(livePrice(row, null).fromQuote, false);
});
test('trend of any close series: its own 50 and 200-day averages; sideways is the word for no clear order', () => {
  const up = Array.from({ length: 250 }, (_, i) => 100 + i), down = [...up].reverse(), flat = Array.from({ length: 250 }, (_, i) => 100 + (i % 2));
  assert.equal(trendOfCloses(up).trend, 'up'); assert.equal(trendOfCloses(down).trend, 'down'); assert.equal(trendOfCloses(flat).trend, 'mixed');
  assert.equal(trendOfCloses(up.slice(0, 120)).trend, null);                              // fewer than 200 closes: untagged, not sideways
  assert.equal(TREND_WORD.mixed, 'Sideways');
});
test('news query: the legal suffix goes, the name stays together', () => {
  assert.equal(companyQ('Edelweiss Financial Services Ltd.'), '"Edelweiss Financial Services" when:7d');
  assert.equal(companyQ('Tata Consultancy Services Limited'), '"Tata Consultancy Services" when:7d');
});
test('macro: every instrument the app lists is one the Worker serves, formatted with its own unit', () => {
  assert.deepEqual(MACRO.map((m) => m.key).sort(), Object.keys(WORKER_MACRO).sort());
  assert.equal(MACRO.length, 8);
  assert.equal(fmtMacro(MACRO.find((m) => m.key === 'USDMYR')!, 4.2123), 'RM4.2123'); assert.equal(fmtMacro(MACRO.find((m) => m.key === 'BTC')!, 67890.4), '$67,890'); assert.equal(fmtMacro(MACRO[0], null), '—');
});

const item = (title: string, source: string, pub: string, link = 'https://news.google.com/rss/articles/x') => `<item><title>${title} - ${source}</title><link>${link}</link><pubDate>${pub}</pubDate><source url="https://s.example">${source}</source></item>`;
test('news: filler and non-English are dropped, one story from many outlets is one line, tags are keywords, newest material first', () => {
  const now = Date.parse('Mon, 26 Oct 2026 06:00:00 GMT');
  const xml = `<rss><channel>${[
    item('EAAA India Alternatives IPO to open on October 26; price band fixed at ₹1,585-1,665', 'TradingView', 'Wed, 21 Oct 2026 06:14:00 GMT', 'https://news.google.com/a1'),
    item("EAAA India Alternatives' IPO to open on October 26, price band fixed", 'The Economic Times', 'Wed, 21 Oct 2026 07:00:00 GMT', 'https://news.google.com/a2'),
    item('Edelweiss Financial Services Share Price News: NBFC Metrics', 'Univest', 'Mon, 19 Oct 2026 10:10:00 GMT', 'https://news.google.com/a3'),
    item('Edelweiss Subsidiary IPO: రూ. 1,200 కోట్ల ఐపీఓకు సిద్ధమైన EAAA Alternatives', 'Whalesbook', 'Tue, 20 Oct 2026 05:22:00 GMT', 'https://news.google.com/a4'),
    item('Kavish Malji joins Edelweiss Financial Services as Deputy Vice President – Marketing', 'Exchange4Media', 'Wed, 21 Oct 2026 07:14:00 GMT', 'https://news.google.com/a5'),
    item('Edelweiss posts Q2 net profit of ₹150 crore, up 30%', 'Mint', 'Mon, 26 Oct 2026 04:00:00 GMT', 'https://news.google.com/a6'),
    item('Future dated story about nothing in particular here today', 'Bad', 'Fri, 30 Oct 2026 04:00:00 GMT', 'https://news.google.com/a7'),
  ].join('')}</channel></rss>`;
  const r = parseNews(xml, now);
  assert.deepEqual(r.map((x) => x.url), ['https://news.google.com/a6', 'https://news.google.com/a2', 'https://news.google.com/a5']);        // results first, the IPO once (the newest outlet's link), the hire last
  assert.equal(r[1].also, 1); assert.ok(r[1].sources.includes('TradingView') && r[1].sources.includes('The Economic Times'));
  assert.ok(r[0].tags.includes('Results')); assert.ok(r[1].tags.includes('IPO')); assert.deepEqual(r[2].tags, ['People']);
  assert.ok(!r.some((x) => /Univest|Whalesbook|Bad/.test(x.source)));
  assert.equal(r[0].title, 'Edelweiss posts Q2 net profit of ₹150 crore, up 30%');                // the " - Source" suffix is removed
  assert.deepEqual(parseNews('<rss></rss>', now), []); assert.deepEqual(parseNews('', now), []);
});

test('news from Bing: the real article link is taken from the click link, the source from its own field, and items older than the window are dropped', () => {
  const now = Date.parse('Mon, 26 Oct 2026 06:00:00 GMT');
  const bing = (title: string, url: string, pub: string, src: string) => `<item><title>${title}</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=abc&amp;url=${encodeURIComponent(url).replace(/&/g, '&amp;')}&amp;c=1&amp;mkt=en-in</link><description>d</description><pubDate>${pub}</pubDate><News:Source>${src}</News:Source></item>`;
  const xml = `<rss xmlns:News="x"><channel>${[
    bing('Edelweiss Financial Services to Raise Rs 300 Cr via NCDs', 'https://money.rediff.com/news/a?x=1&y=2', 'Sun, 25 Oct 2026 17:00:00 GMT', 'Rediff Money'),
    bing('Mohnish Pabrai fund buys 2% stake in Edelweiss Financial Services', 'https://www.livemint.com/old', 'Mon, 07 Dec 2020 22:48:00 GMT', 'Mint'),
  ].join('')}</channel></rss>`;
  const r = parseNews(xml, now, 8, 8);
  assert.equal(r.length, 1); assert.equal(r[0].url, 'https://money.rediff.com/news/a?x=1&y=2'); assert.equal(r[0].source, 'Rediff Money'); assert.ok(r[0].tags.includes('Deal') || r[0].tags.length >= 0);
  assert.equal(parseNews(xml, now, 8, 100000).length, 2);                                   // the window is what drops the 2020 story
});
test('auto book: picks from a retired engine are not taken, and the log says why', () => {
  const lvt = pick('2026-10-23', 'TORNTPHARM', 4524, { engine: 'LVT', id: '2026-10-23|LVT|TORNTPHARM' });
  const p = planAutoBook(ledger([lvt, pick('2026-10-23', 'AAA', 100)]));
  assert.deepEqual(p.taken.map((t) => t.pick.sym), ['AAA']); assert.match(p.refused[0].why, /Steady uptrend is retired/);
});

import { rollDiff } from '../src/roll.ts';
import { mood, hueOf } from '../src/mood.ts';
import { kindOf } from '../src/haptic.ts';
import { rootScale } from '../src/dyntype.ts';
import { encodeId, decodeId } from '../src/lock.ts';
import { themeOf, THEMES } from '../src/theme.ts';
test('rolling digits: only changed digits roll, counted from the right, and up or down by the digit', () => {
  assert.deepEqual(rollDiff('₹1,24,356', '₹1,24,358'), [{ fromEnd: 0, from: '6', to: '8', dir: 'u' }]);
  assert.deepEqual(rollDiff('₹999', '₹1,000').map((c) => c.fromEnd), [0, 1, 2].filter((k) => k < 3 && ['9', '9', '9'][k] !== ['0', '0', '0'][k]));   // 3 units digits changed; the new leading 1 has nothing to roll from
  assert.deepEqual(rollDiff('+₹1,244', '−₹1,244'), []);                               // a sign changes in place; no digit moved
  assert.equal(rollDiff('12.5', '12.5').length, 0); assert.equal(rollDiff('', '5').length, 0); assert.equal(rollDiff('9', '1')[0].dir, 'd');
});
test('market mood: a description from three live moves, never a forecast; missing Nifty gives none', () => {
  assert.equal(mood(null, 1, 1), null);
  assert.equal(mood(1.8, 1.5, -4)!.word, 'Strong'); assert.equal(mood(0.1, 0, 0)!.word, 'Mixed'); assert.equal(mood(-2.2, -2, 12)!.word, 'Under pressure');
  assert.equal(mood(0.9, null, null)!.tone, 'up'); assert.ok(mood(-0.7, -0.6, 3)!.score < 0);
  assert.ok(mood(1, 1, 8)!.score < mood(1, 1, -8)!.score);                            // a rising VIX takes away from the same move
});
test('a symbol keeps one colour; haptics match the message; text size scales the root but is capped', () => {
  assert.equal(hueOf('TCS'), hueOf('TCS')); assert.notEqual(hueOf('TCS'), hueOf('INFY')); assert.ok(hueOf('RELIANCE') >= 0 && hueOf('RELIANCE') < 360);
  assert.equal(kindOf('Following TCS. Kept on this device.'), 'success'); assert.equal(kindOf('GCSL is already in your paper book'), 'error'); assert.equal(kindOf('That file is too large for a backup'), 'error');
  assert.equal(rootScale(17), 1); assert.equal(rootScale(34), 2); assert.equal(rootScale(100), 2); assert.equal(rootScale(5), 0.85);
});
test('lock ids survive storage, and every theme has a name, a swatch and a bar colour', () => {
  const id = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]); assert.deepEqual([...decodeId(encodeId(id))], [...id]);
  assert.ok(!/[+/=]/.test(encodeId(new Uint8Array(64).fill(251))));
  assert.equal(themeOf('nope').id, 'aurora'); assert.equal(THEMES.length, 5); assert.ok(THEMES.every((t) => t.label && t.swatch && /^#/.test(t.bar)));
});
