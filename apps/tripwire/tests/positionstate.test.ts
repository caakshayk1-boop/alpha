import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preservePosition, outcomeView, markOpen, livePlausible, LIVE_BAND } from '../src/positionstate.ts';
import { evaluatePaper, type Paper, type Bar } from '../src/tracker.ts';
import { emptyLedger, completedLedgerBars, evaluateLedger, record, takenAtFor, type Ledger } from '../src/ledger.ts';
import { DEFAULTS, takePaper, recordPaperView, parseState, mergeStates } from '../src/store.ts';
import { readLedgerCache, writeLedgerCache, LEDGER_CACHE_KEY } from '../src/ledgercache.ts';
import { planAutoBook } from '../src/autobook.ts';
const bar = (d: string, extra: Partial<Bar> = {}): Bar => ({ t: Date.parse(`${d}T03:45:00Z`) / 1000, o: 100, h: 102, l: 99, c: 101, ...extra });
const bars = [bar('2026-10-29', { c: 100 }), bar('2026-10-30'), bar('2026-11-02')];
const paper: Paper = { id: 'p', sym: 'X', engine: 'MOM', asOf: '2026-10-29', ref: 100, stop: 95, qty: 100, horizon: 20, takenAt: takenAtFor('2026-10-29'), targets: { t1R: 1.5, t2R: 3 } };
const prior = evaluatePaper(paper, bars, null, .25);
const ledger = (): Ledger => ({ ...emptyLedger('2026-11-02T12:00:00Z'), picks: [{ ...paper, score: 90, rank: 1 }], outcomes: { p: { status: 'open', final: false, entry: prior.entry, entryDay: '2026-10-30', sessions: 2, mark: 101, pct: prior.pct, r: prior.r, markDay: '2026-11-02' } } });
test('missing, empty, truncated and malformed bars preserve recorded open position and value', () => {
  assert.equal(prior.status, 'open');
  for (const b of [null, [], bars.slice(1), bars.slice(0, 2), [bars[0], bars[2]], [...bars, bar('2026-11-03', { h: NaN })], [...bars, bar('2026-11-04')]]) {
    const v = preservePosition(paper, b, null, .25, prior); assert.equal(v.status, 'open'); assert.equal(v.entry, prior.entry); assert.equal(v.pnl, prior.pnl); assert.ok(v.dataNote);
    const l = ledger(); const out = evaluateLedger(l, { X: b }, null, '2026-11-03T12:00:00Z'); assert.deepEqual(out.outcomes.p, l.outcomes.p);
  }
});
test('only explicit stop, target and session-limit exits close a position', () => {
  const stop = preservePosition(paper, [...bars, bar('2026-11-03', { l: 94 })], null, .25, prior); assert.equal(stop.status, 'closed'); assert.equal(stop.reason, 'Stop');
  const target = preservePosition(paper, [...bars, bar('2026-11-03', { o: 120, h: 122, l: 119, c: 121 })], null, .25, prior); assert.equal(target.reason, 'Target 2');
  const time = preservePosition({ ...paper, horizon: 3 }, [...bars, bar('2026-11-03')], null, .25, prior); assert.equal(time.reason, 'Time exit after 3 sessions');
  assert.deepEqual(preservePosition(paper, null, null, .25, stop), stop, 'terminal result cannot reopen');
});
test('partial exit and state transitions remain ordered and idempotent', () => {
  const l = ledger(); const out = evaluateLedger(l, { X: [...bars, bar('2026-11-03', { o: 120, h: 122, l: 119, c: 121 })] }, null, '2026-11-03T12:00:00Z');
  assert.deepEqual(out.transitions!.map((x) => x.to), ['partial', 'closed']); assert.ok(out.transitions!.every((x) => x.reason));
  assert.deepEqual(evaluateLedger(out, { X: [] }, null, '2026-11-04T12:00:00Z').transitions, out.transitions);
  assert.deepEqual(out.picks, l.picks, 'never rewrite entry plan');
  const partial = { ...l.outcomes.p, t1Hit: true, t1Day: '2026-11-02', t1Px: 108 }; const view = outcomeView(paper, partial)!;
  assert.equal(view.ladder?.qtyLeft, 50); assert.equal(preservePosition(paper, bars, null, .25, view).ladder?.t1Hit, true);
});
test('backup/reload retains state, prevents duplicates, permits re-entry only after explicit completion', () => {
  const entry = takePaper(DEFAULTS, paper, paper.takenAt); assert.equal(entry.ok, true); const id = entry.s.paper[0].id;
  const s = recordPaperView(entry.s, id, { ...prior, id }, '2026-11-02T12:00:00Z');
  const restored = parseState(JSON.stringify({ ...s, signalAgreement: { MOM: 1, QLT: 2, ST: 3 } }))!;
  assert.equal(preservePosition(restored.paper[0], null, null, .25, restored.paper[0].lastView).status, 'open');
  assert.equal(takePaper(restored, { ...paper, engine: 'ST' }).ok, false);
  assert.deepEqual(mergeStates(DEFAULTS, restored).signalAgreement, restored.signalAgreement);
  const close = preservePosition(paper, [...bars, bar('2026-11-03', { l: 94 })], null, .25, prior);
  const done = recordPaperView(restored, id, { ...close, id }, '2026-11-03T12:00:00Z');
  assert.equal(takePaper(done, paper).ok, true); assert.deepEqual(done.paper[0].targets, paper.targets);
  assert.equal(recordPaperView(done, id, { ...prior, id }, 'later'), done);
  assert.deepEqual(done.paper[0].transitions?.map((x) => x.to), ['pending', 'open', 'closed']);
});
test('last-good ledger survives reload, corruption and older responses', () => {
  const m = new Map<string, string>(); const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  writeLedgerCache(storage, ledger()); assert.deepEqual(readLedgerCache(storage), ledger());
  writeLedgerCache(storage, { ...ledger(), updated: '2026-10-01T12:00:00Z' }); assert.equal(readLedgerCache(storage)!.updated, ledger().updated);
  m.set(LEDGER_CACHE_KEY, '{broken'); assert.equal(readLedgerCache(storage), null);
});
test('published ledger retains every pick, history and open position when all prices disappear, whether they are missing or empty', () => {
  const l = JSON.parse(readFileSync(new URL('../ledger/ledger.json', import.meta.url), 'utf8')) as Ledger;
  const before = JSON.stringify(l); const out = evaluateLedger(l, Object.fromEntries(l.picks.map((p) => [p.sym, []])), null, l.updated);
  assert.equal(JSON.stringify(l), before); assert.deepEqual(out.picks, l.picks); assert.deepEqual(out.outcomes, l.outcomes); assert.deepEqual(planAutoBook(out).taken, planAutoBook(l).taken);
  assert.equal(record(l, [], l.days.at(-1)!.asOf, l.updated).ledger, l, 'same day cannot be overwritten with an empty shortlist');
  const none = evaluateLedger(l, Object.fromEntries(l.picks.map((p) => [p.sym, null])), null, l.updated); assert.deepEqual(none.outcomes, l.outcomes, 'missing prices change nothing either');
});
test('a pick recorded tonight that has only been marked to a day keeps that mark when its prices come back empty', () => {
  const l: Ledger = { ...emptyLedger('2026-11-02T00:00:00Z'), picks: [{ ...paper, score: 90, rank: 1 }], outcomes: { p: { status: 'pending', final: false, markDay: '2026-11-02' } } };
  assert.deepEqual(evaluateLedger(l, { X: [] }, null, '2026-11-03T01:00:00Z').outcomes.p, { status: 'pending', final: false, markDay: '2026-11-02' });
});

test('a retained position follows the live price: the history is incomplete but the quote is in hand (the frozen-at-yesterday\'s-close fault)', () => {
  const live = { px: 108, t: bars[2].t + 3600 }; const v = preservePosition(paper, bars.slice(1), live, .25, prior);
  assert.equal(v.status, 'open'); assert.equal(v.markKind, 'live'); assert.equal(v.mark, 108); assert.ok(v.dataNote, 'it still says the history is incomplete');
  const entry = prior.entry!; const pnl = (108 - entry) * 100 - .0025 * entry * 100 - .001 * 108 * 100;   // the tracker's own open formula, recomputed here from the recorded entry
  assert.ok(Math.abs(v.pnl! - Math.round(pnl * 100) / 100) < 0.011, `P&L ${v.pnl} follows the live price (${pnl.toFixed(2)})`); assert.equal(v.entry, prior.entry); assert.equal(v.entryT, prior.entryT); assert.equal(v.sessions, prior.sessions);
  assert.notEqual(v.pnl, prior.pnl, 'the recorded P&L was at the old mark; this one is at the live price');
});
test('a live print is never an exit: far below the stop, a retained position stays open', () => {
  const v = preservePosition(paper, null, { px: 80, t: bars[2].t + 3600 }, .25, prior); assert.equal(v.status, 'open'); assert.equal(v.mark, 80); assert.ok(v.pnl! < 0); assert.ok(v.dataNote);
  assert.equal(markOpen({ ...prior, status: 'closed' }, paper, { px: 80, t: 1 }, .25).mark, prior.mark, 'a closed position is never re-marked');
});
test('a bad tick or no quote leaves the recorded price alone', () => {
  for (const live of [null, { px: 0, t: 1 }, { px: NaN, t: 1 }, { px: prior.entry! * 0.2, t: 1 }, { px: prior.entry! * 3, t: 1 }]) { const v = preservePosition(paper, null, live as never, .25, prior); assert.equal(v.mark, prior.mark); assert.equal(v.pnl, prior.pnl); assert.equal(v.markKind, prior.markKind); }
});
test('a position that has sold half at target 1 is marked on the half it still holds, plus what it banked', () => {
  const half = { ...prior, ladder: { t1: 107.5, t2: 115, t1Hit: true, t2Hit: false, booked: 375, qtyLeft: 50, stop: prior.entry! } } as typeof prior;
  const v = markOpen(half, paper, { px: 112, t: 1 }, .25); const e = prior.entry!;
  const expected = 375 + (112 - e) * 50 - .0025 * e * 100 - .001 * 112 * 50; assert.ok(Math.abs(v.pnl! - Math.round(expected * 100) / 100) < 0.011, `${v.pnl} vs ${expected.toFixed(2)}`); assert.equal(v.ladder?.qtyLeft, 50); assert.equal(v.ladder?.booked, 375);
});

test('a split or bonus while the history is incomplete does not become a false loss: the recorded price is kept, and the note says why', () => {
  for (const px of [prior.mark! * 0.5, prior.mark! * 0.6, prior.mark! * 1.5]) {                  // 2-for-1, 3-for-2 and a one-day jump past the band
    const v = preservePosition(paper, null, { px, t: bars[2].t + 3600 }, .25, prior); assert.equal(v.mark, prior.mark); assert.equal(v.pnl, prior.pnl); assert.equal(v.r, prior.r); assert.equal(v.status, 'open'); assert.match(v.dataNote!, /split or bonus/);
  }
  const ok = preservePosition(paper, null, { px: prior.mark! * 1.1, t: bars[2].t + 3600 }, .25, prior); assert.equal(ok.mark, Math.round(prior.mark! * 1.1 * 100) / 100); assert.equal(livePlausible(prior, { px: prior.mark! * (1 + LIVE_BAND) }), true); assert.equal(livePlausible(prior, { px: prior.mark! * (1 + LIVE_BAND) * 1.01 }), false);
  assert.doesNotMatch(ok.dataNote!, /split or bonus/, 'an ordinary move is priced and carries the ordinary note');
});


test('invalid prices before a position signal do not freeze it; errors inside its history still preserve it', () => {
  const old = bar('2026-02-27', { o: 98, l: 99 });
  const next = [...bars, bar('2026-11-03', { c: 102 })];
  const v = preservePosition(paper, [old, ...next], null, .25, prior);
  assert.equal(v.status, 'open'); assert.equal(v.mark, 102); assert.equal(v.sessions, 3); assert.equal(v.dataNote, undefined);
  assert.deepEqual(v, preservePosition(paper, next, null, .25, prior));
  const bad = preservePosition(paper, [...bars, bar('2026-11-03', { o: 98, l: 99 })], null, .25, prior);
  assert.equal(bad.mark, prior.mark); assert.match(bad.dataNote!, /incomplete/);
});
test('nightly prices exclude special, future and forming sessions for both entries and exits', () => {
  const friday = bar('2026-11-06'); const sunday = bar('2026-11-08', { l: 80 }); const monday = bar('2026-11-09');
  const now = Date.parse('2026-11-08T11:00:00Z');
  assert.deepEqual(completedLedgerBars([friday, sunday, monday], now), [friday]);
  assert.deepEqual(completedLedgerBars([{ ...friday, forming: true }], now), []);
  const p = { ...paper, asOf: '2026-11-06', takenAt: takenAtFor('2026-11-06') };
  const pending = { ...emptyLedger(new Date(now).toISOString()), picks: [{ ...p, score: 90, rank: 1 }] };
  const out = evaluateLedger(pending, { X: completedLedgerBars([friday, sunday], now) }, null, new Date(now).toISOString());
  assert.equal(out.outcomes.p.status, 'pending'); assert.equal(out.outcomes.p.markDay, '2026-11-06');
  assert.equal(completedLedgerBars([friday, sunday, monday], Date.parse('2026-11-09T12:00:00Z')).length, 2, 'ordinary Monday is admitted after completion; Sunday stays excluded');
});


test('browser position replay shares the ordinary-session calendar; a special-session quote is only a mark', () => {
  const p = { ...paper, asOf: '2026-11-06', takenAt: takenAtFor('2026-11-06') };
  const friday = bar('2026-11-06'); const sunday = bar('2026-11-08', { l: 80 });
  const pending = preservePosition(p, [friday, sunday], null, .25);
  assert.equal(pending.status, 'pending');
  const thursday = bar('2026-11-05'); const held = { ...paper, asOf: '2026-11-05', takenAt: takenAtFor('2026-11-05') };
  const v = preservePosition(held, [thursday, friday, sunday], { px: 103, t: sunday.t }, .25);
  assert.equal(v.status, 'open'); assert.equal(v.sessions, 1); assert.equal(v.mark, 103);
});
