// @ts-nocheck  (the pipeline under test is untyped JavaScript, see src/newsjs.d.ts; the assertions are the contract)
// The news pipeline: URLs, feeds, entity matching, rejection of landing pages and noise, clustering, ranking, diversity, summaries.
// Fixtures are written by hand in the shape the feeds use (tests/fixtures/news/ok): they are NOT captures of the live services.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalUrl, safeExternalUrl, urlKind, hash } from '../news/urls.js';
import { parseFeed, parseDate, decode } from '../news/feed.js';
import { buildRegistry, matchEntities, nameKeys } from '../news/entities.js';
import { judge, isInternational } from '../news/rules.js';
import { classify } from '../news/events.js';
import { sameEvent, tokens, clusterItems } from '../news/cluster.js';
import { diversify, rankEvents, rankFactors, rankScore, userRelevance, isMajor } from '../news/rank.js';
import { runPipeline, usableSummary } from '../news/pipeline.js';
import { FEEDS, WEIGHTS, RANKING_VERSION, sourceTier } from '../news/config.js';

const NOW = Date.parse('2026-10-27T06:00:00Z');
const fx = (f: string) => readFileSync(new URL(`./fixtures/news/ok/${f}`, import.meta.url), 'utf8');
const REG = buildRegistry([
  { sym: 'TCS', name: 'Tata Consultancy Services Ltd.', aliases: ['TCS'] }, { sym: 'INFY', name: 'Infosys Ltd.' }, { sym: 'SAIL', name: 'Steel Authority of India Ltd.' },
  { sym: 'PAGEIND', name: 'Page Industries Ltd.' }, { sym: 'IDEA', name: 'Vodafone Idea Ltd.', aliases: ['Vodafone Idea'] }, { sym: 'APOLLO', name: 'Apollo Micro Systems Ltd.' },
  { sym: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise Ltd.', aliases: ['Apollo Hospitals'] }, { sym: 'BSE', name: 'BSE Ltd.', aliases: ['BSE Ltd'] }, { sym: 'CASTROLIND', name: 'Castrol India Ltd.' },
  { sym: 'TMCV', name: 'Tata Motors Ltd.', aliases: ['Tata Motors'] }, { sym: 'TATASTEEL', name: 'Tata Steel Ltd.', aliases: ['Tata Steel'] }, { sym: 'ETERNAL', name: 'Eternal Ltd.', aliases: ['Zomato'] }, { sym: 'HINDALCO', name: 'Hindalco Industries Ltd.' },
]);
const syms = (h: string) => matchEntities(h, REG).map((m) => m.sym);

test('urls: canonical form drops trackers, www/m/amp, fragments, trailing slashes; http reads as https; google redirects keep their path', () => {
  assert.equal(canonicalUrl('http://www.livemint.com/companies/x-1.html/?utm_source=a&fbclid=b&id=2&a=1#top'), 'https://livemint.com/companies/x-1.html?a=1&id=2');
  assert.equal(canonicalUrl('https://m.economictimes.indiatimes.com/news/a/amp'), 'https://economictimes.indiatimes.com/news/a');
  assert.equal(canonicalUrl('https://news.google.com/rss/articles/CBMi123?oc=5'), 'https://news.google.com/rss/articles/CBMi123');
  assert.equal(canonicalUrl('https://example.com/a?b=2&a=1'), canonicalUrl('https://www.example.com/a/?a=1&b=2&utm_campaign=z'));
  assert.equal(canonicalUrl('javascript:alert(1)'), null); assert.equal(hash('a'), hash('a')); assert.notEqual(hash('a'), hash('b'));
});
test('urls: only http(s) links without credentials or control characters are ever linkable', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,<b>', 'ftp://x.com/a', 'https://user:pw@x.com/a', 'https://x.com/a b', 'https://localhost/a', 'https://10.0.0.1/a', '//x.com/a', 'https://x.com/"onmouseover=1', '', null, undefined, 42]) assert.equal(safeExternalUrl(bad as string), null, String(bad));
  assert.equal(safeExternalUrl('https://www.livemint.com/a?b=1'), 'https://www.livemint.com/a?b=1');
});
test('urls: quote and landing pages are told apart from articles and from dated filings', () => {
  assert.equal(urlKind('https://univest.in/stocks/tcs-share-price').kind, 'quote');
  assert.equal(urlKind('https://www.moneycontrol.com/india/stockpricequote/computers-software/tataconsultancyservices/TCS').kind, 'quote');
  assert.equal(urlKind('https://www.google.com/finance/quote/TCS:NSE').kind, 'quote');
  assert.equal(urlKind('https://www.nseindia.com/companies-listing/corporate-filings-announcements?symbol=TCS').kind, 'landing');
  assert.equal(urlKind('https://www.bseindia.com/corporates/ann.html?scrip=532540').kind, 'landing');
  assert.equal(urlKind('https://www.livemint.com/').kind, 'landing');
  assert.equal(urlKind('https://nsearchives.nseindia.com/corporate/TCS_27102026_BoardOutcome.pdf').kind, 'filing');
  assert.equal(urlKind('https://www.bseindia.com/xml-data/corpfiling/AttachLive/ab12-cd34.pdf').kind, 'filing');
  assert.equal(urlKind('https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=61234').kind, 'filing');
  assert.equal(urlKind('https://www.business-standard.com/companies/tcs-pune-centre-2').kind, 'article');
});

test('feeds: RSS and Atom parse; Bing click links are unwrapped; the " - Publisher" suffix is removed; entities decode once', () => {
  const r = parseFeed(fx('google-tcs.xml')); assert.equal(r.length, 13); assert.equal(r[0].title, 'TCS Q2 net profit rises 5% to ₹12,300 crore'); assert.equal(r[0].publisher, 'Mint');
  const bing = `<rss><channel><item><title>Raises Rs 300 Cr via NCDs</title><link>http://www.bing.com/news/apiclick.aspx?ref=Fex&amp;url=${encodeURIComponent('https://money.rediff.com/a?x=1&y=2').replace(/&/g, '&amp;')}&amp;c=1</link><pubDate>Sun, 25 Oct 2026 17:00:00 GMT</pubDate><News:Source>Rediff Money</News:Source></item></channel></rss>`;
  assert.equal(parseFeed(bing)[0].link, 'https://money.rediff.com/a?x=1&y=2'); assert.equal(parseFeed(bing)[0].publisher, 'Rediff Money');
  const atom = `<feed><entry><title>Order &amp;amp; win</title><link href="https://x.com/a"/><published>2026-10-26T10:00:00Z</published></entry></feed>`; assert.deepEqual([parseFeed(atom)[0].title, parseFeed(atom)[0].link], ['Order &amp; win', 'https://x.com/a']);
  assert.deepEqual(parseFeed(''), []); assert.deepEqual(parseFeed('<rss></rss>'), []); assert.equal(decode('&#8377;5 &amp;lt;'), '₹5 &lt;');
});
test('dates: explicit offsets are honoured; a date with no zone is read in the feed\'s zone and marked assumed; unreadable and missing are null, never "now"', () => {
  assert.deepEqual(parseDate('Tue, 27 Oct 2026 10:50:00 +0530'), { sec: Date.UTC(2026, 9, 27, 5, 20) / 1000, assumed: false });
  assert.equal(parseDate('Tue, 27 Oct 2026 04:00:00 GMT')?.sec, Date.UTC(2026, 9, 27, 4) / 1000);
  assert.equal(parseDate('Tue, 27 Oct 2026 10:50:00 IST')?.sec, Date.UTC(2026, 9, 27, 5, 20) / 1000);
  assert.deepEqual(parseDate('2026-10-27 10:50', 'Asia/Kolkata'), { sec: Date.UTC(2026, 9, 27, 5, 20) / 1000, assumed: true });
  assert.deepEqual(parseDate('2026-10-27T10:50:00', 'UTC'), { sec: Date.UTC(2026, 9, 27, 10, 50) / 1000, assumed: true });
  for (const bad of ['', 'yesterday', 'N/A', null, undefined, '0000-00-00', '1970-01-01T00:00:00Z']) assert.equal(parseDate(bad as string), null, String(bad));
});

test('entities: names, aliases and symbols match whole words only; common words and tickers do not match inside other words', () => {
  assert.deepEqual(syms('Tata Consultancy Services Q2 profit up 5%'), ['TCS']); assert.deepEqual(syms('TCS wins deal with European bank'), ['TCS']);
  assert.deepEqual(syms('Infosys shares rise after Q2 results'), ['INFY']);
  assert.deepEqual(syms('Tata Motors and Tata Steel report results'), ['TMCV', 'TATASTEEL'].sort((a, b) => (syms('Tata Motors and Tata Steel report results').indexOf(a) - syms('Tata Motors and Tata Steel report results').indexOf(b))));
  assert.deepEqual(syms('Tata Steel Q2 loss narrows'), ['TATASTEEL']);
  assert.deepEqual(syms('Tata group chairman meets ministers'), [], 'a group name alone is nobody');
  assert.deepEqual(syms('Castrol India Q3 profit rises'), ['CASTROLIND']); assert.deepEqual(syms('Castrol shares fall after Q3'), ['CASTROLIND'], 'a distinctive single word with a corporate cue');
  assert.deepEqual(syms('Castrol is a brand of motor oil'), [], 'the same word without a corporate cue is not enough');
});
test('entities: name collisions - SAIL, PAGE, IDEA, APOLLO, BSE, ETERNAL, TITAN-like words do not match as ordinary words', () => {
  assert.deepEqual(syms('Ships set sail from Mumbai port as monsoon ends'), []);
  assert.deepEqual(syms('SAIL shares jump after Q2 results'), [], 'a symbol that is also a word needs an exchange marker');
  assert.deepEqual(syms('SAIL (NSE) shares jump after Q2 results'), ['SAIL']); assert.deepEqual(syms('Shares of NSE: SAIL surge on order win'), ['SAIL']);
  assert.deepEqual(syms('Steel Authority of India Q2 loss narrows'), ['SAIL']);
  assert.deepEqual(syms('Front page news: new idea for tax reform'), []); assert.deepEqual(syms('Page Industries Q2 profit rises 9%'), ['PAGEIND']);
  assert.deepEqual(syms('Vodafone Idea AGR relief: shares jump'), ['IDEA']); assert.deepEqual(syms('Big idea shares rally on Q2'), []);
  assert.deepEqual(syms('Apollo Hospitals Q2 profit rises'), ['APOLLOHOSP'], 'Apollo Hospitals is not Apollo Micro Systems');
  assert.deepEqual(syms('Apollo Micro Systems wins defence order'), ['APOLLO']); assert.deepEqual(syms('Apollo moon mission anniversary: shares of space firms'), []);
  assert.deepEqual(syms('BSE shares jump as SEBI eases F&O norms'), [], 'BSE alone is the exchange, not the company'); assert.deepEqual(syms('BSE Ltd Q2 profit doubles'), ['BSE']);
  assert.deepEqual(syms('Eternal optimism lifts the markets this week'), [], 'a one-word name that is an ordinary word'); assert.deepEqual(syms('Zomato parent Eternal Q2 profit up'), ['ETERNAL']);
  assert.deepEqual(syms('INFYNITY GROUP wins order'), [], 'no substring match'); assert.deepEqual(syms('Mastcs rally'), []);
  assert.deepEqual(syms('TCS WIPRO IN FOCUS TODAY ON RESULTS'), [], 'a headline in capitals gives no symbol or abbreviation match');
});
test('entities: the registry gives a legal name its short forms, keeps "BSE Ltd" whole, and never offers a three-letter bare name', () => {
  assert.deepEqual(nameKeys('BSE Ltd.').map((k) => k.text), ['bse ltd']);
  assert.ok(nameKeys('Castrol India Ltd.').some((k) => k.text === 'castrol' && k.conf === 0.75)); assert.ok(nameKeys('Hindalco Industries Ltd.').some((k) => k.text === 'hindalco'));
  assert.ok(!nameKeys('Reliance Industries Ltd.').some((k) => k.text === 'reliance'), 'generic single words are not offered'); assert.ok(!nameKeys('Tata Consultancy Services Ltd.').some((k) => k.text === 'tata'));
  const m = matchEntities('Tata Consultancy Services Q2 profit', REG)[0]; assert.equal(m.confidence, 0.95); assert.equal(m.matchedOn, 'name');
});

test('rules: share-price pages, announcements index pages, quote pages, technical commentary, stocks to watch, previews, mixed language and unrelated international items are rejected; a dated filing is accepted', () => {
  const j = (title: string, url: string, sec: number | null = NOW / 1000 - 3600) => judge({ title, url, publishedSec: sec, nowMs: NOW, filing: urlKind(url).kind === 'filing' }).reasons[0] ?? 'ok';
  assert.equal(j('TCS Share Price Today Live: Tata Consultancy Services Stock Price NSE', 'https://univest.in/stocks/tcs-share-price'), 'quote_page');
  assert.equal(j('Tata Consultancy Services Share Price Today', 'https://www.example.com/tcs'), 'evergreen_title');
  assert.equal(j('Announcements | Tata Consultancy Services', 'https://www.nseindia.com/companies-listing/corporate-filings-announcements?symbol=TCS'), 'landing_page');
  assert.equal(j('Corporate Announcements - Infosys Ltd', 'https://www.example.com/news/infosys'), 'evergreen_title');
  assert.equal(j('TCS technical view: support at 4,100, resistance 4,250', 'https://x.com/a/1'), 'technical_commentary'); assert.equal(j('Hindalco RSI oversold, buy or sell?', 'https://x.com/a/2'), 'technical_commentary');
  assert.equal(j('Stocks to watch today: TCS, Infosys, Reliance', 'https://x.com/a/3'), 'stocks_to_watch'); assert.equal(j('5 stocks to buy this week', 'https://x.com/a/4'), 'stocks_to_watch');
  assert.equal(j('Gift Nifty today: Sensex, Nifty likely to open flat', 'https://x.com/a/5'), 'market_recap'); assert.equal(j('Sensex ends higher as banks rally', 'https://x.com/a/6'), 'market_recap'); assert.equal(j('Closing bell: Nifty slips below 22,800', 'https://x.com/a/7'), 'market_recap');
  assert.equal(j('Tata Consultancy ने मंगलवार को नतीजे जारी किए', 'https://x.com/a/8'), 'non_english'); assert.equal(j('Laurus Labs ne maari entry! Share ke All-Time High par', 'https://x.com/a/9'), 'non_english');
  assert.equal(j('This multibagger penny stock could double your money', 'https://x.com/a/10'), 'promotional');
  assert.equal(j('TCS: Outcome of Board Meeting dated 27-Oct-2026', 'https://nsearchives.nseindia.com/corporate/TCS_27102026_BoardOutcome.pdf'), 'ok', 'a dated exchange filing is accepted');
  assert.equal(j('Tata Consultancy Services Q2 net profit rises 5%', 'https://www.livemint.com/companies/tcs-q2-1.html'), 'ok');
  assert.ok(isInternational('Nasdaq hits record as chipmakers lead global tech rally')); assert.ok(!isInternational('Sensex falls as Wall Street slides, rupee weakens'));
});
test('rules: a future timestamp is quarantined, a missing date is unknown (kept, flagged), an old date is stale', () => {
  const r = (sec: number | null) => judge({ title: 'Infosys Q2 profit rises 5%', url: 'https://x.com/a/1', publishedSec: sec, nowMs: NOW, filing: false });
  assert.deepEqual(r(NOW / 1000 + 86400 * 9).reasons, ['future_timestamp']); assert.deepEqual(r(NOW / 1000 + 300).reasons, [], 'five minutes of clock skew is tolerated');
  assert.deepEqual(r(null).reasons, []); assert.deepEqual(r(null).flags, ['date_unknown']); assert.deepEqual(r(NOW / 1000 - 20 * 86400).reasons, ['stale']);
});
test('events: keyword rules give a type and a fixed significance; no sentiment words; "profit booking" is not results', () => {
  assert.equal(classify('Infosys Q2 net profit rises 5%').eventType, 'Results'); assert.equal(classify('SEBI bans firm from markets').eventType, 'Regulator'); assert.equal(classify('Adani to acquire cement firm for ₹8,000 crore').eventType, 'Deal');
  assert.equal(classify('RBI keeps repo rate unchanged').eventType, 'Policy'); assert.equal(classify('Hindalco bags order worth ₹900 crore').eventType, 'Order'); assert.equal(classify('Profit booking drags banks lower').eventType, 'Update');
  assert.equal(classify('Infosys surges').significance, classify('Infosys slumps').significance); assert.equal(classify('TCS: Outcome of Board Meeting', { filing: true }).eventType, 'Filing');
});

const cand = (headline: string, o: Record<string, unknown> = {}) => ({ headline, itemId: `it_${hash(headline)}`, tk: tokens(headline), eventType: classify(headline).eventType, publishedSec: NOW / 1000 - 3600, entities: [{ sym: 'TCS', confidence: 0.95 }], canonicalUrl: `https://x.com/${hash(headline)}`, ...o });
test('cluster: syndicated copies are one event; different developments, different figures and different companies are not', () => {
  assert.ok(sameEvent(cand('TCS Q2 net profit rises 5% to ₹12,300 crore'), cand('Tata Consultancy Services Q2 profit up 5%, beats estimates')), 'one results night');
  assert.ok(sameEvent(cand('SEBI tightens F&O margin rules; new circular effective December', { entities: [] }), cand('SEBI tightens F&O margin rules in new circular', { entities: [] })));
  assert.ok(!sameEvent(cand('TCS Q2 net profit rises 5% to ₹12,300 crore'), cand('TCS announces share buyback of ₹15,000 crore')), 'results and a buyback are two developments');
  assert.ok(!sameEvent(cand('Infosys Q2 profit up 5%'), cand('Infosys Q2 profit down 3%')), 'figures that disagree');
  assert.ok(!sameEvent(cand('TCS Q2 net profit rises 5% to ₹12,300 crore'), cand('Infosys Q2 net profit rises 5% to ₹9,000 crore', { entities: [{ sym: 'INFY', confidence: 0.95 }] })), 'a different company');
  assert.ok(!sameEvent(cand('TCS Q2 net profit rises 5%'), cand('TCS Q2 net profit rises 5%', { publishedSec: NOW / 1000 - 5 * 86400, canonicalUrl: 'https://x.com/other' })), 'five days apart is not one event');
  assert.ok(sameEvent(cand('a', { canonicalUrl: 'https://x.com/same' }), cand('totally different words here now', { canonicalUrl: 'https://x.com/same' })), 'the same page is the same event');
});
test('cluster: an event keeps its id when another outlet repeats it, and a merge keeps one id', () => {
  const a = { ...cand('TCS Q2 net profit rises 5%'), itemId: 'it_a' }, b = { ...cand('Tata Consultancy Services Q2 profit up 5%'), itemId: 'it_b' };
  const first = clusterItems([a], new Map()); const again = clusterItems([a, b], new Map([['it_a', first[0].eventClusterId]]));
  assert.equal(again.length, 1); assert.equal(again[0].eventClusterId, first[0].eventClusterId);
});

const batchOf = (xml: string, feed = FEEDS.google, fetchedAt = '2026-10-27T05:55:00.000Z') => ({ feed, rawItems: parseFeed(xml), fetchedAt });
const run = (xml: string, extra: Record<string, unknown> = {}) => runPipeline({ batches: [batchOf(xml)], registry: REG, nowMs: NOW, paperSyms: ['TCS'], ...extra });
test('pipeline: the TCS fixture keeps real events, clusters the copies, and counts every rejection by reason', () => {
  const p = run(fx('google-tcs.xml'));
  assert.deepEqual(p.rejections, { quote_page: 1, landing_page: 1, technical_commentary: 1, stocks_to_watch: 1, future_timestamp: 1, non_english: 1, international: 1 });
  const heads = p.events.map((e) => e.headline); assert.equal(p.events.length, 4, heads.join(' | '));
  const results = p.events.find((e) => e.eventType === 'Results')!; assert.equal(results.moreSources, 2, 'Mint, Reuters and The Economic Times are one event'); assert.equal(results.items!.length, 3);
  assert.equal(results.sourceTitle, 'Reuters', 'the wire is the primary source'); assert.deepEqual(results.sources.map((s) => s.sourceTitle).sort(), ['Mint', 'Reuters', 'The Economic Times']);
  assert.ok(p.events.some((e) => e.eventType === 'Deal') && p.events.some((e) => e.eventType === 'Filing'), 'a different development and a dated filing are separate events');
  const filing = p.events.find((e) => e.eventType === 'Filing')!; assert.equal(filing.sourceTier, 'official'); assert.equal(filing.publishedAt, '2026-10-27T05:20:00.000Z'); assert.ok(filing.qualityFlags.includes('exchange_filing'));
  assert.ok(p.events.every((e) => e.entities[0].sym === 'TCS' && e.entities[0].confidence >= 0.6), 'every event names a verified company');
});
test('pipeline: a missing publication time stays unknown (never "now") and keeps the event off Today; a future time is quarantined', () => {
  const p = run(fx('google-tcs.xml')); const pune = p.events.find((e) => /Pune/.test(e.headline))!;
  assert.equal(pune.publishedAt, null); assert.ok(pune.qualityFlags.includes('date_unknown')); assert.equal(pune.todayEligible, false); assert.ok(!p.events.some((e) => /European bank/.test(e.headline)));
});
test('pipeline: a re-fetched old event keeps its original date and first-seen time, and its headline-only item has no summary', () => {
  const first = run(fx('google-tcs.xml')); const prevItems = first.events.flatMap((e) => e.items ?? []);
  const later = Date.parse('2026-10-27T09:00:00Z'); const again = runPipeline({ batches: [batchOf(fx('google-tcs.xml'), FEEDS.google, '2026-10-27T09:00:00.000Z')], registry: REG, prevItems, nowMs: later, paperSyms: ['TCS'] });
  const a = first.events.find((e) => e.eventType === 'Results')!, b = again.events.find((e) => e.eventType === 'Results')!;
  assert.equal(b.publishedAt, a.publishedAt); assert.equal(b.firstSeenAt, '2026-10-27T05:55:00.000Z'); assert.equal(b.eventClusterId, a.eventClusterId); assert.equal(a.summary, null);
  assert.equal(again.events.length, first.events.length, 'seeing it again adds nothing');
});
test('summaries: only from a feed that may carry them, with provenance; a search feed\'s link list and a headline-only item get none', () => {
  const rbi = runPipeline({ batches: [batchOf(fx('rbi.xml'), FEEDS.rbi)], registry: REG, nowMs: NOW })!; const ev = rbi.events[0];
  assert.match(ev.summary!.text, /Monetary Policy Committee decided unanimously/); assert.equal(ev.summary!.provenance.kind, 'feed-description'); assert.equal(ev.summary!.provenance.feedId, 'rbi-press'); assert.equal(ev.sourceTitle, 'Reserve Bank of India'); assert.equal(ev.sourceTier, 'official');
  assert.equal(usableSummary('T', 'x'.repeat(100), FEEDS.google, 'now'), null); assert.equal(usableSummary('Same headline here is long enough', 'Same headline here is long enough', FEEDS.rbi, 'now'), null); assert.equal(usableSummary('T', 'short', FEEDS.rbi, 'now'), null);
  const long = usableSummary('T', 'word '.repeat(100), FEEDS.rbi, 'now')!; assert.ok(long.text.length <= 222 && long.text.endsWith('…'));
});
test('pipeline: no entity and no India-wide event means rejected; "wider matching" does not exist - there is no code path that admits an unverified headline', () => {
  const xml = `<rss><channel>${['Local bakery wins award for best croissant', 'Quarterly results season starts with banks', 'Foreign inflation hits 3.2% in euro area'].map((t, i) => `<item><title>${t} - Mint</title><link>https://www.livemint.com/a/${i}</link><pubDate>Tue, 27 Oct 2026 04:00:00 GMT</pubDate><source url="https://www.livemint.com">Mint</source></item>`).join('')}</channel></rss>`;
  const p = run(xml); assert.equal(p.events.length, 0); assert.equal(p.counts.rejected, 3);
});
test('rank: the weights sum to one, the score is a pure function, old events decay, and a re-fetched old event gets no novelty', () => {
  assert.ok(Math.abs(Object.values(WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const ev = (o: Record<string, unknown> = {}) => ({ eventClusterId: 'e', eventType: 'Results', significance: 0.75, entities: [{ sym: 'TCS', confidence: 0.95, matchedOn: 'name' }], scopes: ['company'], publishedAt: new Date(NOW - 3600e3).toISOString(), firstSeenAt: new Date(NOW - 1800e3).toISOString(), sourceWeight: 0.8, moreSources: 0, ...o });
  const fresh = rankFactors(ev(), NOW), old = rankFactors(ev({ publishedAt: new Date(NOW - 72 * 3600e3).toISOString() }), NOW), refetched = rankFactors(ev({ publishedAt: new Date(NOW - 72 * 3600e3).toISOString(), firstSeenAt: new Date(NOW).toISOString() }), NOW);
  assert.ok(old.recency < fresh.recency / 3); assert.ok(refetched.novelty < 0.001, 'first seen now, published three days ago: not new'); assert.equal(rankScore(fresh), rankScore(rankFactors(ev(), NOW)));
  assert.equal(rankFactors(ev({ publishedAt: null }), NOW).recency, 0, 'unknown time earns no recency');
  assert.ok(rankScore(rankFactors(ev({ moreSources: 3 }), NOW)) > rankScore(fresh), 'corroboration adds'); assert.ok(rankScore(rankFactors(ev(), NOW, 1)) > rankScore(fresh), 'a followed name adds');
  assert.equal(userRelevance(ev(), { follows: ['TCS'] }), 1); assert.equal(userRelevance(ev(), { paper: ['TCS'] }), 0.7); assert.equal(userRelevance(ev(), {}), 0);
  const a = rankEvents([ev({ eventClusterId: 'b' }), ev({ eventClusterId: 'a' })], NOW).map((e) => e.eventClusterId); assert.deepEqual(a, ['a', 'b'], 'ties break on id: the same order on every device');
  assert.equal(RANKING_VERSION, 'news-rank-1');
});
const E = (id: string, sym: string | null, score: number, o: Record<string, unknown> = {}) => ({ eventClusterId: id, entities: sym ? [{ sym, confidence: 0.95 }] : [], relevanceScore: score, significance: 0.7, moreSources: 0, sourceTier: 'major', publishedAt: new Date(NOW).toISOString(), ...o });
test('diversity: at most two events per company in the default five, a major event may take a third, market stories are not capped, and nothing pads', () => {
  const list = [E('1', 'TCS', 90), E('2', 'TCS', 89), E('3', 'TCS', 88), E('4', 'INFY', 80), E('5', null, 79), E('6', 'WIPRO', 70), E('7', 'HDFCBANK', 60)];
  assert.deepEqual(diversify(list, { max: 5 }).map((e) => e.eventClusterId), ['1', '2', '4', '5', '6'], 'TCS is capped at two; the third TCS event waits');
  const major = [E('1', 'TCS', 90), E('2', 'TCS', 89), E('3', 'TCS', 88, { significance: 0.9, sourceTier: 'official' }), E('4', 'INFY', 80), E('5', null, 79)]; assert.ok(isMajor(major[2] as never));
  assert.deepEqual(diversify(major, { max: 5 }).map((e) => e.eventClusterId), ['1', '2', '3', '4', '5'], 'a major event overrides the cap');
  assert.equal(diversify([E('1', 'TCS', 9), E('2', 'INFY', 8), E('3', null, 7)], { max: 10 }).length, 3, 'three qualify, three are shown');
  assert.deepEqual(diversify([], {}), []); assert.deepEqual(diversify(list, { first: 5, max: 10 }).map((e) => e.eventClusterId), ['1', '2', '4', '5', '6', '3', '7'], 'the extended list lets the third TCS event in after the rest');
});
test('sources: tiers are by publisher name and by host; an official host outranks a name', () => {
  assert.equal(sourceTier('Reuters', 'reuters.com').tier, 'wire'); assert.equal(sourceTier('Mint', 'livemint.com').tier, 'major'); assert.equal(sourceTier('Univest', 'univest.in').tier, 'aggregator'); assert.equal(sourceTier('NSE India', 'nsearchives.nseindia.com').tier, 'official'); assert.equal(sourceTier('Some Blog', 'blog.example.com').tier, 'unknown');
});

test('entities: real wrong matches of the first live snapshot stay wrong (ITC tax credit, SBI Life, a shared first word)', () => {
  const R = buildRegistry([
    { sym: 'ITC', name: 'ITC Ltd.', aliases: ['ITC'] }, { sym: 'SBIN', name: 'State Bank of India', aliases: ['SBI'] }, { sym: 'SBILIFE', name: 'SBI Life Insurance Company Ltd.' },
    { sym: 'BAJFINANCE', name: 'Bajaj Finance Ltd.' }, { sym: 'ICICIBANK', name: 'ICICI Bank Ltd.' }, { sym: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd.', aliases: ['Kotak Mahindra Bank'] },
    { sym: 'TORNTPHARM', name: 'Torrent Pharmaceuticals Ltd.' }, { sym: 'RELIANCE', name: 'Reliance Industries Ltd.', aliases: ['Reliance'] }, { sym: 'NYKAA', name: 'FSN E-Commerce Ventures Ltd.', aliases: ['Nykaa'] },
  ]);
  const s = (h: string) => matchEntities(h, R).map((m) => m.sym);
  // not the company
  assert.ok(!s('GSTAT Prayagraj Quashes GST Demand, Rules GSTR-3B & 2A Mismatch Alone Can\'t Justify ITC Reversal').includes('ITC'), 'ITC beside GST words is the input tax credit');
  assert.ok(!s('Capital Goods ITC Refund Over 60 Months').includes('ITC'));
  assert.ok(!s('ITC Hotels Q2 Results: Net Profit Jumps 51%').includes('ITC'), 'ITC Hotels is its own company');
  assert.ok(!s('SBI Life Insurance Q2 Net Profit Jumps 11% to Rs 549 Cr').includes('SBIN'), 'SBI Life is not the bank');
  assert.deepEqual(s('SBI Life Insurance Q2 Net Profit Jumps 11% to Rs 549 Cr'), ['SBILIFE']);
  assert.ok(!s('Bajaj Electricals Revises Q2FY27 Earnings Call Details').includes('BAJFINANCE'));
  assert.ok(!s("Here's why Kotak Neo recommends 'Buy' rating on ICICI Bank").includes('KOTAKBANK'));
  assert.ok(!s('Buy Adani Energy Solutions: target of Rs 1600: ICICI Securities').includes('ICICIBANK'));
  // still the company
  assert.ok(s('ITC Q2 profit rises 4% as cigarettes volumes recover').includes('ITC'));
  assert.ok(s('Valmet to supply BCTMP line to ITC in India').includes('ITC'));
  assert.ok(s('Latest FD interest rates: ICICI Bank, Indian Bank, SBI and HDFC Bank').includes('SBIN'));
  assert.ok(s('Reliance shares decline ahead of Jio Platforms IPO listing').includes('RELIANCE'));
  assert.ok(s('Torrent Pharma Q2 FY27: India, Brazil, US or Germany').includes('TORNTPHARM'), 'the rest of the company\'s own name may follow');
  assert.ok(s('Nykaa Q2 FY2027 Earnings Call Scheduled for November 4').includes('NYKAA'));
});
