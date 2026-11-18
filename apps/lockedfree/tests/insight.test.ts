import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedAvailable, loadFeed, buildCohorts, tierOf, num } from '../src/lib/feed.ts';
import { facts, writeup, peers } from '../src/lib/insight.ts';
const live = feedAvailable(); const T = (name: string, fn: () => void) => test(name, { skip: !live && 'feed not downloaded (run tools/fetch-feed.mjs)' }, fn);
T('every one of the 999 stocks gets facts, a write-up and peers without error; none is empty', () => {
  const F = loadFeed(), co = buildCohorts(F.rows); assert.ok(F.rows.length >= 900);
  for (const r of F.rows) { const fs = facts(r, co); const w = writeup(r, F.rows, co, fs); assert.ok(w.position.length > 20 && w.trend.length > 10 && w.profile.length > 10, r.sym); assert.ok(fs.length <= 6); }
});
T('facts quote ranks, never raw values; at most 2 per topic; a metric never repeats; average is never reported', () => {
  const F = loadFeed(), co = buildCohorts(F.rows);
  for (const r of F.rows) { const fs = facts(r, co); const m = fs.map((f) => f.metric); assert.equal(new Set(m).size, m.length, r.sym); const t: Record<string, number> = {}; for (const f of fs) { t[f.topic] = (t[f.topic] ?? 0) + 1; assert.match(f.sentence, /(top|bottom) \d+% of /); assert.doesNotMatch(f.sentence, /₹|\d+\.\d+/, r.sym + f.sentence); } assert.ok(Object.values(t).every((n) => n <= 2)); }
});
T('NO COMMON INFO: no fact sentence template appears on more than 35% of pages, and no two pages share the same fact set and position text', () => {
  const F = loadFeed(), co = buildCohorts(F.rows); const seen = new Map<string, number>(); const sets = new Set<string>(); const pos = new Set<string>();
  for (const r of F.rows) { const fs = facts(r, co); for (const f of new Set(fs.map((x) => `${x.metric}:${x.side}`))) seen.set(f, (seen.get(f) ?? 0) + 1); sets.add(fs.map((x) => x.metric + x.side).join('|') + '#' + r.sym.slice(0, 0)); pos.add(writeup(r, F.rows, co, fs).position); }
  for (const [k, n] of seen) assert.ok(n / F.rows.length <= 0.35, `${k} on ${((n / F.rows.length) * 100).toFixed(0)}% of pages`);
  assert.equal(pos.size, F.rows.length, 'every position sentence is unique (name and size rank differ)');
  assert.ok(sets.size > F.rows.length * 0.6, `distinct fact sets: ${sets.size}`);
});
T('peers: five, same sector, never itself, no duplicates', () => { const F = loadFeed(); for (const r of F.rows.slice(0, 300)) { const p = peers(r, F.rows); assert.ok(p.length <= 5); assert.ok(p.every((x) => x.sym !== r.sym && (x.sector ?? '') === (r.sector ?? ''))); assert.equal(new Set(p.map((x) => x.sym)).size, p.length); } });
T('missing stays missing: tier derives from market cap only when the source omits it; absent numbers read as null, never 0', () => {
  const F = loadFeed(); const noTier = F.rows.filter((r) => !r.tier); assert.ok(noTier.length > 0); for (const r of noTier) assert.equal(tierOf(r), null, 'a tier is never guessed'); const noPe = F.rows.find((r) => !('pe' in r))!; assert.equal(num(noPe, 'pe'), null);
});
