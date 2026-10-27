// Since your last visit: thresholds, first visit, no fabrication, dismissal, the thesis rule, persistence, and the market brief's wording.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THRESHOLDS, detect, parseLevel, snapOf, surface, recordSeen, lastSeen, dismissChange, restoreChange, type SeenSnap } from '../src/sincevisit.ts';
import { briefLines, FORBIDDEN } from '../src/brief.ts';
import { DEFAULTS, addEntry, exportJson, parseState, mergeStates, readSaved, current, editEntry, type State } from '../src/store.ts';
import type { Row } from '../src/screen.ts';

const T0 = '2026-10-20T10:00:00.000Z', T1 = '2026-10-27T10:00:00.000Z';
const snap = (o: Partial<SeenSnap> = {}): SeenSnap => ({ at: T0, day: '2026-10-20', px: 100, rsi: 50, rs3m: 2, from_high: -10, atr_pct: 2, sma200: 90, high52: 112, low52: 70, trend: 'up', rules: 4, next_earnings: null, risk: 'LOW', elig: 'full', ...o });
const kinds = (p: Partial<SeenSnap>, q: Partial<SeenSnap>, today = '2026-10-27') => detect({ sym: 'X', prev: snap(p), cur: snap({ at: T1, day: '2026-10-23', ...q }), today }).map((c) => c.kind);
const row = (o: Partial<Row> = {}): Row => ({ sym: 'TCS', name: 'TCS', sector: 'Technology', tier: 'large', price: 110, sma20: 105, sma50: 100, sma200: 90, r3m: 5, rsi: 55, rs3m: 2, from_high: -3, high52: 113, low52: 70, atr_pct: 2, risk_lvl: 'LOW', ...o } as Row);
const st = (o: Partial<State> = {}): State => ({ ...DEFAULTS, follows: ['TCS'], ...o });

test('nothing changed, no items: an ordinary move is not an event', () => {
  assert.deepEqual(kinds({}, {}), []);
  assert.deepEqual(kinds({}, { px: 103, rsi: 54 }), [], '3% on a 2% ATR name is under the 2x ATR threshold');
});
test('each threshold fires on its own and only on its own', () => {
  assert.deepEqual(kinds({}, { trend: 'mixed' }), ['trend']);
  assert.deepEqual(kinds({ px: 91, sma200: 90 }, { px: 89, sma200: 90 }), ['sma200']);
  assert.deepEqual(kinds({ px: 95 }, { px: 96, sma200: 90 }), []);
  assert.ok(kinds({ px: 91, sma200: 90 }, { px: 89, sma200: 90 }).includes('sma200'), 'crossing the 200-day down');
  assert.ok(kinds({ px: 89, sma200: 90 }, { px: 91, sma200: 90 }).includes('sma200'), 'crossing the 200-day up');
  assert.deepEqual(kinds({ px: 100, high52: 112 }, { px: 112, high52: 112 }).filter((k) => k === 'high52'), ['high52']);
  assert.deepEqual(kinds({ px: 112, high52: 112 }, { px: 112, high52: 112 }).filter((k) => k === 'high52'), [], 'already at the high before: not new');
  assert.deepEqual(kinds({ px: 80, low52: 70 }, { px: 70, low52: 70 }).filter((k) => k === 'low52'), ['low52']);
  assert.deepEqual(kinds({ rsi: 65 }, { rsi: 71 }), ['rsi']); assert.deepEqual(kinds({ rsi: 35 }, { rsi: 29 }), ['rsi']);
  assert.deepEqual(kinds({ rsi: 75 }, { rsi: 69 }), ['rsi']); assert.deepEqual(kinds({ rsi: 28 }, { rsi: 33 }), ['rsi']);
  assert.deepEqual(kinds({ rsi: 40 }, { rsi: 60 }), [], 'a big RSI move that crosses neither line');
  assert.deepEqual(kinds({ risk: 'LOW' }, { risk: 'HIGH' }), ['risk']);
  assert.deepEqual(kinds({ elig: 'full' }, { elig: 'financial sector' }), ['elig']);
  assert.deepEqual(kinds({ px: 100 }, { px: 105, atr_pct: 2 }), ['move'], '5% is beyond 2 x 2%');
  assert.deepEqual(kinds({ px: 100 }, { px: 105, atr_pct: null }), [], 'no ATR, no move rule: it is withheld rather than guessed');
});
test('results inside 7 days are surfaced once, not every visit', () => {
  assert.deepEqual(kinds({ next_earnings: '2026-11-20' }, { next_earnings: '2026-11-02' }), ['results']);
  assert.deepEqual(kinds({ next_earnings: '2026-11-02', day: '2026-10-28' }, { next_earnings: '2026-11-02' }, '2026-10-29'), [], 'it was already inside the window at the last snapshot');
  assert.deepEqual(kinds({ next_earnings: '2026-11-20' }, { next_earnings: '2026-11-20' }), [], 'far away');
  assert.deepEqual(kinds({}, { next_earnings: '2026-10-20' }), [], 'a past date is not upcoming');
});
test('missing figures never produce a change', () => {
  assert.deepEqual(kinds({ rsi: null, px: null, sma200: null, trend: null, risk: null, elig: null }, { rsi: 80, px: 50, low52: null, trend: 'down', risk: 'HIGH', elig: 'financial sector' }).filter((k) => !['elig'].includes(k)), []);
});

test('thesis rule: only a stated price level in the invalidation text links a change to the thesis', () => {
  assert.deepEqual(parseLevel('Close below 2,400'), { dir: 'below', level: 2400, shown: '2,400' });
  assert.equal(parseLevel('Falls under ₹ 675.5')!.level, 675.5); assert.equal(parseLevel('Weak results again'), null); assert.equal(parseLevel('Close below the 200-day'), null);
  assert.equal(parseLevel('Above 3100')!.dir, 'above');
  let s = st(); const a = addEntry(s, 'TCS', { thesis: 't', support: '', counter: '', decision: '', invalidation: 'Close below 2,400', trigger: '', reviewOn: null }); s = a.s;
  const e = s.entries[0];
  const ch = detect({ sym: 'TCS', prev: snap({ px: 2450 }), cur: snap({ at: T1, day: '2026-10-23', px: 2390 }), entry: e, today: '2026-10-27' });
  const inv = ch.find((c) => c.kind === 'invalidation')!;
  assert.ok(inv); assert.equal(inv.framing, 'crossed your stated invalidation level 2,400'); assert.equal(inv.entryId, e.id); assert.match(inv.basis, /Close below 2,400/);
  assert.ok(ch.filter((c) => c.kind !== 'invalidation').every((c) => c.framing === 'New information to review'), 'everything else is neutral');
  assert.equal(detect({ sym: 'TCS', prev: snap({ px: 2390 }), cur: snap({ at: T1, day: '2026-10-23', px: 2380 }), entry: e, today: '2026-10-27' }).some((c) => c.kind === 'invalidation'), false, 'already below before: not a crossing');
  const arch = { ...e, archived: true };
  assert.equal(detect({ sym: 'TCS', prev: snap({ px: 2450 }), cur: snap({ at: T1, day: '2026-10-23', px: 2390 }), entry: arch, today: '2026-10-27' }).some((c) => c.kind === 'invalidation'), false, 'an archived thesis is not read');
  const lv = detect({ sym: 'TCS', prev: snap({ px: 2450 }), cur: snap({ at: T1, day: '2026-10-23', px: 2450 }), entry: e, live: 2395, today: '2026-10-27' }).find((c) => c.kind === 'invalidation')!;
  assert.match(lv.after, /live price/, 'a live print is used for this one rule and labelled live');
  assert.equal(detect({ sym: 'TCS', prev: snap({ px: 2450 }), cur: snap({ at: T1, day: '2026-10-23', px: 2450 }), entry: e, live: 212, today: '2026-10-27' }).some((c) => c.kind === 'invalidation'), false, 'a print 90% off the close is a bad tick, not a crossing');
  assert.ok(!JSON.stringify(ch).includes(current(e).thesis + 'x'));
});

test('first visit: nothing is compared, nothing is invented, and the names are listed as starting', () => {
  const s = st({ follows: ['TCS', 'INFY'] });
  const r = surface(s, lastSeen(s), [row()], '2026-10-23', '2026-10-27', T1);
  assert.equal(r.first, true); assert.deepEqual(r.fresh, []); assert.deepEqual(r.starting, ['TCS']);   // INFY is not in the rows: not listed as tracked either
  assert.equal(surface(st({ follows: [] }), {}, [row()], '2026-10-23', '2026-10-27', T1).first, true);
  assert.equal(surface(s, {}, [row()], null, '2026-10-27', T1).first, true, 'no screen, nothing to say');
});
test('recording happens only through recordSeen, is idempotent, and is bounded at five per name', () => {
  let s = st(); const rows = [row()];
  s = recordSeen(s, rows, '2026-10-20', [], T0, '2026-10-20'); assert.equal(s.seen!.TCS.length, 1);
  assert.equal(recordSeen(s, rows, '2026-10-20', [], T1, '2026-10-20'), s, 'the same data adds nothing, not even a new object');
  for (let i = 0; i < 9; i++) s = recordSeen(s, [row({ price: 100 + i })], `2026-10-2${i}`, [], T1, '2026-10-27');
  assert.equal(s.seen!.TCS.length, THRESHOLDS.history);
  assert.equal(lastSeen(s).TCS!.px, 108);
});
test('a second visit compares with the first, shows the changes, and then they are in the inbox for later visits', () => {
  let s = st(); s = recordSeen(s, [row({ price: 100, rsi: 65, sma200: 90 })], '2026-10-20', [], T0, '2026-10-20');
  const base = lastSeen(s); const now = [row({ price: 112, rsi: 72, high52: 112 })];
  const r = surface(s, base, now, '2026-10-23', '2026-10-27', T1);
  assert.equal(r.first, false); assert.equal(r.compared, 1); assert.equal(r.dayFrom, '2026-10-20'); assert.equal(r.dayTo, '2026-10-23');
  const ks = r.fresh.map((c) => c.kind); assert.ok(ks.includes('rsi') && ks.includes('high52') && ks.includes('move'));
  const c = r.fresh.find((x) => x.kind === 'rsi')!; assert.equal(c.before, 'RSI 65'); assert.equal(c.after, 'RSI 72'); assert.equal(c.prevDay, '2026-10-20'); assert.equal(c.curDay, '2026-10-23'); assert.match(c.basis, /Screen data/);
  s = recordSeen(s, now, '2026-10-23', r.fresh, T1, '2026-10-27');
  const r2 = surface(s, lastSeen(s), now, '2026-10-23', '2026-10-27', T1);
  assert.deepEqual(r2.fresh, [], 'seen: not new any more'); assert.equal(r2.earlier.length, r.fresh.length, 'but kept until acknowledged');
  const r3 = surface(s, lastSeen(s), now, '2026-10-23', '2026-11-20', T1); assert.deepEqual(r3.earlier, [], 'aged out after 14 days');
});
test('dismiss is reversible and persisted; a dismissed item is listed separately, not lost', () => {
  let s = st(); s = recordSeen(s, [row({ rsi: 65 })], '2026-10-20', [], T0, '2026-10-20');
  const r = surface(s, lastSeen(s), [row({ rsi: 72 })], '2026-10-23', '2026-10-27', T1); const id = r.fresh.find((c) => c.kind === 'rsi')!.id;
  s = dismissChange(s, id, T1); const d = surface(s, lastSeen(s), [row({ rsi: 72 })], '2026-10-23', '2026-10-27', T1);
  assert.ok(!d.fresh.some((c) => c.id === id)); assert.ok(d.dismissed.some((c) => c.id === id));
  assert.equal(dismissChange(s, id, T1), s, 'dismissing twice changes nothing');
  s = restoreChange(s, id); assert.ok(surface(s, lastSeen(s), [row({ rsi: 72 })], '2026-10-23', '2026-10-27', T1).fresh.some((c) => c.id === id));
  assert.equal(restoreChange(s, id), s);
  // survives recording and a reload; and is dropped once its item is gone
  s = dismissChange(s, id, T1); s = recordSeen(s, [row({ rsi: 72 })], '2026-10-23', r.fresh, T1, '2026-10-27'); assert.ok(s.dismissed![id]);
  s = recordSeen({ ...s, inbox: [] }, [row({ rsi: 72 })], '2026-10-23', [], T1, '2026-10-27'); assert.equal(s.dismissed![id], undefined);
});
test('unfollowing drops a name from the module', () => {
  let s = st(); s = recordSeen(s, [row({ rsi: 65 })], '2026-10-20', [], T0, '2026-10-20'); s = { ...s, follows: [] };
  assert.equal(surface(s, lastSeen(s), [row({ rsi: 80 })], '2026-10-23', '2026-10-27', T1).fresh.length, 0);
});

test('persistence: a state with seen/inbox/dismissed round-trips through export/import; an old backup without them still imports', () => {
  let s = st(); s = recordSeen(s, [row({ rsi: 65 })], '2026-10-20', [], T0, '2026-10-20');
  const r = surface(s, lastSeen(s), [row({ rsi: 72 })], '2026-10-23', '2026-10-27', T1); s = recordSeen(s, [row({ rsi: 72 })], '2026-10-23', r.fresh, T1, '2026-10-27'); s = dismissChange(s, r.fresh[0].id, T1);
  const back = parseState(exportJson(s))!; assert.deepEqual(back.seen, s.seen); assert.deepEqual(back.inbox, s.inbox); assert.deepEqual(back.dismissed, s.dismissed);
  const old = JSON.stringify({ v: 1, follows: ['TCS'], entries: [], plans: [], snaps: {}, prefs: {} }); const o = parseState(old)!; assert.deepEqual(o.seen, {}); assert.deepEqual(o.inbox, []); assert.deepEqual(o.dismissed, {});
  assert.equal(readSaved(old).unreadable, false);
  const m = mergeStates({ ...DEFAULTS, onboarded: true }, back); assert.deepEqual(m.seen, s.seen); assert.deepEqual(m.inbox, s.inbox); assert.deepEqual(m.dismissed, s.dismissed);
  assert.deepEqual(mergeStates(m, back).seen, s.seen, 'importing twice adds nothing');
});
test('thesis versions: the optional question is backward compatible and a new question adds a version, not an overwrite', () => {
  let s = st(); const a = addEntry(s, 'TCS', { thesis: 't', support: '', counter: '', decision: '', invalidation: '', trigger: '', reviewOn: null }); s = a.s;
  assert.equal(current(s.entries[0]).question, undefined);
  s = editEntry(s, a.id, { ...current(s.entries[0]), question: 'Will deal wins hold margins?' } as never);
  assert.equal(s.entries[0].versions.length, 2); assert.equal(s.entries[0].versions[0].question, undefined); assert.equal(current(s.entries[0]).question, 'Will deal wins hold margins?');
  assert.equal(parseState(exportJson(s))!.entries[0].versions[1].question, 'Will deal wins hold margins?');
});

test('snapOf reads the same rules the screen shows, and a lender is marked', () => {
  const x = snapOf(row(), '2026-10-23', T1); assert.equal(x.trend, 'up'); assert.equal(x.rules, 4); assert.equal(x.elig, 'full');
  assert.equal(snapOf(row({ sector: 'Financial Services' }), '2026-10-23', T1).elig, 'financial sector');
  assert.equal(snapOf(row({ sma200: null }), '2026-10-23', T1).trend, null);
});

test('the market brief is deterministic, states only what is measured, and predicts nothing', () => {
  const b = { niftyCh: 0.4, bankCh: 0.7, vixCh: -3.2, upPct: 41.2, downPct: 20.1, nTrend: 913, day: '2026-10-26', behind: 0, live: true };
  const a = briefLines(b); assert.deepEqual(a, briefLines({ ...b }));
  assert.equal(a[0], 'Nifty +0.4%, Bank Nifty ahead by 0.30 pts.'); assert.match(a.join(' '), /41% of liquid names are in an uptrend and 20% in a downtrend \(913 measured\)/); assert.match(a.join(' '), /Screen data through Mon 26 Oct\./);
  for (const l of a) assert.ok(!FORBIDDEN.test(l), l);
  assert.deepEqual(briefLines({ ...b, niftyCh: null, bankCh: null, vixCh: null, upPct: null, downPct: null, nTrend: 0, day: null }), [], 'nothing measured, nothing said');
  assert.match(briefLines({ ...b, live: false })[0], /at the last close/); assert.match(briefLines({ ...b, behind: 2 }).join(' '), /2 sessions behind/);
  assert.ok(!FORBIDDEN.test(briefLines({ ...b, niftyCh: -2, bankCh: -3 }).join(' ')));
});
