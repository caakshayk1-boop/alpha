// Run with: node --test tests/   (Node 22.6+ strips the types itself)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breadth200 } from '../src/lib/breadth.ts';
import { buildCard, cardDelta, normaliseCard, parseImport, serializeCard, serializeLibrary, CARD_VERSION } from '../src/lib/card.ts';
import { describe as describeStatus, expectedSession, ordinal, plural, rankPhrase, reconcile, sessionsBetween, weekThrough } from '../src/lib/status.ts';
import { nseDate, plainText, rupeeBand } from '../src/lib/format.ts';
import { bucketOf, mentionsIn, summarise as summariseNews, topicsOf } from '../src/lib/newsdesk.ts';
import { GLOSSARY, metricId, searchGlossary } from '../src/lib/glossary.ts';
import { groupStories } from '../src/lib/news.ts';
import { MIN_ENTRIES, journalHref, makeEntry, mergeJournal, outcome, parseJournal, serializeJournal, summarise } from '../src/lib/journal.ts';
import { takeaway, vixWord } from '../src/lib/takeaway.ts';
import { readFileSync } from 'node:fs';

test('freshness: the observed 8 Oct / 9 Oct mismatch is surfaced, not hidden', () => {
  const s = reconcile([
    { id: 'barometer', label: 'Barometer', source: 'x', asOf: '2026-10-08', refreshedAt: '2026-10-09T19:01:15+00:00' },
    { id: 'screen', label: 'Screen', source: 'x', asOf: '2026-10-09', refreshedAt: '2026-10-12' },
    { id: 'engines', label: 'Engines', source: 'x', asOf: '2026-10-09', refreshedAt: '2026-10-12T02:00:00' },
  ]);
  assert.equal(s.find((x) => x.id === 'screen')?.state, 'current');
  const b = s.find((x) => x.id === 'barometer')!;
  assert.equal(b.state, 'delayed');
  assert.equal(b.lagSessions, 1);
  assert.equal(b.reference, '2026-10-09');
});
test('freshness: no date means partial or unavailable, never current; errors stay errors', () => {
  const s = reconcile([
    { id: 'a', label: 'A', source: 'x', asOf: '2026-10-09', refreshedAt: null },
    { id: 'b', label: 'B', source: 'x', asOf: null, refreshedAt: '2026-10-12' },
    { id: 'c', label: 'C', source: 'x', asOf: null, refreshedAt: null },
    { id: 'd', label: 'D', source: 'x', asOf: '2026-10-09', refreshedAt: null, error: true },
  ]);
  assert.deepEqual(s.map((x) => x.state), ['current', 'partial', 'unavailable', 'error']);
});
test('freshness: three or more sessions behind is stale; the weekend does not count', () => {
  assert.equal(sessionsBetween('2026-10-09', '2026-10-12'), 1);    // Friday to Monday is one session
  const s = reconcile([{ id: 'a', label: 'A', source: 'x', asOf: '2026-10-05', refreshedAt: null }, { id: 'b', label: 'B', source: 'x', asOf: '2026-10-12', refreshedAt: null }]);
  assert.equal(s[0].state, 'stale');
});
test('freshness: nothing hard-codes a date, and a dataset alone is current against itself', () => {
  const s = reconcile([{ id: 'a', label: 'A', source: 'x', asOf: '2031-03-04', refreshedAt: null }]);
  assert.equal(s[0].state, 'current');
});
test('breadth: stocks without a 200-day average leave the denominator and are counted separately', () => {
  const b = breadth200([{ price: 11, sma200: 10 }, { price: 9, sma200: 10 }, { price: 5, sma200: null }, { price: null, sma200: 3 }]);
  assert.deepEqual([b.above, b.withHistory, b.universe, b.noHistory, b.pct], [1, 2, 4, 2, 50]);
});
test('ordinals and plurals read correctly', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 72, 82, 101, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '72nd', '82nd', '101st', '111th']);
  assert.equal(plural(1, 'day'), '1 day');
  assert.equal(plural(2, 'company', 'companies'), '2 companies');
  assert.equal(plural(1, 'company', 'companies'), '1 company');
});
test('rank phrases never say "higher than 100%"', () => {
  for (const p of [100, 99.6, 99, 0, 0.4]) assert.doesNotMatch(rankPhrase(p), /100%|0%/);
  assert.equal(rankPhrase(82), 'higher than about 82% of the others');
});

const company = { sym: 'TCS', name: 'Tata Consultancy Services Ltd.', price: 2156, priceAsOf: '2026-10-09' };
test('research card: export then import round-trips every field that exists, and missing ones stay null', () => {
  const card = buildCard({ question: 'Is TCS worth a look?', companies: [company, { sym: 'INFY', name: null, price: null, priceAsOf: null }], evidence: [{ text: 'ROCE 62%', side: 'for', source: 'screen, 2026-10-09' }], nextResults: { TCS: '2026-10-08', INFY: null }, dataStatus: [{ id: 'screen', asOf: '2026-10-09', refreshedAt: '2026-10-12', state: 'current' }], note: 'check cash flow' }, new Date('2026-10-12T05:00:00Z'));
  const back = parseImport(serializeCard(card));
  assert.ok(back.ok);
  if (back.ok) { assert.deepEqual(back.value.cards[0], card); assert.equal(back.value.cards[0].companies[1].price, null); assert.equal(back.value.cards[0].comparison, null); }
});
test('research card: a whole library round-trips with its watchlist', () => {
  const a = buildCard({ question: 'A', companies: [company] }), b = buildCard({ question: 'B', companies: [company] });
  const back = parseImport(serializeLibrary(['TCS', 'M&M'], [a, b]));
  assert.ok(back.ok);
  if (back.ok) { assert.deepEqual(back.value.watchlist, ['TCS', 'M&M']); assert.equal(back.value.cards.length, 2); }
});
test('research card: malformed, wrong-schema and newer-version files fail safely with a next step', () => {
  assert.ok(!parseImport('{not json').ok);
  const wrong = parseImport(JSON.stringify({ schema: 'something.else', version: 1 }));
  assert.ok(!wrong.ok && /Export a card/.test(wrong.error));
  const newer = parseImport(JSON.stringify({ ...buildCard({ question: 'x', companies: [company] }), version: CARD_VERSION + 1 }));
  assert.ok(!newer.ok && /newer version/.test(newer.error));
  assert.ok(!normaliseCard({ schema: 'alpha.research-card', version: 1, companies: [], question: null }).ok);
});
test('research card: unknown fields are dropped with a warning, bad symbols are skipped, nothing is invented', () => {
  const r = normaliseCard({ schema: 'alpha.research-card', version: 1, question: 'q', surprise: 1, companies: [{ sym: 'TCS', price: 'NaN' }, { sym: '<script>' }] });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.companies.length, 1);
    assert.equal(r.value.companies[0].price, null);
    assert.ok(r.warnings.some((w) => /surprise/.test(w)) && r.warnings.some((w) => /no valid symbol/.test(w)));
  }
});

import { parse } from '../src/lib/nl.ts';
const R = (o: Record<string, unknown>) => ({ sym: 'X', name: 'X', ind: '', sector: '', price: 100, ...o }) as never;
test('screen parser: accepted clauses become labelled filters and apply', () => {
  const p = parse('large cap IT roce above 25 low debt');
  assert.deepEqual(p.filters.map((f) => f.label), ['Large cap', 'ROCE at least 25%', 'Debt/equity 0.3 or less', 'IT and technology']);
  const good = R({ tier: 'large', roce: 30, de: 0.1, ind: 'Information Technology' });
  const bad = R({ tier: 'large', roce: 30, de: 0.9, ind: 'Information Technology' });
  assert.ok(p.filters.every((f) => f.test(good)) && !p.filters.every((f) => f.test(bad)));
});
test('screen parser: unsupported words are listed as ignored, never silently dropped or guessed at', () => {
  const p = parse('blorp zzz');
  assert.equal(p.filters.length, 0);
  assert.deepEqual(p.unknown, ['blorp', 'zzz']);
  const q = parse('oversold pharma profitable zzzz');
  assert.ok(q.filters.map((f) => f.label).includes('Oversold (RSI under 30)'));    // "oversold" must survive the currency clean-up of "rs"
  assert.deepEqual(q.unknown, ['zzzz']);
});
test('A04: "banks" means banks, never exchanges, asset managers or brokers; a broader search says it is broader', () => {
  const fin = (sym: string, name: string) => R({ sym, name, sector: 'Financial Services', roe: 18, pe: 10 });
  const rows = [fin('HDFCBANK', 'HDFC Bank Ltd.'), fin('SBIN', 'State Bank of India'), fin('BSE', 'BSE Ltd.'), fin('NAM-INDIA', 'Nippon Life India Asset Management Ltd.'),
    fin('ANANDRATHI', 'Anand Rathi Wealth Ltd.'), fin('GROWW', 'Billionbrains Garage Ventures Ltd.'), fin('BAJFINANCE', 'Bajaj Finance Ltd.'), fin('SBILIFE', 'SBI Life Insurance Company Ltd.')];
  const hits = (q: string) => { const p = parse(q); return rows.filter((r) => p.filters.every((f) => f.test(r))).map((r) => (r as unknown as { sym: string }).sym); };
  assert.deepEqual(hits('cheap banks roe above 14'.replace('cheap ', '')), ['HDFCBANK', 'SBIN']);
  assert.deepEqual(hits('insurance'), ['SBILIFE']);
  assert.equal(hits('financial services').length, rows.length);
  const p = parse('nbfc roe above 15');
  assert.match(p.filters.find((f) => f.label.startsWith('Financial Services'))?.note ?? '', /does not separate/);
  assert.match(parse('banks').filters[0].note ?? '', /registered name/);
  assert.equal(parse('it stocks').filters[0].note, undefined, 'an exact sector rule carries no note');
});
test('screen parser: a company with no value for a measure never matches a clause on it', () => {
  const f = parse('roce above 20').filters[0];
  assert.equal(f.test(R({ roce: null })), false);
  assert.equal(f.test(R({ roce: 25 })), true);
});
test('screen parser: a query with no recognised clause filters nothing and says so (empty filter list)', () => {
  assert.equal(parse('hello there').filters.length, 0);
});

test('plainText: double-encoded entities decode, tags never survive as markup', () => {
  assert.equal(plainText('S&amp;P 500&amp;nbsp;rises'), 'S&P 500 rises');
  assert.equal(plainText('Profit &amp;amp; loss'), 'Profit & loss');
  assert.equal(plainText('<b>Bold</b> move <script>alert(1)</script>'), 'Bold move alert(1)');
  assert.equal(plainText('&lt;img src=x onerror=alert(1)&gt;'), '<img src=x onerror=alert(1)>');   // shown as literal text; React renders it escaped, never as markup
  assert.equal(plainText('Nifty < 25,000 while Sensex > 80,000'), 'Nifty < 25,000 while Sensex > 80,000');
  assert.equal(plainText('Nifty &lt; 25,000 while Sensex &gt; 80,000'), 'Nifty < 25,000 while Sensex > 80,000');
  assert.equal(plainText('P/E<20 and ROE>15'), 'P/E<20 and ROE>15');
  assert.equal(plainText(null), '');
});
test('plainText: an unknown or out-of-range entity is left alone, not turned into garbage', () => {
  assert.equal(plainText('a &bogus; b'), 'a &bogus; b');
  assert.equal(plainText('x &#99999999; y'), 'x &#99999999; y');
});
test('rankPhrase: the top of the range never reads as a percentage above 100', () => {
  assert.doesNotMatch(rankPhrase(100), /100%/);
  assert.doesNotMatch(rankPhrase(99.6), /100%/);
});

test('cardDelta: a real price move on a later data date is reported with both dates; the same date is not a change', () => {
  const card = buildCard({ companies: [{ sym: 'TCS', name: 'TCS', price: 100, priceAsOf: '2026-10-09' }], nextResults: { TCS: '2026-10-10' } });
  const later = cardDelta(card, { TCS: { price: 110, asOf: '2026-10-12', nextResults: '2026-10-20', engines: [] } });
  assert.deepEqual(later.map((c) => c.what.split(' (')[0]), ['Price', 'Next results date']);
  assert.match(later[0].what, /\+10\.0%/);
  assert.equal(cardDelta(card, { TCS: { price: 110, asOf: '2026-10-09', nextResults: '2026-10-10', engines: [] } }).length, 0);
});
test('cardDelta: missing data on either side yields no change, and a dropped engine plan is named', () => {
  const card = buildCard({ companies: [{ sym: 'INFY', name: null, price: null, priceAsOf: null }], engines: { INFY: [{ engine: 'Relative', rankingStatus: 'EDGE SHOWN', tradingStatus: null, signalClose: null, stop: null, targets: null }] } });
  const d = cardDelta(card, { INFY: { price: 50, asOf: '2026-10-12', nextResults: null, engines: [] } });
  assert.equal(d.length, 1);
  assert.equal(d[0].after, 'no longer an active signal');
  assert.deepEqual(cardDelta(card, {}), []);
});

test('glossary: every entry is complete, anchors are unique and URL-safe, search needs every word', () => {
  const ids = Object.keys(GLOSSARY).map(metricId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((i) => /^metric-[a-z0-9-]+$/.test(i)));
  for (const [k, e] of Object.entries(GLOSSARY)) assert.ok(e.name && e.what && e.how && e.read && e.caveat, `${k} is missing a field`);
  assert.equal(metricId('Debt / equity'), 'metric-debt-equity');
  assert.equal(searchGlossary('').length, Object.keys(GLOSSARY).length);
  assert.ok(searchGlossary('roce').some(([k]) => k === 'ROCE'));
  assert.equal(searchGlossary('roce zzzznotaword').length, 0);
});

test('news: near-identical headlines from different sources group; the same source and unrelated stories do not', () => {
  const s = (title: string, source: string) => ({ title, summary: '', link: `https://x/${title}`, source });
  const g = groupStories([s('RBI keeps repo rate unchanged at 5.5 per cent', 'A'), s('RBI keeps repo rate unchanged at 5.5%', 'B'), s('Nifty ends lower as IT stocks drag', 'A'), s('RBI keeps repo rate unchanged at 5.5 per cent today', 'A')]);
  assert.equal(g.length, 3);
  assert.equal(g[0].more.length, 1);
  assert.equal(g[0].more[0].source, 'B');
});

const near = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
const J = (over: Partial<Parameters<typeof outcome>[0]> = {}) => ({ id: 'a', date: '2026-10-01', sym: 'ABC', action: 'took' as const, why: 'Breakout above resistance on volume', price: 100, stop: 90, target: 130, ...over });

test('journal: outcome is arithmetic from the decision price, the stop and today\'s price', () => {
  const up = outcome(J(), 110);
  assert.equal(up.state, 'open'); near(up.movePct, 10); near(up.r, 1);
  const down = outcome(J(), 89);
  assert.equal(down.state, 'below-stop'); near(down.movePct, -11); near(down.r, -1.1);
  const hit = outcome(J(), 130);
  assert.equal(hit.state, 'above-target'); near(hit.r, 3);
});
test('journal: nothing is invented when a price or a stop is missing', () => {
  assert.deepEqual(outcome(J(), null), { state: 'no-price', movePct: null, r: null });
  assert.deepEqual(outcome(J({ price: null }), 110), { state: 'no-reference', movePct: null, r: null });
  const noStop = outcome(J({ stop: null, target: null }), 80);
  assert.equal(noStop.r, null); assert.equal(noStop.state, 'open'); near(noStop.movePct, -20);
});
test('journal: an entry needs a company, a real date, a reason and a sane stop and target', () => {
  const f = { date: '2026-10-01', sym: ' abc ', action: 'took', why: 'Breakout above resistance on volume', price: '100', stop: '90', target: '130' };
  const ok = makeEntry(f, 'x');
  assert.ok('entry' in ok && ok.entry.sym === 'ABC' && ok.entry.price === 100 && ok.entry.stop === 90 && ok.entry.target === 130);
  for (const bad of [{ sym: '' }, { date: '2026-13-45' }, { action: 'bought' }, { why: 'too short' }, { stop: '100' }, { stop: '110' }, { target: '95' }, { price: 'abc' }, { price: '-5' }]) {
    assert.ok('error' in makeEntry({ ...f, ...bad }, 'x'), JSON.stringify(bad));
  }
  const noNumbers = makeEntry({ ...f, price: '', stop: '', target: '' }, 'x');
  assert.ok('entry' in noNumbers && noNumbers.entry.price === null && noNumbers.entry.stop === null);
});
test('journal: an average is shown only once a group has enough measured entries', () => {
  const took = [10, 20, 30, 40, 50].map((m, i) => J({ id: `t${i}`, sym: `T${i}`, price: 100, stop: null, target: null, action: 'took' }));
  const skipped = [1, 2, 3, 4].map((_, i) => J({ id: `s${i}`, sym: `S${i}`, action: 'skipped', stop: null, target: null }));
  const px: Record<string, number> = { T0: 110, T1: 120, T2: 130, T3: 140, T4: 150, S0: 101, S1: 102, S2: 103, S3: 104 };
  const sum = summarise([...took, ...skipped], (s) => px[s] ?? null);
  const t = sum.find((g) => g.action === 'took')!, s = sum.find((g) => g.action === 'skipped')!, w = sum.find((g) => g.action === 'watching')!;
  assert.equal(MIN_ENTRIES, 5);
  assert.ok(t.enough && t.measured === 5); near(t.avgMovePct, 30);
  assert.ok(!s.enough && s.measured === 4 && s.avgMovePct === null);
  assert.ok(!w.enough && w.entries === 0);
});
test('journal: stored data is not trusted; import twice changes nothing', () => {
  const good = J({ id: 'g1' });
  const raw = serializeJournal([good]);
  assert.deepEqual(parseJournal(raw), [good]);
  assert.deepEqual(parseJournal(JSON.stringify([good])), [good]);
  const messy = JSON.stringify({ entries: [good, good, { id: 'bad1' }, null, 5, { ...good, id: 'bad2', action: 'bought' }, { ...good, id: 'bad3', date: 'yesterday' }, { ...good, id: 'ok2', sym: 'xyz', price: -3, stop: 'x' }] });
  const parsed = parseJournal(messy);
  assert.deepEqual(parsed.map((e) => e.id), ['g1', 'ok2']);
  assert.equal(parsed[1].sym, 'XYZ'); assert.equal(parsed[1].price, null); assert.equal(parsed[1].stop, null);
  assert.deepEqual(parseJournal('not json'), []); assert.deepEqual(parseJournal(null), []);
  const once = mergeJournal([good], parseJournal(raw));
  assert.deepEqual(once, [good]);
  assert.deepEqual(mergeJournal(once, parseJournal(raw)), once);
});

test('journal: a link from a signal carries the company and only the numbers that are usable', () => {
  assert.equal(journalHref('BSE', 2997.18, 2664.16, 3996.24), '/journal/?s=BSE&p=2997.18&sl=2664.16&t=3996.24');
  assert.equal(journalHref('TCS', 3100.456, null, undefined), '/journal/?s=TCS&p=3100.46');   // rounded to paise; no stop or target invented
  assert.equal(journalHref('M&M', 100, 0, Number.NaN), '/journal/?s=M%26M&p=100');            // zero and NaN are dropped; & is escaped
  const back = new URLSearchParams(journalHref('M&M', 100, 90, 120).split('?')[1]);
  assert.equal(back.get('s'), 'M&M');                                                          // and it reads back as the same symbol
});

test('expected session: the last weekday before the India date, with 7 hours of grace for the morning build', () => {
  const at = (iso: string) => expectedSession(new Date(iso));
  assert.equal(at('2026-10-13T11:52:00Z'), '2026-10-12');   // Tue 17:22 IST -> Monday
  assert.equal(at('2026-10-13T22:30:00Z'), '2026-10-12');   // Wed 04:00 IST, before the 05:10 build lands: still Monday
  assert.equal(at('2026-10-14T02:00:00Z'), '2026-10-13');   // Wed 07:30 IST, past the grace: Tuesday
  assert.equal(at('2026-10-12T03:00:00Z'), '2026-10-09');   // Mon 08:30 IST -> Friday
  assert.equal(at('2026-10-10T06:00:00Z'), '2026-10-09');   // Sat 11:30 IST -> Friday
  assert.equal(at('2026-10-11T20:00:00Z'), '2026-10-09');   // Mon 01:30 IST, inside the grace: still Friday
});
test('freshness against the calendar: data on schedule is current, even when another dataset is newer', () => {
  const d = (id: string, asOf: string | null, cadence?: 'weekly') => ({ id, label: id, source: 's', asOf, refreshedAt: asOf, cadence });
  const s = reconcile([d('screen', '2026-10-12'), d('barometer', '2026-10-13'), d('engines', '2026-10-12'), d('rotation', '2026-10-09', 'weekly')], '2026-10-12');
  assert.deepEqual(s.map((x) => x.state), ['current', 'current', 'current', 'current']);
  assert.ok(s.every((x) => x.basis === 'calendar'));
  // the old rule, with no clock, flags the on-schedule datasets against the barometer: kept for callers that pass none
  const old = reconcile([d('screen', '2026-10-12'), d('barometer', '2026-10-13')]);
  assert.equal(old[0].state, 'delayed'); assert.equal(old[0].basis, 'newest');
});
test('freshness against the calendar: every dataset frozen together is caught, which the old rule could not do', () => {
  const frozen = ['screen', 'barometer', 'engines'].map((id) => ({ id, label: id, source: 's', asOf: '2026-10-09', refreshedAt: '2026-10-09' }));
  assert.deepEqual(reconcile(frozen).map((x) => x.state), ['current', 'current', 'current']);                 // no clock: all "current"
  const monday = reconcile(frozen, '2026-10-12');                                                             // Mon expected: 1 session behind
  assert.deepEqual(monday.map((x) => [x.state, x.lagSessions]), [['delayed', 1], ['delayed', 1], ['delayed', 1]]);
  const wednesday = reconcile(frozen, '2026-10-14');                                                          // Mon, Tue, Wed = 3 sessions
  assert.deepEqual(wednesday.map((x) => [x.state, x.lagSessions]), [['stale', 3], ['stale', 3], ['stale', 3]]);
});
test('a weekly dataset is judged against the last completed week, not against daily sessions', () => {
  const rot = (expected: string) => reconcile([{ id: 'rotation', label: 'Rotation', source: 's', asOf: '2026-10-09', refreshedAt: '2026-10-12', cadence: 'weekly' as const }], expected)[0];
  assert.equal(rot('2026-10-12').state, 'current');                                      // Monday: last Friday is the 9th
  assert.equal(rot('2026-10-14').state, 'current');                                      // Wednesday: still the 9th
  const late = rot('2026-10-16');                                                        // Friday the 16th has closed: a week behind
  assert.deepEqual([late.state, late.lagSessions, late.unit], ['delayed', 1, 'week']);
  assert.equal(rot('2026-10-23').state, 'stale');                                        // two weeks behind
});
test('status wording says what it was judged against and in which unit', () => {
  const mk = (cadence: 'weekly' | undefined, expected: string | undefined) => describeStatus(reconcile([{ id: 'x', label: 'x', source: 's', asOf: '2026-10-09', refreshedAt: null, cadence }], expected)[0]);
  assert.equal(mk(undefined, '2026-10-12'), '1 session behind the expected session');
  assert.equal(mk('weekly', '2026-10-16'), '1 week behind the expected week');
  assert.equal(describeStatus(reconcile([{ id: 'a', label: 'a', source: 's', asOf: '2026-10-08', refreshedAt: null }, { id: 'b', label: 'b', source: 's', asOf: '2026-10-09', refreshedAt: null }])[0]), '1 session behind the newest data');
});

const TK = { score: 35, band: 'Weak', stage: 'Slightly cheaper', nifty: 22721.95, drawdownPct: 13.84, vix: 14.12, asOf: '2026-10-13', above200: 470, with200: 930, previous: { score: 29, date: '2026-10-09' } };
test('takeaway: the headline and facts are built only from the figures given, in plain words', () => {
  const t = takeaway(TK);
  assert.equal(t.available, true);
  assert.equal(t.headline, 'A weak market, 13.8% below its high.');
  assert.equal(t.sub, 'Barometer 35 of 100 (up from 29 on 9 Oct 2026). India VIX 14.1, normal. 51% of stocks sit above their 200-day average.');   // 470/930 = 50.5% -> 51
  assert.deepEqual(t.facts.map((f) => [f.id, f.value, f.note, f.tone]), [
    ['barometer', '35 / 100', 'Weak · Slightly cheaper', 'down'],
    ['nifty', '22,722', '13.8% below its high', 'neutral'],
    ['breadth', '51%', '470 of 930 with history', 'neutral'],
    ['vix', '14.1', 'normal', 'neutral'],
  ]);
});
test('takeaway: tone follows the band; a missing figure drops its sentence and tile instead of being invented', () => {
  const firm = takeaway({ ...TK, score: 60, band: 'Firm', stage: null, drawdownPct: 0.4, vix: null, nifty: null, above200: null, with200: null, previous: null });
  assert.equal(firm.headline, 'A firm market, close to its high.');
  assert.equal(firm.sub, 'Barometer 60 of 100.');
  assert.deepEqual(firm.facts.map((f) => [f.id, f.note, f.tone]), [['barometer', 'Firm', 'up']]);
  assert.equal(takeaway({ ...TK, band: 'Mixed', score: 48, drawdownPct: null }).headline, 'A mixed market.');
  assert.equal(takeaway({ ...TK, band: 'Mixed', score: 48 }).facts[0].tone, 'neutral');
  assert.equal(takeaway({ ...TK, band: 'Poor', score: 20 }).facts[0].tone, 'down');
  assert.equal(takeaway({ ...TK, band: 'Strong', score: 80 }).facts[0].tone, 'up');
});
test('takeaway: the change wording, the 1% threshold, and the zero-denominator guard', () => {
  assert.match(takeaway({ ...TK, previous: { score: 35, date: '2026-10-09' } }).sub, /\(unchanged from 35 on 9 Oct 2026\)/);
  assert.match(takeaway({ ...TK, previous: { score: 40, date: '2026-10-09' } }).sub, /\(down from 40 on 9 Oct 2026\)/);
  assert.equal(takeaway({ ...TK, drawdownPct: 1.0 }).headline, 'A weak market, 1.0% below its high.');
  assert.equal(takeaway({ ...TK, drawdownPct: 0.99 }).headline, 'A weak market, close to its high.');
  const none = takeaway({ ...TK, with200: 0 });
  assert.ok(!/200-day/.test(none.sub) && !none.facts.some((f) => f.id === 'breadth'));
});
test('takeaway: nothing is shown as a reading when the Barometer is unavailable; VIX words match the Barometer source', () => {
  const t = takeaway({ ...TK, score: null });
  assert.deepEqual([t.available, t.facts.length], [false, 0]);
  assert.match(t.headline, /not available/);
  assert.deepEqual([11.99, 12, 15.99, 16, 19.99, 20, 25.99, 26].map(vixWord), ['very calm', 'normal', 'normal', 'unsettled', 'unsettled', 'jumpy', 'jumpy', 'stressed']);
});


test('rotation week: an unfinished week is labelled with the date its data runs to, never with the Friday still to come', () => {
  // Tuesday 13 Oct: the newest point carries Friday 16 Oct, the engines hold data through the 13th.
  assert.deepEqual(weekThrough('2026-10-16', '2026-10-13', null), { through: '2026-10-13', inProgress: true });
  assert.deepEqual(weekThrough('2026-10-09', '2026-10-13', null), { through: '2026-10-09', inProgress: false });   // a finished week keeps its label
  assert.deepEqual(weekThrough('2026-10-16', '2026-10-16', null), { through: '2026-10-16', inProgress: false });   // Friday's own close
  assert.deepEqual(weekThrough('2026-10-16', null, '2026-10-13T20:20:40'), { through: '2026-10-13', inProgress: true });   // falls back to when the file was built
  assert.deepEqual(weekThrough('2026-10-16', null, null), { through: '2026-10-16', inProgress: false });           // nothing known: nothing claimed
});
test('rotation freshness: judged like a daily feed against the date its data runs to, so a rebuild that stopped mid-week is caught', () => {
  const rot = (asOf: string, expected: string) => reconcile([{ id: 'rotation', label: 'Rotation', source: 's', asOf, refreshedAt: asOf }], expected)[0];
  assert.equal(rot('2026-10-13', '2026-10-12').state, 'current');                 // built through Tuesday, expected Monday
  const frozen = rot('2026-10-09', '2026-10-13');                                  // still on Friday when Tuesday is expected: Mon, Tue = 2 sessions
  assert.deepEqual([frozen.state, frozen.lagSessions], ['delayed', 2]);
  const wed = rot('2026-10-09', '2026-10-14');                                     // Wednesday expected: Mon, Tue, Wed = 3 sessions
  assert.deepEqual([wed.state, wed.lagSessions], ['stale', 3]);
});

test('NSE dates and price bands read like the rest of the site', () => {
  assert.equal(nseDate('14-Oct-2026'), '14 Oct 2026');
  assert.equal(nseDate('04-OCT-2026'), '4 Oct 2026');
  assert.equal(nseDate('2026-10-14'), '2026-10-14');   // not an NSE date: left alone, never guessed
  assert.equal(rupeeBand('Rs.275 to Rs.289'), '₹275 to ₹289');
  assert.equal(rupeeBand('Rs. 1,875 to Rs. 1,900'), '₹1,875 to ₹1,900');
  assert.equal(rupeeBand(null), '—');
});

test('news themes come from words in the story, several allowed, none allowed', () => {
  assert.deepEqual(topicsOf('Sebi proposes fine for firms, Nifty slips'), ['markets', 'policy']);
  assert.deepEqual(topicsOf('A quiet day'), []);
  assert.ok(topicsOf('Crude oil jumps as Middle East tension rises').includes('commodities'));
  assert.ok(!topicsOf('Interest rate talk').includes('economy'));   // "rate" alone is not a theme; the old matcher over-tagged it
});

test('news time buckets use India dates, and a clock slightly ahead is still "now"', () => {
  const now = Date.parse('2026-10-14T06:00:00Z');                    // 11:30 IST on 14 Oct
  assert.equal(bucketOf('2026-10-14T04:00:00Z', now), 'Last 3 hours');
  assert.equal(bucketOf('2026-10-14T01:00:00Z', now), 'Earlier today');   // 06:30 IST, same India day
  assert.equal(bucketOf('2026-10-13T20:00:00Z', now), 'Earlier today');   // 01:30 IST on 14 Oct: already today in India
  assert.equal(bucketOf('2026-10-13T10:00:00Z', now), 'Yesterday');
  assert.equal(bucketOf('2026-10-10T10:00:00Z', now), 'Older');
  assert.equal(bucketOf('2026-10-14T06:30:00Z', now), 'Last 3 hours');
  assert.equal(bucketOf(null, now), 'Time not stated');
  assert.equal(bucketOf('garbage', now), 'Time not stated');
});

test('company mentions are strict: capitals for tickers, the name as written, never a common word', () => {
  const cos = [{ sym: 'RELIANCE', name: 'Reliance Industries Ltd.' }, { sym: 'DELTACORP', name: 'Delta Corp Ltd.' }, { sym: 'ITC', name: 'ITC Ltd.' }, { sym: 'TCS', name: 'Tata Consultancy Services Ltd.' }];
  assert.deepEqual(mentionsIn('Reliance Industries plans a new unit', cos).map((m) => m.sym), ['RELIANCE']);
  assert.deepEqual(mentionsIn('Delta flight delayed by weather', cos), []);                 // a bare "Delta" is the airline as often as the company
  assert.deepEqual(mentionsIn('Delta Corp shares jump', cos).map((m) => m.sym), ['DELTACORP']);
  assert.deepEqual(mentionsIn('Reliance said on Monday', cos), []);                         // bare "Reliance" could be several companies: no guess
  assert.deepEqual(mentionsIn('shares of itc rose', cos), []);
  assert.deepEqual(mentionsIn('ITC and TCS lead gains', cos).map((m) => m.sym), ['ITC', 'TCS']);
  assert.deepEqual(mentionsIn('TCSX rises', cos), []);                                      // a ticker is its own word
});

test('the desk summary counts what is in the stories and nothing else', () => {
  const st = (source: string) => ({ title: 't', summary: '', link: source, source });
  const d = summariseNews([
    { story: st('ET'), topics: ['markets', 'policy'], mentions: [{ sym: 'AAA', basis: 'x' }] },
    { story: st('ET'), topics: ['policy'], mentions: [{ sym: 'AAA', basis: 'x' }, { sym: 'BBB', basis: 'y' }] },
    { story: st('BBC'), topics: [], mentions: [] },
  ], (sym) => ({ AAA: 'Energy', BBB: 'Energy' }[sym]));
  assert.equal(d.stories, 3); assert.equal(d.sources, 2);
  assert.deepEqual(d.themes.map((t) => [t.id, t.n]), [['policy', 2], ['markets', 1]]);
  assert.deepEqual(d.names, [{ sym: 'AAA', n: 2 }, { sym: 'BBB', n: 1 }]);
  assert.deepEqual(d.sectors, [{ sector: 'Energy', n: 2 }]);   // two distinct companies, not three mentions
});

test('company matching never names a bank inside a longer name, or a generic word', () => {
  const cos = [
    { sym: 'BANKINDIA', name: 'Bank of India Ltd.', mcap: 55000 }, { sym: 'SBIN', name: 'State Bank of India', mcap: 700000 },
    { sym: 'INFY', name: 'Infosys Ltd.', mcap: 600000 }, { sym: 'KTKBANK', name: 'Karnataka Bank Ltd.', mcap: 6000 },
    { sym: 'IGIL', name: 'International Gemmological Institute (India) Ltd.', mcap: 9000 }, { sym: 'RELIANCE', name: 'Reliance Industries Ltd.', mcap: 1900000 },
    { sym: 'RPOWER', name: 'Reliance Power Ltd.', mcap: 9000 }, { sym: 'GICRE', name: 'General Insurance Corporation of India', mcap: 60000 },
    { sym: 'IRCON', name: 'Ircon International Ltd.', mcap: 9000 },
  ];
  const m = (t: string) => mentionsIn(t, cos).map((x) => x.sym);
  assert.deepEqual(m('The Reserve Bank of India kept rates unchanged'), []);                 // the tail of a longer name
  assert.deepEqual(m('Shares of Bank of India rose 3%'), ['BANKINDIA']);
  assert.deepEqual(m('Infosys wins a large deal'), ['INFY']);                                  // large, and no other company starts with it
  assert.deepEqual(m('Karnataka Bank said'), ['KTKBANK']);                                     // full name still matches
  assert.deepEqual(m('Karnataka reports record rain; International flights resume'), []);       // places and generic words never match alone
  assert.deepEqual(m('Reliance to expand'), []);                                               // two companies share the word: no guess
  assert.deepEqual(m('General Motors recalls cars'), []);                                      // "General" is an ordinary word even for a large company
  assert.deepEqual(m('Ircon to monetise assets'), []);                                         // small company, 5 letters: precision over recall
});

test('A05: an institution never resolves to a listed company; the company itself still does', () => {
  const cos = [
    { sym: 'FEDERALBNK', name: 'The Federal Bank Ltd.', mcap: 45000 }, { sym: 'FEDBANK', name: 'Fedbank Financial Services Ltd.', mcap: 4000 },
    { sym: 'BANKINDIA', name: 'Bank of India Ltd.', mcap: 55000 }, { sym: 'UNIONBANK', name: 'Union Bank of India', mcap: 90000 },
    { sym: 'INFY', name: 'Infosys Ltd.', mcap: 600000 }, { sym: 'FEDX', name: 'Federal Mogul Goetze Ltd.', mcap: 25000 }, { sym: 'BAJFIN', name: 'Bajajfin Services Ltd.', mcap: 500000 },
  ];
  const m = (t: string) => mentionsIn(t, cos).map((x) => x.sym);
  assert.deepEqual(m('Gold climbs as the Federal Reserve signals a pause'), []);
  assert.deepEqual(m('Federal Reserve minutes weigh on Asian markets; gold firm'), []);
  assert.deepEqual(m('Reserve Bank of India holds the repo rate'), []);
  assert.deepEqual(m('Union Budget to raise capex'), []);
  assert.deepEqual(m('The Federal Bank reports a rise in profit'), ['FEDERALBNK'], 'its full name still matches');
  assert.deepEqual(m('Shares of Union Bank of India rose'), ['UNIONBANK']);
  assert.deepEqual(m('Infosys wins a deal'), ['INFY']);
  assert.deepEqual(m('Bajajfin Housing raises funds'), [], 'a brand word followed by a different capitalised word is another name');
  assert.deepEqual(m('Bajajfin shares rise'), ['BAJFIN']);
});

test('A01 (master build): a longer legal name never resolves to the listed company it starts with', () => {
  const cos = [{ sym: 'INDIACEM', name: 'India Cements Ltd.', mcap: 12000 }, { sym: 'TCS', name: 'Tata Consultancy Services Ltd.', mcap: 1200000 }];
  const m = (t: string) => mentionsIn(t, cos).map((x) => x.sym);
  // the story of 21 Oct 2026 as BusinessLine published it
  assert.deepEqual(m('India Cements Capital receives open offer letter at ₹12 per share. The open offer will open on October 28 and close on November 11, 2026'), []);
  assert.deepEqual(m('India Cements Capital Receives Open Offer Letter'), [], 'Title Case: "Capital" still continues a name');
  assert.deepEqual(m('India Cements Ltd reports a loss'), ['INDIACEM'], 'its legal ending is still the company');
  assert.deepEqual(m('India Cements reports a quarterly loss'), ['INDIACEM']);
  assert.deepEqual(m('India Cements Shares Fall After Results'), ['INDIACEM'], 'Title Case: an ordinary next word does not end the match');
  assert.deepEqual(m('TCS Q2 results beat estimates'), ['TCS'], 'a ticker is not cut short by the word after it');
});

import { fromQuery, SCREEN_DEFAULT, toQuery } from '../src/lib/screenUrl.ts';
const allow = { fields: new Set(['roce', 'de', 'pe', 'comp']), flags: new Set(['vetted', 'uptrend']), lenses: new Set(['quality']), tiers: new Set(['large', 'mid', 'small']) };

test('screenUrl: a full state survives the round trip through the address', () => {
  const s = { ...SCREEN_DEFAULT, q: 'bank', sector: 'Financial Services', tier: 'large', conds: [{ f: 'roce', op: '>=' as const, v: '20' }, { f: 'de', op: '<=' as const, v: '0.5' }], flags: ['vetted'], lens: 'quality', sort: 'pe', dir: 1 as const, ask: 'roce above 20', off: ['ROCE ≥ 20'] };
  assert.deepEqual(fromQuery(toQuery(s), allow), s);
});

test('screenUrl: the default state writes nothing to the address', () => {
  assert.equal(toQuery(SCREEN_DEFAULT), '');
  assert.deepEqual(fromQuery('', allow), SCREEN_DEFAULT);
});

test('screenUrl: unknown measures, flags, lenses, sizes and non-numbers from a link are dropped, not trusted', () => {
  const s = fromQuery('?f=evil:min:1&f=roce:min:abc&f=roce:min:15&only=vetted,admin&lens=x&size=huge&sort=__proto__:asc', allow);
  assert.deepEqual(s.conds, [{ f: 'roce', op: '>=', v: '15' }]);
  assert.deepEqual(s.flags, ['vetted']);
  assert.equal(s.lens, '');
  assert.equal(s.tier, '');
  assert.equal(s.sort, 'comp');
  assert.equal(s.dir, -1);
});

import { sessionOf } from '../src/lib/session.ts';
test('market session: open needs a fresh Nifty trade inside NSE hours; a stale trade on a weekday (a holiday) reads closed', () => {
  const at = (iso: string) => Date.parse(iso) / 1000;
  // Wed 14 Oct 2026, 11:00 IST = 05:30 UTC
  assert.equal(sessionOf(at('2026-10-14T05:25:00Z'), Date.parse('2026-10-14T05:30:00Z'))?.open, true);
  assert.equal(sessionOf(at('2026-10-13T10:00:00Z'), Date.parse('2026-10-14T05:30:00Z'))?.open, false, 'no trade today: holiday or feed stall');
  assert.equal(sessionOf(at('2026-10-14T10:00:00Z'), Date.parse('2026-10-14T10:05:00Z'))?.open, false, '15:35 IST is after the close');
  assert.equal(sessionOf(null), null);
  assert.match(sessionOf(at('2026-10-14T10:01:12Z'), Date.parse('2026-10-14T18:00:00Z'))?.label ?? '', /closed · Nifty last traded 14 Oct, 15:31 IST/);
});

import { companyHref, slugToSym, symToSlug } from '../src/lib/slug.ts';
test('company slug: & round-trips through _, plain and hyphenated symbols are untouched', () => {
  for (const s of ['INFY', 'M&M', 'J&KBANK', 'BAJAJ-AUTO', 'GMRP&UI']) assert.equal(slugToSym(symToSlug(s)), s);
  assert.equal(companyHref('M&M'), '/company/M_M/');
  assert.equal(slugToSym('m_m'), 'M&M');
});

import { dayFromLive, istDate, mergeLive, pickDay } from '../src/lib/live.ts';
test('live: IST session date, merge of halves, and a failed half is missing, not zero', () => {
  assert.equal(istDate(Date.parse('2026-10-14T19:00:00Z') / 1000), '2026-10-15', '00:30 IST is the next calendar day');
  const t = Date.parse('2026-10-15T04:50:00Z') / 1000;
  const snap = mergeLive([{ ok: true, part: 0, parts: 2, fetched_at: 'a', count: 2, quotes: { A: [110, 100, t], B: [90, 100, t] } }, { ok: false, part: 1, parts: 2, fetched_at: 'b', count: 0, quotes: {} }], 4);
  assert.ok(snap);
  assert.deepEqual(snap.pct, { A: 10, B: -10 });
  assert.equal(snap.session, '2026-10-15');
  assert.equal(snap.count, 2);
  assert.equal(mergeLive([null, undefined], 4), null);
  // each symbol keeps its own last trade, so a stale one (suspended, renamed) can be told apart from the session's trades
  const old = Date.parse('2026-10-12T09:59:59Z') / 1000;
  const mixed = mergeLive([{ ok: true, part: 0, parts: 1, fetched_at: 'a', count: 2, quotes: { A: [110, 100, t], Z: [138.5, 13.83, old] } }], 2)!;
  assert.deepEqual(mixed.at, { A: t, Z: old });
  assert.equal(mixed.session, '2026-10-15');
  assert.equal(istDate(mixed.at.Z), '2026-10-12');
});

test('live: day figures use the universe sectors; pickDay prefers the newer session and needs 90% coverage', () => {
  const t = Date.parse('2026-10-15T04:50:00Z') / 1000;
  const snap = mergeLive([{ ok: true, part: 0, parts: 1, fetched_at: 'a', count: 3, quotes: { A: [101, 100, t], B: [99, 100, t], C: [100, 100, t] } }], 3)!;
  const live = dayFromLive(snap, { built_on: 'x', as_of: '2026-10-14', count: 3, rows: [['A', 'Tech', 'A Ltd'], ['B', 'Tech', 'B Ltd'], ['C', 'Bank', 'C Ltd']] });
  assert.deepEqual([live.up, live.down, live.flat, live.counted], [1, 1, 1, 3]);
  assert.deepEqual(live.sectors.map((s) => [s.name, s.median]), [['Bank', 0], ['Tech', 0]]);
  const close = { source: 'close' as const, session: '2026-10-14', up: 5, down: 1, flat: 0, counted: 6, sectors: [] };
  assert.equal(pickDay(close, live, 1)?.source, 'live', 'a newer live session wins');
  assert.equal(pickDay(close, live, 0.5)?.source, 'close', 'half the market is not the market');
  assert.equal(pickDay({ ...close, session: '2026-10-15' }, live, 1)?.source, 'close', 'same session: the vetted close wins');
  assert.equal(pickDay(null, null, 0), null);
});

import { nseClock } from '../src/lib/live.ts';
test('nse clock: hours, next open across a weekend, before the bell', () => {
  assert.deepEqual(nseClock(Date.parse('2026-10-15T05:00:00Z')).inHours, true);   // Thu 10:30 IST
  const fri = nseClock(Date.parse('2026-10-16T11:00:00Z'));                          // Fri 16:30 IST
  assert.equal(fri.inHours, false); assert.equal(fri.nextLabel, 'opens 09:15 IST Mon');
  assert.equal(nseClock(Date.parse('2026-10-15T03:00:00Z')).nextLabel, 'opens 09:15 IST today');   // 08:30 IST
  assert.equal(nseClock(Date.parse('2026-10-15T03:00:00Z')).minutesToNext, 45);
  assert.equal(nseClock(Date.parse('2026-10-15T11:00:00Z')).nextLabel, 'opens 09:15 IST tomorrow');
});

test('live: a stock not traded in the current session keeps its price but has no move (CCAVENUE +901%, 15 Oct 2026)', () => {
  const now = Date.parse('2026-10-15T04:50:00Z') / 1000, old = Date.parse('2026-10-12T09:59:00Z') / 1000;
  const snap = mergeLive([{ ok: true, part: 0, parts: 1, fetched_at: 'a', count: 2, quotes: { INFY: [1115.9, 1088, now], CCAVENUE: [138.5, 13.83, old] } }], 2)!;
  assert.deepEqual(Object.keys(snap.pct), ['INFY']);
  assert.equal(snap.price.CCAVENUE, 138.5);
  assert.deepEqual(snap.stale, ['CCAVENUE']);
  assert.equal(snap.count, 1);
});

// ── per-stock "today" (lib/today.ts) ──
import { istHM, movers, sessionDay, tally, todayView } from '../src/lib/today.ts';

test('todayView: live day reads the snapshot; a stock it lacks shows nothing, never the older close', () => {
  const now = Date.UTC(2026, 9, 15, 9, 2) / 1000, old = Date.UTC(2026, 9, 12, 9, 59) / 1000;
  const snap = { pct: { AAA: 1.25, BBB: -0.5, CCC: 0, OLD: 901.45 }, price: { AAA: 101.25, BBB: 99.5, CCC: 10, OLD: 138.5 }, at: { AAA: now, BBB: now, CCC: now, OLD: old }, newest: now, session: '2026-10-15', stale: [], count: 4, universe: 4, fetchedAt: '' };
  const day = { source: 'live' as const, session: '2026-10-15', up: 1, down: 1, flat: 1, counted: 3, sectors: [] };
  const v = todayView(day, snap, '2026-10-14');
  assert.equal(v.live, true);
  assert.equal(v.at, '14:32');                       // 09:02 UTC = 14:32 IST
  assert.equal(v.tag, 'live 14:32');
  assert.equal(v.asOf, 'live 2026-10-15 14:32 IST');
  assert.equal(v.pct('AAA', 9.9), 1.25);
  assert.equal(v.price('BBB', 1), 99.5);
  assert.equal(v.pct('ZZZ', 3.3), null);
  assert.equal(v.price('ZZZ', 50), null);
  // a quote whose last trade is in an older session has no move today (CCAVENUE, 15 Oct 2026: +901% off a 12 Oct trade)
  assert.equal(v.pct('OLD', 0), null);
  assert.equal(v.price('OLD', 138.3), null);
});

test('dayFromLive: a stale quote is left out of breadth and sectors, and counted as stale', () => {
  const t = Date.parse('2026-10-15T04:50:00Z') / 1000, old = Date.parse('2026-10-12T09:59:59Z') / 1000;
  const snap = mergeLive([{ ok: true, part: 0, parts: 1, fetched_at: 'a', count: 3, quotes: { A: [101, 100, t], B: [99, 100, t], Z: [138.5, 13.83, old] } }], 3)!;
  const d = dayFromLive(snap, { built_on: 'x', as_of: '2026-10-14', count: 3, rows: [['A', 'Tech', 'A'], ['B', 'Tech', 'B'], ['Z', 'Tech', 'Z']] });
  assert.deepEqual([d.up, d.down, d.flat, d.counted, d.stale], [1, 1, 0, 2, 1]);
  assert.deepEqual(d.sectors, [{ name: 'Tech', n: 2, median: 0 }]);
});

test('todayView: close day (or no day yet) reads the screen row, dated by the screen', () => {
  const day = { source: 'close' as const, session: '2026-10-14', up: 1, down: 0, flat: 0, counted: 1, sectors: [] };
  for (const d of [day, null]) {
    const v = todayView(d, null, '2026-10-14');
    assert.equal(v.live, false);
    assert.equal(v.tag, '14 Oct 2026 close');
    assert.equal(v.asOf, 'close 2026-10-14');
    assert.equal(v.pct('AAA', 2.5), 2.5);
    assert.equal(v.pct('AAA', null), null);
    assert.equal(v.price('AAA', Number.NaN), null);
  }
});

test('todayView: on a close day, a snapshot of the same session supplies the traded (unadjusted) price (MRPL 19 Oct 2026)', () => {
  const t = Date.parse('2026-10-19T10:00:00Z') / 1000;
  const snap = mergeLive([{ ok: true, part: 0, parts: 1, fetched_at: 'a', count: 1, quotes: { MRPL: [173.72, 172.71, t] } }], 1)!;
  const day = { source: 'close' as const, session: '2026-10-19', up: 1, down: 0, flat: 0, counted: 1, sectors: [] };
  const v = todayView(day, snap, '2026-10-19');
  assert.equal(v.price('MRPL', 170.72), 173.72);
  assert.equal(v.pct('MRPL', 0.6), 0.58);
  assert.equal(v.price('OTHER', 50), 50, 'a stock the snapshot lacks keeps its close');
  assert.equal(todayView(day, snap, '2026-10-16').price('MRPL', 170), 170, 'a different session never mixes in');
});

test('tally and movers: zero is unchanged, missing is uncounted, ties break on the symbol', () => {
  assert.deepEqual(tally([1, -1, 0, null, undefined, Number.NaN, 2]), { up: 2, down: 1, flat: 1, counted: 4 });
  const m = movers([{ sym: 'B', v: 2 }, { sym: 'A', v: 2 }, { sym: 'C', v: -3 }, { sym: 'D', v: 0 }, { sym: 'E', v: null }], 5);
  assert.deepEqual(m.up.map((x) => x.sym), ['A', 'B']);
  assert.deepEqual(m.down.map((x) => x.sym), ['C']);
});

test('istHM and sessionDay: IST clock and a calendar date that no time zone can shift', () => {
  assert.equal(istHM(Date.UTC(2026, 9, 15, 18, 45) / 1000), '00:15');
  assert.equal(sessionDay('2026-10-15'), 'Thu 15 Oct');
});

import { priceLabel, priceView, sessionLabel } from '../src/lib/price.ts';
test('price: per-symbol live rule follows pickDay (newer session wins, a tie takes the traded price) and labels say which', () => {
  const t = Date.parse('2026-10-15T04:50:00Z') / 1000;                       // Thu 10:20 IST
  const snap = mergeLive([{ ok: true, part: 0, parts: 1, fetched_at: 'a', count: 1, quotes: { INFY: [1115.65, 1088, t] } }], 1)!;
  const row = { price: 1088, r1d: 2.1, last_date: '2026-10-14' };
  const live = priceView('INFY', row, snap, null);
  assert.deepEqual([live.source, live.price, live.pct, live.session], ['live', 1115.65, 2.54, '2026-10-15']);
  assert.equal(priceLabel(live, (t + 120) * 1000).text, 'live 10:20 IST');
  assert.equal(priceLabel(live, (t + 40 * 60) * 1000).text, 'last trade 10:20 IST', 'quiet inside hours: not called live');
  assert.equal(priceLabel(live, Date.parse('2026-10-15T12:00:00Z')).text, '15 Oct 2026 close', 'after the bell it is the day close');
  const tie = priceView('INFY', { ...row, last_date: '2026-10-15', price: 1110 }, snap, null);
  assert.deepEqual([tie.source, tie.price], ['live', 1115.65], 'same session: the traded price wins over the dividend-adjusted close');
  assert.equal(priceLabel(tie, Date.parse('2026-10-15T12:00:00Z')).text, '15 Oct 2026 close');
  const q = priceView('TCS', row, snap, { price: 3000, pct: 1, at: t });
  assert.equal(q.source, 'quote', 'a symbol missing from the snapshot falls back to its own quote');
  const old = priceView('TCS', row, snap, { price: 3000, pct: 1, at: Date.parse('2026-10-14T10:00:00Z') / 1000 });
  assert.deepEqual([old.source, old.price, old.pct], ['close', 1088, 2.1], 'a quote no newer than the close does not replace it');
  assert.equal(priceView('X', null, null, null).price, null);
  assert.equal(sessionLabel('2026-10-14'), '14 Oct 2026');
  assert.equal(sessionLabel(null), 'date not stated');
});

test('price: a stock that did not trade in the live session never shows a day move (CCAVENUE, +901% on 12 Oct)', () => {
  const t = Date.parse('2026-10-15T04:50:00Z') / 1000;
  const old = Date.parse('2026-10-12T09:00:00Z') / 1000;
  const snap = mergeLive([{ ok: true, part: 0, parts: 1, fetched_at: 'a', count: 2, quotes: { INFY: [1115.65, 1088, t], CCAVENUE: [1001, 100, old] } }], 2)!;
  assert.equal(snap.session, '2026-10-15');
  const v = priceView('CCAVENUE', { price: 99, r1d: 0, last_date: '2026-10-10' }, snap, null);
  assert.deepEqual([v.source, v.price, v.pct, v.session], ['stale', 1001, null, '2026-10-12']);
  assert.equal(priceLabel(v, (t + 60) * 1000).text, 'last traded 12 Oct 2026');
  const c = priceView('CCAVENUE', { price: 1001, r1d: 0.5, last_date: '2026-10-14' }, snap, null);
  assert.equal(c.source, 'close', 'a close newer than its last trade stays the close');
  const q = priceView('CCAVENUE', { price: 99, r1d: 0, last_date: '2026-10-10' }, mergeLive([{ ok: true, part: 0, parts: 1, fetched_at: 'a', count: 1, quotes: { INFY: [1115.65, 1088, t] } }], 1), { price: 1001, pct: 901, at: old });
  assert.deepEqual([q.source, q.pct], ['stale', null], 'the per-symbol quote follows the same rule');
});

import { computeBarometer, pyRound, stageOf, vixScore } from '../src/lib/barometer.ts';
test('barometer: reproduces the published 16 Oct 2026 reading from its own inputs (41, Mixed, Slightly cheaper)', () => {
  // Published components: trend 23.0, breadth 48.0 (473/985), participation 58.4 (575/985), volatility 70 (VIX 14.06), highs 0.0.
  // hi and lo are chosen to give the published trend position (23%) and drawdown (12.24%).
  const c = 23146.150390625, hi = c / (1 - 0.1224), lo = (c - 0.23 * hi) / 0.77;
  const r = computeBarometer(c, hi, lo, { counted: 985, above200: 473, up: 575, at52wHigh: 0 }, 14.0600004196167)!;
  assert.deepEqual(r.parts.map((p) => [p.key, p.score]), [['trend', 23], ['breadth', 48], ['participation', 58.4], ['volatility', 70], ['highs', 0]]);
  assert.equal(r.score, 41);
  assert.equal(r.band.t, 'Mixed');
  assert.equal(r.stage?.t, 'Slightly cheaper');
  assert.equal(r.drawdownPct, 12.24);
  assert.equal(r.coverage.complete, true);
});

test('barometer: Python rounding (halves to even), VIX bands, stages, and honest coverage when inputs are missing', () => {
  assert.equal(pyRound(40.5), 40); assert.equal(pyRound(41.5), 42); assert.equal(pyRound(40.56), 41);
  assert.deepEqual([vixScore(11.9), vixScore(12), vixScore(16), vixScore(20), vixScore(26)], [85, 70, 50, 28, 10]);
  assert.equal(stageOf(26, 20).k, 'deep'); assert.equal(stageOf(16, 40).k, 'real'); assert.equal(stageOf(10, 80).k, 'early'); assert.equal(stageOf(9.9, 10).k, 'none');
  const r = computeBarometer(null, null, null, { counted: 100, above200: 50, up: null, at52wHigh: null }, null)!;
  assert.equal(r.score, 50);
  assert.deepEqual(r.coverage.missing, ['trend', 'participation', 'volatility', 'highs']);
  assert.equal(r.coverage.complete, false);
  assert.equal(computeBarometer(1, 2, 0, { counted: 0, above200: 1, up: 1, at52wHigh: 0 }, 14), null);
});

import { sessionHead } from '../src/lib/session.ts';
test('sessionHead: live in hours, close after the bell, "latest close" before the open (the 20 Oct 2026 screenshot)', () => {
  const t = (iso: string) => Date.parse(iso);
  const live = { newest: t('2026-10-20T09:12:00Z') / 1000, session: '2026-10-20' };
  assert.equal(sessionHead('2026-10-20', live, t('2026-10-20T09:14:00Z')), 'Tuesday 20 October · live 14:42 IST');
  assert.equal(sessionHead('2026-10-20', live, t('2026-10-20T15:00:00Z')), 'Tuesday 20 October · market close');
  // 08:49 IST on Tue 20 Oct, before the bell: the newest session is Monday's close, said as such
  assert.equal(sessionHead('2026-10-19', { newest: t('2026-10-19T10:00:00Z') / 1000, session: '2026-10-19' }, t('2026-10-20T03:19:00Z')), 'Monday 19 October · latest close · NSE opens 09:15 IST today');
  assert.equal(sessionHead(null, null), null);
});

import { sessionGaps } from '../src/lib/status.ts';
test('status: a weekday the NSE did not trade (20 Oct 2026, Diwali) is not a session the data should hold', () => {
  const sessions = ['2026-10-15', '2026-10-16', '2026-10-19', '2026-10-21'];
  assert.deepEqual(sessionGaps(sessions), ['2026-10-20']);
  assert.deepEqual(sessionGaps(['2026-10-16', '2026-10-19']), [], 'a weekend is not a gap');
  assert.deepEqual(sessionGaps(null), []);
  const skip = new Set(sessionGaps(sessions));
  const wedMorning = new Date('2026-10-21T04:00:00Z');                                            // Wed 09:30 IST
  assert.equal(expectedSession(wedMorning), '2026-10-20', 'without the market record, Tuesday is expected');
  assert.equal(expectedSession(wedMorning, skip), '2026-10-19', 'with it, the holiday is skipped');
  const d = (id: string, asOf: string) => ({ id, label: id, source: 'x', asOf, refreshedAt: null });
  assert.deepEqual(reconcile([d('screen', '2026-10-19')], expectedSession(wedMorning, skip), skip).map((x) => x.state), ['current']);
  assert.equal(sessionsBetween('2026-10-16', '2026-10-21', skip), 2, 'Mon and Wed; Tue had no trading');
});

import { bookCurve as bookCurve2, dayR as dayR2, decide as decide2, groupDecisions as group2, mark, rAtPrevClose as rPrev2 } from '../src/lib/plan.ts';
import type { Sig } from '../src/lib/types.ts';
const base2: Sig = { id: 'swing:X:2026-10-14', engine: 'swing', sym: 'X', name: 'X Ltd', sector: 'Tech', setup: 'Pullback', date: '2026-10-14', ref_price: 100, sl: 95,
  risk_pct: 5, t1_plan: 110, t2_plan: 120, max_hold: 30, why: [], first_seen: '2026-10-14', status: 'open', half: false,
  entry: 100, entry_date: '2026-10-15', t1: 110, t2: 120, risk: 5, stop_now: 95, remaining: 1, last_close: 104, last_close_date: '2026-10-19',
  events: [{ date: '2026-10-15', kind: 'entry', price: 100, fraction: 1 }] };
const at2 = (price: number, session = '2026-10-21') => ({ price, source: 'live' as const, session, at: Date.UTC(2026, 9, 21, 5, 0) / 1000 });
test('plan: R = (price - entry) / risk before T1; the stop is named Stop', () => {
  const m = mark(base2, at2(103));
  assert.equal(m.r, 0.6); assert.equal(m.stopKind, 'stop'); assert.equal(m.state, 'hold'); assert.equal(m.toNext?.label, 'T1');
  assert.equal(mark(base2, at2(94.5)).state, 'stop-hit');
  assert.equal(mark(base2, at2(111)).state, 't1-hit');
});
test('plan: after T1 the stop is a profit lock at entry + 0.5R, never the entry (the GHCLTEXTIL screenshot)', () => {
  const s = { ...base2, half: true, remaining: 0.5, stop_now: 102.5, events: [...base2.events, { date: '2026-10-16', kind: 't1' as const, price: 110, fraction: 0.5 }] };
  const m = mark(s, at2(106));
  assert.equal(m.stopKind, 'lock'); assert.notEqual(m.stop, m.entry);
  assert.equal(m.r, 1.6, 'half booked at +2R (1R) plus half at +1.2R (0.6R)');
  assert.equal(m.toNext?.label, 'T2');
  assert.equal(mark({ ...s, stop_now: 104 }, at2(106)).stopKind, 'trail');
  assert.equal(mark(s, at2(121)).state, 't2-hit');
});
test('plan: pending has no R; closed shows its booked result', () => {
  const p = { ...base2, status: 'pending' as const, entry: undefined, entry_date: undefined, risk: undefined, events: [] };
  assert.equal(mark(p, null).r, null); assert.equal(mark(p, null).state, 'awaiting-entry');
  assert.equal(mark({ ...base2, status: 'closed', r_net: -1.03, closed_date: '2026-10-19' }, null).r, -1.03);
});
test('plan: day R and the day curve count from the previous close, or from the entry when entered today', () => {
  assert.equal(rPrev2(base2, '2026-10-21', 104), 0.8);
  assert.equal(Math.round(dayR2(base2, { r: 1.2, session: '2026-10-21' }, 104)! * 100) / 100, 0.4);
  assert.equal(rPrev2({ ...base2, entry_date: '2026-10-21' }, '2026-10-21', 99), 0);
  const c = bookCurve2([{ s: base2, session: '2026-10-21' }], { X: { prev: 104, t: [1, 2], c: [105, 103] } });
  assert.deepEqual(c.map((p) => p.r), [0.2, -0.2]);
});
test('plan: decisions name the order: sell half and lock, raise the trail, enter, exit', () => {
  const d = (s: Sig, px: number) => decide2(s, mark(s, at2(px)), '2026-10-19');
  assert.equal(d(base2, 94)!.kind, 'exit');
  assert.match(d(base2, 111)!.headline, /Sell half at T1 ₹110\.00; move the stop to ₹102\.50/);
  assert.equal(d(base2, 103)!.kind, 'hold');
  const trail = { ...base2, half: true, stop_now: 104, stop_before: 102.5, stop_raised_on: '2026-10-19', events: [...base2.events, { date: '2026-10-16', kind: 't1' as const, price: 110, fraction: 0.5 }] };
  assert.match(d(trail, 107)!.headline, /Raise the trailing stop to ₹104\.00/);
  const pend = { ...base2, status: 'pending' as const, entry: undefined, entry_date: undefined, risk: undefined, events: [] };
  assert.match(decide2(pend, mark(pend, null), '2026-10-19')!.detail, /above ₹102\.00/);
  assert.deepEqual(group2([d(base2, 103), d(base2, 94), d(base2, 111)]).map((g) => g.kind), ['exit', 'modify', 'hold']);
});

import { labelFor } from '../src/lib/treemap.ts';
test('map labels: big tiles get the whole symbol, small ones its first letters, slivers stay blank', () => {
  assert.deepEqual(labelFor(120, 60, 'HDFCBANK').text, 'HDFCBANK');
  const mid = labelFor(40, 30, 'EICHERMOT');
  assert.ok(mid.font >= 6.5 && mid.text.length >= 3 && 'EICHERMOT'.startsWith(mid.text), JSON.stringify(mid));
  assert.equal(labelFor(36, 26, 'TCS').text, 'TCS');
  assert.deepEqual(labelFor(12, 30, 'TCS'), { font: 0, text: '' });
  assert.deepEqual(labelFor(40, 8, 'TCS'), { font: 0, text: '' });
});

import { highlights, levels } from '../src/lib/levels.ts';
test('levels: averages, pivots from the last complete session, 52-week range and streak', () => {
  const n = 260, t = Array.from({ length: n }, (_, i) => 1735700000 + i * 86400);
  const c = Array.from({ length: n }, (_, i) => 100 + i * 0.5);
  const b = { t, o: c, h: c.map((x) => x + 1), l: c.map((x) => x - 1), c };
  const lv = levels(b, null)!;
  assert.equal(lv.last, c[n - 1]);
  assert.equal(Math.round(lv.sma20! * 100) / 100, Math.round((c.slice(-20).reduce((a, x) => a + x, 0) / 20) * 100) / 100);
  const H = c[n - 1] + 1, L = c[n - 1] - 1, C = c[n - 1], P = (H + L + C) / 3;
  assert.ok(Math.abs(lv.pivots!.p - P) < 1e-9 && Math.abs(lv.pivots!.r1 - (2 * P - L)) < 1e-9);
  assert.equal(lv.hi52!.v, c[n - 1] + 1);
  assert.ok(lv.streak >= 250, 'every close higher');
  const open = levels(b, 230, true)!;
  assert.ok(Math.abs(open.pivots!.p - (c[n - 2] + 1 + c[n - 2] - 1 + c[n - 2]) / 3) < 1e-9, 'session open: pivots from the bar before');
  assert.ok(highlights(lv).includes('Within 1% of its 52-week high'));
  assert.equal(levels({ t: [1], o: [1], h: [1], l: [1], c: [1] }, 1), null);
});

import { BANNED, copyViolations, isStale, viewModel, type V3Feed } from '../src/lib/enginesV3.ts';
const V3: V3Feed = { schema: 'alpha-engines/3', generated: '2026-10-22T14:00:00Z', data_watermark: '2026-10-22', evidence: 'abc', alerts_enabled: false,
  engines: { E1: { state: 'RESEARCH', why: 'not promoted: n_ge_891' }, E6: { state: 'BLOCKED_DATA', why: 'timestamps missing' } },
  forming: [{ engine: 'E1', symbol: 'TCS', as_of: '2026-10-22', state: 'RESEARCH', met: 'top-quintile momentum', missing: 'a close above 3,400.00' }],
  paper: [{ id: 'E2:INFY:2026-10-22', engine: 'E2', symbol: 'INFY', as_of: '2026-10-22', state: 'RESEARCH', entry_rule: 'next open', invalidation: 1500, expiry: 'end of the next session' }],
  validated: [], closed: [{ id: 'E5:ITC:2026-10-01', engine: 'E5', symbol: 'ITC', as_of: '2026-10-01', state: 'RESEARCH', status: 'filled', r_net: -1.04, exit_reason: 'stop_gap', exit_date: '2026-10-03' }] };
test('engines v3 views: four views, research cards never live, empty and stale states are stated', () => {
  const vm = viewModel(V3, new Date('2026-10-22T15:00:00Z'));
  assert.equal(vm.status, 'ok');
  assert.deepEqual(vm.views.map((v) => v.key), ['forming', 'paper', 'validated', 'closed']);
  assert.ok(vm.views.flatMap((v) => v.cards).every((c) => !c.live), 'no research card is live');
  assert.equal(vm.views[0].cards[0].lines[1], 'Still needs: a close above 3,400.00');
  assert.equal(vm.views[2].cards.length, 0);
  assert.match(vm.views[2].empty, /No engine has passed validation/);
  assert.match(vm.views[3].cards[0].lines[0], /−1\.04R net of costs/);
  const stale = viewModel(V3, new Date('2026-10-30T00:00:00Z'));
  assert.equal(stale.status, 'stale');
  assert.match(stale.note, /Nothing below describes today/);
  const missing = viewModel(null, new Date());
  assert.equal(missing.status, 'missing');
  assert.ok(missing.views.every((v) => v.cards.length === 0 && v.empty.length > 0), 'every view says why it is empty');
  assert.ok(isStale('2026-10-16', new Date('2026-10-21T10:00:00Z')) && !isStale('2026-10-19', new Date('2026-10-21T10:00:00Z')));
  const val = viewModel({ ...V3, alerts_enabled: false, validated: [{ ...V3.paper[0], state: 'VALIDATED' }] }, new Date('2026-10-22T15:00:00Z'));
  assert.ok(!val.views[2].cards[0].live, 'validated but alerts off: still not live');
});
test('engines v3 copy-lint: banned phrases are caught, and no engine copy, card or reason uses one', async () => {
  for (const bad of ['Guaranteed returns', 'a safe bottom', 'loss-protected', 'sure-shot pick', 'win probability 70%', 'probability of profit', 'risk-free']) assert.ok(copyViolations(bad).length > 0, bad);
  assert.deepEqual(copyViolations('Research and paper records only; alerts are off.'), []);
  const { readFileSync } = await import('node:fs');
  const text = ['src/lib/enginesV3.ts', 'src/components/EnginesV3.tsx', 'src/app/engines/page.tsx', 'engines/v3/nightly.py', 'engines/v3/publish.py']   // copy a reader can see; the rule files state the bans themselves
    .map((f) => readFileSync(f, 'utf8').replace(/\/\*\* Copy-lint[\s\S]*?\];/m, '')).join('\n');
  const vmText = JSON.stringify(viewModel(V3, new Date('2026-10-22T15:00:00Z')));
  assert.deepEqual(copyViolations(text + vmText), [], 'no banned phrase in engine copy');
  assert.ok(BANNED.length >= 6);
});

test('levels: windows are calendar time, so a 7-day crypto market gets a true 52 weeks and a true one-year return', () => {
  // 366 daily bars, every day of the week (crypto). A peak of 115 in the first month of the year, then 80s.
  const n = 366, t0 = 1761091200;                          // 22 Oct 2025 00:00 UTC
  const t = Array.from({ length: n }, (_, i) => t0 + i * 86400);
  const c = Array.from({ length: n }, (_, i) => (i < 30 ? 110 + (i === 10 ? 5 : 0) : 84));
  const b = { t, o: c, h: c.map((x) => x + 0.5), l: c.map((x) => x - 0.5), c };
  const lv = levels(b, null)!;
  assert.equal(lv.hi52!.v, 115.5, 'the October peak is inside 52 weeks; 252 bars would have stopped in February');
  assert.ok(lv.ret.y1! < -20, `one year: 110 -> 84 is about -24%, got ${lv.ret.y1}`);
  assert.ok(Math.abs(lv.ret.w1!) < 1e-9 && Math.abs(lv.ret.m1!) < 1e-9, 'a flat last month is 0%, not a bar-count window reaching back into the peak');
  // equities: ~250 sessions a year; the same windows cover the same calendar
  const eqT: number[] = [];
  for (let d = 0; eqT.length < 270; d++) { const x = t0 + d * 86400, wd = new Date(x * 1000).getUTCDay(); if (wd !== 0 && wd !== 6) eqT.push(x); }
  const ec = eqT.map((_, i) => 100 + i);
  const e = levels({ t: eqT, o: ec, h: ec, l: ec, c: ec }, null)!;
  const yearAgo = eqT[eqT.length - 1] - 365 * 86400;
  const base = ec[eqT.findLastIndex((x) => x <= yearAgo)];
  assert.ok(Math.abs(e.ret.y1! - (ec[ec.length - 1] / base - 1) * 100) < 1e-9, 'equity one-year return is from the close a calendar year back');
  // a one-year download that starts the day after the anniversary still gives a one-year return (4-day slack)
  const late = levels({ t: t.slice(1), o: c.slice(1), h: c.slice(1), l: c.slice(1), c: c.slice(1) }, null)!;
  assert.ok(late.ret.y1 !== null, 'one day short of a year is still a one-year figure');
  assert.equal(levels({ t: t.slice(-100), o: c.slice(-100), h: c.slice(-100), l: c.slice(-100), c: c.slice(-100) }, null)!.ret.y1, null, 'a hundred days of data has no one-year return');
});

import { rotationShift } from '../src/lib/rotationShift.ts';
test('rotation shift: strength against the Nifty over four weekly points, strongest first', () => {
  const feed = { nifty: [100, 100, 100, 100, 110], groups: { A: { close: [100, 0, 0, 0, 121], members: ['x'], real_index: false }, B: { close: [100, 0, 0, 0, 99], members: [], real_index: true }, C: { close: [null, 1, 1, 1, 5], members: [], real_index: false } } };
  const s = rotationShift(feed, 4);
  assert.deepEqual(s.map((x) => [x.name, x.shift]), [['A', 10], ['B', -10]]);
  assert.deepEqual(rotationShift({ nifty: [1], groups: {} }, 4), []);
});

import { listOps } from '../src/lib/store.ts';
test('A09: list operations never lose or duplicate names, so a bulk add keeps all of them', () => {
  let l: string[] = ['TCS'];
  for (const s of ['INFY', 'HDFCBANK', 'INFY', 'TCS']) l = listOps.add(l, s);
  assert.deepEqual(l, ['TCS', 'INFY', 'HDFCBANK']);
  assert.deepEqual(listOps.addAll(['A'], ['B', 'C', 'B', 'A']), ['A', 'B', 'C']);
  assert.deepEqual(listOps.remove(['A', 'B', 'C'], 'B'), ['A', 'C'], 'removing one keeps the unrelated names');
});

import { ttlFor } from '../src/lib/cache.ts';
test('A12: every endpoint has a lifetime, live prices the shortest', () => {
  assert.equal(ttlFor('/api/quotes'), 120_000);
  assert.equal(ttlFor('/api/px?s=TCS'), 120_000);
  assert.equal(ttlFor('/api/chart?s=TCS&r=1y'), 900_000);
  assert.equal(ttlFor('/c/TCS.json'), 1_800_000);
  assert.equal(ttlFor('/data/screen.json'), 600_000);
  assert.ok(['/signals.json', '/rotation.json', '/universe.json'].every((u) => ttlFor(u) === 600_000));
});

import { reviewDue } from '../src/lib/card.ts';
test('§22.3: a card is due for review only on its own triggers or an observed change, never on price alone', () => {
  const base = buildCard({ question: 'q', companies: [{ sym: 'TCS', name: 'TCS', price: 100, priceAsOf: '2026-10-01' }], nextResults: { TCS: '2026-10-15' } }, new Date('2026-10-02T00:00:00Z'));
  assert.deepEqual(reviewDue(base, '2026-10-21', { TCS: { price: 120, asOf: '2026-10-20', nextResults: '2026-10-15', engines: [] } }), [], 'a price move alone is not a review trigger');
  const dated = { ...base, decision: { thesis: 'x', against: null, unknowns: null, reviewOn: '2026-10-20', reviewWhen: null } };
  assert.match(reviewDue(dated, '2026-10-21')[0], /review date/);
  assert.deepEqual(reviewDue(dated, '2026-10-19'), []);
  const results = { ...base, decision: { thesis: null, against: null, unknowns: null, reviewOn: null, reviewWhen: 'results' as const } };
  assert.match(reviewDue(results, '2026-10-21').join(), /results date 2026-10-15 has passed/);
  assert.deepEqual(reviewDue(results, '2026-10-10'), []);
  const moved = reviewDue(base, '2026-10-21', { TCS: { price: 100, asOf: '2026-10-20', nextResults: '2026-11-02', engines: [] } });
  assert.match(moved.join(), /changed/);
});
test('§22.3: decision fields survive export and import; a version 1 card still reads', () => {
  const c = buildCard({ question: 'q', companies: [{ sym: 'TCS', name: null, price: null, priceAsOf: null }], decision: { thesis: 'Cash-rich', against: 'Margins fall below 20%', unknowns: 'Deal pipeline', reviewOn: '2026-12-01', reviewWhen: 'results' } });
  const back = normaliseCard(JSON.parse(serializeCard(c)));
  assert.ok(back.ok && back.value.decision?.against === 'Margins fall below 20%' && back.value.decision.reviewWhen === 'results');
  const v1 = normaliseCard({ schema: 'alpha.research-card', version: 1, question: 'old', companies: [{ sym: 'TCS' }] });
  assert.ok(v1.ok && v1.value.decision === null);
});

import { AREAS, PAGES, SHORTCUTS, areaFor, pagesIn } from '../src/lib/routes.ts';
test('§17: the route manifest is complete, every page has one area, and shortcuts are unique', () => {
  const hrefs = PAGES.map((p) => p.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const need of ['/', '/brief/', '/markets/', '/screen/', '/map/', '/rotation/', '/engines/', '/trades/', '/reads/', '/ipo/', '/funds/', '/tools/', '/news/', '/compare/', '/calendar/', '/watchlist/', '/journal/', '/about/', '/research/', '/desk/', '/privacy/']) assert.ok(hrefs.includes(need), need);
  for (const a of AREAS) assert.ok(pagesIn(a.id).some((p) => p.href === a.home), `${a.label} lists its own home`);
  assert.equal(new Set(SHORTCUTS.map((s) => s.keys)).size, SHORTCUTS.length);
  assert.equal(areaFor('/company/TCS/'), 'research');
  assert.equal(areaFor('/screen/?q=x'), 'discover');
  assert.equal(areaFor('/'), 'today');
});

import { csvCell } from '../src/lib/csv.ts';
test('§10: CSV cells cannot run as spreadsheet formulas', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+91 Ltd'), `"'+91 Ltd"`);
  assert.equal(csvCell('-x'), `"'-x"`);
  assert.equal(csvCell('@SUM(A1)'), `"'@SUM(A1)"`);
  assert.equal(csvCell('Tata "Motors"'), '"Tata ""Motors"""');
  assert.equal(csvCell(-3.2), '-3.2', 'a negative number is a number, not a formula');
  assert.equal(csvCell(NaN), '');
  assert.equal(csvCell(null), '');
});

import { readFileSync as rf, readdirSync as rd, statSync as st } from 'node:fs';
test('§11: the Privacy page lists every key this site writes to browser storage', () => {
  const walk = (d: string): string[] => rd(d).flatMap((f) => (st(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
  const src = walk('src').filter((f) => /\.tsx?$/.test(f)).map((f) => rf(f, 'utf8')).join('\n');
  const events = new Set(['alpha-store', 'alpha-refreshed', 'alpha-refresh-failed', 'alpha-prefs', 'alpha-cards-changed']);
  const keys = new Set([...src.matchAll(/['`](alpha-[a-z0-9-]+)['`]/g)].map((m) => m[1]).filter((k) => !events.has(k)));
  const page = rf('src/app/privacy/page.tsx', 'utf8');
  const missing = [...keys].filter((k) => !new RegExp(`\\b${k}\\b(?!-)`).test(page));
  assert.deepEqual(missing, []);
});

import { chartRows, chartSummary } from '../src/lib/chartText.ts';
test('§30: a chart says in words what it shows', () => {
  const t = [1767225600, 1767312000, 1767398400, 1767484800];   // 1-4 Jan 2026 (IST dates)
  const txt = chartSummary(t, [100, 90, 130, 118], [101, 92, 131, 119], [99, 88, 120, 115]);
  assert.match(txt, /^Up 18\.0% from 1 Jan 2026 to 4 Jan 2026; low ₹88 on 2 Jan 2026; high ₹131 on 3 Jan 2026; last ₹118\.$/);
  assert.equal(chartSummary([1], [5]), 'Not enough prices to describe.');
  const rows = chartRows(Array.from({ length: 250 }, (_, i) => 1767225600 + i * 86400), Array.from({ length: 250 }, (_, i) => i));
  assert.ok(rows.length <= 26 && rows[0].close === 0 && rows[rows.length - 1].close === 249);
});

import { TEMPLATES } from '../src/lib/templates.ts';
test('§28: every screen template parses completely: each word becomes a clause, none is ignored', () => {
  for (const t of TEMPLATES) {
    const p = parse(t.q);
    assert.deepEqual(p.unknown, [], `${t.name}: ${p.unknown.join(', ')}`);
    assert.ok(p.filters.length >= 2, `${t.name} applies ${p.filters.length} clause(s)`);
  }
});

import { changeParts, pct, pp, bp, ratio, MINUS } from '../src/lib/format.ts';
test('§23.3: changes carry a true minus, the rounded value decides the arrow, and points are not percent', () => {
  assert.equal(pct(-3.14), `${MINUS}3.1%`);
  assert.equal(pct(2.0), '+2.0%');
  assert.equal(pct(-0.04), '0.0%', 'a rounded zero has no sign');
  assert.equal(pp(1.23), '+1.2 pp');
  assert.equal(bp(-7.4), `${MINUS}7 bp`);
  assert.equal(ratio(24.62), '24.6×');
  assert.deepEqual(changeParts(-0.004, 2), { dir: 'flat', text: '0.00%', label: 'unchanged 0.00 percent' });
  assert.deepEqual(changeParts(-1.2, 1), { dir: 'down', text: `▼ ${MINUS}1.2%`, label: 'down 1.2 percent' });
});

test('signed: true minus, explicit plus, no "−0.00", any unit, a dash for nothing', async () => {
  const { signed } = await import('../src/lib/format.ts');
  assert.equal(signed(1.236, 2, 'R'), '+1.24R');
  assert.equal(signed(-0.5, 2, '%'), '−0.50%');
  assert.equal(signed(-0.001, 2, 'R'), '0.00R');
  assert.equal(signed(null), '—');
});

test('sayCrore: crore figures are spoken in words, never as "L cr"', async () => {
  const { sayCrore } = await import('../src/lib/format.ts');
  assert.equal(sayCrore(123456), '1.23 lakh crore rupees');
  assert.equal(sayCrore(950.4), '950 crore rupees');
  assert.equal(sayCrore(null), 'not available');
});

import { checkStudy } from '../src/lib/readcheck.ts';
test('A04/E01: a percentage restated as the wrong paise, or a percentile read as an average, is caught; correct glosses pass', () => {
  assert.equal(checkStudy('* **Net profit margin 69.9 %** – after tax, roughly seven paise of each revenue rupee stay as profit.').length, 1);
  assert.equal(checkStudy('* **EBIT margin 91.8 %** – almost every rupee turns into operating profit, about 92 paise.').length, 0);
  assert.equal(checkStudy('Net margin 11.4 % translates to 11.4 paise of profit per rupee of sales.').length, 0);
  assert.equal(checkStudy('about 53 paise of EBIT and about 42 paise of net profit (EBIT margin 52.9 %, net margin 42.4 %).').length, 0);
  assert.equal(checkStudy('A 40% EBIT margin is eighty paise per rupee.').length, 1);
  assert.equal(checkStudy('roughly 80 paise of profit turns into cash (0.80x).').length, 0, 'no percentage in the sentence: nothing to compare');
  assert.equal(checkStudy('The P/E sits at the 48th percentile, above its historical average.').length, 1);
  assert.equal(checkStudy('The P/E sits at the 48th percentile of its own history: higher than about 48% of it.').length, 0);
  assert.equal(checkStudy('The P/E sits at the 48th percentile, above its median.').length, 1, 'the 48th percentile is below the median');
  assert.equal(checkStudy('sitting at the 58th percentile of its own history, the stock trades above its median multiple').length, 0);
});
