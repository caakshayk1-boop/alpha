'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useDay, useSummary } from '@/lib/data';
import { dateLabel } from '@/lib/format';
import type { DayFigures, LiveSnap } from '@/lib/live';

const IST_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
/** "14:02" in IST for an epoch-seconds timestamp. */
export const istTime = (epochS: number) => IST_TIME.format(new Date(epochS * 1000));

export type TodayData = ReturnType<typeof useDay> & {
  /** the end-of-day screen's session (YYYY-MM-DD): /api/summary, else universe.json; null while neither has answered */
  screenAsOf: string | null;
  summaryError: string | null;
};

const Ctx = createContext<TodayData | null>(null);

/** One live poller for the whole Today page: useLive() fetches /api/live on its own timer per caller, so the hero, sector
 *  bars, movers and watchlist read one shared copy instead of starting four. */
export function TodayProvider({ children }: { children: ReactNode }) {
  const { day, live, loading } = useDay();
  const sum = useSummary();
  const value = useMemo(() => ({ day, live, loading, screenAsOf: sum.data?.as_of ?? live.universe?.as_of ?? null, summaryError: sum.error }), [day, live, loading, sum.data, sum.error]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The shared copy, or null outside a TodayProvider (the Brief page, which loads its own). */
export const useToday = (): TodayData | null => useContext(Ctx);

/** The exact label for the day's figures: "Live · 14:02 IST" (time of the newest trade) or "15 Oct 2026 close". */
export function dayLabel(day: DayFigures | null, snap: LiveSnap | null): string | null {
  if (!day) return null;
  if (day.source === 'live' && snap) return `Live · ${istTime(snap.newest)} IST`;
  return `${dateLabel(day.session)} close`;
}

/** The same label for anything read straight off the live snapshot (movers, watchlist): live only when the snapshot is a newer
 *  session than the end-of-day screen; otherwise the snapshot simply restates that session's close. With the screen's date
 *  unknown, it states the time and date of the prices and claims neither. */
export function snapLabel(snap: LiveSnap, screenAsOf: string | null): { live: boolean; text: string } {
  if (!screenAsOf) return { live: false, text: `Prices ${istTime(snap.newest)} IST, ${dateLabel(snap.session)}` };
  const live = snap.session > screenAsOf;
  return { live, text: live ? `Live · ${istTime(snap.newest)} IST` : `${dateLabel(snap.session)} close` };
}
