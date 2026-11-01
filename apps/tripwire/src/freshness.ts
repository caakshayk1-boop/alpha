/** ONE answer to "how current is this data?", for every file and every surface. Pure and dependency-free apart from the exchange calendar (calendar.ts), so the
 *  same file is imported by the browser, the Worker and the build's checks (node strips the types), and no second copy of a session rule can exist.
 *
 *  THE RULE. A daily file carries the close of one NSE session. The session it SHOULD carry is the last one whose close has passed (16:00 IST, calendar.ts).
 *  The publisher builds that close in the evening of the same day (screen 21:00 IST, retry 23:00; the Tripwire deploy 23:45 IST; catch-up 04:15 IST), so for
 *  a defined window after the close the previous session is still the newest one that CAN exist:
 *      GRACE   from the finished session's 16:00 IST until 23:30 IST on that same Indian calendar day, one session behind is 'pending', not stale.
 *      Outside it (23:30 onwards, any later day, a weekend, a holiday gap) one session or more behind is 'stale'.
 *  Counting is in SESSIONS, never days, so a weekend or an NSE holiday is not lateness. Nothing here repairs or hides anything: unreadable is 'unknown'. */
import { istClock, lastFinishedSession as lastFinished, sessionsBetween } from './calendar.ts';

export const BUILD_DEADLINE_MIN = 23 * 60 + 30;
export type Status = 'current' | 'pending' | 'stale' | 'unknown' | 'missing';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The session a daily file should carry right now: the last whose close has passed. */
export const expectedSession = (nowMs = Date.now()): string => lastFinished(nowMs);
export const lastFinishedSession = (now: Date | number = new Date()): string => lastFinished(typeof now === 'number' ? now : now.getTime());
/** True inside the window in which the finished session's own data is still being built (see GRACE above). */
export function inBuildWindow(nowMs = Date.now()): boolean { const { day, mins } = istClock(nowMs); return day === expectedSession(nowMs) && mins < BUILD_DEADLINE_MIN; }
/** Whole sessions between a data day and the expected one; 0 when current; null when the date is unreadable. */
export function sessionsBehind(dataDay: string | null | undefined, now: Date | number = new Date()): number | null {
  if (!dataDay || !ISO.test(dataDay)) return null;
  const ms = typeof now === 'number' ? now : now.getTime(); const last = expectedSession(ms); return dataDay >= last ? 0 : sessionsBetween(dataDay, last);
}
export function statusOf(dataDay: string | null | undefined, nowMs = Date.now()): { status: Status; behind: number | null } {
  if (dataDay === undefined || dataDay === null) return { status: 'missing', behind: null };
  const b = sessionsBehind(dataDay, nowMs); if (b === null) return { status: 'unknown', behind: null };
  if (b === 0) return { status: 'current', behind: 0 };
  return { status: b === 1 && inBuildWindow(nowMs) ? 'pending' : 'stale', behind: b };
}
/** "Fri 30 Oct". Self-contained so the build can print it. */
export function throughWord(iso: string | null | undefined): string { if (!iso || !ISO.test(iso)) return 'an unknown date'; const [y, m, d] = iso.split('-').map(Number); return `${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MON[m - 1]}`; }
/** "02:16 IST" from an ISO instant with or without an offset; null when unreadable. */
export function builtWord(iso: string | null | undefined): string | null {
  const ms = iso ? Date.parse(iso) : NaN; if (!Number.isFinite(ms)) return null; const d = new Date(ms + 330 * 60000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} IST`;
}

/* ---- the old one-word label, kept for the surfaces that print it (screen header, company page) ---- */
export type Fresh = { word: 'Current' | 'One session behind' | 'Behind' | 'Unknown'; behind: number | null; tone: 'lime' | 'peach' | ''; pending: boolean };
export function freshness(dataDay: string | null | undefined, now: Date | number = new Date()): Fresh {
  const ms = typeof now === 'number' ? now : now.getTime(); const s = statusOf(dataDay ?? null, ms);
  if (s.behind === null) return { word: 'Unknown', behind: null, tone: 'peach', pending: false };
  if (s.behind === 0) return { word: 'Current', behind: 0, tone: 'lime', pending: false };
  return { word: s.behind === 1 ? 'One session behind' : 'Behind', behind: s.behind, tone: 'peach', pending: s.status === 'pending' };
}

/* ---- the files ---- */
export type FileId = 'screen' | 'companies' | 'signals' | 'breadth' | 'ledger' | 'rsi' | 'factors';
/** Every daily file, in the order the Data screen lists them. `asOf` is the session its figures describe. */
export const FILE_LABELS: Record<FileId, string> = { screen: 'Screen (/data/screen.json)', companies: 'Company files (/data/c/*.json)', signals: 'Signals (/data/signals.json)', breadth: 'Trend map (/api/breadth)', ledger: 'Forward record (/api/ledger)', rsi: 'RSI sheet (/api/rsi)', factors: 'Factor sheet (/api/factors)' };
export const FILE_IDS = Object.keys(FILE_LABELS) as FileId[];
export interface FileFact { id: FileId; asOf: string | null | undefined; built?: string | null; rows?: number | null; note?: string }
export interface FileVerdict { id: FileId; label: string; asOf: string | null; built: string | null; rows: number | null; status: Status; behind: number | null; note: string | null }
export function assessFiles(facts: readonly FileFact[], nowMs = Date.now()): { files: FileVerdict[]; worst: Status; expected: string; pending: boolean } {
  const files = facts.map((f): FileVerdict => { const s = statusOf(f.asOf, nowMs); return { id: f.id, label: FILE_LABELS[f.id], asOf: f.asOf ?? null, built: f.built ?? null, rows: f.rows ?? null, status: s.status, behind: s.behind, note: f.note ?? null }; });
  const rank: Record<Status, number> = { current: 0, pending: 1, unknown: 2, missing: 2, stale: 3 };
  const worst = files.reduce<Status>((a, b) => (rank[b.status] > rank[a] ? b.status : a), 'current');
  return { files, worst, expected: expectedSession(nowMs), pending: files.some((f) => f.status === 'pending') };
}
export interface Pill { tone: 'ok' | 'pending' | 'stale'; text: string; detail: string }
/** The status pill: the screen's data day and build time, and in words which files are behind. Never claims "live": these are closes. */
export function pillOf(files: readonly FileVerdict[], nowMs = Date.now()): Pill | null {
  const scr = files.find((f) => f.id === 'screen'); if (!scr || !scr.asOf) return null;
  const b = builtWord(scr.built); const head = `Data through ${throughWord(scr.asOf)}${b ? ` · built ${b}` : ''}`;
  const bad = files.filter((f) => f.status === 'stale' || f.status === 'unknown' || f.status === 'missing'); const pend = files.filter((f) => f.status === 'pending');
  const exp = expectedSession(nowMs);
  if (bad.length) { const names = bad.map((f) => `${f.label.replace(/ \(.*/, '')} ${f.status === 'stale' ? `${f.behind} session${f.behind === 1 ? '' : 's'} behind` : f.status === 'missing' ? 'not published' : 'date unreadable'}`).join('; ');
    return { tone: 'stale', text: head, detail: `Behind the ${throughWord(exp)} close: ${names}.` }; }
  if (pend.length) return { tone: 'pending', text: head, detail: `The ${throughWord(exp)} close is being built; the evening build finishes by 23:30 IST.` };
  return { tone: 'ok', text: head, detail: `Every file carries the ${throughWord(exp)} close, the last finished session.` };
}

/* ---- the build-time assertions, pure so a test can drive them with a deliberately staled fixture ---- */
export interface ScreenRowLike { sym: string; sector?: string | null; tier?: string | null; last_date?: string | null; stale?: boolean }
export interface Policy {
  /** symbols whose sector the feed does not publish and that are mapped in the build (see SECTOR_FIX in build.mjs) */
  knownNullSector?: readonly string[];
  /** the largest share of rows that may carry no size class (the feed publishes one for index-sized names only; see rules.ts elig-2 D1) */
  maxNullTierShare?: number;
}
export function assertScreen(screen: { as_of?: string | null; rows: readonly ScreenRowLike[] }, nowMs = Date.now(), policy: Policy = {}): string[] {
  const bad: string[] = []; const exp = expectedSession(nowMs); const s = statusOf(screen.as_of ?? null, nowMs);
  if (s.status !== 'current' && s.status !== 'pending') bad.push(`screen as_of ${screen.as_of ?? 'missing'} is ${s.behind === null ? 'unreadable' : `${s.behind} session${s.behind === 1 ? '' : 's'} behind`}; the last completed NSE session is ${exp}`);
  // 2.3: no row older than as_of minus one session unless it says so
  const asOf = screen.as_of && ISO.test(screen.as_of) ? screen.as_of : exp; const old = screen.rows.filter((r) => r.last_date && ISO.test(r.last_date) && sessionsBetween(r.last_date, asOf) > 1 && !r.stale);
  if (old.length) bad.push(`${old.length} row(s) older than as_of ${asOf} by more than one session and not flagged stale: ${old.slice(0, 8).map((r) => `${r.sym} ${r.last_date}`).join(', ')}`);
  const nolast = screen.rows.filter((r) => !r.last_date && !r.stale); if (nolast.length) bad.push(`${nolast.length} row(s) with no last_date and not flagged stale: ${nolast.slice(0, 8).map((r) => r.sym).join(', ')}`);
  const nosec = screen.rows.filter((r) => !r.sector && !(policy.knownNullSector ?? []).includes(r.sym)); if (nosec.length) bad.push(`${nosec.length} row(s) with no sector: ${nosec.slice(0, 8).map((r) => r.sym).join(', ')}`);
  const cap = policy.maxNullTierShare ?? 0.35; const notier = screen.rows.filter((r) => !r.tier).length;
  if (screen.rows.length && notier / screen.rows.length > cap) bad.push(`${notier} of ${screen.rows.length} rows (${((notier / screen.rows.length) * 100).toFixed(1)}%) have no size class, above the ${(cap * 100).toFixed(0)}% the published rule allows for`);
  return bad;
}
