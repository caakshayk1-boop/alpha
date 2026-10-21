// Run with: node --test tests/   (the Screen's advanced text query)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeQuery, parseQuery } from '../src/lib/query.ts';
import type { Row } from '../src/lib/types.ts';

const row = (o: Partial<Row>) => ({ sym: 'X', name: 'X', sector: 'S', price: 100, ...o }) as Row;
const ok = (q: string) => { const r = parseQuery(q); if ('message' in r) throw new Error(r.message); return r; };

test('the example from the spec: a conjunction becomes one chip per clause', () => {
  const r = ok('roe > 14 and debt_to_equity < 0.5');
  assert.deepEqual(r.filters.map((f) => f.label), ['ROE above 14%', 'Debt/equity below 0.5']);
  assert.equal(r.combined.test(row({ roe: 20, de: 0.2 })), true);
  assert.equal(r.combined.test(row({ roe: 20, de: 0.9 })), false);
});

test('or, not and brackets keep their precedence; aliases resolve', () => {
  const r = ok('(roce >= 20 or roe >= 20) and not pe > 40');
  assert.equal(r.filters.length, 2);
  assert.equal(r.combined.test(row({ roce: 25, pe: 30 })), true);
  assert.equal(r.combined.test(row({ roe: 25, pe: 50 })), false);
  assert.equal(ok('de <= 0.3').filters[0].label, 'Debt/equity at most 0.3');
});

test('missing data never matches, not even through "not"', () => {
  const r = ok('not pe > 40');
  assert.equal(r.combined.test(row({ pe: null })), false);
  assert.equal(ok('roe > 10').combined.test(row({})), false);
});

test('errors are explained with a position, never a silently different screen', () => {
  const e = parseQuery('roic > 15');
  assert.ok('message' in e && /did you mean roce/.test(e.message) && e.at === 0);
  const e2 = parseQuery('roe > and pe < 10');
  assert.ok('message' in e2 && /needs a number/.test(e2.message));
  const e3 = parseQuery('(roe > 10');
  assert.ok('message' in e3 && /not closed/.test(e3.message));
  const e4 = parseQuery('roe > 10 pe < 5');
  assert.ok('message' in e4 && /Expected "and" or "or"/.test(e4.message));
});

test('plain English is left to the plain-English parser', () => {
  assert.equal(looksLikeQuery('large cap IT roce above 25'), false);
  assert.equal(looksLikeQuery('roe>14'), true);
});

test('conditions: one company or every watched name; missing values are not "not met"', async () => {
  const { check, parseCondition } = await import('../src/lib/conditions.ts');
  const c = parseCondition('tcs: rsi < 30');
  assert.ok(!('message' in c) && c.sym === 'TCS' && c.query === 'rsi < 30');
  const rows = [row({ sym: 'TCS', rsi: 25 }), row({ sym: 'INFY', rsi: 45 }), row({ sym: 'WIPRO' })];
  const all = parseCondition('rsi < 30');
  assert.ok(!('message' in all));
  if ('message' in all) return;
  assert.deepEqual(check(all, rows, ['TCS', 'INFY', 'WIPRO', 'GONE']).map((x) => [x.sym, x.met]), [['TCS', true], ['INFY', false], ['WIPRO', null], ['GONE', null]]);
  const bad = parseCondition('TCS: price targets > 5');
  assert.ok('message' in bad);
});
