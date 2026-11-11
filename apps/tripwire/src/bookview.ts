/** The Book's display logic (11 Nov 2026, revamp v2). Pure: no React, no clock of its own, so it is unit-tested (tests/bookview.test.ts).
 *  Nothing here computes a P&L, an R, a level, an entry or an exit: it ORDERS rows the book already worked out, says how far each is from levels the book already booked,
 *  and finds the NSE sessions the forward ledger has no night for. Display only; no rule, cost or stored shape changes. */
import { nextSession } from './calendar.ts';
import { dayWord } from './fmt.ts';

/** Within this many percent of the stop (or of the next target) a position counts as "near" it, for the chips and the order. A display threshold, not a rule. */
export const NEAR_PCT = 3;

export interface AttnInput {
  status: 'waiting' | 'pending' | 'open' | 'closed' | 'skipped';
  /** the price now; null when there is none */
  mark: number | null;
  /** the stop in force now (after T1 it is the fill) */
  stop: number | null;
  t1: number | null; t2: number | null; t1Hit: boolean; t2Hit: boolean;
  /** a tie-breaker that keeps the order stable (symbol or id) */
  key: string;
}
export interface Attn {
  /** percent the price is above the stop; null without a price */
  toStop: number | null;
  /** percent the price is below the next unfilled target; null when there is none */
  toTarget: number | null; next: 'T1' | 'T2' | null;
  near: 'stop' | 'target' | null;
  /** 0 near stop, 1 near target, 2 other open, 3 waiting for an open, 4 finished (closed or skipped) */
  group: 0 | 1 | 2 | 3 | 4;
}
const r2 = (x: number) => Math.round(x * 100) / 100;
export function attention(i: AttnInput): Attn {
  if (i.status === 'closed' || i.status === 'skipped') return { toStop: null, toTarget: null, next: null, near: null, group: 4 };
  if (i.status !== 'open') return { toStop: null, toTarget: null, next: null, near: null, group: 3 };
  const m = i.mark;
  const toStop = m != null && i.stop != null && i.stop > 0 ? r2((m / i.stop - 1) * 100) : null;
  const next = !i.t1Hit && i.t1 != null ? 'T1' : !i.t2Hit && i.t2 != null ? 'T2' : null;
  const lvl = next === 'T1' ? i.t1 : next === 'T2' ? i.t2 : null;
  const toTarget = m != null && m > 0 && lvl != null ? r2((lvl / m - 1) * 100) : null;
  const near = toStop != null && toStop <= NEAR_PCT ? 'stop' : toTarget != null && toTarget <= NEAR_PCT ? 'target' : null;
  return { toStop, toTarget, next, near, group: near === 'stop' ? 0 : near === 'target' ? 1 : 2 };
}
/** What a row says when it is near a level, in words, or null: "At or below its stop" (a recorded mark under the stop is said, never hidden), "1.2% above its stop", "2.0% from T1". */
export function nearWord(a: Attn): { kind: 'stop' | 'target'; text: string } | null {
  if (a.near === 'stop' && a.toStop != null) return { kind: 'stop', text: a.toStop <= 0 ? 'At or below its stop' : `${a.toStop.toFixed(1)}% above its stop` };
  if (a.near === 'target' && a.toTarget != null && a.next) return { kind: 'target', text: a.toTarget <= 0 ? `At ${a.next}` : `${a.toTarget.toFixed(1)}% from ${a.next}` };
  return null;
}
/** Rows in the order they need attention: nearest the stop first, then nearest a target, then every other open position (closest to its stop first), then those waiting for an open, then finished ones.
 *  A position with no price sorts after the measured ones of its group. Stable on `key`. */
export function byAttention<T>(rows: readonly T[], input: (r: T) => AttnInput): T[] {
  const inf = (x: number | null) => (x == null ? Number.POSITIVE_INFINITY : x);
  const k = rows.map((r) => { const i = input(r); return { r, i, a: attention(i) }; });
  return k.sort((x, y) => x.a.group - y.a.group
    || (x.a.group === 1 ? inf(x.a.toTarget) - inf(y.a.toTarget) : inf(x.a.toStop) - inf(y.a.toStop))
    || inf(x.a.toTarget) - inf(y.a.toTarget)
    || x.i.key.localeCompare(y.i.key)).map((x) => x.r);
}

/** The NSE sessions between the first and the last recorded night that have no night in the ledger. Holidays and weekends are not sessions (calendar.ts), so they are never "missing".
 *  Only gaps INSIDE the record: a trailing gap after the last night is lateness, which the picks-through pill already states. */
export function missingNights(days: readonly string[]): string[] {
  const have = new Set(days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))); if (have.size < 2) return [];
  const sorted = [...have].sort(); const first = sorted[0], last = sorted[sorted.length - 1]; const out: string[] = [];
  for (let d = nextSession(first); d < last; d = nextSession(d)) if (!have.has(d)) out.push(d);
  return out;
}
/** One sentence for the gaps, in words: "Wed 4 Nov and Thu 5 Nov 2026: not recorded. The record has no night for those sessions, and nothing was filled in for them." Null when there is no gap. */
export function missingNightsLine(gaps: readonly string[]): string | null {
  if (!gaps.length) return null;
  const words = gaps.map((d) => dayWord(d)); const yr = gaps[gaps.length - 1].slice(0, 4);
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  return `${list} ${yr}: not recorded. The record has no night for ${gaps.length === 1 ? 'that session' : 'those sessions'}, and nothing was filled in for ${gaps.length === 1 ? 'it' : 'them'}.`;
}

/** Bars for the Record: one per closed trade, oldest exit first, height as a share of the largest |R|. Input is the R the ledger booked; nothing is recomputed. */
export function rBars(items: readonly { id: string; label: string; r: number; day?: string | null }[]): { id: string; label: string; r: number; h: number; tone: 'up' | 'down' | 'flat' }[] {
  const max = Math.max(0, ...items.map((x) => Math.abs(x.r)));
  return [...items].sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || a.id.localeCompare(b.id))
    .map((x) => ({ id: x.id, label: x.label, r: x.r, h: max > 0 ? Math.round((Math.abs(x.r) / max) * 1000) / 10 : 0, tone: x.r > 0 ? 'up' : x.r < 0 ? 'down' : 'flat' }));
}

/** The three views of the Book, and where every older address lands. `evidence` opens the Record at its evidence section. */
export type BookView = 'positions' | 'picks' | 'record';
export function bookView(v: string | null | undefined): { view: BookView; anchor: string | null } {
  switch (v) {
    case 'picks': return { view: 'picks', anchor: null };
    case 'record': return { view: 'record', anchor: null };
    case 'evidence': return { view: 'record', anchor: 'evidence' };
    default: return { view: 'positions', anchor: null };   // positions, tracker (Mine), auto, nothing, anything unknown
  }
}
