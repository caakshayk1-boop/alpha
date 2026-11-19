/** The book: which passing stocks become the open calls. Rules follow Tripwire's automatic paper book (apps/tripwire/src/autobook.ts), applied to the four screens' passers (ADR-014):
 *  one account of CAPITAL rupees, at most MAX_OPEN positions at once, one fixed TICKET per position, no more than SECTOR_CAP positions in one sector, a name held is never taken twice,
 *  a stock whose single share costs more than the ticket is refused, and candidates are taken in order of score (the feed's composite, highest first). Every refusal keeps its reason.
 *  Pure: the same inputs give the same book, so any device and any later replay agree. */
export const CAPITAL = 10_000_000;            // Rs 1 crore, the total available balance
export const MAX_OPEN = 30;                   // most positions open at once
export const TICKET = 330_000;                // 30 x Rs 3.3 lakh = Rs 99 lakh deployed, leaving about Rs 1 lakh for charges
export const SECTOR_CAP = 4;                  // most positions running in one sector
export const SCREEN_ORDER = ['piotroski', 'magic-formula', 'quality-momentum', 'conservative-quality'];
export interface Cand { symbol: string; screens: string[]; score: number; sector: string | null; price: number | null }
export interface Held { symbol: string; sector: string | null }
export interface Decision { symbol: string; screen_id: string; screens: string[]; score: number; taken: boolean; why: string | null }
export const inr = (x: number) => '₹' + Math.round(x).toLocaleString('en-IN');
/** Candidates are one per STOCK (a stock listed by several screens is one position, credited to the first of them in SCREEN_ORDER). */
export function selectCalls(cands: Cand[], held: Held[], cfg = { maxOpen: MAX_OPEN, ticket: TICKET, sectorCap: SECTOR_CAP }): Decision[] {
  const open = [...held]; const out: Decision[] = []; const seen = new Set<string>();
  const order = [...cands].sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol));
  for (const c of order) {
    if (seen.has(c.symbol)) continue; seen.add(c.symbol); const screen_id = [...c.screens].sort((a, b) => SCREEN_ORDER.indexOf(a) - SCREEN_ORDER.indexOf(b))[0];
    const no = (why: string) => out.push({ symbol: c.symbol, screen_id, screens: c.screens, score: c.score, taken: false, why });
    if (open.some((h) => h.symbol === c.symbol)) { no('The same name is already held.'); continue; }
    if (c.price == null || !(c.price > 0)) { no('No closing price in the data, so no position can be sized.'); continue; }
    if (Math.floor(cfg.ticket / c.price) < 1) { no(`One share costs ${inr(c.price)}, more than the ${inr(cfg.ticket)} ticket.`); continue; }
    if (open.length >= cfg.maxOpen) { no(`The book is full: ${cfg.maxOpen} positions are running.`); continue; }
    if (c.sector && open.filter((h) => h.sector === c.sector).length >= cfg.sectorCap) { no(`${cfg.sectorCap} positions are already running in ${c.sector}; the book holds no more than that in one sector.`); continue; }
    open.push({ symbol: c.symbol, sector: c.sector }); out.push({ symbol: c.symbol, screen_id, screens: c.screens, score: c.score, taken: true, why: null });
  }
  return out;
}
