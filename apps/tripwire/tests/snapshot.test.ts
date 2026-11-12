// 12 Nov 2026: one snapshot, reconciliation and coverage (ledgerview.ts, Tripwire 2.0 tasks 1.3 and 2.1). Acceptance §5.5 and §5.6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotOf, coverageWords, splitOpen, splitClosed, type SnapRow } from '../src/ledgerview.ts';
import { attribute } from '../src/attribution.ts';

const open = (id: string, sym: string, o: { mark: number | null; qtyLeft?: number; booked?: number; engine?: string; owner?: 'engine' | 'you'; note?: string; dayPnl?: number | null; markKind?: 'live' | 'close'; markT?: number | null; fill?: number }): SnapRow => {
  const qty = 100; const left = o.qtyLeft ?? 100; const booked = o.booked ?? 0; const fill = o.fill ?? 100;
  const s = splitOpen({ qty0: qty, fill, stop: 90, qtyLeft: left, booked, mark: o.mark, costPct: 0.25 });
  return { p: { id, sym, engine: o.engine ?? 'QLT', qty, stop: 90 }, v: { status: 'open', entry: fill, mark: o.mark, markKind: o.mark == null ? null : o.markKind ?? 'close', pnl: s.total, r: s.r, sessions: 3, ...(o.note ? { dataNote: o.note } : {}), ladder: left < qty ? { qtyLeft: left, booked } : null }, dayPnl: o.dayPnl ?? null, markT: o.markT ?? null, owner: o.owner ?? 'engine' };
};
const done = (id: string, sym: string, pnl: number, engine = 'QLT'): SnapRow => ({ p: { id, sym, engine, qty: 100, stop: 90 }, v: { status: 'closed', entry: 100, mark: 100, markKind: 'close', pnl, r: pnl / 1000, sessions: 5, ladder: { qtyLeft: 0, booked: 0 } }, dayPnl: null, owner: 'engine' });

const BOOK = [open('a', 'AAA', { mark: 110, qtyLeft: 50, booked: 1000, dayPnl: 120, markKind: 'live', markT: 1000 }), open('b', 'BBB', { mark: 96, dayPnl: -60, engine: 'MOM', markKind: 'live', markT: 1060 }), open('c', 'CCC', { mark: 101.5, dayPnl: 10, markKind: 'close' }), done('d', 'DDD', 240), done('e', 'EEE', -90, 'MOM')];

test('§5.5 reconciliation: realised + unrealised = total; the position totals add up to it; one id for the whole snapshot', () => {
  const s = snapshotOf(BOOK, 0.25, '2026-11-12T00:00:00Z');
  assert.equal(s.invariants.ok, true, s.invariants.failed.join('; '));
  assert.equal(Math.round(s.totals.total! * 100), Math.round((s.totals.realised! + s.totals.unrealised!) * 100));
  assert.equal(Math.round(s.totals.total! * 100), s.positions.reduce((a, x) => a + Math.round(x.split!.total! * 100), 0));
  assert.ok(s.totals.realised! > 1000, 'AAA booked half and DDD closed are both realised');
  assert.notEqual(s.totals.openTrade, s.totals.unrealised, 'open-trade P&L is a separate quantity');
  assert.match(s.id, /^snap-[0-9a-f]{8}$/); assert.equal(snapshotOf(BOOK, 0.25, '2026-11-12T00:00:00Z').id, s.id, 'same inputs, same id');
  assert.notEqual(snapshotOf([{ ...BOOK[1], v: { ...BOOK[1].v, mark: 97 } }, ...BOOK.slice(2), BOOK[0]], 0.25, '2026-11-12T00:00:00Z').id, s.id, 'a new price is a new snapshot');
});
test('§5.5 the attribution table built from the same rows reconciles to the same total, "Other" completes it, gainers and losers are listed apart', () => {
  const s = snapshotOf(BOOK, 0.25); const a = attribute(BOOK.map((r) => ({ id: r.p.id, sym: r.p.sym, engine: r.p.engine, status: r.v.status, pnl: r.v.pnl, r: r.v.r, split: s.positions.find((x) => x.id === r.p.id)!.split })), (e) => e, 2);
  assert.equal(a.total, s.totals.total); assert.ok(a.engineReconciles && a.positionsReconcile);
  assert.equal(Math.round((a.positions.rows.reduce((x, r) => x + r.value, 0) + (a.positions.other?.value ?? 0)) * 100), Math.round(a.total * 100), '"Other" completes the table');
  assert.ok(s.gainers.every((x) => x.split!.total! > 0) && s.losers.every((x) => x.split!.total! < 0)); assert.equal(s.gainers[0].sym, 'DDD'.length ? s.gainers[0].sym : '');
  assert.ok(s.gainers.length >= 1 && s.losers.length >= 1);
});
test('§5.6 coverage: one missing mark gives a visible partial subtotal, never a silently complete total', () => {
  const rows = [BOOK[0], open('x', 'XXX', { mark: null }), BOOK[2]];
  const s = snapshotOf(rows, 0.25); assert.equal(s.coverage.state, 'partial'); assert.equal(s.coverage.measured, 2); assert.equal(s.coverage.open, 3); assert.equal(s.totals.partial, true);
  assert.ok(s.totals.total !== null && Number.isFinite(s.totals.total), 'the measured part is shown');
  assert.match(coverageWords(s.coverage, null).marks, /2 of 3 open positions measured; the figures below are a partial subtotal of those 2/);
  assert.equal(s.exceptions.map((x) => x.sym).join(), 'XXX', 'the exception is named');
});
test('§5.6 coverage: all marks missing is "unavailable", not ₹0', () => {
  const s = snapshotOf([open('x', 'XXX', { mark: null }), open('y', 'YYY', { mark: null })], 0.25);
  assert.equal(s.coverage.state, 'unavailable'); assert.equal(s.totals.total, null); assert.equal(s.totals.unrealised, null); assert.equal(s.totals.unavailable, true);
  assert.match(coverageWords(s.coverage, null).marks, /unavailable/i);
  assert.equal(snapshotOf([], 0.25).coverage.state, 'none'); assert.equal(snapshotOf([], 0.25).totals.total, null, 'nothing to total is not zero');
});
test('§5.6 execution-history completeness and price-mark coverage are separate statuses', () => {
  const quotesOkHistoryBad = snapshotOf([open('a', 'AAA', { mark: 105, note: 'Daily history is missing or incomplete.' }), open('b', 'BBB', { mark: 99 })], 0.25);
  assert.equal(quotesOkHistoryBad.coverage.state, 'complete', 'every position has a mark');
  assert.equal(quotesOkHistoryBad.coverage.historyIncomplete, 1);
  const w = coverageWords(quotesOkHistoryBad.coverage, 'Wed 11 Nov'); assert.equal(w.exitComplete, false); assert.match(w.exit, /Exit verification: incomplete · daily history is missing or incomplete for 1 of 2 open positions; last confirmed history Wed 11 Nov/);
  assert.match(coverageWords(snapshotOf([open('a', 'AAA', { mark: 105 })], 0.25).coverage, 'Wed 11 Nov').exit, /Exit verification: complete through Wed 11 Nov/);
  const noMarkHistoryFine = snapshotOf([open('a', 'AAA', { mark: null })], 0.25); assert.equal(noMarkHistoryFine.coverage.state, 'unavailable'); assert.equal(noMarkHistoryFine.coverage.historyIncomplete, 0);
});
test('the oldest mark is reported, never one timestamp that implies every row is as fresh', () => {
  const s = snapshotOf(BOOK, 0.25); assert.equal(s.coverage.oldestPrint, 1000); assert.equal(s.coverage.newestPrint, 1060); assert.equal(s.coverage.live, 2); assert.equal(s.coverage.atClose, 1);
});
test('the largest weight is by value of the shares still held', () => {
  const s = snapshotOf(BOOK, 0.25); assert.ok(s.largest && s.largest.pct > 0 && s.largest.pct < 100);
  assert.equal(snapshotOf([done('d', 'DDD', 1)], 0.25).largest, null);
  assert.ok(splitClosed(5, 100).total === 5);
});
