/** One live feed for everything on screen. Whatever a screen shows (a list of names, the paper books, the indices, gold and the rest) it
 *  registers here; ONE request every 8 seconds asks the Worker for the union, and every figure reads its quote back. Without this each list
 *  polled for itself and the published screen, a closing snapshot, showed yesterday's price beside today's market.
 *  Cadence: 8 s while something is printing, 45 s when nothing is (a closed market), and a refresh the moment the page becomes visible again. */
import { useEffect, useSyncExternalStore } from 'react';
import type { Quote, QuotesFeed } from './data.ts';
import type { Row } from './screen.ts';
import { isLiveQuote } from './stamp.ts';

const store = new Map<string, Quote>(); let pulse: Record<string, Quote> = {}; let macro: Record<string, Quote> = {};
const want = new Map<string, number>(); let wantI = 0, wantM = 0; const subs = new Set<() => void>();
let version = 0, timer: number | undefined, busy = false, lastAt = 0, errMsg: string | null = null, okN = 0, started = false;
const PER_CALL = 40, CAP = 160, FAST = 8000, SLOW = 45000;
const emit = () => { version++; subs.forEach((f) => f()); };

async function tick() {
  if (busy || document.visibilityState === 'hidden' || (!want.size && !wantI && !wantM)) return;
  busy = true;
  try {
    const syms = [...want.keys()].slice(0, CAP); const calls: { s: string[]; i: boolean; m: boolean }[] = [];
    for (let k = 0; k < Math.max(1, Math.ceil(syms.length / PER_CALL)); k++) calls.push({ s: syms.slice(k * PER_CALL, (k + 1) * PER_CALL), i: k === 0 && wantI > 0, m: k === 0 && wantM > 0 });
    const got = await Promise.all(calls.map(async (c) => {
      if (!c.s.length && !c.i && !c.m) return null;
      try { const r = await fetch(`/api/tick?s=${encodeURIComponent(c.s.join(','))}${c.i ? '&i=1' : ''}${c.m ? '&m=1' : ''}`, { signal: AbortSignal.timeout(15000) }); const d = await r.json(); return r.ok && d.ok ? d : null; } catch { return null; }
    }));
    let any = false;
    for (const d of got) if (d) { any = true; for (const [k, v] of Object.entries(d.quotes ?? {})) store.set(k, v as Quote); if (d.pulse) pulse = { ...pulse, ...d.pulse }; if (d.macro) macro = { ...macro, ...d.macro }; }
    if (any) { lastAt = Date.now(); errMsg = null; okN++; } else errMsg = 'the price service did not answer';
    emit();
  } finally { busy = false; schedule(); }
}
const anyLive = () => [...store.values(), ...Object.values(pulse), ...Object.values(macro)].some((q) => isLiveQuote(q));
function schedule() {
  window.clearTimeout(timer); timer = undefined; if (!want.size && !wantI && !wantM) return;
  timer = window.setTimeout(() => { void tick(); }, anyLive() || !lastAt ? FAST : SLOW);
}
function kick() { window.setTimeout(() => { if (!busy) void tick(); }, 60); }
function start() {
  if (started) return; started = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (want.size || wantI || wantM) && Date.now() - lastAt > 3000) void tick(); });
}
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const snap = () => version;

/** Ask for live prices for these symbols while the calling component is on screen. */
export function useWatchQuotes(syms: readonly string[]) {
  const key = [...new Set(syms)].sort().join(',');
  useEffect(() => {
    const list = key ? key.split(',') : []; if (!list.length) return; start();
    for (const s of list) want.set(s, (want.get(s) ?? 0) + 1);
    if (list.some((s) => !store.has(s)) || Date.now() - lastAt > FAST) kick(); else schedule();
    return () => { for (const s of list) { const n = (want.get(s) ?? 1) - 1; if (n <= 0) want.delete(s); else want.set(s, n); } };
  }, [key]);
}
function useWatchFlag(on: boolean, kind: 'i' | 'm') {
  useEffect(() => {
    if (!on) return; start(); if (kind === 'i') wantI++; else wantM++; kick();
    return () => { if (kind === 'i') wantI--; else wantM--; };
  }, [on, kind]);
}
export function useQuote(sym: string | undefined): Quote | null { useSyncExternalStore(sub, snap, () => 0); return sym ? store.get(sym) ?? null : null; }
export function useQuotes(syms: readonly string[]): Record<string, Quote | null> { useSyncExternalStore(sub, snap, () => 0); return Object.fromEntries(syms.map((s) => [s, store.get(s) ?? null])); }

/** `at` is when the app last HEARD from the Worker; `obs` is when the exchange last PRINTED (newest quote timestamp, epoch seconds). Freshness is read from `obs`, never `at`. */
export interface FeedState { data: QuotesFeed | null; err: string | null; at: number | null; obs: number | null; loading: boolean; tick: number }
let memo: { v: number; key: string; val: FeedState } | null = null;
function feedOf(kind: 'i' | 'm' | 's', syms: string[]): FeedState {
  const key = kind + syms.join(','); if (memo && memo.v === version && memo.key === key) return memo.val;
  const src = kind === 'i' ? pulse : kind === 'm' ? macro : Object.fromEntries(syms.filter((s) => store.has(s)).map((s) => [s, store.get(s)!]));
  const has = Object.keys(src).length > 0;
  const obs = has ? Math.max(...Object.values(src).map((q) => q.pt)) : null;
  const val: FeedState = { data: has ? { ok: true, fetched_at: new Date(lastAt).toISOString(), quotes: src, missing: [] } : null, err: errMsg, at: has ? lastAt : null, obs, loading: !has && !errMsg, tick: okN };
  memo = { v: version, key, val }; return val;
}
/** Nifty, Bank Nifty and the VIX. */
export function useLivePulse(on = true): FeedState { useWatchFlag(on, 'i'); useSyncExternalStore(sub, snap, () => 0); return feedOf('i', []); }
/** Gold, silver, oil, the currency pairs and Bitcoin. */
export function useLiveMacro(on = true): FeedState { useWatchFlag(on, 'm'); useSyncExternalStore(sub, snap, () => 0); return feedOf('m', []); }
/** Live quotes for named symbols, in the shape the paper books read. */
export function useLiveSymbols(syms: string[], on = true): FeedState { useWatchQuotes(on ? syms : []); useSyncExternalStore(sub, snap, () => 0); return feedOf('s', on ? [...syms].sort() : []); }
export const liveStatus = () => ({ lastAt, err: errMsg });

export interface LivePx { px: number | null; prev: number | null; ch: number | null; live: boolean; t: number | null; fromQuote: boolean }
const istDay = (sec: number) => new Date((sec + 19800) * 1000).toISOString().slice(0, 10);
/** Pure. The quote replaces the published close only when it is from the same Indian day or later; an older quote is ignored, never blended. */
export function livePrice(row: Pick<Row, 'price' | 'r1d' | 'last_date'>, q: Quote | null, nowMs = Date.now()): LivePx {
  if (q && q.px > 0 && q.prev > 0 && (!row.last_date || istDay(q.pt) >= row.last_date.slice(0, 10))) return { px: q.px, prev: q.prev, ch: (q.px / q.prev - 1) * 100, live: isLiveQuote(q, nowMs), t: q.pt, fromQuote: true };
  return { px: row.price ?? null, prev: null, ch: row.r1d ?? null, live: false, t: null, fromQuote: false };
}
export const useLivePrice = (row: Pick<Row, 'sym' | 'price' | 'r1d' | 'last_date'>): LivePx => livePrice(row, useQuote(row.sym));
/** "as of 14:32" in Indian time, for a tooltip or a small caption. */
export const asOfTime = (sec: number | null) => (sec ? new Date((sec + 19800) * 1000).toISOString().slice(11, 16) : '');
