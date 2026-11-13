// The price cue's basis (13 Nov 2026, v5): every <Tick> says what its number is a reading OF, so a change of basis (live print to recorded close, a delayed feed, a mixed total) is a neutral reveal or nothing,
// never a gain or a loss. The clock is always a parameter here: nothing reads the live one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countsTick, marksTick, markTick, quoteTick, wordTick } from '../src/tickbasis.ts';
import { nextCue, type Obs } from '../src/flash.ts';
import { resetFeedPrint } from '../src/stamp.ts';

const ist = (iso: string, h: number, m = 0) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), h, m) - 330 * 60000;
const obs = (v: number | null, t: { basis: string; state?: Obs['state'] }): Obs => ({ v, ...t });

test('a status word maps to a basis: live is live, delayed is not a fresh reading, a close is recorded, nothing is missing', () => {
  assert.deepEqual(wordTick('Live'), { basis: 'live' });
  assert.deepEqual(wordTick('Delayed'), { basis: 'live', state: 'stale' });
  assert.deepEqual(wordTick('Last traded'), { basis: 'recorded', state: 'recorded' });
  assert.deepEqual(wordTick('Not traded yet'), { basis: 'recorded', state: 'recorded' });
  assert.deepEqual(wordTick('Unavailable'), { basis: 'live', state: 'missing' }); assert.deepEqual(wordTick(null), { basis: 'live', state: 'missing' });
});

test('a quote is judged by its print time against a fixed clock, on the NSE or the 24-hour calendar', () => {
  resetFeedPrint();
  const open = ist('2026-11-11', 11, 0);   // Wed, session on
  assert.deepEqual(quoteTick(open / 1000 - 30, open), { basis: 'live' }, 'a print 30 s old in session is live');
  assert.deepEqual(quoteTick(open / 1000 - 600, open), { basis: 'live', state: 'stale' }, 'ten minutes old in session is delayed: a number, not a fresh reading');
  const sat = ist('2026-11-14', 12, 0);
  assert.deepEqual(quoteTick(sat / 1000 - 30 * 3600, sat), { basis: 'recorded', state: 'recorded' }, 'a shut market is the last close');
  assert.deepEqual(quoteTick(sat / 1000 - 30, sat, false), { basis: 'live' }, 'gold or Bitcoin trades round the clock: a fresh print on a Saturday is live');
  assert.deepEqual(quoteTick(null, open), { basis: 'live', state: 'missing' });
});

test('a position mark is a live print or the last close; a total says which, or that it is mixed', () => {
  assert.deepEqual(markTick('live'), { basis: 'live' }); assert.deepEqual(markTick('close'), { basis: 'recorded', state: 'recorded' }); assert.deepEqual(markTick(null), { basis: 'live', state: 'missing' });
  assert.deepEqual(countsTick(3, 0), { basis: 'live' }); assert.deepEqual(countsTick(0, 3), { basis: 'recorded', state: 'recorded' }); assert.deepEqual(countsTick(2, 1), { basis: 'mixed' }); assert.deepEqual(countsTick(0, 0), { basis: 'live', state: 'missing' });
  assert.deepEqual(marksTick(['live', 'live']), { basis: 'live' }); assert.deepEqual(marksTick(['live', 'close']), { basis: 'mixed' }); assert.deepEqual(marksTick([]), { basis: 'live', state: 'missing' });
});

test('the session ends: the figure moves from a live print to the close, and that is a neutral reveal, never a loss', () => {
  const live = obs(212.4, wordTick('Live')), close = obs(208.9, wordTick('Last traded'));
  assert.equal(nextCue(live, close), 'neutral', 'live to recorded, lower number: neutral, not down');
  assert.equal(nextCue(obs(208.9, wordTick('Last traded')), obs(215, wordTick('Live'))), 'neutral', 'recorded to live, higher number: neutral, not up');
  assert.equal(nextCue(close, obs(207, wordTick('Last traded'))), 'none', 'two recorded closes make no live pulse');
  assert.equal(nextCue(live, obs(213, wordTick('Live'))), 'up', 'a real live move is still up'); assert.equal(nextCue(live, obs(211, wordTick('Live'))), 'down');
});

test('a delayed feed shows no pulse, and its recovery is a neutral reveal', () => {
  const live = obs(100, wordTick('Live')), delayed = obs(101, wordTick('Delayed'));
  assert.equal(nextCue(live, delayed), 'none'); assert.equal(nextCue(delayed, obs(103, wordTick('Live'))), 'neutral');
});

test('a position total whose mix of live and closed marks changes is a basis change, not a gain or a loss', () => {
  const allLive = obs(5200, marksTick(['live', 'live', 'live'])), mixed = obs(4900, marksTick(['live', 'live', 'close'])), allClose = obs(4800, marksTick(['close', 'close', 'close']));
  assert.equal(nextCue(allLive, mixed), 'neutral'); assert.equal(nextCue(mixed, allClose), 'neutral');
  assert.equal(nextCue(obs(5200, marksTick(['live', 'live'])), obs(5100, marksTick(['live', 'live']))), 'down', 'the same live mix moving lower is down');
});

// ---- the audit: no <Tick> may be written without saying its basis ----
const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
/** every opening <Tick ...> tag's props text, read with brace depth so an arrow function inside a prop does not end the tag early */
function tickTags(src: string): string[] {
  const out: string[] = []; let i = 0;
  while ((i = src.indexOf('<Tick', i)) !== -1) {
    const after = src[i + 5]; if (after !== ' ' && after !== '\n') { i += 5; continue; }
    let depth = 0, j = i + 5, q = '';
    for (; j < src.length; j++) { const c = src[j]; if (q) { if (c === q && src[j - 1] !== '\\') q = ''; continue; } if (c === '"' || c === "'" || c === '`') { q = c; continue; } if (c === '{') depth++; else if (c === '}') depth--; else if (c === '>' && depth === 0) break; }
    out.push(src.slice(i, j + 1)); i = j;
  }
  return out;
}
test('audit: every <Tick> call site passes a basis (explicitly, or from tickbasis.ts), so a change of basis can never show a directional halo', () => {
  let found = 0; const bad: string[] = [];
  for (const f of walk(SRC).filter((x) => x.endsWith('.tsx'))) {
    if (f.endsWith('live.tsx')) continue;   // the component itself
    for (const tag of tickTags(readFileSync(f, 'utf8'))) { found++; if (!/\bbasis=|\.\.\.(quoteTick|wordTick|markTick|countsTick|marksTick)\(/.test(tag)) bad.push(`${f.slice(SRC.length)}: ${tag.slice(0, 90)}`); }
  }
  assert.ok(found >= 8, `the scan found ${found} <Tick> call sites; a pattern that stops matching must fail, not pass everything`);
  assert.deepEqual(bad, []);
});
test('audit: the component itself requires a basis (no silent "live" default)', () => {
  const live = readFileSync(join(SRC, 'live.tsx'), 'utf8'); const sig = live.slice(live.indexOf('export function Tick('), live.indexOf('export function Tick(') + 400);
  assert.match(sig, /basis,/); assert.doesNotMatch(sig, /basis\s*=\s*'live'/); assert.match(sig, /basis: string/); assert.doesNotMatch(sig, /basis\?:/);
});
