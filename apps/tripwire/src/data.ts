import { useEffect, useState } from 'react';
import type { Row } from './screen.ts';

export interface ScreenFeed { built_on: string; as_of: string; count: number; rows: Row[] }
export interface Gate { date: string; on: boolean; passed: number; checks: { rule: string; ok: boolean; value?: string }[] }
export interface SignalsFeed { schema: string; generated: string; data_through: string; launched: string; gate: Gate; alertable: boolean; alert_why: string; record: { closed: number; avg_r: number | null }; signals: unknown[]; cost_round_trip_pct?: number; rules?: { gate?: string[] } }
export interface Year { fy: string; end?: string; rev_cr?: number | null; ebit_cr?: number | null; pat_cr?: number | null; eps?: number | null; roce?: number | null; roe?: number | null; ebit_margin?: number | null; de?: number | null; cfo_cr?: number | null }
export interface Flag { s: string; t: string; k: string }
export interface Company { sym: string; built_on: string; row: Row & { risk_top?: string }; years: Year[]; swot: { s: { t: string; k: string }[]; w: { t: string; k: string }[]; o: { t: string; k: string }[]; t: { t: string; k: string }[] } | null; risk: { level: string; score: number; flags: Flag[] } | null }

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
export const useScreen = () => useJson<ScreenFeed>('/data/screen.json');
export const useSignals = () => useJson<SignalsFeed>('/data/signals.json');
export const useCompany = (sym: string) => useJson<Company>(`/data/c/${encodeURIComponent(sym)}.json`);

export interface BarsFeed { ok: boolean; fetched_at: string; bars: Record<string, { t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; forming: boolean; live: { px: number; t: number } | null }>; missing: string[] }
/** Daily bars and a delayed live price for the symbols with a paper trade. Refreshes every 60 seconds while the page is visible. */
export function useBars(syms: string[], on: boolean): { data: BarsFeed | null; err: string | null; at: number | null; loading: boolean } {
  const key = [...new Set(syms)].sort().join(',');
  const [st, set] = useState<{ data: BarsFeed | null; err: string | null; at: number | null; loading: boolean }>({ data: null, err: null, at: null, loading: false });
  useEffect(() => {
    if (!on || !key) { set({ data: null, err: null, at: null, loading: false }); return; }
    let live = true; let timer: number | undefined;
    const load = async () => {
      if (document.visibilityState === 'hidden') { timer = window.setTimeout(load, 60000); return; }
      set((s) => ({ ...s, loading: true }));
      try {
        const r = await fetch(`/api/bars?s=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20000) });
        const d = (await r.json()) as BarsFeed;
        if (!live) return; if (!r.ok || !d.ok) throw new Error(r.status === 404 ? 'the price service is not available here' : 'no bars returned');
        set({ data: d, err: null, at: Date.now(), loading: false });
      } catch (e) { if (live) set((s) => ({ data: s.data, err: (e as Error).message || 'unreachable', at: s.at, loading: false })); }
      if (live) timer = window.setTimeout(load, 60000);
    };
    void load();
    return () => { live = false; window.clearTimeout(timer); };
  }, [key, on]);
  return st;
}

export interface ChartFeed { ok: boolean; sym: string; t: number[]; c: number[]; n?: (number | null)[] | null }
/** Every daily close Yahoo holds for a symbol, fetched once; the ranges and the monthly view are cut from it in the browser. */
export const useChart = (sym: string) => useJson<ChartFeed>(`/api/chart?s=${encodeURIComponent(sym)}`);

export interface LedgerFeed { ok: boolean; ledger: import('./ledger.ts').Ledger }
export const useLedger = () => useJson<LedgerFeed>('/api/ledger');
