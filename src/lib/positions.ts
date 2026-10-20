/** The paper book: each engine signal marked to the latest price under the engine's OWN exit rule.
 *
 *  Alpha never places a trade. A "position" here is what the engine's rules would hold, and the "action" is that rule applied
 *  to the latest price. Nothing in this file is advice, and nothing is a fill: the evening run (engines/registry.py) is what
 *  books entries, targets and stops, from each day's full high and low. This file only marks the open part to a price.
 *
 *  The rule, reproduced exactly from engines/common.py walk() (lines 68-121), the one implementation the backtest and the live
 *  tracker share:
 *    - entry is the next session's open after the signal (common.py:78-81); void if that open is at/above T1 or at/below the
 *      stop (common.py:85-86), or the risk is over 20% or under 0.4% of entry (common.py:88-89).
 *    - risk R = entry - original stop (common.py:87).
 *    - the stop is checked FIRST, including a gap through it: exit everything left at the stop, or at the open if it gapped
 *      below (common.py:97-103).
 *    - targets in order, several possible in one session: sell one third at each, at the target or at the open if it gapped
 *      past (common.py:104-110, SPLITS common.py:21).
 *    - after T1 the stop moves to entry; after T2 it moves to T1 (common.py:111).
 *    - all three targets: closed (common.py:112-114).
 *    - time limit: whatever is left exits at the close of session `max_hold`, counting the entry session as 1
 *      (common.py:92, 115-119).
 *  And the mark, from engines/registry.py:74: R = (realised + remaining x (price - entry)) / risk, before costs.
 *
 *  Pure functions only: tested in tests/lib.test.ts. */
import { istDate, type LiveSnap } from './live.ts';
import { priceView, sessionLabel, type PriceView } from './price.ts';

const SPLIT = 1 / 3;   // common.py:21 SPLITS
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export interface PlanSignal {
  status: 'pending' | 'open' | 'closed' | 'void';
  /** the signal session (the close the plan was built on) */
  date: string;
  ref_price: number;
  entry?: number | null;
  entry_date?: string | null;
  sl: number;
  stop_now?: number | null;
  targets: number[];
  hit: number;
  max_hold_days: number;
  last_close?: number | null;
  events: { date: string; kind: string; price: number; fraction: number }[];
}

export type PlanState =
  | 'awaiting-entry'   // pending: the next open has not been processed
  | 'hold'             // open, no level reached at the latest price
  | 'stop-hit'         // latest price at or below the current stop
  | 'target-hit'       // latest price at or past the next target (not T3)
  | 'all-targets'      // latest price at or past T3
  | 'time-due'         // the latest session is the time limit: exit at its close
  | 'time-passed'      // the time limit's close has passed; the evening run books it
  | 'closed'
  | 'void';

export interface LevelDist { label: string; price: number; pct: number; r: number }
export interface Position {
  phase: PlanSignal['status'];
  /** the price used and what it is */
  price: number | null;
  source: PriceView['source'] | 'signal';
  session: string | null;
  at: number | null;
  /** true when the price is from a session newer than the engines' last close */
  live: boolean;
  entry: number;
  /** R in rupees per share: entry - original stop */
  risk: number;
  /** the stop the plan holds now, after any move the latest price would trigger */
  stop: number;
  /** targets the evening run has booked (0-3) and targets the latest price is at or past (>= booked) */
  booked: number;
  reachedNow: number;
  remaining: number;
  /** the trade marked to `price`: realised thirds plus the open part, in R and in % of the entry value. Paper, before costs. */
  r: number | null;
  pct: number | null;
  /** the open part alone, in R (per share of the remaining fraction scaled by it) and the realised part */
  rOpen: number | null;
  rRealised: number;
  /** per-share move from entry, % */
  move: number | null;
  /** % change against the engines' last close (dated closeOn); null when the price IS that close */
  sinceClose: number | null;
  closeOn: string | null;
  toStop: LevelDist | null;
  toNext: LevelDist | null;
  /** pending only: latest price against the signal close (entry is the next open) */
  toEntry: { price: number; pct: number } | null;
  /** last session of the time limit (weekdays; an exchange holiday moves it a session later) and sessions left after `session` */
  timeDue: string | null;
  sessionsLeft: number | null;
  state: PlanState;
  action: string;
  /** when the plan's state last changed: a booked event's date, or the latest price's time when the price moved it */
  changed: { session: string | null; at: number | null; what: string };
}

const ymd = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const DAY = 86_400_000;

const isSession = (t: number, skip?: ReadonlySet<string>) => { const d = new Date(t).getUTCDay(); return d !== 0 && d !== 6 && !skip?.has(iso(t)); };

/** The date `n` sessions after `from` (from itself is session 0): weekdays, minus any day in `skip` known to have had no
 *  trading. Alpha has no holiday calendar, so an exchange holiday not in `skip` makes the real date one session later. */
export function addSessions(from: string, n: number, skip?: ReadonlySet<string>): string {
  let t = ymd(from);
  let left = n;
  while (left > 0) { t += DAY; if (isSession(t, skip)) left--; }
  return iso(t);
}
/** Sessions strictly after `a` up to and including `b` (same counting as addSessions); negative when b is before a. */
export function sessionsAfter(a: string, b: string, skip?: ReadonlySet<string>): number {
  if (b === a) return 0;
  const sign = b > a ? 1 : -1;
  let [lo, hi] = sign > 0 ? [ymd(a), ymd(b)] : [ymd(b), ymd(a)];
  let n = 0;
  while (lo < hi) { lo += DAY; if (isSession(lo, skip)) n++; }
  return sign * n;
}

/** Time limit: the close of session max_hold, counting the entry session as 1 (common.py:92). */
export const timeLimitDate = (entryDate: string, maxHold: number, skip?: ReadonlySet<string>): string => addSessions(entryDate, Math.max(0, maxHold - 1), skip);

/** Weekdays the live snapshot proves had no trading: every weekday after the snapshot's newest session up to the day it was
 *  fetched, the fetch day itself only once 30 minutes of the session have passed with no trade in any screened stock. This is
 *  the holiday-proof rule lib/session.ts uses (read the market's own last trade, never a calendar). IST dates. */
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

const r2 = (v: number) => Math.round(v * 100) / 100;
const money = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;
const thirds = (rem: number) => (rem > 0.99 ? 'the whole position' : rem > 0.6 ? 'the remaining two thirds' : 'the last third');
const EVENT_WHAT: Record<string, string> = { entry: 'Entered at the open', t1: 'T1 reached; stop moved to entry', t2: 'T2 reached; stop moved to T1', t3: 'T3 reached; closed', stop: 'Stopped out', stop_after_t1: 'Stopped at entry', stop_after_t2: 'Stopped at T1', time: 'Time limit reached' };

/** Which price marks a signal: the live view when it is a newer session than the engines' close, else that close, dated.
 *  `pv` is lib/price.ts priceView() over {price: last_close, last_date: closeOn}. */
export function position(s: PlanSignal, pv: Pick<PriceView, 'price' | 'source' | 'session' | 'at'> | null, closeOn: string | null, noSession: readonly string[] = []): Position {
  const skip = new Set(noSession);
  const T = s.targets;
  const booked = Math.max(0, Math.min(3, s.hit | 0));
  const priceOk = !!pv && ok(pv.price) && pv.price > 0;
  const base = {
    phase: s.status,
    closeOn,
    booked,
    toEntry: null as Position['toEntry'],
    timeDue: null as string | null,
    sessionsLeft: null as number | null,
  };

  // ── pending: no position yet. Show where the price is against the signal close; the entry is the next open.
  if (s.status === 'pending' || !ok(s.entry)) {
    const live = priceOk && !!pv!.session && pv!.session > s.date;
    const price = live ? pv!.price! : s.ref_price;
    const risk = s.ref_price - s.sl;
    const overdue = live;   // a session after the signal exists: its open has come; the evening run fills or voids it
    const pastT1 = price >= T[0], belowStop = price <= s.sl;
    const action = s.status === 'void' ? 'Void: the opening price was already past the first target or the stop.'
      : overdue
        ? `Entry was due at the ${sessionLabel(pv!.session)} open; the evening run fills it at that open, or skips it if the open was past T1 ${money(T[0])} or at/below the stop ${money(s.sl)}.${pastT1 ? ' The latest price is past T1.' : belowStop ? ' The latest price is below the stop.' : ''}`
        : `No position yet. The plan enters at the next session's open, and skips it if that open is past T1 ${money(T[0])} or at/below the stop ${money(s.sl)}.`;
    return {
      ...base,
      price, source: live ? pv!.source : 'signal', session: live ? pv!.session : s.date, at: live ? pv!.at : null, live,
      entry: s.ref_price, risk, stop: s.sl, reachedNow: 0, remaining: 1,
      r: null, pct: null, rOpen: null, rRealised: 0, move: null, sinceClose: null,
      toStop: risk > 0 ? { label: 'Stop', price: s.sl, pct: ((s.sl - price) / price) * 100, r: r2((s.sl - price) / risk) } : null,
      toNext: risk > 0 ? { label: 'T1', price: T[0], pct: ((T[0] - price) / price) * 100, r: r2((T[0] - price) / risk) } : null,
      toEntry: { price: s.ref_price, pct: live ? ((s.ref_price - price) / price) * 100 : 0 },
      state: s.status === 'void' ? 'void' : 'awaiting-entry',
      action,
      changed: { session: s.date, at: null, what: 'Signal issued' },
    };
  }

  const entry = s.entry!;
  const risk = entry - s.sl;                                    // common.py:87
  const realised = s.events.filter((e) => /^t[123]$/.test(e.kind)).reduce((a, e) => a + SPLIT * (e.price - entry), 0);
  const remainingBooked = Math.max(0, 1 - SPLIT * booked);
  const stopBooked = ok(s.stop_now) ? s.stop_now! : booked === 0 ? s.sl : booked === 1 ? entry : T[0];
  const lastEv = s.events[s.events.length - 1];
  const bookedChange = { session: lastEv?.date ?? s.entry_date ?? null, at: null, what: lastEv ? EVENT_WHAT[lastEv.kind] ?? lastEv.kind : 'Entered' };

  if (s.status === 'closed' || s.status === 'void') {
    return {
      ...base, price: null, source: 'close', session: closeOn, at: null, live: false, entry, risk, stop: stopBooked, reachedNow: booked, remaining: 0,
      r: null, pct: null, rOpen: null, rRealised: r2(realised / risk), move: null, sinceClose: null, toStop: null, toNext: null,
      state: s.status, action: s.status === 'void' ? 'Void: the opening price was already past the first target or the stop.' : 'Closed by the rules; the result is in the record.',
      changed: bookedChange,
    };
  }

  // ── open
  const live = priceOk && (!closeOn || (!!pv!.session && pv!.session > closeOn)) && pv!.source !== 'close';
  const price = live ? pv!.price! : ok(s.last_close) ? s.last_close! : priceOk ? pv!.price! : null;
  const session = live ? pv!.session : closeOn;
  const at = live ? pv!.at : null;
  const timeDue = s.entry_date ? timeLimitDate(s.entry_date, s.max_hold_days, skip) : null;
  const sessionsLeft = timeDue && session ? sessionsAfter(session, timeDue, skip) : null;

  if (price === null || !(risk > 0)) {
    return {
      ...base, price: null, source: 'close', session, at, live: false, entry, risk, stop: stopBooked, reachedNow: booked, remaining: remainingBooked,
      r: null, pct: null, rOpen: null, rRealised: r2(realised / risk), move: null, sinceClose: null, toStop: null, toNext: null,
      timeDue, sessionsLeft, state: 'hold', action: 'No price to mark this position.', changed: bookedChange,
    };
  }

  // the rule applied to the latest price: the stop first (common.py:97), then targets in order (common.py:104)
  let state: PlanState = 'hold';
  let reachedNow = booked;
  let stop = stopBooked;
  if (price <= stopBooked) state = 'stop-hit';
  else {
    while (reachedNow < 3 && price >= T[reachedNow]) reachedNow++;
    if (reachedNow > booked) {
      state = reachedNow === 3 ? 'all-targets' : 'target-hit';
      stop = reachedNow === 1 ? entry : reachedNow === 2 ? T[0] : stop;   // common.py:111
    } else if (sessionsLeft !== null && sessionsLeft === 0) state = 'time-due';
    else if (sessionsLeft !== null && sessionsLeft < 0) state = 'time-passed';
  }

  // the mark (registry.py:74): booked thirds at their booked prices, everything still held at the latest price
  const rOpenRaw = remainingBooked * (price - entry);
  const rTrade = (realised + rOpenRaw) / risk;
  const nextI = Math.min(reachedNow, 2);
  const toNext: LevelDist | null = reachedNow >= 3 ? null : { label: `T${reachedNow + 1}`, price: T[nextI], pct: ((T[nextI] - price) / price) * 100, r: r2((T[nextI] - price) / risk) };
  const toStop: LevelDist = { label: stop === entry ? 'Stop (entry)' : stop === T[0] ? 'Stop (T1)' : 'Stop', price: stop, pct: ((stop - price) / price) * 100, r: r2((stop - price) / risk) };
  const lastClose = ok(s.last_close) ? s.last_close! : null;
  const sinceClose = live && lastClose ? ((price - lastClose) / lastClose) * 100 : null;

  const endIfStop = (realised + remainingBooked * (stopBooked - entry)) / risk;
  const action = (() => {
    switch (state) {
      case 'stop-hit':
        return `Stop ${money(stopBooked)} reached at the latest price: the plan exits ${thirds(remainingBooked)} at the stop, or at the open if it gapped below. That ends the trade near ${signed(endIfStop)}R before costs.`;
      case 'target-hit':
        return `${reachedNow - booked > 1 ? `T${booked + 1} to T${reachedNow}` : `T${reachedNow}`} reached at the latest price: the plan sells one third at ${reachedNow - booked > 1 ? 'each' : `T${reachedNow} ${money(T[reachedNow - 1])}`} and moves the stop on the rest to ${reachedNow === 1 ? `entry ${money(entry)}` : `T1 ${money(T[0])}`}.`;
      case 'all-targets':
        return `T3 ${money(T[2])} reached at the latest price: the plan sells the last third there and the trade ends.`;
      case 'time-due':
        return `Time limit: the plan exits ${thirds(remainingBooked)} at today's close unless the stop or a target comes first.`;
      case 'time-passed':
        return `The time limit was the ${sessionLabel(timeDue)} close: the plan exited ${thirds(remainingBooked)} there. The evening run books it.`;
      default:
        return `Hold ${thirds(remainingBooked)}. Stop ${money(stop)} (${Math.abs(toStop.r).toFixed(2)}R below)${toNext ? `, next ${toNext.label} ${money(toNext.price)} (${toNext.r.toFixed(2)}R above)` : ''}${timeDue ? `; time limit: exit at the ${sessionLabel(timeDue)} close` : ''}.`;
    }
  })();
  const moved = state !== 'hold' && state !== 'time-passed' && live;
  return {
    ...base,
    price, source: live ? pv!.source : 'close', session, at, live,
    entry, risk, stop, reachedNow, remaining: remainingBooked,
    r: rTrade, pct: (rTrade * risk / entry) * 100, rOpen: rOpenRaw / risk, rRealised: realised / risk,
    move: ((price - entry) / entry) * 100, sinceClose,
    toStop, toNext, timeDue, sessionsLeft, state, action,
    changed: moved ? { session, at, what: state === 'stop-hit' ? 'Latest price at the stop' : state === 'time-due' ? 'Time limit session' : 'Latest price at a target' } : bookedChange,
  };
}

export const STATE_TEXT: Record<PlanState, string> = {
  'awaiting-entry': 'Waiting for entry', hold: 'Hold', 'stop-hit': 'Stop reached', 'target-hit': 'Target reached', 'all-targets': 'All targets reached',
  'time-due': 'Time limit today', 'time-passed': 'Time limit passed', closed: 'Closed', void: 'Void',
};

/** Where a level sits on the rail, 0-100, on a linear price scale from the lower of the stop and the price to the higher of T3
 *  and the price. Returns every mark the rail draws. */
export function railOf(p: Pick<Position, 'entry' | 'stop' | 'price'> & { sl: number; targets: number[] }): { lo: number; hi: number; at: (v: number) => number } {
  const lo = Math.min(p.sl, p.stop, p.price ?? p.sl);
  const hi = Math.max(p.targets[2], p.price ?? p.targets[2]);
  const span = hi - lo || 1;
  return { lo, hi, at: (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100)) };
}

export interface BookSummary { open: number; marked: number; totalR: number; avgR: number | null; nearStop: number; nearTarget: number; live: number; newest: { session: string | null; at: number | null } }
/** The open paper book. Near = within `near` R of the stop or of the next target at the latest price. */
export function summarise(ps: Position[], near = 0.25): BookSummary {
  const open = ps.filter((p) => p.phase === 'open');
  const marked = open.filter((p) => ok(p.r));
  const totalR = marked.reduce((a, p) => a + (p.r as number), 0);
  let newest: BookSummary['newest'] = { session: null, at: null };
  for (const p of marked) {
    if ((p.session ?? '') > (newest.session ?? '') || (p.session === newest.session && (p.at ?? 0) > (newest.at ?? 0))) newest = { session: p.session, at: p.at };
  }
  return {
    open: open.length,
    marked: marked.length,
    totalR,
    avgR: marked.length ? totalR / marked.length : null,
    nearStop: marked.filter((p) => p.state === 'stop-hit' || (p.toStop && -p.toStop.r <= near)).length,
    nearTarget: marked.filter((p) => p.state === 'target-hit' || p.state === 'all-targets' || (p.toNext && p.toNext.r <= near)).length,
    live: marked.filter((p) => p.live).length,
    newest,
  };
}

/** Which session the engines' `last_close` for ONE stock describes. engines.json carries one `data_through` (the newest bar
 *  across all stocks), not a date per stock, and on 20 Oct 2026 it said 19 Oct while 26 of 31 open signals' last_close was
 *  the 16 Oct close (equal to Yahoo's previous close for 19 Oct). A per-symbol quote (/api/px, range=1d, so `prev` is the
 *  previous session's close) settles it:
 *    price == last_close            -> last_close is the quote's own session;
 *    prev == last_close             -> last_close is the session before the quote's (newer: the quote marks the trade);
 *    neither, quote session >= data_through -> last_close is older than the quote's session, date not known.
 *  Returns the date to label the close with (null when not known) and whether the quote is newer than that close. */
export function closeBasis(lastClose: number | null | undefined, dataThrough: string | null, quote: { price: number; prev: number; at: number | null } | null | undefined, noSession: readonly string[] = []): { closeOn: string | null; quoteNewer: boolean } {
  if (!ok(lastClose) || !quote || !quote.at || !ok(quote.price) || !ok(quote.prev)) return { closeOn: dataThrough, quoteNewer: false };
  const q = istDate(quote.at);
  if (dataThrough && q < dataThrough) return { closeOn: dataThrough, quoteNewer: false };
  if (Math.abs(quote.price - lastClose) < 0.005) return { closeOn: q, quoteNewer: false };
  if (Math.abs(quote.prev - lastClose) < 0.005) {
    const skip = new Set(noSession);
    let t = ymd(q) - DAY;
    while (!isSession(t, skip)) t -= DAY;
    return { closeOn: iso(t), quoteNewer: true };
  }
  return { closeOn: null, quoteNewer: true };
}

/** One signal's price and paper position, the one rule both the Engines page and the company page use: the engines' close for
 *  that stock, dated by closeBasis(), unless the live snapshot or the stock's own quote describes a newer session. */
export function markSignal(s: PlanSignal & { sym: string }, dataThrough: string | null, snap: LiveSnap | null | undefined, quote: { price: number; prev: number; pct: number; at: number | null } | null | undefined, noSession: readonly string[] = []): { pv: PriceView; pos: Position } {
  if (s.status === 'pending') {
    const pv = priceView(s.sym, { price: s.ref_price, last_date: s.date }, snap, quote ?? null);
    return { pv, pos: position(s, pv, s.date, noSession) };
  }
  const b = closeBasis(s.last_close, dataThrough, quote, noSession);
  // an undated close older than the quote's session: date it just before that session so the newer price wins
  const rowDate = b.closeOn ?? (quote?.at ? istDate(quote.at) : dataThrough);
  const pv = priceView(s.sym, { price: s.last_close ?? null, last_date: b.closeOn ?? (rowDate ? iso(ymd(rowDate) - DAY) : null) }, snap, quote ?? null);
  return { pv, pos: position(s, pv, b.closeOn, noSession) };
}
