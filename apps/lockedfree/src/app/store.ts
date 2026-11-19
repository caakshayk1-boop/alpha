// The visitor's own book and plan live in THEIR browser. Every storage call is guarded: private windows and blocked storage must not break the page.
import { useEffect, useState, useCallback } from 'react';
import { emptyBook, type Book } from '../lib/gate.ts'; import type { Plan } from '../lib/plan.ts'; import { prevSession, isSession } from '../lib/calendar.ts';
export const BOOK_KEY = 'rulebook-book/1', PLAN_KEY = 'rulebook-plan/1';
function load<T>(k: string, fallback: T): T { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; } }
let storageOk = true; function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); storageOk = true; } catch { storageOk = false; } }
export const storageWorks = () => storageOk;
export function useStored<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, set] = useState<T>(init); useEffect(() => { set(load(key, init)); }, []);
  const put = useCallback((n: T) => { set(n); save(key, n); }, [key]); return [v, put];
}
export const useBook = () => useStored<Book>(BOOK_KEY, emptyBook());
export const usePlan = () => useStored<Plan | null>(PLAN_KEY, null);
/** The session date a paper trade is dated to: today in India if it is a trading day, otherwise the last session. */
export function sessionToday(now = Date.now()): string { const d = new Date(now + 19800000).toISOString().slice(0, 10); return isSession(d) ? d : prevSession(d); }
export function download(name: string, data: unknown) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
export const rupee = (x: number) => (x < 0 ? '−' : '') + '₹' + Math.abs(x).toLocaleString('en-IN', { maximumFractionDigits: 2 });
