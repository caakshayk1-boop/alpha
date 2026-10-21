/** The data-status contract. One vocabulary for "how current is this number", shared by every page.
 *
 *  Three different times are never mixed up:
 *    asOf         the market session (or period) the values DESCRIBE
 *    refreshedAt  when the source last SUCCEEDED in updating that dataset
 *    (render time is never shown as freshness)
 *
 *  Freshness is decided against the CALENDAR when a clock is supplied: `expectedSession(now)` is the session Alpha should already hold
 *  (India time, with a grace period for the morning build), and a dataset is `current` when it describes that session or a later one.
 *  A weekly dataset (the rotation graph) is judged against the last completed week instead. Without a clock the old rule applies:
 *  `current` means "as new as the newest dataset", which cannot notice every dataset freezing together.
 *  `delayed` is 1 or 2 sessions behind (1 week for a weekly dataset); `stale` is STALE_AFTER_SESSIONS or more (2 weeks for weekly).
 *  Exchange holidays are not known here, so a gap that spans one can read one session longer than it was. */
export type Freshness = 'current' | 'delayed' | 'stale' | 'partial' | 'missing' | 'unavailable' | 'error';

export const STALE_AFTER_SESSIONS = 3;

export interface DatasetInput {
  id: string;
  label: string;
  source: string;
  asOf: string | null;          // YYYY-MM-DD
  refreshedAt: string | null;   // ISO timestamp or YYYY-MM-DD
  partial?: boolean;
  error?: boolean;
  note?: string;
  /** How often the dataset describes a new period. Default daily; the rotation graph is weekly (week-ending Friday). */
  cadence?: 'daily' | 'weekly';
}
export interface DataStatus extends DatasetInput {
  state: Freshness;
  /** Sessions behind for a daily dataset, weeks behind for a weekly one. */
  lagSessions: number;
  unit: 'session' | 'week';
  /** The session (or week-ending Friday) this dataset was judged against. */
  reference: string | null;
  /** What `reference` is: the calendar's expected session, or just the newest dataset. */
  basis: 'calendar' | 'newest';
}

const DAY = 86400000;
const ymd = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

/** Whole weekdays from `from` (exclusive) to `to` (inclusive), less any day in `skip` known to have had no trading; 0 when `to` is not later. */
export function sessionsBetween(from: string, to: string, skip?: ReadonlySet<string>): number {
  let a = ymd(from);
  const b = ymd(to);
  let n = 0;
  while (a < b) {
    a += DAY;
    const d = new Date(a).getUTCDay();
    if (d !== 0 && d !== 6 && !skip?.has(new Date(a).toISOString().slice(0, 10))) n++;
  }
  return n;
}

/** Weekdays proven to have had no trading: a weekday strictly between two of the NSE's own session dates that is not one of
 *  them (20 Oct 2026, Diwali, between the 19 and 21 Oct bars). Days after the newest session prove nothing (a bar can be late). */
export function sessionGaps(sessions: readonly string[] | null | undefined): string[] {
  const s = [...new Set(sessions ?? [])].filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
  const have = new Set(s);
  const out: string[] = [];
  for (let i = 1; i < s.length; i++) {
    for (let d = addDays(s[i - 1], 1); d < s[i]; d = addDays(d, 1)) if (weekday(d) !== 0 && weekday(d) !== 6 && !have.has(d)) out.push(d);
  }
  return out;
}

const addDays = (s: string, n: number) => new Date(ymd(s) + n * DAY).toISOString().slice(0, 10);
const weekday = (s: string) => new Date(ymd(s)).getUTCDay();
const lastFridayOnOrBefore = (s: string) => { let d = s; while (weekday(d) !== 5) d = addDays(d, -1); return d; };

/** The session whose data Alpha should already hold at `now`: the last weekday strictly before the India (UTC+5:30) date of `now`
 *  minus 7 hours, so the 05:10 IST morning screen build is on time until 07:00 IST. Exchange holidays are not known. */
export function expectedSession(now: Date, skip?: ReadonlySet<string>): string {
  let d = new Date(now.getTime() - 1.5 * 3600000).toISOString().slice(0, 10);   // UTC+5:30 minus 7h grace = UTC minus 1.5h
  do { d = addDays(d, -1); } while (weekday(d) === 0 || weekday(d) === 6 || skip?.has(d));
  return d;
}

/** Decide every dataset's state. With `expected` (see expectedSession) each is judged against the calendar; without it, against the newest dataset. Pure: no clock, no network. */
export function reconcile(items: DatasetInput[], expected?: string | null, skip?: ReadonlySet<string>): DataStatus[] {
  const dailyDates = items.filter((i) => i.asOf && !i.error && i.cadence !== 'weekly').map((i) => i.asOf as string);
  const newest = dailyDates.length ? dailyDates.reduce((a, b) => (a > b ? a : b)) : null;
  const basis: 'calendar' | 'newest' = expected ? 'calendar' : 'newest';
  const reference = expected ?? newest;
  return items.map((i) => {
    const weekly = i.cadence === 'weekly';
    const target = reference ? (weekly ? lastFridayOnOrBefore(reference) : reference) : null;
    let lag = 0;
    let state: Freshness;
    if (i.error) state = 'error';
    else if (!i.asOf) state = i.refreshedAt ? 'partial' : 'unavailable';
    else {
      if (target && i.asOf < target) lag = weekly ? Math.round((ymd(target) - ymd(i.asOf)) / (7 * DAY)) : sessionsBetween(i.asOf, target, skip);
      state = lag === 0 ? 'current' : lag >= (weekly ? 2 : STALE_AFTER_SESSIONS) ? 'stale' : 'delayed';
      if (i.partial && state === 'current') state = 'partial';
    }
    return { ...i, state, lagSessions: lag, unit: weekly ? 'week' : 'session', reference: target, basis };
  });
}

/** The rotation graph labels its latest point with the Friday that ENDS the week, even while that week is still running, so on a Tuesday
 *  the last label is a date three days in the future. What the data actually runs to is the newest daily bar behind it: the engines'
 *  `data_through` when known, otherwise the date the file was generated. A label after that date is the week IN PROGRESS. With neither
 *  date known nothing is claimed and the label stands. */
export function weekThrough(weekEnding: string, dataThrough: string | null, generated: string | null): { through: string; inProgress: boolean } {
  const ref = dataThrough ?? (generated ? generated.slice(0, 10) : null);
  if (!ref || ref >= weekEnding) return { through: weekEnding, inProgress: false };
  return { through: ref, inProgress: true };
}

/** Human wording for a state, with the lag spelled out. */
export function describe(s: DataStatus): string {
  const unit = s.unit === 'week' ? 'week' : 'session';
  const against = s.basis === 'calendar' ? `the expected ${unit}` : 'the newest data';
  switch (s.state) {
    case 'current': return 'current';
    case 'delayed': return `${plural(s.lagSessions, unit)} behind ${against}`;
    case 'stale': return `stale: ${plural(s.lagSessions, unit)} behind ${against}`;
    case 'partial': return s.asOf ? 'partial' : 'no session date in the feed';
    case 'missing': return 'missing';
    case 'unavailable': return 'unavailable';
    default: return 'could not be loaded';
  }
}

/** English ordinal: 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st, 82nd. */
export function ordinal(n: number): string {
  const r = Math.round(n);
  const v = Math.abs(r) % 100;
  const suf = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[Math.abs(r) % 10] ?? 'th';
  return `${r}${suf}`;
}

/** "1 day", "2 days": never "1 days". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Where a value ranks among its peers, in words that cannot read "higher than 100%". `pct` is 0 to 100. */
export function rankPhrase(pct: number): string {
  const p = Math.round(pct);
  if (p >= 99) return 'at the very top of the range';
  if (p <= 1) return 'at the very bottom of the range';
  return p >= 50 ? `higher than about ${p}% of the others` : `lower than about ${100 - p}% of the others`;
}
