// Global cues (news/cues.js): the headline classifier and the standing "how it connects to India" copy.
// 12 Nov 2026. The copy is a description of exposure, never a forecast: it must pass the same forbidden-words lint as the brief, and it must name only sectors and instruments the app holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUES, SECTORS, MEASURES, GLOBAL_QUERIES, classifyCue, cueById } from '../news/cues.js';
import { FORBIDDEN } from '../src/brief.ts';
import { MACRO } from '../src/macro.ts';

test('every cue is complete, unique, and uses only known sectors and instruments', () => {
  assert.equal(new Set(CUES.map((c) => c.id)).size, CUES.length);
  for (const c of CUES) {
    assert.ok(String(c.id).length > 2, c.id); assert.ok(String(c.label).length >= 4, c.id); for (const f of ['channel', 'exposed', 'watch'] as const) assert.ok(String(c[f]).length > 8, `${c.id}.${f}`);
    assert.ok(c.sectors.length >= 1 && c.sectors.every((s: string) => SECTORS.includes(s)), `${c.id} sectors`);
    assert.ok(MEASURES.includes(c.measure), `${c.id} measure`);
  }
  const macroKeys = new Set(MACRO.map((m) => m.key)); const indexKeys = new Set(['NIFTY', 'BANKNIFTY', 'VIX']);
  for (const m of MEASURES) assert.ok(macroKeys.has(m) || indexKeys.has(m), `${m} is a live instrument the app serves`);
});

test('the standing copy predicts nothing: no forecast word, no cause claim', () => {
  for (const c of CUES) for (const f of ['label', 'channel', 'exposed', 'watch'] as const) assert.ok(!FORBIDDEN.test(c[f]), `${c.id}.${f}: ${c[f]}`);
});

test('the classifier reads the headline only, narrowly, and returns at most two cues', () => {
  assert.deepEqual(classifyCue('Wall Street closes higher as Nasdaq climbs'), ['us_equities']);
  assert.deepEqual(classifyCue('Brent crude slips as OPEC+ weighs output'), ['crude']);
  assert.deepEqual(classifyCue('Fed holds rates; Treasury yields ease'), ['fed_rates']);
  assert.deepEqual(classifyCue('Fed signals pause as the dollar index slips'), ['fed_rates', 'dollar']);
  assert.deepEqual(classifyCue('Hang Seng and Nikkei open lower'), ['china_asia']);
  assert.deepEqual(classifyCue('Gold price hits record as copper steadies'), ['metals']);
  assert.deepEqual(classifyCue('US tariffs and sanctions widen'), ['geopolitics']);
  // Not a cue: an Indian company story, a recap, an unrelated "federal" word, a bare "oil" in a product name.
  for (const t of ['TCS Q2 net profit rises 5% to ₹12,300 crore', 'Federal Bank board approves fund raise', 'Sensex today: closing bell', 'Mustard oil makers cut retail prices', '']) assert.deepEqual(classifyCue(t), [], t);
});

test('the job searches are plain words with a freshness window, one per theme', () => {
  assert.ok(GLOBAL_QUERIES.length >= 5 && GLOBAL_QUERIES.length <= 8);
  for (const q of GLOBAL_QUERIES) assert.ok(/when:\d+d$/.test(q) && !/\bOR\b/.test(q) && q.length < 80, q);
  assert.equal(cueById('crude')?.measure, 'BRENT');
  assert.equal(cueById('nope'), null);
});
