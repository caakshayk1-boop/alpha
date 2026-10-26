import test from 'node:test';
import assert from 'node:assert/strict';
import { askInWords } from '../src/ask.ts';

const desc = (t: string) => askInWords(t).conds.map((c) => `${c.m}${c.op === 'gte' ? '>=' : '<='}${c.v}`);

test('a figure, a direction and a number become one condition each', () => {
  assert.deepEqual(desc('pe under 25 and roce above 15'), ['pe<=25', 'roce_med>=15']);
  assert.deepEqual(desc('sales growth over 10%, de below 0.5'), ['rev_cagr>=10', 'de<=0.5']);
  assert.deepEqual(desc('turnover at least ₹25 cr'), ['turnover_cr>=25']);
});
test('the longest name wins: "net margin" is not read as "margin" of something else, "3 month return" is not "1 month"', () => {
  assert.deepEqual(desc('net margin above 10'), ['net_margin>=10']);
  assert.deepEqual(desc('3 month return above 20'), ['r3m>=20']);
});
test('shortcuts expand to exactly the figures they stand for', () => {
  assert.deepEqual(desc('debt free'), ['de>=0', 'de<=0.1']);
  assert.deepEqual(desc('oversold with high volume'), ['rsi<=30', 'vol_spike>=2']);
  assert.deepEqual(desc('near 52 week high'), ['from_high>=-5']);
});
test('a negative number is kept', () => assert.deepEqual(desc('from high above -10'), ['from_high>=-10']));
test('opinions and unknown words are returned unread, never guessed', () => {
  const a = askInWords('cheap good stocks with roce above 20');
  assert.deepEqual(a.conds.map((c) => c.m), ['roce_med']);
  assert.ok(a.unread.some((u) => /cheap/.test(u)));
  assert.deepEqual(askInWords('nothing useful here at all').conds, []);
});
test('nothing is invented from an empty or numberless sentence', () => {
  assert.deepEqual(askInWords('').conds, []);
  assert.deepEqual(askInWords('pe under').conds, []);
});
test('the same sentence twice does not duplicate a condition', () => assert.equal(askInWords('pe under 25 and pe under 25').conds.length, 1));
