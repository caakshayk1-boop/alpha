import { useEffect, useMemo, useState } from 'react';
import { useAppState } from './app.tsx';
import { useBars, useIntraday, useLedger, useSignals, type Quote } from './data.ts';
import { evaluatePaper, summarize, type Bar, type Paper, type View } from './tracker.ts';
import { sessionNow, type Session } from './market.ts';
import { istDay } from './store.ts';
import { planAutoBook, realised, DEFAULT_CFG, type AutoPos } from './autobook.ts';
import type { Outcome } from './ledger.ts';

export const DEFAULT_COST = 0.25;
export function useCost(): number { const s = useSignals(); return s.data?.cost_round_trip_pct ?? DEFAULT_COST; }
const day = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);

export interface BookRow { p: Paper; v: View; q: Quote | null; dayPnl: number | null }
/** Papers with their live prices: bars decide the state of each trade, the five-minute feed gives the live mark, the previous close and the
 *  day's line. Day P&L is measured from the entry price on the day a trade was entered, and from the previous close after that. */
function useLivePapers(active: Paper[], on: boolean) {
  const cost = useCost();
  const [visible, setVisible] = useState(true);
  useEffect(() => { const f = () => setVisible(document.visibilityState === 'visible'); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  const syms = active.map((p) => p.sym);
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
  return { rows, sum, dayTotal, session, bars, intra, cost, anyLive };
}

/** The paper book the user took by hand. */
export function useLiveBook(on = true) {
  const s = useAppState();
  const active = useMemo(() => s.paper.filter((p) => !p.closedByUser), [s.paper]);
  return { ...useLivePapers(active, on), active, today: istDay() };
}

/** A closed or skipped position from the ledger's own finished outcome, shaped like a live one so the same card can show it. */
function viewFromOutcome(pos: AutoPos, o: Outcome): View {
  const t = (d?: string) => (d ? Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), 10, 0) / 1000 : undefined);
  if (o.status === 'skipped') return { id: pos.pick.id, status: 'skipped', sessions: 0, left: null, mark: null, markKind: null, pnl: null, r: null, pct: null, skipReason: o.skipReason };
  return { id: pos.pick.id, status: 'closed', entry: o.entry, entryT: t(o.entryDay), exit: o.exit, exitT: t(o.exitDay), reason: o.reason, sessions: o.sessions ?? 0, left: 0, mark: o.exit ?? null, markKind: 'close', pnl: realised(o, pos.qty), r: o.r ?? null, pct: o.pct ?? null };
}
const paperOf = (t: AutoPos): Paper => ({ id: t.pick.id, sym: t.pick.sym, engine: t.pick.engine, asOf: t.pick.asOf, ref: t.pick.ref, stop: t.pick.stop, horizon: t.pick.horizon, qty: t.qty, takenAt: t.takenAt });

/** The automatic paper book: the nightly record's picks, 30 at a time at most, ₹1,00,000 each at most. Positions the record has already
 *  finished come from it; every other one is followed live with the same tracker the manual book uses. */
export function useAutoBook(on = true) {
  const ledger = useLedger();
  const plan = useMemo(() => (ledger.data?.ledger ? planAutoBook(ledger.data.ledger, DEFAULT_CFG) : null), [ledger.data]);
  const outcomes = ledger.data?.ledger.outcomes;
  const liveSet = useMemo(() => (plan ? plan.taken.filter((t) => { const o = outcomes?.[t.pick.id]; return !(o && o.final); }) : []), [plan, outcomes]);
  const papers = useMemo(() => liveSet.map(paperOf), [liveSet]);
  const live = useLivePapers(papers, on);
  const done: BookRow[] = useMemo(() => (plan ? plan.taken.filter((t) => outcomes?.[t.pick.id]?.final).map((t) => ({ p: paperOf(t), v: viewFromOutcome(t, outcomes![t.pick.id]), q: null, dayPnl: null })) : []), [plan, outcomes]);
  const rows = useMemo(() => [...live.rows, ...done], [live.rows, done]);
  const sum = summarize(rows.map((r) => r.v));
  const slots = rows.filter((r) => r.v.status === 'open' || r.v.status === 'pending' || r.v.status === 'waiting').length;
  const deployed = rows.filter((r) => r.v.status === 'open').reduce((a, r) => a + (r.v.entry ?? r.p.ref) * r.p.qty, 0);
  return { ledger, plan, rows, sum, slots, deployed, dayTotal: live.dayTotal, session: live.session, intra: live.intra, bars: live.bars, cost: live.cost, anyLive: live.anyLive, cfg: DEFAULT_CFG };
}
