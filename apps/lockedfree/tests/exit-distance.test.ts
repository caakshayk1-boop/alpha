import test from 'node:test';
import assert from 'node:assert/strict';
import { exitDistance, nextTrailingStop } from '../src/lib/exit-distance.ts';
test('distance uses a common close and preserves moves outside the displayed range', () => {
  assert.deepEqual(exitDistance(100, 90, 110), { toStop:-10, toTarget:10, position:0.5 });
  assert.equal(exitDistance(80, 90, 110)?.position, 0);
  assert.equal(exitDistance(80, 90, 110)?.toStop, 12.5);
  assert.equal(exitDistance(120, 90, 110)?.position, 1);
  assert.equal(exitDistance(null, 90, 110), null);
  assert.equal(exitDistance(100, 110, 90), null);
});

test('next trailing stop uses the peak close rather than the last close',()=>{assert.equal(nextTrailingStop(100,75,25,[100,112,106]),84);assert.equal(nextTrailingStop(100,75,25,[]),null);});
