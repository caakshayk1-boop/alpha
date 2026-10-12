/** The data-status contract. One vocabulary for "how current is this number", shared by every page.
 *
 *  Three different times are never mixed up:
 *    asOf         the market session (or period) the values DESCRIBE
 *    refreshedAt  when the source last SUCCEEDED in updating that dataset
 *    (render time is never shown as freshness)
 *
 *  Freshness is decided relative to Alpha's own datasets, never the wall clock: a dataset is `current` when its session is the
 *  newest session any dataset carries, and `delayed` when it is that many trading sessions (weekdays) behind. Exchange holidays are
 *  not known here, so a gap that spans one can read one session longer than it was. `stale` is reserved for a dataset that is
 *  STALE_AFTER_SESSIONS or more behind the newest. */
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
}
export interface DataStatus extends DatasetInput { state: Freshness; lagSessions: number; reference: string | null }

const DAY = 86400000;
const ymd = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

/** Whole weekdays from `from` (exclusive) to `to` (inclusive); 0 when `to` is not later. */
export function sessionsBetween(from: string, to: string): number {
  let a = ymd(from);
  const b = ymd(to);
  let n = 0;
  while (a < b) {
    a += DAY;
    const d = new Date(a).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

/** Decide every dataset's state against the newest session among them. Pure: no clock, no network. */
export function reconcile(items: DatasetInput[]): DataStatus[] {
  const dated = items.filter((i) => i.asOf && !i.error).map((i) => i.asOf as string);
  const reference = dated.length ? dated.reduce((a, b) => (a > b ? a : b)) : null;
  return items.map((i) => {
    let lag = 0;
    let state: Freshness;
    if (i.error) state = 'error';
    else if (!i.asOf) state = i.refreshedAt ? 'partial' : 'unavailable';
    else {
      lag = reference ? sessionsBetween(i.asOf, reference) : 0;
      state = lag === 0 ? 'current' : lag >= STALE_AFTER_SESSIONS ? 'stale' : 'delayed';
      if (i.partial && state === 'current') state = 'partial';
    }
    return { ...i, state, lagSessions: lag, reference };
  });
}

/** Human wording for a state, with the lag spelled out. */
export function describe(s: DataStatus): string {
  switch (s.state) {
    case 'current': return 'current';
    case 'delayed': return `${s.lagSessions} session${s.lagSessions === 1 ? '' : 's'} behind the newest data`;
    case 'stale': return `stale: ${s.lagSessions} sessions behind the newest data`;
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
