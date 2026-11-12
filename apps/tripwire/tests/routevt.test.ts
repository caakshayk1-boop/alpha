// 12 Nov 2026: which way a screen travels on a route change (routevt.ts). Pure; no browser, no clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeDepth, routeDirection } from '../src/routevt.ts';

const tabOf = (p: string[]) => (p[0] === 'c' || p[0] === 'compare' || p[0] === 'discover' ? 'discover' : p[0] === 'signals' ? 'signals' : p[0] === 'news' || p[0] === 'markets' || !p[0] || p[0] === 'today' ? 'today' : 'more');
test('a tab root is depth 1; anything opened from it is depth 2', () => {
  for (const p of [[], ['today'], ['discover'], ['signals'], ['more']]) assert.equal(routeDepth(p), 1);
  for (const p of [['c', 'TCS'], ['news'], ['markets'], ['compare'], ['data'], ['methodology']]) assert.equal(routeDepth(p), 2);
});
test('deeper arrives from the right, back reverses, another tab or a sibling is a crossfade', () => {
  assert.equal(routeDirection(['discover'], ['c', 'TCS'], tabOf), 'fwd');
  assert.equal(routeDirection(['c', 'TCS'], ['discover'], tabOf), 'back');
  assert.equal(routeDirection(['today'], ['news'], tabOf), 'fwd');
  assert.equal(routeDirection(['more'], ['data'], tabOf), 'fwd');
  assert.equal(routeDirection(['today'], ['discover'], tabOf), 'tab');
  assert.equal(routeDirection(['c', 'TCS'], ['signals'], tabOf), 'tab');
  assert.equal(routeDirection(['c', 'TCS'], ['c', 'INFY'], tabOf), 'tab', 'same depth: no direction is implied');
});
