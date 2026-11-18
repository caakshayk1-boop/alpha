/** Exit rules per screen (ADR-017, owner decision 2026-11-19: "use your proposed exit rules, no holding greater than 1 month for all engines").
 *  Every call leaves on the FIRST of: its stop, its profit target, the screen dropping it (where the rule says so), or the end of one calendar month.
 *  Daily bars cannot show the order of a day's high and low, so if one session touches both stop and target the STOP is assumed to have come first.
 *  These are judgements, not back-tested optima. The numbers are starting values to be reviewed once there are 30 closed calls per screen. */
import { isSession, prevSession } from './calendar.ts';
export interface ExitRule { stop_pct: number; trailing: boolean; target_pct: number; exit_on_drop: boolean; max_months: 1 }
export const RULES: Record<string, ExitRule> = {
  piotroski:             { stop_pct: 20, trailing: false, target_pct: 20, exit_on_drop: true,  max_months: 1 },
  'magic-formula':       { stop_pct: 15, trailing: false, target_pct: 15, exit_on_drop: false, max_months: 1 },
  'quality-momentum':    { stop_pct: 25, trailing: true,  target_pct: 30, exit_on_drop: true,  max_months: 1 },
  'conservative-quality': { stop_pct: 18, trailing: false, target_pct: 15, exit_on_drop: true,  max_months: 1 },
};
export const DEFAULT_RULE: ExitRule = RULES.piotroski;
export const ruleFor = (screenId: string): ExitRule => RULES[screenId] ?? DEFAULT_RULE;
/** The same day next month (clamped to the month's end), then back to the last trading session on or before it: a call is never held past one month. */
export function timeLimit(entry: string): string {
  const [y, m, d] = entry.split('-').map(Number); const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1; const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  let day = `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`; if (!isSession(day)) day = prevSession(day); return day;
}
/** The rule in plain words for the Calls and About pages. One owner of this text. */
export function ruleText(screenId: string): string {
  const r = ruleFor(screenId);
  return `${r.trailing ? `${r.stop_pct}% trailing stop below the highest close` : `${r.stop_pct}% stop below entry`}; profit target +${r.target_pct}%; ${r.exit_on_drop ? 'exit if the screen drops it; ' : 'held even if the screen drops it; '}never held past one month.`;
}
