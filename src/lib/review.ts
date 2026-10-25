/** "Since your last review" (brief §7.1): what changed in a followed company between the snapshot saved when you last marked
 *  it reviewed and the figures now. Only recorded snapshots are compared: with no baseline, the page says so instead of
 *  guessing a history. Kept in this browser (key alpha-reviewed). Pure diff; tested in tests/lib.test.ts. */
import type { Row } from './types';

export const REVIEW_KEY = 'alpha-reviewed';
export const REVIEW_VERSION = 1;
export interface Snapshot { v: number; at: string; data: string | null; price: number | null; q: number | null; g: number | null; val: number | null; tech: number | null; risk: string | null; next: string | null; elig: string | null }
export interface ReviewChange { field: string; from: string; to: string }

const fin = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
export function snapshotOf(r: Row, at: string): Snapshot {
  return { v: REVIEW_VERSION, at, data: r.last_date ?? null, price: fin(r.price) ? r.price : null, q: fin(r.q) ? Math.round(r.q) : null, g: fin(r.g) ? Math.round(r.g) : null, val: fin(r.v) ? Math.round(r.v) : null, tech: fin(r.tech) ? Math.round(r.tech) : null, risk: r.risk?.level ?? null, next: r.next_earnings ?? null, elig: r.vet?.s ?? null };
}

const pctMove = (a: number, b: number) => ((b / a - 1) * 100);
/** Changed facts between a saved snapshot and the current row. A score moving less than 5 points is noise, not a change;
 *  a price change is always listed with its size. */
export function diffSnapshot(s: Snapshot, r: Row): ReviewChange[] {
  const now = snapshotOf(r, s.at);
  const out: ReviewChange[] = [];
  if (s.price !== null && now.price !== null && s.price > 0 && Math.abs(pctMove(s.price, now.price)) >= 0.05) {
    const m = pctMove(s.price, now.price);
    out.push({ field: 'Price', from: `₹${s.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, to: `₹${now.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${m >= 0 ? '+' : '−'}${Math.abs(m).toFixed(1)}%)` });
  }
  const score = (field: string, a: number | null, b: number | null) => { if (a !== null && b !== null && Math.abs(b - a) >= 5) out.push({ field, from: String(a), to: String(b) }); };
  score('Quality rank', s.q, now.q); score('Growth rank', s.g, now.g); score('Value rank', s.val, now.val); score('Technical rank', s.tech, now.tech);
  if (s.risk !== now.risk && (s.risk || now.risk)) out.push({ field: 'Risk grade', from: s.risk ?? 'none', to: now.risk ?? 'none' });
  if (s.next !== now.next && (s.next || now.next)) out.push({ field: 'Results date on file', from: s.next ?? 'none', to: now.next ?? 'none' });
  if (s.elig !== now.elig && (s.elig || now.elig)) out.push({ field: 'Data checks', from: s.elig ?? 'none', to: now.elig ?? 'none' });
  return out;
}

export function readSnapshots(): Record<string, Snapshot> {
  try { const v = JSON.parse(localStorage.getItem(REVIEW_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
export function saveSnapshot(sym: string, snap: Snapshot): boolean {
  try { const all = readSnapshots(); all[sym] = snap; localStorage.setItem(REVIEW_KEY, JSON.stringify(all)); window.dispatchEvent(new Event('alpha-reviewed')); return true; } catch { return false; }
}
