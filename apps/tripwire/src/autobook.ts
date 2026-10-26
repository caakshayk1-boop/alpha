/** The automatic paper book. Every pick any engine writes down in the nightly record is taken on paper the same night, under two fixed limits:
 *  no more than 30 positions at a time, and no more than ₹1,00,000 in any one of them. Nothing here is chosen by hand and nothing is chosen
 *  with hindsight: it is a pure function of the append-only ledger, so every device shows the same book and it can be replayed.
 *
 *  A pick is taken on the night it is written, in order of score. It is refused, with the reason kept in the log, when
 *    - the symbol is already held by an earlier pick that has not closed;
 *    - one share costs more than the ticket;
 *    - 30 positions are already running (a position runs from its pick night until the day it closes; a pick skipped at the open frees its slot);
 *    - the pick was voided in the record.
 *  Size is the ticket divided by the signal close, rounded down. Entry, stop, time exit and costs are the tracker's, unchanged. */
import type { Ledger, LedgerPick, Outcome } from './ledger.ts';
import { takenAtFor } from './ledger.ts';
import { ENGINES } from './quant.ts';
import { STYLES, styleOf, styleDef, type Style } from './exits.ts';

export const MAX_OPEN = 30;
export const TICKET = 100000;
export interface AutoCfg { maxOpen: number; ticket: number; /** positions allowed per style: 30 = 10 short term + 10 swing + 10 long term */ perStyle: number }
export const DEFAULT_CFG: AutoCfg = { maxOpen: MAX_OPEN, ticket: TICKET, perStyle: Math.floor(MAX_OPEN / STYLES.length) };
export interface AutoPos { pick: LedgerPick; qty: number; takenAt: number }
export interface Refusal { pick: LedgerPick; why: string }
export type EventKind = 'taken' | 'refused' | 'entered' | 'closed' | 'skipped';
export interface LogEvent { day: string; kind: EventKind; sym: string; engine: string; text: string; id: string }
export interface AutoPlan { taken: AutoPos[]; refused: Refusal[]; log: LogEvent[] }

const ENGINE_ORDER: Record<string, number> = { MOM: 0, QLT: 1, LVT: 2 };
const inr0 = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');
const money = (v: number) => `${v < 0 ? '−' : '+'}${inr0(Math.abs(v))}`;

/** Does a position taken earlier still hold a slot on the night `day`? Open or not yet decided: yes. Closed: only if it closes AFTER that night. Skipped at the open: no. */
function holdsSlot(o: Outcome | undefined, day: string): boolean {
  if (!o || o.status === 'pending' || o.status === 'open') return true;
  if (o.status === 'closed') return !!o.exitDay && o.exitDay > day;
  return false;
}
/** Realised P&L of a closed position in rupees. The outcome's % is net of costs and slippage on the amount actually put in (entry times quantity). */
export const realised = (o: Outcome, qty: number): number | null => (o.status === 'closed' && typeof o.pct === 'number' && typeof o.entry === 'number' ? Math.round((o.pct / 100) * o.entry * qty * 100) / 100 : null);

export function planAutoBook(l: Ledger, cfg: AutoCfg = DEFAULT_CFG): AutoPlan {
  const taken: AutoPos[] = []; const refused: Refusal[] = []; const log: LogEvent[] = [];
  const nights = [...new Set(l.picks.map((p) => p.asOf))].sort();
  for (const night of nights) {
    const picks = l.picks.filter((p) => p.asOf === night).sort((a, b) => b.score - a.score || (ENGINE_ORDER[a.engine] ?? 9) - (ENGINE_ORDER[b.engine] ?? 9) || a.sym.localeCompare(b.sym));
    for (const p of picks) {
      const no = (why: string) => { refused.push({ pick: p, why }); log.push({ day: night, kind: 'refused', sym: p.sym, engine: p.engine, id: p.id, text: `Not taken: ${p.sym} (${p.engine}). ${why}` }); };
      const gone = ENGINES.find((e) => e.id === p.engine && e.retired);
      if (gone) { no(`${gone.name} is retired, and the picks it wrote before it was retired came from a rule bug.`); continue; }
      const voidWhy = l.voided?.[p.id]; if (voidWhy) { no(`Voided in the record: ${voidWhy}`); continue; }
      const held = taken.filter((t) => holdsSlot(l.outcomes[t.pick.id], night));
      if (held.some((t) => t.pick.sym === p.sym)) { no('The same name is already held.'); continue; }
      const qty = Math.floor(cfg.ticket / p.ref);
      if (!(p.ref > 0) || qty < 1) { no(`One share costs more than the ${inr0(cfg.ticket)} ticket.`); continue; }
      const st: Style = styleOf(p.horizon);
      if (held.filter((t) => styleOf(t.pick.horizon) === st).length >= cfg.perStyle) { no(`The ${styleDef(st).label} sleeve is full: ${cfg.perStyle} positions are running.`); continue; }
      if (held.length >= cfg.maxOpen) { no(`The book is full: ${cfg.maxOpen} positions are running.`); continue; }
      taken.push({ pick: p, qty, takenAt: takenAtFor(night) });
      log.push({ day: night, kind: 'taken', sym: p.sym, engine: p.engine, id: p.id, text: `Taken: ${p.sym} (${p.engine}), ${qty} shares, about ${inr0(qty * p.ref)} at the signal close of ${inr0(p.ref)}, stop ${inr0(p.stop)}. Enters at the next open.` });
    }
  }
  for (const t of taken) {
    const o = l.outcomes[t.pick.id]; if (!o) continue; const p = t.pick;
    if (o.status === 'skipped') log.push({ day: o.entryDay ?? p.asOf, kind: 'skipped', sym: p.sym, engine: p.engine, id: p.id, text: `Skipped at the open: ${p.sym}. ${(o.skipReason ?? 'The entry rule was not met').replace(/\.$/, '')}. No trade was opened.` });
    if ((o.status === 'open' || o.status === 'closed') && o.entryDay) log.push({ day: o.entryDay, kind: 'entered', sym: p.sym, engine: p.engine, id: p.id, text: `Entered: ${p.sym} (${p.engine}) at ${inr0(o.entry ?? 0)}.` });
    if (o.status === 'closed' && o.exitDay) { const pnl = realised(o, t.qty); log.push({ day: o.exitDay, kind: 'closed', sym: p.sym, engine: p.engine, id: p.id, text: `Closed: ${p.sym} (${p.engine}) at ${inr0(o.exit ?? 0)}. ${(o.reason ?? '').replace(/\.$/, '')}${o.reason ? '. ' : ''}${pnl != null ? `P&L ${money(pnl)}` : ''}${typeof o.r === 'number' ? `${pnl != null ? ', ' : ''}${o.r > 0 ? '+' : o.r < 0 ? '−' : ''}${Math.abs(o.r).toFixed(2)}R` : ''}.` }); }
  }
  const order: Record<EventKind, number> = { closed: 0, entered: 1, skipped: 2, taken: 3, refused: 4 };
  log.sort((a, b) => b.day.localeCompare(a.day) || order[a.kind] - order[b.kind] || a.sym.localeCompare(b.sym));
  return { taken, refused, log };
}
