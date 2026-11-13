// 12 Nov 2026 (Tripwire 2.0, 1.4): the deploy job asserts the nightly ledger's own freshness, loudly, from the one session calendar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyLedger, pickId, type Ledger } from '../src/ledger.ts';
// @ts-ignore (plain JS build tool)
import { checkLedgerFile } from '../tools/check-data.mjs';

const ist = (iso: string, h: number, m = 0) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), h, m) - 330 * 60000;
const NOW = ist('2026-11-12', 8, 0);   // Thu 12 Nov, 08:00 IST: the last completed session is Wed 11 Nov (10 Nov is the Diwali holiday)
const write = (l: Ledger) => { const p = join(mkdtempSync(join(tmpdir(), 'led-')), 'ledger.json'); writeFileSync(p, JSON.stringify(l)); return p; };
const base = (markDay: string, openMarkDay = markDay): Ledger => { const a = pickId('2026-11-11', 'QLT', 'AAA'), b = pickId('2026-11-09', 'QLT', 'BBB');
  return { ...emptyLedger('2026-11-12T00:00:00Z'), days: [{ asOf: '2026-11-09', recorded: 'x', engines: {} }, { asOf: '2026-11-11', recorded: 'x', engines: {} }],
    picks: [{ id: a, engine: 'QLT', sym: 'AAA', asOf: '2026-11-11', ref: 100, stop: 90, horizon: 20, score: 80, rank: 1 }, { id: b, engine: 'QLT', sym: 'BBB', asOf: '2026-11-09', ref: 100, stop: 90, horizon: 20, score: 80, rank: 1 }],
    outcomes: { [a]: { status: 'pending', final: false, markDay }, [b]: { status: 'open', final: false, entry: 100, entryDay: '2026-11-11', mark: 101, markDay: openMarkDay, r: 0.1, pct: 1, sessions: 1 } } }; };

test('a current ledger passes', () => { assert.deepEqual(checkLedgerFile(write(base('2026-11-11')), NOW, {}).errors, []); });
test('outcome-stage max mark date behind the pick stage fails, with a line that names both dates', () => {
  const e = checkLedgerFile(write(base('2026-11-09')), NOW, {}).errors; assert.ok(e.some((m: string) => /CHECK A FAILED/.test(m) && /2026-11-11/.test(m) && /2026-11-09/.test(m)), e.join('\n'));
});
test('an open position marked older than the last completed session fails, naming the position and how far behind', () => {
  const e = checkLedgerFile(write(base('2026-11-11', '2026-11-09')), NOW, {}).errors; assert.ok(e.some((m: string) => /CHECK B FAILED/.test(m) && /BBB/.test(m) && /behind/.test(m)), e.join('\n'));
});
test('a holiday is not lateness: on the evening of Tue 10 Nov (Diwali, NSE shut) a ledger marked through Mon 9 Nov is current', () => {
  const id = pickId('2026-11-09', 'QLT', 'AAA'); const l: Ledger = { ...emptyLedger('2026-11-09T00:00:00Z'), days: [{ asOf: '2026-11-09', recorded: 'x', engines: {} }],
    picks: [{ id, engine: 'QLT', sym: 'AAA', asOf: '2026-11-09', ref: 100, stop: 90, horizon: 20, score: 80, rank: 1 }], outcomes: { [id]: { status: 'open', final: false, entry: 100, entryDay: '2026-11-10', mark: 101, markDay: '2026-11-09', r: 0.1, pct: 1, sessions: 1 } } };
  assert.deepEqual(checkLedgerFile(write(l), ist('2026-11-10', 20), {}).errors, []);
  assert.ok(checkLedgerFile(write(l), ist('2026-11-12', 8), {}).errors.length > 0, 'two mornings later the same ledger IS late');
});
test('a laptop built from an old snapshot may skip it (TRIPWIRE_ALLOW_STALE=1); CI never sets that', () => {
  assert.deepEqual(checkLedgerFile(write(base('2026-11-05')), NOW, { TRIPWIRE_ALLOW_STALE: '1' }).errors, []);
});
test('a missing ledger file is reported as skipped, not as a pass', () => {
  const r = checkLedgerFile(join(tmpdir(), 'no-such-ledger.json'), NOW, {}); assert.equal(r.errors.length, 0); assert.match(r.warnings[0], /skipped/);
});

test('skip_ledger_check skips only the ledger rules and says so; absent or other values keep them on', () => {
  const stale = write(base('2026-11-05'));
  assert.ok(checkLedgerFile(stale, NOW, {}).errors.length > 0, 'off by default');
  assert.ok(checkLedgerFile(stale, NOW, { TRIPWIRE_SKIP_LEDGER_CHECK: '0' }).errors.length > 0);
  const r = checkLedgerFile(stale, NOW, { TRIPWIRE_SKIP_LEDGER_CHECK: '1' });
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join(' '), /SKIPPED/);
});

test('13 Nov 2026: the deploy workflow keeps the ledger rules out of the blocking step and runs them report-only', async () => {
  const { readFileSync } = await import('node:fs'); const y = readFileSync(new URL('../../../.github/workflows/tripwire.yml', import.meta.url), 'utf8');
  assert.match(y, /verify-data -- --no-ledger/, 'the step that can stop the deploy must not read the ledger');
  const i = y.indexOf('Ledger freshness (reported'); assert.ok(i > 0, 'a separate ledger step exists');
  const block = y.slice(i, y.indexOf('- name:', i + 10)); assert.match(block, /continue-on-error: true/); assert.match(block, /--ledger-only/);
});
