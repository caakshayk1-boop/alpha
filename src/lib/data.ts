'use client';

import { useEffect, useState } from 'react';
import type { RotationFeed, ChartFeed, Barometer, DataHealth, EnginesFeed, PxFeed, IpoLive, DetailFeed, Funds, InstFeed, Ipo, NewsItem, Pulse, QuotesFeed, Reads, Regime, Screen, SeasonFeed, SwotFeed } from './types';

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

function load<T>(url: string): Promise<T> {
  let p = memo.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then(async (r) => {
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
export const pxFeed = (syms: string[]): Promise<PxFeed> => load<PxFeed>(`${BASE}/api/px?s=${encodeURIComponent(syms.join(','))}`);
export const chartFeed = (sym: string, range: string): Promise<ChartFeed> => load<ChartFeed>(`${BASE}/api/chart?s=${encodeURIComponent(sym)}&r=${range}`);
export const rotationFeed = (): Promise<RotationFeed> => load<RotationFeed>(`${BASE}/rotation.json`);
export const enginesFeed = (): Promise<EnginesFeed> => load<EnginesFeed>(`${BASE}/engines.json`);
export const ipoLiveFeed = (): Promise<IpoLive> => load<IpoLive>(`${BASE}/api/ipo-live`);
export const quotesFeed = (): Promise<QuotesFeed> => load<QuotesFeed>(`${BASE}/api/quotes`);

export interface Loaded<T> { data: T | null; error: string | null; loading: boolean }

function useLoaded<T>(get: () => Promise<T>, key: string): Loaded<T> {
  const [state, set] = useState<Loaded<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
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
  }, [key]);
  return state;
}

export const useFeed = <K extends FeedName>(name: K): Loaded<FeedMap[K]> => useLoaded(() => feed(name), name);
export const useEngines = (): Loaded<EnginesFeed> => useLoaded(enginesFeed, 'engines');
export const useRotation = (): Loaded<RotationFeed> => useLoaded(rotationFeed, 'rotation');
export const useIpoLive = (): Loaded<IpoLive> => useLoaded(ipoLiveFeed, 'ipolive');
export const useQuotes = (): Loaded<QuotesFeed> => useLoaded(quotesFeed, 'quotes');

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
