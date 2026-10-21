'use client';

import { useEffect, useMemo, useState } from 'react';
import { dayFromLive, mergeLive, pickDay, type DayFigures, type LivePart, type LiveSnap, type Universe } from './live';
import type { RotationFeed, ChartFeed, Barometer, DataHealth, SignalsFeed, PxFeed, IpoLive, DetailFeed, Funds, InstFeed, Ipo, NewsItem, Pulse, QuotesFeed, Reads, Regime, Screen, SeasonFeed, SwotFeed, Summary } from './types';

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

export const BASE = process.env.NEXT_PUBLIC_DATA_BASE ?? '';
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
export const signalsFeed = (): Promise<SignalsFeed> => load<SignalsFeed>(`${BASE}/signals.json`);
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
/** The Swing v2 book: the market gate, the rules, the backtest and every signal (public/signals.json, written nightly). */
export const useSignals = (): Loaded<SignalsFeed> => useLoaded(signalsFeed, 'signals');
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

/** Five-minute closes of the latest session for up to 40 symbols (/api/intraday), refreshed every 5 minutes while visible. */
export function useIntraday(symbols: string[]): { quotes: Record<string, { prev: number; t: number[]; c: number[] }>; at: string | null; loading: boolean } {
  const key = Array.from(new Set(symbols)).sort().slice(0, 40).join(',');
  const [state, setState] = useState<{ quotes: Record<string, { prev: number; t: number[]; c: number[] }>; at: string | null; loading: boolean }>({ quotes: {}, at: null, loading: true });
  useEffect(() => {
    if (!key) { setState((x) => ({ ...x, loading: false })); return; }
    let live = true;
    const pull = () => {
      if (document.visibilityState !== 'visible') return;
      fetch(`${BASE}/api/intraday?s=${encodeURIComponent(key)}`).then((r) => r.json()).then((j) => { if (live) setState(j?.ok ? { quotes: j.quotes, at: j.fetched_at ?? null, loading: false } : (x) => ({ ...x, loading: false })); }, () => { if (live) setState((x) => ({ ...x, loading: false })); });
    };
    pull();
    const t = window.setInterval(pull, 300_000);
    return () => { live = false; window.clearInterval(t); };
  }, [key]);
  return state;
}

/** The whole screened market, live (/api/live, two halves) with the universe's sectors. ONE fetch loop per page, shared by
 *  every component that asks (the header clock, the hero, the widgets): it starts with the first subscriber and stops with the
 *  last. Refreshes every 60 s while trades are fresh and the tab is visible, every 10 minutes otherwise; a timer, not an
 *  observer or rAF, so a background tab catches up when it is shown again. Bypasses the load() memo on purpose. */
type LiveState = { snap: LiveSnap | null; universe: Universe | null; loading: boolean; error: string | null };
const liveHub = { state: { snap: null, universe: null, loading: true, error: null } as LiveState, subs: new Set<(s: LiveState) => void>(), timer: 0, running: false, gen: 0 };
async function liveTick(gen: number) {
  const getJson = async <T,>(u: string): Promise<T | null> => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? ((await r.json()) as T) : null; } catch { return null; } };
  const [uni, a, b] = await Promise.all([load<Universe>(`${BASE}/universe.json`).catch(() => null), getJson<LivePart>(`${BASE}/api/live?part=0`), getJson<LivePart>(`${BASE}/api/live?part=1`)]);
  if (!liveHub.running || gen !== liveHub.gen) return;   // a stopped or restarted loop exits instead of running twice
  const snap = mergeLive([a, b], uni?.count ?? 0);
  // a failed refresh keeps the last good snapshot (its time is on every label), instead of blanking the page
  liveHub.state = { snap: snap ?? liveHub.state.snap, universe: uni ?? liveHub.state.universe, loading: false, error: snap ? null : 'live prices unavailable' };
  liveHub.subs.forEach((f) => f(liveHub.state));
  const fresh = !!liveHub.state.snap && Date.now() / 1000 - liveHub.state.snap.newest < 30 * 60;
  const next = () => { liveHub.timer = window.setTimeout(() => { if (!liveHub.running || gen !== liveHub.gen) return; if (document.visibilityState === 'visible') void liveTick(gen); else next(); }, fresh ? 60_000 : 600_000); };
  next();
}
export function useLive(): LiveState {
  const [state, set] = useState<LiveState>(liveHub.state);
  useEffect(() => {
    liveHub.subs.add(set);
    set(liveHub.state);
    if (!liveHub.running) { liveHub.running = true; liveHub.gen += 1; void liveTick(liveHub.gen); }
    return () => {
      liveHub.subs.delete(set);
      if (!liveHub.subs.size) { liveHub.running = false; window.clearTimeout(liveHub.timer); }
    };
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

/** Index, commodity and currency quotes (/api/quotes), refreshed every 60 s while the tab is visible (timer, not rAF). */
export function useLiveQuotes(): Loaded<QuotesFeed> {
  const [state, set] = useState<Loaded<QuotesFeed>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true, timer = 0;
    const tick = async () => {
      try {
        const r = await fetch(`${BASE}/api/quotes`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`quotes answered ${r.status}`);
        const data = (await r.json()) as QuotesFeed;
        if (alive) set({ data, error: null, loading: false });
      } catch (e) { if (alive) set((s) => ({ data: s.data, error: e instanceof Error ? e.message : 'failed', loading: false })); }
      if (alive) timer = window.setTimeout(function again() { if (document.visibilityState === 'visible') void tick(); else timer = window.setTimeout(again, 60_000); }, 60_000);
    };
    void tick();
    return () => { alive = false; window.clearTimeout(timer); };
  }, []);
  return state;
}
