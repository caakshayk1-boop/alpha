// Three times, one vocabulary: published, checked, quote. The label helpers never mix them up, never say live for a close, and never turn a missing time into "now".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishedLabel, checkedLabel, onDemandLabel, quoteLabel, screenLabel, timesLine } from '../src/timelabels.ts';
import { storyTime, newsHealth } from '../src/newshealth.ts';

const NOW = Date.UTC(2026, 9, 27, 6, 0);            // Tue 27 Oct 2026, 11:30 IST, in session
const iso = (minAgo: number) => new Date(NOW - minAgo * 60000).toISOString();

test('published: the source\'s own time, in IST; another day carries its date; unknown, unreadable and future are "unknown", never "just now"', () => {
  assert.equal(publishedLabel(iso(78), NOW), 'Published 10:12 IST');
  assert.equal(publishedLabel('2026-10-23T04:45:00Z', NOW), 'Published Fri 23 Oct 10:15 IST');
  for (const bad of [null, undefined, '', 'yesterday', 'NaN']) assert.equal(publishedLabel(bad as string, NOW), 'Publication time unknown', String(bad));
  assert.equal(publishedLabel(new Date(NOW + 3 * 3600e3).toISOString(), NOW), 'Publication time unknown', 'three hours in the future is a wrong date');
  assert.equal(publishedLabel(new Date(NOW + 5 * 60e3).toISOString(), NOW), 'Published 11:35 IST', 'a few minutes of clock skew is tolerated');
});
test('checked: the last SUCCESSFUL check, and a failed latest check is said to be a failure, not printed as a check time', () => {
  assert.equal(checkedLabel(iso(20), NOW), 'Checked 11:10 IST');
  assert.equal(checkedLabel(iso(20), NOW, { ok: false }), 'Checked 11:10 IST (last good copy; the latest check failed)');
  assert.equal(checkedLabel(null, NOW), 'Not checked yet'); assert.equal(checkedLabel('garbage', NOW), 'Not checked yet'); assert.equal(checkedLabel(new Date(NOW + 9e6).toISOString(), NOW), 'Not checked yet');
});
test('checked is never published: the two labels never share a word, so a check time cannot be read as a story\'s age', () => {
  const p = publishedLabel(iso(5), NOW), c = checkedLabel(iso(5), NOW); assert.ok(!/Checked/.test(p) && !/Published/.test(c)); assert.notEqual(p.split(' ')[0], c.split(' ')[0]);
  assert.equal(timesLine({ publishedAt: iso(90), lastGoodAt: iso(5) }, NOW).join(' | '), 'Published 10:00 IST | Checked 11:25 IST');
});
test('on demand: its own words and its own time; absent when there is none; never a "checked"', () => {
  assert.equal(onDemandLabel(iso(3), NOW), 'Refreshed on demand 11:27 IST'); assert.equal(onDemandLabel(null, NOW), null); assert.ok(!/Checked/.test(onDemandLabel(iso(3), NOW) as string));
});
test('quote: live only for a print under five minutes old by the exchange\'s own time; older is the last print with its time, never "now"', () => {
  const at = (minAgo: number) => Math.floor(NOW / 1000) - minAgo * 60;
  assert.deepEqual(quoteLabel(at(1), NOW), { text: 'Live 11:29 IST', live: true });   // 1 Nov 2026: the quote words are Live / Delayed / Last traded
  assert.equal(quoteLabel(at(12), NOW).live, false); assert.match(quoteLabel(at(12), NOW).text, /^Delayed 11:18 IST, 12 min old$/);
  assert.match(quoteLabel(at(40), NOW).text, /^Delayed, no print since 10:50 IST/);
  const shut = Date.UTC(2026, 9, 27, 12, 0); assert.deepEqual(quoteLabel(Math.floor(Date.UTC(2026, 9, 27, 9, 59) / 1000), shut), { text: 'Last traded 15:29 IST', live: false }, 'after the close the last print is the last print');
  assert.deepEqual(quoteLabel(null, NOW), { text: 'No price time', live: false }); assert.equal(quoteLabel(at(2000), NOW, false).live, false);
});
test('screen: a close, named by its trading day, never a clock time and never "live"', () => {
  assert.equal(screenLabel('2026-10-23'), 'Screen: close of Fri 23 Oct'); assert.equal(screenLabel('2026-10-23', 1), 'Screen: close of Fri 23 Oct, one session behind');
  assert.equal(screenLabel('2026-10-23', 3), 'Screen: close of Fri 23 Oct, 3 sessions behind'); assert.equal(screenLabel(null), 'Screen: date unknown');
  assert.ok(!/live|IST|\d\d:\d\d/i.test(screenLabel('2026-10-23')));
});
test('no label ever says live except a recent quote print: every other helper, for every input, is free of the word', () => {
  for (const f of [() => publishedLabel(iso(1), NOW), () => checkedLabel(iso(1), NOW), () => onDemandLabel(iso(1), NOW) ?? '', () => screenLabel('2026-10-27'), () => quoteLabel(null, NOW).text, () => quoteLabel(Math.floor(NOW / 1000) - 3600, NOW).text]) assert.ok(!/\blive\b/i.test(f()), f());
});
test('the story row\'s own time (newshealth.storyTime) says the same thing as the published label', () => {
  for (const m of [3, 78, 1500, 4000]) assert.equal(storyTime(iso(m), NOW).ist.toLowerCase(), publishedLabel(iso(m), NOW).toLowerCase(), `${m} min ago`);
  assert.equal(storyTime(null, NOW).ist.toLowerCase(), publishedLabel(null, NOW).toLowerCase());
});
test('news health: an on-demand refresh is reported beside a delayed state and never changes it, the check times or the words "last successful check"', () => {
  const doc = { snapshotVersion: 4, status: 'ok' as const, checkedAt: iso(60), lastSuccessfulAt: iso(60), nextScheduledAt: iso(45) };
  const late = newsHealth({ doc, nowMs: NOW }); assert.equal(late.state, 'delayed'); assert.equal(late.onDemand, null);
  const od = newsHealth({ doc, nowMs: NOW, onDemandAt: iso(4) }); assert.equal(od.state, 'delayed', 'still delayed: the scheduled check is late'); assert.equal(od.lastGood, late.lastGood); assert.equal(od.checked, late.checked);
  assert.equal(od.onDemand, '11:26 IST'); assert.match(od.line, /^News delayed - last successful check 10:30 IST, 60 minutes ago; scheduled checks run every 15 minutes/); assert.match(od.line, /refreshed on demand 11:26 IST/);
  assert.equal(newsHealth({ doc, nowMs: NOW, onDemandAt: iso(200) }).onDemand, null, 'an on-demand time from before the last good check is not offered');
  const fresh = newsHealth({ doc: { ...doc, checkedAt: iso(5), lastSuccessfulAt: iso(5) }, nowMs: NOW, onDemandAt: iso(1) }); assert.equal(fresh.state, 'fresh'); assert.equal(fresh.onDemand, null, 'no on-demand note while the schedule is on time');
});
