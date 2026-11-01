// Status comes from evidence, never from configuration: a service is "Working" or "Answering" only when a real probe, a last-success time, a data date or a device test says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERVICES, serviceStatus, type Evidence } from '../src/services.ts';

const NOW = Date.UTC(2026, 9, 27, 6, 0);
const none = (o: Partial<Evidence> = {}): Evidence => ({ nowMs: NOW, health: null, healthErr: false, news: null, screenAsOf: null, ledgerUpdated: null, storageOk: null, lockSupported: null, ...o });
const st = (id: string, e: Evidence) => serviceStatus(SERVICES.find((s) => s.id === id)!, e);

test('status: with no evidence every runtime service says "Not verified", never "Working"', () => {
  for (const s of SERVICES.filter((x) => x.kind === 'probe')) { const r = serviceStatus(s, none()); assert.equal(r.word, 'Not verified', s.id); assert.notEqual(r.tone, 'lime', s.id); }
  for (const s of SERVICES) assert.notEqual(serviceStatus(s, none()).word, 'Working');
});
test('status: prices are "Answering" only when the probe answered, and a failed probe says so with its reason; an unanswered status check is "Not verified"', () => {
  const h = (ok: boolean) => ({ checked_at: new Date(NOW).toISOString(), prices: { ok, last_print: ok ? new Date(NOW - 90e3).toISOString() : null, age_sec: ok ? 90 : null, error: ok ? null : 'HTTP 429' } });
  assert.equal(st('prices', none({ health: h(true) })).word, 'Answering'); assert.match(st('prices', none({ health: h(true) })).line, /last exchange print was 11:28 IST/);
  const bad = st('prices', none({ health: h(false) })); assert.equal(bad.word, 'Not answering'); assert.match(bad.line, /HTTP 429/);
  assert.equal(st('prices', none({ healthErr: true })).word, 'Not verified');
});
test('status: the screen and the ledger are read from their own dates; storage and the lock from a test on this device; unsupported is not "working"', () => {
  assert.equal(st('screen', none({ screenAsOf: '2026-10-26' })).word, 'Current'); assert.equal(st('screen', none({ screenAsOf: '2026-10-22' })).word, 'Behind'); assert.equal(st('screen', none()).word, 'Not verified');
  assert.equal(st('ledger', none({ ledgerUpdated: '2026-10-27T01:36:34Z' })).word, 'Written'); assert.match(st('ledger', none({ ledgerUpdated: '2026-10-27T01:36:34Z' })).line, /07:06 IST/); assert.equal(st('ledger', none({ ledgerUpdated: 'garbage' })).word, 'Not verified');
  assert.equal(st('backup', none({ storageOk: true })).word, 'Saving'); assert.equal(st('backup', none({ storageOk: false })).word, 'Not saving'); assert.equal(st('backup', none({ storageOk: false })).tone, 'peach');
  assert.equal(st('lock', none({ lockSupported: false })).word, 'Not supported here'); assert.equal(st('lock', none({ lockSupported: true })).word, 'Supported here');
});
test('status: services that are not set up or not built keep that word whatever the evidence says', () => {
  const rich = none({ health: { checked_at: new Date(NOW).toISOString(), prices: { ok: true, last_print: null, age_sec: null, error: null } }, storageOk: true, lockSupported: true, screenAsOf: '2026-10-26' });
  for (const s of SERVICES.filter((x) => x.kind !== 'probe')) assert.equal(serviceStatus(s, rich).word, s.kind === 'not built' ? 'Not built' : 'Not set up');
});
