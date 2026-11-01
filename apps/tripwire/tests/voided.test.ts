// Task 2.4: a voided pick is served with status 'void' and none of the live outcome fields (entry, mark, r, pct, ladder).
// Before: the voided LVT LAURUSLABS pick of 23 Oct was served "open" with a mark and an R beside it (r 2.11 on the audit's day, 4.31 in the 31 Oct file).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyLedger, evaluateLedger, pickId, summarizeLedger, voidOutcomes, takenAtFor, type Ledger, type LedgerPick } from '../src/ledger.ts';
import { planAutoBook } from '../src/autobook.ts';
import type { Bar } from '../src/tracker.ts';

const mk = (sym: string, asOf = '2026-10-23', engine = 'LVT'): LedgerPick => ({ id: pickId(asOf, engine, sym), engine, sym, asOf, ref: 100, stop: 90, horizon: 40, score: 80, rank: 1 });
const live = { status: 'open' as const, final: false, entry: 101, entryDay: '2026-10-26', mark: 120, r: 2.11, pct: 18, sessions: 4, t1Hit: true, t1Day: '2026-10-28', t1Px: 115, markDay: '2026-10-30' };
const D = (iso: string) => takenAtFor(iso) - 10 * 3600 + 3 * 3600 + 15 * 60;
const bars: Bar[] = ['2026-10-23', '2026-10-26', '2026-10-27'].map((d, i) => ({ t: D(d), o: 100 + i, h: 103 + i, l: 99 + i, c: 101 + i }));

test('the writer: a voided pick is never replayed and leaves with no live outcome field', () => {
  const a = mk('LAURUSLABS'), b = mk('SBC', '2026-10-23', 'MOM');
  const l: Ledger = { ...emptyLedger('2026-10-31T00:00:00Z'), picks: [a, b], outcomes: { [a.id]: live, [b.id]: live }, voided: { [a.id]: 'rule bug' } };
  const out = evaluateLedger(l, { LAURUSLABS: bars, SBC: bars }, null, '2026-11-01T00:00:00Z').outcomes;
  assert.deepEqual(out[a.id], { status: 'void', final: true });
  assert.equal(out[b.id].status, 'open', 'a pick that is not voided is evaluated as before');
  for (const k of ['entry', 'mark', 'r', 'pct', 'exit', 't1Hit', 'markDay']) assert.ok(!(k in out[a.id]), `no ${k} on a voided pick`);
});
test('the reader: a file written before the rule is served clean, idempotently, and nothing else changes', () => {
  const a = mk('LAURUSLABS'), b = mk('SBC', '2026-10-23', 'MOM');
  const l: Ledger = { ...emptyLedger('2026-10-31T00:00:00Z'), picks: [a, b], outcomes: { [a.id]: live, [b.id]: live }, voided: { [a.id]: 'rule bug' } };
  const once = voidOutcomes(l); assert.deepEqual(once.outcomes[a.id], { status: 'void', final: true }); assert.equal(once.outcomes[b.id], l.outcomes[b.id]);
  assert.equal(voidOutcomes(once), once, 'a clean ledger comes back as the same object');
  const nov = { ...l, voided: undefined }; assert.equal(voidOutcomes(nov), nov, 'nothing voided, nothing touched');
});
test('totals and the auto book are unchanged by the status: voided picks were already left out of both', () => {
  const a = mk('LAURUSLABS'), b = mk('SBC', '2026-10-23', 'MOM');
  const l: Ledger = { ...emptyLedger('2026-10-31T00:00:00Z'), days: [{ asOf: '2026-10-23', recorded: 'x', engines: {} }], picks: [a, b], outcomes: { [a.id]: live, [b.id]: live }, voided: { [a.id]: 'rule bug' } };
  assert.deepEqual(summarizeLedger(voidOutcomes(l)).all, summarizeLedger(l).all);
  assert.deepEqual(planAutoBook(voidOutcomes(l)).taken.map((t) => t.pick.id), planAutoBook(l).taken.map((t) => t.pick.id));
});
test('the committed ledger: every voided pick reads void with no live field once served', () => {
  const l = JSON.parse(readFileSync(new URL('../ledger/ledger.json', import.meta.url), 'utf8')) as Ledger;
  const ids = Object.keys(l.voided ?? {}); assert.ok(ids.length >= 5);
  const served = voidOutcomes(l);
  for (const id of ids) assert.deepEqual(served.outcomes[id], { status: 'void', final: true }, id);
});
