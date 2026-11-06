import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companyRead, materialDifferences, researchEvidence } from '../src/research.ts';
import { paperSnapshot, parsePaperCsv, importPaperPlans } from '../src/papersnapshot.ts';
import { explainScreen } from '../src/screenfeedback.ts';
import { DEFAULTS, addEntry, editEntry, exportJson, parseState, journalCsv, preserveReviewDefaults, weeklyReview, type Plan } from '../src/store.ts';
import { filterRows, NO_FILTER, type Row, type Filters } from '../src/screen.ts';
import type { Company } from '../src/data.ts';
const row: Row = { sym: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', price: 110, r1d: 10, pe: 20, pe_pctile: 20, rev_cagr: 8, roce_med: 20, de: .2, last_date: '2026-11-04', fy: '2026-03-31' };
const company = (r: Partial<Row> = {}): Company => ({ sym: r.sym ?? 'TCS', row: { ...row, ...r, risk_top: r.risk_top ?? undefined }, years: [], built_on: '2026-11-05', swot: null, risk: null });
const plan = (extra: Partial<Plan> = {}): Plan => ({ id: 'p1', sym: 'TCS', at: '2026-11-01T06:00:00Z', filledAt: '2026-11-02T06:00:00Z', status: 'paper-filled', qty: 10, entry: 100, stop: 90, riskPct: 1, rev: 1, expiry: null, note: '', ...extra });
test('unchanged legacy review placeholders add no revision or weekly review; meaningful edits still append', () => {
  const old = { thesis: 'Original', support: '', counter: '', decision: 'watch', invalidation: '', trigger: '', reviewOn: null };
  const a = addEntry(DEFAULTS, 'TCS', old, new Date('2026-10-01T00:00:00Z')); const original = a.s.entries[0].versions[0];
  const draft = { ...old, question: '', decisionReason: '', reviewState: 'new' as const, evidenceChange: 'unassessed' as const };
  const same = editEntry(a.s, a.id, preserveReviewDefaults(draft, original), new Date('2026-11-06T00:00:00Z'));
  assert.deepEqual(same.entries, a.s.entries); assert.deepEqual(weeklyReview(same, '2026-11-06'), weeklyReview(a.s, '2026-11-06'));
  for (const change of [{ question: 'What changed?' }, { reviewState: 'reviewed' as const }, { evidenceChange: 'weakened' as const }, { decisionReason: 'Wait for results' }]) {
    const next = editEntry(a.s, a.id, preserveReviewDefaults({ ...draft, ...change }, original));
    assert.equal(next.entries[0].versions.length, 2); assert.deepEqual(next.entries[0].versions[0], original);
  }
});
test('company reads carry facts, dates, rule and limits; missing and ineligible evidence is never a rating', () => {
  const facts = companyRead(company()); assert.equal(facts.length, 3);
  assert.match(facts.find((x) => x.id === 'pe')!.read, /Low/);
  assert.match(researchEvidence(company(), facts[0]), /2026-03-31[\s\S]*2026-11-04[\s\S]*Source:[\s\S]*Limits:/);
  assert.ok(!companyRead(company({ sector: 'Financial Services' })).some((x) => x.id === 'roce'));
  assert.ok(!companyRead(company({ pe: -2 })).some((x) => x.id === 'pe'));
  assert.ok(!companyRead(company({ roce_med: NaN })).some((x) => x.id === 'roce'));
  const c = company(); c.inst = { quality: 'ok', fii_pp: .25, dii_pp: 0, period: '2026-09-30', prev_period: '2026-06-30' };
  assert.match(companyRead(c).at(-1)!.read, /stakes changed/); delete c.inst.prev_period;
  assert.ok(!companyRead(c).some((x) => x.id === 'ownership'));
});
test('comparison highlights material measured spreads, excludes incomparable ratios and keeps period caveats', () => {
  assert.deepEqual(materialDifferences([company(), company({ sym: 'B', roce_med: 24.9, rev_cagr: 12.9, de: .69, pe: 24.9 })]), []);
  const ds = materialDifferences([company(), company({ sym: 'B', roce_med: 25, rev_cagr: 13, de: .7, pe: 25, fy: '2025-12-31' })]);
  assert.equal(ds.length, 3); assert.match(ds[0].why, /not automatically best/); assert.match(ds[0].sources[0].date, /2025-12-31/);
  assert.equal(ds[2].label, 'Leverage', 'the exact 0.5× threshold survives decimal floating-point rounding');
  assert.ok(!materialDifferences([company(), company({ sym: 'B', sector: 'Financial Services', roce_med: 90, de: 9 })]).some((x) => /capital|Leverage/.test(x.label)));
});
test('screen explanations exactly match actual inclusion for independent and combined conditions', () => {
  const rows = [row, { ...row, pe: null }, { ...row, sector: 'Financial Services' }, { ...row, pe: 50, roce_med: 5 }];
  const fs: Filters[] = [NO_FILTER, { ...NO_FILTER, value: 'cheap' }, { ...NO_FILTER, quality: 'high' }, { ...NO_FILTER, q: 'bank' }, { ...NO_FILTER, cond: [{ m: 'pe', op: 'lte', v: 25, unk: true }] }, { ...NO_FILTER, cond: [{ m: 'roce_med', op: 'gte', v: 20, unk: true }] }, { ...NO_FILTER, quality: 'high', momentum: 'strong', cond: [{ m: 'pe', op: 'lte', v: 25 }] }];
  for (const r of rows) for (const f of fs) { const e = explainScreen(r, f); assert.equal(e.matched, !!filterRows([r], f).rows.length); assert.equal(e.matched, e.checks.every((x) => x.outcome !== 'excluded')); }
  assert.equal(explainScreen(rows[1], fs[4]).checks[0].outcome, 'ignored');
  assert.equal(explainScreen(rows[2], fs[5]).checks[0].outcome, 'excluded');
});
test('CSV refuses malformed, missing, duplicate and unknown rows before importing; quoted fields work', () => {
  const known = new Set(['TCS', 'INFY']); const head = 'symbol,quantity,entry,stop\n';
  assert.equal(parsePaperCsv(head + '"TCS",10,100,90', known).plans.length, 1);
  for (const body of ['TCS,1.5,100,90', 'TCS,0,100,90', 'TCS,1,90,100', 'TCS,1,Infinity,90', 'TCS,1,100,', 'BAD,1,100,90', 'TCS,1,100,90\nTCS,2,100,90', '"TCS,1,100,90', '"TCS"x,1,100,90']) { const p = parsePaperCsv(head + body, known); assert.ok(p.error, body); assert.deepEqual(p.plans, []); }
});
test('CSV appends saved plans, is idempotent and never edits existing fills or engine positions', () => {
  const state = { ...DEFAULTS, plans: [plan()] }; const input = [{ sym: 'INFY', qty: 3, entry: 200, stop: 180 }];
  const one = importPaperPlans(state, input); assert.equal(one.added, 1); assert.equal(one.state.plans.find((p) => p.sym === 'INFY')!.status, 'saved');
  assert.deepEqual(one.state.plans.find((p) => p.id === 'p1'), state.plans[0]); assert.strictEqual(one.state.paper, state.paper);
  assert.equal(importPaperPlans(one.state, input).added, 0); assert.equal(state.plans.length, 1);
  assert.deepEqual(parseState(exportJson(one.state))!.plans, one.state.plans);
});
test('paper snapshot combines lots, uses explicit fills and attributes price arithmetic only', () => {
  const snap = paperSnapshot([plan(), plan({ id: 'p2', qty: 5 }), plan({ id: 'saved', status: 'saved' }), plan({ id: 'closed', status: 'closed' })], [row]);
  assert.equal(snap.value, 1650); assert.equal(snap.invested, 1500); assert.equal(snap.gain, 150); assert.ok(Math.abs(snap.day! - 150) < 1e-8);
  assert.deepEqual(snap.allocation, [{ sym: 'TCS', amount: 1650, pct: 100 }]); assert.equal(snap.positions.length, 2);
});
test('missing/stale/mismatched prices and fills after the mark suppress totals, never flatten saved positions', () => {
  for (const r of [{ ...row, price: null }, { ...row, stale: true }, { ...row, last_date: null }]) assert.equal(paperSnapshot([plan()], [r]).value, null);
  for (const filledAt of [undefined, 'not-a-date', '2026-11-05T06:00:00Z']) assert.equal(paperSnapshot([plan({ filledAt })], [row]).value, null);
  const plans = [plan(), plan({ id: 'b', sym: 'INFY' })]; const copy = structuredClone(plans);
  assert.equal(paperSnapshot(plans, [row, { ...row, sym: 'INFY', last_date: '2026-11-03' }]).value, null); assert.deepEqual(plans, copy);
  assert.equal(paperSnapshot([plan({ filledAt: '2026-11-04T06:00:00Z' })], [row]).day, null);
  assert.equal(paperSnapshot([], [row]).value, null);
});
test('research evidence, decisions and review states survive append-only history, backup and CSV', () => {
  const old = { thesis: 'Recurring revenue', support: 'Original evidence', counter: 'Demand slowdown', decision: 'watch', invalidation: 'Margins fall', trigger: 'Results', reviewOn: null };
  const a = addEntry(DEFAULTS, 'TCS', old, new Date('2026-11-01T00:00:00Z'));
  const s = editEntry(a.s, a.id, { ...old, question: 'What supports margins?', decision: 'Skipped', decisionReason: 'Need the filing', support: 'ROCE 20% · FY 2026 · source URL', reviewState: 'waiting', evidenceChange: 'mixed', reviewOn: '2026-12-01' }, new Date('2026-11-05T00:00:00Z'));
  const back = parseState(exportJson(s))!; assert.deepEqual(back.entries, s.entries); assert.deepEqual(back.entries[0].versions[0], a.s.entries[0].versions[0]); assert.equal(back.entries[0].versions.length, 2);
  const csv = journalCsv(s); assert.match(csv, /question,review_state,evidence_change,decision_reason/); assert.match(csv, /What supports margins/); assert.match(csv, /Need the filing/);
});
