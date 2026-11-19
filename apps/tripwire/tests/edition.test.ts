import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gapOf, failingChecks, gateRun, edition, editionDays } from '../src/edition.ts';
import { emptyLedger, type LedgerPick } from '../src/ledger.ts';

const pick = (asOf: string, engine: string, sym: string): LedgerPick => ({ id: `${asOf}|${engine}|${sym}`, engine, sym, asOf, ref: 100, stop: 90, horizon: 10, score: 1, rank: 1 });

test('gap is computed only where the published text carries a threshold and a reading (16 Nov: breadth 47% against 50%)', () => {
  assert.deepEqual(gapOf('At least 50% of stocks above their own 50-day average', '47% above'), { gap: '3 points short of 50%', rel: 0.06 });
  assert.equal(gapOf('India VIX at or below 20', 'VIX 22.5')?.gap, '2.5 above the 20 limit');
  assert.equal(gapOf('India VIX at or below 20', 'VIX 15.7'), null, 'a passing reading has no gap');
  assert.equal(gapOf('Nifty above its 200-day average, and that average rising over 20 sessions', 'Nifty 25,291 · 200-day 23,992'), null, 'no threshold in the text: no gap invented');
});

test('failing checks are ranked nearest first; unrankable ones follow and carry no gap', () => {
  const g = { on: false, passed: 2, checks: [
    { rule: 'Nifty above its 200-day average, and that average rising over 20 sessions', ok: false, value: 'Nifty 25,291 · 200-day 23,992' },
    { rule: 'Nifty above its 50-day average', ok: true, value: 'Nifty 25,291 · 50-day 23,356' },
    { rule: 'At least 50% of stocks above their own 50-day average', ok: false, value: '47% above' },
    { rule: 'India VIX at or below 20', ok: false, value: 'VIX 30' },
  ] };
  const f = failingChecks(g);
  assert.equal(f.length, 3);
  assert.equal(f[0].gap, '3 points short of 50%');
  assert.equal(f[1].gap, '10 above the 20 limit');
  assert.equal(f[2].gap, null);
  assert.equal(failingChecks({ on: true, passed: 4, checks: g.checks.map((c) => ({ ...c, ok: true })) }).length, 0);
});

test('gate run counts published days only and the current off streak ends at the latest day', () => {
  assert.equal(gateRun(undefined), null);
  assert.equal(gateRun([]), null);
  const r = gateRun([{ d: '2026-11-13', on: false }, { d: '2026-11-10', on: true }, { d: '2026-11-12', on: false }, { d: '2026-11-16', on: false }]);
  assert.deepEqual(r, { off: 3, on: 1, total: 4, offStreak: 3 });
});

test('an edition is one ledger night: its picks, its refusals, its voids, and its neighbours', () => {
  const l = emptyLedger('2026-11-17T00:00:00Z');
  l.days = [
    { asOf: '2026-11-13', recorded: 'a', rules: 'elig-2', engines: { MOM: { eligible: 430, passed: 27, picked: 5, skippedWideStop: 1 } } },
    { asOf: '2026-11-16', recorded: 'b', rules: 'elig-2', engines: { MOM: { eligible: 438, passed: 30, picked: 5, skippedWideStop: 1 }, ST: { eligible: 438, passed: 5, picked: 3, skippedWideStop: 0 } } },
  ];
  l.picks = [pick('2026-11-13', 'MOM', 'AAA'), pick('2026-11-16', 'MOM', 'AAA'), pick('2026-11-16', 'MOM', 'BBB'), pick('2026-11-16', 'ST', 'CCC')];
  l.voided = { '2026-11-16|MOM|BBB': 'x', '2026-10-23|LVT|SBC': 'old' };
  assert.deepEqual(editionDays(l), ['2026-11-16', '2026-11-13']);
  const e = edition(l, undefined, [{ d: '2026-11-16', on: false }])!;
  assert.equal(e.asOf, '2026-11-16'); assert.equal(e.prev, '2026-11-13'); assert.equal(e.next, null); assert.equal(e.position, 2); assert.equal(e.of, 2);
  assert.equal(e.picks.length, 3); assert.equal(e.gate, false);
  assert.deepEqual(e.voided, [{ id: '2026-11-16|MOM|BBB', reason: 'x' }]);
  assert.deepEqual(e.newNames.map((p) => p.sym).sort(), ['BBB', 'CCC'], 'AAA was already picked by MOM the night before');
  assert.equal(e.engines.find((x) => x.engine === 'MOM')!.passedNotPicked, 25);
  assert.equal(edition(l, '2026-11-13')!.gate, null, 'a night with no published gate day says null, not off');
  assert.equal(edition(l, '2026-01-01'), null);
  assert.equal(edition(emptyLedger('x')), null);
});
