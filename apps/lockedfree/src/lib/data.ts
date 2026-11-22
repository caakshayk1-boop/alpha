/** Build-time reads of the ledger folder. RULEBOOK_DATA_DIR points at demo data for local visual checks only (its output goes to dist-demo, never deployed). */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { emptyLedger, validate, type Ledger } from './ledger.ts';
import { SCREENS, type StockResult } from './screens.ts';
import type { Edition } from './edition.ts';
const DIR = process.env.RULEBOOK_DATA_DIR || join(process.cwd(), 'ledger');
export const DEMO = process.env.RULEBOOK_DEMO === '1';
const read = <T,>(f: string): T | null => { const p = join(DIR, f); return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null; };
let cached: Ledger | null = null;
export function ledger(): Ledger { if (cached) return cached; const L = read<Ledger>('ledger.json') ?? emptyLedger(); const bad = validate(L); if (bad.length) throw new Error('ledger.json invalid: ' + bad.join('; ')); return (cached = L); }
export interface Detail { screen_id: string; run_date: string; stocks: Record<string, StockResult & { name?: string; sector?: string }>; }
export function details(screenId: string): Detail[] { const d = join(DIR, 'detail'); if (!existsSync(d)) return []; return readdirSync(d).filter((f) => f.startsWith(screenId + '__')).sort().map((f) => JSON.parse(readFileSync(join(d, f), 'utf8')) as Detail); }
export const prices = (sym: string): { date: string; c: number }[] | null => read<{ date: string; c: number }[]>(`prices/${sym}.json`);
export const screenMeta = (id: string) => SCREENS.find((s) => s.id === id)!;
export function markFn(): (s: string) => number | null { const m = read<Record<string, number>>('marks.json') ?? {}; return (s) => (m[s] ?? null); }
/** Latest published list per screen: what the Plan deploys into and the Gate suggests. Empty list stays empty. */
export function latestLists(): Record<string, { name: string; symbols: string[]; asOf: string | null }> {
  const L = ledger(), out: Record<string, { name: string; symbols: string[]; asOf: string | null }> = {};
  for (const s of SCREENS) { const r = L.runs.filter((x) => x.screen_id === s.id).pop(); out[s.id] = { name: s.name, symbols: r?.listed ?? r?.passed ?? [], asOf: r?.run_date ?? null }; } return out;
}
export function benchmarkLast(): { prev: number | null; last: number | null; asOf: string | null } {
  const d = ledger().book_days.filter((b) => b.screen_id === 'all' && b.benchmark_close).sort((a, b) => a.date.localeCompare(b.date)); const l = d.at(-1), p = d.at(-2);
  return { prev: p?.benchmark_close ?? null, last: l?.benchmark_close ?? null, asOf: l?.date ?? null };
}
/** Every written edition, oldest first (ledger/editions/<date>.json). */
export function editions(): Edition[] { const d = join(DIR, 'editions'); if (!existsSync(d)) return []; return readdirSync(d).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(d, f), 'utf8')) as Edition); }
