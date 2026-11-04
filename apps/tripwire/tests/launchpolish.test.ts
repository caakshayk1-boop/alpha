import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mood, regime } from '../src/mood.ts';
import { recentDecisions } from '../src/decisions.ts';
import { resolveRoute } from '../src/route.ts';
import { DEFAULTS } from '../src/store.ts';

test('one mood: an index rally on a narrow market is called that, not "Strong" beside "Mixed: 7% in an uptrend"', () => {
  const md = mood(1.6, 0.9, -1)!; assert.equal(md.word, 'Strong');                                           // the index mood alone
  const r = regime(md, 7, 25)!; assert.equal(r.word, 'Narrow rally'); assert.match(r.note, /only 7% of liquid stocks are in an uptrend \(25% in a downtrend\)/);
  assert.equal(regime(md, 45, 20)!.word, 'Strong', 'a broad market lets the index word stand');
  const down = mood(-1.5, -1.2, 5)!; assert.equal(regime(down, 40, 30)!.word, 'Index-led dip'); assert.equal(regime(down, 10, 70)!.word, down.word);
  assert.equal(regime(md, null, null)!.word, 'Strong'); assert.equal(regime(null, 7, 25), null);
  assert.ok(![regime(md, 7, 25)!, regime(down, 40, 30)!].some((x) => /\b(will|buy|sell|should)\b/i.test(x.note)), 'it describes, it does not predict');
});
const paper = (sym: string, engine: string, day: string, extra = {}) => ({ id: `${sym}${day}`, sym, engine, asOf: '2026-10-23', ref: 100, stop: 90, horizon: 10, qty: 10, takenAt: Date.parse(`${day}T06:00:00Z`) / 1000, ...extra });
test('My Desk: identical paper-trade lines collapse to one per engine per day, and a retired engine is left out', () => {
  const s = { ...DEFAULTS, paper: [paper('A', 'MOM', '2026-10-27'), paper('B', 'MOM', '2026-10-27'), paper('C', 'MOM', '2026-10-27', { closedByUser: true }), paper('D', 'MOM', '2026-10-27'), paper('E', 'MOM', '2026-10-27'), paper('F', 'MOM', '2026-10-27'),
    paper('N', 'LVT', '2026-10-25'), paper('S', 'LVT', '2026-10-25'), paper('X', 'QLT', '2026-10-28')] } as never;
  const d = recentDecisions(s); assert.equal(d.length, 2, 'two lines: Momentum on the 27th and Quality on the 28th; the five LVT lines are gone');
  const mom = d.find((x) => /MOM/.test(x.what))!; assert.equal(mom.sym, '6 names'); assert.equal(mom.what, 'Paper trades taken from MOM picks: A, B, C, D and 2 more; 1 closed by hand');
  const one = d.find((x) => /QLT/.test(x.what))!; assert.equal(one.sym, 'X'); assert.equal(one.what, 'Paper trade taken from a QLT pick');
  assert.ok(!d.some((x) => /LVT/.test(x.what)));
});
test('#/paper and #/book are real addresses (they redirect to the paper trades), not a dead end', () => {
  assert.deepEqual(resolveRoute(['paper']), { kind: 'ok', head: 'paper' }); assert.deepEqual(resolveRoute(['book']), { kind: 'ok', head: 'book' });
  assert.equal(resolveRoute(['paper', 'x']).kind, 'notfound', 'a longer address is still not found'); assert.equal(resolveRoute(['nonsense']).kind, 'notfound');
});
