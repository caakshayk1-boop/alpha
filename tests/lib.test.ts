// Run with: node --test tests/   (Node 22.6+ strips the types itself)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breadth200 } from '../src/lib/breadth.ts';
import { buildCard, cardDelta, normaliseCard, parseImport, serializeCard, serializeLibrary, CARD_VERSION } from '../src/lib/card.ts';
import { describe as describeStatus, expectedSession, ordinal, plural, rankPhrase, reconcile, sessionsBetween, weekThrough } from '../src/lib/status.ts';
import { nseDate, plainText, rupeeBand } from '../src/lib/format.ts';
import { bucketOf, mentionsIn, summarise as summariseNews, topicsOf } from '../src/lib/newsdesk.ts';
import { diffSnapshots, parseSnapshot } from '../src/lib/visit.ts';
import { GLOSSARY, metricId, searchGlossary } from '../src/lib/glossary.ts';
import { groupStories, matchCompanies, shortName } from '../src/lib/news.ts';
import { MIN_ENTRIES, journalHref, makeEntry, mergeJournal, outcome, parseJournal, serializeJournal, summarise } from '../src/lib/journal.ts';
import { MIN_LIVE_CLOSED, scoreboard } from '../src/lib/scoreboard.ts';
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

test('visit: no earlier snapshot claims nothing; the same data date is not a change', () => {
  const cur = { asOf: '2026-10-12', score: 40, up: 10, down: 20, signals: ['A·Rank'] };
  assert.equal(diffSnapshots(null, cur).kind, 'start');
  assert.equal(diffSnapshots({ ...cur }, cur).kind, 'same');
});
test('visit: a later date lists real differences only', () => {
  const prev = { asOf: '2026-10-09', score: 40.2, up: 10, down: 20, signals: ['A·Rank', 'B·Rank'] };
  const d = diffSnapshots(prev, { asOf: '2026-10-12', score: 44, up: 15, down: 12, signals: ['B·Rank', 'C·Rank'] });
  assert.equal(d.kind, 'changes');
  if (d.kind === 'changes') {
    assert.equal(d.since, '2026-10-09');
    assert.ok(d.lines.some((l) => l.includes('40 → 44')) && d.lines.some((l) => l.includes('New engine signals: C·Rank')) && d.lines.some((l) => l.includes('No longer active: A·Rank')));
  }
});
test('visit: a corrupt stored snapshot is ignored, not trusted', () => {
  assert.equal(parseSnapshot('{not json'), null);
  assert.equal(parseSnapshot(JSON.stringify({ asOf: 'yesterday' })), null);
  assert.equal(parseSnapshot(null), null);
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
test('news: a company matches by ticker or whole name, and says which; substrings do not match', () => {
  const cos = [{ sym: 'TCS', name: 'Tata Consultancy Services Ltd.' }, { sym: 'IT', name: 'Gartner IT' }, { sym: 'LCL', name: 'Lloyds Construction Ltd' }];
  assert.equal(shortName('Tata Consultancy Services Ltd.'), 'Tata Consultancy Services');
  assert.deepEqual(matchCompanies('TCS wins a large deal', cos).map((m) => m.sym), ['TCS']);
  assert.deepEqual(matchCompanies('Tata Consultancy Services posts results', cos).map((m) => m.basis), ['name “Tata Consultancy Services” in the text']);
  assert.deepEqual(matchCompanies('The IT sector rallied; ITC and LCLX rose', cos), []);   // short tickers and substrings never match
  assert.deepEqual(matchCompanies('tcs lowercase mention', cos), []);                    // a ticker must be written as one
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

const eng = (id: number, key: string, exp: number | null) => ({ id, key, name: key.toUpperCase(), trading_status: 'POSITIVE, NOT SIGNIFICANT', trades: { holdout: { n: 1000, win_rate: 55, expectancy_r: exp }, all: {}, development: {} } });
const sig = (engine: string, status: string, i: number) => ({ id: `${engine}${i}`, engine, status });
const feedFor = (live: Record<string, { closed: number; win_rate: number; avg_r: number; total_r: number }>, signals: { engine: string; status: string; id: string }[]) =>
  ({ engines: { c: eng(3, 'c', 0.25), a: eng(1, 'a', 0.1), b: eng(2, 'b', 0.2) }, signals, live_record: live }) as unknown as Parameters<typeof scoreboard>[0];

test('scoreboard: with no closed live trades the live side is progress, never a result', () => {
  const rows = scoreboard(feedFor({}, [sig('a', 'pending', 1), sig('a', 'pending', 2), sig('a', 'pending', 3), sig('a', 'open', 4), sig('b', 'pending', 5)]));
  assert.deepEqual(rows.map((r) => r.key), ['a', 'b', 'c']);                       // ordered by engine id, not by object key order
  const a = rows[0];
  assert.deepEqual([a.issued, a.pending, a.open, a.closed, a.state, a.progress, a.gapR, a.liveAvgR], [4, 3, 1, 0, 'none', 0, null, null]);
  assert.equal(rows[2].issued, 0);
});
test('scoreboard: a gap to the backtest appears only once 30 live trades have closed', () => {
  assert.equal(MIN_LIVE_CLOSED, 30);
  const live = { a: { closed: 12, win_rate: 50, avg_r: 0.1, total_r: 1.2 }, b: { closed: 29, win_rate: 52, avg_r: 0.3, total_r: 8.7 }, c: { closed: 30, win_rate: 48, avg_r: 0.05, total_r: 1.5 } };
  const [a, b, c] = scoreboard(feedFor(live, []));
  assert.equal(a.state, 'building'); assert.equal(a.progress, 0.4); assert.equal(a.gapR, null); assert.equal(a.liveAvgR, 0.1);
  assert.equal(b.state, 'building'); assert.equal(b.gapR, null);                   // 29 is still too few
  assert.equal(c.state, 'comparable'); assert.equal(c.progress, 1);
  assert.ok(c.gapR !== null && Math.abs(c.gapR - (0.05 - 0.25)) < 1e-9);           // live 0.05R against backtest 0.25R: 0.20R below
});
test('scoreboard: bad numbers are dropped, not shown', () => {
  const f = feedFor({ a: { closed: 40, win_rate: 50, avg_r: Number.NaN, total_r: 0 } }, []);
  (f.engines as unknown as Record<string, { trades: { holdout: { expectancy_r: number | null } } }>).a.trades.holdout.expectancy_r = null;
  const a = scoreboard(f)[0];
  assert.equal(a.state, 'comparable'); assert.equal(a.liveAvgR, null); assert.equal(a.holdoutExpR, null); assert.equal(a.gapR, null);
});
test('scoreboard: on the real engines feed, whatever its date, every engine has a row and the states follow the rules', () => {
  const feed = JSON.parse(readFileSync(new URL('../public/engines.json', import.meta.url), 'utf8'));
  const rows = scoreboard(feed);
  assert.equal(rows.length, Object.keys(feed.engines).length);
  assert.equal(rows.reduce((n, r) => n + r.issued, 0), feed.signals.length);                  // every signal belongs to exactly one engine row
  for (const r of rows) {
    assert.equal(r.closed, feed.live_record[r.key]?.closed ?? feed.signals.filter((x: { engine: string; status: string }) => x.engine === r.key && x.status === 'closed').length);
    assert.equal(r.state, r.closed === 0 ? 'none' : r.closed < MIN_LIVE_CLOSED ? 'building' : 'comparable');
    assert.ok(r.progress >= 0 && r.progress <= 1);
    assert.ok(r.holdoutN !== null && r.holdoutExpR !== null);                                 // the backtest side is always present
    assert.ok(r.state === 'comparable' || r.gapR === null);                                   // no gap before 30 closed trades
  }
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
