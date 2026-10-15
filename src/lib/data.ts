'use client';

import { useEffect, useMemo, useState } from 'react';
import { dayFromLive, mergeLive, pickDay, type DayFigures, type LivePart, type LiveSnap, type Universe } from './live';
import type { RotationFeed, ChartFeed, Barometer, DataHealth, EnginesFeed, PxFeed, IpoLive, DetailFeed, Funds, InstFeed, Ipo, NewsItem, Pulse, QuotesFeed, Reads, Regime, Screen, SeasonFeed, SwotFeed, Summary } from './types';

/** feed name -> payload type */
export interface FeedMap {
  screen: Screen;
  'screen-detail': DetailFeed;
  pulse: Pulse;
  regime: Regime;
  barometer: Barometer;
  ipo: Ipo;
  news: NewsItem[];
  funds: Funds;
  weekly_reads: Reads;
  seasonality: SeasonFeed;
  swot: SwotFeed;
  institutional: InstFeed;
  'data-health': DataHealth;
}
export type FeedName = keyof FeedMap;

const BASE = process.env.NEXT_PUBLIC_DATA_BASE ?? '';
const memo = new Map<string, Promise<unknown>>();

/** Requests started by the inline script in app/layout.tsx before this bundle ran (Today only). Each is used once. */
function early<T>(url: string): Promise<T> | undefined {
  if (typeof window === 'undefined') return undefined;
  const pre = (window as Window & { __alphaPre?: Record<string, Promise<unknown>> }).__alphaPre;
  const hit = pre?.[url] as Promise<T> | undefined;
  if (hit && pre) delete pre[url];
  return hit;
}

function load<T>(url: string): Promise<T> {
  let p = memo.get(url) as Promise<T> | undefined;
  if (!p) {
    p = early<T>(url) ?? fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`${url} answered ${r.status}`);
      return (await r.json()) as T;
    });
    // a failed load must be retryable, not cached forever
    p.catch(() => memo.delete(url));
    memo.set(url, p);
  }
  return p;
}

export const feed = <K extends FeedName>(name: K): Promise<FeedMap[K]> => load<FeedMap[K]>(`${BASE}/data/${name}.json`);
export const chartFeed = (sym: string, range: string): Promise<ChartFeed> => load<ChartFeed>(`${BASE}/api/chart?s=${encodeURIComponent(sym)}&r=${range}`);
export const rotationFeed = (): Promise<RotationFeed> => load<RotationFeed>(`${BASE}/rotation.json`);
export const enginesFeed = (): Promise<EnginesFeed> => load<EnginesFeed>(`${BASE}/engines.json`);
export const ipoLiveFeed = (): Promise<IpoLive> => load<IpoLive>(`${BASE}/api/ipo-live`);
export const summaryFeed = (): Promise<Summary> => load<Summary>(`${BASE}/api/summary`);
export const quotesFeed = (): Promise<QuotesFeed> => load<QuotesFeed>(`${BASE}/api/quotes`);

export interface Loaded<T> { data: T | null; error: string | null; loading: boolean }

function useLoaded<T>(get: () => Promise<T>, key: string, enabled = true): Loaded<T> {
  const [state, set] = useState<Loaded<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    set({ data: null, error: null, loading: true });
    get().then(
      (data) => live && set({ data, error: null, loading: false }),
      (e: unknown) => live && set({ data: null, error: e instanceof Error ? e.message : 'failed', loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return state;
}

export const useFeed = <K extends FeedName>(name: K): Loaded<FeedMap[K]> => useLoaded(() => feed(name), name);
/** Like useFeed, but does nothing until `enabled`: lets a page skip a big feed when a small one already answered. */
export const useFeedWhen = <K extends FeedName>(name: K, enabled: boolean): Loaded<FeedMap[K]> => useLoaded(() => feed(name), name, enabled);

/** One company's slice of every company feed, built before each deploy (scripts/shard.mjs). An error means no shard: use the full feeds. */
export interface Shard { sym: string; built_on: string; count: number; row: import('./types').Row; years: import('./types').Year[] | null; swot: import('./types').Swot | null; inst: import('./types').InstRow | null; season: { m: [number, number, number][]; y: number } | null }
export const useShard = (sym: string): Loaded<Shard> => useLoaded(() => load<Shard>(`${BASE}/c/${encodeURIComponent(sym)}.json`), `shard:${sym}`, !!sym);
export const useEngines = (): Loaded<EnginesFeed> => useLoaded(enginesFeed, 'engines');
export const useRotation = (): Loaded<RotationFeed> => useLoaded(rotationFeed, 'rotation');
export const useIpoLive = (): Loaded<IpoLive> => useLoaded(ipoLiveFeed, 'ipolive');
export const useQuotes = (): Loaded<QuotesFeed> => useLoaded(quotesFeed, 'quotes');
/** The day's breadth, 200-day share and sector medians in under 2 KB, so a headline never waits on the 490 KB screen. */
export const useSummary = (): Loaded<Summary> => useLoaded(summaryFeed, 'summary');

/** Live prices for a set of symbols, refreshed every 60 seconds while the tab is visible. Empty until the first answer. */
export function usePx(symbols: string[]): { quotes: Record<string, import('./types').PxQuote>; at: string | null } {
  const key = Array.from(new Set(symbols)).sort().slice(0, 40).join(',');
  const [state, setState] = useState<{ quotes: Record<string, import('./types').PxQuote>; at: string | null }>({ quotes: {}, at: null });
  useEffect(() => {
    if (!key) return;
    let live = true;
    const pull = () => {
      if (document.visibilityState !== 'visible') return;
      // bypass the in-memory memo: this one is meant to be fresh
      fetch(`${BASE}/api/px?s=${encodeURIComponent(key)}`).then((r) => r.json() as Promise<import('./types').PxFeed>).then((j) => { if (live && j.ok) setState({ quotes: j.quotes, at: j.fetched_at ?? null }); }, () => undefined);
    };
    pull();
    const t = window.setInterval(pull, 60_000);
    return () => { live = false; window.clearInterval(t); };
  }, [key]);
  return state;
}

/** The whole screened market, live (/api/live, two halves) with the universe's sectors. Refreshes every 60 s while trades are
 *  fresh and the tab is visible, every 10 minutes otherwise; a timer, not an observer or rAF, so a background tab catches up
 *  when it is shown again. Bypasses the load() memo on purpose: this one must change. */
export function useLive(): { snap: LiveSnap | null; universe: Universe | null; loading: boolean; error: string | null } {
  const [state, set] = useState<{ snap: LiveSnap | null; universe: Universe | null; loading: boolean; error: string | null }>({ snap: null, universe: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const getJson = async <T,>(u: string): Promise<T | null> => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? ((await r.json()) as T) : null; } catch { return null; } };
    const tick = async () => {
      const [uni, a, b] = await Promise.all([load<Universe>(`${BASE}/universe.json`).catch(() => null), getJson<LivePart>(`${BASE}/api/live?part=0`), getJson<LivePart>(`${BASE}/api/live?part=1`)]);
      if (!alive) return;
      const snap = mergeLive([a, b], uni?.count ?? 0);
      set({ snap, universe: uni, loading: false, error: snap ? null : 'live prices unavailable' });
      const fresh = !!snap && Date.now() / 1000 - snap.newest < 30 * 60;
      const next = () => { timer = window.setTimeout(() => { if (document.visibilityState === 'visible') void tick(); else next(); }, fresh ? 60_000 : 600_000); };
      next();
    };
    void tick();
    return () => { alive = false; window.clearTimeout(timer); };
  }, []);
  return state;
}

/** The day's breadth and sector moves under the one rule in lib/live.ts: the newer session wins, live needs 90% coverage. */
export function useDay(): { day: DayFigures | null; live: ReturnType<typeof useLive>; loading: boolean } {
  const sum = useSummary();
  const lv = useLive();
  const day = useMemo(() => {
    const close: DayFigures | null = sum.data && sum.data.as_of ? { source: 'close', session: sum.data.as_of, ...sum.data.day, sectors: sum.data.sectors } : null;
    const live = lv.snap && lv.universe ? dayFromLive(lv.snap, lv.universe) : null;
    return pickDay(close, live, lv.snap && lv.universe?.count ? lv.snap.count / lv.universe.count : 0);
  }, [sum.data, lv.snap, lv.universe]);
  return { day, live: lv, loading: sum.loading && lv.loading };
}
