'use client';

import { useMemo } from 'react';
import { computeBarometer, type Reading } from './barometer';
import { useDay, useFeed, useLiveQuotes } from './data';
import { istDate } from './live';

/** The Barometer to show, under the site's one rule: computed live when the live session is NEWER than the published
 *  reading's Nifty date (and the Nifty itself has traded in that session); otherwise the published reading. `previous` is
 *  the last published reading of an OLDER Nifty session, so "up from X" never compares a reading with a stale copy of itself
 *  (the published history has a row dated 19 Oct 2026 that carries the 16 Oct Nifty). */
export interface BarometerView {
  reading: Reading;
  source: 'live' | 'published';
  /** the Nifty session the reading describes */
  session: string;
  /** epoch seconds of the Nifty trade behind a live reading */
  at: number | null;
  previous: { score: number; date: string; drawdownPct?: number | null; above200Pct?: number | null; vix?: number | null } | null;
}

export function useBarometer(): { view: BarometerView | null; loading: boolean; error: string | null } {
  const bar = useFeed('barometer');
  const quotes = useLiveQuotes();
  const { day, live } = useDay();
  const view = useMemo<BarometerView | null>(() => {
    const t = bar.data?.today;
    const hist = bar.data?.history ?? [];
    const prevOf = (session: string) => {
      const older = hist.filter((h) => typeof h.score === 'number' && (h.nifty_date ?? h.date) < session).sort((a, b) => ((a.nifty_date ?? a.date) < (b.nifty_date ?? b.date) ? 1 : -1))[0];
      return older ? { score: Math.round(older.score), date: older.nifty_date ?? older.date, drawdownPct: older.drawdown_pct ?? null, above200Pct: older.above_200dma_pct ?? null, vix: older.vix ?? null } : null;
    };
    const nifty = quotes.data?.quotes.find((q) => q.id === 'nifty');
    const vix = quotes.data?.quotes.find((q) => q.id === 'vix');
    const snap = live.snap, uni = live.universe;
    if (snap && uni && day?.source === 'live' && nifty?.price && nifty.at && istDate(nifty.at) === snap.session && (!t?.nifty_date || snap.session > t.nifty_date)) {
      let above = 0, highs = 0;
      for (const row of uni.rows) {
        const [sym, , , sma200, high52] = row;
        const px = snap.price[sym];
        if (typeof snap.pct[sym] !== 'number' || typeof px !== 'number') continue;   // stale or unpriced: not counted, as in `day`
        if (typeof sma200 === 'number' && px > sma200) above++;
        if (typeof high52 === 'number' && px >= high52) highs++;
      }
      const hi = typeof nifty.hi52 === 'number' ? Math.max(nifty.hi52, nifty.price) : null;
      const lo = typeof nifty.lo52 === 'number' ? Math.min(nifty.lo52, nifty.price) : null;
      const vixLive = vix?.price && vix.at && istDate(vix.at) === snap.session ? vix.price : null;
      const reading = computeBarometer(nifty.price, hi, lo, { counted: day.counted, above200: above, up: day.up, at52wHigh: highs }, vixLive);
      if (reading) return { reading, source: 'live', session: snap.session, at: nifty.at, previous: prevOf(snap.session) };
    }
    if (!t || typeof t.score !== 'number') return null;
    const reading: Reading = {
      score: Math.round(t.score), band: { k: t.band.k as Reading['band']['k'], t: t.band.t, c: (t.band.c as Reading['band']['c']) ?? '' },
      stage: t.stage ? { k: t.stage.k as NonNullable<Reading['stage']>['k'], t: t.stage.t, c: (t.stage.c as '' | 'up') ?? '' } : null,
      // the published reading's own factors, so the page can say what drives the score (H02)
      parts: (t.parts ?? []).map((p) => ({ key: p.key as Reading['parts'][number]['key'], label: p.label, score: p.score, weight: p.weight, detail: p.detail })),
      coverage: { parts: t.parts?.length ?? 0, partsTotal: 5, weightUsed: (t.parts ?? []).reduce((x, p) => x + p.weight, 0), weightTotal: 100, missing: [], complete: (t.parts ?? []).reduce((x, p) => x + p.weight, 0) === 100 },
      counted: 0, nifty: t.nifty ?? null, drawdownPct: t.drawdown_pct ?? null, above200Pct: t.above_200dma_pct ?? null, vix: t.vix ?? null,
    };
    return { reading, source: 'published', session: t.nifty_date, at: null, previous: prevOf(t.nifty_date) };
  }, [bar.data, quotes.data, day, live.snap, live.universe]);
  return { view, loading: bar.loading && quotes.loading, error: bar.error };
}
