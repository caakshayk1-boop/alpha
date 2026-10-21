/** Swing v2 plans marked to the latest price, and the decision each one needs for the next session.
 *
 *  The rules are engines/swing.py walk(), the one implementation the backtest and the nightly tracker share. The evening run
 *  books every entry, target and stop from the day's full high and low; this file only applies the same rules to the latest
 *  price between runs, so a reader sees during the session what the evening run will most likely book.
 *    entry  next session's open; skipped if more than 2% above the signal close or at/below the stop
 *    T1     entry + 2R: half is sold; the stop on the other half moves to entry + 0.5R (raised above entry, never break-even; a gap through it can still cost more)
 *    trail  after T1 the stop rises to the lowest low of the last 10 sessions when that is higher (nightly; never falls)
 *    T2     entry + 4R: the rest is sold
 *    time   whatever is left exits at the close of session 30 (entry session = 1)
 *  Mark: R = (booked half at its price + the rest at the latest price - entry) / risk at entry, before costs.
 *  Pure functions only: tested in tests/lib.test.ts. Alpha places no order; nothing here is advice. */
import type { LiveSnap } from './live.ts';
import { priceView, sessionLabel, type PriceView } from './price.ts';
import type { Sig } from './types.ts';

const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const DAY = 86_400_000;
const ymd = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const isSession = (t: number, skip?: ReadonlySet<string>) => { const d = new Date(t).getUTCDay(); return d !== 0 && d !== 6 && !skip?.has(iso(t)); };
export const money = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const LOCK_R = 0.5;
export const GAP_MAX = 0.02;

/** The date `n` sessions after `from` (weekdays, minus days in `skip` proven to have had no trading). */
export function addSessions(from: string, n: number, skip?: ReadonlySet<string>): string {
  let t = ymd(from);
  let left = n;
  while (left > 0) { t += DAY; if (isSession(t, skip)) left--; }
  return iso(t);
}
/** Sessions strictly after `a` up to and including `b`; negative when b is before a. */
export function sessionsAfter(a: string, b: string, skip?: ReadonlySet<string>): number {
  if (b === a) return 0;
  const sign = b > a ? 1 : -1;
  let [lo, hi] = sign > 0 ? [ymd(a), ymd(b)] : [ymd(b), ymd(a)];
  let n = 0;
  while (lo < hi) { lo += DAY; if (isSession(lo, skip)) n++; }
  return sign * n;
}
/** Weekdays the live snapshot proves had no trading: after its newest session up to the day it was fetched (that day only
 *  once 30 minutes of the session have passed with no trade anywhere in the screen). IST dates. */
export function noSessionDays(snapSession: string | null | undefined, fetchedAtS: number | null | undefined): string[] {
  if (!snapSession || !fetchedAtS) return [];
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(fetchedAtS * 1000)).map((x) => [x.type, x.value]));
  const today = `${p.year}-${p.month}-${p.day}`;
  const pastOpen = (Number(p.hour) % 24) * 60 + Number(p.minute) >= 9 * 60 + 45;
  const out: string[] = [];
  for (let t = ymd(snapSession) + DAY; t <= ymd(today); t += DAY) {
    const d = iso(t);
    if (!isSession(t)) continue;
    if (d === today && !pastOpen) continue;
    out.push(d);
  }
  return out;
}

export type PlanState = 'awaiting-entry' | 'hold' | 'stop-hit' | 't1-hit' | 't2-hit' | 'time-due' | 'closed' | 'void';
export const STATE_TEXT: Record<PlanState, string> = { 'awaiting-entry': 'Waiting for entry', hold: 'Hold', 'stop-hit': 'Stop reached', 't1-hit': 'T1 reached', 't2-hit': 'T2 reached', 'time-due': 'Time limit today', closed: 'Closed', void: 'Skipped' };
export const STATE_TONE: Record<PlanState, string> = { 'awaiting-entry': '', hold: 'acc', 'stop-hit': 'down', 't1-hit': 'up', 't2-hit': 'up', 'time-due': 'warn', closed: '', void: 'warn' };
export type StopKind = 'stop' | 'lock' | 'trail';
export const STOP_TEXT: Record<StopKind, string> = { stop: 'Stop', lock: 'Raised stop', trail: 'Trailing stop' };

export interface Mark {
  phase: Sig['status'];
  price: number | null;
  /** the price is from a session newer than the engines' close for this stock */
  live: boolean;
  session: string | null;
  at: number | null;
  source: PriceView['source'] | 'signal';
  entry: number;
  risk: number;
  stop: number;
  stopKind: StopKind;
  t1: number;
  t2: number;
  half: boolean;
  remaining: number;
  /** marked R of the whole trade (booked half + open part), before costs; null when not entered */
  r: number | null;
  /** % of the entry value */
  pct: number | null;
  toStop: { price: number; pct: number; r: number } | null;
  toNext: { label: 'T1' | 'T2'; price: number; pct: number; r: number } | null;
  timeDue: string | null;
  sessionsLeft: number | null;
  state: PlanState;
}

/** The price for one signal under the site's one rule: the engines' close for this stock (dated last_close_date) unless the
 *  live snapshot or the stock's own quote describes a newer session. */
export function priceFor(s: Sig, snap: LiveSnap | null | undefined, quote: { price: number; pct: number; at: number | null } | null | undefined): PriceView {
  return priceView(s.sym, { price: s.last_close ?? null, last_date: s.last_close_date ?? s.date }, snap, quote ?? null);
}

export function mark(s: Sig, pv: Pick<PriceView, 'price' | 'source' | 'session' | 'at'> | null, noSession: readonly string[] = []): Mark {
  const skip = new Set(noSession);
  const closeOn = s.last_close_date ?? s.date;
  const priceOk = !!pv && ok(pv.price) && pv.price! > 0;
  const newer = priceOk && !!pv!.session && pv!.session > closeOn && pv!.source !== 'close';
  if (s.status === 'pending' || !ok(s.entry) || !ok(s.risk)) {
    const risk = s.ref_price - s.sl;
    const price = newer ? pv!.price! : s.ref_price;
    return {
      phase: s.status, price, live: newer, session: newer ? pv!.session : s.date, at: newer ? pv!.at : null, source: newer ? pv!.source : 'signal',
      entry: s.ref_price, risk, stop: s.sl, stopKind: 'stop', t1: s.t1_plan, t2: s.t2_plan, half: false, remaining: 1, r: null, pct: null,
      toStop: risk > 0 ? { price: s.sl, pct: ((s.sl - price) / price) * 100, r: (s.sl - price) / risk } : null,
      toNext: risk > 0 ? { label: 'T1', price: s.t1_plan, pct: ((s.t1_plan - price) / price) * 100, r: (s.t1_plan - price) / risk } : null,
      timeDue: null, sessionsLeft: null, state: s.status === 'void' ? 'void' : 'awaiting-entry',
    };
  }
  const entry = s.entry!, risk = s.risk!, t1 = s.t1 ?? s.t1_plan, t2 = s.t2 ?? s.t2_plan;
  const half = !!s.half;
  const remaining = half ? 0.5 : 1;
  const stop = ok(s.stop_now) ? s.stop_now! : s.sl;
  const stopKind: StopKind = !half ? 'stop' : stop > entry + LOCK_R * risk + 0.005 ? 'trail' : 'lock';
  const realised = s.events.filter((e) => e.kind === 't1').reduce((a, e) => a + 0.5 * (e.price - entry), 0);
  const base = { phase: s.status, entry, risk, stop, stopKind, t1, t2, half, remaining };
  if (s.status !== 'open') {
    return { ...base, price: null, live: false, session: s.closed_date ?? closeOn, at: null, source: 'close', r: ok(s.r_net) ? s.r_net! : null, pct: null, toStop: null, toNext: null, timeDue: null, sessionsLeft: null, state: s.status === 'void' ? 'void' : 'closed' };
  }
  const price = newer ? pv!.price! : ok(s.last_close) ? s.last_close! : priceOk ? pv!.price! : null;
  const session = newer ? pv!.session : closeOn;
  const timeDue = s.entry_date ? addSessions(s.entry_date, s.max_hold - 1, skip) : null;
  const sessionsLeft = timeDue && session ? sessionsAfter(session, timeDue, skip) : null;
  if (price === null) return { ...base, price: null, live: false, session, at: null, source: 'close', r: null, pct: null, toStop: null, toNext: null, timeDue, sessionsLeft, state: 'hold' };
  let state: PlanState = 'hold';
  if (price <= stop) state = 'stop-hit';
  else if (!half && price >= t1) state = 't1-hit';
  else if (half && price >= t2) state = 't2-hit';
  else if (sessionsLeft !== null && sessionsLeft <= 0) state = 'time-due';
  const r = (realised + remaining * (price - entry)) / risk;
  const nextP = half ? t2 : t1;
  return {
    ...base, price, live: newer, session, at: newer ? pv!.at : null, source: newer ? pv!.source : 'close',
    r, pct: (r * risk / entry) * 100,
    toStop: { price: stop, pct: ((stop - price) / price) * 100, r: (stop - price) / risk },
    toNext: { label: half ? 'T2' : 'T1', price: nextP, pct: ((nextP - price) / price) * 100, r: (nextP - price) / risk },
    timeDue, sessionsLeft, state,
  };
}

/** R at the close BEFORE `session`: the half booked before it plus the rest at `prevClose`. 0 when entered on `session`. */
export function rAtPrevClose(s: Sig, session: string, prevClose: number | null | undefined): number | null {
  if (!ok(s.entry) || !ok(s.risk) || !s.entry_date) return null;
  if (s.entry_date >= session) return 0;
  if (!ok(prevClose) || !(s.risk! > 0)) return null;
  const t1 = s.events.find((e) => e.kind === 't1' && e.date < session);
  const realised = t1 ? 0.5 * (t1.price - s.entry!) : 0;
  return (realised + (t1 ? 0.5 : 1) * (prevClose - s.entry!)) / s.risk!;
}
/** R made on the mark's session. */
export function dayR(s: Sig, m: Pick<Mark, 'r' | 'session'>, prevClose: number | null | undefined): number | null {
  if (!ok(m.r) || !m.session) return null;
  const before = rAtPrevClose(s, m.session, prevClose);
  return before === null ? null : m.r - before;
}

export interface Intraday { prev: number; t: number[]; c: number[] }
export interface CurvePoint { t: number; r: number; n: number }
/** The book's R made today at every five-minute bar: each open trade contributes remaining x (close_t - base) / risk, base =
 *  the previous close (held overnight) or the entry (entered at today's open). A stock's last close carries forward. */
export function bookCurve(trades: { s: Sig; session: string }[], bars: Record<string, Intraday | undefined>): CurvePoint[] {
  const legs = trades.flatMap(({ s, session }) => {
    const b = bars[s.sym];
    if (!b || !b.t.length || !ok(s.entry) || !ok(s.risk) || !(s.risk! > 0) || !s.entry_date) return [];
    const booked = s.events.some((e) => e.kind === 't1' && e.date < session);
    return [{ b, base: s.entry_date < session ? b.prev : s.entry!, remaining: booked ? 0.5 : 1, risk: s.risk! }];
  });
  const grid = Array.from(new Set(legs.flatMap((l) => l.b.t))).sort((a, z) => a - z);
  const idx = legs.map(() => -1);
  return grid.map((t) => {
    let r = 0, n = 0;
    legs.forEach((l, k) => {
      while (idx[k] + 1 < l.b.t.length && l.b.t[idx[k] + 1] <= t) idx[k]++;
      if (idx[k] < 0) return;
      r += (l.remaining * (l.b.c[idx[k]] - l.base)) / l.risk;
      n++;
    });
    return { t, r: Math.round(r * 1000) / 1000, n };
  });
}

export type DecisionKind = 'exit' | 'modify' | 'enter' | 'hold' | 'closed' | 'void';
export interface Decision { kind: DecisionKind; id: string; sym: string; headline: string; detail: string }
export const DECISION_ORDER: DecisionKind[] = ['exit', 'modify', 'enter', 'hold', 'closed', 'void'];
export const DECISION_TEXT: Record<DecisionKind, string> = { exit: 'Exit', modify: 'Modify', enter: 'Enter', hold: 'Hold', closed: 'Closed', void: 'Skipped' };
const EXIT_TEXT: Record<string, string> = { stop: 'stopped out', lock: 'stopped at the raised stop after T1', trail: 'trailing stop after T1', t2: 'T2 reached', time: 'time limit' };

/** What the plan needs at the next session, from the state at the latest price and what the evening run booked on `session`
 *  (the engines' newest close). */
export function decide(s: Sig, m: Mark, session: string | null): Decision | null {
  const base = { id: s.id, sym: s.sym };
  if (s.status === 'closed') {
    if (!session || s.closed_date !== session) return null;
    return { ...base, kind: 'closed', headline: `Closed: ${EXIT_TEXT[s.exit_reason ?? ''] ?? 'by the plan'}`, detail: ok(s.r_net) ? `${s.r_net! > 0 ? '+' : s.r_net! < 0 ? '−' : ''}${Math.abs(s.r_net!).toFixed(2)}R after costs. Nothing left to do.` : 'Nothing left to do.' };
  }
  if (s.status === 'void') {
    if (!session || (s.closed_date ?? s.date) < session) return null;
    return { ...base, kind: 'void', headline: 'Entry skipped', detail: `The ${sessionLabel(s.entry_date ?? s.date)} open ${s.void_reason ?? 'broke the entry rule'}, so the plan never entered.` };
  }
  if (s.status === 'pending' || m.state === 'awaiting-entry') {
    return { ...base, kind: 'enter', headline: `${s.setup}: buy at the next open`, detail: `Skip it if the open is above ${money(s.ref_price * (1 + GAP_MAX))} (2% over the signal close) or at/below the stop ${money(s.sl)}. Stop ${money(s.sl)} (−${s.risk_pct.toFixed(1)}%); T1 +2R sells half, T2 +4R the rest.` };
  }
  const what = m.half ? 'the remaining half' : 'all of it';
  switch (m.state) {
    case 'stop-hit':
      return { ...base, kind: 'exit', headline: `Sell ${what}: ${STOP_TEXT[m.stopKind].toLowerCase()} ${money(m.stop)} reached`, detail: m.half ? 'The booked half keeps its gain; the trade ends.' : 'About −1R. The stop is the plan doing its job.' };
    case 't2-hit':
      return { ...base, kind: 'exit', headline: `Sell the remaining half at T2 ${money(m.t2)}`, detail: 'The trade ends at the second target.' };
    case 'time-due':
      return { ...base, kind: 'exit', headline: `Sell ${what} at the close: time limit`, detail: m.timeDue ? `Session 30 is ${sessionLabel(m.timeDue)}.` : 'Session 30 has arrived.' };
    case 't1-hit':
      return { ...base, kind: 'modify', headline: `Sell half at T1 ${money(m.t1)}; move the stop to ${money(m.entry + LOCK_R * m.risk)}`, detail: `The stop on the rest sits at +0.5R, above entry. A gap through it fills at the open, so the result can be lower. Next: T2 ${money(m.t2)}.` };
    default: {
      if (session && s.events.some((e) => e.kind === 't1' && e.date === session)) {
        return { ...base, kind: 'modify', headline: `Move the stop to ${money(m.stop)} (raised stop)`, detail: `Half was sold at T1 on ${sessionLabel(session)}. Next: T2 ${money(m.t2)}.` };
      }
      if (session && s.stop_raised_on === session) {
        return { ...base, kind: 'modify', headline: `Raise the trailing stop to ${money(m.stop)}`, detail: `From ${ok(s.stop_before) ? money(s.stop_before!) : 'the previous level'}: the lowest low of the last 10 sessions rose. Next: T2 ${money(m.t2)}.` };
      }
      if (session && s.entry_date === session) {
        return { ...base, kind: 'modify', headline: `Entered at ${money(m.entry)}: place the stop at ${money(m.stop)}`, detail: `T1 ${money(m.t1)} sells half; T2 ${money(m.t2)} the rest.${m.timeDue ? ` Time limit: the ${sessionLabel(m.timeDue)} close.` : ''}` };
      }
      return { ...base, kind: 'hold', headline: `Hold ${what}`, detail: `${STOP_TEXT[m.stopKind]} ${money(m.stop)}, next ${m.toNext ? `${m.toNext.label} ${money(m.toNext.price)}` : '—'}${m.timeDue ? `; time limit the ${sessionLabel(m.timeDue)} close` : ''}. No change.` };
    }
  }
}

export function groupDecisions(ds: (Decision | null)[]): { kind: DecisionKind; items: Decision[] }[] {
  const by = new Map<DecisionKind, Decision[]>();
  for (const d of ds) if (d) by.set(d.kind, [...(by.get(d.kind) ?? []), d]);
  return DECISION_ORDER.filter((k) => by.has(k)).map((k) => ({ kind: k, items: by.get(k)!.sort((a, b) => a.sym.localeCompare(b.sym)) }));
}

/** Price label for one mark: "live 10:26", "last trade 10:05" or "19 Oct close". */
export const markSource = (m: Pick<Mark, 'live' | 'at' | 'session'>, now = Date.now()): string =>
  m.live && m.at ? (now / 1000 - m.at < 15 * 60 ? 'live' : 'last trade') : m.session ? `${sessionLabel(m.session).replace(/ \d{4}$/, '')} close` : 'close';

