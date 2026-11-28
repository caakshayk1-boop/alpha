// worker/index.js fixes from the 28 Nov 2026 review: the previous-close rule, the feed allow-list and the shard's not-found answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { isSessionBar } from '../worker/index.js';

test('the newest daily bar is the current session by elapsed time, not by UTC calendar day', () => {
  // NSE: bar 03:45 UTC, last trade 10:00 UTC the same day
  assert.equal(isSessionBar(Date.UTC(2026, 6, 15, 3, 45) / 1000, Date.UTC(2026, 6, 15, 10, 0) / 1000), true);
  // FX in British summer time: bar stamped 23:00 UTC the day before, last trade 10:00 UTC (the old rule called this yesterday's bar)
  assert.equal(isSessionBar(Date.UTC(2026, 6, 14, 23, 0) / 1000, Date.UTC(2026, 6, 15, 10, 0) / 1000), true);
  // last trade belongs to an older session than the bar (bar opened, nothing traded yet)
  assert.equal(isSessionBar(Date.UTC(2026, 6, 16, 3, 45) / 1000, Date.UTC(2026, 6, 15, 10, 0) / 1000), false);
  // the previous day's bar, more than 24 hours before the trade
  assert.equal(isSessionBar(Date.UTC(2026, 6, 14, 3, 45) / 1000, Date.UTC(2026, 6, 15, 10, 0) / 1000), false);
  // no last-trade time: never claim the bar is current
  assert.equal(isSessionBar(1e9, undefined), false);
  assert.equal(isSessionBar(1e9, 0), false);
});

const env = { ASSETS: { fetch: async () => new Response('<!doctype html><h1>Not found</h1>', { status: 404, headers: { 'content-type': 'text/html' } }) } };
const ctx = { waitUntil: () => {} };
globalThis.caches ??= { default: { match: async () => undefined, put: async () => {} } };

test('inherited object keys are not feeds', async () => {
  const realFetch = globalThis.fetch; let called = 0;
  globalThis.fetch = async () => { called++; return new Response('{}'); };
  try {
    for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const r = await worker.fetch(new Request(`https://alpha.askakshay.com/data/${name}.json`), env, ctx);
      assert.equal(r.status, 404, name);
      assert.deepEqual(await r.json(), { ok: false, error: 'unknown feed' });
    }
    assert.equal(called, 0, 'no upstream call for a name that is not on the list');
  } finally { globalThis.fetch = realFetch; }
});

test('an unknown company slice answers JSON 404, never the HTML not-found page', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('not here', { status: 404 });
  try {
    const r = await worker.fetch(new Request('https://alpha.askakshay.com/c/NOPE.json'), env, ctx);
    assert.equal(r.status, 404);
    assert.match(r.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await r.json(), { ok: false, error: 'unknown company' });
  } finally { globalThis.fetch = realFetch; }
});
