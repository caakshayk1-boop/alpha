/** India equity-delivery charges, versioned. A rate change alters history, so it needs an ADR and a new version string.
 *  RATES ARE STARTING VALUES from the published schedules as the author understands them; verify against the NSE, SEBI and
 *  government schedules before launch (BUILD-LOG records the check). Brokerage defaults to zero (delivery at a discount broker). */
export const CHARGES_VERSION = 'in-delivery-1';
export const RATES = {
  brokeragePct: 0, brokerageFlat: 0,
  sttPct: 0.1,            // both sides on delivery
  exchangePct: 0.00297,   // NSE transaction charge
  sebiPct: 0.0001,        // Rs 10 per crore
  stampBuyPct: 0.015,     // buy side only
  gstPct: 18,             // on brokerage + exchange + SEBI
  dpSellFlat: 15.34,      // per sell day per scrip, incl. GST (approximate; broker-specific)
} as const;
export type Side = 'buy' | 'sell';
export interface ChargeLine { kind: string; amount: number }
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
/** The charge lines for one fill. Pure; every line is later attached to exactly this fill and counted once. */
export function chargesFor(side: Side, qty: number, price: number): ChargeLine[] {
  const v = qty * price;
  const brokerage = r4(v * RATES.brokeragePct / 100 + (RATES.brokerageFlat ? RATES.brokerageFlat : 0));
  const stt = r4(v * RATES.sttPct / 100), exch = r4(v * RATES.exchangePct / 100), sebi = r4(v * RATES.sebiPct / 100);
  const gst = r4((brokerage + exch + sebi) * RATES.gstPct / 100);
  const lines: ChargeLine[] = [{ kind: 'brokerage', amount: brokerage }, { kind: 'stt', amount: stt }, { kind: 'exchange', amount: exch }, { kind: 'sebi', amount: sebi }, { kind: 'gst', amount: gst }];
  if (side === 'buy') lines.push({ kind: 'stamp', amount: r4(v * RATES.stampBuyPct / 100) });
  else lines.push({ kind: 'dp', amount: RATES.dpSellFlat });
  return lines;
}
export const sum = (l: ChargeLine[]) => r4(l.reduce((a, c) => a + c.amount, 0));
