import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRemind, handleExtra, dueReminders } from '../extras.js';

const NOW = Date.parse('2026-11-19T04:00:00Z'); // Thu 12:00 MYT
test('remind: times are Malaysia time; a past time today means tomorrow', () => {
  assert.equal(parseRemind('18:00 check stop', NOW).at, Date.parse('2026-11-19T10:00:00Z'));
  assert.equal(parseRemind('09:00 later', NOW).at, Date.parse('2026-11-20T01:00:00Z'), '09:00 MYT already passed today');
  assert.equal(parseRemind('tomorrow 08:30 x', NOW).at, Date.parse('2026-11-20T00:30:00Z'));
  assert.equal(parseRemind('2026-11-25 09:00 x', NOW).at, Date.parse('2026-11-25T01:00:00Z'));
  assert.match(parseRemind('2026-11-01 09:00 x', NOW).error, /already passed/);
  assert.match(parseRemind('25:00 x', NOW).error, /^Usage/);
  assert.match(parseRemind('18:00', NOW).error, /^Usage/);
  assert.match(parseRemind('18:00 ' + 'x'.repeat(301), NOW).error, /too long/);
});
const mem = (known = ['INFY', 'TCS']) => {
  const d = { w: [], r: [] };
  return { d, deps: {
    getJSON: async (u) => ({ quotes: Object.fromEntries(decodeURIComponent(u.split('s=')[1]).split(',').filter((s) => known.includes(s)).map((s) => [s, {}])) }),
    watch: { list: async () => d.w, set: async (v) => { d.w = v; } },
    remind: { list: async () => d.r, set: async (v) => { d.r = v; } },
  } };
};
test('watch commands: add (validated against Tripwire), list, remove, limits', async () => {
  const { d, deps } = mem();
  assert.match(await handleExtra('/watch infy tcs nope', deps, NOW), /Watching: INFY, TCS\.[\s\S]*Unknown on Tripwire: NOPE/);
  assert.deepEqual(d.w.map((x) => x.sym), ['INFY', 'TCS']);
  assert.equal(d.w[0].since, NOW);
  assert.match(await handleExtra('/watch INFY', deps, NOW), /Already on the list: INFY/);
  assert.match(await handleExtra('/watchlist', deps, NOW), /Watchlist \(2\)<\/b>\nINFY, TCS\n/);
  assert.match(await handleExtra('/unwatch tcs', deps, NOW), /Removed\. Watching 1\./);
  assert.match(await handleExtra('/unwatch ZZZ', deps, NOW), /None of those/);
  assert.match(await handleExtra('/watch bad!sym', deps, NOW), /^Usage: \/watch/);
  d.w = Array.from({ length: 15 }, (_, i) => ({ sym: 'S' + i, since: 0 }));
  assert.match(await handleExtra('/watch INFY', deps, NOW), /limited to 15/);
});
test('reminder commands: set in time order, list, remove, due split', async () => {
  const { d, deps } = mem();
  assert.match(await handleExtra('/remind 18:00 second', deps, NOW), /Reminder 1 set for Thu 19 Nov 18:00 MYT: second/);
  assert.match(await handleExtra('/remind 14:00 first <b>', deps, NOW), /Reminder 1 set for Thu 19 Nov 14:00 MYT: first &lt;b&gt;/);
  assert.match(await handleExtra('/reminders', deps, NOW), /1\. Thu 19 Nov 14:00 MYT · first[\s\S]*2\. Thu 19 Nov 18:00 MYT · second/);
  const { due, rest } = dueReminders(d.r, Date.parse('2026-11-19T06:30:00Z'));
  assert.equal(due.length, 1);
  assert.equal(rest.length, 1);
  assert.match(await handleExtra('/unremind 1', deps, NOW), /Removed reminder 1/);
  assert.match(await handleExtra('/unremind 9', deps, NOW), /^Usage/);
  assert.equal(await handleExtra('/help', deps, NOW), null);
  assert.equal(await handleExtra('hello', deps, NOW), null);
});
