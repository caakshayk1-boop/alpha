/** One-day values per stock under the rule in lib/live.ts (pickDay): when the day's source is live, a stock's "today" move
 *  and price are the live snapshot's, and a stock the snapshot does not cover shows nothing (never the older close, which
 *  would mix two sessions in one column). When the source is the close, they are the screen's own r1d and price.
 *  Pure functions only, no imports beyond types: tested in tests/lib.test.ts. */
import type { DayFigures, LiveSnap } from './live';

const IST_HM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const IST_WD = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

/** HH:MM in IST for an epoch-seconds timestamp. */
export const istHM = (epochS: number): string => IST_HM.format(new Date(epochS * 1000));
/** "Thu 15 Oct" for a YYYY-MM-DD session date (read as a calendar date, so no time zone can move it a day). */
export const sessionDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : IST_WD.format(d).replace(',', '');
};
/** "15 Oct 2026" for a YYYY-MM-DD date. */
export const sessionDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
};

export interface TodayView {
  live: boolean;
  /** IST session the one-day values describe (live) or the screen's as-of date (close) */
  session: string | null;
  /** HH:MM IST of the newest live trade; null on the close */
  at: string | null;
  /** short tag for a column header: "live 14:32" or "14 Oct 2026 close" */
  tag: string;
  /** where the values came from, for a CSV or a copied line: "live 2026-10-15 14:32 IST" or "close 2026-10-14" */
  asOf: string;
  pct: (sym: string, close: number | null | undefined) => number | null;
  price: (sym: string, close: number | null | undefined) => number | null;
}

const fin = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The view for a page. `screenAsOf` is the date of the screen rows the close values come from. */
export function todayView(day: DayFigures | null, snap: LiveSnap | null, screenAsOf: string | null): TodayView {
  if (day?.source === 'live' && snap) {
    const at = istHM(snap.newest);
    return {
      live: true, session: day.session, at, tag: `live ${at}`, asOf: `live ${day.session} ${at} IST`,
      pct: (sym) => fin(snap.pct[sym]),
      price: (sym) => fin(snap.price[sym]),
    };
  }
  return {
    live: false, session: screenAsOf, at: null, tag: `${sessionDate(screenAsOf)} close`, asOf: `close ${screenAsOf ?? 'unknown'}`,
    pct: (_sym, close) => fin(close),
    price: (_sym, close) => fin(close),
  };
}

/** Up, down and unchanged counts of a list of one-day moves; a missing value is not counted at all. */
export function tally(values: (number | null | undefined)[]): { up: number; down: number; flat: number; counted: number } {
  let up = 0, down = 0, flat = 0;
  for (const v of values) { if (typeof v !== 'number' || !Number.isFinite(v)) continue; if (v > 0) up++; else if (v < 0) down++; else flat++; }
  return { up, down, flat, counted: up + down + flat };
}

/** The n biggest rises and falls among items with a value. Ties break on the symbol, so the order is stable between refreshes. */
export function movers<T extends { sym: string; v: number | null }>(items: T[], n: number): { up: (T & { v: number })[]; down: (T & { v: number })[] } {
  const ok = items.filter((x): x is T & { v: number } => typeof x.v === 'number' && Number.isFinite(x.v));
  const up = ok.filter((x) => x.v > 0).sort((a, b) => b.v - a.v || a.sym.localeCompare(b.sym)).slice(0, n);
  const down = ok.filter((x) => x.v < 0).sort((a, b) => a.v - b.v || a.sym.localeCompare(b.sym)).slice(0, n);
  return { up, down };
}
