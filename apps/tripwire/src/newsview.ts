/** What the news screens show, as pure functions of the events, the reader's lists and a clock. No React, no network: this is the logic the tests pin.
 *
 *  Four tabs and no hidden fifth source of names:
 *    Market       India-wide events (no single company)
 *    Following    events about names the reader FOLLOWS (state.follows), and nothing else: never seeded from the paper book
 *    Paper book   events about names in the paper book, its own tab
 *    All          the union of those three, each row labelled with where it came from
 *  Today shows only events fit for it (a known recent date, an event type that is an event); the News page shows the whole archive. A quiet day gives a short list and says so:
 *  there is no widening, no padding and no quota. */
import { DIVERSITY, TODAY_WINDOW_H } from '../news/config.js';
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
/** Two pools into one: the published snapshot's events plus live per-name events, one row per event (by id, or by any shared link). */
export function mergePools(a: NewsEvent[], b: NewsEvent[]): NewsEvent[] {
  const out: NewsEvent[] = []; const ids = new Set<string>(), urls = new Set<string>();
  for (const e of [...a, ...b]) { const links = [e.canonicalUrl, ...e.sources.map((s) => s.canonicalUrl)]; if (ids.has(e.eventClusterId) || links.some((u) => urls.has(u))) continue; ids.add(e.eventClusterId); links.forEach((u) => urls.add(u)); out.push(e); }
  return out;
}
/** How many events a freshly built list has that the list on screen does not: the number in "3 new updates". Order changes alone are not an update. */
export const newUpdates = (shown: NewsEvent[], next: NewsEvent[]): number => { const have = new Set(shown.map((e) => e.eventClusterId)); return next.filter((e) => !have.has(e.eventClusterId)).length; };
export const EVENT_TYPE_WORD: Record<string, string> = { Results: 'Results', Regulator: 'Regulator', Deal: 'Deal', Policy: 'Policy', Macro: 'Macro', Order: 'Order', IPO: 'IPO', Payout: 'Payout', Rating: 'Rating', People: 'People', Filing: 'Filing', Update: 'Update' };
/** The company line of a row: the verified entity (symbol and name) or "India-wide". */
export const entityLine = (ev: NewsEvent): string => { const e = ev.entities[0]; return e ? `${e.sym ?? e.name}${e.sym && e.name ? ` · ${e.name.replace(/\b(ltd|limited)\.?$/i, '').trim()}` : ''}` : 'India-wide'; };
/** A link that may be put in an href: https or http only. The pipeline already guarantees it; this is the last gate before the DOM. */
export const safeHref = (u: string): string | null => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : null; } catch { return null; } };
