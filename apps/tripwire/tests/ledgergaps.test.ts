// 11 Nov 2026: the nights the ledger job never wrote down. Every instant here is fixed; nothing reads the live clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingNights, missingNightsNote, gapDate } from '../src/ledgergaps.ts';

const L = (...d: string[]) => ({ days: d.map((asOf) => ({ asOf })) });
const IST = (day: string, hhmm: string) => Date.parse(`${day}T${hhmm}:00+05:30`);
const REAL = L('2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-06', '2026-11-09');

test('the committed shape of Nov 2026: 4 and 5 Nov are missing; the Diwali holiday (10 Nov) and the Muhurat Sunday (8 Nov) are never expected', () => {
  assert.deepEqual(missingNights(REAL, IST('2026-11-11', '12:00')), ['2026-11-04', '2026-11-05']);
  assert.equal(missingNightsNote(missingNights(REAL, IST('2026-11-11', '12:00'))), '2 sessions not recorded: 4 Nov 2026, 5 Nov 2026');
});
test('the latest finished session is pending, not missing; it becomes missing once a later session has finished', () => {
  const l = L('2026-11-06', '2026-11-09');
  assert.deepEqual(missingNights(l, IST('2026-11-11', '17:00')), [], '11 Nov finished at 16:00 and can still be written tonight or tomorrow morning');
  assert.deepEqual(missingNights(l, IST('2026-11-12', '15:00')), [], 'before 12 Nov settles, 11 Nov is still the latest finished session');
  assert.deepEqual(missingNights(l, IST('2026-11-12', '16:30')), ['2026-11-11']);
});
test('nothing before the first recorded night is asked for; an empty or absent ledger has no gaps; one gap reads in the singular', () => {
  assert.deepEqual(missingNights(L('2026-11-06'), IST('2026-11-11', '12:00')), []);
  assert.deepEqual(missingNights(L(), IST('2026-11-11', '12:00')), []);
  assert.deepEqual(missingNights(null, IST('2026-11-11', '12:00')), []);
  assert.equal(missingNightsNote(['2026-11-04']), '1 session not recorded: 4 Nov 2026');
  assert.equal(missingNightsNote([]), null);
  assert.equal(gapDate('2026-01-02'), '2 Jan 2026');
});
