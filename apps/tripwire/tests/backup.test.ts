// Backup, restore and the journal: what a person writes must survive an export, an import on a new device, a merge, and a bad file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, addEntry, editEntry, current, savePlan, saveCompare, saveScreen, recordSnap, exportJson, parseState, mergeStates, journalCsv, readSaved, takePaper, type State } from '../src/store.ts';
import { NO_FILTER } from '../src/screen.ts';

const at = (d: string) => new Date(d + 'T10:00:00Z');
function rich(): State {
  let s: State = { ...DEFAULTS, onboarded: true, follows: ['TCS', 'GCSL'], prefs: { ...DEFAULTS.prefs, equity: 2500000, cash: 900000, riskPct: 1, theme: 'ocean', hideAmounts: true, interests: ['Technology'] }, reviews: [{ week: '2026-W43', note: 'Held off buying; waiting for results' }] };
  const a = addEntry(s, 'TCS', { thesis: 'Steady compounder', support: 'ROCE 60%', counter: 'Slow growth', decision: 'watch', invalidation: 'Close below 2,400', trigger: 'Results', reviewOn: '2026-11-05' }, at('2026-10-01')); s = a.s;
  s = editEntry(s, a.id, { thesis: 'Steady compounder, but pricey', support: 'ROCE 60%', counter: 'Slow growth; PE 27', decision: 'watch', invalidation: 'Close below 2,400', trigger: 'Results', reviewOn: '2026-11-12' }, at('2026-10-10'));
  s = editEntry(s, a.id, { thesis: 'Steady compounder, but pricey', support: 'ROCE 60%', counter: 'Slow growth; PE 27', decision: 'plan', invalidation: 'Close below 2,350', trigger: 'Results', reviewOn: '2026-11-12' }, at('2026-10-20'));
  s = savePlan(s, { sym: 'TCS', entry: 2530, stop: 2400, qty: 38, riskPct: 0.5, expiry: null, note: 'after results' }, at('2026-10-21'));
  s = saveCompare(s, ['TCS', 'INFY']); s = saveScreen(s, 'Quality, cheap', { ...NO_FILTER, quality: 'high', value: 'cheap' });
  s = recordSnap(s, 'TCS', { day: '2026-10-23', px: 2530, rsi: 55, rs3m: 3, from_high: -20 }, at('2026-10-23'));
  s = takePaper(s, { sym: 'GCSL', engine: 'MOM', asOf: '2026-10-23', ref: 726.2, stop: 675.37, horizon: 20, qty: 100 }, 1792000000).s;
  return s;
}
test('backup: an export read back is exactly what was saved, and the file\'s own wrapper does not leak into the saved state', () => {
  const s = rich(); const back = parseState(exportJson(s))!;
  assert.deepEqual(back, s); assert.ok(!('app' in back) && !('exported' in back));
  assert.equal(back.entries[0].versions.length, 3, 'every version of the journal survives'); assert.equal(current(back.entries[0]).invalidation, 'Close below 2,350');
  assert.equal(back.entries[0].versions[0].thesis, 'Steady compounder', 'the first version is still the first version');
});
test('restore: a fresh device that imports a backup gets everything, including preferences, reviews and the since-you-last-looked history', () => {
  const s = rich(); const fresh: State = { ...DEFAULTS, onboarded: true };
  const m = mergeStates(fresh, parseState(exportJson(s))!);
  assert.deepEqual(m.entries, s.entries); assert.deepEqual(m.plans, s.plans); assert.deepEqual(m.paper, s.paper); assert.deepEqual(m.reviews, s.reviews); assert.deepEqual(m.snaps, s.snaps);
  assert.deepEqual(m.compares, s.compares); assert.deepEqual(m.screens, s.screens); assert.deepEqual(m.follows.sort(), [...s.follows].sort()); assert.equal(m.prefs.equity, 2500000); assert.equal(m.prefs.theme, 'ocean');
});
test('merge: a device that already has its own notes keeps them, adds the backup\'s, and its own preferences', () => {
  const a: State = { ...DEFAULTS, onboarded: true, prefs: { ...DEFAULTS.prefs, equity: 500000, haptics: false }, follows: ['INFY'], reviews: [{ week: '2026-W43', note: 'short' }] };
  const e = addEntry(a, 'INFY', { thesis: 'IT bellwether', support: '', counter: '', decision: '', invalidation: 'x', trigger: '', reviewOn: null }, at('2026-10-15')); const dev = e.s;
  const m = mergeStates(dev, rich());
  assert.equal(m.entries.length, 2); assert.equal(m.prefs.equity, 500000, 'a customised device keeps its own preferences'); assert.deepEqual(m.follows.sort(), ['GCSL', 'INFY', 'TCS']);
  assert.equal(m.reviews.length, 1); assert.match(m.reviews[0].note, /waiting for results/, 'the longer note for the same week wins');
});
test('merge: the longer edit history wins, nothing is duplicated, and importing the same backup twice changes nothing', () => {
  const s = rich(); const older = { ...s, entries: s.entries.map((e) => ({ ...e, versions: e.versions.slice(0, 1) })) };
  assert.equal(mergeStates(older, s).entries[0].versions.length, 3); assert.equal(mergeStates(s, older).entries[0].versions.length, 3);
  const once = mergeStates(s, s); assert.deepEqual(once, s); assert.deepEqual(mergeStates(once, s), s);
});
test('journal: the CSV carries every version of every thesis, in order, with its review date', () => {
  const csv = journalCsv(rich()).split('\n'); assert.equal(csv.length, 1 + 3); assert.match(csv[0], /^symbol,version,recorded/); assert.match(csv[1], /^TCS,1,/); assert.match(csv[3], /^TCS,3,.*2026-11-12/);
});
test('a file that is not ours, or from a newer version, is refused whole and nothing is half-merged', () => {
  for (const bad of ['nope', '{}', '{"v":2,"follows":[],"entries":[],"plans":[]}', '{"v":1,"follows":1,"entries":[],"plans":[]}', '[]', 'null']) assert.equal(parseState(bad), null, bad);
});
test('saved data on the device: nothing is "no data yet"; something unreadable is flagged so a copy can be kept before anything is written over it', () => {
  assert.deepEqual(readSaved(null), { state: DEFAULTS, unreadable: false }); assert.equal(readSaved('').unreadable, false);
  assert.equal(readSaved('{"v":7}').unreadable, true); assert.equal(readSaved('garbage{').unreadable, true); assert.equal(readSaved(JSON.stringify(rich())).unreadable, false);
});
