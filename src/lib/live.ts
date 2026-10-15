/** NSE session clock from the time alone (weekday, 09:15-15:30 IST). It cannot know holidays, so it is only ever used to say
 *  when the next open or close is due; whether trading is actually happening comes from fresh trades (sessionOf). */
export function nseClock(now = Date.now()): { inHours: boolean; nextLabel: string; minutesToNext: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  const mins = Number(p.hour) % 24 * 60 + Number(p.minute);
  const OPEN = 9 * 60 + 15, CLOSE = 15 * 60 + 30;
  const weekday = wd >= 0 && wd <= 4;
  if (weekday && mins >= OPEN && mins < CLOSE) return { inHours: true, nextLabel: 'closes 15:30 IST', minutesToNext: CLOSE - mins };
  // next weekday open
  let days = 0, d = wd;
  if (weekday && mins < OPEN) days = 0; else { do { days++; d = (d + 1) % 7; } while (d > 4); }
  const until = days * 1440 + OPEN - mins;
  const dayName = days === 0 ? 'today' : days === 1 ? 'tomorrow' : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d];
  return { inHours: false, nextLabel: `opens 09:15 IST ${dayName}`, minutesToNext: until };
}

/** One clock for "today" across the site.
 *
 *  Two sources describe a trading day: the end-of-day screen (screen.json, built overnight by the data repo) and the live
 *  snapshot of the same ~990 stocks (/api/live, Yahoo, cached 60 s). The rule every page follows: the day's figures (breadth,
 *  sector moves, movers, heat map colours, "today %") come from whichever source describes the NEWER session; on a tie the
 *  end-of-day screen wins, because it is the vetted close. So during market hours and in the evening before the overnight
 *  build, the day is live; once the screen catches up, it is the screen. Every view labels which one it shows and when.
 *  Pure functions only: tested in tests/lib.test.ts. */

export type LiveQuote = [price: number, prevClose: number, lastTradeEpochS: number];
export interface LivePart { ok: boolean; part: number; parts: number; fetched_at: string; count: number; quotes: Record<string, LiveQuote> }
export interface Universe { built_on: string; as_of: string | null; count: number; rows: [sym: string, sector: string, name: string][] }

export interface LiveSnap {
  /** symbol -> one-day change in percent, rounded to 2 dp, from the live price against the previous close */
  pct: Record<string, number>;
  price: Record<string, number>;
  /** symbol -> its own last trade (epoch seconds); a symbol whose last trade is in an older session than `session` is stale (suspended, renamed) */
  at: Record<string, number>;
  /** newest trade in the snapshot (epoch seconds) and the IST session date it belongs to */
  newest: number;
  session: string;
  /** stocks priced but not traded in `session` (suspended, or a corporate action the feed has not adjusted for): they keep
   *  price and `at` but have NO `pct`, so no page can count, colour or rank them as today's move. */
  stale: string[];
  /** stocks with a move in `session` (excludes stale) */
  count: number;
  universe: number;
  fetchedAt: string;
}

const IST_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
/** The IST calendar date of an epoch-seconds timestamp, as YYYY-MM-DD. */
export const istDate = (epochS: number): string => IST_DATE.format(new Date(epochS * 1000));

/** Merge the Worker's halves into one snapshot. A half that failed is simply missing (count shows it), never zero-filled. */
export function mergeLive(parts: (LivePart | null | undefined)[], universe: number): LiveSnap | null {
  const pct: Record<string, number> = {};
  const price: Record<string, number> = {};
  const at: Record<string, number> = {};
  let newest = 0;
  let fetchedAt = '';
  for (const p of parts) {
    if (!p?.ok) continue;
    if (p.fetched_at > fetchedAt) fetchedAt = p.fetched_at;
    for (const [sym, q] of Object.entries(p.quotes)) {
      const [px, prev, t] = q;
      if (!(px > 0) || !(prev > 0) || !(t > 0)) continue;
      pct[sym] = Math.round(((px - prev) / prev) * 10000) / 100;
      price[sym] = px;
      at[sym] = t;
      if (t > newest) newest = t;
    }
  }
  if (!newest) return null;
  const session = istDate(newest);
  // CCAVENUE, 15 Oct 2026: last traded 12 Oct, previous close 13.83 against 138.50 (an unadjusted consolidation) = "+901%".
  const stale = Object.keys(at).filter((sym) => istDate(at[sym]) !== session).sort();
  for (const sym of stale) delete pct[sym];
  const count = Object.keys(pct).length;
  if (!count) return null;
  return { pct, price, at, newest, session, stale, count, universe, fetchedAt };
}

export interface DayFigures {
  source: 'live' | 'close';
  /** the IST session these figures describe */
  session: string;
  up: number; down: number; flat: number; counted: number;
  sectors: { name: string; n: number; median: number }[];
  /** live only: universe stocks with a quote whose last trade is in an older session, left out of every figure */
  stale?: number;
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

/** True when a symbol traded in the snapshot's own session. A quote whose last trade is older (suspended, renamed, or a
 *  previous close the source never adjusted: CCAVENUE showed +901% on 15 Oct off a 12 Oct trade) has no move for this day. */
export const inSession = (snap: LiveSnap, sym: string): boolean => typeof snap.pct[sym] === 'number' && snap.at[sym] > 0 && istDate(snap.at[sym]) === snap.session;

/** The day's breadth and sector medians from a live snapshot, over the screen's universe and its sectors. Stale quotes
 *  (see inSession) are left out and counted in `stale`. */
export function dayFromLive(snap: LiveSnap, uni: Universe): DayFigures {
  let up = 0, down = 0, flat = 0, stale = 0;
  const bySector = new Map<string, number[]>();
  // mergeLive already removed the move of every stock not traded this session (snap.stale); count those in the universe so
  // pages can say how many were left out. inSession stays as a second guard for snapshots built elsewhere.
  const staleSet = new Set(snap.stale ?? []);
  for (const [sym, sector] of uni.rows) {
    if (staleSet.has(sym)) { stale++; continue; }
    const v = snap.pct[sym];
    if (typeof v !== 'number') continue;
    if (!inSession(snap, sym)) { stale++; continue; }
    if (v > 0) up++; else if (v < 0) down++; else flat++;
    if (sector) bySector.set(sector, [...(bySector.get(sector) ?? []), v]);
  }
  const sectors = [...bySector.entries()].map(([name, a]) => ({ name, n: a.length, median: Math.round(median(a) * 100) / 100 })).sort((a, b) => b.median - a.median || a.name.localeCompare(b.name));
  return { source: 'live', session: snap.session, up, down, flat, counted: up + down + flat, sectors, stale };
}

/** Which source describes the day. Live only when it is a newer session than the close AND covers most of the universe
 *  (a half that failed must not turn 495 stocks into "the market"). */
export function pickDay(close: DayFigures | null, live: DayFigures | null, liveCoverage: number): DayFigures | null {
  if (live && liveCoverage >= 0.9 && (!close || live.session > close.session)) return live;
  return close ?? null;
}
