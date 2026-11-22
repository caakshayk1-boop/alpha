// Builds tonight's ledger: previous ledger.json + bars.json + any run files -> next ledger.json, if and only if every gate passes.
// Gates: schema valid, history append-only, as_of is the latest session the benchmark traded, >= 85% of requested names have a bar for as_of.
// A failing night writes nothing and exits 1 (the workflow goes red); the site keeps serving the last good file. Also writes ledger/snapshots/<as_of>.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildNext, emptyLedger, validate, assertAppendOnly, type Ledger, type RunIn } from '../src/lib/ledger.ts';
import { isSession, covered } from '../src/lib/calendar.ts';
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'ledger');
const read = <T,>(f: string): T | null => (existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), 'utf8')) : null);
const fail = (m: string): never => { console.error('LEDGER NOT WRITTEN: ' + m); process.exit(1); };

const prev = read<Ledger>('ledger.json') ?? emptyLedger();
const raw = read<{ benchmark: Record<string, number>; bars: Record<string, Record<string, { o: number; h: number; l: number; c: number }>>; missing: string[]; fetched_at: string }>('bars.json');
if (!raw) fail('ledger/bars.json is missing; run tools/fetch_bars.py first');
const asOf = Object.keys(raw!.benchmark).sort().pop()!;
if (!covered(asOf)) fail(`the exchange calendar does not cover ${asOf}; refresh src/lib/calendar.ts`);
if (!isSession(asOf)) fail(`${asOf} is not an NSE session by our calendar but the benchmark traded: check the calendar`);
if (prev.as_of && asOf < prev.as_of) fail(`as_of ${asOf} is older than the ledger's ${prev.as_of}`);
const runsDir = join(dir, 'runs'); const seen = new Set(prev.runs.map((r) => `${r.screen_id}|${r.run_date}`));
const runs: RunIn[] = existsSync(runsDir) ? readdirSync(runsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(runsDir, f), 'utf8')) as RunIn).filter((r) => !seen.has(`${r.screen_id}|${r.run_date}`)) : [];
const asked = Object.keys(raw!.bars).length + raw!.missing.length;
if (asked > 0) { const fresh = Object.values(raw!.bars).filter((b) => b[asOf]).length / asked; if (fresh < 0.85) fail(`only ${(fresh * 100).toFixed(0)}% of requested names have a bar for ${asOf} (need 85%)`); }
const next = buildNext(prev, { as_of: asOf, built_on: new Date().toISOString(), runs, bars: raw!.bars, benchmark_close: raw!.benchmark[asOf] ?? null });
// The benchmark's close on the record's first book day: stored once, beside (not inside) the append-only book days. The fetch step downloads a year of benchmark closes, so the first day's close is available whenever the first night's build missed it.
const day0 = next.book_days[0]?.date, close0 = day0 ? raw!.benchmark[day0] : undefined;
if (!next.benchmark_start && day0 && typeof close0 === 'number' && close0 > 0) next.benchmark_start = { date: day0, close: close0, source: `Yahoo ^CRSLDX daily close for ${day0}, recorded ${asOf}` };
const problems = [...validate(next), ...assertAppendOnly(prev, next)];
if (problems.length) fail(problems.join('; '));
writeFileSync(join(dir, 'ledger.json'), JSON.stringify(next, null, 1) + '\n');
mkdirSync(join(dir, 'snapshots'), { recursive: true });
writeFileSync(join(dir, 'snapshots', `${asOf}.json`), JSON.stringify(next) + '\n');
// marks for open/pending picks and one-year closes for names on the pages (stock charts); a missing name simply has no file
const marks: Record<string, number> = {}; mkdirSync(join(dir, 'prices'), { recursive: true });
for (const [sym, b] of Object.entries(raw!.bars)) { const ds = Object.keys(b).filter((x) => x <= asOf).sort(); if (!ds.length) continue; marks[sym] = b[ds.at(-1)!].c; writeFileSync(join(dir, 'prices', `${sym}.json`), JSON.stringify(ds.map((x) => ({ date: x, c: b[x].c })))); }
writeFileSync(join(dir, 'marks.json'), JSON.stringify(marks));
console.log(`ledger as of ${asOf}: ${next.picks.length} picks, ${next.book_days.length} book days, ${runs.length} new runs`);
