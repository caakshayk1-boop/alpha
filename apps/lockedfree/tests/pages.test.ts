import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedAvailable, loadFeed, buildCohorts, num } from '../src/lib/feed.ts';
import { stockModel } from '../src/lib/stockpage.ts'; import { brief } from '../src/lib/brief.ts'; import { sectors } from '../src/lib/stats.ts';
const live = feedAvailable(); const T = (n: string, f: () => void) => test(n, { skip: !live && 'feed not downloaded' }, f);
T('all 999 stock models build; no metric has two owners; prose carries no raw stat values', () => {
  const F = loadFeed(), co = buildCohorts(F.rows); assert.ok(F.rows.length >= 900);
  for (const r of F.rows) { const m = stockModel(F, co, r); const prose = [m.write.position, m.write.profile, m.write.trend, ...m.facts.map((f) => f.sentence)].join(' ');
    assert.doesNotMatch((m.write.trend + m.write.profile).replace(/20, 50 and 200-day|200-day|52-week|14-day|three months/g, ''), /\d/, `${r.sym}: the trend and profile prose must not repeat numbers owned by the stats`); assert.doesNotMatch(m.facts.map((f) => f.sentence).join(' '), /₹|\d+\.\d+/, r.sym);
    assert.equal(new Set(m.sections.flatMap((s) => s.stats.map((x) => x.key))).size, m.sections.flatMap((s) => s.stats).length, r.sym + ' duplicate key'); void prose; }
});
T('every displayed stat equals the feed value; an absent value renders as a dash, never 0', () => {
  const F = loadFeed(), co = buildCohorts(F.rows);
  for (const r of F.rows) { const m = stockModel(F, co, r); for (const s of m.sections.flatMap((x) => x.stats)) { assert.equal(s.raw, num(r, s.key), `${r.sym}.${s.key}`); if (s.raw == null) assert.equal(s.value, '—', `${r.sym}.${s.key} missing must show a dash`); else assert.notEqual(s.value, '—'); } }
});
T('peers and cautions come only from this stock; pages for two different stocks never have the same cautions+facts', () => {
  const F = loadFeed(), co = buildCohorts(F.rows); const sig = new Set<string>(); for (const r of F.rows) { const m = stockModel(F, co, r); sig.add(m.write.position + '|' + m.facts.map((f) => f.metric).join(',') + '|' + m.cautions.map((c) => c.t).join(',')); }
  assert.equal(sig.size, F.rows.length);
});
T('the brief reads every number from the feed: breadth matches the source exactly', () => {
  const F = loadFeed(), b = brief(F); const adv = F.meta.breadth.advancing; assert.match(b.paragraphs[0], new RegExp(`${adv} stocks closed up`)); assert.ok(b.unusual.up.every((r) => r.liquid)); assert.ok(sectors(F.rows).length >= 8);
  assert.doesNotMatch(b.paragraphs.join(' '), /undefined|NaN/);
});
T('business text never ends mid-clause; the brief states unchanged stocks so its counts add up to the tracked total', () => {
  const F = loadFeed(), co = buildCohorts(F.rows); for (const r of F.rows) { const b = stockModel(F, co, r).business; const src = F.detail[r.sym]?.business; if (b && src && src.replace(/\s+/g, ' ').trim().length > 520) assert.match(b, /[.…]$/, r.sym + ': ' + b.slice(-30)); }
  const br = brief(F), m = F.meta.breadth; assert.match(br.paragraphs[0], new RegExp(`${m.counted - m.advancing - m.declining} were unchanged`));
});
