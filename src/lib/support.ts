/** Pure helpers behind the supporting pages (Funds, Calendar, Brief, Rotation). Each one turns a feed's own fields into a
 *  statement the page can make, and refuses to make it when the field is absent. No clock is read here: callers pass `now`.
 *  Tested in tests/lib.test.ts. */
import { expectedSession, sessionsBetween } from './status.ts';

const DAY = 864e5;
const ymd = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ── Funds (E14) ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface NavFreshness {
  newest: string | null;
  oldest: string | null;
  /** The NAV date a daily AMFI feed should already hold at `now` (the last weekday before today in India, after the morning grace). */
  expected: string;
  /** Business days the newest NAV is behind `expected`; 0 when it is current. */
  lag: number;
  state: 'current' | 'delayed' | 'stale' | 'unknown';
  /** How many funds carry an older NAV date than the newest one. */
  behind: number;
}
/** AMFI publishes one NAV per scheme per business day, in the evening. The page's freshness claim is computed from the NAV
 *  dates actually in the feed, judged against the calendar; weekdays known to have had no trading (`skip`) are not counted. */
export function navFreshness(navDates: readonly (string | null | undefined)[], now: Date, skip?: ReadonlySet<string>): NavFreshness {
  const d = navDates.filter(isDate).sort();
  const expected = expectedSession(now, skip);
  if (!d.length) return { newest: null, oldest: null, expected, lag: 0, state: 'unknown', behind: 0 };
  const newest = d[d.length - 1], oldest = d[0];
  const lag = newest >= expected ? 0 : sessionsBetween(newest, expected, skip);
  return { newest, oldest, expected, lag, state: lag === 0 ? 'current' : lag >= 3 ? 'stale' : 'delayed', behind: d.filter((x) => x < newest).length };
}

// ── Calendar (E13) ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** "Next N days" means today and the N − 1 days after it: N calendar days, both ends stated on the page. A date N days away
 *  is outside (it would make "next 7 days" an 8-day window, which is what the old filter did). */
export const inWindow = (daysAhead: number, n: number) => Number.isFinite(daysAhead) && daysAhead >= 0 && daysAhead < n;
/** The last date inside the window that starts on `todayIso`. */
export const windowEnd = (todayIso: string, n: number) => iso(ymd(todayIso) + (n - 1) * DAY);
/** Whole calendar days from `todayIso` to `dateIso` (both YYYY-MM-DD). */
export const daysBetween = (todayIso: string, dateIso: string) => Math.round((ymd(dateIso) - ymd(todayIso)) / DAY);

// ── Brief: rank swings (E07) ────────────────────────────────────────────────────────────────────────────────────────────
interface Ranked { sym: string; comp?: number | null; rank_move?: number | null; delta?: Record<string, number> | null }
/** Composite rank (1 = highest) among the rows that have a composite. Ties share the better rank. */
export function compositeRanks(rows: readonly Ranked[]): { rank: Map<string, number>; of: number } {
  const r = rows.filter((x) => typeof x.comp === 'number' && Number.isFinite(x.comp)).sort((a, b) => (b.comp as number) - (a.comp as number));
  const rank = new Map<string, number>();
  r.forEach((x, i) => rank.set(x.sym, i > 0 && r[i - 1].comp === x.comp ? (rank.get(r[i - 1].sym) as number) : i + 1));
  return { rank, of: r.length };
}
/** Today's rank and the rank the move implies for the previous build (a move "up 8" was 8 places lower). Null without a rank or a move. */
export function rankSwing(row: Ranked, rank: Map<string, number>): { now: number; before: number; move: number } | null {
  const now = rank.get(row.sym), mv = row.rank_move;
  if (now === undefined || typeof mv !== 'number' || !Number.isFinite(mv) || mv === 0) return null;
  return { now, before: now + mv, move: mv };
}
/** What each delta key is, and whether prices alone can move it. A score built from statements (quality, growth) only changes
 *  when the statements behind it change: new results, or a revision to figures already published. The feed does not say which. */
export const FACTORS: Record<string, { label: string; kind: 'market' | 'statements' | 'composite' }> = {
  comp: { label: 'Composite', kind: 'composite' },
  tech: { label: 'Technical score', kind: 'market' },
  rsi: { label: 'RSI', kind: 'market' },
  pe: { label: 'P/E', kind: 'market' },
  v: { label: 'Valuation score', kind: 'market' },
  m_inv: { label: 'Investor-horizon blend', kind: 'market' },
  m_pos: { label: 'Position-horizon blend', kind: 'market' },
  m_swing: { label: 'Swing-horizon blend', kind: 'market' },
  q: { label: 'Quality score', kind: 'statements' },
  g: { label: 'Growth score', kind: 'statements' },
};
export interface DeltaRead { factors: { key: string; label: string; v: number; kind: 'market' | 'statements' }[]; cause: 'market' | 'statements' | 'mixed' | 'unknown' }
/** The changed factors, largest first, and the cause they point to: prices only, statements only, or both. */
export function readDelta(delta: Record<string, number> | null | undefined): DeltaRead {
  const f = Object.entries(delta ?? {})
    .filter(([k, v]) => typeof v === 'number' && Number.isFinite(v) && v !== 0 && FACTORS[k] && FACTORS[k].kind !== 'composite')
    .map(([key, v]) => ({ key, label: FACTORS[key].label, v, kind: FACTORS[key].kind as 'market' | 'statements' }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const m = f.some((x) => x.kind === 'market'), s = f.some((x) => x.kind === 'statements');
  return { factors: f, cause: m && s ? 'mixed' : s ? 'statements' : m ? 'market' : 'unknown' };
}

// ── Brief: seasonal record (E08) ────────────────────────────────────────────────────────────────────────────────────────
export interface SeasonRec { hit: number; median: number; n: number; up: number; down: number }
/** One month's record, [hit %, median %, observations], with the counts of up and down years spelled out. Null when malformed. */
export function seasonRec(rec: readonly number[] | null | undefined): SeasonRec | null {
  if (!rec || rec.length < 3 || !rec.every((x) => typeof x === 'number' && Number.isFinite(x)) || rec[2] <= 0) return null;
  const [hit, median, n] = rec;
  const up = Math.round((hit / 100) * n);
  return { hit, median, n, up, down: n - up };
}
/** Whether the month now running can be in the sample: not if the feed was built before the month began. When it was built
 *  inside the month, only the feed's own "completed observations" rule keeps it out, and the page says so instead. */
export function currentMonthExcluded(generatedAt: string | null | undefined, now: Date): 'before-month' | 'by-rule' | 'unknown' {
  const g = generatedAt ? new Date(generatedAt) : null;
  if (!g || Number.isNaN(g.getTime())) return 'unknown';
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return g.getTime() < start ? 'before-month' : 'by-rule';
}

// ── Rotation (E09) ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** The latest weekly point's status: a week that ends after the newest daily bar is still running. */
export function weekStatus(weekEnding: string | null | undefined, dataThrough: string | null | undefined): { inProgress: boolean; through: string | null } {
  if (!isDate(weekEnding)) return { inProgress: false, through: null };
  if (!isDate(dataThrough) || dataThrough >= weekEnding) return { inProgress: false, through: weekEnding };
  return { inProgress: true, through: dataThrough };
}
