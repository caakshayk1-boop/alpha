// The India link of a macro card (src/charts/indialink.ts), 12 Nov 2026: a standing description from news/cues.js, never a forecast, never invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indiaLink, MACRO_CUE, MEASURE_ALIAS, sectorHref } from '../src/charts/indialink.ts';
import { MACRO } from '../src/macro.ts';
import { CUES, SECTORS } from '../news/cues.js';
import { FORBIDDEN } from '../src/brief.ts';

test('metals, crude and the dollar are linked; Bitcoin and the ringgit crosses are not', () => {
  for (const k of ['GOLD', 'SILVER']) assert.equal(indiaLink(k)?.id, 'metals');
  for (const k of ['BRENT', 'WTI']) assert.equal(indiaLink(k)?.id, 'crude');
  assert.equal(indiaLink('USDINR')?.id, 'dollar');
  for (const k of ['BTC', 'MYRINR', 'USDMYR', 'NOPE']) assert.equal(indiaLink(k), null, `${k} has no India link and must not get one`);
});
test('every mapped cue really measures that instrument in cues.js (the map cannot drift)', () => {
  for (const [k, id] of Object.entries(MACRO_CUE)) { const c = CUES.find((x: { id: string }) => x.id === id); assert.ok(c, id); assert.equal(c.measure, MEASURE_ALIAS[k] ?? k, `${k} -> ${id}`); }
  for (const k of Object.keys(MACRO_CUE)) assert.ok(MACRO.some((m) => m.key === k), `${k} is a macro instrument`);
});
test('the text is the standing description: no forecast words, sectors are the screen\'s own names', () => {
  for (const k of Object.keys(MACRO_CUE)) {
    const l = indiaLink(k)!; assert.ok(l.sectors.length > 0);
    for (const s of l.sectors) assert.ok(SECTORS.includes(s), s);
    for (const t of [l.label, l.channel, l.exposed, l.watch]) assert.ok(!FORBIDDEN.test(t), `${k}: ${t}`);
  }
});
test('a sector chip opens Discover on that sector, encoded', () => { assert.equal(sectorHref('Financial Services'), '#/discover?sector=Financial%20Services'); });
