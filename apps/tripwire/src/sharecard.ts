/** Ladder Share Cards (Tripwire 4.0, F8): the model and the picture of one card. Pure; the build (tools/sharecards.mjs) writes the files.
 *  A card shows ONLY figures the site itself shows for the same snapshot: the ladder levels (levels.ts, the one definition of the stop and both targets), the R state, the as-of date, and the words "paper only".
 *  It carries no return claim, no call to act and no figure of its own. */
import type { Ledger, LedgerPick, Outcome } from './ledger.ts';
import { levelsFor } from './levels.ts';
import { rLevel } from './tracker.ts';
import { buildLedgerView } from './ledgerview.ts';
import { scoreboard, traceOf, fmtR } from './glassbook.ts';
import type { AutoPlan } from './autobook.ts';

export interface Rung { label: 'Stop' | 'Entry' | 'Signal close' | 'T1' | 'T2'; v: number }
export interface PickCard { kind: 'pick'; sym: string; engine: string; rungs: Rung[]; /** where the last price sits on the ladder in R, null before a fill or a mark */ nowR: number | null; stateLine: string; asOf: string; basis: 'entry' | 'signal' }
export interface BookCard { kind: 'book'; open: number; closed: number; totalR: number | null; sampleLine: string; asOf: string }
export const PAPER = 'Paper only · not investment advice';
const inr = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export { inr as cardInr };

/** The cards for a snapshot: one per OPEN paper pick (entered, or awaiting its entry) and one for the book. Skipped and closed positions have no card. */
export function pickCards(l: Ledger, plan: Pick<AutoPlan, 'taken'>): PickCard[] {
  const out: PickCard[] = [];
  for (const t of plan.taken) {
    const p: LedgerPick = t.pick; const o: Outcome | undefined = l.outcomes[p.id];
    if (o && (o.final || o.status === 'closed' || o.status === 'skipped' || o.status === 'void')) continue;
    const entered = !!o && o.status === 'open' && typeof o.entry === 'number';
    const lv = levelsFor(p.sym, [{ ...p, final: false, entry: entered ? o!.entry! : null }]); if (!lv.length) continue;
    const rungs: Rung[] = lv.map((x) => ({ label: (x.kind === 'stop' ? 'Stop' : x.kind === 'signal' ? (x.label as 'Entry' | 'Signal close') : x.label.startsWith('T1') ? 'T1' : 'T2') as Rung['label'], v: x.v }));
    const nowR = entered && typeof o!.mark === 'number' ? rLevel(o!.mark, o!.entry!, p.stop) : null;
    const stateLine = !entered ? 'Awaiting entry at the next open' : o!.t1Hit ? `Target 1 filled · stop at entry${nowR != null ? ` · ${fmtR(Math.round(nowR * 100) / 100)} at the last mark` : ''}` : nowR != null ? `Open · ${fmtR(Math.round(nowR * 100) / 100)} at the last mark` : 'Open · not yet marked';
    out.push({ kind: 'pick', sym: p.sym, engine: p.engine, rungs, nowR: nowR == null ? null : Math.round(nowR * 100) / 100, stateLine, asOf: entered ? o!.markDay ?? p.asOf : p.asOf, basis: entered ? 'entry' : 'signal' });
  }
  return out.sort((a, b) => a.sym.localeCompare(b.sym));
}
export function bookCard(l: Ledger, plan: Pick<AutoPlan, 'taken'>): BookCard {
  const lv = buildLedgerView(l, plan); const sb = scoreboard(l, plan, lv);
  const last = l.days.length ? l.days.reduce((m, d) => (d.asOf > m ? d.asOf : m), l.days[0].asOf) : '';
  return { kind: 'book', open: lv.open, closed: lv.closed, totalR: traceOf(l, plan, 'totalR', lv).value, sampleLine: sb.sampleLine, asOf: last };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export interface Palette { bg: string; surface: string; ink: string; ink2: string; ink3: string; accent: string; up: string; down: string; line: string }
const W = 1200, H = 630, PAD = 64;

/** The ladder, drawn as the brand motif: stop, entry (or signal close), T1, T2 on one rail, positioned in price. */
export function pickSvg(c: PickCard, pal: Palette): string {
  const lo = Math.min(...c.rungs.map((r) => r.v)), hi = Math.max(...c.rungs.map((r) => r.v)); const x = (v: number) => PAD + 40 + ((v - lo) / (hi - lo || 1)) * (W - 2 * PAD - 80); const y = 380;
  const marks = c.rungs.map((r, i) => { const px = x(r.v); const col = r.label === 'Stop' ? pal.down : r.label === 'T1' || r.label === 'T2' ? pal.up : pal.accent; const up = i % 2 === 0;
    return `<line x1="${px}" y1="${y - 18}" x2="${px}" y2="${y + 18}" stroke="${col}" stroke-width="4"/><circle cx="${px}" cy="${y}" r="9" fill="${col}"/><text x="${px}" y="${up ? y - 34 : y + 56}" fill="${pal.ink2}" font-size="24" text-anchor="middle" font-family="sans-serif">${esc(r.label)}</text><text x="${px}" y="${up ? y - 62 : y + 86}" fill="${pal.ink}" font-size="28" font-weight="700" text-anchor="middle" font-family="monospace">${esc(inr(r.v))}</text>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${c.sym} ladder: ${c.rungs.map((r) => `${r.label} ${inr(r.v)}`).join(', ')}. ${PAPER}`)}">
<rect width="${W}" height="${H}" fill="${pal.bg}"/><rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="24" fill="${pal.surface}" stroke="${pal.line}"/>
<text x="${PAD}" y="110" fill="${pal.ink3}" font-size="24" letter-spacing="3" font-family="monospace">TRIPWIRE · ${esc(c.engine)} PICK</text>
<text x="${PAD}" y="190" fill="${pal.ink}" font-size="76" font-weight="700" font-family="sans-serif">${esc(c.sym)}</text>
<text x="${PAD}" y="240" fill="${pal.ink2}" font-size="30" font-family="sans-serif">${esc(c.stateLine)}</text>
<line x1="${PAD + 40}" y1="${y}" x2="${W - PAD - 40}" y2="${y}" stroke="${pal.line}" stroke-width="6" stroke-linecap="round"/>${marks}
<text x="${PAD}" y="${H - 70}" fill="${pal.ink3}" font-size="22" font-family="monospace">${c.basis === 'entry' ? 'Levels from the simulated fill' : 'Levels at signal close; they move with the next open'} · ${esc(c.asOf)}</text>
<text x="${PAD}" y="${H - 38}" fill="${pal.accent}" font-size="26" font-weight="700" font-family="sans-serif">${esc(PAPER)}</text></svg>`;
}
export function bookSvg(c: BookCard, pal: Palette): string {
  const r = c.totalR == null ? 'No closed positions yet' : fmtR(c.totalR);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Tripwire paper book: ${c.open} open, ${c.closed} closed, total ${r}. ${PAPER}`)}">
<rect width="${W}" height="${H}" fill="${pal.bg}"/><rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="24" fill="${pal.surface}" stroke="${pal.line}"/>
<text x="${PAD}" y="110" fill="${pal.ink3}" font-size="24" letter-spacing="3" font-family="monospace">TRIPWIRE · THE GLASS BOOK</text>
<text x="${PAD}" y="210" fill="${pal.ink}" font-size="64" font-weight="700" font-family="sans-serif">${c.open} open · ${c.closed} closed</text>
<text x="${PAD}" y="290" fill="${c.totalR == null ? pal.ink2 : c.totalR >= 0 ? pal.up : pal.down}" font-size="56" font-weight="700" font-family="monospace">${esc(c.totalR == null ? r : `Total ${r}`)}</text>
<text x="${PAD}" y="360" fill="${pal.ink2}" font-size="28" font-family="sans-serif">${esc(c.sampleLine.length > 96 ? `${c.sampleLine.slice(0, 93)}…` : c.sampleLine)}</text>
<text x="${PAD}" y="${H - 70}" fill="${pal.ink3}" font-size="22" font-family="monospace">Ledger through ${esc(c.asOf)} · every number traces to its events</text>
<text x="${PAD}" y="${H - 38}" fill="${pal.accent}" font-size="26" font-weight="700" font-family="sans-serif">${esc(PAPER)}</text></svg>`;
}
