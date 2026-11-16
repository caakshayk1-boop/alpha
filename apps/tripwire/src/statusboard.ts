/** The status board (16 Nov 2026), patterns taken from a retired paper bot's health page (docs/tripwire/brain/APEXBOT-INSPIRATIONS.md): one honest page of per-feed age, the gate and its reason,
 *  book risk, a plain alert list, nightly-job health and cross-checks between the feeds. Pure and read-only: every figure is derived from the ledger, the plan, the feeds and the clock the app already reads.
 *  No rule, threshold, cost or stored shape changes here; a figure that cannot be measured is null and says so. */
import type { Ledger } from './ledger.ts';
import { MAX_OPEN_NOW, SECTOR_CAP, type AutoPlan } from './autobook.ts';
import { buildLedgerView, type LedgerView } from './ledgerview.ts';
import { missingNights, missingNightsLine } from './bookview.ts';
import { sessionsBetween } from './calendar.ts';
import { sessionsBehind, throughWord, type FileVerdict } from './freshness.ts';
import type { GateLine } from './components/gate.ts';

/** Carried in every status payload so no copy of it can be read as a live trading account. */
export const PAPER = true as const;
export const PAPER_WORDS = 'Paper only. Simulated positions, not investment advice, and nothing here places an order.';

const r2 = (v: number): number => Math.round(v * 100) / 100;

/* ---------- 3. book risk ---------- */
export interface RiskName { sym: string; engine: string; risk: number; share: number }
export interface BookRisk {
  slotsUsed: number; slotsMax: number; open: number; awaiting: number;
  /** shares × (entry − the original stop) over open positions: what the book stood to lose at the first stop. Awaiting positions have no fill, so no risk figure. */
  initialRisk: number | null; measured: number; unmeasured: number;
  largest: RiskName | null; bySector: { sector: string; n: number; atCap: boolean }[]; basis: string;
}
export function bookRisk(l: Ledger, plan: Pick<AutoPlan, 'taken'>, sectorOf: (sym: string) => string | null, lv: LedgerView = buildLedgerView(l, plan), maxOpen = MAX_OPEN_NOW): BookRisk {
  const qty = new Map(plan.taken.map((t) => [t.pick.id, t.qty])); const held = lv.lifecycles.filter((x) => x.owner === 'engine' && (x.state === 'open' || x.state === 'awaiting'));
  const names: RiskName[] = []; let unmeasured = 0;
  for (const x of held) {
    const p = plan.taken.find((t) => t.pick.id === x.pickId)?.pick; const o = l.outcomes[x.pickId]; const q = qty.get(x.pickId);
    if (x.state !== 'open' || !p || !o || typeof o.entry !== 'number' || q == null) { if (x.state === 'open') unmeasured++; continue; }
    names.push({ sym: x.sym, engine: x.engine, risk: r2(q * Math.abs(o.entry - p.stop)), share: 0 });
  }
  const total = names.length ? r2(names.reduce((s, n) => s + n.risk, 0)) : null;
  for (const n of names) n.share = total ? Math.round((n.risk / total) * 1000) / 10 : 0;
  const sec = new Map<string, number>(); for (const x of held) { const s = sectorOf(x.sym) ?? 'Sector not published'; sec.set(s, (sec.get(s) ?? 0) + 1); }
  return {
    slotsUsed: lv.awaiting + lv.open, slotsMax: maxOpen, open: lv.open, awaiting: lv.awaiting, initialRisk: total, measured: names.length, unmeasured,
    largest: names.length ? names.slice().sort((a, b) => b.risk - a.risk || a.sym.localeCompare(b.sym))[0] : null,
    bySector: [...sec].map(([sector, n]) => ({ sector, n, atCap: sector !== 'Sector not published' && n >= SECTOR_CAP })).sort((a, b) => b.n - a.n || a.sector.localeCompare(b.sector)),
    basis: 'Shares times the gap between the simulated entry and the original stop, for open book positions. A partial exit or a moved stop is not reflected: this is the risk the position started with.',
  };
}

/* ---------- 8. nightly job health ---------- */
export interface NightlyHealth { nights: number; first: string | null; last: string | null; recorded: string | null; behind: number | null; gaps: string[]; gapLine: string | null; line: string }
export function nightlyHealth(l: Ledger, nowMs = Date.now()): NightlyHealth {
  const days = l.days.map((d) => d.asOf).filter(Boolean).sort(); const last = days.length ? days[days.length - 1] : null; const rec = l.days.length ? l.days[l.days.length - 1].recorded ?? null : null;
  const gaps = missingNights(days); const behind = sessionsBehind(last, nowMs);
  const line = !last ? 'The nightly job has not recorded a night yet.' : `${days.length} nights recorded, the latest for ${throughWord(last)}${behind ? `, ${behind} session${behind === 1 ? '' : 's'} behind the market` : ', up to date'}.`;
  return { nights: days.length, first: days[0] ?? null, last, recorded: rec, behind, gaps, gapLine: missingNightsLine(gaps), line };
}

/* ---------- 9. cross-checks between feeds ---------- */
export interface Check { id: string; ok: boolean | null; line: string }
export interface CrossIn { screenAsOf: string | null; ledgerAsOf: string | null; signalsThrough: string | null; screenSyms: ReadonlySet<string> | null; bookSyms: readonly string[] }
const gapWord = (a: string, b: string): string => { const lo = a < b ? a : b, hi = a < b ? b : a; const n = sessionsBetween(lo, hi); return `${n} session${n === 1 ? '' : 's'}`; };
export function crossChecks(i: CrossIn): Check[] {
  const out: Check[] = []; const pair = (id: string, name: string, other: string | null) => {
    if (!i.screenAsOf || !other) out.push({ id, ok: null, line: `${name}: cannot be compared, one of the two dates is missing.` });
    else if (other === i.screenAsOf) out.push({ id, ok: true, line: `${name}: both carry ${throughWord(other)}.` });
    else out.push({ id, ok: false, line: `${name}: the screen carries ${throughWord(i.screenAsOf)} and the other ${throughWord(other)}, ${gapWord(i.screenAsOf, other)} apart.` });
  };
  pair('ledger-day', 'Ledger against screen', i.ledgerAsOf); pair('signals-day', 'Signals against screen', i.signalsThrough);
  if (!i.screenSyms || !i.screenSyms.size) out.push({ id: 'book-on-screen', ok: null, line: 'Book names against the screen: the screen is not loaded, so this was not checked.' });
  else { const off = [...new Set(i.bookSyms)].filter((s) => !i.screenSyms!.has(s)).sort(); out.push({ id: 'book-on-screen', ok: off.length === 0, line: off.length ? `Book names missing from the screen: ${off.slice(0, 6).join(', ')}${off.length > 6 ? ` and ${off.length - 6} more` : ''}. The screen may have dropped or renamed them.` : `Every one of the ${new Set(i.bookSyms).size} held names is on the screen.` }); }
  return out;
}

/* ---------- 4. alerts (a list derived from facts, never stored) ---------- */
export interface Alert { id: string; level: 'attention' | 'note'; text: string }
export function alertsOf(i: { files: readonly FileVerdict[]; gate: GateLine | null; voided: number; nightly: NightlyHealth; checks: readonly Check[]; risk: BookRisk | null }): Alert[] {
  const a: Alert[] = [];
  for (const f of i.files) if (f.status === 'stale' || f.status === 'unknown' || f.status === 'missing') a.push({ id: `feed-${f.id}`, level: 'attention', text: f.status === 'missing' ? `${f.label}: not published.` : f.status === 'unknown' ? `${f.label}: the date cannot be read.` : `${f.label}: ${f.behind ?? '?'} session${f.behind === 1 ? '' : 's'} behind (data through ${throughWord(f.asOf)}).` });
  if (i.nightly.gapLine) a.push({ id: 'nights-missing', level: 'attention', text: i.nightly.gapLine });
  for (const c of i.checks) if (c.ok === false) a.push({ id: `check-${c.id}`, level: 'attention', text: c.line });
  if (i.risk) { const capped = i.risk.bySector.filter((s) => s.atCap); if (capped.length) a.push({ id: 'sector-cap', level: 'note', text: `${capped.length === 1 ? '1 sector holds' : `${capped.length} sectors hold`} the book's per-sector limit of ${SECTOR_CAP} positions: ${capped.map((s) => s.sector).join(', ')}.` }); }
  if (i.gate) a.push({ id: 'gate', level: 'note', text: i.gate.text });
  if (i.voided > 0) a.push({ id: 'voided', level: 'note', text: `${i.voided} pick${i.voided === 1 ? ' is' : 's are'} voided, with the reason on the Record page, and counted in no total.` });
  return a.sort((x, y) => (x.level === y.level ? 0 : x.level === 'attention' ? -1 : 1));
}

/* ---------- 7. the facts file the build writes (facts only: the STATUS of a feed is always computed from the clock by the reader) ---------- */
export interface StatusFacts { schema: 'tripwire-status/1'; paper: true; note: string; built: string | null; screen: { asOf: string | null; builtAt: string | null; rows: number | null }; signals: { dataThrough: string | null; gateOn: boolean | null; checksPassed: number | null; checksTotal: number | null } }
export function statusFacts(screen: { as_of?: string | null; built_at?: string | null; rows?: unknown[] | null } | null, signals: { data_through?: string | null; gate?: { on?: boolean; passed?: number; checks?: unknown[] } | null } | null, builtIso: string | null): StatusFacts {
  const g = signals?.gate ?? null;
  return { schema: 'tripwire-status/1', paper: PAPER, note: PAPER_WORDS, built: builtIso, screen: { asOf: screen?.as_of ?? null, builtAt: screen?.built_at ?? null, rows: Array.isArray(screen?.rows) ? screen!.rows!.length : null }, signals: { dataThrough: signals?.data_through ?? null, gateOn: typeof g?.on === 'boolean' ? g.on : null, checksPassed: typeof g?.passed === 'number' ? g.passed : null, checksTotal: Array.isArray(g?.checks) ? g!.checks!.length : null } };
}
