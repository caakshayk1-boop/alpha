// Run with: node --test tests/   (Node 22.6+ strips the types itself)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breadth200 } from '../src/lib/breadth.ts';
import { buildCard, cardDelta, normaliseCard, parseImport, serializeCard, serializeLibrary, CARD_VERSION } from '../src/lib/card.ts';
import { describe as describeStatus, expectedSession, ordinal, plural, rankPhrase, reconcile, sessionsBetween } from '../src/lib/status.ts';
import { plainText } from '../src/lib/format.ts';
import { diffSnapshots, parseSnapshot } from '../src/lib/visit.ts';
import { GLOSSARY, metricId, searchGlossary } from '../src/lib/glossary.ts';
import { groupStories, matchCompanies, shortName } from '../src/lib/news.ts';
import { MIN_ENTRIES, journalHref, makeEntry, mergeJournal, outcome, parseJournal, serializeJournal, summarise } from '../src/lib/journal.ts';
import { MIN_LIVE_CLOSED, scoreboard } from '../src/lib/scoreboard.ts';
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
