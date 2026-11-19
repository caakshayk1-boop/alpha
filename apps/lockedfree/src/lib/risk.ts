/** Book risk, from the ledger's own fills and stops (ADR-022; idea from the Apex terminal's risk manager). Pure; no price is needed, so it is exact between sessions.
 *  "Risk at stops" is what the open calls would lose, before charges, if every one were stopped out at its initial stop. Shown, not enforced: there is no risk cap rule. */
import type { Ledger } from './ledger.ts';
export interface BookRisk { open: number; maxOpen: number; deployed: number; deployedPct: number; riskAtStops: number; riskPct: number; largest: { symbol: string; pct: number } | null; topSector: { name: string; n: number; pct: number } | null; capital: number }
export function bookRisk(L: Ledger, sectorOf: (sym: string) => string): BookRisk | null {
  const capital = L.config.capital; if (!capital) return null; const open = L.picks.filter((p) => p.status === 'open' && p.fills.length && p.stop != null);
  let deployed = 0, risk = 0, largest: BookRisk['largest'] = null; const bySec = new Map<string, number>(); const cost: Record<string, number> = {};
  for (const p of open) { const f = p.fills[0], c = f.qty * f.price; deployed += c; risk += f.qty * Math.max(0, f.price - (p.stop as number)); cost[p.symbol] = c; bySec.set(sectorOf(p.symbol), (bySec.get(sectorOf(p.symbol)) ?? 0) + c); }
  for (const [symbol, c] of Object.entries(cost)) if (!largest || c > cost[largest.symbol]) largest = { symbol, pct: (c / capital) * 100 };
  let top: BookRisk['topSector'] = null; for (const [name, c] of bySec) if (!top || c > (bySec.get(top.name) ?? 0)) top = { name, n: open.filter((p) => sectorOf(p.symbol) === name).length, pct: (c / capital) * 100 };
  return { open: open.length, maxOpen: L.config.max_open ?? 0, deployed: Math.round(deployed), deployedPct: (deployed / capital) * 100, riskAtStops: Math.round(risk), riskPct: (risk / capital) * 100, largest, topSector: top, capital };
}
