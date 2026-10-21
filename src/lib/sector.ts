/** The screen's lender rule, in ONE place: for a bank, NBFC or insurer, leverage, cash conversion, interest cover, margins
 *  and ROCE do not mean what they mean for an operating company (debt is the raw material), so they are read as
 *  "not comparable", never scored or marked. */
export const LENDER = /financial|bank|insurance/i;
export const isLender = (r: { sector?: string | null; ind?: string | null }) => LENDER.test(`${r.sector ?? ''} ${r.ind ?? ''}`);
/** The measures that rule takes out. */
export const LENDER_NA = new Set(['ROCE', 'EBIT margin', 'Debt / equity', 'Cash conversion', 'Interest cover']);
