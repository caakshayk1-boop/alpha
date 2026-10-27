// Browser-test mocks for the news endpoints: /api/news/version, /api/news (snapshot) and /api/news?q= (live query for one name). Shapes are the Worker's, written by hand and pinned by the unit tests.
// Times are relative to now so the page's windows (72 h, 48 h) hold whenever the test runs. `ctl` lets a test change what the endpoints answer while the page is open.
const iso = (ms) => new Date(ms).toISOString();
const H = 3600e3; let uid = 0;
const ev = (id, o) => ({ eventClusterId: id, headline: 'x', eventType: 'Results', significance: 0.75, entities: [], scopes: ['company'], publishedAt: null, updatedAt: null, firstSeenAt: null, fetchedAt: null, sourceId: 'mint', sourceTitle: 'Mint', sourceTier: 'major', sourceWeight: 0.8, canonicalUrl: `https://www.livemint.com/${id}`, sourceTimezone: 'UTC', moreSources: 0, sources: [], summary: null, qualityFlags: [], todayEligible: true, relevanceScore: 70, rankingVersion: 'news-rank-1', rank: { reason: 'Results (significance 0.75); TCS matched on name (0.95); Mint (major); published 2 h before this was ranked', factors: [{ k: 'significance', value: 0.75, weight: 0.3, points: 22.5 }, { k: 'entity', value: 0.95, weight: 0.2, points: 19 }, { k: 'source', value: 0.8, weight: 0.15, points: 12 }, { k: 'recency', value: 0.96, weight: 0.2, points: 19.2 }, { k: 'novelty', value: 0.7, weight: 0.05, points: 3.5 }, { k: 'user', value: 0, weight: 0.1, points: 0 }] }, ...o });
const ent = (sym, name) => [{ sym, name, confidence: 0.95, matchedOn: 'name' }];
const srcs = (list, now, ageH) => list.map(([t, tier], i) => ({ sourceId: t.toLowerCase().replace(/\W+/g, '-'), sourceTitle: t, tier, canonicalUrl: `https://example.com/${t.replace(/\W+/g, '')}/${++uid}`, publishedAt: iso(now - (ageH - i * 0.2) * H) }));

export function makeEvents(now) {
  const t = (h) => iso(now - h * H);
  return [
    ev('ev_tcs_q2', { headline: 'TCS Q2 net profit rises 5% to ₹12,300 crore', eventType: 'Results', entities: ent('TCS', 'Tata Consultancy Services Ltd.'), publishedAt: t(2), updatedAt: t(1.4), firstSeenAt: t(1.9), moreSources: 2, sourceTitle: 'Reuters', sourceTier: 'wire', sources: srcs([['Reuters', 'wire'], ['Mint', 'major'], ['The Economic Times', 'major']], now, 2), relevanceScore: 80 }),
    ev('ev_rbi', { headline: 'RBI keeps repo rate unchanged at 5.50%, signals pause', eventType: 'Policy', significance: 0.85, scopes: ['market'], entities: [], publishedAt: t(5), updatedAt: t(5), firstSeenAt: t(4.9), sourceTitle: 'Reserve Bank of India', sourceTier: 'official', sourceWeight: 1, canonicalUrl: 'https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=61234', summary: { text: 'The Monetary Policy Committee decided unanimously to keep the policy repo rate unchanged at 5.50 per cent and to maintain the neutral stance.', provenance: { kind: 'feed-description', feedId: 'rbi-press', retrievedAt: t(4.9), note: 'the publisher\'s own description' } }, sources: srcs([['Reserve Bank of India', 'official']], now, 5), relevanceScore: 76 }),
    ev('ev_infy_deal', { headline: 'Infosys to acquire German engineering firm for €400 million', eventType: 'Deal', significance: 0.8, entities: ent('INFY', 'Infosys Ltd.'), publishedAt: t(3), updatedAt: t(3), firstSeenAt: t(2.9), sourceTitle: 'The Economic Times', sources: srcs([['The Economic Times', 'major']], now, 3), relevanceScore: 74 }),
    ev('ev_gcsl', { headline: 'SEBI bars Gretex Corporate Services promoters over disclosure lapses', eventType: 'Regulator', significance: 0.9, entities: ent('GCSL', 'Gretex Corporate Services Ltd.'), publishedAt: t(8), updatedAt: t(8), firstSeenAt: t(7.9), sourceTitle: 'Business Standard', sources: srcs([['Business Standard', 'major']], now, 8), relevanceScore: 72 }),
    ev('ev_cpi', { headline: 'India retail inflation eases to 4.2% in September, below estimates', eventType: 'Macro', significance: 0.6, scopes: ['market'], entities: [], publishedAt: t(20), updatedAt: t(20), firstSeenAt: t(19.9), sourceTitle: 'Mint', sources: srcs([['Mint', 'major']], now, 20), relevanceScore: 60 }),
    ev('ev_old_buyback', { headline: 'TCS board approves buyback of ₹15,000 crore', eventType: 'Deal', significance: 0.8, entities: ent('TCS', 'Tata Consultancy Services Ltd.'), publishedAt: t(24 * 5), updatedAt: t(24 * 5), firstSeenAt: t(1), sourceTitle: 'The Economic Times', sources: srcs([['The Economic Times', 'major']], now, 120), relevanceScore: 30 }),
    ev('ev_pune', { headline: 'TCS opens new delivery centre in Pune with 5,000 seats', eventType: 'Update', significance: 0.1, entities: ent('TCS', 'Tata Consultancy Services Ltd.'), publishedAt: null, updatedAt: null, firstSeenAt: t(1), sourceTitle: 'Business Standard', qualityFlags: ['date_unknown', 'no_event_keyword'], todayEligible: false, sources: [{ sourceId: 'business-standard', sourceTitle: 'Business Standard', tier: 'major', canonicalUrl: 'https://www.business-standard.com/pune', publishedAt: null }], relevanceScore: 10 }),
  ];
}
export function makeSnapshot(now, o = {}) {
  const events = o.events ?? makeEvents(now);
  return { ok: true, schema: 'tripwire-news/1', snapshotVersion: o.version ?? 5, pipelineVersion: 'news-pipe-1', rankingVersion: 'news-rank-1', scheduledAt: iso(now - 12 * 60e3), startedAt: iso(now - 12 * 60e3), completedAt: iso(now - 11.5 * 60e3), checkedAt: iso(o.checkedMs ?? now - 11.5 * 60e3), lastSuccessfulAt: iso(o.goodMs ?? now - 11.5 * 60e3), nextScheduledAt: iso(now + 3 * 60e3), cadenceMin: 15,
    status: o.status ?? 'ok', lastError: null, sources: [{ id: 'google-news', label: 'Google News (RSS search)', status: 'ok', queries: 20, ok: 20, failed: 0 }, { id: 'rbi-press', label: 'RBI press releases (RSS)', status: 'ok', queries: 1, ok: 1, failed: 0 }, { id: 'sebi-releases', label: 'SEBI press releases and orders (RSS)', status: o.status === 'partial' ? 'failed' : 'ok', queries: 1, ok: o.status === 'partial' ? 0 : 1, failed: o.status === 'partial' ? 1 : 0, error: o.status === 'partial' ? 'HTTP 503' : null }],
    coverage: { feeds: 22, answered: 21, failed: 1, unresolvedNames: [] }, rejections: { quote_page: 3, landing_page: 2, stocks_to_watch: 4, market_recap: 5, technical_commentary: 2, no_entity: 11 }, scopes: { market: 'India-wide events with no single company', paper: ['TCS'], covered: ['TCS', 'INFY'] }, names: { TCS: 'Tata Consultancy Services Ltd.', INFY: 'Infosys Ltd.' }, events };
}
export const statusOf = (s) => ({ ok: true, schema: 'tripwire-news-status/1', snapshotVersion: s.snapshotVersion, status: s.status, checkedAt: s.checkedAt, lastSuccessfulAt: s.lastSuccessfulAt, nextScheduledAt: s.nextScheduledAt, cadenceMin: s.cadenceMin, sourcesTotal: 3, sourcesFailed: s.status === 'partial' ? 1 : 0, lastError: s.lastError, eventCount: s.events.length });

/** Install the three news routes (and /api/health) on a Playwright context. Returns a controller: `ctl.snapshot` (replace it to publish a new one), `ctl.versionFails`, `ctl.calls`. */
export async function mockNews(ctx, opts = {}) {
  const ctl = { now: Date.now(), snapshot: null, status: null, versionFails: false, snapshotFails: false, calls: { version: 0, snapshot: 0, query: [] }, queryEvents: null };
  ctl.publish = (o = {}) => { ctl.snapshot = makeSnapshot(Date.now(), o); ctl.status = statusOf(ctl.snapshot); return ctl.snapshot; };
  ctl.publish(opts.snapshot ?? {});
  const json = (r, body, status = 200, headers = {}) => r.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
  await ctx.route(/\/api\/news\/version/, (r) => { ctl.calls.version++; if (ctl.versionFails) return json(r, { ok: false, error: 'down' }, 503, { 'retry-after': '1' }); return json(r, ctl.status); });
  await ctx.route(/\/api\/news\?/, (r) => {
    const u = new URL(r.request().url()); const q = u.searchParams.get('q');
    if (!q) { ctl.calls.snapshot++; if (ctl.snapshotFails) return json(r, { ok: false, reason: 'upstream', error: 'could not be read' }); return json(r, ctl.snapshot); }
    ctl.calls.query.push(q); const now = Date.now();
    const mine = ctl.queryEvents ?? (/Gretex|GCSL/i.test(q) ? makeEvents(now).filter((e) => e.eventClusterId === 'ev_gcsl') : []);
    return json(r, { ok: true, schema: 'tripwire-news-q/1', checkedAt: iso(now), q, sym: u.searchParams.get('sym'), via: 'google-news', status: 'ok', events: mine, rejections: {}, counts: {}, rankingVersion: 'news-rank-1', pipelineVersion: 'news-pipe-1' });
  });
  await ctx.route(/\/api\/news$/, (r) => { ctl.calls.snapshot++; return json(r, ctl.snapshot); });
  const t = new Date().toISOString();
  await ctx.route('**/api/health*', (r) => json(r, { ok: true, checked_at: t, prices: { ok: true, ms: 200, last_print: t, age_sec: 30, error: null }, news: { ok: !opts.health503, ms: 120, error: opts.health503 ? 'HTTP 503' : null }, bindings: ['ASSETS'], secrets_configured: 0 }));
  return ctl;
}
