// Task 1.2: the ledger job's build-time assertions. The fixtures reproduce the 30 Oct 2026 fault (picks through 29 Oct, outcomes marked through 28 Oct, ECLERX stopped on 29 Oct still "open").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyLedger, evaluateLedger, pickId, takenAtFor, type Ledger, type LedgerPick, type Outcome } from '../src/ledger.ts';
import { checkFinalsAgainstBars, checkMarksCurrent, checkStagesAgree, formatViolations, runChecks, sessionLag, stageSessions } from '../src/ledgerchecks.ts';
import type { Bar } from '../src/tracker.ts';

const pick = (asOf: string, sym: string, o: Partial<LedgerPick> = {}): LedgerPick => ({ id: pickId(asOf, 'QLT', sym), engine: 'QLT', sym, asOf, ref: 1700, stop: 1650, horizon: 60, score: 80, rank: 1, ...o });
const day = (asOf: string) => ({ asOf, recorded: `${asOf}T20:00:00Z`, engines: {} });
const led = (asOf: string[], picks: LedgerPick[], outcomes: Record<string, Outcome>, voided?: Record<string, string>): Ledger => ({ ...emptyLedger('2026-10-29T00:00:00Z'), days: asOf.map(day), picks, outcomes, ...(voided ? { voided } : {}) });
const open = (markDay: string): Outcome => ({ status: 'open', final: false, entry: 1700, entryDay: '2026-10-27', mark: 1710, markDay });
const pending = (markDay?: string): Outcome => ({ status: 'pending', final: false, ...(markDay ? { markDay } : {}) });
// 08:00 India time on Fri 30 Oct 2026: the 29 Oct session is the last one completed
const FRI_MORNING = Date.parse('2026-10-30T02:30:00Z'); const SAT = Date.parse('2026-10-31T02:00:00Z');

test('(a) the 30 Oct fault: picks written through 29 Oct, every outcome marked only through 28 Oct, fails and says both dates', () => {
  const a = pick('2026-10-28', 'HCLTECH'), b = pick('2026-10-29', 'HCLTECH');
  const l = led(['2026-10-28', '2026-10-29'], [a, b], { [a.id]: open('2026-10-28'), [b.id]: pending('2026-10-28') });
  assert.deepEqual(stageSessions(l), { pick: '2026-10-29', marked: '2026-10-28' });
  const v = checkStagesAgree(l); assert.equal(v.length, 1); assert.match(v[0].message, /outcomes were marked only through 2026-10-28/); assert.match(v[0].message, /through 2026-10-29/);
  assert.ok(formatViolations(v)[0].startsWith('CHECK A FAILED'));
});
test('(a) agreement is the picks night reached by the outcomes; a latest-night pick that is still pending is the legitimate case and passes', () => {
  const a = pick('2026-10-28', 'HCLTECH'), b = pick('2026-10-29', 'HCLTECH');
  const l = led(['2026-10-28', '2026-10-29'], [a, b], { [a.id]: open('2026-10-29'), [b.id]: pending('2026-10-29') });   // b: replayed against its own signal-day bar, no entry bar yet
  assert.deepEqual(checkStagesAgree(l), []);
  assert.deepEqual(checkMarksCurrent(l, FRI_MORNING), []);
});
test('(a) outcomes ahead of the picks (the published screen is stale) is also a disagreement; no outcome bars at all is one too; voided picks do not count', () => {
  const a = pick('2026-10-28', 'HCLTECH');
  assert.match(checkStagesAgree(led(['2026-10-28'], [a], { [a.id]: open('2026-10-29') }))[0].message, /ahead of the pick stage/);
  assert.match(checkStagesAgree(led(['2026-10-28'], [a], { [a.id]: pending() }))[0].message, /no outcome was replayed/);
  assert.deepEqual(checkStagesAgree(led(['2026-10-28'], [a], { [a.id]: open('2026-10-29') }, { [a.id]: 'void' })), [], 'every pick voided: nothing is replayed, so nothing can lag');
  assert.deepEqual(checkStagesAgree(led([], [], {})), []);
});
test('(b) an open position marked older than the last completed session fails, per position; a pick still pending after its entry session finished fails; the latest night may be pending', () => {
  const eclerx = pick('2026-10-23', 'ECLERX'), tired = pick('2026-10-28', 'PETRONET'), fresh = pick('2026-10-29', 'PETRONET', { stop: 260 });
  const l = led(['2026-10-23', '2026-10-28', '2026-10-29'], [eclerx, tired, fresh], { [eclerx.id]: open('2026-10-28'), [tired.id]: pending('2026-10-28'), [fresh.id]: pending('2026-10-29') });
  const v = checkMarksCurrent(l, FRI_MORNING);
  assert.deepEqual(v.map((x) => x.id), [eclerx.id, tired.id]);
  assert.match(v[0].message, /marked through 2026-10-28, but the last completed session is 2026-10-29 \(1 behind\)/);
  assert.match(v[1].message, /still pending although its entry session 2026-10-29 has finished/);
});
test('(b) uses the exchange calendar: on a Saturday the last completed session is Friday; before the 16:00 settle it is the day before; a holiday is skipped', () => {
  const a = pick('2026-10-30', 'HCLTECH');
  assert.deepEqual(checkMarksCurrent(led(['2026-10-30'], [a], { [a.id]: pending('2026-10-30') }), SAT), []);
  const b = pick('2026-10-29', 'HCLTECH');
  assert.equal(checkMarksCurrent(led(['2026-10-29'], [b], { [b.id]: open('2026-10-29') }), SAT).length, 1, 'Saturday: Thursday is a session behind');
  assert.deepEqual(checkMarksCurrent(led(['2026-10-29'], [b], { [b.id]: open('2026-10-29') }), Date.parse('2026-10-30T07:00:00Z')), [], 'Friday 12:30 India time: Thursday is still the last completed session');
  const c = pick('2026-11-09', 'HCLTECH');   // Tue 10 Nov 2026 is Diwali-Balipratipada: the session after Mon 9 Nov is Wed 11 Nov
  assert.deepEqual(checkMarksCurrent(led(['2026-11-09'], [c], { [c.id]: pending('2026-11-09') }), Date.parse('2026-11-10T08:00:00Z')), []);
});
test('(b) an outcome that is final is not asked for a mark; a pick with no outcome at all fails', () => {
  const a = pick('2026-10-23', 'ECLERX'), b = pick('2026-10-29', 'ECLERX');
  const l = led(['2026-10-29'], [a, b], { [a.id]: { status: 'closed', final: true, markDay: '2026-10-29' } });
  assert.deepEqual(checkMarksCurrent(l, FRI_MORNING).map((x) => x.message), [`${b.id} has no outcome`]);
});

const D = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 1000 - 19800 + 9 * 3600 + 15 * 60;
const bar = (iso: string, o: number, h: number, low: number, c: number): Bar => ({ t: D(iso), o, h, l: low, c });
test('(c) a closed outcome whose recorded exit is later than a bar that traded through its stop is a contradiction; the honest record and a gap-down are judged right', () => {
  // ECLERX shape: stop 1666.40, the 29 Oct bar trades through it (low 1650), the record says the exit came on 30 Oct
  const p = pick('2026-10-23', 'ECLERX', { ref: 1750, stop: 1666.4 });
  const bars = [bar('2026-10-23', 1740, 1760, 1730, 1750), bar('2026-10-26', 1752, 1770, 1745, 1760), bar('2026-10-29', 1700, 1710, 1650, 1660.6), bar('2026-10-30', 1655, 1665, 1640, 1650)];
  const bad: Outcome = { status: 'closed', final: true, entry: 1754, entryDay: '2026-10-26', exit: 1666.4, exitDay: '2026-10-30', reason: 'Stop', r: -1, markDay: '2026-10-30' };
  const v = checkFinalsAgainstBars(led(['2026-10-23'], [p], { [p.id]: bad }), { ECLERX: bars });
  assert.equal(v.length, 1); assert.match(v[0].message, /recorded as closed on 2026-10-30 .* but the bar of 2026-10-29 traded through its stop 1666.4 \(low 1650/);
  assert.deepEqual(checkFinalsAgainstBars(led(['2026-10-23'], [p], { [p.id]: { ...bad, exitDay: '2026-10-29' } }), { ECLERX: bars }), [], 'exit on the crossing day is right');
  const gap = [...bars.slice(0, 2), bar('2026-10-29', 1660, 1670, 1655, 1665), bars[3]];
  assert.equal(checkFinalsAgainstBars(led(['2026-10-23'], [p], { [p.id]: bad }), { ECLERX: gap }).length, 1, 'a bar that opens at or below the stop counts');
  assert.deepEqual(checkFinalsAgainstBars(led(['2026-10-23'], [p], { [p.id]: bad }), { ECLERX: null }), [], 'a symbol with no bars is not judged');
  assert.deepEqual(checkFinalsAgainstBars(led(['2026-10-23'], [p], { [p.id]: bad }), { ECLERX: bars }).length, 1);
});
test('end to end on real bars: evaluateLedger stamps each outcome with the session it reached, and the assertions pass when the bars are current and fail when the newest bar is missing', () => {
  const fx = JSON.parse(readFileSync(new URL('./fixtures/laurus_oct2026.json', import.meta.url), 'utf8')) as { bars: { date: string; o: number; h: number; l: number; c: number }[] };
  const all: Bar[] = fx.bars.map((b) => ({ t: takenAtFor(b.date) - 10 * 3600 + 3 * 3600 + 15 * 60, o: b.o, h: b.h, l: b.l, c: b.c }));
  const p = pick('2026-10-30', 'LAURUSLABS', { engine: 'MOM', ref: 2405.5, stop: 2226.29, horizon: 20 });
  const l0 = led(['2026-10-30'], [p], {});
  const now = '2026-10-31T01:47:00Z';
  const cur = evaluateLedger(l0, { LAURUSLABS: all }, null, now);
  assert.equal(cur.outcomes[p.id].status, 'pending'); assert.equal(cur.outcomes[p.id].markDay, '2026-10-30');
  assert.deepEqual(runChecks(cur, { LAURUSLABS: all }, Date.parse(now)), []);
  const lagging = evaluateLedger(l0, { LAURUSLABS: all.slice(0, -1) }, null, now);   // yfinance returned everything but the newest session
  assert.equal(lagging.outcomes[p.id].markDay, '2026-10-29');
  const v = runChecks(lagging, { LAURUSLABS: all.slice(0, -1) }, Date.parse(now));
  assert.deepEqual(v.map((x) => x.check), ['a']);   // (a) fires: picks through 30 Oct, outcomes through 29 Oct. (b) stays quiet: the pick's entry session (2 Nov) has not finished
});
test('sessionLag: the number of completed sessions a data day trails by, for any job that stamps one', () => {
  assert.equal(sessionLag('2026-10-30', SAT), 0); assert.equal(sessionLag('2026-10-29', SAT), 1); assert.equal(sessionLag('2026-10-26', SAT), 4); assert.equal(sessionLag('garbage', SAT), null);
});
test('(a) a quiet night is not a fault: when every live pick is final there is no outcome to advance', () => {
  const a = pick('2026-10-27', 'HCLTECH');
  const fin: Outcome = { status: 'closed', final: true, entry: 1700, entryDay: '2026-10-28', exitDay: '2026-10-28', markDay: '2026-10-28' };
  assert.deepEqual(checkStagesAgree(led(['2026-10-27', '2026-10-29'], [a], { [a.id]: fin })), []);
  const b = pick('2026-10-29', 'TCS'); assert.equal(checkStagesAgree(led(['2026-10-27', '2026-10-29'], [a, b], { [a.id]: fin, [b.id]: pending('2026-10-28') })).length, 1, 'an unfinished pick still must reach the night');
});
test('sessionLag: a date later than the last finished session is unreadable, never 0', () => {
  assert.equal(sessionLag('2026-12-31', FRI_MORNING), null); assert.equal(sessionLag('2026-10-29', FRI_MORNING), 0);
});
