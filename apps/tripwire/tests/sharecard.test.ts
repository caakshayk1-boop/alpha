// 15 Nov 2026 (Tripwire 4.0, F8): a card exists for every open pick; its figures equal the snapshot's; no figure the site does not show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLedger, pickId, type Ledger, type LedgerPick, type Outcome } from '../src/ledger.ts';
import { planAutoBook } from '../src/autobook.ts';
import { levelsFor } from '../src/levels.ts';
import { pickCards, bookCard, pickSvg, bookSvg, PAPER, type Palette } from '../src/sharecard.ts';
import { buildLedgerView } from '../src/ledgerview.ts';

const pick = (asOf: string, sym: string, engine = 'QLT', o: Partial<LedgerPick> = {}): LedgerPick => ({ id: pickId(asOf, engine, sym), engine, sym, asOf, ref: 100, stop: 90, horizon: 60, score: 80, rank: 1, ...o });
const P1 = pick('2026-11-09', 'OPENA'), P2 = pick('2026-11-10', 'WAITB', 'MOM'), P3 = pick('2026-11-04', 'DONEC'), P4 = pick('2026-11-04', 'T1D');
const L: Ledger = { ...emptyLedger('2026-11-12T00:00:00Z'), days: [{ asOf: '2026-11-04', recorded: 'x', engines: {} }, { asOf: '2026-11-10', recorded: 'x', engines: {} }], picks: [P1, P2, P3, P4], outcomes: {
  [P1.id]: { status: 'open', final: false, entry: 101, entryDay: '2026-11-10', mark: 107, markDay: '2026-11-12', sessions: 2 } as Outcome,
  [P3.id]: { status: 'closed', final: true, entry: 101, entryDay: '2026-11-05', exit: 90, exitDay: '2026-11-06', reason: 'Stop', r: -1, pct: -10.9 } as Outcome,
  [P4.id]: { status: 'open', final: false, entry: 100, entryDay: '2026-11-05', mark: 112, markDay: '2026-11-12', t1Hit: true, t1Day: '2026-11-09', t1Px: 115 } as Outcome,
} };
const PAL: Palette = { bg: 'BG', surface: 'SF', ink: 'IN', ink2: 'I2', ink3: 'I3', accent: 'AC', up: 'UP', down: 'DN', line: 'LN' };

test('F8 one card per open pick (entered or awaiting); closed and skipped positions have none', () => {
  const cards = pickCards(L, planAutoBook(L)); assert.deepEqual(cards.map((c) => c.sym), ['OPENA', 'T1D', 'WAITB']);
});
test('F8 an entered pick: levels equal levels.ts for the same fill, R at the mark equals (mark − entry) / (entry − stop)', () => {
  const c = pickCards(L, planAutoBook(L)).find((x) => x.sym === 'OPENA')!;
  const want = levelsFor('OPENA', [{ ...P1, final: false, entry: 101 }]); assert.deepEqual(c.rungs.map((r) => r.v), want.map((w) => w.v));
  assert.equal(c.rungs[0].label, 'Entry'); assert.equal(c.rungs[0].v, 101); assert.equal(c.rungs.find((r) => r.label === 'Stop')!.v, 90);
  assert.equal(c.nowR, 0.55, '(107 − 101) / (101 − 90) = 0.545… = 0.55R'); assert.match(c.stateLine, /^Open · \+0\.55R at the last mark$/); assert.equal(c.asOf, '2026-11-12'); assert.equal(c.basis, 'entry');
  assert.equal(c.rungs.find((r) => r.label === 'T1')!.v, 123, 'horizon 60 is the long style: T1 = 101 + 2 × (101 − 90) by hand'); assert.equal(c.rungs.find((r) => r.label === 'T2')!.v, 145, 'T2 = 101 + 4 × 11');
});
test('F8 an awaiting pick is drawn at the signal close and says so', () => {
  const c = pickCards(L, planAutoBook(L)).find((x) => x.sym === 'WAITB')!; assert.equal(c.rungs[0].label, 'Signal close'); assert.equal(c.rungs[0].v, 100); assert.equal(c.basis, 'signal'); assert.equal(c.nowR, null); assert.match(c.stateLine, /Awaiting entry/);
  assert.match(pickSvg(c, PAL), /Levels at signal close/);
});
test('F8 after T1 the card says so; the stop is still the filed stop', () => {
  const c = pickCards(L, planAutoBook(L)).find((x) => x.sym === 'T1D')!; assert.match(c.stateLine, /^Target 1 filled · stop at entry · \+1\.20R at the last mark$/);
});
test('F8 every SVG says "paper only" and carries exactly its card\'s figures', () => {
  for (const c of pickCards(L, planAutoBook(L))) { const s = pickSvg(c, PAL); assert.ok(s.includes(PAPER)); for (const r of c.rungs) assert.ok(s.includes(r.v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))); assert.ok(s.includes(c.sym)); assert.ok(s.includes(c.asOf)); }
});
test('F8 the book card equals the snapshot: open, closed and total R from the one ledger view', () => {
  const plan = planAutoBook(L); const b = bookCard(L, plan); const lv = buildLedgerView(L, plan);
  assert.equal(b.open, lv.open); assert.equal(b.closed, lv.closed); assert.equal(b.closed, 1); assert.equal(b.totalR, -1); assert.equal(b.asOf, '2026-11-10');
  const s = bookSvg(b, PAL); assert.ok(s.includes('2 open · 1 closed')); assert.ok(s.includes('Total −1.00R')); assert.ok(s.includes(PAPER));
});
test('F8 an empty book says so instead of a zero, and cards escape markup in a name', () => {
  const E = emptyLedger('2026-11-12T00:00:00Z'); assert.equal(bookCard(E, planAutoBook(E)).totalR, null); assert.match(bookSvg(bookCard(E, planAutoBook(E)), PAL), /No closed positions yet/);
  const c = pickCards(L, planAutoBook(L))[0]; assert.doesNotMatch(pickSvg({ ...c, sym: 'A<B>&"' }, PAL), /A<B>/);
});
test('F8 no claim of return, no call to act', () => {
  const all = [...pickCards(L, planAutoBook(L)).map((c) => pickSvg(c, PAL)), bookSvg(bookCard(L, planAutoBook(L)), PAL)].join(' ');
  assert.doesNotMatch(all, /\b(buy|sell|guaranteed|profit|returns?|target price|upside)\b/i);
});
