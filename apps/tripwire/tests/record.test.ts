// The one Record (recordview.ts), the booking-seen memory (bookingseen.ts) and the rule that book.css moves nothing outside html.fx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyLedger, summarizeLedger, voidOutcomes, pickId, MIN_TRADES, type Ledger, type LedgerPick, type Outcome } from '../src/ledger.ts';
import { closedItems, definitionLines, figuresOf, throughOf, viewOfClosed } from '../src/recordview.ts';
import { STYLES } from '../src/exits.ts';
import { bookingKey, markSeen, newBookings, SEEN_KEY, pageStore } from '../src/bookingseen.ts';

const pick = (asOf: string, sym: string, engine = 'QLT', o: Partial<LedgerPick> = {}): LedgerPick => ({ id: pickId(asOf, engine, sym), engine, sym, asOf, ref: 1700, stop: 1650, horizon: 60, score: 80, rank: 1, ...o });
const closed = (r: number, exitDay: string, o: Partial<Outcome> = {}): Outcome => ({ status: 'closed', final: true, entry: 1700, entryDay: '2026-10-27', exit: 1700 + r * 50, exitDay, reason: r > 0 ? 'Time' : 'Stop', r, pct: r * 3, sessions: 4, markDay: exitDay, ...o });
const led = (picks: LedgerPick[], outcomes: Record<string, Outcome>, days = ['2026-10-29', '2026-10-30'], voided?: Record<string, string>): Ledger =>
  ({ ...emptyLedger('2026-10-30T00:00:00Z'), days: days.map((asOf) => ({ asOf, recorded: `${asOf}T20:00:00Z`, engines: {} })), picks, outcomes, ...(voided ? { voided } : {}) });
// 08:00 India time on Sat 31 Oct 2026: the 30 Oct session is the last one completed
const SAT = Date.parse('2026-10-31T02:30:00Z');

const a = pick('2026-10-27', 'AAA'), b = pick('2026-10-27', 'BBB'), c = pick('2026-10-28', 'CCC', 'MOM', { horizon: 20 }), d = pick('2026-10-28', 'DDD'), old = pick('2026-10-20', 'OLD', 'LVT');
const L = led([a, b, c, d, old], {
  [a.id]: closed(1.5, '2026-10-29'), [b.id]: closed(-1, '2026-10-30'), [c.id]: { status: 'open', final: false, entry: 100, entryDay: '2026-10-29', mark: 105, markDay: '2026-10-30', r: 0.5 },
  [d.id]: { status: 'skipped', final: true, skipReason: 'gap' }, [old.id]: closed(2, '2026-10-26'),
}, ['2026-10-27', '2026-10-28', '2026-10-30'], { [d.id]: 'test void' });

test('the headline numbers ARE the ledger summary: one count, no second tally', () => {
  const f = figuresOf(L), s = summarizeLedger(L).all;
  assert.equal(f.closed, s.closed); assert.equal(f.totalR, s.totalR); assert.equal(f.picks, s.picks); assert.equal(f.open, s.open);
  assert.equal(f.closed, 2, 'the retired LVT engine and the voided pick are out'); assert.equal(f.totalR, 0.5); assert.equal(f.wins, 1);
});
test('win rate and average R are withheld below 30 trades, and a sum of nothing is not zero', () => {
  const f = figuresOf(L); assert.equal(f.winRate, null); assert.equal(f.avgR, null); assert.equal(f.enough, false); assert.equal(f.needed, MIN_TRADES);
  assert.equal(figuresOf(led([], {})).totalR, null);
});
test('at 30 closed the rate and average appear', () => {
  const ps = Array.from({ length: 30 }, (_, i) => pick('2026-10-27', `S${i}`)); const os = Object.fromEntries(ps.map((p, i) => [p.id, closed(i < 12 ? 1 : -1, '2026-10-29')]));
  const f = figuresOf(led(ps, os)); assert.equal(f.closed, 30); assert.equal(f.winRate, 40); assert.equal(f.avgR, -0.2); assert.equal(f.enough, true);
});
test('closed positions: newest exit first, voided and retired excluded, each trade once', () => {
  const items = closedItems(L); assert.deepEqual(items.map((x) => x.pick.sym), ['BBB', 'AAA']);
  assert.equal(new Set(items.map((x) => x.pick.id)).size, items.length);
});
test('a voided pick has no live outcome and is in no list or total', () => {
  const v = voidOutcomes(led([a], { [a.id]: closed(3, '2026-10-29') }, undefined, { [a.id]: 'wrong data' }));
  assert.deepEqual(v.outcomes[a.id], { status: 'void', final: true }); assert.equal(closedItems(v).length, 0); assert.equal(figuresOf(v).closed, 0);
});
test('closed outcomes are never rewritten: reading the record leaves it byte-identical', () => {
  const before = JSON.stringify(L); figuresOf(L); closedItems(L); throughOf(L, SAT); summarizeLedger(L);
  const frozen = JSON.parse(before); Object.freeze(frozen.outcomes[a.id]);
  assert.doesNotThrow(() => { closedItems(frozen); figuresOf(frozen); }); assert.equal(JSON.stringify(L), before);
});
test('picks-through and outcomes-through come from the ledger and are judged by the one freshness module', () => {
  const t = throughOf(L, SAT); assert.equal(t.picks.day, '2026-10-30'); assert.equal(t.outcomes.day, '2026-10-30'); assert.equal(t.agree, true); assert.equal(t.picks.status, 'current');
  assert.match(t.picks.word, /Fri 30 Oct/);
});
test('outcomes that trail the picks are named, with the lag in sessions', () => {
  const lag = led([a, c], { [a.id]: closed(1, '2026-10-28'), [c.id]: { status: 'open', final: false, entry: 100, entryDay: '2026-10-28', mark: 101, markDay: '2026-10-28' } }, ['2026-10-27', '2026-10-30']);
  const t = throughOf(lag, SAT); assert.equal(t.agree, false); assert.equal(t.picks.day, '2026-10-30'); assert.equal(t.outcomes.day, '2026-10-28'); assert.equal(t.lag, 2); assert.equal(t.outcomes.status, 'stale');
});
test('an empty ledger has no dates, not invented ones', () => {
  const t = throughOf(led([], {}, []), SAT); assert.equal(t.picks.day, null); assert.equal(t.outcomes.day, null); assert.equal(t.picks.word, 'not yet');
});
test('one R and one T2: the sentence is built from the style table that books them', () => {
  const def = definitionLines(); for (const s of STYLES) { assert.ok(def.targets.includes(`${s.t1}R`) && def.targets.includes(`${s.t2}R`), s.id); }
  assert.match(def.r, /fill .* minus the stop/);
});
test('a closed pick the book never took has R but no rupee figure', () => {
  assert.equal(viewOfClosed(a, closed(1.5, '2026-10-29'), null, null).pnl, null); assert.equal(viewOfClosed(a, closed(1.5, '2026-10-29'), 10, 123).pnl, 123);
  assert.equal(viewOfClosed(a, closed(1.5, '2026-10-29'), null, null).r, 1.5);
});

/* ---- the booking-seen memory ---- */
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };
test('the first read has no earlier visit, so nothing is new and nothing sweeps', () => {
  const s = mem(); const k = bookingKey('p1', 'T1', '2026-10-30'); assert.equal(newBookings([k], s).size, 0); markSeen([k], s);
  assert.equal(newBookings([k], s).size, 0, 'seen now');
});
test('a booking that arrives after the first visit is new exactly once', () => {
  const s = mem(); markSeen([], s); assert.ok(s.m.has(SEEN_KEY));
  const k = bookingKey('p1', 'T2', '2026-11-02'); assert.deepEqual([...newBookings([k], s)], [k]); markSeen([k], s); assert.equal(newBookings([k], s).size, 0);
});
test('unreadable storage never throws', () => {
  const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.doesNotThrow(() => { newBookings(['x'], bad); markSeen(['x'], bad); });
});

/* ---- book.css: motion is a layer, and the layer is html.fx ---- */
test('book.css: every animation and transition sits under html.fx, and only transform and opacity move', () => {
  const css = readFileSync(new URL('../src/book.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
  const moving = rules.filter((r) => /(^|;)\s*(animation|transition)(-[a-z]+)?\s*:/.test(r.body));
  assert.ok(moving.length >= 4, 'the motion rules exist');
  for (const r of moving) { assert.ok(r.sel.split(',').every((s) => s.trim().startsWith('html.fx')), `not under html.fx: ${r.sel}`); const t = /transition\s*:\s*([a-z-]+)/.exec(r.body); if (t) assert.ok(['transform', 'opacity'].includes(t[1]), r.sel); }
  const kf = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?\})\s*\}/g)].map((m) => m[1]).join(' ');
  assert.ok(!/(?<![-\w])(left|top|width|height|margin|padding|background)\s*:/.test(kf), 'keyframes touch transform/opacity only');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'no hex colour');
});
/* 11 Nov 2026 (revamp v2): the Book's new layer, book2.css, keeps the same two rules: motion under html.fx only, transform and opacity only, and tokens only. */
test('book2.css: motion only under html.fx, only transform and opacity; tokens only; reduced motion switches it off', () => {
  const css = readFileSync(new URL('../src/book2.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().replace(/^@media[^{]*\{/, '').trim(), body: m[2] }));
  const moving = rules.filter((r) => /(^|;)\s*(animation|transition)(-[a-z]+)?\s*:/.test(r.body));
  assert.ok(moving.length >= 4, 'the motion rules exist');
  for (const r of moving) { assert.ok(r.sel.split(',').every((s) => s.trim().startsWith('html.fx')), `not under html.fx: ${r.sel}`); const t = /transition\s*:\s*([a-z-]+)/.exec(r.body); if (t) assert.ok(['transform', 'opacity'].includes(t[1]), r.sel); }
  const kf = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?\})\s*\}/g)].map((m) => m[1]).join(' ');
  assert.ok(!/(?<![-\w])(left|top|width|height|margin|padding|background)\s*:/.test(kf), 'keyframes touch transform/opacity only');
  assert.ok(/prefers-reduced-motion:\s*reduce/.test(css), 'reduced motion is honoured');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css) && !/font-family\s*:/.test(css) && !/rgb\(|rgba\(|hsl\(/.test(css), 'tokens only');
});
test('book.css reads the design tokens: no literal font family, no new palette', () => {
  const css = readFileSync(new URL('../src/book.css', import.meta.url), 'utf8');
  assert.ok(!/font-family\s*:/.test(css)); assert.ok(!/rgb\(|rgba\(|hsl\(/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')));
});

test('pageStore: a browser that throws on merely reading localStorage gives null, not a crash', () => {
  const g = globalThis as Record<string, unknown>; const had = Object.getOwnPropertyDescriptor(g, 'localStorage');
  Object.defineProperty(g, 'localStorage', { configurable: true, get() { throw new Error('SecurityError: access denied'); } });
  try { assert.equal(pageStore(), null); } finally { if (had) Object.defineProperty(g, 'localStorage', had); else delete g.localStorage; }
});
