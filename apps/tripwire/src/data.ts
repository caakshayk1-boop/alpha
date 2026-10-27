import { useEffect, useMemo, useState } from 'react';
import type { Row } from './screen.ts';
import { useLiveMacro, useLivePulse, useLiveSymbols } from './quotes.ts';
import { nseClockOpen } from './stamp.ts';
export { useLiveMacro };

export interface ScreenFeed { built_on: string; as_of: string; count: number; rows: Row[] }
export interface Gate { date: string; on: boolean; passed: number; checks: { rule: string; ok: boolean; value?: string }[] }
export interface SignalsFeed { schema: string; generated: string; data_through: string; launched: string; gate: Gate; alertable: boolean; alert_why: string; record: { closed: number; avg_r: number | null }; signals: unknown[]; cost_round_trip_pct?: number; rules?: { gate?: string[] } }
export interface Year { fy: string; end?: string; rev_cr?: number | null; ebit_cr?: number | null; pat_cr?: number | null; eps?: number | null; roce?: number | null; roe?: number | null; ebit_margin?: number | null; de?: number | null; cfo_cr?: number | null; cfo_pat?: number | null; fcf_cr?: number | null }
export interface Flag { s: string; t: string; k: string }
export interface Inst { quality: string; reason?: string | null; insti?: number; fii?: number; dii?: number; mf?: number; insurance?: number; promoter?: number; publicHold?: number; fii_pp?: number; dii_pp?: number; insti_pp?: number; fii_streak?: number; dii_streak?: number; signal?: string; signal_label?: string; period?: string; prev_period?: string; quarters?: number; series?: { p: string; f: number; d: number }[] }
export interface Season { m: [number, number, number][]; y: number }
export interface Company { sym: string; built_on: string; row: Row & { risk_top?: string }; inst?: Inst | null; season?: Season | null; years: Year[]; swot: { s: { t: string; k: string }[]; w: { t: string; k: string }[]; o: { t: string; k: string }[]; t: { t: string; k: string }[] } | null; risk: { level: string; score: number; flags: Flag[] } | null }

const memo = new Map<string, Promise<unknown>>();
export function getJson<T>(url: string, timeout = 20000): Promise<T> {
  const hit = memo.get(url) as Promise<T> | undefined; if (hit) return hit;
  const p = (async () => {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), timeout);
    try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error(r.status === 404 ? 'not published' : `HTTP ${r.status}`); return (await r.json()) as T; }
    finally { clearTimeout(t); }
  })();
  memo.set(url, p); p.catch(() => memo.delete(url));
  return p;
}
export interface Loaded<T> { data: T | null; err: string | null; loading: boolean; retry: () => void }
export function useJson<T>(url: string | null): Loaded<T> {
  const [st, set] = useState<{ data: T | null; err: string | null; loading: boolean }>({ data: null, err: null, loading: !!url });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!url) { set({ data: null, err: null, loading: false }); return; }
    let live = true; set((s) => ({ ...s, loading: true, err: null }));
    getJson<T>(url).then((d) => live && set({ data: d, err: null, loading: false })).catch((e: Error) => live && set({ data: null, err: e.message === 'The operation was aborted.' || e.name === 'AbortError' ? 'timed out' : e.message, loading: false }));
    return () => { live = false; };
  }, [url, n]);
  return { ...st, retry: () => { if (url) memo.delete(url); setN((x) => x + 1); } };
}
export interface RsiSheet { ok: boolean; schema: string; as_of: string; order: string[]; rows: Record<string, (number | null)[]> }
/** The published screen, with weekly and monthly RSI joined on from the nightly sheet when it is there. Without the sheet the screen is exactly what it was, and those two figures are simply absent (never zero). */
export function useScreen(): Loaded<ScreenFeed> {
  const s = useJson<ScreenFeed>('/data/screen.json'); const r = useJson<RsiSheet>('/api/rsi');
  const data = useMemo(() => {
    if (!s.data || !r.data?.ok || !r.data.rows) return s.data; const w = r.data.order.indexOf('weekly'), m = r.data.order.indexOf('monthly'); const rows = r.data.rows;
    return { ...s.data, rows: s.data.rows.map((x) => { const v = rows[x.sym]; return v ? { ...x, rsi_w: w >= 0 ? v[w] ?? null : null, rsi_m: m >= 0 ? v[m] ?? null : null } : x; }) };
  }, [s.data, r.data]);
  return { ...s, data };
}
export const useSignals = () => useJson<SignalsFeed>('/data/signals.json');
export const useCompany = (sym: string) => useJson<Company>(`/data/c/${encodeURIComponent(sym)}.json`);

export interface BarsFeed { ok: boolean; fetched_at: string; bars: Record<string, { t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; forming: boolean; live: { px: number; t: number } | null }>; missing: string[] }
/** Daily bars and a delayed live price for the symbols with a paper trade. Refreshes every 60 seconds while the page is visible. */
export function useBars(syms: string[], on: boolean): { data: BarsFeed | null; err: string | null; at: number | null; loading: boolean } {
  const key = [...new Set(syms)].sort().join(',');
  const [st, set] = useState<{ data: BarsFeed | null; err: string | null; at: number | null; loading: boolean }>({ data: null, err: null, at: null, loading: false });
  useEffect(() => {
    if (!on || !key) { set({ data: null, err: null, at: null, loading: false }); return; }
    let live = true; let timer: number | undefined; let got = false;
    const load = async () => {
      if (document.visibilityState === 'hidden') { timer = window.setTimeout(load, 60000); return; }
      set((s) => ({ ...s, loading: true }));
      try {
        const r = await fetch(`/api/bars?s=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20000) });
        const d = (await r.json()) as BarsFeed;
        if (!live) return; if (!r.ok || !d.ok) throw new Error(r.status === 404 ? 'the price service is not available here' : 'no bars returned');
        set({ data: d, err: null, at: Date.now(), loading: false }); got = true;
      } catch (e) { if (live) set((s) => ({ data: s.data, err: (e as Error).message || 'unreachable', at: s.at, loading: false })); }
      if (live) timer = window.setTimeout(wake, 60000);
    };
    // with the exchange shut the daily bars cannot change: after one good load, wake once a minute to look at the clock and fetch nothing until it opens
    const wake = () => { if (!live) return; if (got && !nseClockOpen(Date.now())) { timer = window.setTimeout(wake, 60000); return; } void load(); };
    void load();
    return () => { live = false; window.clearTimeout(timer); };
  }, [key, on]);
  return st;
}

export interface ChartFeed { ok: boolean; sym: string; t: number[]; c: number[]; n?: (number | null)[] | null; /** open, high, low and volume of each day, null where Yahoo did not print one (never the close in its place) */ o?: (number | null)[] | null; h?: (number | null)[] | null; l?: (number | null)[] | null; v?: (number | null)[] | null }
/** Every daily close Yahoo holds for a symbol, fetched once; the ranges and the monthly view are cut from it in the browser. */
export const useChart = (sym: string) => useJson<ChartFeed>(`/api/chart?s=${encodeURIComponent(sym)}`);

export interface LedgerFeed { ok: boolean; ledger: import('./ledger.ts').Ledger }
export const useLedger = () => useJson<LedgerFeed>('/api/ledger');

export interface Quote { t: number[]; c: number[]; px: number; pt: number; prev: number; live: boolean }
export interface QuotesFeed { ok: boolean; fetched_at: string; quotes: Record<string, Quote>; missing: string[] }
export interface FactorSheet { ok: boolean; schema: string; as_of: string; universe: number; rows: Record<string, Record<string, number>>; study?: Record<string, { adopt: boolean; kind: string }> }
export const useFactors = () => useJson<FactorSheet>('/api/factors');

/** A polled feed: loads now, then every `every` ms while the page is visible, keeps the last good answer, and says when it was fetched. */
export function usePoll<T extends { ok: boolean }>(url: string | null, every: number, nseOnly = false): { data: T | null; err: string | null; at: number | null; loading: boolean; tick: number } {
  const [st, set] = useState<{ data: T | null; err: string | null; at: number | null; loading: boolean; tick: number }>({ data: null, err: null, at: null, loading: false, tick: 0 });
  useEffect(() => {
    if (!url) { set({ data: null, err: null, at: null, loading: false, tick: 0 }); return; }
    let live = true; let timer: number | undefined; let got = false;
    // an NSE-only feed is not asked again while the market is shut: the clock is looked at once a minute (no request), and the feed resumes when it opens
    const idle = () => nseOnly && !nseClockOpen(Date.now());
    const next = () => { if (!live) return; const waiting = idle(); timer = window.setTimeout(() => { if (waiting && idle()) next(); else void load(); }, waiting ? 60000 : every); };
    const load = async () => {
      if (document.visibilityState === 'hidden') { timer = window.setTimeout(load, every); return; }
      set((s) => ({ ...s, loading: true }));
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); const d = (await r.json()) as T;
        if (!live) return; if (!r.ok || !d.ok) throw new Error(r.status === 404 ? 'the price service is not available here' : 'no prices returned');
        got = true; set((s) => ({ data: d, err: null, at: Date.now(), loading: false, tick: s.tick + 1 }));
      } catch (e) { if (live) set((s) => ({ ...s, err: (e as Error).message || 'unreachable', loading: false })); }
      next();
    };
    void load();
    const vis = () => { if (document.visibilityState === 'visible' && live && !(got && idle())) { window.clearTimeout(timer); void load(); } };
    document.addEventListener('visibilitychange', vis);
    return () => { live = false; window.clearTimeout(timer); document.removeEventListener('visibilitychange', vis); };
  }, [url, every]);
  return st;
}
/** Five-minute prices and the delayed live price for symbols (the paper book). */
export const useIntraday = (syms: string[], on: boolean) => useLiveSymbols([...new Set(syms)], on);
/** Nifty 50, Bank Nifty and India VIX. */
export const usePulse = (on: boolean) => useLivePulse(on);

/** The back-test, with the walk-forward test attached when it has been published (it is optional: its absence changes the wording, never the state). */
export function useBacktest() {
  const a = useJson<import('./evidence.ts').Backtest>('/data/research/engines_backtest.json'); const w = useJson<{ walk_forward: import('./evidence.ts').WalkForward }>('/data/research/engines_walkforward.json');
  const data = useMemo(() => (a.data ? { ...a.data, walk_forward: w.data?.walk_forward ?? null } : null), [a.data, w.data]);
  return { ...a, data };
}
export const useStudy = () => useJson<import('./evidence.ts').Study>('/data/research/factor_study.json');

export interface BreadthFeed { ok: boolean; t: number; as_of: string; n: number; up: number; mixed: number; down: number; sectors: { k: string; n: number; up: number; down: number }[]; repriced: number; near: number }
/** The trend map with today's prices: the Worker re-prices only the names close enough to a trend line to change class, and shares the answer for 60 s. */
export const useBreadth = (on = true) => usePoll<BreadthFeed>(on ? '/api/breadth' : null, 60000, true);
