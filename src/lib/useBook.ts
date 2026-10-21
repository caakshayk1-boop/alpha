'use client';
/** The engines' trades marked to the latest price, shared by the Trades page and the Today card, so both show the same numbers.
 *  The rules live in lib/positions.ts (marking) and lib/trades.ts (day R, decisions); this only wires the live prices in. */
import { useMemo } from 'react';
import { useEngines, useLive, usePx } from './data';
import { istDate } from './live';
import { markSignal, noSessionDays, summarise } from './positions';
import { dayR, decide, groupDecisions } from './trades';

export function useBook() {
  const q = useEngines();
  const feed = q.data;
  const lv = useLive();
  const active = useMemo(() => (feed?.signals ?? []).filter((s) => s.status === 'open' || s.status === 'pending'), [feed]);
  const px = usePx(active.map((s) => s.sym));
  const rows = useMemo(() => {
    if (!feed) return [];
    const noSession = noSessionDays(lv.snap?.session, lv.snap ? Date.parse(lv.snap.fetchedAt) / 1000 : null);
    return feed.signals.map((s) => {
      const quote = px.quotes[s.sym];
      const { pos } = markSignal(s, feed.data_through, lv.snap, quote, noSession);
      // the close before the session the mark describes: the stock's own quote when it is of that session, else the snapshot
      let prev: number | null = null;
      if (quote?.at && istDate(quote.at) === pos.session) prev = quote.prev;
      else if (lv.snap && lv.snap.session === pos.session && typeof lv.snap.pct[s.sym] === 'number') prev = lv.snap.price[s.sym] / (1 + lv.snap.pct[s.sym] / 100);
      const today = s.status === 'open' ? dayR(s, pos, prev) : null;
      const enteredToday = !!s.entry_date && !!pos.session && s.entry_date >= pos.session;
      const todayPct = s.status === 'open' && prev && pos.price !== null ? (enteredToday ? (pos.price / (s.entry ?? pos.price) - 1) * 100 : (pos.price / prev - 1) * 100) : null;
      return { s, pos, today, todayPct, decision: decide(s, pos, feed.data_through) };
    });
  }, [feed, lv.snap, px.quotes]);
  return useMemo(() => {
    const open = rows.filter((r) => r.s.status === 'open');
    const pending = rows.filter((r) => r.s.status === 'pending');
    const book = summarise(open.map((r) => r.pos));
    const todayR = open.reduce((a, r) => a + (r.today ?? 0), 0);
    const todayN = open.filter((r) => r.today !== null).length;
    return { q, feed, lv, px, active, rows, open, pending, book, todayR, todayN, groups: groupDecisions(rows.map((r) => r.decision)) };
  }, [q, feed, lv, px, active, rows]);
}
