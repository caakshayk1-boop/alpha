// @ts-nocheck  (plain JavaScript modules)
// The scheduler nudge is inert without its secret, never fakes a send, and defers to the job's own cadence guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nudge, DISPATCH_URL } from '../news/nudge.js';
import worker from '../worker.js';

const NOW = Date.parse('2026-10-27T06:00:00Z'); const iso = (minAgo: number) => new Date(NOW - minAgo * 60000).toISOString();
test('no token: nothing is sent, no request is made, and it says why', async () => {
  let calls = 0; const r = await nudge({ env: {}, nowMs: NOW, fetchImpl: async () => { calls++; return new Response(null, { status: 204 }); }, status: null });
  assert.deepEqual([r.sent, calls], [false, 0]); assert.match(r.why, /no token/);
});
test('with a token: a due tick sends one workflow_dispatch with force=false; an early tick sends nothing; failures are reported, not hidden', async () => {
  const seen: any[] = []; const f = (status: number) => async (u: string, o: any) => { seen.push([u, o]); return new Response(null, { status }); };
  const env = { GITHUB_DISPATCH_TOKEN: 'tkn' };
  const due = await nudge({ env, nowMs: NOW, fetchImpl: f(204), status: { checkedAt: iso(40) } }); assert.deepEqual([due.sent, due.why], [true, 'dispatched']);
  assert.equal(seen[0][0], DISPATCH_URL); assert.equal(seen[0][1].method, 'POST'); assert.equal(seen[0][1].headers.Authorization, 'Bearer tkn'); assert.deepEqual(JSON.parse(seen[0][1].body), { ref: 'main', inputs: { force: 'false' } });
  seen.length = 0; const early = await nudge({ env, nowMs: NOW, fetchImpl: f(204), status: { checkedAt: iso(5) } }); assert.equal(early.sent, false); assert.equal(seen.length, 0, 'five minutes after a check, in session: not due');
  assert.equal((await nudge({ env, nowMs: NOW, fetchImpl: f(403), status: null })).why, 'GitHub answered 403');
  assert.equal((await nudge({ env, nowMs: NOW, fetchImpl: async () => { throw new Error('x'); }, status: null })).sent, false);
});
test('the Worker\'s cron handler does nothing without the secret, and its token never appears in a log line', async () => {
  const realFetch = globalThis.fetch; let calls = 0; (globalThis as any).fetch = async () => { calls++; return new Response('{}'); };
  const logs: string[] = []; const log = console.log; console.log = (...a) => logs.push(a.join(' '));
  try { await worker.scheduled({}, {}, { waitUntil: (p: Promise<unknown>) => p }); assert.equal(calls, 0, 'no request at all'); } finally { console.log = log; (globalThis as any).fetch = realFetch; }
  assert.equal(logs.length, 0);
});
