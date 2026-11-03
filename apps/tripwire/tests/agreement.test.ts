import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agree, agreementSettings, modelOutputs, DEFAULT_AGREEMENT, type ModelOutput } from '../src/agreement.ts';
import { runSignalEngines } from '../src/signalengine.ts';
import { buildCtx, evaluate, engineDef, type Q } from '../src/quant.ts';
import { targetsFor } from '../src/exits.ts';
const day = '2026-11-03';
const votes = (): ModelOutput[] => ['trend', 'structure', 'momentum'].map((id) => ({ id, name: id, direction: 'long', vote: true, confidence: 'high', rationale: 'Measured confirmation', timestamp: `${day}T15:30:00+05:30`, valid: true, fresh: true }));
const row = (extra: Partial<Q> = {}): Q => ({ sym: 'X', name: 'Example', sector: 'Technology', tier: 'large', liquid: true, turnover_cr: 50, price: 100, sma20: 99, sma50: 90, sma200: 80, atr_pct: 2, rsi: 55, rs3m: 5, r1d: 1, r1w: 4, r1y: 40, r1m: 5, from_high: -3, r6m: 20, sd1y: 20, piotroski: 8, roce_med: 25, de: .3, mf: { rank: 5, of: 100 }, last_date: day, ...extra });
test('three model votes, directional disagreement and configurable minimum', () => {
  assert.equal(agree(votes(), 3, day).pass, true);
  const m = votes(); m[2] = { ...m[2], direction: 'bearish', vote: false };
  assert.equal(agree(m, 3, day).pass, false); assert.equal(agree(m, 2, day).pass, true);
  m[1] = { ...m[1], direction: 'bearish', vote: false };
  assert.equal(agree(m, 1, day).pass, false, 'two opposing models do not support a one-vote long');
  assert.equal(agree(m.map((x) => ({ ...x, direction: 'bearish', vote: false })), 2, day).pass, false, 'no short selling');
});
test('missing, stale, future, duplicate and excess outputs never inflate votes', () => {
  for (const invalid of [{ valid: false }, { fresh: false }, { timestamp: null }, { timestamp: '2026-11-04T15:30:00+05:30' }, { timestamp: '2026-11-03garbage' }]) {
    const m = votes(); m[2] = { ...m[2], ...invalid }; assert.equal(agree(m, 3, day).count, 2); assert.equal(agree(m, 3, day).pass, false);
  }
  const m = votes(); m[2].id = m[1].id; assert.equal(agree(m, 2, day).count, 1);
  assert.equal(agree([...votes(), { ...votes()[0], id: 'fourth' }], 3, day).pass, false);
  assert.equal(agree([], 1, day).pass, false);
});
test('each engine has exactly three distinct outputs, visible rationale and session', () => {
  for (const id of ['MOM', 'QLT', 'ST'] as const) {
    const m = modelOutputs(id, row(), day, day); assert.equal(m.length, 3); assert.equal(new Set(m.map((x) => x.id)).size, 3);
    assert.ok(m.every((x) => x.vote && x.rationale.length > 10 && x.timestamp && x.confidence !== 'unavailable'));
    assert.equal(agree(modelOutputs(id, row({ last_date: '2026-11-02' }), day, day), 1, day).pass, false);
    assert.equal(agree(modelOutputs(id, row({ stale: true }), day, day), 1, day).pass, false);
  }
  assert.equal(modelOutputs('MOM', row({ rsi: null }), day, day)[2].vote, false);
  assert.equal(modelOutputs('MOM', row({ rsi: 101 }), day, day)[2].valid, false);
  assert.equal(modelOutputs('ST', row({ sma20: -1 }), day, day)[0].valid, false);
  assert.equal(modelOutputs('QLT', row({ de: -1 }), day, day)[0].valid, false);
  assert.equal(modelOutputs('QLT', row({ mf: { rank: 0, of: 100 } }), day, day)[1].valid, false);
});
test('engine settings, timeframes, stops and targets are independent', () => {
  assert.deepEqual(agreementSettings({ MOM: 2, QLT: 1, ST: 9 }), { MOM: 2, QLT: 1, ST: 3 });
  assert.deepEqual(DEFAULT_AGREEMENT, { MOM: 3, QLT: 3, ST: 3 });
  const a = runSignalEngines([row({ rsi: 80 })], day, day); const b = runSignalEngines([row({ rsi: 80 })], day, day, { MOM: 3, QLT: 3, ST: 2 });
  assert.equal(a.runs[2].candidates[0].agreement.pass, false); assert.equal(b.runs[2].candidates[0].agreement.pass, true);
  assert.deepEqual(a.runs[0], b.runs[0]); assert.deepEqual(a.runs[1], b.runs[1]);
  assert.deepEqual(['MOM', 'QLT', 'ST'].map((id) => engineDef(id as 'MOM').horizon), [20, 60, 10]);
  assert.deepEqual(['MOM', 'QLT', 'ST'].map((id) => engineDef(id as 'MOM').atrMult), [2.5, 3, 1.5]);
  assert.deepEqual([20, 60, 10].map((horizon) => targetsFor({ asOf: day, horizon })), [{ style: 'swing', t1R: 1.5, t2R: 3 }, { style: 'long', t1R: 2, t2R: 4 }, { style: 'short', t1R: 1, t2R: 2 }]);
});
test('old MOM and QLT filters still apply; agreement is not a replacement score', () => {
  const rows = Array.from({ length: 30 }, (_, i) => row({ sym: `S${i}`, r1y: 10 + i * 4, sector: `Sector${i % 8}` }));
  const ctx = buildCtx(rows); const out = runSignalEngines(rows, day, day, { MOM: 1, QLT: 1, ST: 1 });
  for (const r of out.runs.filter((x) => x.id !== 'ST')) for (const p of r.picks) assert.equal(evaluate(r.id, rows.find((x) => x.sym === p.sym)!, ctx).pass, true);
  assert.ok(out.picks.length > 0); assert.equal(new Set(out.picks.map((x) => x.sym)).size, out.picks.length);
  const held = new Set(out.picks.map((x) => x.sym)); const again = runSignalEngines(rows, day, day, DEFAULT_AGREEMENT, held);
  assert.ok(again.picks.every((x) => !held.has(x.sym)));
  assert.ok(again.runs.some((r) => r.candidates.some((c) => c.status === 'watch' && /Already open/.test(c.reason))));
  assert.equal(runSignalEngines(rows, day, '2026-11-04').picks.length, 0);
});
test('a dataset one session behind is shown against its own session; the strict check still refuses it', () => {
  const rows = Array.from({ length: 30 }, (_, i) => row({ sym: `S${i}`, r1y: 10 + i * 4, sector: `Sector${i % 8}`, last_date: '2026-11-02' }));
  assert.ok(runSignalEngines(rows, '2026-11-02', '2026-11-02', { MOM: 1, QLT: 1, ST: 1 }).picks.length > 0, 'previous-session data reads against its own session');
  assert.equal(runSignalEngines(rows, '2026-11-02', '2026-11-03', { MOM: 1, QLT: 1, ST: 1 }).picks.length, 0, 'the recorder asks for the expected session and gets nothing from older data');
  const mixed = rows.map((r, i) => (i === 0 ? { ...r, stale: true } : r)); const c = runSignalEngines(mixed, '2026-11-02', '2026-11-02', { MOM: 1, QLT: 1, ST: 1 }).runs[0].candidates.find((x) => x.sym === 'S0')!;
  assert.equal(c.agreement.count, 0, 'a row stale within its own dataset never votes');
});
