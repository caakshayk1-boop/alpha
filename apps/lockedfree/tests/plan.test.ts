import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyOn, onTrack, sipSplit, nextRebalance, panic, drift, tradingBucketOk, type Plan } from '../src/lib/plan.ts';
const P: Plan = { createdOn: '2026-11-16', goal: 'House', horizonYears: 10, monthly: 10000, maxFallPct: 25, stopReason: 'I need the money', escalationPct: 10, escalationOptedOutOn: null, tradingCapPct: 10, screenId: 'magic-formula',
  buckets: [{ id: 'e', name: 'Emergency', target: 300000, byDate: '2027-11-16', saved: 150000 }, { id: 't', name: 'Learning to trade', target: 50000, byDate: '2030-01-01', saved: 5000, trading: true }] };
test('auto-escalation steps up every 12 months; an active opt-out freezes it from its date', () => {
  assert.equal(monthlyOn(P, '2027-11-15'), 10000); assert.equal(monthlyOn(P, '2027-11-16'), 11000); assert.equal(monthlyOn(P, '2028-11-16'), 12100);
  assert.equal(monthlyOn({ ...P, escalationOptedOutOn: '2027-06-01' }, '2029-11-16'), 10000);
});
test('bucket status in plain words; past date states the gap', () => {
  assert.equal(onTrack(P.buckets[0], '2027-05-16', '2026-11-16').status, 'on-track'); assert.equal(onTrack(P.buckets[1], '2027-05-16', '2026-11-16').status, 'behind');
  assert.match(onTrack(P.buckets[1], '2031-01-01', '2026-11-16').words, /still to go/);
});
test('SIP splits equally; an empty list deploys nothing (cash stays cash)', () => { assert.deepEqual(sipSplit(10000, ['A', 'B', 'C']).map((x) => x.amount), [3333.33, 3333.33, 3333.33]); assert.deepEqual(sipSplit(10000, []), []); });
test('next rebalance is the first session of the next quarter', () => { assert.equal(nextRebalance('2026-11-18'), '2027-01-01'); assert.equal(nextRebalance('2026-12-05'), '2027-01-01'); assert.equal(nextRebalance('2027-01-01'), '2027-04-01'); });
test('panic card: shows only on a real fall at or past the threshold; missing data shows nothing', () => {
  assert.equal(panic(100, 96, 3).show, true); assert.equal(panic(100, 98, 3).show, false); assert.equal(panic(null, 96, 3).show, false); assert.equal(panic(100, null, 3).fallPct, null);
});
test('drift and trading-bucket cap', () => { assert.equal(drift({ A: 0.5, B: 0.5 }, { A: 60, B: 40 })[0].drift, 0.1); assert.equal(tradingBucketOk(P).ok, true); assert.equal(tradingBucketOk({ ...P, tradingCapPct: 1 }).ok, false); });
