// New versus returning: Today and My Desk are derived from stored data only. Pure, offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewUser, deskHas } from '../src/home.ts';
import { DEFAULTS, addEntry, toggleFollow, savePlan, takePaper, saveCompare, parseState, mergeStates, exportJson, readSaved, type State } from '../src/store.ts';

const fresh: State = { ...DEFAULTS, onboarded: true };
const thought = (s: State) => addEntry(s, 'TCS', { thesis: 'x', support: '', counter: '', decision: '', invalidation: '', trigger: '', reviewOn: null }).s;
const snapOf = { at: '2026-10-20T00:00:00Z', day: '2026-10-20', px: 1, rsi: 50, rs3m: 0, from_high: -5, atr_pct: 2, sma200: 1, high52: 2, low52: 1, trend: 'up', rules: 4, next_earnings: null, risk: 'LOW', elig: 'full' } as never;

test('a fresh profile, onboarded or not, is new', () => {
  assert.equal(isNewUser(DEFAULTS), true);
  assert.equal(isNewUser(fresh), true);
});
test('each kind of stored data makes a person returning', () => {
  assert.equal(isNewUser(toggleFollow(fresh, 'TCS')), false, 'a follow');
  assert.equal(isNewUser(thought(fresh)), false, 'a thought (journal entry)');
  assert.equal(isNewUser(savePlan(fresh, { sym: 'TCS', entry: 100, stop: 90, qty: 1, riskPct: 0.5, expiry: null, note: '' })), false, 'a plan');
  assert.equal(isNewUser(takePaper(fresh, { sym: 'TCS', engine: 'MOM', asOf: '2026-10-23', ref: 1, stop: 1, horizon: 20, qty: 1 } as never).s), false, 'a paper trade');
  assert.equal(isNewUser(saveCompare(fresh, ['TCS', 'INFY'])), false, 'a saved comparison');
  assert.equal(isNewUser({ ...fresh, screens: [{ name: 'a', f: {} as never }] }), false, 'a saved screen');
  assert.equal(isNewUser({ ...fresh, reviews: [{ week: '2026-W43', note: 'n' }] }), false, 'a weekly review');
  assert.equal(isNewUser({ ...fresh, dismissed: { 'TCS:rsi': '2026-10-21T00:00:00Z' } }), false, 'a dismissed change');
  assert.equal(isNewUser({ ...fresh, seen: { TCS: [snapOf] } }), false, 'a seen snapshot');
  assert.equal(isNewUser({ ...fresh, inbox: [{ id: 'a' } as never] }), false, 'a surfaced change');
  assert.equal(isNewUser({ ...fresh, snaps: { TCS: [{ at: 'x', day: 'd', px: 1, rsi: 1, rs3m: 1, from_high: 1 }] } }), false, 'an old price snapshot');
});
test('empty containers do not count: an unfollowed name leaves nothing behind', () => {
  assert.equal(isNewUser(toggleFollow(toggleFollow(fresh, 'TCS'), 'TCS')), true);
  assert.equal(isNewUser({ ...fresh, seen: { TCS: [] }, snaps: { TCS: [] }, dismissed: {}, inbox: [] }), true);
});
test('states saved before these fields existed still classify, and a restored backup is returning', () => {
  const old = { ...fresh } as Partial<State>; delete old.seen; delete old.inbox; delete old.dismissed; delete old.paper; delete old.storageNote;
  assert.equal(isNewUser(old as State), true);
  const back = parseState(exportJson(toggleFollow(fresh, 'TCS')))!; assert.equal(isNewUser(back), false);
  assert.equal(isNewUser(readSaved(null).state), true);
});
test('storageNote is additive: kept by import and merge, never invented', () => {
  assert.equal(parseState(exportJson(fresh))!.storageNote, undefined);
  const s = { ...fresh, storageNote: true };
  assert.equal(parseState(exportJson(s))!.storageNote, true);
  assert.equal(mergeStates(fresh, s).storageNote, true);
  assert.equal(mergeStates(s, fresh).storageNote, true);
  assert.equal('storageNote' in mergeStates(fresh, fresh), false);
});
test('My Desk offers a view only when it holds something', () => {
  assert.deepEqual(deskHas(fresh), { follow: false, journal: false, plans: false, saved: false, any: false });
  assert.equal(deskHas(thought(fresh)).journal, true);
  assert.equal(deskHas(toggleFollow(fresh, 'TCS')).follow, true);
  assert.equal(deskHas(saveCompare(fresh, ['A', 'B'])).saved, true);
  assert.equal(deskHas(savePlan(fresh, { sym: 'T', entry: 1, stop: 1, qty: 1, riskPct: 1, expiry: null, note: '' })).plans, true);
  const archived = thought(fresh); archived.entries[0].archived = true; assert.equal(deskHas(archived).journal, true, 'an archived thought is still in the journal');
});
