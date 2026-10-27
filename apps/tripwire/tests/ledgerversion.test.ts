import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { emptyLedger, record, type Ledger } from '../src/ledger.ts';
import { runAll, type Q } from '../src/quant.ts';
import { rulesFor, rulesOfRecord } from '../src/rules.ts';

const mk = (i: number, o: Partial<Q> = {}): Q => ({ sym: 'S' + i, name: 'S' + i, sector: 'Sec' + (i % 8), tier: 'mid', liquid: true, price: 100 + i, turnover_cr: 50, atr_pct: 2, sma200: 80, rs3m: 5, r1y: 10 + i * 3, r1m: 2, from_high: -30 + i, r6m: i - 5, sd1y: 50 - i, piotroski: 8, roce_med: 20, de: 0.3, risk_lvl: 'LOW', ...o } as Q);
const screen = (): Q[] => [...Array.from({ length: 40 }, (_, i) => mk(i)), mk(100, { sym: 'NOCLASS', tier: undefined, r1y: 400, from_high: -1, r6m: 90 }), mk(101, { sym: 'PENNY', price: 30, r1y: 380, from_high: -1, r6m: 80 }), mk(102, { sym: 'THIN', turnover_cr: 3, r1y: 390, from_high: -1, r6m: 85 })];

test('the same screen gives different picks under the two versions, and each night is written under the version for its data day', () => {
  const a = runAll(screen(), '2026-10-26'), b = runAll(screen(), '2026-10-27');
  const momA = a.runs.find((r) => r.id === 'MOM')!, momB = b.runs.find((r) => r.id === 'MOM')!;
  assert.equal(momA.rules, 'elig-1'); assert.equal(momB.rules, 'elig-2');
  const symsA = momA.picks.map((p) => p.sym), symsB = momB.picks.map((p) => p.sym);
  assert.ok(['NOCLASS', 'PENNY', 'THIN'].some((s) => symsA.includes(s)), 'elig-1 admits the no-class, sub-₹50 and thin names, and their strong momentum puts them at the top');
  assert.ok(!['NOCLASS', 'PENNY', 'THIN'].some((s) => symsB.includes(s)), 'elig-2 admits none of them');
  assert.equal(momA.funnel.eligible - momB.funnel.eligible, 3);
});
test('the ledger is append-only across the version change: earlier nights and picks are byte-for-byte what they were, the new night carries its version', () => {
  let l: Ledger = emptyLedger('2026-10-25T00:00:00Z'); const r1 = runAll(screen(), '2026-10-26'); l = record(l, r1.runs, '2026-10-26', '2026-10-27T01:00:00Z').ledger;
  const before = JSON.stringify(l); assert.equal(l.days[0].rules, 'elig-1');
  const legacy: Ledger = JSON.parse(before); delete legacy.days[0].rules;                                   // a night written before versions existed
  const r2 = runAll(screen(), '2026-10-27'); const out = record(legacy, r2.runs, '2026-10-27', '2026-10-28T01:00:00Z');
  assert.equal(JSON.stringify({ ...out.ledger, days: out.ledger.days.slice(0, 1), picks: out.ledger.picks.slice(0, legacy.picks.length), updated: legacy.updated }), JSON.stringify(legacy), 'the earlier night and its picks were not touched');
  assert.equal(out.ledger.days[1].rules, 'elig-2'); assert.equal(rulesOfRecord(out.ledger.days[0].rules), 'elig-1', 'a night with no version reads as elig-1');
  assert.equal(record(out.ledger, r2.runs, '2026-10-27', 'x').skipped, 'already recorded', 'a night is still recorded once');
});
test('the committed ledger: every night so far predates elig-2, so every one reads as elig-1 and nothing in it needs re-running', { skip: !existsSync(new URL('../ledger/ledger.json', import.meta.url)) }, () => {
  const l = JSON.parse(readFileSync(new URL('../ledger/ledger.json', import.meta.url), 'utf8')) as Ledger;
  for (const d of l.days) if (d.asOf < '2026-10-27') { assert.equal(rulesOfRecord(d.rules), 'elig-1', `${d.asOf} stays under the rule it was written under`); assert.equal(rulesFor(d.asOf), 'elig-1'); }
  assert.ok(l.days.length >= 2);
});
