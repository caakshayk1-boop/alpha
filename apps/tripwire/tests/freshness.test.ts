// ONE freshness rule (src/freshness.ts) and the build-time assertions built on it (tools/check-data.mjs). Every clock is an explicit IST wall time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { statusOf, expectedSession, inBuildWindow, sessionsBehind, freshness, assessFiles, pillOf, assertScreen, throughWord, builtWord, FILE_IDS, type FileFact } from '../src/freshness.ts';
// @ts-ignore (plain JS build tool)
import { checkDist } from '../tools/check-data.mjs';

const ist = (iso: string, h: number, m = 0) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), h, m) - 330 * 60000;

test('expected session: the last close that has passed, never a weekend or an NSE holiday', () => {
  assert.equal(expectedSession(ist('2026-11-01', 10)), '2026-10-30', 'Sunday: Friday');
  assert.equal(expectedSession(ist('2026-10-30', 15, 59)), '2026-10-29', 'before the 16:00 settle');
  assert.equal(expectedSession(ist('2026-10-30', 16, 0)), '2026-10-30');
  assert.equal(expectedSession(ist('2026-10-21', 9)), '2026-10-19', 'the morning after Dussehra');
});
test('grace window: one session behind is pending from 16:00 to 23:29 IST on the session day, stale from 23:30 and on any later day', () => {
  const thu = '2026-10-29';
  assert.equal(statusOf(thu, ist('2026-10-30', 15, 59)).status, 'current', 'Friday before the close: Thursday IS the last finished session');
  assert.equal(statusOf(thu, ist('2026-10-30', 16, 0)).status, 'pending');
  assert.equal(statusOf(thu, ist('2026-10-30', 21, 0)).status, 'pending');
  assert.equal(statusOf(thu, ist('2026-10-30', 23, 29)).status, 'pending');
  assert.equal(statusOf(thu, ist('2026-10-30', 23, 30)).status, 'stale', 'the build window is over');
  assert.equal(statusOf(thu, ist('2026-10-31', 4, 15)).status, 'stale', 'the 04:15 catch-up must already have the close');
  assert.equal(statusOf(thu, ist('2026-11-01', 12)).status, 'stale', 'Sunday: Friday is the expected session and has not arrived');
  assert.equal(statusOf('2026-10-30', ist('2026-11-01', 12)).status, 'current');
  assert.equal(statusOf('2026-10-28', ist('2026-10-30', 21)).status, 'stale', 'two behind is stale even inside the window');
  assert.equal(inBuildWindow(ist('2026-11-01', 20)), false, 'a weekend evening has no build due');
});
test('holidays are not lateness: a screen on the last session before Dussehra is current through the holiday', () => {
  assert.equal(statusOf('2026-10-19', ist('2026-10-20', 20)).status, 'current');
  assert.equal(statusOf('2026-10-19', ist('2026-10-21', 10)).status, 'current', 'Wednesday morning: Monday is still the last finished session');
  assert.equal(statusOf('2026-10-19', ist('2026-10-21', 18)).status, 'pending');
});
test('unreadable and absent dates are stated, never current', () => {
  assert.equal(statusOf('garbage').status, 'unknown'); assert.equal(statusOf(null).status, 'missing'); assert.equal(statusOf(undefined).status, 'missing');
  assert.equal(sessionsBehind('2026-13-45x'), null); assert.equal(freshness('garbage').word, 'Unknown');
  assert.equal(freshness('2026-10-29', ist('2026-10-30', 18)).pending, true); assert.equal(freshness('2026-10-29', ist('2026-10-30', 18)).word, 'One session behind');
});
test('words: the data day and the build time print one way', () => {
  assert.equal(throughWord('2026-10-29'), 'Thu 29 Oct'); assert.equal(throughWord(null), 'an unknown date');
  assert.equal(builtWord('2026-11-01T02:16:48.157188+05:30'), '02:16 IST'); assert.equal(builtWord('2026-10-31T20:46:54Z'), '02:16 IST'); assert.equal(builtWord('nope'), null);
});
const facts = (over: Partial<Record<string, string | null>> = {}): FileFact[] => FILE_IDS.map((id) => ({ id, asOf: id in over ? over[id] : '2026-10-30', built: '2026-11-01T02:16:48+05:30', rows: 10 }));
test('files: every file is judged by the same rule, the worst one sets the pill, and the pill says which file in words', () => {
  const now = ist('2026-11-01', 10);
  const ok = assessFiles(facts(), now); assert.equal(ok.worst, 'current'); assert.equal(ok.files.length, FILE_IDS.length);
  const p = pillOf(ok.files, now)!; assert.equal(p.tone, 'ok'); assert.match(p.text, /^Data through Fri 30 Oct · built 02:16 IST$/); assert.doesNotMatch(p.text + p.detail, /live/i, 'a close is not live');
  const bad = assessFiles(facts({ signals: '2026-10-28', ledger: null }), now); assert.equal(bad.worst, 'stale');
  const pb = pillOf(bad.files, now)!; assert.equal(pb.tone, 'stale'); assert.match(pb.detail, /Signals 2 sessions behind/); assert.match(pb.detail, /Forward record not published/);
  const mid = ist('2026-10-30', 19); const pend = assessFiles(facts({ screen: '2026-10-29', companies: '2026-10-29', signals: '2026-10-29', breadth: '2026-10-29', ledger: '2026-10-29', rsi: '2026-10-29', factors: '2026-10-29' }), mid);
  assert.equal(pillOf(pend.files, mid)!.tone, 'pending');
});
const row = (sym: string, over: Record<string, unknown> = {}) => ({ sym, sector: 'Healthcare', tier: 'large', last_date: '2026-10-30', ...over });
// NOTE: HEG and ICICIPRULI at 23 Oct inside a 26 Oct file are exactly ONE session behind (Fri to Mon), which the rule allows; the test uses 22 Oct, two behind.
test('assertScreen: a stale as_of, an old row, a null sector and too many null tiers each fail with a line naming them', () => {
  const now = ist('2026-11-01', 10); const good = { as_of: '2026-10-30', rows: [row('A'), row('B')] };
  assert.deepEqual(assertScreen(good, now), []);
  assert.match(assertScreen({ ...good, as_of: '2026-10-27' }, now)[0], /screen as_of 2026-10-27 is 3 sessions behind; the last completed NSE session is 2026-10-30/);
  const heg = assertScreen({ as_of: '2026-10-26', rows: [row('HEG', { last_date: '2026-10-22' }), row('B', { last_date: '2026-10-26' })] }, ist('2026-10-27', 10));
  assert.ok(heg.some((m) => /HEG 2026-10-22/.test(m)), heg.join('|'));
  assert.deepEqual(assertScreen({ as_of: '2026-10-26', rows: [row('HEG', { last_date: '2026-10-22', stale: true })] }, ist('2026-10-27', 10)), [], 'flagged stale is allowed');
  assert.match(assertScreen({ ...good, rows: [row('ARTEMISMED', { sector: null }), row('B')] }, now)[0], /no sector: ARTEMISMED/);
  assert.deepEqual(assertScreen({ ...good, rows: [row('ARTEMISMED', { sector: null })] }, now, { knownNullSector: ['ARTEMISMED'] }), []);
  assert.match(assertScreen({ ...good, rows: [row('A', { tier: null }), row('B', { tier: null }), row('C')] }, now)[0], /2 of 3 rows .* have no size class/);
});
test('check-data: a good build passes; a deliberately staled build FAILS with a clear line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tw-dist-')); mkdirSync(join(dir, 'data'));
  const put = (asOf: string, lastDate: string) => {
    writeFileSync(join(dir, 'data', 'screen.json'), JSON.stringify({ as_of: asOf, rows: [row('A', { last_date: lastDate }), row('B', { last_date: lastDate })] }));
    writeFileSync(join(dir, 'data', 'freshness.json'), JSON.stringify({ files: [{ id: 'screen', asOf }, { id: 'companies', asOf: lastDate }, { id: 'signals', asOf }] }));
  };
  const now = ist('2026-11-01', 10); put('2026-10-30', '2026-10-30'); assert.deepEqual(checkDist(dir, now, {}).errors, []);
  put('2026-10-27', '2026-10-27'); const r = checkDist(dir, now, {}); assert.ok(r.errors.length >= 2); assert.match(r.errors.join('\n'), /screen as_of 2026-10-27/); assert.match(r.errors.join('\n'), /company files carry 2026-10-27/);
  assert.equal(checkDist(dir, now, { TRIPWIRE_ALLOW_STALE: '1' }).errors.length, 0, 'the local-laptop escape hatch, never set in CI');
  assert.ok(checkDist(dir, now, { STRICT_SIGNALS: '1' }).errors.some((m: string) => /signals/.test(m)));
  assert.match(checkDist(join(dir, 'nope'), now, {}).errors[0], /build first/);
});

test('a data day later than the expected session is unreadable, not current', () => {
  const now = ist('2026-10-30', 10);
  assert.equal(sessionsBehind('2026-12-31', now), null); assert.equal(statusOf('2026-12-31', now).status, 'unknown'); assert.equal(statusOf('2026-10-29', now).status, 'current');
  assert.match(assertScreen({ as_of: '2026-12-31', rows: [] }, now)[0], /unreadable/);
});
