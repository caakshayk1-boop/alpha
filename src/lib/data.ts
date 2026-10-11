'use client';

import { useEffect, useState } from 'react';
import type { Barometer, DataHealth, EnginesFeed, IpoLive, DetailFeed, Funds, InstFeed, Ipo, NewsItem, Pulse, QuotesFeed, Reads, Regime, Screen, SeasonFeed, SwotFeed } from './types';

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
export const useIpoLive = (): Loaded<IpoLive> => useLoaded(ipoLiveFeed, 'ipolive');
export const useQuotes = (): Loaded<QuotesFeed> => useLoaded(quotesFeed, 'quotes');
