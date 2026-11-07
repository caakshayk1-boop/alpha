import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionTime } from '../src/positiontime.ts';
import type { View } from '../src/tracker.ts';
const base: View = { id: 'x', status: 'open', sessions: 4, left: 16, mark: 110, markKind: 'close', pnl: 10, r: 1, pct: 10, entryT: Date.parse('2026-11-02T03:45:00Z') / 1000 };
test('open holding shows observed sessions, not calendar days since entry', () => {
  const t = positionTime('2026-10-30', base);
  assert.equal(t.entry, '2026-11-02'); assert.equal(t.sessions, 4); assert.equal(t.exit, null); assert.equal(t.final, false);
});
test('closed holdings keep their final count and both recorded dates', () => {
  const t = positionTime('2026-10-30', { ...base, status: 'closed', sessions: 2, exitT: Date.parse('2026-11-03T10:00:00Z') / 1000 });
  assert.equal(t.entry, '2026-11-02'); assert.equal(t.exit, '2026-11-03'); assert.equal(t.sessions, 2); assert.equal(t.final, true);
});
test('retained states expose the stale-state explanation without advancing sessions', () => {
  const t = positionTime('2026-10-30', { ...base, dataNote: 'Last recorded state · 2026-11-05. Waiting for complete daily prices.' });
  assert.equal(t.sessions, 4); assert.equal(t.retained, true); assert.match(t.note, /2026-11-05/);
});
test('pending and skipped signals have no fabricated entry, exit or sessions', () => {
  for (const status of ['pending', 'waiting', 'skipped'] as const) {
    const t = positionTime('2026-10-30', { ...base, status });
    assert.equal(t.entry, null); assert.equal(t.exit, null); assert.equal(t.sessions, null);
  }
});
test('dates use IST at UTC day boundaries; missing timestamps remain unknown', () => {
  assert.equal(positionTime('2026-10-30', { ...base, entryT: Date.parse('2026-11-01T20:00:00Z') / 1000 }).entry, '2026-11-02');
  assert.equal(positionTime('2026-10-30', { ...base, entryT: undefined }).entry, null);
  assert.equal(positionTime('2026-10-30', { ...base, sessions: NaN }).sessions, null);
});
