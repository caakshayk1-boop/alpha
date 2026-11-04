import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeed } from '../src/alertsfeed.ts';
import type { BookRow } from '../src/book.ts';
import type { Ledger } from '../src/ledger.ts';

const NOW = Date.parse('2026-11-04T05:00:00Z') / 1000;
const row = (sym: string, v: Record<string, unknown>, stop = 95): BookRow => ({ p: { id: sym, sym, engine: 'MOM', asOf: '2026-10-29', ref: 100, stop, horizon: 20, qty: 100, takenAt: 1 }, v: { id: sym, status: 'open', entry: 100, mark: 110, markKind: 'live', pnl: 1000, r: 2, pct: 10, sessions: 3, left: 17, ...v } as never, q: null, dayPnl: null, markT: null });
const ledger = { schema: 'tripwire-ledger/1', started: '2026-10-23', updated: 'x', cost: .25, days: [{ asOf: '2026-11-03', recorded: 'x', engines: {} }], outcomes: {}, voided: { '2026-11-03|MOM|V': 'void' },
  picks: [['MOM', 'A'], ['MOM', 'B'], ['QLT', 'C'], ['ST', 'D'], ['MOM', 'V']].map(([engine, sym]) => ({ id: `2026-11-03|${engine}|${sym}`, engine, sym, asOf: '2026-11-03', ref: 1, stop: 1, horizon: 10, score: 1, rank: 1 })) } as unknown as Ledger;

test('an empty book and no ledger gives an empty feed', () => { assert.deepEqual(buildFeed({ hits: [], rows: [], ledger: null, nowSec: NOW }), []); });
test('a position within 3% of its stop is flagged, with the exact distance', () => {
  const f = buildFeed({ hits: [], rows: [row('NEAR', { mark: 97.5, r: -0.5 }), row('FAR', { mark: 110 })], ledger: null, nowSec: NOW });
  assert.equal(f.length, 1); assert.equal(f[0].kind, 'near-stop'); assert.equal(f[0].text, 'NEAR is 2.6% above its stop.');   // (97.5 - 95) / 97.5 = 2.56%
});
test('a position that closed in the last three days is listed, an older one is not', () => {
  const recent = row('REC', { status: 'closed', exitT: NOW - 86400, reason: 'Target 2', r: 2.21 }); const old = row('OLD', { status: 'closed', exitT: NOW - 5 * 86400, reason: 'Stop', r: -1 });
  const f = buildFeed({ hits: [], rows: [recent, old], ledger: null, nowSec: NOW }); assert.deepEqual(f.map((x) => x.text), ['REC closed: target 2 (+2.2R).']);
});
test('target fills and the newest night of picks (voided picks left out), in order of how much a person might want to look', () => {
  const f = buildFeed({ hits: [{ id: 'h1', sym: 'HIT', engine: 'MOM', kind: 'T1', level: 100, price: 101.5, session: '2026-11-03', text: 'x' } as never], rows: [row('NEAR', { mark: 97.5, r: -0.5 })], ledger, nowSec: NOW });
  assert.deepEqual(f.map((x) => x.kind), ['near-stop', 'target', 'picks']);
  assert.equal(f[2].text, '4 new picks recorded for 2026-11-03: 2 Momentum, 1 Quality, 1 Short-Term.');
});
test('the feed is capped and never advises', () => {
  const many = Array.from({ length: 12 }, (_, i) => row(`N${i}`, { mark: 97 + i * 0.01, r: -.5 })); const f = buildFeed({ hits: [], rows: many, ledger, nowSec: NOW, max: 5 }); assert.equal(f.length, 5);
  assert.ok(f.every((x) => !/\b(buy|sell|hold|should|will|expect)\b/i.test(x.text)));
});
test('a live mark through the stop is still a near-stop alert, worded as below the stop with no exit claimed', () => {
  const f = buildFeed({ hits: [], rows: [row('THRU', { mark: 92, r: -1.6 }), row('AT', { mark: 95, r: -1 })], ledger: null, nowSec: NOW });
  assert.ok(f.every((x) => x.kind === 'near-stop')); assert.deepEqual(f.map((x) => x.text).sort(), ['AT is at its stop; no exit is recorded yet.', 'THRU is 3.3% below its stop; no exit is recorded yet.']);   // (95 - 92) / 92 = 3.26%
});
