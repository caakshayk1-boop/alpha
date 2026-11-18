import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// The CLI is exercised end to end against a throwaway copy of the folder layout.
import { cpSync } from 'node:fs';
const here = new URL('..', import.meta.url).pathname;
function sandbox(bars: object) {
  const d = mkdtempSync(join(tmpdir(), 'rb-')); cpSync(join(here, 'src'), join(d, 'src'), { recursive: true }); cpSync(join(here, 'tools'), join(d, 'tools'), { recursive: true });
  mkdirSync(join(d, 'ledger')); writeFileSync(join(d, 'ledger', 'bars.json'), JSON.stringify(bars)); writeFileSync(join(d, 'package.json'), '{"type":"module"}'); return d;
}
const run = (d: string) => spawnSync('node', ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', join(d, 'tools', 'build-ledger.ts')], { encoding: 'utf8' });
test('first night with no screens: writes an empty-book ledger with one book day and a snapshot', () => {
  const d = sandbox({ fetched_at: 'x', benchmark: { '2026-11-17': 100, '2026-11-18': 101 }, bars: {}, missing: [] });
  const r = run(d); assert.equal(r.status, 0, r.stderr);
  const L = JSON.parse(readFileSync(join(d, 'ledger', 'ledger.json'), 'utf8')); assert.equal(L.as_of, '2026-11-18'); assert.equal(L.book_days.some((b: any) => b.screen_id === 'all' && b.benchmark_close === 101), true);
  assert.equal(existsSync(join(d, 'ledger', 'snapshots', '2026-11-18.json')), true);
  assert.equal(run(d).status, 0, 'a second run the same day is a no-op, not a failure');
  assert.equal(JSON.parse(readFileSync(join(d, 'ledger', 'ledger.json'), 'utf8')).book_days.length, L.book_days.length);
});
test('a benchmark on a non-session day, or too few fresh bars, writes nothing and exits 1', () => {
  let d = sandbox({ benchmark: { '2026-11-14': 100 }, bars: {}, missing: [] }); let r = run(d); assert.equal(r.status, 1); assert.match(r.stderr, /not an NSE session/); assert.equal(existsSync(join(d, 'ledger', 'ledger.json')), false);
  const bar = { o: 1, h: 1, l: 1, c: 1 };
  d = sandbox({ benchmark: { '2026-11-18': 100 }, bars: { A: { '2026-11-18': bar }, B: { '2026-11-17': bar }, C: { '2026-11-17': bar } }, missing: [] }); r = run(d);
  assert.equal(r.status, 1); assert.match(r.stderr, /need 85%/);
});
