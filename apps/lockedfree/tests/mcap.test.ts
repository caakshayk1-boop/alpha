import { test } from 'node:test'; import assert from 'node:assert/strict';
import { deriveMcap } from '../src/lib/feed.ts';
const yr = (pat_cr: any, eps: any) => ({ years: [{ fy: 'FY26', pat_cr, eps }] });
test('L-01: a missing market cap is derived as close × net profit ÷ EPS and marked derived', () => {
  const rows: any[] = [{ sym: 'A', price: 100 }]; assert.equal(deriveMcap(rows, { A: yr(5000, 50) }), 1);
  assert.equal(rows[0].mcap_cr, 10000); assert.equal(rows[0].mcap_src, 'derived');
});
test('a source market cap is never replaced', () => { const rows: any[] = [{ sym: 'A', price: 100, mcap_cr: 777 }]; assert.equal(deriveMcap(rows, { A: yr(5000, 50) }), 0); assert.equal(rows[0].mcap_cr, 777); assert.equal(rows[0].mcap_src, undefined); });
test('any missing, zero or negative input leaves the cap missing, never estimated', () => {
  const rows: any[] = [{ sym: 'A' }, { sym: 'B', price: 100 }, { sym: 'C', price: 100 }, { sym: 'D', price: 100 }, { sym: 'E', price: 100 }, { sym: 'F', price: 0 }];
  const d = { A: yr(5000, 50), B: {}, C: yr(-10, 5), D: yr(10, 0), E: yr(null, 5), F: yr(5000, 50) };
  assert.equal(deriveMcap(rows, d), 0); for (const r of rows) assert.equal(r.mcap_cr, undefined, r.sym);
});
test('L-01 guard: after derivation no company in the real feed\'s 100 most traded lacks a market cap', async (t) => {
  const { feedAvailable, loadFeed, num } = await import('../src/lib/feed.ts'); if (!feedAvailable()) return t.skip('no feed downloaded');
  const F = loadFeed(), top = F.rows.filter((r) => num(r, 'turnover_cr') != null).sort((a, b) => num(b, 'turnover_cr')! - num(a, 'turnover_cr')!).slice(0, 100);
  const missing = top.filter((r) => num(r, 'mcap_cr') == null).map((r) => r.sym); assert.deepEqual(missing, [], `no market cap for: ${missing.join(', ')}`);
});
