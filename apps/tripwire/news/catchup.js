// Catch-up: what the Worker may do when the PUBLISHED news snapshot is late and the market is open.
//
// GitHub's cron is best effort (docs/tripwire/launch/RELIABILITY.md). When the last successful scheduled check is older than twice its cadence, at any hour, the Worker may run the MARKET-SCOPE
// part of the same pipeline once, cache it at the edge for one cadence, and hand the browser the result under its own schema and its own label ("refreshed on demand").
// It never touches, replaces or re-dates the published snapshot: the snapshot's checkedAt / lastSuccessfulAt stay what the scheduled job wrote, and the page keeps saying the
// scheduled check is late. Nothing here is a model, nothing is invented: the same gates, the same entity rules (the names come from the snapshot), the same feeds.
//
// Pure apart from the injected `fetchImpl`: no clock, no cache, no network of its own.
import { FEEDS, MARKET_QUERIES } from './config.js';
import { GLOBAL_QUERIES } from './cues.js';
import { buildRegistry } from './entities.js';
import { parseFeed } from './feed.js';
import { compactEvent, runPipeline } from './pipeline.js';
import { cadenceMin } from './schedule.js';
import { ALIASES } from './aliases.js';

export const CATCHUP_SCHEMA = 'tripwire-news-ondemand/1';
/** A catch-up is not worth running unless the published check is older than this many cadences. Same factor as the page's own "delayed" rule, without its grace. */
export const CATCHUP_AFTER_CADENCES = 2;

/** Whether the Worker should run a catch-up now. `status` is the published status document, or null when none has been published yet.
 *  News does not stop at the closing bell (RBI and SEBI release at any hour, and a filing can land overnight), so this runs at any hour, not only while the NSE session is on: late means older than two
 *  cadences of the moment, which is 30 minutes in session and 60 outside it (news/schedule.js). It is the same rule the page uses to say "late", so the two cannot disagree. */
export function catchupDecision({ status, nowMs }) {
  const allowedMin = CATCHUP_AFTER_CADENCES * cadenceMin(nowMs);
  const good = status?.lastSuccessfulAt ? Date.parse(status.lastSuccessfulAt) : NaN;
  if (!Number.isFinite(good)) return { run: true, reason: 'no scheduled check has succeeded yet', ageMin: null, allowedMin };
  if (good > nowMs + 10 * 60000) return { run: false, reason: 'the published check time is in the future and is not trusted', ageMin: null, allowedMin };
  const ageMin = Math.max(0, Math.round((nowMs - good) / 60000));
  return ageMin > allowedMin ? { run: true, reason: `the last scheduled check was ${ageMin} minutes ago; the schedule allows ${allowedMin}`, ageMin, allowedMin } : { run: false, reason: 'the published check is on schedule', ageMin, allowedMin };
}

/** The entities the published snapshot already covers, as registry rows: its own `names` map, with the aliases the job uses. Nothing is looked up that the job did not know. */
export const entitiesFromSnapshot = (snap) => Object.entries(snap?.names ?? {}).map(([sym, name]) => ({ sym, name, aliases: ALIASES[sym] ?? [] }));

/** Run the market scope: the two official feeds and the market searches, Bing for any search Google would not answer. Returns the on-demand document. */
export async function runCatchup({ fetchImpl, nowMs, status = null, snapshot = null, decision = null }) {
  const registry = buildRegistry(entitiesFromSnapshot(snapshot)); const fetchedAt = new Date(nowMs).toISOString();
  const steps = [{ feed: FEEDS.rbi, url: FEEDS.rbi.url() }, { feed: FEEDS.sebi, url: FEEDS.sebi.url() }, ...MARKET_QUERIES.map((q) => ({ feed: FEEDS.google, url: FEEDS.google.url(q), q })),
    ...GLOBAL_QUERIES.slice(0, 2).map((q) => ({ feed: FEEDS.google, url: FEEDS.google.url(q), q, scope: 'global' }))];   // 12 Nov 2026: two global-cue searches ride along (same rules, same lane)
  const tried = []; const batches = [];
  const get = async (feed, url) => {
    try { const r = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/rss+xml,text/xml' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) { tried.push(`${feed.id} ${r.status}`); return null; } return await r.text(); } catch { tried.push(`${feed.id} failed`); return null; }
  };
  const out = await Promise.all(steps.map(async (s) => ({ s, text: await get(s.feed, s.url) })));
  for (const { s, text } of out) {
    let t = text, feed = s.feed;
    if (t == null && s.q) { feed = FEEDS.bing; t = await get(feed, feed.url(s.q)); }
    if (t != null) batches.push({ feed, rawItems: parseFeed(t), fetchedAt, scope: s.scope });
  }
  if (!batches.length) return { ok: false, error: `the news sources did not answer (${tried.join(', ') || 'none tried'})` };
  const p = runPipeline({ batches, registry, nowMs, paperSyms: snapshot?.scopes?.paper ?? [], full: false, limit: 30 });
  return { ok: true, schema: CATCHUP_SCHEMA, onDemand: true, refreshedAt: fetchedAt, scope: 'market', status: tried.length ? 'partial' : 'ok',
    reason: decision?.reason ?? null, publishedSnapshot: { snapshotVersion: status?.snapshotVersion ?? null, lastSuccessfulAt: status?.lastSuccessfulAt ?? null, checkedAt: status?.checkedAt ?? null },
    answered: batches.length, asked: steps.length, events: p.events.map(compactEvent), rejections: p.rejections, counts: p.counts, rankingVersion: p.rankingVersion, pipelineVersion: p.pipelineVersion };
}
