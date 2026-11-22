/** One page per paper call (22 Nov 2026): the rule that listed it, the entry, the levels, every daily close since, and the exit with its reason. Every headline number comes from `tradeRows`, the one place
 *  the ledger's performance figures are derived, so a call page can never disagree with the Calls table. Daily closes are the stored closes in ledger/prices; a name without them shows no table, not an invented one. */
import type { Ledger, Pick } from './ledger.ts';
import { tradeRows, dmy, signed, REASON, type TradeRow } from './view.ts';
import { SCREENS } from './screens.ts';
import { ruleText } from './exitrules.ts';

/** The call's permanent address: SYMBOL-entry-date-screen (the listing date while it is still pending). Stable once written: nothing in it changes when the call closes. */
export const callSlug = (p: Pick) => `${p.symbol.replace(/&/g, '_')}-${p.fills[0]?.date ?? p.first_listed_run}-${p.screen_id}`;
export interface CallMark { date: string; close: number; pct: number; gross: number }
export interface CallModel {
  slug: string; pick: Pick; row: TradeRow; screenName: string; firstListed: string; ruleText: string;
  charges: { kind: string; amount: number }[]; chargesTotal: number; exitCharges: { kind: string; amount: number }[];
  marks: CallMark[];
  /** The one line used under the symbol on the page and on the share image; always says paper, before or after charges, and the date it is as of. */
  headline: string; shareLine: string;
}
const r2 = (x: number) => Math.round(x * 100) / 100;
export function headlineOf(row: TradeRow, p: Pick, asOf: string | null): string {
  if (p.status === 'voided') return `Voided · ${p.voided?.reason ?? 'struck from the record'}`;
  if (p.status === 'pending' || !row.entry) return `Listed ${dmy(p.first_listed_run)} · waiting for the next open`;
  if (p.status === 'closed') return `Closed ${dmy(row.exit)} · ${REASON[p.exit_reason ?? ''] ?? 'closed'} · ${signed(row.pct, 2, '%')} after charges`;
  return `Open since ${dmy(row.entry)} · ${signed(row.gross_pct, 2, '%')} before charges${asOf ? ` at ${dmy(asOf)}` : ''}`;
}
/** A line short enough for the share image (it fits about 40 characters at the card's type size). */
export function shareLineOf(row: TradeRow, p: Pick): string {
  if (p.status === 'voided') return 'Voided, kept on the record';
  if (p.status === 'pending' || !row.entry) return 'Listed, waiting for the next open';
  if (p.status === 'closed') return `${REASON[p.exit_reason ?? ''] ?? 'Closed'} · ${signed(row.pct, 2, '%')} after charges`.slice(0, 44);
  return `Open · ${signed(row.gross_pct, 2, '%')} before charges`;
}
export function callModels(L: Ledger, mark: (s: string) => number | null, series: (sym: string) => { date: string; c: number }[] | null): CallModel[] {
  const rows = new Map(tradeRows(L, mark).map((r) => [r.id, r]));
  return L.picks.map((p) => {
    const row = rows.get(p.id)!, f0 = p.fills[0], end = row.exit ?? L.as_of ?? '';
    const marks: CallMark[] = f0 && row.entry ? (series(p.symbol) ?? []).filter((x) => x.date >= row.entry! && x.date <= end && Number.isFinite(x.c)).map((x) => ({ date: x.date, close: x.c, pct: r2((x.c / f0.price - 1) * 100), gross: r2(f0.qty * (x.c - f0.price)) })) : [];
    const charges = f0?.charges ?? [], exitCharges = p.fills[1]?.charges ?? [];
    return { slug: callSlug(p), pick: p, row, screenName: SCREENS.find((s) => s.id === p.screen_id)?.name ?? p.screen_id, firstListed: p.first_listed_run, ruleText: ruleText(p.screen_id),
      charges, chargesTotal: r2(charges.reduce((s, c) => s + c.amount, 0)), exitCharges, marks, headline: headlineOf(row, p, L.as_of), shareLine: shareLineOf(row, p) };
  });
}
