import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_ENABLED, CAPTURE_ENDPOINT, DEFAULT_CAPTURE, captureReady, subscribe, validEmail } from '../src/capture.ts';

test('shipped default: OFF with no endpoint', () => { assert.equal(CAPTURE_ENABLED, false); assert.equal(CAPTURE_ENDPOINT, ''); assert.equal(captureReady(DEFAULT_CAPTURE), false); });
test('both the flag and a well-formed https endpoint are needed', () => {
  assert.equal(captureReady({ enabled: true, endpoint: '' }), false);
  assert.equal(captureReady({ enabled: false, endpoint: 'https://x.example/s' }), false);
  assert.equal(captureReady({ enabled: true, endpoint: 'http://x.example/s' }), false);
  assert.equal(captureReady({ enabled: true, endpoint: 'not a url' }), false);
  assert.equal(captureReady({ enabled: true, endpoint: 'https://x.example/s' }), true);
});
test('email check', () => { for (const g of ['a@b.co', ' a.b@c.in ']) assert.ok(validEmail(g)); for (const b of ['', 'a', 'a@b', 'a b@c.in', 'a@b.c']) assert.ok(!validEmail(b)); });
test('off: no network call is made', async () => {
  let calls = 0; const f = (async () => { calls++; return new Response('{}'); }) as typeof fetch;
  assert.deepEqual(await subscribe('a@b.co', 't', DEFAULT_CAPTURE, f), { ok: false, why: 'off' }); assert.equal(calls, 0);
});
test('on: one POST, only for a valid address; failure is reported, not hidden', async () => {
  const cfg = { enabled: true, endpoint: 'https://x.example/s' }; const seen: { u: string; b: string }[] = [];
  const ok = (async (u: string, i: RequestInit) => { seen.push({ u, b: String(i.body) }); return new Response('{}', { status: 200 }); }) as unknown as typeof fetch;
  assert.deepEqual(await subscribe('nope', 't', cfg, ok), { ok: false, why: 'invalid' }); assert.equal(seen.length, 0);
  assert.deepEqual(await subscribe(' a@b.co ', 'tripwire-today', cfg, ok), { ok: true }); assert.deepEqual(JSON.parse(seen[0].b), { email: 'a@b.co', source: 'tripwire-today' });
  assert.deepEqual(await subscribe('a@b.co', 't', cfg, (async () => new Response('', { status: 500 })) as typeof fetch), { ok: false, why: 'failed' });
  assert.deepEqual(await subscribe('a@b.co', 't', cfg, (async () => { throw new Error('x'); }) as typeof fetch), { ok: false, why: 'failed' });
});
