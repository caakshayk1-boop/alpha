/** Is each stage of the data pipeline as current as the exchange calendar says it should be? Pure: `now` and the facts go in, a verdict per stage comes out.
 *
 *  The stages, in the order data flows:   exchange close -> published screen (as_of) -> nightly ledger night -> ledger outcomes (bars) -> live quotes -> price history for the Lab.
 *  "Expected" always comes from the calendar (calendar.ts), never from "yesterday", so a holiday weekend is not a failure and a missed night is.
 *  A stage is one of: ok, waiting (not yet due; being late would be a fault), late (due and missing, but within a grace), behind (a session or more missing), unknown (no fact to judge by).
 *  The overall verdict is the WORST stage. Nothing here repairs anything or hides a stage that is unknown: unknown is stated. */
import { lastFinishedSession, marketOpenNow, sessionsBetween, istClock, isTradingDay, prevSession, nextSession } from './calendar.ts';

export type Health = 'ok' | 'waiting' | 'late' | 'behind' | 'unknown';
export interface Stage { id: string; label: string; health: Health; expected: string | null; actual: string | null; detail: string }
export interface Facts {
  screenAsOf: string | null; screenBuiltOn: string | null;
  ledgerLastNight: string | null; ledgerUpdated: string | null; pendingOld: number; pendingTotal: number; ledgerRules?: string | null;
  quoteLastAt: number | null; quoteErr: string | null;
  panelLastDay: string | null; panelBuilt: string | null;
}
const RANK: Record<Health, number> = { ok: 0, waiting: 1, late: 2, behind: 3, unknown: 2 };
export const worst = (hs: Health[]): Health => hs.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'ok' as Health);
const behindOf = (actual: string | null, expected: string): number | null => (actual && /^\d{4}-\d{2}-\d{2}$/.test(actual) ? (actual >= expected ? 0 : sessionsBetween(actual, expected)) : null);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function pipelineHealth(f: Facts, nowMs = Date.now()): { stages: Stage[]; overall: Health; expectedSession: string } {
  const expected = lastFinishedSession(nowMs); const { day, mins } = istClock(nowMs); const stages: Stage[] = [];
  // 1. the published screen: due after the close; the build runs in the evening and the morning, so a grace until 09:00 IST the next trading morning
  { const b = behindOf(f.screenAsOf, expected);
    const dueToday = isTradingDay(day) && mins >= 16 * 60;           // today's close has passed but the screen is not built yet
    const h: Health = b === null ? 'unknown' : b === 0 ? 'ok' : b === 1 && (mins < 9 * 60 || dueToday || !isTradingDay(day)) ? 'late' : 'behind';
    stages.push({ id: 'screen', label: 'Published screen', health: h, expected, actual: f.screenAsOf, detail: b === null ? 'The screen carries no data date.' : b === 0 ? `Built on the close of ${f.screenAsOf}, the last finished session.` : `Carries the close of ${f.screenAsOf}; the last finished session is ${expected} (${plural(b, 'session')} behind). Built ${f.screenBuiltOn ?? 'on an unknown day'}.` }); }
  // 2. the ledger night: the engines record one night per screen day
  { const b = behindOf(f.ledgerLastNight, f.screenAsOf ?? expected);
    const h: Health = !f.ledgerLastNight ? 'unknown' : b === 0 ? 'ok' : b === null ? 'unknown' : b === 1 ? 'waiting' : 'behind';
    stages.push({ id: 'ledger-night', label: 'Forward ledger, last night recorded', health: h, expected: f.screenAsOf ?? expected, actual: f.ledgerLastNight, detail: !f.ledgerLastNight ? 'No night recorded yet.' : b === 0 ? `Night of ${f.ledgerLastNight} is in the record${f.ledgerRules ? ` under rule version ${f.ledgerRules}` : ''}.` : `The record's last night is ${f.ledgerLastNight}; the screen is ${f.screenAsOf ?? expected}.` }); }
  // 3. outcomes: a pick older than one finished session should have an entry bar by now
  { const h: Health = f.ledgerUpdated === null ? 'unknown' : f.pendingOld === 0 ? 'ok' : 'late';
    stages.push({ id: 'ledger-bars', label: 'Forward ledger, pick outcomes', health: h, expected: null, actual: f.ledgerUpdated, detail: f.ledgerUpdated === null ? 'The ledger has not been read.' : f.pendingOld === 0 ? `Every pick older than a finished session has an outcome (${plural(f.pendingTotal, 'pick')} still pending, none overdue).` : `${plural(f.pendingOld, 'pick')} older than a finished session still show no entry bar: the price source has not published their bars yet, or the nightly job has not run. Their outcomes are blank, not zero.` }); }
  // 4. live quotes: judged only while the market is open
  { const open = marketOpenNow(nowMs); let h: Health = 'ok'; let detail = '';
    if (f.quoteErr) { h = open ? 'behind' : 'late'; detail = `The price service did not answer: ${f.quoteErr}.`; }
    else if (f.quoteLastAt === null) { h = open ? 'unknown' : 'ok'; detail = open ? 'No quote has been fetched in this visit yet.' : 'The market is shut; quotes are not being asked for.'; }
    else { const age = Math.round((nowMs - f.quoteLastAt) / 1000); if (open && age > 120) { h = 'late'; detail = `Last quote fetched ${age} s ago while the market is open.`; } else detail = open ? `Last quote fetched ${age} s ago.` : `The market is shut; the last fetch was ${age < 3600 ? `${Math.round(age / 60)} min` : `${Math.round(age / 3600)} h`} ago.`; }
    stages.push({ id: 'quotes', label: 'Live quotes', health: h, expected: null, actual: f.quoteLastAt ? new Date(f.quoteLastAt).toISOString() : null, detail }); }
  // 5. the Lab's price history
  { const b = behindOf(f.panelLastDay, expected); const h: Health = b === null ? 'unknown' : b <= 5 ? 'ok' : 'late';
    stages.push({ id: 'panel', label: 'Price history for the Lab', health: h, expected: null, actual: f.panelLastDay, detail: b === null ? 'The price history has not been loaded in this visit.' : `Closes through ${f.panelLastDay} (built ${f.panelBuilt ?? 'unknown'}); rebuilt with the research run, so up to a week old is normal.` }); }
  void prevSession;
  return { stages, overall: worst(stages.map((s) => s.health)), expectedSession: expected };
}
export const HEALTH_WORD: Record<Health, string> = { ok: 'Current', waiting: 'Not due yet', late: 'Late', behind: 'Behind', unknown: 'Unknown' };

/** Picks whose entry session has already finished but which still have no outcome. A pick filed on the close of D enters at the open of the next session; once that
 *  session is over the price source should have its bar. `voided` picks are not counted: they are struck from the record. */
export function overduePending(l: { picks: { id: string; asOf: string }[]; outcomes: Record<string, { status: string; final: boolean } | undefined>; voided?: Record<string, string> }, nowMs = Date.now()): { old: number; total: number } {
  const last = lastFinishedSession(nowMs); let old = 0, total = 0;
  for (const p of l.picks) { if (l.voided?.[p.id]) continue; const o = l.outcomes[p.id]; if (o && o.status !== 'pending') continue; total++; if (nextSession(p.asOf) <= last) old++; }
  return { old, total };
}
