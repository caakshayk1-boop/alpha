/** Live prices for whatever is on screen. A row, a card or a header says which symbols it shows (`useWatchQuotes`) and reads one back
 *  (`useQuote`); one poller asks the Worker for the union, 25 names a call, once a minute while the page is visible. The published screen is
 *  a closing snapshot, so without this a list reads yesterday's price beside today's market. */
import { useEffect, useSyncExternalStore } from 'react';
import type { Quote, QuotesFeed } from './data.ts';
import type { Row } from './screen.ts';

const store = new Map<string, Quote>(); const want = new Map<string, number>(); const subs = new Set<() => void>();
let version = 0; let timer: number | undefined; let busy = false; let last = 0;
const CHUNK = 25, EVERY = 60000, CAP = 150;
const emit = () => { version++; subs.forEach((f) => f()); };

export const stats = { lastAt: 0, err: null as string | null };
async function pull() {
  if (busy || !want.size || document.visibilityState === 'hidden') return;
  busy = true;
  try {
    const syms = [...want.keys()].slice(0, CAP); const chunks: string[][] = [];
    for (let i = 0; i < syms.length; i += CHUNK) chunks.push(syms.slice(i, i + CHUNK));
    const got = await Promise.all(chunks.map(async (c) => { try { const r = await fetch(`/api/intraday?s=${encodeURIComponent(c.join(','))}`, { signal: AbortSignal.timeout(20000) }); const d = (await r.json()) as QuotesFeed; return r.ok && d.ok ? d.quotes : null; } catch { return null; } }));
    let any = false; for (const q of got) if (q) { any = true; for (const [k, v] of Object.entries(q)) store.set(k, v); }
    stats.err = any ? null : 'the price service did not answer'; if (any) stats.lastAt = Date.now(); last = Date.now(); emit();
  } finally { busy = false; }
}
function schedule() {
  if (timer !== undefined || !want.size) return;
  timer = window.setInterval(() => { if (!want.size) { window.clearInterval(timer); timer = undefined; return; } void pull(); }, EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && want.size && Date.now() - last > 20000) void pull(); });
}

/** Ask for live prices for these symbols while the calling component is on screen. */
export function useWatchQuotes(syms: readonly string[]) {
  const key = [...new Set(syms)].sort().join(',');
  useEffect(() => {
    const list = key ? key.split(',') : []; if (!list.length) return;
    for (const s of list) want.set(s, (want.get(s) ?? 0) + 1);
    schedule(); const fresh = list.some((s) => !store.has(s)); if (fresh || Date.now() - last > EVERY) void pull();
    return () => { for (const s of list) { const n = (want.get(s) ?? 1) - 1; if (n <= 0) want.delete(s); else want.set(s, n); } };
  }, [key]);
}
export function useQuote(sym: string | undefined): Quote | null {
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => version, () => 0);
  return sym ? store.get(sym) ?? null : null;
}

/** Several quotes at once (a comparison's columns), read without a hook per symbol. */
export function useQuotes(syms: readonly string[]): Record<string, Quote | null> {
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => version, () => 0);
  return Object.fromEntries(syms.map((s) => [s, store.get(s) ?? null]));
}

export interface LivePx { px: number | null; prev: number | null; ch: number | null; live: boolean; t: number | null; fromQuote: boolean }
const istDay = (sec: number) => new Date((sec + 19800) * 1000).toISOString().slice(0, 10);
/** Pure. The quote replaces the published close only when it is from the same Indian day or later; an older quote is ignored, never blended. */
export function livePrice(row: Pick<Row, 'price' | 'r1d' | 'last_date'>, q: Quote | null): LivePx {
  if (q && q.px > 0 && q.prev > 0 && (!row.last_date || istDay(q.pt) >= row.last_date.slice(0, 10))) return { px: q.px, prev: q.prev, ch: (q.px / q.prev - 1) * 100, live: q.live, t: q.pt, fromQuote: true };
  return { px: row.price ?? null, prev: null, ch: row.r1d ?? null, live: false, t: null, fromQuote: false };
}
export const useLivePrice = (row: Pick<Row, 'sym' | 'price' | 'r1d' | 'last_date'>): LivePx => livePrice(row, useQuote(row.sym));
/** "as of 14:32" in Indian time, for a tooltip or a small caption. */
export const asOfTime = (sec: number | null) => (sec ? new Date((sec + 19800) * 1000).toISOString().slice(11, 16) : '');
