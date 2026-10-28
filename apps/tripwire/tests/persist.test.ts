// Failed saves, unreadable data, blocked storage and damaged backups, offline: the storage is passed in, so every failure can be made to happen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, addEntry, checkBackup, exportJson, parseState, savePlan, takePaper, mergeStates, type State } from '../src/store.ts';
import { classifySaveError, keepUnreadable, loadState, readUnreadable, saveState, shouldAdoptStorageEvent, storageWorks } from '../src/persist.ts';

const KEY = 'tripwire:v1';
const mem = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
const quota = () => Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError', code: 22 });
function rich(): State {
  let s: State = { ...DEFAULTS, onboarded: true, follows: ['TCS'], prefs: { ...DEFAULTS.prefs, equity: 2e6, interests: ['Energy'] } };
  s = addEntry(s, 'TCS', { thesis: 'a', support: 'b', counter: 'c', decision: 'watch', invalidation: 'Close below 2400', trigger: '', reviewOn: '2026-11-30' }, new Date('2026-10-20T10:00:00Z')).s;
  s = savePlan(s, { sym: 'TCS', entry: 2530, stop: 2400, qty: 38, riskPct: 0.5, expiry: null, note: '' }, new Date('2026-10-21T10:00:00Z'));
  return takePaper(s, { sym: 'GCSL', engine: 'MOM', asOf: '2026-10-23', ref: 726.2, stop: 675.37, horizon: 20, qty: 100 }, 1792000000).s;
}

test('a failed save says why (full, blocked, other); the caller still holds its state; the next good save succeeds', () => {
  const full = { setItem: () => { throw quota(); } }; const r = saveState(full as never, KEY, rich()); assert.deepEqual(r, { ok: false, why: 'full' });
  assert.deepEqual(saveState({ setItem: () => { throw Object.assign(new Error('denied'), { name: 'SecurityError' }); } } as never, KEY, rich()), { ok: false, why: 'blocked' });
  assert.deepEqual(saveState({ setItem: () => { throw new Error('boom'); } } as never, KEY, rich()), { ok: false, why: 'other' });
  assert.deepEqual(saveState(null, KEY, rich()), { ok: false, why: 'blocked' }, 'no storage object at all');
  const ok = mem(); assert.deepEqual(saveState(ok as never, KEY, rich()), { ok: true }); assert.equal(parseState(ok.m.get(KEY)!)!.entries.length, 1);
  assert.equal(classifySaveError({ name: 'NS_ERROR_DOM_QUOTA_REACHED', code: 1014 }), 'full');
});
test('a failed save never touches what was saved before: the old copy is still readable', () => {
  const store = mem(); saveState(store as never, KEY, rich()); const before = store.m.get(KEY);
  const failing = { getItem: store.getItem, setItem: () => { throw quota(); } }; saveState(failing as never, KEY, { ...rich(), follows: ['TCS', 'INFY'] });
  assert.equal(store.m.get(KEY), before); assert.deepEqual(loadState(store as never, KEY).state.follows, ['TCS']);
});
test('restart: what was saved is exactly what a fresh load reads, including every journal version, plans, paper trades and preferences', () => {
  const s = rich(); const store = mem(); saveState(store as never, KEY, s); const back = loadState(store as never, KEY);
  assert.equal(back.unreadable, false); assert.equal(back.blocked, false); assert.deepEqual(back.state, s);
});
test('unreadable saved data: flagged, a copy is kept before anything is written, an earlier copy is not lost to a later one, and the copy can be read back', () => {
  const store = mem({ [KEY]: '{"v":1,"follows":[' }); const l = loadState(store as never, KEY); assert.equal(l.unreadable, true); assert.deepEqual(l.state, DEFAULTS);
  assert.equal(readUnreadable(store as never, KEY), '{"v":1,"follows":['); saveState(store as never, KEY, rich());           // writing over it is now safe
  store.setItem(KEY, 'garbage 2'); loadState(store as never, KEY); assert.equal(readUnreadable(store as never, KEY), 'garbage 2'); assert.equal(store.m.get(`${KEY}:unreadable:earlier`), '{"v":1,"follows":[');
  assert.equal(keepUnreadable({ getItem: () => null, setItem: () => { throw quota(); } } as never, KEY, 'x'), false, 'if even the copy cannot be kept, the caller is told');
  assert.equal(loadState(mem({ [KEY]: '{"v":9}' }) as never, KEY).unreadable, true, 'data from a newer version is kept, not overwritten');
});
test('blocked storage: reading throws, the state is not replaced by defaults silently (blocked is reported), and the probe says the browser does not save', () => {
  const dead = { getItem: () => { throw Object.assign(new Error('x'), { name: 'SecurityError' }); }, setItem: () => { throw quota(); } };
  const l = loadState(dead as never, KEY); assert.equal(l.blocked, true); assert.equal(l.unreadable, false); assert.equal(storageWorks(dead as never), false); assert.equal(storageWorks(null), false); assert.equal(storageWorks(mem() as never), true);
  const store = mem(); storageWorks(store as never); assert.equal(store.m.size, 0, 'the probe leaves nothing behind');
});
test('another tab\'s change: adopted for this key or a clear, ignored for other keys, and never while this tab holds unsaved changes', () => {
  assert.equal(shouldAdoptStorageEvent({ key: KEY }, KEY, true), true); assert.equal(shouldAdoptStorageEvent({ key: null }, KEY, true), true);
  assert.equal(shouldAdoptStorageEvent({ key: 'tripwire:newsSeen' }, KEY, true), false); assert.equal(shouldAdoptStorageEvent({ key: KEY }, KEY, false), false);
});

/* ---- a damaged backup is refused whole, with the reason, and the import changes nothing ---- */
const good = () => JSON.parse(exportJson(rich()));
const refuse = (o: unknown) => { const c = checkBackup(typeof o === 'string' ? o : JSON.stringify(o)); assert.equal(c.ok, false, JSON.stringify(o).slice(0, 80)); return (c as { reason: string }).reason; };
test('backup: a wrong or corrupt file is refused with a reason that says what is wrong', () => {
  assert.match(refuse('not json at all {'), /not a JSON file/); assert.match(refuse('[]'), /does not hold a saved state/); assert.match(refuse('null'), /does not hold a saved state/);
  assert.match(refuse({ app: 'other', v: 1 }), /from another app/); assert.match(refuse({ follows: [], entries: [], plans: [] }), /no Tripwire version number/);
  assert.match(refuse({ ...good(), v: 2 }), /version 2 of Tripwire; this one reads version 1/);
  assert.match(refuse({ ...good(), entries: 'x' }), /journal section is missing or damaged/); assert.match(refuse({ ...good(), plans: undefined }), /plans section is missing/); assert.match(refuse({ ...good(), follows: [1, 2] }), /followed names are damaged/);
});
test('backup: the right outline with a damaged piece inside is refused (it used to be accepted and then crash the screens)', () => {
  const g = good();
  assert.match(refuse({ ...g, entries: [1, 2] }), /Journal entry 1 is damaged/); assert.match(refuse({ ...g, entries: [{ ...g.entries[0], versions: [] }] }), /Journal entry 1 is damaged/);
  assert.match(refuse({ ...g, entries: [{ ...g.entries[0], versions: [{ at: 'x', thesis: 5 }] }] }), /Journal entry 1 is damaged/); assert.match(refuse({ ...g, entries: [{ id: 'a', versions: [] }] }), /Journal entry 1/);
  assert.match(refuse({ ...g, plans: [{ id: 'p', sym: 'TCS' }] }), /Plan 1 is damaged/); assert.match(refuse({ ...g, paper: [{ id: 'p', sym: 'X', ref: 'a' }] }), /Paper trade 1 is damaged/); assert.match(refuse({ ...g, paper: {} }), /paper trades section is damaged/);
});
test('backup: a refused file changes nothing (the check is pure) and an old backup that lacks the newer fields still imports and loads', () => {
  const s = rich(); const before = JSON.stringify(s); refuse('garbage'); assert.equal(JSON.stringify(s), before);
  const old = good(); delete old.seen; delete old.inbox; delete old.dismissed; delete old.paper; old.entries[0].versions.forEach((v: Record<string, unknown>) => { delete v.question; delete v.trigger; });
  const c = checkBackup(JSON.stringify(old)); assert.equal(c.ok, true); const st = (c as { state: State }).state; assert.deepEqual(st.paper, []); assert.equal(st.entries[0].versions[0].trigger, '', 'a field an older writer left out is empty, not damage'); assert.deepEqual(st.seen, {});
});
test('backup: bad preferences are repaired to defaults rather than losing the whole backup; unknown fields are not carried along; nothing the app stores is dropped', () => {
  const g = good(); g.prefs = { ...g.prefs, equity: 'lots', interests: 'Energy', motion: 'wild', haptics: 'yes', theme: 4 }; g.extra = { evil: true };
  const c = checkBackup(JSON.stringify(g)); assert.equal(c.ok, true); const p = (c as { state: State }).state.prefs;
  assert.equal(p.equity, DEFAULTS.prefs.equity); assert.deepEqual(p.interests, []); assert.equal(p.motion, DEFAULTS.prefs.motion); assert.equal(p.haptics, DEFAULTS.prefs.haptics); assert.ok(!('theme' in p)); assert.ok(!('extra' in (c as { state: object }).state));
  const s = rich(); const r = checkBackup(exportJson(s)) as { ok: true; state: State }; assert.deepEqual(r.state, s, 'a good export reads back identical, field for field');
});
test('restore onto a clean profile gives back follows, journal versions, plans, paper trades and preferences; importing twice changes nothing more', () => {
  const s = rich(); const clean: State = { ...DEFAULTS, onboarded: true }; const c = checkBackup(exportJson(s)) as { ok: true; state: State };
  const once = mergeStates(clean, c.state); assert.deepEqual(once.follows, s.follows); assert.deepEqual(once.entries, s.entries); assert.deepEqual(once.plans, s.plans); assert.deepEqual(once.paper, s.paper); assert.equal(once.prefs.equity, 2e6); assert.deepEqual(once.prefs.interests, ['Energy']);
  assert.deepEqual(mergeStates(once, c.state), once);
});
