import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCalls, CAPITAL, MAX_OPEN, TICKET, SECTOR_CAP, type Cand } from '../src/lib/book.ts';
const c = (symbol: string, score: number, sector: string | null = 'Tech', price: number | null = 100, screens = ['piotroski']): Cand => ({ symbol, screens, score, sector, price });
test('constants: Rs 1 crore, 30 positions, a ticket that leaves room for charges', () => { assert.equal(CAPITAL, 10_000_000); assert.equal(MAX_OPEN, 30); assert.ok(MAX_OPEN * TICKET <= CAPITAL); assert.ok(CAPITAL - MAX_OPEN * TICKET >= 50_000, 'at least Rs 50,000 left for buy charges'); assert.equal(SECTOR_CAP, 4); });
test('taken in score order, highest first; the book never exceeds 30 and says why the rest were not taken', () => {
  const cands = Array.from({ length: 45 }, (_, i) => c('S' + String(i).padStart(2, '0'), 100 - i, 'Sec' + (i % 15)));
  const d = selectCalls(cands, []); const taken = d.filter((x) => x.taken); assert.equal(taken.length, 30); assert.deepEqual(taken.map((x) => x.symbol), cands.slice(0, 30).map((x) => x.symbol)); const no = d.filter((x) => !x.taken); assert.equal(no.length, 15); assert.ok(no.every((x) => /book is full: 30 positions/.test(x.why!)));
});
test('sector cap of 4: a fifth name in one sector is refused with the sector named, and the next name in another sector is taken instead', () => {
  const cands = [...Array.from({ length: 6 }, (_, i) => c('T' + i, 90 - i, 'Technology')), c('H1', 10, 'Healthcare')]; const d = selectCalls(cands, []);
  assert.equal(d.filter((x) => x.taken && x.symbol.startsWith('T')).length, 4); const t5 = d.find((x) => x.symbol === 'T4')!; assert.equal(t5.taken, false); assert.match(t5.why!, /4 positions are already running in Technology/); assert.equal(d.find((x) => x.symbol === 'H1')!.taken, true);
});
test('a name already held is not taken twice; a stock on several screens is one position credited to the first screen in order', () => {
  const d = selectCalls([c('A', 50, 'X', 100, ['conservative-quality', 'magic-formula', 'piotroski']), c('B', 40)], [{ symbol: 'B', sector: 'Tech' }]);
  const a = d.find((x) => x.symbol === 'A')!; assert.equal(a.taken, true); assert.equal(a.screen_id, 'piotroski'); assert.equal(d.find((x) => x.symbol === 'B')!.why, 'The same name is already held.'); assert.equal(d.filter((x) => x.symbol === 'A').length, 1);
});
test('held positions count against the 30, so freed slots are reused and full books refuse', () => {
  const held = Array.from({ length: 29 }, (_, i) => ({ symbol: 'H' + i, sector: 'S' + i })); const d = selectCalls([c('N1', 9, 'Z1'), c('N2', 8, 'Z2')], held); assert.equal(d[0].taken, true); assert.equal(d[1].taken, false); assert.match(d[1].why!, /book is full/);
});
test('one share dearer than the ticket, or no price, is refused with the reason; deterministic', () => {
  const d = selectCalls([c('MRFLIKE', 99, 'Auto', 450_000), c('NOPX', 98, 'Auto', null), c('FINE', 97, 'Auto', 3000)], []); assert.match(d[0].why!, /more than the ₹3,30,000 ticket/); assert.match(d[1].why!, /No closing price/); assert.equal(d[2].taken, true);
  assert.deepEqual(selectCalls([c('B', 5), c('A', 5)], []).map((x) => x.symbol), ['A', 'B'], 'ties go to the symbol, so the book is reproducible');
});
