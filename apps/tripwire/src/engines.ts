/** The six research engines and where each stands. A decision record (22 Oct 2026) until the nightly feed publishes engines_v3.json.
 *  Not one of them is validated, so none of them alerts. Ranks are not probabilities and no engine has a calibrated one. */
export type State = 'BLOCKED_DATA' | 'RESEARCH' | 'PAPER' | 'VALIDATED' | 'PAUSED' | 'RETIRED';
export interface EngineRow { id: string; name: string; state: State; why: string }
export const ENGINES: EngineRow[] = [
  { id: 'E1', name: 'Relative-strength continuation', state: 'RESEARCH', why: 'Its walk-forward result did not beat matched random entries on the same plan.' },
  { id: 'E2', name: 'Volatility-compression breakout', state: 'RETIRED', why: 'Negative at twice the modelled costs, and below the exposure-matched Nifty.' },
  { id: 'E3', name: 'Orderly trend pullback', state: 'RETIRED', why: 'Negative in every walk-forward period but one.' },
  { id: 'E4', name: 'Residual mean reversion', state: 'RETIRED', why: 'No event coverage; its paper cohort lost money.' },
  { id: 'E5', name: 'Failed breakdown, range reclaim', state: 'RESEARCH', why: 'No better than its random baseline. Kept with a forward record.' },
  { id: 'E6', name: 'Earnings surprise drift', state: 'BLOCKED_DATA', why: 'Point-in-time announcement timestamps and quarterly statements are not available.' },
];
export const STATE_WORD: Record<State, string> = { BLOCKED_DATA: 'Blocked: data', RESEARCH: 'Research', PAPER: 'Paper', VALIDATED: 'Validated', PAUSED: 'Paused', RETIRED: 'Retired' };
export const LIFECYCLE: State[] = ['BLOCKED_DATA', 'RESEARCH', 'PAPER', 'VALIDATED', 'PAUSED', 'RETIRED'];
