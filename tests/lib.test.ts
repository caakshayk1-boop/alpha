// Run with: node --test tests/   (Node 22.6+ strips the types itself)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breadth200 } from '../src/lib/breadth.ts';
import { buildCard, cardDelta, normaliseCard, parseImport, serializeCard, serializeLibrary, CARD_VERSION } from '../src/lib/card.ts';
import { ordinal, plural, rankPhrase, reconcile, sessionsBetween } from '../src/lib/status.ts';
import { plainText } from '../src/lib/format.ts';
import { diffSnapshots, parseSnapshot } from '../src/lib/visit.ts';
import { GLOSSARY, metricId, searchGlossary } from '../src/lib/glossary.ts';
import { groupStories, matchCompanies, shortName } from '../src/lib/news.ts';

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
