/** The geometry and the words of a position's target ladder. Pure: no React, no clock, so it is unit-tested and the card only draws what this returns.
 *
 *  The ladder is one horizontal scale with four levels on it: the stop, the entry (the FILL once the position has entered, the signal close before that), Target 1 and Target 2, plus the
 *  price now (or the exit, once closed). The levels are NOT computed here. They arrive from the one definition of R and of the targets (`ladderPrices` / `targetPrices`, exits.ts and
 *  levels.ts), so a level drawn is the level booked, to the paisa. Nothing in this file changes a rule, a multiple, a cost or a stored shape. */
import type { Outcome } from './ledger.ts';
import type { Paper, View } from './tracker.ts';
import { REFERENCE_ONLY, targetBasis } from './exits.ts';
import { targetPrices } from './levels.ts';
import { dayWord, inr } from './fmt.ts';
import { DEFAULT_COST, GAP_SKIP_PCT, SLIPPAGE_PCT } from './tracker.ts';

export type LadderTickId = 'stop' | 'entry' | 't1' | 't2';
export interface LadderInput {
  /** `entry`: levels are worked from the fill and are the booked ones. `signal`: no fill yet, levels are worked from the signal close and must say so. */
  basis: 'entry' | 'signal';
  /** the fill (basis entry) or the signal close (basis signal) */
  entry: number;
  /** the stop the position was filed with */
  stop: number;
  /** the stop now, when it has moved (after Target 1 it sits at the fill) */
  curStop?: number | null;
  t1: number; t2: number;
  t1Hit: boolean; t2Hit: boolean;
  /** India dates (YYYY-MM-DD) of the session whose bar filled each target, and the price it filled at */
  t1Day?: string | null; t2Day?: string | null; t1Px?: number | null; t2Px?: number | null;
  /** price now (live or last close); null when there is none */
  mark: number | null;
  /** exit price and day, once the position has closed */
  exit?: number | null; exitDay?: string | null;
  status: 'waiting' | 'pending' | 'open' | 'closed' | 'skipped';
  /** pre-27-Oct pick that finished before the ladder was extended to it: the levels are for orientation and were never traded */
  reference: boolean;
}

export interface LadderTick { id: LadderTickId; label: string; px: number; pos: number; hit: boolean; day: string | null; /** 0 = label above the rule, 1 = label on a second line so neighbours cannot collide */ row: 0 | 1; ref: boolean; moved: boolean }
export interface LadderModel {
  ticks: LadderTick[];
  /** the filled stretch of the rule, from the entry to where the price is (percent), and which way it went */
  fill: { from: number; to: number; tone: 'up' | 'down' } | null;
  marker: { pos: number; px: number; kind: 'now' | 'exit' } | null;
  /** after Target 1 the stop moves up to the fill: the stretch it travelled */
  ratchet: { from: number; to: number; fromPx: number; toPx: number } | null;
  /** sentences under the rule: what was booked and when, where the stop is, and the honest caveats */
  notes: string[];
  /** one sentence for a screen reader */
  summary: string;
  reference: boolean;
  basis: 'entry' | 'signal';
}

/** the smallest distance, in percent of the rule, at which two neighbouring labels still fit on one line (about 60 px on a 360 px phone) */
export const MIN_LABEL_GAP = 24;
/** About how wide one printed character of a level label is, in percent of the ladder (measured on a 390 px phone: "₹2,058.72" is 22.5 percent). */
const CHAR_W = 2.5;
const PAD = 0.09;
const r2 = (x: number) => Math.round(x * 100) / 100;
const f = (x: number) => x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "28 Oct" */
export const shortDay = (iso?: string | null): string => (iso ? dayWord(iso).replace(/^\w+ /, '') : 'an unknown date');

export function ladderModel(i: LadderInput): LadderModel {
  const entered = i.status === 'open' || i.status === 'closed';
  const closed = i.status === 'closed';
  const shown = closed ? (i.exit ?? null) : entered ? i.mark : null;     // a position that has not entered has no price on its journey
  const levels = [i.stop, i.entry, i.t1, i.t2, ...(i.curStop != null ? [i.curStop] : []), ...(shown != null ? [shown] : [])].filter(Number.isFinite);
  const lo = Math.min(...levels), hi = Math.max(...levels); const span = hi - lo > 0 ? hi - lo : 1; const pad = span * PAD;
  const pos = (x: number) => Math.round(((x - lo + pad) / (span + 2 * pad)) * 1000) / 10;
  const hit = (id: LadderTickId) => (id === 't1' ? i.t1Hit && !i.reference : id === 't2' ? i.t2Hit && !i.reference : false);
  const cur = i.curStop != null && Number.isFinite(i.curStop) ? i.curStop : i.stop;
  const moved = entered && !i.reference && i.t1Hit && cur > i.stop + 0.004;

  const base: Omit<LadderTick, 'row'>[] = [
    { id: 'stop', label: 'Stop', px: i.stop, pos: pos(i.stop), hit: false, day: null, ref: false, moved },
    { id: 'entry', label: i.basis === 'entry' ? 'Entry' : 'Signal', px: i.entry, pos: pos(i.entry), hit: false, day: null, ref: false, moved: false },
    { id: 't1', label: i.reference ? 'T1 ref' : 'T1', px: i.t1, pos: pos(i.t1), hit: hit('t1'), day: hit('t1') ? i.t1Day ?? null : null, ref: i.reference, moved: false },
    { id: 't2', label: i.reference ? 'T2 ref' : 'T2', px: i.t2, pos: pos(i.t2), hit: hit('t2'), day: hit('t2') ? i.t2Day ?? null : null, ref: i.reference, moved: false },
  ];
  // Labels left to right. A label takes the first line where its printed extent does not touch the last label already on that line, so a label pushed to the right edge (it is right-aligned there, and
  // reaches left) cannot overprint its neighbour: T1 at 62% and T2 at 93% used to print "₹2,058.₹2,342.92" on one line. Extents are in percent of the ladder; a label is about CHAR_W per character wide.
  const wOf = (t: Omit<LadderTick, 'row'>) => Math.max(t.label.length, inr(t.px).length) * CHAR_W;
  const ext = (t: Omit<LadderTick, 'row'>): [number, number] => { const w = wOf(t); return t.pos < 16 ? [t.pos, t.pos + w] : t.pos > 84 ? [t.pos - w, t.pos] : [t.pos - w / 2, t.pos + w / 2]; };
  const ordered = [...base].sort((a, b) => a.pos - b.pos); const rowOf = new Map<LadderTickId, 0 | 1>(); const lastEnd: [number, number] = [-Infinity, -Infinity];
  for (const t of ordered) { const [a, b] = ext(t); const row: 0 | 1 = a >= lastEnd[0] + 1 ? 0 : a >= lastEnd[1] + 1 ? 1 : lastEnd[0] <= lastEnd[1] ? 0 : 1; rowOf.set(t.id, row); lastEnd[row] = b; }
  const ticks: LadderTick[] = base.map((t) => ({ ...t, row: rowOf.get(t.id) ?? 0 }));

  const marker = shown != null ? { pos: pos(shown), px: shown, kind: closed ? ('exit' as const) : ('now' as const) } : null;
  const fill = marker && Math.abs(shown! - i.entry) > 0.004 ? { from: Math.min(pos(i.entry), marker.pos), to: Math.max(pos(i.entry), marker.pos), tone: shown! > i.entry ? ('up' as const) : ('down' as const) } : null;
  const ratchet = moved ? { from: pos(i.stop), to: pos(cur), fromPx: i.stop, toPx: cur } : null;

  const notes: string[] = [];
  if (i.reference) notes.push(`${REFERENCE_ONLY[0].toUpperCase()}${REFERENCE_ONLY.slice(1)}. T1 and T2 are shown for orientation; this position was never traded under them.`);
  else {
    if (i.t1Hit) notes.push(`½ booked at T1 · ${shortDay(i.t1Day)}${i.t1Px != null ? ` · filled at ₹${f(i.t1Px)}` : ''}`);
    if (i.t2Hit) notes.push(`Rest sold at T2 · ${shortDay(i.t2Day)}${i.t2Px != null ? ` · filled at ₹${f(i.t2Px)}` : ''}`);
    if (moved) notes.push(`Stop raised to the fill (₹${f(cur)}) after T1, from ₹${f(i.stop)}`);
    if (i.basis === 'signal') notes.push('Levels are worked from the signal close; the fill at the next open sets the booked ones.');
  }
  const t1w = i.reference ? `T1 ₹${f(i.t1)} (reference)` : `T1 ₹${f(i.t1)} ${i.t1Hit ? `hit ${shortDay(i.t1Day)}` : 'not reached'}`;
  const t2w = i.reference ? `T2 ₹${f(i.t2)} (reference)` : `T2 ₹${f(i.t2)} ${i.t2Hit ? `hit ${shortDay(i.t2Day)}` : 'not reached'}`;
  const where = shown == null ? '' : closed ? `; exited at ₹${f(shown)}` : `; price now ₹${f(shown)}`;
  const summary = `Stop ₹${f(i.stop)}${moved ? ` raised to ₹${f(cur)}` : ''}, ${i.basis === 'entry' ? 'entry' : 'signal close'} ₹${f(i.entry)}, ${t1w}, ${t2w}${where}.`;
  return { ticks, fill, marker, ratchet, notes, summary, reference: i.reference, basis: i.basis };
}

/** The ladder for a book row, from what the book already holds. `outcome` is the ledger's own finished record for the pick (it carries the hit days and prices of a position the browser no longer replays).
 *  `p` is the paper on the basis the bars are quoted in (after a split or bonus the stop has moved with them). Returns null for a position with no ladder to draw: skipped, or levels that cannot be worked out. */
export function ladderInputFor(p: Pick<Paper, 'asOf' | 'horizon' | 'ref' | 'stop'> & { targets?: Paper['targets'] }, v: View, outcome?: Outcome | null): LadderInput | null {
  if (v.status === 'skipped') return null;
  const final = v.status === 'closed'; const entered = v.status === 'open' || v.status === 'closed';
  const L = v.ladder; const day = (t?: number) => (t != null ? new Date((t + 19800) * 1000).toISOString().slice(0, 10) : null);
  if (L && entered && v.entry != null) {
    return { basis: 'entry', entry: v.entry, stop: p.stop, curStop: L.stop, t1: L.t1, t2: L.t2, t1Hit: L.t1Hit, t2Hit: L.t2Hit,
      t1Day: day(L.t1T) ?? outcome?.t1Day ?? null, t2Day: day(L.t2T) ?? outcome?.t2Day ?? null, t1Px: L.t1Px ?? outcome?.t1Px ?? null, t2Px: L.t2Px ?? outcome?.t2Px ?? null,
      mark: v.mark, exit: v.exit ?? null, exitDay: outcome?.exitDay ?? day(v.exitT), status: v.status, reference: false };
  }
  const t = targetPrices({ asOf: p.asOf, horizon: p.horizon, ref: v.signal ?? p.ref, stop: p.stop }, final, entered ? v.entry : null); if (!t) return null;
  const basis = targetBasis(p, final); const traded = !!p.targets;   // a paper taken by hand before profit booking has no ladder to trade: its levels are for orientation
  const reference = t.ref || basis === 'reference' || !traded;
  const o = !reference && outcome && outcome.status === 'closed' ? outcome : null;      // a finished position's hits come from the record that closed it
  const t1Hit = !!o?.t1Hit, t2Hit = !!o?.t2Hit;
  return { basis: t.basis, entry: t.basis === 'entry' ? (v.entry as number) : (v.signal ?? p.ref), stop: p.stop, curStop: t1Hit && t.basis === 'entry' ? (v.entry as number) : null, t1: r2(t.t1), t2: r2(t.t2), t1Hit, t2Hit,
    t1Day: o?.t1Day ?? null, t2Day: o?.t2Day ?? null, t1Px: o?.t1Px ?? null, t2Px: o?.t2Px ?? null,
    mark: v.mark, exit: v.exit ?? null, exitDay: o?.exitDay ?? null, status: v.status, reference };
}

/** The ladder for a pick that has not entered: levels worked from the SIGNAL close (basis 'signal'), nothing hit, no price on the journey. Uses the same `targetPrices` the tracker books from, so the stop
 *  and the two targets drawn are the ones the paper book would use (the fill at the next open then sets the booked targets). Null when the levels cannot be worked out. */
export function pickLadderInput(p: { asOf: string; horizon: number; ref: number; stop: number }): LadderInput | null {
  const t = targetPrices(p, false, null); if (!t) return null;
  return { basis: 'signal', entry: p.ref, stop: p.stop, curStop: null, t1: r2(t.t1), t2: r2(t.t2), t1Hit: false, t2Hit: false, mark: null, status: 'waiting', reference: t.ref };
}
/** The paper assumptions printed with a pick's levels, from the constants the tracker applies, so the sentence cannot differ from the rule. */
export function paperAssumptions(horizon: number, cost: number = DEFAULT_COST): string[] {
  return [
    'Paper only: no order is placed and nothing is bought for you.',
    `Enters at the next session's open plus ${SLIPPAGE_PCT}% slippage, not at the signal close. Skipped if that open is more than ${GAP_SKIP_PCT}% above the signal close.`,
    `Costs ${cost}% round trip. Exits at the stop, a target, or the time limit of session ${horizon}, whichever comes first.`,
    'The targets drawn are worked from the signal close; the fill sets the booked ones.',
  ];
}
