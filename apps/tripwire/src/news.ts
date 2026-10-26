/** Headlines, cleaned by the Worker and refreshed hourly. Module-level cache so the same query on two screens is one request. */
import { useCallback, useEffect, useState } from 'react';
export interface NewsItem { title: string; source: string; url: string; t: number; tags: string[]; also: number; sources: string[] }
export interface NewsFeed { ok: boolean; fetched_at: string; q: string; items: NewsItem[] }
export const NEWS_EVERY = 60 * 60 * 1000;
export const MARKET_Q = 'Nifty OR Sensex OR "stock market" OR RBI when:1d';
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
