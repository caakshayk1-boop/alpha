// Run with: node --test tests/   (field speed: beacon validation, histograms, percentiles; no network)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTo, bucketOf, p75, report, routeOf, validateBeacon } from '../worker/rum.js';
import { routeOfPath } from '../src/lib/rum.ts';

test('routeOf: templates only, never a symbol, query or arbitrary path; the browser uses the same rule', () => {
  const cases = ['/', '/screen/', '/company/TCS/', '/company/M_M/', '/screen', '/company/TCS/extra/', '/../etc/', '/Screen/', '/a'.repeat(50), '/x?y=1', ''];
  for (const c of cases) assert.equal(routeOfPath(c), routeOf(c), c);
  assert.equal(routeOf('/company/TCS/'), '/company/[slug]/');
  assert.equal(routeOf('/screen/?s=TCS'), null);
});

test('validateBeacon: keeps only known metrics in range; drops junk, keeps the beacon if one metric is valid', () => {
  assert.deepEqual(validateBeacon({ r: '/screen/', d: 'phone', m: { lcp: 1800, cls: 0.04, ip: '1.2.3.4', inp: -5 } }), { route: '/screen/', dev: 'phone', m: { lcp: 1800, cls: 0.04 } });
  assert.equal(validateBeacon({ r: '/screen/', d: 'tablet', m: { lcp: 1 } }), null);
  assert.equal(validateBeacon({ r: '/screen/', d: 'phone', m: { lcp: Infinity } }), null);
  assert.equal(validateBeacon({ r: '/nope?x', d: 'phone', m: { lcp: 1 } }), null);
  assert.equal(validateBeacon([]), null);
});

test('p75 reports the upper edge of the bucket holding the 75th percentile, and "over" for the top bucket', () => {
  const day = {};
  for (const v of [400, 900, 1200, 1400, 2200, 2400, 2600, 3500]) addTo(day, { route: '/', dev: 'phone', m: { lcp: v } });
  assert.deepEqual(p75('lcp', day['/|phone|lcp']), { at_most: 2500, n: 8 });
  assert.equal(bucketOf('lcp', 25000), 11);
  assert.deepEqual(p75('lcp', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3]), { over: 20000, n: 3 });
  assert.equal(p75('lcp', [0, 0]), null);
});

test('report merges days and rates against the Web Vitals thresholds', () => {
  const a = addTo({}, { route: '/', dev: 'desktop', m: { lcp: 1200, cls: 0.3 } });
  const b = addTo({}, { route: '/', dev: 'desktop', m: { lcp: 1300 } });
  const r = report([a, b]);
  assert.equal(r['/'].desktop.lcp.n, 2);
  assert.equal(r['/'].desktop.lcp.rating, 'good');
  assert.equal(r['/'].desktop.cls.rating, 'poor');
});
