import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SERVICES, KIND_WORD, serviceStatus, type Evidence } from '../src/services.ts';
import { healthShape } from '../worker.js';

test('services: every kind is one of three, every one that is not built or not set up says what it needs or why it is by design, every probe names its evidence, and nothing says soon', () => {
  for (const s of SERVICES) { assert.ok(['probe', 'not set up', 'not built'].includes(s.kind)); assert.ok(s.what.length > 20); assert.ok(s.evidence.length > 8); assert.ok(s.kind === 'probe' || s.needs !== null || s.id === 'broker', `${s.id} is unavailable and says neither what it needs nor why not`); assert.ok(!/\bsoon\b/i.test(s.what + (s.needs ?? ''))); }
  assert.equal(new Set(SERVICES.map((s) => s.id)).size, SERVICES.length);
});
test('services: the integrations document names every service and its state, so the page and the document cannot disagree', () => {
  const doc = readFileSync(new URL('../../../docs/tripwire/INTEGRATIONS.md', import.meta.url), 'utf8');
  for (const s of SERVICES) assert.ok(doc.includes(`| ${s.label} | ${KIND_WORD[s.kind]} |`), `${s.label} (${s.kind}) is missing or different in INTEGRATIONS.md`);
});
test('health: the answer carries binding NAMES only, never a value, counts no secrets, and ages the last print from now', () => {
  const now = Date.UTC(2026, 9, 27, 6, 0); const printSec = now / 1000 - 90;
  const h = healthShape({ prices: { ok: true, ms: 220, printSec }, news: { ok: true, ms: 310 } }, ['ASSETS'], now);
  assert.deepEqual(h.bindings, ['ASSETS']); assert.equal(h.secrets_configured, 0); assert.equal(h.prices.age_sec, 90); assert.equal(h.ok, true); assert.ok(!JSON.stringify(h).includes('Mozilla'));
  const bad = healthShape({ prices: { ok: false, error: 'HTTP 429' }, news: { ok: true, ms: 5 } }, [], now); assert.equal(bad.ok, false); assert.equal(bad.prices.error, 'HTTP 429'); assert.equal(bad.prices.age_sec, null);
  assert.equal(healthShape({}, [], now).prices.error, 'no answer', 'an unprobed service is not reported as healthy');
});
