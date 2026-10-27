// The pipeline: normalise -> validate (URL, date, entity) -> reject noise -> cluster events -> rank -> diversify -> snapshot.
// A pure function of its inputs: raw feed items, the entity registry, the previous snapshot's items and the clock the caller passes. The same inputs give the same output on the Worker, in the
// scheduled job and in the tests. It does no I/O and reads no clock.
import { FEEDS, LIMITS, PIPELINE_VERSION, RANKING_VERSION, VERIFIED, sourceTier } from './config.js';
import { classify } from './events.js';
import { clusterItems, tokens } from './cluster.js';
import { buildRegistry, matchEntities } from './entities.js';
import { parseDate } from './feed.js';
import { explain, rankEvents, reasonLine } from './rank.js';
import { hasIndia, isInternational, isMacro, judge } from './rules.js';
import { canonicalUrl, hash, hostOf, urlKind } from './urls.js';

const iso = (sec) => (sec == null ? null : new Date(sec * 1000).toISOString());
const slug = (s) => String(s || 'unknown').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'unknown';

/** A summary only from the publisher's own description in a feed that is allowed to carry one (an official release feed), with provenance. A search feed's description is a list of other outlets' links: no summary. Headline only means none. */
export function usableSummary(title, description, feed, fetchedAt) {
  if (!feed?.summary) return null;
  const d = String(description ?? '').replace(/\s+/g, ' ').trim(); if (d.length < 40) return null;
  const a = d.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), b = String(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (a === b || a.startsWith(b) && a.length < b.length + 30) return null;
  let text = d; if (text.length > 220) { text = text.slice(0, 220); const cut = text.lastIndexOf(' '); text = `${text.slice(0, cut > 120 ? cut : 220).replace(/[ ,;:.-]+$/, '')}…`; }
  return { text, provenance: { kind: 'feed-description', feedId: feed.id, retrievedAt: fetchedAt, note: 'the publisher\'s own description of its release, as the feed delivered it; truncated, not rewritten' } };
}

/** One raw item to a candidate item, or `{ rejected: code }`. `ctx` is { registry, nowMs, paperSyms }. */
export function normalise(raw, batch, ctx) {
  const url = canonicalUrl(raw.link); const feed = batch.feed; const dt = raw.dateText ? parseDate(raw.dateText, feed.tz) : null;
  const kind = url ? urlKind(url) : { kind: 'invalid' }; const filing = kind.kind === 'filing';
  const j = judge({ title: raw.title, url, publishedSec: dt?.sec ?? null, nowMs: ctx.nowMs, filing });
  if (j.reasons.length) return { rejected: j.reasons[0], reasons: j.reasons };
  const entities = matchEntities(raw.title, ctx.registry).filter((e) => e.confidence >= VERIFIED);
  const publisher = raw.publisher || (hostOf(url) || 'Unknown'); const tier = sourceTier(publisher, hostOf(raw.publisherUrl) || hostOf(url));
  const macro = isMacro(raw.title) && hasIndia(raw.title);
  if (!entities.length) {
    if (isInternational(raw.title)) return { rejected: 'international' };
    if (!hasIndia(raw.title) && !filing) return { rejected: 'no_entity' };
    if (!macro && !filing) return { rejected: 'not_event' };
  }
  const cls = classify(raw.title, { filing });
  const flags = [...j.flags]; if (dt?.assumed) flags.push('date_zone_assumed'); if (tier.tier === 'aggregator') flags.push('aggregator_source'); if (kind.kind === 'filing') flags.push('exchange_filing');
  if (!entities.length) flags.push('market_scope'); if (cls.eventType === 'Update') flags.push('no_event_keyword');
  const summary = usableSummary(raw.title, raw.description, feed, batch.fetchedAt);
  return { item: {
    itemId: `it_${hash(url)}`, canonicalUrl: url, feedId: feed.id, sourceId: slug(publisher), sourceTitle: publisher, sourceTier: tier.tier, sourceWeight: tier.weight, headline: raw.title.replace(/\s+/g, ' ').trim(),
    publishedAt: iso(dt?.sec ?? null), fetchedAt: batch.fetchedAt, updatedAt: batch.fetchedAt, firstSeenAt: batch.fetchedAt, sourceTimezone: feed.tz ?? 'UTC', entities, eventType: cls.eventType, significance: cls.significance,
    eventClusterId: null, summary, qualityFlags: flags, relevanceScore: 0, rankingVersion: RANKING_VERSION,
  } };
}

const toCandidate = (it) => ({ ...it, publishedSec: it.publishedAt ? Math.floor(Date.parse(it.publishedAt) / 1000) : null, tk: tokens(it.headline) });

/** Merge a re-seen item into what the last snapshot knew: the original publication time and first-seen time stay; `updatedAt` moves only when the headline changed. */
function carry(item, prev) {
  if (!prev) return item;
  return { ...item, publishedAt: prev.publishedAt ?? item.publishedAt, firstSeenAt: prev.firstSeenAt ?? item.firstSeenAt, updatedAt: prev.headline === item.headline ? prev.updatedAt ?? item.updatedAt : item.fetchedAt, qualityFlags: item.qualityFlags.filter((f) => f !== 'date_unknown' || !prev.publishedAt) };
}

/** The whole run. `batches`: [{ feed, rawItems, fetchedAt, query? }]. `registry`: built entities. `prevItems`: items from the last snapshot (re-judged under today's rules, aged out by them).
 *  Returns `{ events, items, rejections, counts }`; events are ranked and carry `items` (full model) when `full`. */
export function runPipeline({ batches, registry, prevItems = [], nowMs, paperSyms = [], full = true, limit = LIMITS.events }) {
  const ctx = { registry, nowMs, paperSyms }; const rejections = {}; const bump = (c) => { rejections[c] = (rejections[c] ?? 0) + 1; };
  const prevById = new Map(prevItems.map((p) => [p.itemId, p])); const byId = new Map(); let seen = 0;
  const feedOf = (id) => Object.values(FEEDS).find((f) => f.id === id) ?? FEEDS.google;
  const all = [...batches, ...(prevItems.length ? [{ feed: null, rawItems: prevItems.map((p) => ({ title: p.headline, link: p.canonicalUrl, dateText: p.publishedAt ?? '', publisher: p.sourceTitle, publisherUrl: '', description: p.summary?.text ?? '', prev: p })), fetchedAt: null }] : [])];
  for (const b of all) for (const raw of b.rawItems) {
    seen++; const isPrev = !!raw.prev; const batch = isPrev ? { feed: feedOf(raw.prev.feedId), fetchedAt: raw.prev.fetchedAt } : b;
    const r = normalise(raw, batch, ctx); if (r.rejected) { if (!isPrev || r.rejected === 'stale' || true) bump(r.rejected); continue; }
    const it = carry(r.item, isPrev ? raw.prev : prevById.get(r.item.itemId)); if (isPrev && raw.prev.summary && !it.summary) it.summary = raw.prev.summary;
    const old = byId.get(it.itemId); if (old) { if (!isPrev) bump('duplicate_url'); const keep = old.fetchedAt >= it.fetchedAt ? old : it; byId.set(it.itemId, { ...keep, firstSeenAt: old.firstSeenAt < it.firstSeenAt ? old.firstSeenAt : it.firstSeenAt, publishedAt: old.publishedAt ?? it.publishedAt, summary: old.summary ?? it.summary }); continue; }
    byId.set(it.itemId, it);
  }
  const items = [...byId.values()].map(toCandidate);
  const prevCluster = new Map(prevItems.filter((p) => p.eventClusterId).map((p) => [p.itemId, p.eventClusterId]));
  const groups = clusterItems(items, prevCluster);
  const events = groups.map((g) => buildEvent(g, ctx));
  const ranked = rankEvents(events, nowMs).slice(0, limit).map((ev) => ({ ...ev, rankingVersion: RANKING_VERSION, rank: { reason: reasonLine(ev, ev.factors, nowMs), factors: explain(ev.factors) }, factors: undefined }));
  const keepIds = new Set(); for (const ev of ranked) for (const m of ev.members) keepIds.add(m.itemId);
  const outItems = items.filter((i) => keepIds.has(i.itemId)).map(stripCandidate);
  const finalEvents = ranked.map((ev) => { const members = ev.members.map((m) => ({ ...stripCandidate(m), eventClusterId: ev.eventClusterId, relevanceScore: ev.relevanceScore })); const { members: _m, factors: _f, ...rest } = ev; return full ? { ...rest, items: members.slice(0, LIMITS.itemsPerEvent) } : rest; });
  return { events: finalEvents, items: outItems.map((i) => ({ ...i, eventClusterId: finalEvents.find((e) => e.items?.some((m) => m.itemId === i.itemId))?.eventClusterId ?? null })), rejections, counts: { seen, admitted: items.length, events: finalEvents.length, rejected: Object.values(rejections).reduce((a, b) => a + b, 0) }, pipelineVersion: PIPELINE_VERSION, rankingVersion: RANKING_VERSION };
}
const stripCandidate = ({ publishedSec: _p, tk: _t, ...rest }) => rest;

const TIER_ORDER = { official: 0, wire: 1, major: 2, known: 3, unknown: 4, aggregator: 5 };
function buildEvent(group, ctx) {
  const members = group.members.slice().sort((a, b) => (TIER_ORDER[a.sourceTier] ?? 9) - (TIER_ORDER[b.sourceTier] ?? 9) || (a.publishedSec ?? Infinity) - (b.publishedSec ?? Infinity) || (a.itemId < b.itemId ? -1 : 1));
  const primary = members[0]; const dated = members.filter((m) => m.publishedSec != null);
  const pubSec = dated.length ? Math.min(...dated.map((m) => m.publishedSec)) : null; const updSec = dated.length ? Math.max(...dated.map((m) => m.publishedSec)) : null;
  const best = members.reduce((b, m) => (m.significance > b.significance ? m : b), primary);
  const ent = new Map(); for (const m of members) for (const e of m.entities) { const k = e.sym ?? e.name; const o = ent.get(k); if (!o || e.confidence > o.confidence) ent.set(k, e); }
  const entities = [...ent.values()].sort((a, b) => b.confidence - a.confidence);
  const seenSources = new Set(); const sources = [];
  for (const m of members) { if (seenSources.has(m.sourceId)) continue; seenSources.add(m.sourceId); sources.push({ sourceId: m.sourceId, sourceTitle: m.sourceTitle, tier: m.sourceTier, canonicalUrl: m.canonicalUrl, publishedAt: m.publishedAt }); }
  const scopes = entities.length ? ['company'] : ['market']; if (entities.some((e) => e.sym && ctx.paperSyms.includes(e.sym))) scopes.push('paper');
  const flags = [...new Set(members.flatMap((m) => m.qualityFlags))]; const firstSeen = members.map((m) => m.firstSeenAt).sort()[0];
  return {
    eventClusterId: group.eventClusterId, headline: primary.headline, eventType: best.eventType, significance: best.significance, entities, scopes,
    publishedAt: iso(pubSec), updatedAt: iso(updSec) ?? primary.updatedAt, firstSeenAt: firstSeen, fetchedAt: primary.fetchedAt,
    sourceId: primary.sourceId, sourceTitle: primary.sourceTitle, sourceTier: primary.sourceTier, sourceWeight: primary.sourceWeight, canonicalUrl: primary.canonicalUrl, sourceTimezone: primary.sourceTimezone,
    moreSources: Math.max(0, sources.length - 1), sources: sources.slice(0, LIMITS.sourcesPerEvent), summary: primary.summary ?? members.find((m) => m.summary)?.summary ?? null,
    qualityFlags: flags, todayEligible: best.eventType !== 'Update' && pubSec != null, members,
  };
}

/** Build a registry from `{ sym, name, aliases }` rows. Re-exported so callers import one module. */
export { buildRegistry };
/** The compact form sent to browsers: no member items (their facts are in `sources`). */
export const compactEvent = ({ items: _i, ...rest }) => rest;
