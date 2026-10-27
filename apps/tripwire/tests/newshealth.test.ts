// The one news health model: four states, three separate timestamps, Indian time, cached content never called live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newsHealth, newsServiceView, storyTime, isNewStory, allowedAgeMin, plural, type StatusDoc } from '../src/newshealth.ts';

const Z = (s: string) => Date.parse(s);
const doc = (o: Partial<StatusDoc> = {}): StatusDoc => ({ snapshotVersion: 7, status: 'ok', checkedAt: '2026-10-27T06:00:00.000Z', lastSuccessfulAt: '2026-10-27T06:00:00.000Z', nextScheduledAt: '2026-10-27T06:15:00.000Z', cadenceMin: 15, sourcesTotal: 4, sourcesFailed: 0, ...o });
const NOW = Z('2026-10-27T06:05:00Z');

test('fresh: a recent successful check says when it ran (IST) and when the next is due, and never says "live"', () => {
  const h = newsHealth({ doc: doc(), nowMs: NOW }); assert.equal(h.state, 'fresh'); assert.equal(h.tone, 'ok');
  assert.equal(h.line, 'Checked 11:30 IST · next check about 11:45 IST'); assert.equal(h.checked, '11:30 IST'); assert.equal(h.lastGood, '11:30 IST'); assert.equal(h.next, '11:45 IST');
  assert.ok(!/live/i.test(h.line)); assert.equal(newsServiceView(h).tag, 'Fresh');
});
test('delayed: the allowance is two cadences plus ten minutes of the session the check ran in', () => {
  assert.equal(allowedAgeMin(Z('2026-10-27T06:00:00Z')), 40); assert.equal(allowedAgeMin(Z('2026-10-27T12:00:00Z')), 70);
  assert.equal(newsHealth({ doc: doc(), nowMs: Z('2026-10-27T06:39:00Z') }).state, 'fresh'); const d = newsHealth({ doc: doc(), nowMs: Z('2026-10-27T06:41:00Z') });
  assert.equal(d.state, 'delayed'); assert.match(d.line, /^News delayed - last successful check 11:30 IST/); assert.equal(d.reason, 'older than the schedule allows');
  const night = doc({ checkedAt: '2026-10-27T12:00:00.000Z', lastSuccessfulAt: '2026-10-27T12:00:00.000Z' }); assert.equal(newsHealth({ doc: night, nowMs: Z('2026-10-27T13:09:00Z') }).state, 'fresh'); assert.equal(newsHealth({ doc: night, nowMs: Z('2026-10-27T13:11:00Z') }).state, 'delayed');
});
test('delayed: a failed latest check keeps the last good time and says the stories shown are the last good ones - even minutes after the failure', () => {
  const d = newsHealth({ doc: doc({ status: 'failed', checkedAt: '2026-10-27T06:20:00.000Z', lastError: 'HTTP 503' }), nowMs: Z('2026-10-27T06:21:00Z') });
  assert.equal(d.state, 'delayed'); assert.match(d.line, /last successful check 11:30 IST\. The latest check failed \(HTTP 503\); the last good stories are shown/); assert.equal(d.checked, '11:50 IST'); assert.equal(d.lastGood, '11:30 IST'); assert.equal(d.tone, 'warn');
});
test('delayed: the service could not be reached just now, with a remembered document: cached stories are readable and labelled, not live', () => {
  const d = newsHealth({ doc: null, unreachable: true, remembered: doc(), nowMs: NOW }); assert.equal(d.state, 'delayed'); assert.match(d.line, /^News delayed - last successful check 11:30 IST\. The news service did not answer just now/);
});
test('partial: some sources down is labelled partial with the count, pluralised; too old still reads delayed', () => {
  const p = newsHealth({ doc: doc({ status: 'partial', sourcesFailed: 1 }), nowMs: NOW }); assert.equal(p.state, 'partial'); assert.match(p.line, /^Partial coverage: 1 source of 4 not answering\. Last successful check 11:30 IST\./);
  assert.match(newsHealth({ doc: doc({ status: 'partial', sourcesFailed: 2 }), nowMs: NOW }).line, /2 sources of 4/); assert.equal(newsHealth({ doc: doc({ status: 'partial', sourcesFailed: 2 }), nowMs: Z('2026-10-27T08:00:00Z') }).state, 'delayed');
});
test('unavailable: nothing was ever read, or no check ever succeeded', () => {
  assert.equal(newsHealth({ doc: null, nowMs: NOW }).state, 'unavailable'); assert.equal(newsHealth({ doc: null, unreachable: true, nowMs: NOW }).state, 'unavailable'); assert.equal(newsHealth({ doc: doc({ lastSuccessfulAt: null, status: 'failed' }), nowMs: NOW }).state, 'unavailable');
  assert.equal(newsHealth({ doc: null, nowMs: NOW }).tone, 'bad'); assert.equal(newsServiceView(newsHealth({ doc: null, nowMs: NOW })).tone, 'peach');
});
test('a check time in the future is not trusted: delayed, not fresh', () => { const h = newsHealth({ doc: doc({ lastSuccessfulAt: '2026-10-27T09:00:00.000Z' }), nowMs: NOW }); assert.equal(h.state, 'delayed'); assert.equal(h.reason, 'future check time'); });
test('times are Indian time with the zone, and another day carries its date', () => {
  const h = newsHealth({ doc: doc({ lastSuccessfulAt: '2026-10-25T10:00:00.000Z', checkedAt: '2026-10-25T10:00:00.000Z', nextScheduledAt: null }), nowMs: NOW }); assert.equal(h.lastGood, 'Sun 25 Oct 15:30 IST'); assert.match(h.line, /Sun 25 Oct 15:30 IST/);
});
test('story time: missing, unreadable or future is "time unknown" and never "just now"', () => {
  assert.equal(storyTime(null, NOW).ageWord, 'time unknown'); assert.equal(storyTime('garbage', NOW).known, false); assert.equal(storyTime('2026-10-28T06:00:00Z', NOW).ageWord, 'time unknown'); assert.equal(storyTime(undefined, NOW).ist, 'publication time unknown');
  assert.deepEqual(storyTime('2026-10-27T04:00:00Z', NOW), { known: true, ageWord: '2 h ago', ist: 'published 09:30 IST' }); assert.equal(storyTime('2026-10-25T04:00:00Z', NOW).ageWord, '2 d ago'); assert.equal(storyTime('2026-10-27T06:04:30Z', NOW).ageWord, 'just now');
  assert.equal(storyTime('2026-10-27T05:30:00Z', NOW).ageWord, '35 min ago');
});
test('"New": published after the last visit AND first seen after it; an old event fetched again, an unknown date, or no last visit is never new', () => {
  const visit = Z('2026-10-27T05:00:00Z') / 1000;
  assert.equal(isNewStory({ publishedAt: '2026-10-27T05:30:00Z', firstSeenAt: '2026-10-27T05:35:00Z' }, visit), true);
  assert.equal(isNewStory({ publishedAt: '2026-10-25T05:30:00Z', firstSeenAt: '2026-10-27T05:35:00Z' }, visit), false, 'an old event fetched again');
  assert.equal(isNewStory({ publishedAt: '2026-10-27T05:30:00Z', firstSeenAt: '2026-10-27T04:00:00Z' }, visit), false, 'already known at the last visit');
  assert.equal(isNewStory({ publishedAt: null, firstSeenAt: '2026-10-27T05:35:00Z' }, visit), false); assert.equal(isNewStory({ publishedAt: '2026-10-27T05:30:00Z', firstSeenAt: '2026-10-27T05:35:00Z' }, 0), false);
});
test('plural', () => { assert.equal(plural(1, 'update'), '1 update'); assert.equal(plural(3, 'update'), '3 updates'); assert.equal(plural(0, 'source'), '0 sources'); });
