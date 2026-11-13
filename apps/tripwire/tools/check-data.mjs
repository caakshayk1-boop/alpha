// Build-time freshness and completeness assertions. Run after build.mjs: `npm run tripwire:verify-data` (wired into .github/workflows/tripwire.yml before the deploy).
// Exit code 1, with one `FAIL` line per broken rule, when the published data is not what the exchange calendar says it should be. Rules (src/freshness.ts):
//   1. screen.json as_of is the last completed NSE session (one session behind is allowed only while that session's own build is still due: 16:00 to 23:30 IST on its day)
//   2. no row's last_date is more than one session older than as_of unless the row says stale:true (the UI renders the flag)
//   3. no row without a sector (the mapped exceptions are build.mjs SECTOR_FIX), and no more than 35% without a size class (the feed publishes one for index-sized names only)
//   4. the company files carry the same data day as the screen; signals is reported (WARN) and fatal only with STRICT_SIGNALS=1, because it is a separate pipeline
// TRIPWIRE_ALLOW_STALE=1 skips rules 1 and 4 on a laptop that built from an old snapshot; CI never sets it. TRIPWIRE_NOW (ISO instant) overrides the clock for tests.
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertScreen, statusOf, expectedSession, throughWord } from '../src/freshness.ts';
import { checkStagesAgree, checkMarksCurrent, formatViolations } from '../src/ledgerchecks.ts';

/** 12 Nov 2026 (Tripwire 2.0, 1.4): the nightly ledger's own freshness, asserted in the deploy job as well as in the ledger job, so a stale outcome stage is a red build with one line per fault and not something found at audit time.
 *  (a) the outcome stage's newest mark day equals the pick stage's last night, (b) no open position is marked older than the last completed NSE session. Both read src/ledgerchecks.ts, which reads src/calendar.ts. */
export function checkLedgerFile(path, nowMs = Date.now(), env = process.env) {
  if (!existsSync(path)) return { errors: [], warnings: ['ledger/ledger.json does not exist; the ledger freshness assertions were skipped'] };
  if (env.TRIPWIRE_ALLOW_STALE === '1') return { errors: [], warnings: [] };
  // 12 Nov 2026: a manual code-only deploy (workflow_dispatch input skip_ledger_check) may go out while the nightly ledger lags a session. Only the ledger rules are skipped, the screen and company-file rules stay on, and the skip is said out loud (a warning here, a line in the run summary) so a deploy that shipped over a lagging ledger is never mistaken for one that checked it. The scheduled and repository_dispatch runs never set it.
  if (env.TRIPWIRE_SKIP_LEDGER_CHECK === '1') return { errors: [], warnings: ['ledger freshness check SKIPPED on request (code-only deploy): the Record may be a session behind the screen'] };
  const l = JSON.parse(readFileSync(path, 'utf8')); const v = [...checkStagesAgree(l), ...checkMarksCurrent(l, nowMs)];
  return { errors: formatViolations(v).map((m) => `ledger: ${m}`), warnings: [] };
}

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
  // Data quality that is reported, never fatal: a row whose last price is older than the screen's day (the app flags it stale and gives it no model vote), and rows with no size class (the app says "Size class not published").
  const rowsOld = screen.rows.filter((r) => r.last_date && r.last_date < screen.as_of); const noTier = screen.rows.filter((r) => !r.tier);
  if (rowsOld.length) warnings.push(`${rowsOld.length} row${rowsOld.length === 1 ? '' : 's'} carry a last price older than the screen's day ${screen.as_of} (${rowsOld.slice(0, 6).map((r) => `${r.sym} ${r.last_date}`).join(', ')}${rowsOld.length > 6 ? ', ...' : ''}); the app treats them as stale`);
  if (noTier.length) warnings.push(`${noTier.length} of ${screen.rows.length} rows (${(100 * noTier.length / screen.rows.length).toFixed(1)}%) have no size class: the published size class (rule elig-2) exists for index-sized names only, so the app says "Size class not published" and does not guess one`);
  // the committed nightly sheets (served by /api/rsi and /api/factors) against the screen they were built from: WARN, fatal with STRICT_SHEETS=1
  const ledgerDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'ledger'); const expected = screen.rows.filter((r) => r.liquid && r.tier !== 'micro').length;
  for (const [f, count, floor] of [['rsi.json', (j) => Object.keys(j.rows ?? {}).length, 0.75], ['factors.json', (j) => j.universe ?? 0, 0.6]]) {
    if (!existsSync(join(ledgerDir, f))) continue; const j = JSON.parse(readFileSync(join(ledgerDir, f), 'utf8')); const n = count(j);
    if (expected && n < floor * expected) (env.STRICT_SHEETS === '1' ? errors : warnings).push(`ledger/${f} (as of ${j.as_of}) covers ${n} names, under ${Math.round(floor * 100)}% of the ${expected} the screen says it should (liquid, not micro); the generator's guard keeps a thin sheet from replacing a good one`);
  }
  return { errors, warnings };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // 13 Nov 2026: the ledger rules are a SEPARATE, report-only pass in the deploy workflow. The ledger is read live from /api/ledger and does not ship in the bundle, and it is recorded by its own job a few minutes
  // AFTER the screen publisher dispatches this one: on 12 Nov both nightly dispatches (19:12 and 21:26 UTC) failed on "ledger one session behind" and the data deploy slipped 4 hours. So:
  //   (default)        the screen/company-file rules AND the ledger rules, as before (local use, tests)
  //   --no-ledger      only the rules that decide whether THIS BUILD is fresh: blocks the deploy
  //   --ledger-only    only the ledger rules: the workflow runs it with continue-on-error, after the rules above, so a lagging ledger is a red step with one line per fault and a summary section, and never stops the deploy
  const args = process.argv.slice(2); const flag = (f) => args.includes(f); const pos = args.filter((a) => !a.startsWith('--'));
  const here = dirname(fileURLToPath(import.meta.url)); const dist = pos[0] ?? join(here, '..', 'dist'); const now = process.env.TRIPWIRE_NOW ? Date.parse(process.env.TRIPWIRE_NOW) : Date.now();
  const ledgerOnly = flag('--ledger-only'); const errors = [], warnings = [];
  if (!ledgerOnly) { const r = checkDist(dist, now); errors.push(...r.errors); warnings.push(...r.warnings); }
  if (!flag('--no-ledger')) { const lg = checkLedgerFile(join(here, '..', 'ledger', 'ledger.json'), now); errors.push(...lg.errors); warnings.push(...lg.warnings); }
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`FAIL  ${e}`);
  if (errors.length) {
    console.error(ledgerOnly ? `tripwire ledger freshness: ${errors.length} fault(s). The build was NOT held back for this (the ledger is read live and recorded by its own job).` : `tripwire verify-data: ${errors.length} rule(s) broken; the build must not deploy.`);
    /* a failed or stale build must be visible on the run page itself, not only in a step log */
    if (process.env.GITHUB_STEP_SUMMARY) { try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, ledgerOnly ? `## Tripwire ledger is behind the market\n\nExpected session: ${expectedSession(now)}. The site was deployed anyway: the ledger is read live and is recorded by its own job.\n\n${errors.map((e) => `- ${e}`).join('\n')}\n` : `## Tripwire freshness check FAILED\n\nExpected session: ${expectedSession(now)}. The build was not deployed.\n\n${errors.map((e) => `- ${e}`).join('\n')}\n`); } catch { /* the log above still has it */ } }
    process.exit(1);
  }
  console.log(`tripwire verify-data${ledgerOnly ? ' (ledger)' : ''}: ok (expected session ${expectedSession(now)})`);
}
