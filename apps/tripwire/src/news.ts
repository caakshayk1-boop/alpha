/** Headlines, cleaned by the Worker and refreshed hourly. Module-level cache so the same query on two screens is one request. */
import { useCallback, useEffect, useState } from 'react';
export interface NewsItem { title: string; source: string; url: string; t: number; tags: string[]; also: number; sources: string[] }
export interface NewsFeed { ok: boolean; fetched_at: string; q: string; items: NewsItem[] }
export const NEWS_EVERY = 60 * 60 * 1000;
export const MARKET_Q = 'Sensex Nifty today when:1d';      // plain words: Bing returns nothing for an OR query
/** A search phrase from a company name: the legal suffix goes (it only adds noise), the rest is quoted so the name stays together. */
export const companyQ = (name: string) => `"${name.replace(/\b(ltd|limited|inc|corp|corporation|pvt|private)\b\.?/gi, '').replace(/[^A-Za-z0-9 &.'\-]/g, ' ').replace(/\s+/g, ' ').trim()}" when:7d`;

const cache = new Map<string, { at: number; data: NewsFeed }>(); const flight = new Map<string, Promise<NewsFeed>>();
async function load(q: string, force: boolean): Promise<NewsFeed> {
  const hit = cache.get(q); if (hit && !force && Date.now() - hit.at < NEWS_EVERY) return hit.data;
  const f = flight.get(q); if (f) return f;
  const p = (async () => {
    const r = await fetch(`/api/news?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(20000) }); const d = (await r.json().catch(() => null)) as (NewsFeed & { error?: string }) | null;
    if (!r.ok || !d?.ok) throw new Error(r.status === 404 ? 'the news service is not available here' : d?.error ?? 'the news source did not answer');
    cache.set(q, { at: Date.now(), data: d }); return d;
  })();
  flight.set(q, p); try { return await p; } finally { flight.delete(q); }
}
/** One query, loaded now and again every hour while the page is open and visible. */
export function useNews(q: string | null) {
  const [st, set] = useState<{ data: NewsFeed | null; at: number | null; err: string | null; loading: boolean }>({ data: null, at: null, err: null, loading: !!q });
  const run = useCallback((force: boolean) => {
    if (!q) return () => {}; let live = true; set((s) => ({ ...s, loading: true }));
    load(q, force).then((d) => live && set({ data: d, at: cache.get(q)?.at ?? Date.now(), err: null, loading: false })).catch((e: Error) => live && set((s) => ({ ...s, err: e.message || 'unreachable', loading: false })));
    return () => { live = false; };
  }, [q]);
  useEffect(() => {
    if (!q) { set({ data: null, at: null, err: null, loading: false }); return; }
    const stop = run(false);
    const i = window.setInterval(() => { if (document.visibilityState === 'visible') run(true); }, NEWS_EVERY);
    const vis = () => { if (document.visibilityState === 'visible' && Date.now() - (cache.get(q)?.at ?? 0) >= NEWS_EVERY) run(true); };
    document.addEventListener('visibilitychange', vis);
    return () => { stop(); window.clearInterval(i); document.removeEventListener('visibilitychange', vis); };
  }, [q, run]);
  return { ...st, refresh: () => run(true) };
}
export const ago = (sec: number, nowMs = Date.now()) => { const m = Math.max(0, Math.round((nowMs / 1000 - sec) / 60)); return m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export interface Merged extends NewsItem { sym?: string; score: number }
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'as', 'at', 'by', 'with', 'is', 'are', 'its', 'from', 'after', 'over', 'amid']);
const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
const same = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return false; let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.min(a.size, b.size) >= 0.7; };
const TAG_WEIGHT: Record<string, number> = { Results: 3, Regulator: 3, Deal: 2, Order: 2, Rating: 1.5, Payout: 1.5, IPO: 1, People: 0.5 };
/** Pure. Several feeds into one short list: the same story once (by URL, or by most of its words), a story about a name you hold ahead of a general one,
 *  a material tag ahead of none, newer ahead of older. The score is ordering only; it is not shown and says nothing about good or bad news. */
export function mergeNews(feeds: { sym?: string; items: NewsItem[] }[], limit: number, nowMs = Date.now()): Merged[] {
  const out: { m: Merged; w: Set<string> }[] = [];
  for (const f of feeds) for (const it of f.items) {
    const w = words(it.title); const hit = out.find((o) => o.m.url === it.url || same(o.w, w));
    const ageH = Math.max(0, (nowMs / 1000 - it.t) / 3600);
    const score = (f.sym ? 4 : 0) + Math.max(0, ...it.tags.map((t) => TAG_WEIGHT[t] ?? 0)) + Math.min(2, it.also * 0.5) - Math.min(6, ageH / 8);
    if (hit) { if (f.sym && !hit.m.sym) hit.m.sym = f.sym; hit.m.score = Math.max(hit.m.score, score); if (it.t > hit.m.t) { hit.m.t = it.t; hit.m.title = it.title; hit.m.url = it.url; hit.m.source = it.source; } hit.m.also = Math.max(hit.m.also, it.also + 1); continue; }
    out.push({ m: { ...it, sym: f.sym, score }, w });
  }
  return out.map((o) => o.m).sort((a, b) => b.score - a.score || b.t - a.t).slice(0, limit);
}
/** Several queries, each loaded once and refreshed hourly, sharing the module cache with useNews. */
export function useNewsMany(qs: string[]) {
  const key = qs.join('\n'); const [st, set] = useState<{ feeds: (NewsFeed | null)[]; at: number | null; loading: boolean; failed: number }>({ feeds: [], at: null, loading: qs.length > 0, failed: 0 });
  const run = useCallback((force: boolean) => {
    const list = key ? key.split('\n') : []; let live = true; if (!list.length) return () => {}; set((s) => ({ ...s, loading: true }));
    Promise.allSettled(list.map((q) => load(q, force))).then((rs) => { if (live) set({ feeds: rs.map((r) => (r.status === 'fulfilled' ? r.value : null)), at: Date.now(), loading: false, failed: rs.filter((r) => r.status === 'rejected').length }); });
    return () => { live = false; };
  }, [key]);
  useEffect(() => {
    const stop = run(false); const i = window.setInterval(() => { if (document.visibilityState === 'visible') run(true); }, NEWS_EVERY);
    return () => { stop(); window.clearInterval(i); };
  }, [run]);
  return { ...st, refresh: () => run(true) };
}

/** Pure. A company's own feed, cut to what is about THAT company and told once. The headline must name it; and the many outlets that cover one event
 *  (a results night is printed by five) become one line: stories with the same topic tag inside 72 hours are one story, kept as the most
 *  corroborated and then the newest, and the rest are counted ("+4 outlets"), never listed. Untagged stories fold only on shared words. */
export function companyStories(name: string, items: NewsItem[], limit = 3): NewsItem[] {
  const core = name.replace(/\b(ltd|limited|inc|corp|corporation|pvt|private|india|industries|the)\b\.?/gi, ' ').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3)[0]?.toLowerCase();
  const about = items.filter((it) => !core || it.title.toLowerCase().includes(core));
  const out: { it: NewsItem; w: Set<string>; n: number }[] = [];
  for (const it of [...about].sort((a, b) => b.t - a.t)) {
    const w = words(it.title); const tag = it.tags[0];
    const hit = out.find((o) => (tag && o.it.tags[0] === tag && Math.abs(o.it.t - it.t) < 72 * 3600) || same(o.w, w));
    if (hit) { hit.n += 1 + it.also; if (it.also > hit.it.also && it.t > hit.it.t - 24 * 3600) { hit.it = { ...it }; hit.w = w; } continue; }
    out.push({ it: { ...it }, w, n: it.also });
  }
  return out.slice(0, limit).map((o) => ({ ...o.it, also: o.n }));
}
