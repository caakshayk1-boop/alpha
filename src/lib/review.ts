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

/** What a return visit can honestly say about a reviewed company (28 Nov 2026, the build brief's return-visit states).
 *    changed      at least one figure moved by more than the noise floor (diffSnapshot)
 *    unchanged    newer data than the review, and nothing moved
 *    no-new-data  the data the page reads is the same session the review saw: "no change" would claim a check that has not happened
 *  `missing` names figures the review had that the current data no longer carries: never silently dropped, never read as zero.
 *  Pure; the snapshot format is unchanged. */
export type ReviewKind = 'changed' | 'unchanged' | 'no-new-data';
export interface ReviewRead { kind: ReviewKind; changes: ReviewChange[]; missing: string[]; reviewedOn: string; dataThen: string | null; dataNow: string | null }
const NAMES: [keyof Snapshot, string][] = [['price', 'price'], ['q', 'quality rank'], ['g', 'growth rank'], ['val', 'value rank'], ['tech', 'technical rank']];
export function reviewRead(s: Snapshot, r: Row): ReviewRead {
  const now = snapshotOf(r, s.at);
  const changes = diffSnapshot(s, r);
  const missing = NAMES.filter(([k]) => s[k] !== null && s[k] !== undefined && now[k] === null).map(([, n]) => n);
  const same = !!s.data && !!now.data && now.data <= s.data;
  const kind: ReviewKind = changes.length ? 'changed' : same ? 'no-new-data' : 'unchanged';
  return { kind, changes, missing, reviewedOn: s.at.slice(0, 10), dataThen: s.data, dataNow: now.data };
}

/** The one-line wording of a return visit. `day` formats a YYYY-MM-DD date. */
export function reviewSentence(rd: ReviewRead, day: (iso: string) => string): string {
  const when = day(rd.reviewedOn);
  const head = rd.kind === 'changed'
    ? `${rd.changes.length} change${rd.changes.length > 1 ? 's' : ''} since you reviewed on ${when}: ${rd.changes.slice(0, 2).map((c) => `${c.field.toLowerCase()} ${c.from} → ${c.to}`).join('; ')}`
    : rd.kind === 'no-new-data'
      ? `No newer data since you reviewed on ${when}${rd.dataNow ? `: the figures are still from ${day(rd.dataNow)}` : ''}`
      : `No change in its figures since you reviewed on ${when}${rd.dataNow ? ` (data through ${day(rd.dataNow)})` : ''}`;
  return rd.missing.length ? `${head}. Not available now: ${rd.missing.join(', ')}` : head;
}
