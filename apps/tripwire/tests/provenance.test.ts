// Original vs restated (provenance.ts), repeated observations vs independent positions (observations.ts), what the Data rows mean (coverage.ts), and what the risk grade is called (eligibility.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLedger, pickId, type Ledger, type LedgerPick, type Outcome } from '../src/ledger.ts';
import { basisCounts, basisLine, resultBasis } from '../src/provenance.ts';
import { observationLines, observationsOf } from '../src/observations.ts';
import { planAutoBook } from '../src/autobook.ts';
import { ledgerRowNote, signalsRowNote } from '../src/coverage.ts';
import { NO_FLAGS_SENTENCE, RISK_NAME, RISK_SCOPE, eligibilityOf, riskGradeOf, riskSentence } from '../src/eligibility.ts';

const pick = (asOf: string, sym: string, engine = 'QLT', o: Partial<LedgerPick> = {}): LedgerPick => ({ id: pickId(asOf, engine, sym), engine, sym, asOf, ref: 1700, stop: 1650, horizon: 60, score: 80, rank: 1, ...o });
const closed = (r: number, exitDay: string, o: Partial<Outcome> = {}): Outcome => ({ status: 'closed', final: true, entry: 1700, entryDay: '2026-10-27', exit: 1700 + r * 50, exitDay, reason: 'Time', r, pct: r * 3, sessions: 4, ...o });
const led = (picks: LedgerPick[], outcomes: Record<string, Outcome>, voided?: Record<string, string>): Ledger => ({ ...emptyLedger('2026-10-30T00:00:00Z'), days: [{ asOf: '2026-10-30', recorded: 'x', engines: {} }], picks, outcomes, ...(voided ? { voided } : {}) });

test('basis: written on or after 27 Oct is as filed; earlier and finished without ladder fields is original; earlier and unfinished, or with ladder fields, is restated', () => {
  assert.equal(resultBasis({ asOf: '2026-10-27' }, true).basis, 'as-filed'); assert.equal(resultBasis({ asOf: '2026-10-30' }, false).basis, 'as-filed');
  assert.equal(resultBasis({ asOf: '2026-10-23' }, true, { }).basis, 'original'); assert.equal(resultBasis({ asOf: '2026-10-23' }, true, null).basis, 'original');
  assert.equal(resultBasis({ asOf: '2026-10-23' }, false).basis, 'restated'); assert.equal(resultBasis({ asOf: '2026-10-26' }, true, { t1Hit: false, t2Hit: false }).basis, 'restated');
  const r = resultBasis({ asOf: '2026-10-23' }, false); assert.match(r.line, /Sun 1 Nov|1 Nov/); assert.match(r.line, /earlier figure is not stored, so none is shown/); assert.equal(r.rules, 'elig-1 · book-1');
  assert.equal(resultBasis({ asOf: '2026-10-28' }, true).rules, 'elig-2 · book-2'); assert.match(resultBasis({ asOf: '2026-10-23' }, true).line, /never re-evaluated/);
});
test('basis never invents a number: the labels carry no figure of their own', () => {
  for (const b of [resultBasis({ asOf: '2026-10-23' }, true), resultBasis({ asOf: '2026-10-23' }, false), resultBasis({ asOf: '2026-10-28' }, true)]) assert.ok(!/[+−-]?\d+(\.\d+)?R\b|₹/.test(b.line), b.line);
});
test('basis counts split the CLOSED counted results; voided picks and retired engines are out; the line warns when the rules are mixed', () => {
  const a = pick('2026-10-23', 'AAA'), b = pick('2026-10-26', 'BBB'), c = pick('2026-10-28', 'CCC'), v = pick('2026-10-23', 'VVV'), r = pick('2026-10-23', 'RRR', 'LVT'), o = pick('2026-10-23', 'OPN');
  const L = led([a, b, c, v, r, o], { [a.id]: closed(1, '2026-10-29'), [b.id]: closed(-1, '2026-11-02', { t1Hit: false, t2Hit: false }), [c.id]: closed(2, '2026-10-30', { t1Hit: true }), [v.id]: closed(1, '2026-10-29'), [r.id]: closed(1, '2026-10-29'), [o.id]: { status: 'open', final: false } }, { [v.id]: 'void' });
  const k = basisCounts(L); assert.deepEqual(k, { asFiled: 1, original: 1, restated: 1, total: 3 });
  const line = basisLine(k)!; assert.match(line, /Of 3 closed results: 1 as filed, 1 restated, 1 original rule\./); assert.match(line, /not like-for-like/);
  assert.equal(basisLine({ asFiled: 2, original: 0, restated: 0, total: 2 })!.includes('like-for-like'), false, 'a single basis makes no mixing claim'); assert.equal(basisLine({ asFiled: 0, original: 0, restated: 0, total: 0 }), null);
});
test('closed outcomes are not rewritten by any of this: the functions take a ledger and return new values only', () => {
  const a = pick('2026-10-23', 'AAA'); const L = led([a], { [a.id]: closed(1, '2026-10-29') }); const snap = JSON.stringify(L); basisCounts(L); observationsOf(L, planAutoBook(L)); assert.equal(JSON.stringify(L), snap);
});

test('observations: the same company named on several nights and by two engines is ONE company; the book holds it once; closed outcomes are per observation', () => {
  const ps = [pick('2026-10-27', 'LAU', 'QLT'), pick('2026-10-27', 'LAU', 'MOM'), pick('2026-10-28', 'LAU', 'QLT'), pick('2026-10-28', 'OTH', 'QLT'), pick('2026-10-29', 'LAU', 'QLT')];
  const outs: Record<string, Outcome> = { [ps[0].id]: closed(1, '2026-10-29'), [ps[2].id]: closed(-1, '2026-10-30'), [ps[1].id]: { status: 'open', final: false } };
  const L = led(ps, outs); const o = observationsOf(L, planAutoBook(L));
  assert.equal(o.observations, 5); assert.equal(o.names, 2); assert.equal(o.repeats, 3); assert.equal(o.nights, 3); assert.deepEqual(o.top, [{ sym: 'LAU', n: 4 }]);
  assert.equal(o.closedObservations, 2); assert.equal(o.closedNames, 1, 'two closed outcomes, one company');
  assert.ok(o.positions <= o.names + 2 && o.positions < o.observations, 'the book holds a name once at a time'); assert.equal(o.notTaken, o.observations - o.positions);
  const t = observationLines(o); assert.match(t.observed, /5 pick observations over 3 nights name 2 companies/); assert.match(t.observed, /3 observations are repeats/); assert.match(t.observed, /LAU 4 times/);
  assert.match(t.outcomes, /2 closed outcomes cover 1 company/); assert.match(t.outcomes, /not independent trials/); assert.match(t.positions!, /independent ones/); assert.equal(observationLines(o, false).positions, null);
});
test('observations: voided picks and retired engines are out of every count; an empty record says nothing repeats', () => {
  const a = pick('2026-10-27', 'AAA'), b = pick('2026-10-27', 'AAA', 'LVT'), c = pick('2026-10-28', 'AAA'); const L = led([a, b, c], {}, { [c.id]: 'x' });
  const o = observationsOf(L, null); assert.equal(o.observations, 1); assert.equal(o.repeats, 0); assert.match(observationLines(o).observed, /None repeats a company/);
});

test('coverage: zero signals rows is explained as the gate being off and as a different file from the Picks; a ledger row says observations, not positions', () => {
  const z = signalsRowNote(0, { on: false, text: 'Signals gate: OFF — 1/4 checks' })!; assert.match(z, /not a failure/); assert.match(z, /Signals gate: OFF/); assert.match(z, /different file/); assert.equal(signalsRowNote(null, null), undefined);
  assert.match(signalsRowNote(3, null)!, /3 swing signals listed by the gate/);
  const a = pick('2026-10-27', 'AAA'), c = pick('2026-10-28', 'AAA'); const n = ledgerRowNote(led([a, c], {}, { [c.id]: 'x' }))!; assert.match(n, /pick observations/); assert.match(n, /not positions/); assert.match(n, /1 more is kept in the file but left out of every total/);
});

test('risk grade: named for what it counts, scoped in words, and an empty flag list never reads as "no risk"', () => {
  assert.equal(RISK_NAME, 'Screen flag level'); assert.match(RISK_SCOPE, /does not read the price trend/); assert.match(RISK_SCOPE, /40% or more from the 52-week high/);
  assert.equal(riskSentence('LOW', 0), 'Screen flag level LOW: no flags raised.'); assert.equal(riskSentence('HIGH', 7), 'Screen flag level HIGH: 7 flags raised.'); assert.equal(riskSentence('MEDIUM', null), 'Screen flag level MEDIUM.');
  assert.match(NO_FLAGS_SENTENCE, /not a finding that there are no risks/);
  const row = { sym: 'X', sector: 'Industrials', tier: 'large', risk_lvl: 'LOW' }; const g = riskGradeOf(row as never, eligibilityOf(row as never));
  assert.equal(g.level, 'LOW'); assert.ok(g.note!.includes(RISK_SCOPE), 'the grade is never handed back without its scope');
});
