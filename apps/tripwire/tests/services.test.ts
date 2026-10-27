import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SERVICES } from '../src/services.ts';
import { healthShape } from '../worker.js';

test('services: every state is one of three, every unavailable one says what it needs or why it is by design, and nothing says "soon"', () => {
  for (const s of SERVICES) { assert.ok(['working', 'not set up', 'not built'].includes(s.state)); assert.ok(s.what.length > 20); assert.ok(s.state === 'working' || s.needs !== null || s.id === 'broker', `${s.id} is unavailable and says neither what it needs nor that it is by design`); assert.ok(!/coming soon|soon|beta feature|roadmap/i.test(s.what + (s.needs ?? ''))); }
  assert.equal(new Set(SERVICES.map((s) => s.id)).size, SERVICES.length);
});
test('services: the integrations document names every service and its state, so the page and the document cannot disagree', () => {
  const doc = readFileSync(new URL('../../../docs/tripwire/INTEGRATIONS.md', import.meta.url), 'utf8');
  for (const s of SERVICES) assert.ok(doc.includes(`| ${s.label} | ${s.state === 'working' ? 'Working' : s.state === 'not set up' ? 'Not set up' : 'Not built'} |`), `${s.label} (${s.state}) is missing or different in INTEGRATIONS.md`);
});
test('health: the answer carries binding NAMES only, never a value, counts no secrets, and ages the last print from now', () => {
  const now = Date.UTC(2026, 9, 27, 6, 0); const printSec = now / 1000 - 90;
  const h = healthShape({ prices: { ok: true, ms: 220, printSec }, news: { ok: true, ms: 310 } }, ['ASSETS'], now);
  assert.deepEqual(h.bindings, ['ASSETS']); assert.equal(h.secrets_configured, 0); assert.equal(h.prices.age_sec, 90); assert.equal(h.ok, true); assert.ok(!JSON.stringify(h).includes('Mozilla'));
  const bad = healthShape({ prices: { ok: false, error: 'HTTP 429' }, news: { ok: true, ms: 5 } }, [], now); assert.equal(bad.ok, false); assert.equal(bad.prices.error, 'HTTP 429'); assert.equal(bad.prices.age_sec, null);
  assert.equal(healthShape({}, [], now).prices.error, 'no answer', 'an unprobed service is not reported as healthy');
});
