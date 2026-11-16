// 15 Nov 2026 (Tripwire 4.0, F7): a hand-checked fixture of five symbols across two screen dates. The watchlist is the local follow list; nothing here touches the network or storage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripsOf } from '../src/trips.ts';
import { emptyLedger, pickId, type Ledger, type LedgerPick, type Outcome } from '../src/ledger.ts';
import { planAutoBook } from '../src/autobook.ts';
import type { Row } from '../src/screen.ts';

const pick = (asOf: string, sym: string, engine = 'QLT'): LedgerPick => ({ id: pickId(asOf, engine, sym), engine, sym, asOf, ref: 100, stop: 90, horizon: 60, score: 80, rank: 1 });
const side = (sym: string, o: Partial<Row> = {}): Row => ({ sym, name: sym, liquid: true, price: 105, sma20: 102, sma50: 100.5, sma200: 100, r3m: 4, ...o });   // 50-day under 1.01× the 200-day: sideways, price above the 200-day
const weak = (sym: string): Row => ({ sym, name: sym, liquid: true, price: 80, sma20: 85, sma50: 90, sma200: 100, r3m: -9 });                                // downtrend
const A = pick('2026-11-06', 'AAA'), B = pick('2026-11-06', 'BBB'), C = pick('2026-11-09', 'CCC');
const led = (outcomes: Record<string, Outcome>): Ledger => ({ ...emptyLedger('2026-11-12T00:00:00Z'), days: [{ asOf: '2026-11-06', recorded: 'x', engines: {} }, { asOf: '2026-11-09', recorded: 'x', engines: {} }], picks: [A, B, C], outcomes });
const ROWS = [side('AAA'), side('BBB'), side('CCC'), side('DDD'), weak('EEE')];
const SYMS = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'];

test('F7 screen date 1 (6 Nov): AAA and BBB tripped, CCC not yet picked, DDD in base, EEE no signal', () => {
  const l = { ...led({ [A.id]: { status: 'pending', final: false }, [B.id]: { status: 'open', final: false, entry: 101, entryDay: '2026-11-09', markDay: '2026-11-09' } }), picks: [A, B] };
  const t = tripsOf(SYMS, ROWS, '2026-11-06', l, planAutoBook(l));
  assert.deepEqual(t.map((x) => [x.sym, x.state]), [['AAA', 'tripped entry'], ['BBB', 'tripped entry'], ['CCC', 'in base'], ['DDD', 'in base'], ['EEE', 'no signal']]);
  assert.equal(t[0].asOf, '2026-11-06', 'a pick awaiting entry is judged on the day it was written'); assert.equal(t[1].asOf, '2026-11-09'); assert.equal(t[3].asOf, '2026-11-06'); assert.match(t[1].why, /entered on Mon 9 Nov; Target 1 not yet filled/);
});
test('F7 screen date 2 (12 Nov): AAA at T1, BBB stopped, CCC tripped, DDD in base, EEE no signal', () => {
  const l = led({
    [A.id]: { status: 'open', final: false, entry: 101, entryDay: '2026-11-09', t1Hit: true, t1Day: '2026-11-11', t1Px: 111, markDay: '2026-11-12' },
    [B.id]: { status: 'closed', final: true, entry: 101, entryDay: '2026-11-09', exit: 90, exitDay: '2026-11-10', reason: 'Stop', r: -1.03, markDay: '2026-11-12' },
    [C.id]: { status: 'pending', final: false },
  });
  const t = tripsOf(SYMS, ROWS, '2026-11-12', l, planAutoBook(l));
  assert.deepEqual(t.map((x) => [x.sym, x.state]), [['AAA', 'at T1'], ['BBB', 'stopped'], ['CCC', 'tripped entry'], ['DDD', 'in base'], ['EEE', 'no signal']]);
  assert.equal(t[1].asOf, '2026-11-10'); assert.match(t[1].why, /stopped out on Tue 10 Nov at −1\.03R/); assert.equal(t[3].asOf, '2026-11-12', 'screen-judged states carry the screen date');
});
test('F7 a name after T1 that then stops is not called "stopped": the stop-at-entry exit is a managed exit, so it falls to no signal', () => {
  const l = { ...led({ [A.id]: { status: 'closed', final: true, entry: 101, exit: 101, exitDay: '2026-11-12', reason: 'Stop', r: 0.55, t1Hit: true } }), picks: [A] };
  const t = tripsOf(['AAA'], [weak('AAA')], '2026-11-12', l, planAutoBook(l)); assert.equal(t[0].state, 'no signal');
});
test('F7 a name that is not in the screen is said so, and missing figures are never guessed', () => {
  assert.equal(tripsOf(['ZZZ'], ROWS, '2026-11-12', null, null)[0].why, 'Not in the last screen.');
  assert.match(tripsOf(['QQQ'], [{ sym: 'QQQ', name: 'Q', price: null }], '2026-11-12', null, null)[0].why, /figures to judge it are missing/);
});
test('F7 an empty watchlist gives an empty list', () => { assert.deepEqual(tripsOf([], ROWS, '2026-11-12', null, null), []); });
test('F7 the module is pure and offline: it names no network or storage API', async () => {
  const src = await import('node:fs').then((f) => f.readFileSync(new URL('../src/trips.ts', import.meta.url), 'utf8'));
  assert.doesNotMatch(src.replace(/\/\*\*[\s\S]*?\*\//, ''), /fetch\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|WebSocket/);
});
