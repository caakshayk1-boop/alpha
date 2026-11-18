import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, icsText, reviewEvents, reviewIcs, icsName } from '../src/ics.ts';
import type { Entry } from '../src/store.ts';

const E = (id: string, sym: string, reviewOn: string | null, archived = false, thesis = 'SECRET thesis, with; punctuation'): Entry => ({ id, sym, created: '2026-11-01T00:00:00Z', archived, versions: [{ at: '2026-11-01T00:00:00Z', thesis, support: '', counter: '', decision: 'watch', invalidation: '', trigger: '', reviewOn }] } as unknown as Entry);
const entries = [E('b', 'INFY', '2026-12-01'), E('a', 'TCS', '2026-11-20'), E('c', 'OLD', '2026-11-01'), E('d', 'GONE', '2026-11-25', true), E('e', 'NODATE', null), E('f', 'TODAY', '2026-11-18')];

test('only active theses with a review date from today onward, soonest first', () => {
  assert.deepEqual(reviewEvents(entries, '2026-11-18').map((x) => x.sym), ['TODAY', 'TCS', 'INFY']);
});
test('the file is a valid VCALENDAR with CRLF lines, one all-day event each, DTEND the next day', () => {
  const { text, count } = reviewIcs(entries, '2026-11-18', Date.parse('2026-11-18T05:00:00Z')); assert.equal(count, 3);
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && text.endsWith('END:VCALENDAR\r\n') && !/[^\r]\n/.test(text), 'CRLF only');
  assert.equal((text.match(/BEGIN:VEVENT/g) ?? []).length, 3); assert.equal((text.match(/END:VEVENT/g) ?? []).length, 3);
  assert.ok(text.includes('DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261121') && text.includes('DTSTAMP:20261118T050000Z') && text.includes('UID:a-2026-11-20@tripwire.askakshay.com'));
  assert.ok(text.includes('DTSTART;VALUE=DATE:20261201\r\nDTEND;VALUE=DATE:20261202'), 'month end rolls over');
});
test("the person's own thesis text is never written into the file", () => {
  const { text } = reviewIcs(entries, '2026-11-18', 0); assert.ok(!/SECRET|punctuation/.test(text));
});
test('TEXT escaping and 75-octet folding (never inside a multi-byte character)', () => {
  assert.equal(icsText('a,b;c\\d\ne'), 'a\\,b\;c\\\\d\\ne');
  const long = 'X' + 'é'.repeat(80); const f = fold(long); const enc = new TextEncoder();
  for (const [i, l] of f.split('\r\n').entries()) assert.ok(enc.encode(i ? l.slice(1) : l).length <= (i ? 74 : 75) + 0 && !l.includes('�'), `line ${i}`);
  assert.equal(f.replace(/\r\n /g, ''), long, 'unfolding restores the line');
});
test('no dates, no events, and a dated file name', () => { assert.equal(reviewIcs([E('x', 'A', null)], '2026-11-18', 0).count, 0); assert.equal(icsName('2026-11-18'), 'tripwire-reviews-2026-11-18.ics'); });
