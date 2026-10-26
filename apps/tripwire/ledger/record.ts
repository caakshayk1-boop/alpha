// The nightly job, in two steps around a Python fetch (bars.py, through yfinance: a raw request to Yahoo from a CI runner is refused).
//   record    run the three engines on the latest published screen, write down every pick once per data day, list the symbols still needed
//   evaluate  replay every unfinished pick against the fetched daily bars and the Nifty
// Writes apps/tripwire/ledger/ledger.json. `evaluate` exits non-zero when it could not get most of the prices it needed, so a blind night
// turns the workflow red instead of passing quietly.
// Usage: node apps/tripwire/build.mjs && node --experimental-strip-types apps/tripwire/ledger/record.ts record
//        python apps/tripwire/ledger/bars.py && node --experimental-strip-types apps/tripwire/ledger/record.ts evaluate
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { runAll, type Q } from '../src/quant.ts';
import { applyCorrections, emptyLedger, evaluateLedger, record, summarizeLedger, type Correction, type Ledger } from '../src/ledger.ts';
import type { Bar } from '../src/tracker.ts';

const here = (f: string) => new URL(f, import.meta.url);
const mode = process.argv[2];
const now = new Date().toISOString();
const cost = (() => { try { return JSON.parse(readFileSync(here('../dist/data/signals.json'), 'utf8')).cost_round_trip_pct ?? 0.25; } catch { return 0.25; } })();
let ledger: Ledger = existsSync(here('./ledger.json')) ? JSON.parse(readFileSync(here('./ledger.json'), 'utf8')) : emptyLedger(now, cost);
const fixes: Correction[] = existsSync(here('./corrections.json')) ? JSON.parse(readFileSync(here('./corrections.json'), 'utf8')) : [];
ledger = applyCorrections(ledger, fixes);
const unfinished = () => [...new Set(ledger.picks.filter((p) => !ledger.outcomes[p.id]?.final && !ledger.voided?.[p.id]).map((p) => p.sym))];

if (mode === 'record') {
  const screen = JSON.parse(readFileSync(here('../dist/data/screen.json'), 'utf8')) as { as_of: string; rows: Q[] };
  const { runs } = runAll(screen.rows, screen.as_of);
  const rec = record(ledger, runs, screen.as_of, now); ledger = rec.ledger;
  console.log(rec.skipped ? `not recorded: ${rec.skipped} (data through ${screen.as_of})` : `recorded ${rec.added} picks for ${screen.as_of}`);
  writeFileSync(here('./ledger.json'), JSON.stringify(ledger));
  writeFileSync(here('./need.json'), JSON.stringify({ symbols: unfinished() }));
  console.log(`${unfinished().length} symbols still need prices`);
} else if (mode === 'evaluate') {
  const need = unfinished();
  const raw = existsSync(here('./bars.json')) ? (JSON.parse(readFileSync(here('./bars.json'), 'utf8')).bars as Record<string, { t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; forming: boolean } | null>) : {};
  const toBars = (b: NonNullable<(typeof raw)[string]>): Bar[] => b.t.map((t, i) => ({ t, o: b.o[i], h: b.h[i], l: b.l[i], c: b.c[i], forming: b.forming && i === b.t.length - 1 }));
  const got: Record<string, Bar[] | null> = {}; for (const s of need) got[s] = raw[s] ? toBars(raw[s]!) : null;
  const nifty = raw['^NSEI'] ? toBars(raw['^NSEI']!) : null;
  ledger = evaluateLedger(ledger, got, nifty, now);
  writeFileSync(here('./ledger.json'), JSON.stringify(ledger));
  const s = summarizeLedger(ledger).all; const ok = need.filter((x) => got[x]).length;
  console.log(`bars for ${ok} of ${need.length} symbols; nifty ${nifty ? 'ok' : 'MISSING'}; ledger: ${ledger.days.length} days, ${s.picks} picks, ${s.closed} closed, ${s.open} open, ${s.skipped} skipped, ${s.pending} pending`);
  if (need.length && (ok < need.length / 2 || !nifty)) { console.error('FAIL: most price data could not be fetched; outcomes were left as they were'); process.exit(1); }
} else { console.error('usage: record.ts record | evaluate'); process.exit(2); }
