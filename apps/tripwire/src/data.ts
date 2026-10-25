import { useEffect, useState } from 'react';
import type { Row } from './screen.ts';

export interface ScreenFeed { built_on: string; as_of: string; count: number; rows: Row[] }
export interface Gate { date: string; on: boolean; passed: number; checks: { rule: string; ok: boolean; value?: string }[] }
export interface SignalsFeed { schema: string; generated: string; data_through: string; launched: string; gate: Gate; alertable: boolean; alert_why: string; record: { closed: number; avg_r: number | null }; signals: unknown[]; cost_round_trip_pct?: number; rules?: { gate?: string[] } }
export interface Year { fy: string; end?: string; rev_cr?: number | null; ebit_cr?: number | null; pat_cr?: number | null; eps?: number | null; roce?: number | null; roe?: number | null; ebit_margin?: number | null; de?: number | null; cfo_cr?: number | null }
export interface Flag { s: string; t: string; k: string }
export interface Company { sym: string; built_on: string; row: Row & { risk_top?: string }; years: Year[]; swot: { s: { t: string; k: string }[]; w: { t: string; k: string }[]; o: { t: string; k: string }[]; t: { t: string; k: string }[] } | null; risk: { level: string; score: number; flags: Flag[] } | null }
export interface V3Feed { generated: string; data_watermark: string; alerts_enabled: boolean; engines: Record<string, { state: string; why?: string; version?: string }>; forming: { engine: string; symbol: string; as_of: string; met: string; missing: string }[]; paper: { id: string; engine: string; symbol: string; as_of: string; entry_rule?: string; invalidation?: number; initial_risk_pct?: number }[]; validated: unknown[]; closed: { id: string; engine: string; symbol: string; r_net: number | null; exit_reason: string | null; exit_date: string | null }[]; health?: { status: string; days_behind: number | null } }

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
export const useEnginesV3 = () => useJson<V3Feed>('/data/engines_v3.json');
export const useCompany = (sym: string) => useJson<Company>(`/data/c/${encodeURIComponent(sym)}.json`);
