// Run with: node --test tests/   (What changed in 30 days)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatChanged } from '../src/lib/changes.ts';
import type { ChartFeed, Row, Sig } from '../src/lib/types.ts';

const now = Date.parse('2026-10-21T12:00:00Z');
const day = (d: string) => Date.parse(`${d}T10:00:00Z`) / 1000;
// 300 sessions rising slowly, so the last close is a 52-week high, with one 6% fall inside the window
const t: number[] = [], c: number[] = [], n: number[] = [];
for (let i = 0; i < 300; i++) { const d = new Date(now - (300 - i) * 864e5); t.push(d.getTime() / 1000); c.push(100 + i * 0.2); n.push(20000 + i * 5); }
c[290] = c[289] * 0.94;
const chart = { ok: true, sym: 'TCS', range: '1y', interval: '1d', t, o: c, h: c, l: c, c, v: c, nifty: n } as ChartFeed;
const row = { sym: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', price: 160, next_earnings: '2026-10-09' } as Row;

test('lists the move against the Nifty, a new 52-week high, the big day and the results date, newest first', () => {
  const out = whatChanged({ row, chart, news: [], sigs: [], now });
  const kinds = out.items.map((x) => x.kind);
  assert.ok(kinds.includes('price') && kinds.includes('extreme') && kinds.includes('move') && kinds.includes('results'));
  assert.match(out.items.find((x) => x.kind === 'price')!.text, /against the Nifty's \+/);
  // the fall is 6.0%, the rebound the next session 6.7%: the larger of the two is reported
  assert.match(out.items.find((x) => x.kind === 'move')!.text, /^Rose 6\.7% on/);
  assert.deepEqual([...out.items].sort((a, b) => (a.date < b.date ? 1 : -1)).map((x) => x.date), out.items.map((x) => x.date));
  assert.ok(out.notes.some((x) => /Only the previous-build rank comparison/.test(x)), 'a longer rank history is declared unavailable, never invented (C13)');
  assert.ok(!out.items.some((x) => x.kind === 'rank'), 'no rank_move on the row: no rank item');
});

test('news counts only stories that name the company and fall in the window', () => {
  const news = [
    { title: 'TCS wins a deal', summary: '', link: 'https://x/1', source: 'Mint', published: '2026-10-15T08:00:00Z', mentions: ['TCS'] },
    { title: 'Infosys wins a deal', summary: '', link: 'https://x/2', source: 'Mint', published: '2026-10-15T08:00:00Z', mentions: ['INFY'] },
    { title: 'Old TCS story', summary: '', link: 'https://x/3', source: 'Mint', published: '2026-08-01T08:00:00Z', mentions: ['TCS'] },
  ];
  const out = whatChanged({ row, chart: null, news, sigs: [], now });
  assert.deepEqual(out.items.filter((x) => x.kind === 'news').map((x) => x.text), ['TCS wins a deal']);
  assert.ok(out.notes.some((x) => /Price history could not be loaded/.test(x)));
});

test('signal events in the window are listed with their result after costs', () => {
  const sig = { sym: 'TCS', setup: 'Pullback', date: '2026-10-01', entry_date: '2026-10-02', entry: 3000, status: 'closed', closed_date: '2026-10-12', exit_reason: 't2', r_net: 1.42, first_seen: '2026-10-01' } as unknown as Sig;
  const out = whatChanged({ row, chart: null, news: [], sigs: [sig], now });
  assert.deepEqual(out.items.filter((x) => x.kind === 'signal').map((x) => x.text), ['Swing plan closed (t2), +1.42R after costs', 'Swing plan entered at ₹3000', 'Swing pullback signal filed']);
});
