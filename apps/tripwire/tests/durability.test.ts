// 12 Nov 2026 (Tripwire 2.0): acceptance §5.11, durability of the ledger layer against old, malformed and partial saved state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBackup, DEFAULTS, exportJson, takePaper, readSaved } from '../src/store.ts';
import { loadState, saveState } from '../src/persist.ts';
import { snapshotOf, splitOfRow, lifeStateOf, buildLedgerView } from '../src/ledgerview.ts';
import { emptyLedger } from '../src/ledger.ts';
import { planAutoBook } from '../src/autobook.ts';

const take = () => takePaper(DEFAULTS, { sym: 'TCS', engine: 'QLT', asOf: '2026-11-11', ref: 100, stop: 90, horizon: 20, qty: 10 }, 1_700_000_000).s;
const rowOf = (ladder: unknown) => ({ p: { id: 'p1', sym: 'TCS', engine: 'QLT', qty: 100, stop: 90 }, v: { status: 'open', entry: 100, mark: 110, markKind: 'close' as const, pnl: 1, r: 0.1, sessions: 2, ladder: ladder as never }, dayPnl: null, owner: 'you' as const });

test('an old tripwire:v1 payload (no lifecycle id, no ladder, no last view) imports whole and migrates on read', () => {
  const old = { app: 'tripwire', v: 1, follows: [], entries: [], plans: [], paper: [{ id: 'abc', sym: 'INFY', ref: 100, stop: 90, qty: 5, takenAt: 1_700_000_000, engine: 'QLT', asOf: '2026-10-20', horizon: 20 }] };
  const r = checkBackup(JSON.stringify(old)); assert.ok(r.ok); assert.equal(r.ok && r.state.paper.length, 1); assert.equal(r.ok && r.state.paper[0].lifecycleId, 'lc:abc');
});
test('malformed payloads are refused whole with a reason; nothing is merged half-way', () => {
  for (const [text, re] of [['{not json', /not readable/], ['[]', /does not hold a saved state/], ['{"v":1,"follows":[],"entries":[],"plans":[],"paper":[{"id":"x"}]}', /Paper trade 1 is damaged/], ['{"v":9,"follows":[],"entries":[],"plans":[]}', /version/]] as const) {
    const r = checkBackup(text); assert.ok(!r.ok, text); assert.match(r.ok ? '' : r.reason, re);
  }
  assert.equal(readSaved('{not json').unreadable, true, 'unreadable saved data is kept aside by loadState, never overwritten');
});
test('partial-ladder fields (a saved view missing its share count or booked figure) are not guessed: the position is "not measured", and nothing throws', () => {
  for (const ladder of [{ t1: 110 }, { qtyLeft: 50 }, { booked: 500 }, { qtyLeft: 'x', booked: null }]) {
    assert.equal(splitOfRow(rowOf(ladder), 0.25), null, JSON.stringify(ladder));
    const s = snapshotOf([rowOf(ladder), rowOf(null)], 0.25); assert.equal(s.coverage.state, 'partial'); assert.equal(s.coverage.measured, 1); assert.equal(s.exceptions.length, 1);
  }
  assert.equal(lifeStateOf({ status: 'closed', ladder: {} as never }), 'closed'); assert.equal(lifeStateOf({ status: 'weird' }), 'awaiting', 'an unknown status is never counted as closed or open');
  assert.doesNotThrow(() => buildLedgerView({ ...emptyLedger('2026-11-12T00:00:00Z') }, planAutoBook(emptyLedger('2026-11-12T00:00:00Z'))));
  assert.doesNotThrow(() => snapshotOf([{ ...rowOf(null), v: { ...rowOf(null).v, entry: NaN, mark: NaN } }], 0.25));
});
test('duplicate lifecycle ids in a backup are re-keyed on import; both positions survive and the round trip is stable', () => {
  const s = take(); const d = JSON.parse(exportJson(s)); d.paper.push({ ...d.paper[0], id: 'other', lifecycleId: d.paper[0].lifecycleId });
  const a = checkBackup(JSON.stringify(d)); assert.ok(a.ok); assert.equal(a.ok && a.state.paper.length, 2); assert.equal(a.ok && new Set(a.state.paper.map((p) => p.lifecycleId)).size, 2);
  const b = checkBackup(exportJson(a.ok ? a.state : s)); assert.ok(b.ok); assert.deepEqual(b.ok && b.state.paper.map((p) => p.lifecycleId), a.ok && a.state.paper.map((p) => p.lifecycleId));
});
test('storage denial and quota failure: the state stays in memory, the reason is reported, and an export still works', () => {
  const s = take(); const quota = { getItem: () => null, setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } };
  const denied = { getItem: () => { const e = new Error('denied'); e.name = 'SecurityError'; throw e; }, setItem: () => { throw new Error('no'); } };
  assert.deepEqual(saveState(quota, 'k', s), { ok: false, why: 'full' }); assert.deepEqual(saveState(null, 'k', s), { ok: false, why: 'blocked' });
  const l = loadState(denied, 'k'); assert.equal(l.blocked, true); assert.equal(l.state, DEFAULTS, 'a store that cannot be read never replaces the state with defaults it then saves');
  const r = checkBackup(exportJson(s)); assert.ok(r.ok && r.state.paper[0].lifecycleId === s.paper[0].lifecycleId, 'the export is the escape hatch and round-trips the lifecycle id');
});
