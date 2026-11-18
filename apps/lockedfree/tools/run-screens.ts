// Runs the four screens on ledger/fundamentals.json and writes ledger/runs/<screen>__<date>.json (for the ledger) and ledger/detail/<screen>__<date>.json
// (per-rule results for listed and near-miss names, for the stock pages). run_date = the latest Friday on or before the newest price day.
// A screen with more than 35% of the universe not scorable writes nothing and fails the job: a blind week is not published as a sit-out.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'; import { join } from 'node:path';
import { SCREENS, type Company } from '../src/lib/screens.ts'; import { isSession } from '../src/lib/calendar.ts';
const dir = join(process.cwd(), 'ledger'); const f = JSON.parse(readFileSync(join(dir, 'fundamentals.json'), 'utf8')) as { companies: Company[] };
const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10); let d = new Date(today + 'T00:00:00Z'); while (d.getUTCDay() !== 5) d = new Date(+d - 864e5); let run_date = d.toISOString().slice(0, 10);
while (!isSession(run_date)) run_date = new Date(+new Date(run_date) - 864e5).toISOString().slice(0, 10);          // a Friday holiday: the previous session
mkdirSync(join(dir, 'runs'), { recursive: true }); mkdirSync(join(dir, 'detail'), { recursive: true }); let bad = 0;
for (const s of SCREENS) {
  const file = join(dir, 'runs', `${s.id}__${run_date}.json`); if (existsSync(file)) { console.log(`${s.id}: run of ${run_date} already exists; not rewritten`); continue; }
  const r = s.run(f.companies); const ns = r.not_scorable.length / Math.max(1, r.universe_n);
  if (ns > 0.35) { console.error(`${s.id}: ${(ns * 100).toFixed(0)}% not scorable; refusing to publish`); bad++; continue; }
  writeFileSync(file, JSON.stringify({ screen_id: s.id, run_date, passed: r.passed, near_miss: r.near_miss.slice(0, 25), refused: r.refused, universe_n: r.universe_n, not_scorable_n: r.not_scorable.length }));
  const names = new Set([...r.passed, ...r.near_miss.map((n) => n.symbol)]); const stocks: Record<string, unknown> = {};
  for (const n of names) { const c = f.companies.find((x) => x.symbol === n); stocks[n] = { ...r.detail[n], name: c?.name, sector: c?.sector }; }
  writeFileSync(join(dir, 'detail', `${s.id}__${run_date}.json`), JSON.stringify({ screen_id: s.id, run_date, stocks }));
  console.log(`${s.id}: ${r.passed.length} pass, ${r.near_miss.length} near, ${r.not_scorable.length} not scorable of ${r.universe_n}`);
}
process.exit(bad ? 1 : 0);
