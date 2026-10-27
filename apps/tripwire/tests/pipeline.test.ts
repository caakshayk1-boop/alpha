import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overduePending, pipelineHealth, worst, type Facts } from '../src/pipeline.ts';

const ist = (iso: string, h: number, m = 0) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), h, m) - 330 * 60000;
const ok = (o: Partial<Facts> = {}): Facts => ({ screenAsOf: '2026-10-26', screenBuiltOn: '2026-10-27', ledgerLastNight: '2026-10-26', ledgerUpdated: 'x', pendingOld: 0, pendingTotal: 3, quoteLastAt: null, quoteErr: null, panelLastDay: '2026-10-26', panelBuilt: 'b', ...o });
const by = (r: ReturnType<typeof pipelineHealth>, id: string) => r.stages.find((s) => s.id === id)!;

test('pipeline: a screen on the last finished session is current, and the expected day comes from the calendar', () => {
  const r = pipelineHealth(ok(), ist('2026-10-27', 10)); assert.equal(r.expectedSession, '2026-10-26'); assert.equal(by(r, 'screen').health, 'ok');
});
test('pipeline: a holiday does not make a screen late (Tue 20 Oct was Dussehra), but a missed trading day does', () => {
  assert.equal(by(pipelineHealth(ok({ screenAsOf: '2026-10-19', ledgerLastNight: '2026-10-19' }), ist('2026-10-20', 20)), 'screen').health, 'ok');
  assert.equal(by(pipelineHealth(ok({ screenAsOf: '2026-10-19' }), ist('2026-10-23', 12)), 'screen').health, 'behind', 'Tue to Fri: Wed and Thu closes are missing');
});
test('pipeline: one session behind is late in the morning and behind once the next evening has passed it by', () => {
  assert.equal(by(pipelineHealth(ok({ screenAsOf: '2026-10-23' }), ist('2026-10-27', 8)), 'screen').health, 'late');
  assert.equal(by(pipelineHealth(ok({ screenAsOf: '2026-10-23' }), ist('2026-10-28', 12)), 'screen').health, 'behind');
});
test('pipeline: overdue pick outcomes are called out, not folded into "pending"', () => {
  const r = pipelineHealth(ok({ pendingOld: 7, pendingTotal: 10 }), ist('2026-10-27', 10)); const s = by(r, 'ledger-bars'); assert.equal(s.health, 'late'); assert.match(s.detail, /7 picks older than a finished session still show no entry bar/);
  assert.equal(by(pipelineHealth(ok({ pendingOld: 0, pendingTotal: 10 }), ist('2026-10-27', 10)), 'ledger-bars').health, 'ok');
});
test('pipeline: quotes are judged only while the market is open; a shut market with no quotes is fine, an open one with an error is not', () => {
  assert.equal(by(pipelineHealth(ok(), ist('2026-10-27', 20)), 'quotes').health, 'ok');
  assert.equal(by(pipelineHealth(ok({ quoteErr: 'HTTP 502' }), ist('2026-10-27', 11)), 'quotes').health, 'behind');
  assert.equal(by(pipelineHealth(ok({ quoteLastAt: ist('2026-10-27', 10, 50) }), ist('2026-10-27', 11)), 'quotes').health, 'late', 'ten minutes old while open');
  assert.equal(by(pipelineHealth(ok({ quoteLastAt: ist('2026-10-27', 10, 59) + 30000 }), ist('2026-10-27', 11)), 'quotes').health, 'ok');
});
test('pipeline: the overall verdict is the worst stage, and unknown is never reported as ok', () => {
  assert.equal(worst(['ok', 'late', 'ok']), 'late'); assert.equal(worst(['ok', 'unknown']), 'unknown'); assert.equal(worst(['unknown', 'behind']), 'behind');
  const r = pipelineHealth(ok({ ledgerUpdated: null, screenAsOf: null }), ist('2026-10-27', 10)); assert.equal(by(r, 'screen').health, 'unknown'); assert.notEqual(r.overall, 'ok');
});
test('overdue pending: a pick whose entry session has finished and still has no outcome is counted; a voided one, one with an outcome, and one not yet due are not', () => {
  const l = { picks: [{ id: 'a', asOf: '2026-10-23' }, { id: 'b', asOf: '2026-10-23' }, { id: 'c', asOf: '2026-10-23' }, { id: 'd', asOf: '2026-10-26' }, { id: 'e', asOf: '2026-10-27' }],
    outcomes: { a: { status: 'pending', final: false }, b: { status: 'open', final: false } } as Record<string, { status: string; final: boolean }>, voided: { c: 'bug' } };
  const r = overduePending(l, ist('2026-10-27', 21)); assert.deepEqual(r, { old: 2, total: 3 }, 'a is overdue (Mon 26 finished), d enters Tue 27 which finished at 21:00 so it is overdue too, e enters Wed');
  assert.deepEqual(overduePending(l, ist('2026-10-27', 10)), { old: 1, total: 3 }, 'at 10:00 on Tuesday only Monday has finished: d (enters Tue) is not yet due');
});
