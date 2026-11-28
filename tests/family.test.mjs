// worker/family.js: each product's own published data date, read without guessing. Fixtures are live copies taken 28 Nov 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRulebookStatus, parseTripwireFreshness, readFamily } from '../worker/family.js';

const fx = (f) => readFileSync(new URL(`./fixtures/family/${f}`, import.meta.url), 'utf8');

test('Rulebook: every row of its own status table, with its date and cadence', () => {
  const rows = parseRulebookStatus(fx('rulebook-status.html'));
  assert.deepEqual(rows.map((r) => r.label), ['Daily feed', 'Paper ledger', 'Daily edition', 'Weekly screens']);
  assert.ok(rows.every((r) => r.asOf === null || /^\d{4}-\d{2}-\d{2}$/.test(r.asOf)));
  assert.equal(rows.at(-1).cadence, 'weekly');
  assert.deepEqual(parseRulebookStatus('<tr data-status-row data-asof="" data-cadence="daily"><th scope="row">Daily feed</th>'), [{ label: 'Daily feed', asOf: null, cadence: 'daily' }], 'an empty date stays null');
  assert.deepEqual(parseRulebookStatus('<html>changed layout</html>'), []);
});

test('Tripwire: named files only, dates checked', () => {
  const rows = parseTripwireFreshness(JSON.parse(fx('tripwire-freshness.json')));
  assert.deepEqual(rows.map((r) => r.label), ['Daily screen', 'Company pages', 'Rule triggers']);
  assert.deepEqual(parseTripwireFreshness({ files: [{ id: 'screen', asOf: 'soon' }] }), [{ label: 'Daily screen', asOf: null, cadence: 'daily' }]);
  assert.deepEqual(parseTripwireFreshness(null), []);
});

test('a product that does not answer is "not reached" with no dates, never a guessed one', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => {
    if (String(u).includes('lockedfree')) return new Response(fx('rulebook-status.html'), { status: 200 });
    if (String(u).includes('tripwire')) throw new Error('timeout');
    return new Response('down', { status: 503 });
  };
  try {
    const f = await readFamily('2026-11-27');
    const by = Object.fromEntries(f.products.map((p) => [p.id, p]));
    assert.deepEqual(f.products.map((p) => p.id), ['alpha', 'rulebook', 'tripwire', 'apexpro']);
    assert.equal(by.rulebook.reached, true);
    assert.deepEqual(by.rulebook.datasets.map((d) => d.label), ['Daily feed', 'Paper ledger']);
    assert.equal(by.tripwire.reached, false); assert.deepEqual(by.tripwire.datasets, []);
    assert.equal(by.apexpro.reached, false); assert.deepEqual(by.apexpro.datasets, []);
    assert.equal(by.alpha.datasets[0].asOf, '2026-11-27');
    const none = await readFamily(null);
    assert.equal(none.products[0].datasets[0].asOf, null, 'an unread screen is null, not today');
  } finally { globalThis.fetch = real; }
});
