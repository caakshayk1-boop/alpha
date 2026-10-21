'use client';
/** The Swing v2 book marked to the latest price, shared by the Trades page, the Signals page and the Today card, so all three
 *  show the same numbers. The rules live in lib/plan.ts; this only wires the live prices in. */
import { useMemo } from 'react';
import { useLive, usePx, useSignals } from './data';
import { istDate } from './live';
import { dayR, decide, groupDecisions, mark, noSessionDays, priceFor, type Mark } from './plan';
import type { Sig } from './types';

const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export interface BookRow { s: Sig; m: Mark; today: number | null; todayPct: number | null }

export function useBook() {
  const q = useSignals();
  const feed = q.data;
  const lv = useLive();
  const active = useMemo(() => (feed?.signals ?? []).filter((s) => s.status === 'open' || s.status === 'pending'), [feed]);
  const px = usePx(active.map((s) => s.sym));
  const rows = useMemo<(BookRow & { decision: ReturnType<typeof decide> })[]>(() => {
    if (!feed) return [];
    const noSession = noSessionDays(lv.snap?.session, lv.snap ? Date.parse(lv.snap.fetchedAt) / 1000 : null);
    return feed.signals.map((s) => {
      const quote = px.quotes[s.sym];
      const m = mark(s, priceFor(s, lv.snap, quote), noSession);
      // the close before the session the mark describes: the stock's own quote when it is of that session, else the snapshot
      let prev: number | null = null;
      if (quote?.at && istDate(quote.at) === m.session) prev = quote.prev;
      else if (lv.snap && lv.snap.session === m.session && ok(lv.snap.pct[s.sym])) prev = lv.snap.price[s.sym] / (1 + lv.snap.pct[s.sym] / 100);
      const today = s.status === 'open' ? dayR(s, m, prev) : null;
      const enteredToday = !!s.entry_date && !!m.session && s.entry_date >= m.session;
      const todayPct = s.status === 'open' && prev && m.price !== null ? (enteredToday ? (m.price / m.entry - 1) * 100 : (m.price / prev - 1) * 100) : null;
      return { s, m, today, todayPct, decision: decide(s, m, feed.data_through) };
    });
  }, [feed, lv.snap, px.quotes]);
  return useMemo(() => {
    const open = rows.filter((r) => r.s.status === 'open');
    const pending = rows.filter((r) => r.s.status === 'pending');
    const marked = open.filter((r) => ok(r.m.r));
    const totalR = marked.reduce((a, r) => a + (r.m.r as number), 0);
    const todayR = open.reduce((a, r) => a + (r.today ?? 0), 0);
    const todayN = open.filter((r) => r.today !== null).length;
    const live = marked.filter((r) => r.m.live).length;
    const newestAt = marked.reduce((a, r) => Math.max(a, r.m.at ?? 0), 0) || null;
    const near = (k: 'stop' | 'next') => marked.filter((r) => (k === 'stop' ? r.m.state === 'stop-hit' || (r.m.toStop && -r.m.toStop.r <= 0.25) : r.m.state === 't1-hit' || r.m.state === 't2-hit' || (r.m.toNext && r.m.toNext.r <= 0.25))).length;
    return { q, feed, lv, px, active, rows, open, pending, totalR, avgR: marked.length ? totalR / marked.length : null, marked: marked.length, todayR, todayN, live, newestAt,
             nearStop: near('stop'), nearTarget: near('next'), groups: groupDecisions(rows.map((r) => r.decision)) };
  }, [q, feed, lv, px, active, rows]);
}
