// The schedule facts that docs/tripwire/launch/RELIABILITY.md rests on, pinned so a "tidy-up" cannot move a job back to a slot that runs before its data exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wf = (f: string) => readFileSync(new URL(`../../../.github/workflows/${f}`, import.meta.url), 'utf8');
const crons = (t: string) => [...t.matchAll(/^\s*-\s*cron:\s*'([^']+)'/gm)].map((m) => m[1]);
const NEWSPAPER_LATEST_UTC_MIN = 1 * 60 + 5;       // the latest observed commit of docs/screen.json, 01:05 UTC (16 to 27 Oct 2026)

test('the ledger and the deploy run after the screen is published, not before it', () => {
  for (const f of ['tripwire_ledger.yml', 'tripwire.yml']) {
    const c = crons(wf(f)); assert.equal(c.length, 2, f);
    for (const x of c) { const [m, h, , , d] = x.split(' '); const min = Number(h) * 60 + Number(m); assert.ok(min > NEWSPAPER_LATEST_UTC_MIN && min < 5 * 60, `${f} ${x} is not between 01:05 and 05:00 UTC`); assert.equal(d, '2-6', `${f} ${x}: Tuesday to Saturday, the days after a session`); }
  }
});
test('the deploy retry skips when the live site already carries the data day, and a scheduled run gets one more browser-gate attempt', () => {
  const t = wf('tripwire.yml'); const retry = crons(t)[1];
  assert.ok(t.includes(`github.event.schedule == '${retry}'`), 'the skip is keyed to the retry slot only, so the first slot always builds and deploys');
  assert.match(t, /steps\.already\.outputs\.same != 'true'/); assert.match(t, /continue-on-error: \$\{\{ github\.event_name == 'schedule' \}\}/); assert.match(t, /Browser gate, second attempt/);
});
test('the news job has an offset second grid, and a crash or a failed publish makes the run red', () => {
  const t = wf('tripwire_news.yml'); const c = crons(t);
  assert.ok(c.some((x) => /^\*\/15 /.test(x)) && c.some((x) => /^7,22,37,52 /.test(x)), 'the 15-minute grid and its offset twin');
  assert.ok(c.some((x) => /^\*\/30 /.test(x)) && c.some((x) => /^7,37 /.test(x)), 'the 30-minute grid and its offset twin');
  assert.match(t, /id: pub/); assert.match(t, /steps\.run\.outcome == 'failure' \|\| steps\.pub\.outcome == 'failure'/);
});
test('the Worker\'s cron trigger exists and is a no-op without its secret (the owner step is named in the document)', () => {
  const cfg = readFileSync(new URL('../../../wrangler.tripwire.jsonc', import.meta.url), 'utf8'); assert.match(cfg, /"crons": \["\*\/15 \* \* \* \*"\]/);
  const doc = readFileSync(new URL('../../../docs/tripwire/launch/RELIABILITY.md', import.meta.url), 'utf8'); assert.match(doc, /GITHUB_DISPATCH_TOKEN/);
});
