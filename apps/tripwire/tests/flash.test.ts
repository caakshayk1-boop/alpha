// The price cue (src/flash.ts), 12 Nov 2026: every row of the master prompt's PHASE 4 event table, coalescing, basis change, and the rule that identical polls produce nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextCue, accepted, flashInit, flashPush, flashFlush, COALESCE_MS, CUE_MS, type Obs, type FlashState } from '../src/flash.ts';

import { DEFAULTS, checkBackup, effectsOf, exportJson } from '../src/store.ts';

const live = (v: number | null, text?: string): Obs => ({ v, basis: 'live', state: 'live', ...(text ? { text } : {}) });
const rec = (v: number | null): Obs => ({ v, basis: 'recorded', state: 'recorded' });

test('initial load is a quiet neutral reveal, not up or down', () => {
  assert.equal(nextCue(null, live(100)), 'neutral'); assert.equal(nextCue(undefined, live(100)), 'neutral');
});
test('an increase is up, a decrease is down, against the previous accepted observation', () => {
  assert.equal(nextCue(live(100), live(100.05)), 'up'); assert.equal(nextCue(live(100), live(99.95)), 'down');
});
test('direction is never the sign of a lifetime P&L: a profit that ticks down is down, a loss that ticks up is up', () => {
  assert.equal(nextCue(live(5200), live(5100)), 'down');     // still positive overall
  assert.equal(nextCue(live(-900), live(-850)), 'up');       // still negative overall
});
test('an unchanged value is no cue, and so is the same text on screen even if the number moved below the shown precision', () => {
  assert.equal(nextCue(live(100), live(100)), 'none');
  assert.equal(nextCue(live(100.001, '100.00'), live(100.004, '100.00')), 'none');
  assert.equal(nextCue(live(100.001, '100.00'), live(100.4, '100.40')), 'up');
});
test('stale, missing and failed observations give no cue and no movement', () => {
  for (const state of ['stale', 'missing', 'failed'] as const) assert.equal(nextCue(live(100), { v: 101, basis: 'live', state }), 'none', state);
  assert.equal(nextCue(live(100), live(null)), 'none'); assert.equal(nextCue(live(100), live(undefined as never)), 'none'); assert.equal(nextCue(live(100), live(NaN)), 'none');
});
test('a quote restored after a gap is a neutral reveal, even if the price moved while it was gone', () => {
  for (const state of ['stale', 'missing', 'failed'] as const) assert.equal(nextCue({ v: 100, basis: 'live', state }, live(103)), 'neutral', state);
  assert.equal(nextCue(live(null), live(103)), 'neutral');
});
test('a basis change is neutral: live to recorded and back is never a gain or a loss', () => {
  assert.equal(nextCue(live(100), rec(90)), 'neutral'); assert.equal(nextCue(rec(90), live(100)), 'neutral');
  assert.equal(nextCue({ v: 100, basis: 'close', state: 'live' }, { v: 120, basis: 'live', state: 'live' }), 'neutral');
});
test('a recorded fallback on its own basis gives no live pulse, whatever the numbers do', () => {
  assert.equal(nextCue(rec(90), rec(95)), 'none'); assert.equal(nextCue(rec(95), rec(90)), 'none'); assert.equal(nextCue(rec(90), rec(90)), 'none');
});
test('a recorded observation is accepted as a value; a stale or missing one is not', () => {
  assert.equal(accepted(rec(1)), true); assert.equal(accepted(live(0)), true);
  assert.equal(accepted({ v: 1, basis: 'live', state: 'stale' }), false); assert.equal(accepted(live(null)), false); assert.equal(accepted(null), false);
});

// ---- coalescing ----
const run = (steps: [number, Obs | 'flush'][]) => { let s: FlashState = flashInit(); const cues: [number, string][] = []; let due: number | null = null;
  for (const [t, o] of steps) { const r = o === 'flush' ? flashFlush(s, t) : flashPush(s, o, t); s = r.state; due = r.flushIn === null ? null : t + r.flushIn; if (r.cue !== 'none') cues.push([t, r.cue]); }
  return { s, cues, due }; };

test('the first observation commits at once as the reveal', () => { assert.deepEqual(run([[0, live(100)]]).cues, [[0, 'neutral']]); });
test('identical polls produce no cue at all, however many and however often', () => {
  const steps: [number, Obs][] = [[0, live(100)]]; for (let t = 1000; t <= 60000; t += 1000) steps.push([t, live(100)]);
  assert.deepEqual(run(steps).cues, [[0, 'neutral']]);
});
test('updates inside one 500 ms window are one update: only the latest is judged, and it fires when the window ends', () => {
  const r = run([[0, live(100)], [100, live(101)], [200, live(102)], [300, live(103)]]);
  assert.deepEqual(r.cues, [[0, 'neutral']]); assert.equal(r.due, COALESCE_MS);
  const f = run([[0, live(100)], [100, live(101)], [200, live(102)], [300, live(103)], [COALESCE_MS, 'flush']]);
  assert.deepEqual(f.cues, [[0, 'neutral'], [COALESCE_MS, 'up']]);
});
test('up then back down inside a window nets to nothing', () => {
  const f = run([[0, live(100)], [100, live(105)], [200, live(100)], [COALESCE_MS, 'flush']]);
  assert.deepEqual(f.cues, [[0, 'neutral']]);
});
test('a change after the window has closed commits straight away', () => {
  assert.deepEqual(run([[0, live(100)], [COALESCE_MS + 1, live(99)]]).cues, [[0, 'neutral'], [COALESCE_MS + 1, 'down']]);
});
test('a basis change inside a window is still neutral, never a gain or a loss', () => {
  const f = run([[0, live(100)], [100, rec(80)], [COALESCE_MS, 'flush']]);
  assert.deepEqual(f.cues, [[0, 'neutral'], [COALESCE_MS, 'neutral']]);
});
test('flush with nothing waiting does nothing', () => { const r = flashFlush(flashInit(), 0); assert.equal(r.cue, 'none'); assert.equal(r.flushIn, null); });
test('the cue outlasts the halo (600 ms) and not by much', () => { assert.ok(CUE_MS >= 600 && CUE_MS <= 700); });

// ---- the Effects preference (12 Nov 2026): additive, defaults to Calm, round-trips ----
test('Effects: an old payload without the field reads as Calm; Off and Lively survive export and import; junk reads as Calm', () => {
  const old = JSON.parse(exportJson(DEFAULTS)); delete old.prefs.effects;
  const a = checkBackup(JSON.stringify(old)); assert.ok(a.ok); if (a.ok) assert.equal(effectsOf(a.state.prefs), 'calm');
  for (const m of ['off', 'calm', 'lively'] as const) { const r = checkBackup(exportJson({ ...DEFAULTS, prefs: { ...DEFAULTS.prefs, effects: m } })); assert.ok(r.ok); if (r.ok) assert.equal(r.state.prefs.effects, m); }
  const junk = JSON.parse(exportJson(DEFAULTS)); junk.prefs.effects = 'disco'; const j = checkBackup(JSON.stringify(junk)); assert.ok(j.ok); if (j.ok) assert.equal(j.state.prefs.effects, 'calm');
  assert.equal(effectsOf(undefined), 'calm');
});
