import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decisionOf, RANK_NOTE, type DecisionInput } from '../src/decision.ts';
import { journeyOf } from '../src/journey.ts';
import { curateCase, eligibilityOf } from '../src/eligibility.ts';
import { engineEvidence } from '../src/evidence.ts';
import { DEFAULTS, type State } from '../src/store.ts';
import type { Pick } from '../src/quant.ts';

const gcsl = JSON.parse(readFileSync(new URL('./fixtures/gcsl.json', import.meta.url), 'utf8'));
const bt = { meta: { when: 'x', symbols: 660, dates: ['2015-10-23', '2026-10-23'] }, engines: { MOM: { horizon: 20, picked: 1, skipped: 0, label: 'x', periods: { train: { excess_vs_universe: 0.006, excess_t: 0.6 }, validation: { excess_vs_universe: 0.0006, excess_t: 0.07 }, holdout: { excess_vs_universe: -0.011, excess_t: -0.95 } } } } } as never;
const ev = { MOM: engineEvidence('MOM', bt), QLT: engineEvidence('QLT', bt) };
const pick: Pick = { engine: 'MOM', sym: 'GCSL', name: 'Gretex', asOf: '2026-10-23', ref: 726.2, stop: 675.37, stopPct: 7, horizon: 20, score: 91, rank: 1, why: ['Close above the 200-day average: 726.20 vs 447.00', 'Ahead of the Nifty over 3 months: +44.7 pts'] };
const base = (o: Partial<DecisionInput> = {}): DecisionInput => { const elig = eligibilityOf(gcsl.row, gcsl.years); return { row: gcsl.row, elig, curated: curateCase({ strengths: gcsl.swot.s, flags: gcsl.risk.flags, weaknesses: gcsl.swot.w }, elig), pick, eligibleCount: 753,
  engines: [{ id: 'MOM', name: 'Momentum', pass: true, score: 91, eligible: true }, { id: 'QLT', name: 'Quality at a fair price', pass: false, score: null, eligible: true }], evidence: ev, thesis: null, today: '2026-10-26', livePriceLabel: null, ...o }; };

test('decision: a pick says which engine surfaced it and labels its number as a rank, never a probability', () => {
  const d = decisionOf(base());
  assert.match(d.why.text, /Momentum picked it on the close of Fri 23 Oct/); assert.match(d.why.rank ?? '', /Rank 91 of 100 among 753 eligible names/); assert.ok((d.why.rank ?? '').endsWith(RANK_NOTE));
  assert.match(RANK_NOTE, /not a chance of winning/); assert.doesNotMatch(JSON.stringify(d), /probab(?!.*not)|likelihood|odds of|will (rise|win)/i);
});
test('decision: GCSL: the strongest counterargument is one that applies (not a withheld ratio), and the withheld figures are declared under data quality', () => {
  const d = decisionOf(base());
  assert.doesNotMatch(d.counter.text + d.counter.detail, /return on capital|ROCE|margin/i); assert.equal(d.counter.found, true);
  const q = Object.fromEntries(d.quality.map((x) => [x.k, x])); assert.match(q['Not judged'].v, /financial sector/); assert.equal(q['Size class'].warn, true); assert.match(q['Statements'].v, /6 judgement lines withheld/);
});
test('decision: evidence separates untested from not supported, and an experiment is called one', () => {
  const d = decisionOf(base()); assert.deepEqual(d.evidence.chips.map((c) => c.state), ['unsupported']); assert.equal(d.evidence.experimental, true); assert.match(d.evidence.text, /Momentum: not supported/);
  const none = decisionOf(base({ pick: null, engines: [{ id: 'MOM', name: 'Momentum', pass: false, score: null, eligible: true }, { id: 'QLT', name: 'Quality at a fair price', pass: false, score: null, eligible: true }] }));
  assert.deepEqual(none.evidence.chips.map((c) => c.state), ['unsupported', 'untested']); assert.match(none.why.text, /No engine surfaced it tonight/);
});
test('decision: invalidation comes from the pick, then the user\'s own thesis, else it says it is missing', () => {
  assert.match(decisionOf(base()).invalidation.text, /close below ₹675\.37 \(7% under the signal close\)/i);
  const th = { at: 'x', thesis: 't', support: '', counter: '', decision: '', invalidation: 'Close below 600 on volume', trigger: '', reviewOn: '2026-10-30' };
  const d = decisionOf(base({ pick: null, thesis: th })); assert.equal(d.invalidation.text, 'Close below 600 on volume'); assert.match(d.review.text, /Your review: Fri 30 Oct, in 4 days/);
  assert.equal(decisionOf(base({ pick: null })).invalidation.source, 'none');
  assert.equal(decisionOf(base({ pick: null, thesis: { ...th, reviewOn: '2026-10-20' } })).review.overdue, true);
  assert.match(decisionOf(base({ pick: null })).review.text, /No review date is set/);
});
test('journey: each step is done from saved state, so it is right after a restore from backup', () => {
  const s0: State = { ...DEFAULTS }; const j0 = journeyOf(s0, '2026-10-26'); assert.equal(j0.done, 0); assert.equal(j0.next?.id, 'follow');
  const s1 = { ...s0, follows: ['TCS'] }; assert.equal(journeyOf(s1, '2026-10-26').next?.id, 'thesis'); assert.equal(journeyOf(s1, '2026-10-26').sym, 'TCS');
  const e = { id: 'e', sym: 'TCS', created: 'x', archived: false, versions: [{ at: 'x', thesis: 't', support: '', counter: '', decision: '', invalidation: 'i', trigger: '', reviewOn: null }] };
  const s2 = { ...s1, entries: [e] }; assert.equal(journeyOf(s2, '2026-10-26').next?.id, 'plan');
  const s3 = { ...s2, plans: [{ id: 'p', sym: 'TCS', at: 'x', status: 'saved' as const, entry: 1, stop: 0.9, qty: 1, riskPct: 0.5, expiry: null, rev: 1, note: '' }] }; assert.equal(journeyOf(s3, '2026-10-26').next?.id, 'review');
  const s4 = { ...s3, entries: [{ ...e, versions: [{ ...e.versions[0], reviewOn: '2026-10-20' }] }] }; const j4 = journeyOf(s4, '2026-10-26'); assert.equal(j4.done, 4); assert.equal(j4.next, null); assert.equal(j4.due?.overdue, true);
  assert.equal(journeyOf({ ...s4, entries: [{ ...s4.entries[0], archived: true }] }, '2026-10-26').steps[1].done, false, 'an archived thesis does not count');
});
