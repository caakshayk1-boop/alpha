// Build-time freshness and completeness assertions. Run after build.mjs: `npm run tripwire:verify-data` (wired into .github/workflows/tripwire.yml before the deploy).
// Exit code 1, with one `FAIL` line per broken rule, when the published data is not what the exchange calendar says it should be. Rules (src/freshness.ts):
//   1. screen.json as_of is the last completed NSE session (one session behind is allowed only while that session's own build is still due: 16:00 to 23:30 IST on its day)
//   2. no row's last_date is more than one session older than as_of unless the row says stale:true (the UI renders the flag)
//   3. no row without a sector (the mapped exceptions are build.mjs SECTOR_FIX), and no more than 35% without a size class (the feed publishes one for index-sized names only)
//   4. the company files carry the same data day as the screen; signals is reported (WARN) and fatal only with STRICT_SIGNALS=1, because it is a separate pipeline
// TRIPWIRE_ALLOW_STALE=1 skips rules 1 and 4 on a laptop that built from an old snapshot; CI never sets it. TRIPWIRE_NOW (ISO instant) overrides the clock for tests.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertScreen, statusOf, expectedSession, throughWord } from '../src/freshness.ts';

export function checkDist(dist, nowMs = Date.now(), env = process.env) {
  const errors = [], warnings = []; const read = (f) => JSON.parse(readFileSync(join(dist, 'data', f), 'utf8'));
  if (!existsSync(join(dist, 'data', 'screen.json'))) return { errors: ['dist/data/screen.json does not exist; build first'], warnings };
  const screen = read('screen.json'); const fr = existsSync(join(dist, 'data', 'freshness.json')) ? read('freshness.json') : null;
  let found = assertScreen(screen, nowMs, { knownNullSector: [] });
  if (env.TRIPWIRE_ALLOW_STALE === '1') found = found.filter((m) => !/^screen as_of/.test(m));
  errors.push(...found);
  if (!fr) errors.push('dist/data/freshness.json is missing; the Data screen and the pill have nothing to read');
  else {
    const by = Object.fromEntries(fr.files.map((f) => [f.id, f]));
    if (by.screen && by.screen.asOf !== screen.as_of) errors.push(`freshness.json says the screen is ${by.screen.asOf} but screen.json says ${screen.as_of}`);
    const c = by.companies;
    if (c && env.TRIPWIRE_ALLOW_STALE !== '1') { const s = statusOf(c.asOf, nowMs); if (s.status !== 'current' && s.status !== 'pending') errors.push(`company files carry ${c.asOf ?? 'no date'} (${s.behind ?? '?'} sessions behind ${expectedSession(nowMs)})`); }
    const g = by.signals;
    if (g) { const s = statusOf(g.asOf, nowMs); if (s.status !== 'current' && s.status !== 'pending') (env.STRICT_SIGNALS === '1' ? errors : warnings).push(`signals.json carries ${g.asOf ?? 'no date'}, ${s.behind ?? '?'} sessions behind ${throughWord(expectedSession(nowMs))} (its own workflow, engines.yml, publishes it)`); }
  }
  // the committed nightly sheets (served by /api/rsi and /api/factors) against the screen they were built from: WARN, fatal with STRICT_SHEETS=1
  const ledgerDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'ledger'); const expected = screen.rows.filter((r) => r.liquid && r.tier !== 'micro').length;
  for (const [f, count, floor] of [['rsi.json', (j) => Object.keys(j.rows ?? {}).length, 0.75], ['factors.json', (j) => j.universe ?? 0, 0.6]]) {
    if (!existsSync(join(ledgerDir, f))) continue; const j = JSON.parse(readFileSync(join(ledgerDir, f), 'utf8')); const n = count(j);
    if (expected && n < floor * expected) (env.STRICT_SHEETS === '1' ? errors : warnings).push(`ledger/${f} (as of ${j.as_of}) covers ${n} names, under ${Math.round(floor * 100)}% of the ${expected} the screen says it should (liquid, not micro); the generator's guard keeps a thin sheet from replacing a good one`);
  }
  return { errors, warnings };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'); const now = process.env.TRIPWIRE_NOW ? Date.parse(process.env.TRIPWIRE_NOW) : Date.now();
  const { errors, warnings } = checkDist(dist, now);
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`FAIL  ${e}`);
  if (errors.length) { console.error(`tripwire verify-data: ${errors.length} rule(s) broken; the build must not deploy.`); process.exit(1); }
  console.log(`tripwire verify-data: ok (expected session ${expectedSession(now)})`);
}
