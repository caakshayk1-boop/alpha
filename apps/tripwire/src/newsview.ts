/** What the news screens show, as pure functions of the events, the reader's lists and a clock. No React, no network: this is the logic the tests pin.
 *
 *  Four tabs and no hidden fifth source of names:
 *    Market       India-wide events (no single company)
 *    Following    events about names the reader FOLLOWS (state.follows), and nothing else: never seeded from the paper book
 *    Paper book   events about names in the paper book, its own tab
 *    All          the union of those three, each row labelled with where it came from
 *  Today shows only events fit for it (a known recent date, an event type that is an event); the News page shows the whole archive. A quiet day gives a short list and says so:
 *  there is no widening, no padding and no quota. */
import { DIVERSITY, LIMITS, TODAY_WINDOW_H } from '../news/config.js';
import { sameEvent, tokens } from '../news/cluster.js';
import { diversify, rankEvents, userRelevance } from '../news/rank.js';

export interface NewsEntity { sym: string | null; name: string | null; confidence: number; matchedOn: string }
export interface NewsSource { sourceId: string; sourceTitle: string; tier: string; canonicalUrl: string; publishedAt: string | null }
export interface NewsEvent {
  eventClusterId: string; headline: string; eventType: string; significance: number; entities: NewsEntity[]; scopes: string[];
  publishedAt: string | null; updatedAt: string | null; firstSeenAt: string | null; fetchedAt: string | null;
  sourceId: string; sourceTitle: string; sourceTier: string; sourceWeight: number; canonicalUrl: string; sourceTimezone: string;
  moreSources: number; sources: NewsSource[]; summary: { text: string; provenance: { kind: string; feedId: string; retrievedAt: string | null; note: string } } | null;
  qualityFlags: string[]; todayEligible: boolean; relevanceScore: number; rankingVersion: string; rank?: { reason: string; factors: { k: string; value: number; weight: number; points: number }[] };
}
export type Tab = 'all' | 'market' | 'following' | 'paper';
export const TABS: { id: Tab; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'market', label: 'Market' }, { id: 'following', label: 'Following' }, { id: 'paper', label: 'Paper book' }];
export interface Lists { follows: string[]; paper: string[] }
const syms = (ev: NewsEvent) => ev.entities.map((e) => e.sym).filter((s): s is string => !!s);
export const isMarket = (ev: NewsEvent) => ev.scopes.includes('market') && !ev.entities.length;
export const inFollowing = (ev: NewsEvent, l: Lists) => syms(ev).some((s) => l.follows.includes(s));
export const inPaper = (ev: NewsEvent, l: Lists) => syms(ev).some((s) => l.paper.includes(s));
/** The labels that say why a row is in All. A name can be both followed and in the paper book: both labels show. */
export function labelsOf(ev: NewsEvent, l: Lists): string[] { const out: string[] = []; if (inFollowing(ev, l)) out.push('Following'); if (inPaper(ev, l)) out.push('Paper book'); if (isMarket(ev)) out.push('Market'); return out; }
export const inTab = (ev: NewsEvent, tab: Tab, l: Lists) => (tab === 'market' ? isMarket(ev) : tab === 'following' ? inFollowing(ev, l) : tab === 'paper' ? inPaper(ev, l) : isMarket(ev) || inFollowing(ev, l) || inPaper(ev, l));

const ms = (iso: string | null) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? t : null; };
/** Fit for Today: a known publication time that is not in the future, an event type that is an event, and inside the window of its kind (72 h for a company event, 48 h for an India-wide one). */
export function fitForToday(ev: NewsEvent, nowMs: number): boolean {
  const p = ms(ev.publishedAt); if (p == null || p > nowMs + 600e3 || !ev.todayEligible) return false;
  return nowMs - p <= (isMarket(ev) ? TODAY_WINDOW_H.market : TODAY_WINDOW_H.company) * 3600e3;
}
export const relevance = (l: Lists) => (ev: NewsEvent) => userRelevance(ev, l);

/** The ranked, diversified list for Today: at most `max` events, at most two per company in the first five. */
export function todayList(pool: NewsEvent[], tab: Tab, l: Lists, nowMs: number, max = DIVERSITY.maxToday): NewsEvent[] {
  const fit = pool.filter((e) => inTab(e, tab, l) && fitForToday(e, nowMs));
  return diversify(rankEvents(fit, nowMs, relevance(l)), { max }) as NewsEvent[];
}
export const tabCounts = (pool: NewsEvent[], l: Lists, nowMs: number): Record<Tab, number> => ({ all: pool.filter((e) => inTab(e, 'all', l) && fitForToday(e, nowMs)).length, market: pool.filter((e) => inTab(e, 'market', l) && fitForToday(e, nowMs)).length, following: pool.filter((e) => inFollowing(e, l) && fitForToday(e, nowMs)).length, paper: pool.filter((e) => inPaper(e, l) && fitForToday(e, nowMs)).length });

/** The News page's archive: every kept event of the tab, newest first by publication time (unknown times last), with the filters applied. */
export interface ArchiveFilter { tab: Tab; types: string[]; days: number; includeOther: boolean; covered: boolean; text: string }
export function archiveList(pool: NewsEvent[], f: ArchiveFilter, l: Lists, nowMs: number): NewsEvent[] {
  const q = f.text.trim().toLowerCase();
  return pool.filter((e) => {
    if (!(f.covered ? true : inTab(e, f.tab, l))) return false;
    if (!f.includeOther && (e.eventType === 'Update' || e.publishedAt == null)) return false;
    if (f.types.length && !f.types.includes(e.eventType)) return false;
    const p = ms(e.publishedAt); if (p != null && (p > nowMs + 600e3 || nowMs - p > f.days * 86400e3)) return false;
    if (q && !(e.headline.toLowerCase().includes(q) || e.entities.some((x) => (x.sym ?? '').toLowerCase() === q || (x.name ?? '').toLowerCase().includes(q)))) return false;
    return true;
  }).sort((a, b) => (ms(b.publishedAt) ?? -1) - (ms(a.publishedAt) ?? -1) || (a.eventClusterId < b.eventClusterId ? -1 : 1));
}
/* ---------- the same event, told by several outlets ---------- */
const TIER_RANK: Record<string, number> = { official: 0, wire: 1, major: 2, known: 3, unknown: 4, aggregator: 5 };
const secOf = (iso: string | null) => { const t = ms(iso); return t == null ? null : Math.floor(t / 1000); };
/** A published event as the clustering rule's candidate: the SAME rule (`news/cluster.js#sameEvent`) the scheduled job groups items with, applied to two events that reached the browser by different routes
 *  (the shared snapshot and a live per-company query). Only fields the pipeline already published are read; nothing is summarised or invented. */
const asCandidate = (e: NewsEvent) => ({ headline: e.headline, tk: tokens(e.headline), eventType: e.eventType, publishedSec: secOf(e.publishedAt), entities: e.entities, canonicalUrl: e.canonicalUrl });
export const sameCoverage = (a: NewsEvent, b: NewsEvent): boolean => sameEvent(asCandidate(a), asCandidate(b));
/** One event from two reports of it. The more authoritative outlet stays primary; EVERY source link of both is kept (one per outlet, the first seen wins), up to the pipeline's own cap; the earliest
 *  publication time is the event's, the latest is its update. The id of `a` is kept. */
export function mergeCoverage(a: NewsEvent, b: NewsEvent): NewsEvent {
  const first = (TIER_RANK[b.sourceTier] ?? 9) < (TIER_RANK[a.sourceTier] ?? 9) ? b : a;
  const seen = new Set<string>(); const sources: NewsSource[] = [];
  for (const s of [...first.sources, ...a.sources, ...b.sources]) { if (seen.has(s.sourceId)) continue; seen.add(s.sourceId); sources.push(s); }
  const times = [a.publishedAt, b.publishedAt].filter((x): x is string => ms(x) != null).sort(); const upd = [a.updatedAt, b.updatedAt].filter((x): x is string => ms(x) != null).sort();
  const seenEnt = new Map<string, NewsEntity>(); for (const x of [...a.entities, ...b.entities]) { const k = x.sym ?? x.name ?? ''; const o = seenEnt.get(k); if (!o || x.confidence > o.confidence) seenEnt.set(k, x); }
  const kept = sources.slice(0, LIMITS.sourcesPerEvent);
  return { ...first, eventClusterId: a.eventClusterId, sources: kept, moreSources: Math.max(0, sources.length - 1), publishedAt: times[0] ?? null, updatedAt: upd[upd.length - 1] ?? first.updatedAt,
    firstSeenAt: [a.firstSeenAt, b.firstSeenAt].filter((x): x is string => !!x).sort()[0] ?? null, entities: [...seenEnt.values()].sort((x, y) => y.confidence - x.confidence), todayEligible: a.todayEligible || b.todayEligible,
    qualityFlags: [...new Set([...a.qualityFlags, ...b.qualityFlags])], rank: a.rank ?? b.rank, relevanceScore: Math.max(a.relevanceScore ?? 0, b.relevanceScore ?? 0) };
}
/** Two pools into one: the published snapshot's events plus live per-name events, one row per event (by id, by any shared link, or by the pipeline's own same-event rule, in which case the coverage is combined
 *  and no outlet's link is lost). */
export function mergePools(a: NewsEvent[], b: NewsEvent[]): NewsEvent[] {
  const out: NewsEvent[] = []; const ids = new Set<string>(), urls = new Set<string>();
  const fromB = new Set(b);   // the snapshot's own events were already grouped by the job; only an event arriving by the other route is tested against what is on the page
  for (const e of [...a, ...b]) {
    const links = [e.canonicalUrl, ...e.sources.map((s) => s.canonicalUrl)]; if (ids.has(e.eventClusterId) || links.some((u) => urls.has(u))) continue;
    const at = fromB.has(e) ? out.findIndex((o) => sameCoverage(o, e)) : -1; ids.add(e.eventClusterId); links.forEach((u) => urls.add(u));
    if (at >= 0) { out[at] = mergeCoverage(out[at], e); continue; }
    out.push(e);
  }
  return out;
}
/* ---------- categories (a reader's grouping of the keyword event types) ---------- */
/** Twelve keyword types are too many to scan, so they are grouped into seven plain categories. A category is a fixed lookup of the type the keyword rules already assigned; it adds no judgement and says nothing about good or bad news. */
export const NEWS_CATEGORIES: { id: string; label: string; types: string[] }[] = [
  { id: 'earnings', label: 'Results and earnings', types: ['Results'] },
  { id: 'deals', label: 'Deals, payouts and listings', types: ['Deal', 'Payout', 'IPO'] },
  { id: 'business', label: 'Orders and business', types: ['Order'] },
  { id: 'rules', label: 'Regulation, policy and filings', types: ['Regulator', 'Policy', 'Filing'] },
  { id: 'macro', label: 'Economy and markets', types: ['Macro'] },
  { id: 'people', label: 'Ratings and people', types: ['Rating', 'People'] },
  { id: 'other', label: 'Other updates', types: ['Update'] },
];
export const categoryOf = (type: string): string => NEWS_CATEGORIES.find((c) => c.types.includes(type))?.label ?? 'Other updates';
/** The value a filter select holds: a category ("cat:deals") when its whole type list is chosen, otherwise the one type. */
export function typeFilterValue(types: string[]): string {
  if (!types.length) return '';
  const c = NEWS_CATEGORIES.find((x) => x.types.length > 1 && x.types.length === types.length && x.types.every((t) => types.includes(t)));
  return c ? `cat:${c.id}` : types[0];
}
export const typesFromValue = (v: string): string[] => (v.startsWith('cat:') ? NEWS_CATEGORIES.find((c) => c.id === v.slice(4))?.types ?? [] : v ? [v] : []);

/* ---------- two clocks on every story ---------- */
/** PUBLISHED is when the outlet says it published; COLLECTED is when Tripwire's news check first saw it. They are different clocks and are never swapped: a story with no usable publication time says so and
 *  shows only the collection time. Collection is never used as a stand-in for publication. */
export function timeLabels(ev: Pick<NewsEvent, 'publishedAt' | 'firstSeenAt'>, nowMs: number): { published: string; collected: string; gap: string | null } {
  const rel = (iso: string | null) => { const t = ms(iso); if (t == null || t > nowMs + 600e3) return null; const m = Math.max(0, Math.round((nowMs - t) / 60000)); return m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
  const p = rel(ev.publishedAt), c = rel(ev.firstSeenAt); const pm = ms(ev.publishedAt), cm = ms(ev.firstSeenAt);
  const gapMin = pm != null && cm != null && cm > pm ? Math.round((cm - pm) / 60000) : null;
  return { published: p ? `Published ${p}` : 'Publication time unknown', collected: c ? `Collected ${c}` : 'Collection time unknown', gap: gapMin != null && gapMin >= 60 ? `Collected ${gapMin >= 1440 ? `${Math.round(gapMin / 1440)} d` : `${Math.round(gapMin / 60)} h`} after it was published` : null };
}
/** How many events a freshly built list has that the list on screen does not: the number in "3 new updates". Order changes alone are not an update. */
export const newUpdates = (shown: NewsEvent[], next: NewsEvent[]): number => { const have = new Set(shown.map((e) => e.eventClusterId)); return next.filter((e) => !have.has(e.eventClusterId)).length; };
export const EVENT_TYPE_WORD: Record<string, string> = { Results: 'Results', Regulator: 'Regulator', Deal: 'Deal', Policy: 'Policy', Macro: 'Macro', Order: 'Order', IPO: 'IPO', Payout: 'Payout', Rating: 'Rating', People: 'People', Filing: 'Filing', Update: 'Update' };
/** The company line of a row: the verified entity (symbol and name) or "India-wide". */
export const entityLine = (ev: NewsEvent): string => { const e = ev.entities[0]; return e ? `${e.sym ?? e.name}${e.sym && e.name ? ` · ${e.name.replace(/\b(ltd|limited)\.?$/i, '').trim()}` : ''}` : 'India-wide'; };
/** A link that may be put in an href: https or http only. The pipeline already guarantees it; this is the last gate before the DOM. */
export const safeHref = (u: string): string | null => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : null; } catch { return null; } };

/* ---------- counts: events, articles, companies (one definition each) ---------- */
/** EVENT: one story, however many outlets carried it (an `eventClusterId`). ARTICLE: one outlet's report of an event (`sources`; a row with none counts as the one it is). COMPANY: a distinct
 *  verified company named by the events shown (an India-wide event names none, so it adds to events and articles only). */
export interface NewsCounts { events: number; articles: number; companies: number; marketEvents: number }
export function newsCounts(events: readonly NewsEvent[]): NewsCounts {
  const cos = new Set<string>(); let articles = 0, market = 0;
  for (const e of events) {
    articles += Math.max(1, e.sources.length); if (isMarket(e)) market++;
    for (const x of e.entities) { const k = x.sym ?? x.name; if (k) cos.add(k); }
  }
  return { events: events.length, articles, companies: cos.size, marketEvents: market };
}
/** "12 events · 19 articles · 8 companies". Singular where it is 1; the same words everywhere. */
export function countsLine(c: NewsCounts): string {
  const p = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return `${p(c.events, 'event', 'events')} · ${p(c.articles, 'article', 'articles')} · ${p(c.companies, 'company', 'companies')}`;
}
export const COUNT_DEFINITION = "An event is one story, however many outlets carried it. Articles are the outlets' separate reports of those events. Companies are the distinct covered companies the events name; India-wide events name none.";
/** The News page's tab numbers: for each tab, how many events the page would list under the SAME filters (type, period, search, other updates), so a number on a tab always equals the total after pressing it. */
export function archiveTabCounts(pool: NewsEvent[], f: ArchiveFilter, l: Lists, nowMs: number): Record<Tab, number> {
  const n = (tab: Tab) => archiveList(pool, { ...f, tab }, l, nowMs).length;
  return { all: n('all'), market: n('market'), following: n('following'), paper: n('paper') };
}
/** Today's tab numbers: each is the length of the list Today would draw for that tab (diversified and capped), so the chip equals what "Show more" can reach. */
export function todayTabCounts(pool: NewsEvent[], l: Lists, nowMs: number): Record<Tab, number> {
  const n = (tab: Tab) => todayList(pool, tab, l, nowMs).length;
  return { all: n('all'), market: n('market'), following: n('following'), paper: n('paper') };
}
