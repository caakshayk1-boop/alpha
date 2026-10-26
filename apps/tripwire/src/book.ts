import { useEffect, useMemo, useState } from 'react';
import { useAppState } from './app.tsx';
import { useBars, useIntraday, useSignals, type Quote } from './data.ts';
import { evaluatePaper, summarize, type Bar, type Paper, type View } from './tracker.ts';
import { sessionNow, type Session } from './market.ts';
import { istDay } from './store.ts';

export const DEFAULT_COST = 0.25;
export function useCost(): number { const s = useSignals(); return s.data?.cost_round_trip_pct ?? DEFAULT_COST; }
const day = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);

export interface BookRow { p: Paper; v: View; q: Quote | null; dayPnl: number | null }
/** The paper book with its live prices: bars decide the state of each trade, the five-minute feed gives the live mark, the previous close
 *  and the day's line. Day P&L is measured from the entry price on the day a trade was entered, and from the previous close after that. */
export function useLiveBook(on = true) {
  const s = useAppState(); const cost = useCost();
  const [visible, setVisible] = useState(true);
  useEffect(() => { const f = () => setVisible(document.visibilityState === 'visible'); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  const active = useMemo(() => s.paper.filter((p) => !p.closedByUser), [s.paper]); const syms = active.map((p) => p.sym);
  const bars = useBars(syms, on && visible); const intra = useIntraday(syms, on && visible);
  const rows: BookRow[] = useMemo(() => active.map((p) => {
    const b = bars.data?.bars[p.sym]; const q = intra.data?.quotes[p.sym] ?? null;
    const arr: Bar[] | null = b ? b.t.map((t, i) => ({ t, o: b.o[i], h: b.h[i], l: b.l[i], c: b.c[i], forming: b.forming && i === b.t.length - 1 })) : null;
    const live = q ? { px: q.px, t: q.pt } : b?.live ?? null;
    const v = evaluatePaper(p, arr, live, cost);
    let dayPnl: number | null = null;
    if (v.status === 'open' && q && v.mark != null && v.entryT != null) { const base = day(v.entryT) === day(q.pt) ? v.entry! : q.prev; dayPnl = Math.round((v.mark - base) * p.qty * 100) / 100; }
    return { p, v, q, dayPnl };
  }), [active, bars.data, intra.data, cost]);
  const anyLive = intra.data ? Object.values(intra.data.quotes).some((q) => q.live) : null;
  const session: Session = sessionNow(Date.now(), active.length ? anyLive : null);
  const sum = summarize(rows.map((r) => r.v));
  const dayTotal = rows.some((r) => r.dayPnl != null) ? rows.reduce((a, r) => a + (r.dayPnl ?? 0), 0) : null;
  return { rows, active, sum, dayTotal, session, bars, intra, cost, today: istDay(), anyLive };
}
