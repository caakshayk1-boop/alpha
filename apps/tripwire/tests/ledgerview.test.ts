// 12 Nov 2026: the ledger layer (ledgerview.ts, lifecycle.ts). Acceptance §5 items 1, 2, 4 and the lifecycle part of 11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLedger, pickId, type Ledger, type LedgerPick, type Outcome } from '../src/ledger.ts';
import { planAutoBook } from '../src/autobook.ts';
import { buildLedgerView, bookClosedCount, bookOpenCount, resolvedObservationCount, userClosedCount, validationClosedCount, invariants, lifeStateOf, resolvedWord, bookClosedWord, partitionWord, validationLines } from '../src/ledgerview.ts';
import { lifecycleIdOf, normalizeLifecycles } from '../src/lifecycle.ts';
import { checkBackup, DEFAULTS, exportJson, takePaper } from '../src/store.ts';

const pick = (asOf: string, sym: string, engine = 'QLT', o: Partial<LedgerPick> = {}): LedgerPick => ({ id: pickId(asOf, engine, sym), engine, sym, asOf, ref: 1700, stop: 1650, horizon: 60, score: 80, rank: 1, ...o });
const closed = (r: number, exitDay: string, o: Partial<Outcome> = {}): Outcome => ({ status: 'closed', final: true, entry: 1700, entryDay: '2026-10-29', exit: 1700 + r * 50, exitDay, reason: r > 0 ? 'Target 2' : 'Stop', r, pct: r * 3, sessions: 4, markDay: exitDay, ...o });
const led = (picks: LedgerPick[], outcomes: Record<string, Outcome>, days: string[]): Ledger => ({ ...emptyLedger('2026-11-12T00:00:00Z'), days: days.map((asOf) => ({ asOf, recorded: `${asOf}T20:00:00Z`, engines: {} })), picks, outcomes });

// the audited shape: four looks at ECLERX and one at LAURUSLABS resolve, but the book took only two positions (the first look at each)
const E1 = pick('2026-10-28', 'ECLERX', 'QLT'), E2 = pick('2026-10-29', 'ECLERX', 'MOM'), E3 = pick('2026-10-30', 'ECLERX', 'QLT'), E4 = pick('2026-11-02', 'ECLERX', 'ST'), L1 = pick('2026-10-28', 'LAURUSLABS', 'QLT');
const FIVE = led([E1, E2, E3, E4, L1], {
  [E1.id]: closed(-1.03, '2026-11-04'), [E2.id]: closed(-0.4, '2026-11-04'), [E3.id]: closed(-0.3, '2026-11-04'), [E4.id]: closed(-0.7, '2026-11-04'), [L1.id]: closed(2.21, '2026-11-05'),
}, ['2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02']);

test('§5.1 five observations, two closures: the book says 2, the record says 5, and they are never swapped', () => {
  const plan = planAutoBook(FIVE); const v = buildLedgerView(FIVE, plan);
  assert.equal(plan.taken.length, 2, 'fixture: the repeats are refused while ECLERX is held');
  assert.equal(bookClosedCount(v), 2); assert.equal(resolvedObservationCount(v), 5); assert.equal(userClosedCount(v), 0); assert.equal(bookOpenCount(v), 0);
  assert.equal(v.notTaken, 3);
  assert.equal(bookClosedWord(v), '2 closed book positions'); assert.match(resolvedWord(v), /^5 resolved observations · includes repeated and not-taken signals$/);
  assert.doesNotMatch(resolvedWord(v), /closed trade|closed position/i, 'observations are never called closed trades or positions');
  assert.equal(v.resolvedNames, 2);
  assert.deepEqual(invariants(v), { ok: true, failed: [] });
});
test('§5.1 the user population is separate: a user close never enters the book count', () => {
  const v = buildLedgerView(FIVE, planAutoBook(FIVE), [{ p: { id: 'u1', sym: 'TCS', engine: 'QLT', asOf: '2026-10-28' }, v: { status: 'closed', r: 1, ladder: null } }, { p: { id: 'u2', sym: 'INFY', engine: 'QLT', asOf: '2026-10-28' }, v: { status: 'open', r: 0, ladder: null } }]);
  assert.equal(userClosedCount(v), 1); assert.equal(bookClosedCount(v), 2); assert.equal(v.user.open, 1);
});
test('§5.1 the observations are kept: no dedupe by symbol, and repeats link to the lifecycle that held the name', () => {
  const v = buildLedgerView(FIVE, planAutoBook(FIVE));
  assert.equal(v.observations, 5); const ecl = v.lifecycles.find((x) => x.sym === 'ECLERX')!;
  assert.deepEqual(ecl.observationIds, [E1.id, E2.id, E3.id].concat(E4.id.endsWith('ECLERX') && E4.asOf <= '2026-11-04' ? [E4.id] : []), 'every later look at the held company, until its exit day, is linked');
  assert.equal(ecl.id, `lc:${E1.id}`);
});
test('§5.2 same company, new lifecycle: A closes, B opens later; both identities survive and neither absorbs the other', () => {
  const A = pick('2026-10-27', 'ECLERX', 'QLT'), B = pick('2026-11-05', 'ECLERX', 'QLT');
  const l = led([A, B], { [A.id]: closed(1.2, '2026-10-30'), [B.id]: { status: 'open', final: false, entry: 1700, entryDay: '2026-11-06', mark: 1710, markDay: '2026-11-11', r: 0.1, pct: 0.3, sessions: 3 } }, ['2026-10-27', '2026-11-05']);
  const plan = planAutoBook(l); const v = buildLedgerView(l, plan);
  assert.equal(plan.taken.length, 2, 'the same symbol is taken again once the first is closed');
  assert.equal(v.lifecycles.length, 2); assert.notEqual(v.lifecycles[0].id, v.lifecycles[1].id);
  assert.deepEqual(v.lifecycles.map((x) => x.state).sort(), ['closed', 'open']);
  assert.equal(bookClosedCount(v), 1); assert.equal(bookOpenCount(v), 1); assert.equal(resolvedObservationCount(v), 1);
  const a = v.lifecycles.find((x) => x.pickId === A.id)!, b = v.lifecycles.find((x) => x.pickId === B.id)!;
  assert.ok(!a.observationIds.includes(B.id) && !b.observationIds.includes(A.id), 'B is not an observation of A: it is a new lifecycle');
});
test('§5.4 count invariants: selected picks partition exactly; skipped is not a position; a partial exit is not closed', () => {
  const picks = ['A', 'B', 'C', 'D', 'E'].map((s, i) => pick('2026-10-28', s, 'QLT', { score: 90 - i }));
  const [a, b, c, d, e] = picks;
  const l = led(picks, { [a.id]: closed(1, '2026-11-03'), [b.id]: { status: 'open', final: false, entry: 1700, entryDay: '2026-10-29', mark: 1720, markDay: '2026-11-11', r: 0.4, pct: 1, t1Hit: true, t1Day: '2026-11-02', t1Px: 1750 },
    [c.id]: { status: 'skipped', final: true, skipReason: 'gap' }, [d.id]: { status: 'pending', final: false } }, ['2026-10-28']);
  const v = buildLedgerView(l, planAutoBook(l));
  assert.deepEqual([v.selected, v.closed, v.open, v.skipped, v.awaiting], [5, 1, 1, 1, 2], 'e has no outcome yet: awaiting entry');
  assert.equal(e.sym, 'E'); assert.ok(invariants(v).ok);
  assert.equal(v.closed + v.open + v.awaiting + v.skipped, v.selected);
  assert.equal(bookClosedCount(v), 1, 'the T1-booked position is open');
});
test('§5.4 closed changes only at remaining quantity zero under a confirmed exit', () => {
  assert.equal(lifeStateOf({ status: 'open', ladder: { qtyLeft: 25 } }), 'open', 'a partial exit leaves the position open');
  assert.equal(lifeStateOf({ status: 'closed', ladder: { qtyLeft: 25 } }), 'open', 'a closed view that still holds shares is not closed');
  assert.equal(lifeStateOf({ status: 'closed', ladder: { qtyLeft: 0 } }), 'closed'); assert.equal(lifeStateOf({ status: 'closed' }), 'closed');
  assert.equal(lifeStateOf({ status: 'pending' }), 'awaiting'); assert.equal(lifeStateOf({ status: 'waiting' }), 'awaiting'); assert.equal(lifeStateOf({ status: 'skipped' }), 'skipped');
});
test('validation: the qualifying lifecycle count and the rule version are stated apart, and original/restated are never folded into it', () => {
  const oldP = pick('2026-10-20', 'OLDCO', 'QLT'); const ol = led([oldP], { [oldP.id]: closed(1, '2026-10-26', { entryDay: '2026-10-21' }) }, ['2026-10-20', '2026-11-11']);
  const v = buildLedgerView(ol, planAutoBook(ol));
  assert.equal(v.closed, 1); assert.equal(validationClosedCount(v), 0, 'filed before the ladder began: not an as-filed result under the current rule, so it does not count towards the minimum');
  assert.equal(v.validation.byBasis.original, 1);
  assert.ok(v.validation.rules.includes('elig-') || v.validation.rules.includes('book-'));
  const lines = validationLines(v).join(' ');
  assert.match(lines, /qualifying lifecycles under/); assert.match(lines, /A minimum sample is not proof/); assert.match(lines, /not a like-for-like/);
  const x = pick('2026-11-03', 'NEWCO', 'QLT'); const l = led([x], { [x.id]: closed(0.5, '2026-11-10', { entryDay: '2026-11-04' }) }, ['2026-11-03']);
  const w = buildLedgerView(l, planAutoBook(l)); assert.equal(validationClosedCount(w), 1); assert.equal(w.validation.qualifyingTotalR, 0.5);
});
test('partition sentence names selected, positions and skipped separately (the 37 versus 35 warning)', () => {
  const picks = ['A', 'B', 'C'].map((s) => pick('2026-10-28', s)); const l = led(picks, { [picks[0].id]: { status: 'skipped', final: true }, [picks[1].id]: { status: 'open', final: false, entry: 1700, entryDay: '2026-10-29', mark: 1700, markDay: '2026-11-11', r: 0, pct: 0 } }, ['2026-10-28']);
  assert.match(partitionWord(buildLedgerView(l, planAutoBook(l))), /3 picks selected by the book = 2 positions \(1 awaiting entry, 1 open, 0 closed\) \+ 1 skipped at the open, never entered/);
});

test('§5.11 lifecycle ids: old payloads migrate on read; malformed values are repaired; duplicates are re-keyed and none is dropped', () => {
  assert.equal(lifecycleIdOf({ id: 'abc' }), 'lc:abc'); assert.equal(lifecycleIdOf({ id: 'abc', lifecycleId: 42 }), 'lc:abc'); assert.equal(lifecycleIdOf({ id: 'abc', lifecycleId: '  ' }), 'lc:abc'); assert.equal(lifecycleIdOf({ id: 'abc', lifecycleId: 'lc:keep' }), 'lc:keep');
  const out = normalizeLifecycles([{ id: 'a', lifecycleId: 'lc:x' }, { id: 'b', lifecycleId: 'lc:x' }, { id: 'c', lifecycleId: 'lc:x' }, { id: 'd' }]);
  assert.equal(out.length, 4); assert.equal(new Set(out.map((p) => p.lifecycleId)).size, 4); assert.equal(out[0].lifecycleId, 'lc:x'); assert.equal(out[1].lifecycleId, 'lc:b'); assert.equal(out[3].lifecycleId, 'lc:d');
  assert.deepEqual(normalizeLifecycles(out).map((p) => p.lifecycleId), out.map((p) => p.lifecycleId), 'idempotent');
});
test('§5.11 a new paper trade carries a lifecycle id; an export/import round trip keeps it; an old backup without one gets a derived id', () => {
  const r = takePaper(DEFAULTS, { sym: 'TCS', engine: 'QLT', asOf: '2026-11-11', ref: 100, stop: 90, horizon: 20, qty: 10 }, 1_700_000_000);
  assert.ok(r.ok); const p = r.s.paper[0]; assert.equal(p.lifecycleId, `lc:${p.id}`);
  const back = checkBackup(exportJson(r.s)); assert.ok(back.ok); assert.equal(back.ok && back.state.paper[0].lifecycleId, p.lifecycleId);
  const old = JSON.parse(exportJson(r.s)); delete old.paper[0].lifecycleId; const o2 = checkBackup(JSON.stringify(old)); assert.ok(o2.ok && o2.state.paper[0].lifecycleId === `lc:${p.id}`);
  const dup = JSON.parse(exportJson(r.s)); dup.paper.push({ ...dup.paper[0], id: 'zz' }); const d2 = checkBackup(JSON.stringify(dup));
  assert.ok(d2.ok); assert.equal(d2.ok && d2.state.paper.length, 2); assert.equal(d2.ok && new Set(d2.state.paper.map((x) => x.lifecycleId)).size, 2);
});
