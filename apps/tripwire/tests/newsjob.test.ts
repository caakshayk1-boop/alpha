// @ts-nocheck  (the pipeline under test is untyped JavaScript, see src/newsjs.d.ts; the assertions are the contract)
// The scheduled job: the 15/30 minute cadence by exchange calendar, polite fetching (backoff, Retry-After, conditional requests, circuit breaker), and the snapshot's honesty rules
// (a total failure keeps the last good events and never resets lastSuccessfulAt). Recorded-style fixtures only; no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { cadenceMin, nextCheckMs, shouldRun, delayAfterMin } from '../news/schedule.js';
import { backoffMs, breakerAllow, breakerRecord, breakerState, fetchPolicy, retryAfterMs } from '../news/fetcher.js';
import { runJob } from '../news/job.js';
import { ALIASES } from '../news/aliases.js';
import { buildNames, queryPlan, companyQuery, BOUNDS } from '../news/plan.js';

const Z = (s: string) => Date.parse(s);
const dir = (n: string) => new URL(`./fixtures/news/${n}/`, import.meta.url);
const routesFetch = (name: string) => { const routes = JSON.parse(readFileSync(new URL('routes.json', dir(name)), 'utf8')); return async (url: string) => {
  const r = routes.find((x: { match: string }) => new RegExp(x.match).test(decodeURIComponent(url))); if (!r) return new Response('', { status: 404 }); if (r.throw) throw Object.assign(new Error(r.throw), { name: 'TimeoutError' });
  return new Response(r.file ? readFileSync(new URL(r.file, dir(name)), 'utf8') : '', { status: r.status ?? 200, headers: r.headers ?? {} }); }; };
const inputs = { ledger: { picks: [{ sym: 'TCS' }] }, covered: JSON.parse(readFileSync(new URL('../news/covered.json', import.meta.url), 'utf8')), aliases: { aliases: ALIASES }, universe: [] };
const nosleep = async () => {};

test('cadence: 15 minutes while the NSE session is on, 30 otherwise, by the calendar', () => {
  assert.equal(cadenceMin(Z('2026-10-27T03:44:00Z')), 30, '09:14 IST, one minute before the open');
  assert.equal(cadenceMin(Z('2026-10-27T03:45:00Z')), 15, '09:15 IST'); assert.equal(cadenceMin(Z('2026-10-27T09:59:00Z')), 15, '15:29 IST');
  assert.equal(cadenceMin(Z('2026-10-27T10:00:00Z')), 30, '15:30 IST, the close'); assert.equal(cadenceMin(Z('2026-10-27T18:00:00Z')), 30, 'night');
  assert.equal(cadenceMin(Z('2026-10-24T06:00:00Z')), 30, 'Saturday'); assert.equal(cadenceMin(Z('2026-10-25T06:00:00Z')), 30, 'Sunday');
  assert.equal(cadenceMin(Z('2026-10-20T06:00:00Z')), 30, 'Tuesday 20 Oct 2026 is Dussehra, an NSE holiday');
});
test('next check: one cadence on, but never past the next session open; across a holiday it waits for the session after it', () => {
  assert.equal(new Date(nextCheckMs(Z('2026-10-27T06:00:00Z'))).toISOString(), '2026-10-27T06:15:00.000Z');
  assert.equal(new Date(nextCheckMs(Z('2026-10-27T03:30:00Z'))).toISOString(), '2026-10-27T03:45:00.000Z', 'from 09:00 IST the next check is the 09:15 open, not 09:30');
  assert.equal(new Date(nextCheckMs(Z('2026-10-27T10:10:00Z'))).toISOString(), '2026-10-27T10:40:00.000Z');
  assert.equal(new Date(nextCheckMs(Z('2026-10-24T06:00:00Z'))).toISOString(), '2026-10-24T06:30:00.000Z', 'Saturday');
  assert.equal(new Date(nextCheckMs(Z('2026-10-19T18:00:00Z'))).toISOString(), '2026-10-19T18:30:00.000Z', 'Monday night: the next open is Wednesday, so a plain half hour');
});
test('guard: a cron tick runs only when a cadence has elapsed (3 minutes of cron drift tolerated); a manual run always runs', () => {
  const t = Z('2026-10-27T06:00:00Z');
  assert.equal(shouldRun({ nowMs: t, lastAttemptMs: t - 10 * 60000 }).run, false); assert.equal(shouldRun({ nowMs: t, lastAttemptMs: t - 12 * 60000 }).run, true, 'a tick that arrives 12 minutes after the last is on schedule');
  const night = Z('2026-10-27T12:00:00Z'); assert.equal(shouldRun({ nowMs: night, lastAttemptMs: night - 15 * 60000 }).run, false, 'the cron fires every 15 minutes in its window; outside the session only every other one works');
  assert.equal(shouldRun({ nowMs: night, lastAttemptMs: night - 27 * 60000 }).run, true); assert.equal(shouldRun({ nowMs: night, lastAttemptMs: night - 1000, force: true }).run, true);
  assert.equal(shouldRun({ nowMs: night, lastAttemptMs: NaN }).run, true);
  const hol = Z('2026-10-20T06:00:00Z'); assert.equal(shouldRun({ nowMs: hol, lastAttemptMs: hol - 15 * 60000 }).run, false, 'on a holiday the session cadence does not apply');
  assert.equal(delayAfterMin(t), 40); assert.equal(delayAfterMin(night), 70);
});

test('fetch policy: backoff is bounded with jitter; Retry-After is read as seconds or a date', () => {
  assert.equal(backoffMs(0, () => 0.5), 800); assert.equal(backoffMs(1, () => 0.5), 1600); assert.ok(backoffMs(0, () => 0) < backoffMs(0, () => 0.99)); assert.equal(backoffMs(10, () => 1), 15000, 'never above the cap');
  assert.equal(retryAfterMs('120', 0), 120000); assert.equal(retryAfterMs('Wed, 21 Oct 2026 07:28:30 GMT', Z('2026-10-21T07:28:00Z')), 30000); assert.equal(retryAfterMs('soon', 0), null); assert.equal(retryAfterMs(null, 0), null);
});
const res = (status: number, body = '', h: Record<string, string> = {}) => new Response(status === 304 ? null : body, { status, headers: h });
test('fetch policy: 503 is retried with backoff and then reported; 429 with a long Retry-After is not retried; 404 is not retried; a timeout is retried and named', async () => {
  const waits: number[] = []; const sleep = async (ms: number) => { waits.push(ms); };
  let n = 0; const r1 = await fetchPolicy({ url: 'https://x.com/f', fetchImpl: async () => { n++; return res(503); }, nowMs: 0, sleep, random: () => 0.5 });
  assert.deepEqual([r1.status, r1.httpStatus, r1.attempts, n], ['failed', 503, 3, 3]); assert.deepEqual(waits, [800, 1600]);
  const r2 = await fetchPolicy({ url: 'https://x.com/f', fetchImpl: async () => res(429, '', { 'retry-after': '3600' }), nowMs: 0, sleep }); assert.deepEqual([r2.status, r2.attempts, r2.retryAfterMs], ['failed', 1, 3600000]);
  const r3 = await fetchPolicy({ url: 'https://x.com/f', fetchImpl: async () => res(404), nowMs: 0, sleep }); assert.equal(r3.attempts, 1);
  waits.length = 0; const r4 = await fetchPolicy({ url: 'https://x.com/f', fetchImpl: async () => res(503, '', { 'retry-after': '2' }), nowMs: 0, sleep }); assert.deepEqual(waits, [2000, 2000], 'a short Retry-After is honoured instead of the backoff');
  const r5 = await fetchPolicy({ url: 'https://x.com/f', fetchImpl: async () => { throw Object.assign(new Error('x'), { name: 'TimeoutError' }); }, nowMs: 0, sleep }); assert.equal(r5.error, 'timeout');
  let calls = 0; const r6 = await fetchPolicy({ url: 'https://x.com/f', fetchImpl: async () => (++calls < 3 ? res(502) : res(200, '<rss/>', { etag: '"a"' })), nowMs: 0, sleep }); assert.deepEqual([r6.status, r6.etag, r6.attempts], ['ok', '"a"', 3]);
});
test('fetch policy: conditional requests send the validators and a 304 is "not modified", not a failure', async () => {
  let seen: Record<string, string> = {}; const r = await fetchPolicy({ url: 'https://x.com/f', validators: { etag: '"v1"', lastModified: 'Mon, 26 Oct 2026 00:00:00 GMT' }, fetchImpl: async (_u: string, o: { headers: Record<string, string> }) => { seen = o.headers; return res(304); }, nowMs: 0 });
  assert.equal(r.status, 'not_modified'); assert.equal(seen['If-None-Match'], '"v1"'); assert.equal(seen['If-Modified-Since'], 'Mon, 26 Oct 2026 00:00:00 GMT'); assert.equal(r.etag, '"v1"');
});
test('circuit breaker: opens after three failed runs, lets one probe through after thirty minutes, closes on success, and a Retry-After holds it open', () => {
  const t = Z('2026-10-27T06:00:00Z'); let b = {}; for (let i = 0; i < 2; i++) b = breakerRecord(b, false, t, { error: 'HTTP 503' }); assert.ok(breakerAllow(b, t)); assert.equal(breakerState(b, t), 'closed');
  b = breakerRecord(b, false, t, { error: 'HTTP 503' }); assert.ok(!breakerAllow(b, t + 60000)); assert.equal(breakerState(b, t + 60000), 'open'); assert.ok(breakerAllow(b, t + 31 * 60000)); assert.equal(breakerState(b, t + 31 * 60000), 'half-open');
  assert.deepEqual(breakerRecord(b, true, t), { failures: 0, openUntil: null, lastError: null });
  const held = breakerRecord({}, false, t, { retryAfterMs: 3600000 }); assert.equal(held.openUntil, t + 3600000, 'one 429 with an hour to wait opens it for the hour');
});

test('plan: bounded, paper-book names every tick, the others rotate, unresolved names are reported not guessed', () => {
  const names = buildNames({ ledger: { picks: [{ sym: 'TCS' }, { sym: 'ZZZNEW' }] }, covered: inputs.covered, aliases: inputs.aliases, universe: [] });
  assert.deepEqual(names.paper, ['TCS']); assert.deepEqual(names.unresolved, ['ZZZNEW']);
  const a = queryPlan({ names, tick: 1 }), b = queryPlan({ names, tick: 2 }); assert.ok(a.length <= 2 + 4 + 1 + BOUNDS.otherPerTick);
  assert.ok(a.some((s) => s.sym === 'TCS') && b.some((s) => s.sym === 'TCS')); const others = (p: typeof a) => p.filter((s) => s.scope === 'covered').map((s) => s.sym).join(); assert.notEqual(others(a), others(b));
  assert.equal(companyQuery('Tata Consultancy Services Ltd.'), '"Tata Consultancy Services" when:7d');
  const withUniverse = buildNames({ ledger: { picks: [{ sym: 'ZZZNEW' }] }, covered: inputs.covered, aliases: inputs.aliases, universe: [['ZZZNEW', 'Tech', 'Zzz New Ltd.']] }); assert.deepEqual(withUniverse.unresolved, []);
});

const NOW = Z('2026-10-27T06:00:00Z');
const job = (o: Record<string, unknown>) => runJob({ nowMs: NOW, fetchImpl: routesFetch('ok'), inputs, force: true, sleep: nosleep, random: () => 0.5, ...o });
test('job (offline fixtures): partial when one source is down - the good sources are kept and coverage says partial', async () => {
  const r: any = await job({}); assert.equal(r.snapshot.status, 'partial'); assert.equal(r.snapshot.schema, 'tripwire-news/1'); assert.equal(r.snapshot.snapshotVersion, 1);
  const sebi = r.snapshot.sources.find((s: any) => s.id === 'sebi-releases'); assert.equal(sebi.status, 'failed'); assert.equal(sebi.httpStatus, 503); assert.equal(r.snapshot.sources.find((s: any) => s.id === 'rbi-press').status, 'ok'); assert.equal(r.snapshot.sources.find((s: any) => s.id === 'bing-news').status, 'standby');
  assert.ok(r.snapshot.events.length >= 6); assert.equal(r.snapshot.lastSuccessfulAt, new Date(NOW).toISOString()); assert.equal(r.snapshot.checkedAt, r.snapshot.lastSuccessfulAt);
  assert.equal(r.snapshot.nextScheduledAt, '2026-10-27T06:15:00.000Z'); assert.equal(r.snapshot.cadenceMin, 15); assert.equal(r.status.status, 'partial'); assert.ok(r.status.sourcesFailed >= 1);
  assert.ok(r.snapshot.rejections.quote_page >= 1 && r.snapshot.rejections.future_timestamp === 1); assert.ok(r.browser.events.every((e: any) => !('items' in e)), 'the browser copy has no member items'); assert.ok(!('sourceValidators' in r.browser));
  for (const k of ['scheduledAt', 'startedAt', 'completedAt', 'lastSuccessfulAt', 'nextScheduledAt', 'snapshotVersion', 'rejections', 'sources']) assert.ok(k in r.snapshot, k);
});
test('job: a total failure keeps the last good events, labels the run failed, and does not reset lastSuccessfulAt', async () => {
  const good: any = await job({}); const later = NOW + 30 * 60000;
  const bad: any = await runJob({ nowMs: later, fetchImpl: routesFetch('down'), prev: good.snapshot, inputs, force: true, sleep: nosleep, random: () => 0.5 });
  assert.equal(bad.snapshot.status, 'failed'); assert.equal(bad.snapshot.lastSuccessfulAt, good.snapshot.lastSuccessfulAt, 'the last good time is not reset'); assert.notEqual(bad.snapshot.checkedAt, bad.snapshot.lastSuccessfulAt);
  assert.deepEqual(bad.snapshot.events.map((e: any) => e.eventClusterId), good.snapshot.events.map((e: any) => e.eventClusterId), 'the last good items are kept'); assert.equal(bad.snapshot.snapshotVersion, good.snapshot.snapshotVersion);
  assert.ok(bad.snapshot.lastError); assert.equal(bad.status.status, 'failed'); assert.equal(bad.status.lastSuccessfulAt, good.status.lastSuccessfulAt);
  assert.ok(bad.snapshot.sources.some((s: any) => s.error === 'timeout' || /HTTP 5\d\d|HTTP 429/.test(s.error)));
  const again: any = await runJob({ nowMs: later + 30 * 60000, fetchImpl: routesFetch('down'), prev: bad.snapshot, inputs, force: true, sleep: nosleep, random: () => 0.5 });
  assert.equal(again.snapshot.lastSuccessfulAt, good.snapshot.lastSuccessfulAt, 'two failures in a row: still the original');
});
test('job: the circuit breaker opens after repeated failures and the next run does not call the source; the snapshot carries the state', async () => {
  let prev: any = null; let nowMs = NOW; let calls = 0; const counting = async (u: string) => { calls++; return routesFetch('down')(u); };
  for (let i = 0; i < 3; i++) { const r: any = await runJob({ nowMs, fetchImpl: counting, prev, inputs, force: true, sleep: nosleep, random: () => 0.5 }); prev = r.snapshot; nowMs += 30 * 60000; }
  const g = prev.sources.find((s: any) => s.id === 'google-news'); assert.equal(g.breaker.failures, 3); assert.ok(g.breaker.openUntil > nowMs - 30 * 60000);
  calls = 0; const r: any = await runJob({ nowMs: Date.parse(new Date(g.breaker.openUntil).toISOString()) - 60000, fetchImpl: counting, prev, inputs, force: true, sleep: nosleep, random: () => 0.5 });
  assert.ok(r.snapshot.sources.find((s: any) => s.id === 'google-news').skipped > 0); assert.equal(r.snapshot.sources.find((s: any) => s.id === 'google-news').status, 'open'); assert.equal(calls, 0, 'no request is made to a source whose breaker is open');
});
test('job: the version only moves when the events change; a second identical run keeps the version and stays published as checked', async () => {
  const a: any = await job({}); const b: any = await job({ prev: a.snapshot, nowMs: NOW + 15 * 60000 });
  assert.equal(b.snapshot.snapshotVersion, a.snapshot.snapshotVersion); assert.equal(b.snapshot.checkedAt, new Date(NOW + 15 * 60000).toISOString()); assert.equal(b.snapshot.events.length, a.snapshot.events.length);
  const ev = (s: any) => s.events.find((e: any) => e.eventType === 'Results'); assert.equal(ev(b.snapshot).publishedAt, ev(a.snapshot).publishedAt, 'a re-fetched event keeps its date'); assert.equal(ev(b.snapshot).firstSeenAt, ev(a.snapshot).firstSeenAt, 'and its first-seen time');
});
test('job: a tick inside the cadence does nothing', async () => {
  const a: any = await job({}); const r: any = await runJob({ nowMs: NOW + 5 * 60000, fetchImpl: routesFetch('ok'), prev: a.snapshot, inputs, sleep: nosleep }); assert.equal(r.skipped, true);
});
test('run.mjs end to end against the fixtures: writes the three files and exits 0, also when everything is down', () => {
  const out = mkdtempSync(join(tmpdir(), 'newsrun-')); const base = ['--experimental-strip-types', '--no-warnings', 'apps/tripwire/news/run.mjs', '--out', out, '--now', '2026-10-27T06:00:00Z', '--paper', 'TCS'];
  const ok = spawnSync('node', [...base, '--fixtures', 'apps/tripwire/tests/fixtures/news/ok'], { encoding: 'utf8' }); assert.equal(ok.status, 0, ok.stderr); assert.match(ok.stdout, /^partial: \d+ events/);
  const files = ['news.json', 'news-browser.json', 'news-status.json'].map((f) => JSON.parse(readFileSync(join(out, f), 'utf8'))); assert.equal(files[0].schema, 'tripwire-news/1'); assert.equal(files[2].schema, 'tripwire-news-status/1'); assert.ok(files[1].events.length > 0);
  const out2 = mkdtempSync(join(tmpdir(), 'newsrun2-')); writeFileSync(join(out2, 'news.json'), JSON.stringify(files[0]));
  const down = spawnSync('node', ['--experimental-strip-types', '--no-warnings', 'apps/tripwire/news/run.mjs', '--out', out2, '--prev', out2, '--now', '2026-10-27T07:00:00Z', '--paper', 'TCS', '--fixtures', 'apps/tripwire/tests/fixtures/news/down'], { encoding: 'utf8' });
  assert.equal(down.status, 0, down.stderr); const s = JSON.parse(readFileSync(join(out2, 'news-status.json'), 'utf8')); assert.equal(s.status, 'failed'); assert.equal(s.lastSuccessfulAt, '2026-10-27T06:00:00.000Z'); assert.equal(s.checkedAt, '2026-10-27T07:00:00.000Z');
});

test('contentHash moves when anything a reader sees changes, and not when only the clock moves', async () => {
  const { contentHash } = await import('../news/snapshot.js');
  const e = { eventClusterId: 'a', headline: 'H', moreSources: 0, publishedAt: '2026-10-27T01:00:00Z', sources: [{}], summary: { text: 's', provenance: { retrievedAt: 'r1' } }, rank: { reason: 'p1' }, eventType: 'Results', entities: [{ sym: 'X', confidence: 1 }], updatedAt: 'u1', relevanceScore: 0.9, factors: { r: 1 }, fetchedAt: 't1' };
  const base = contentHash([e]);
  assert.equal(contentHash([{ ...e, relevanceScore: 0.4, factors: { r: 0 }, fetchedAt: 't2', rank: { reason: 'p2' }, summary: { text: 's', provenance: { retrievedAt: 'r2' } } }]), base, 'time-decayed score, rank reason and fetch times do not count');
  for (const patch of [{ summary: { text: 'changed' } }, { eventType: 'Update' }, { updatedAt: 'u2' }, { entities: [] }]) assert.notEqual(contentHash([{ ...e, ...patch }]), base, JSON.stringify(patch));
});
