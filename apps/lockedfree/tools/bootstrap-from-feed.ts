// Starts the public record from the feed's close, once. Reads ledger/runs/*.json, fills each listed name at the feed's closing price on the run date (ADR-013),
// writes ledger/ledger.json, a dated snapshot and marks. No price history or benchmark exists for these names yet; the nightly job adds real bars from the next night.
// Refuses to run on a ledger that already has runs (history is append-only).
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
import { buildNext, emptyLedger, validate, assertAppendOnly, type Bars, type RunIn, type Ledger } from '../src/lib/ledger.ts'; import { SCREENS } from '../src/lib/screens.ts'; import { loadFeed, num } from '../src/lib/feed.ts';
const dir = join(process.cwd(), 'ledger'), file = join(dir, 'ledger.json'); const prev: Ledger = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : emptyLedger();
if (prev.runs.length) { console.log('ledger already started; nothing to do'); process.exit(0); }
const F = loadFeed(); const runs: RunIn[] = readdirSync(join(dir, 'runs')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, 'runs', f), 'utf8')) as RunIn).filter((r) => r.run_date === F.asOf);
if (runs.length !== SCREENS.length) { console.error(`expected ${SCREENS.length} runs for ${F.asOf}, found ${runs.length}; run tools/run-screens-feed.ts first`); process.exit(1); }
const bars: Bars = {}, marks: Record<string, number> = {}; for (const r of runs) for (const s of r.taken ?? r.passed) { const px = num(F.bySym.get(s), 'price'); if (px != null) { bars[s] = { [F.asOf]: { o: px, h: px, l: px, c: px } }; marks[s] = px; } }
const next = buildNext(prev, { as_of: F.asOf, built_on: new Date().toISOString(), runs, bars, benchmark_close: null, screens: SCREENS.map((s) => ({ id: s.id, name: s.name, version: s.version, started_on: F.asOf })) });
const bad = [...validate(next), ...assertAppendOnly(prev, next)]; if (bad.length) { console.error(bad.join('; ')); process.exit(1); }
writeFileSync(file, JSON.stringify(next, null, 1) + '\n'); mkdirSync(join(dir, 'snapshots'), { recursive: true }); writeFileSync(join(dir, 'snapshots', `${F.asOf}.json`), JSON.stringify(next) + '\n'); writeFileSync(join(dir, 'marks.json'), JSON.stringify(marks));
const a = next.aggregates.find((x) => x.screen_id === 'all')!; console.log(`record started ${F.asOf}: ${next.picks.length} picks (${next.picks.filter((p) => p.status === 'open').length} open at today's close, ${next.picks.filter((p) => p.status === 'pending').length} pending, no price), ${next.voids.length} voids`, JSON.stringify({ n_closed: a.n_closed }));
