// Runs the four screens on the owner's daily feed, then applies the book (ADR-014) to decide which passers become the open calls.
// Writes, per screen: ledger/runs/<screen>__<date>.json (passed, taken, skipped with reasons, near misses, counts) and ledger/detail/<screen>__<date>.json
// (per-rule results for taken and near-miss names, for the stock pages). run_date = the feed's price date (the latest close). A run that exists is never rewritten.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'; import { join } from 'node:path';
import { loadFeed, num, type Row } from '../src/lib/feed.ts'; import { runAllFeed } from '../src/lib/feedscreens.ts'; import { selectCalls, type Cand, type Held } from '../src/lib/book.ts'; import { SCREENS } from '../src/lib/screens.ts'; import type { Ledger } from '../src/lib/ledger.ts';
const F = loadFeed(), dir = join(process.cwd(), 'ledger'); mkdirSync(join(dir, 'runs'), { recursive: true }); mkdirSync(join(dir, 'detail'), { recursive: true });
const runs = runAllFeed(F); const name = (id: string) => SCREENS.find((s) => s.id === id)?.name ?? id;
if (runs.every((r) => existsSync(join(dir, 'runs', `${r.screen_id}__${F.asOf}.json`)))) { console.log(`runs of ${F.asOf} already exist; not rewritten`); process.exit(0); }
// positions still held after this run: an open or pending pick stays while its own screen still lists the name
const ledger: Ledger | null = existsSync(join(dir, 'ledger.json')) ? JSON.parse(readFileSync(join(dir, 'ledger.json'), 'utf8')) : null; const passedBy = new Map(runs.map((r) => [r.screen_id, new Set(r.passed)]));
const heldPicks = (ledger?.picks ?? []).filter((p) => (p.status === 'open' || p.status === 'pending') && passedBy.get(p.screen_id)?.has(p.symbol)); const held: Held[] = heldPicks.map((p) => ({ symbol: p.symbol, sector: (F.bySym.get(p.symbol) as Row | undefined)?.sector ?? null }));
const by = new Map<string, Cand>(); for (const r of runs) for (const s of r.passed) { const row = F.bySym.get(s)!; const c = by.get(s) ?? { symbol: s, screens: [], score: num(row, 'comp') ?? 0, sector: row.sector ?? null, price: num(row, 'price') }; c.screens.push(r.screen_id); by.set(s, c); }
const decisions = selectCalls([...by.values()], held); const dec = new Map(decisions.map((d) => [d.symbol, d]));
for (const r of runs) {
  const file = join(dir, 'runs', `${r.screen_id}__${F.asOf}.json`); if (existsSync(file)) continue;
  const mine = new Set(heldPicks.filter((p) => p.screen_id === r.screen_id).map((p) => p.symbol));
  const taken = r.passed.filter((s) => dec.get(s)?.taken && dec.get(s)!.screen_id === r.screen_id); const near = r.near_miss.slice(0, 25);
  const skipped = r.passed.filter((s) => !taken.includes(s) && !mine.has(s)).map((s) => { const d = dec.get(s)!; return { symbol: s, why: d.taken ? `Taken under ${name(d.screen_id)}, the first screen to list it.` : d.why! }; });
  writeFileSync(file, JSON.stringify({ screen_id: r.screen_id, run_date: F.asOf, passed: r.passed, taken, skipped, near_miss: near, refused: near.map((n) => n.symbol), universe_n: r.universe_n, not_scorable_n: r.not_scorable.length }));
  const stocks: Record<string, unknown> = {}; for (const s of [...taken, ...near.map((n) => n.symbol)]) { const row = F.bySym.get(s); stocks[s] = { ...r.detail[s], name: row?.name, sector: row?.sector }; }
  writeFileSync(join(dir, 'detail', `${r.screen_id}__${F.asOf}.json`), JSON.stringify({ screen_id: r.screen_id, run_date: F.asOf, stocks }));
  console.log(`${r.screen_id}: ${r.passed.length} pass → ${taken.length} taken as calls, ${skipped.length} passed but not taken, ${near.length} near miss, ${r.not_scorable.length} not scorable of ${r.universe_n}`);
}
const t = decisions.filter((d) => d.taken); console.log(`book: ${held.length} held + ${t.length} new = ${held.length + t.length} of 30 open; refused ${decisions.length - t.length}`);
