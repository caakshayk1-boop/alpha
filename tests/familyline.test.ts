// src/lib/family.ts: one line per product, judged by the hub's own status contract (lib/status.ts). Never a state it has not read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAMILY, familyLine } from '../src/lib/family.ts';

const SAT = new Date('2026-11-28T06:00:00Z');      // Saturday: the expected session is Friday 27 Nov
const d = (label: string, asOf: string | null, cadence: 'daily' | 'weekly' = 'daily') => ({ label, asOf, cadence });

test('four products, Alpha first, every outside link on its own askakshay.com host', () => {
  assert.deepEqual(FAMILY.map((m) => m.id), ['alpha', 'rulebook', 'tripwire', 'apexpro']);
  for (const m of FAMILY.slice(1)) assert.equal(m.href, `https://${m.host}/`);
  for (const m of FAMILY) assert.doesNotMatch(m.what, /return|profit|beat|guarantee|outperform|%/i, `${m.name} copy makes no return claim`);
});

test('current when every dataset describes the expected session', () => {
  const l = familyLine({ id: 'tripwire', reached: true, datasets: [d('Daily screen', '2026-11-27'), d('Rule triggers', '2026-11-27')] }, SAT);
  assert.equal(l.state, 'current'); assert.match(l.text, /^Current to 27 Nov$/);
});

test('the least current dataset sets the state, and is named', () => {
  const l = familyLine({ id: 'rulebook', reached: true, datasets: [d('Daily feed', '2026-11-27'), d('Paper ledger', '2026-11-26')] }, SAT);
  assert.equal(l.state, 'delayed'); assert.equal(l.text, 'Paper ledger: 1 session behind');
  assert.equal(l.detail, 'Daily feed: 27 Nov · Paper ledger: 26 Nov');
  const stale = familyLine({ id: 'rulebook', reached: true, datasets: [d('Daily feed', '2026-11-20')] }, SAT);
  assert.equal(stale.state, 'stale'); assert.equal(stale.text, 'Daily feed: stale, 4 sessions behind', '24 Nov was an NSE holiday');
});

test('not reached, no published date, a missing date and not yet read are each said as such', () => {
  assert.equal(familyLine({ id: 'apexpro', reached: false, datasets: [] }, SAT).state, 'not-reached');
  assert.equal(familyLine({ id: 'apexpro', reached: true, datasets: [] }, SAT).text, 'Data date not published');
  const missing = familyLine({ id: 'alpha', reached: true, datasets: [d('Daily screen', null)] }, SAT);
  assert.equal(missing.state, 'unavailable'); assert.match(missing.detail, /no date/);
  assert.equal(familyLine(undefined, SAT).state, 'checking');
});
