/** Signal engines v3: the four views (spec §6) as pure functions of the feed, so every state is testable.
 *  Views: Forming setups · Paper signals · Validated alerts · Closed record. A card shows the engine, as-of date, the condition
 *  met, the missing trigger (forming only), the expiry and the data status. Nothing here carries a live badge unless the engine is
 *  VALIDATED and alerts are enabled; no research card ever does. No probability is shown anywhere: no engine has a calibrated one. */

import { signed } from './format.ts';

export type EngineState = 'BLOCKED_DATA' | 'RESEARCH' | 'PAPER' | 'VALIDATED' | 'PAUSED' | 'RETIRED';
export interface V3Signal { id: string; engine: string; symbol: string; as_of: string; state: EngineState; regime?: string; entry_rule?: string; invalidation?: number; target_policy?: string; initial_risk_pct?: number; expiry?: string }
export interface V3Forming { engine: string; symbol: string; as_of: string; state: EngineState; met: string; missing: string }
export interface V3Closed extends V3Signal { status: string; r_net: number | null; exit_reason: string | null; exit_date: string | null }
export interface V3Feed { schema: string; generated: string; data_watermark: string; evidence: string; alerts_enabled: boolean;
  engines: Record<string, { state: EngineState; why?: string; version?: string }>; forming: V3Forming[]; paper: V3Signal[]; validated: V3Signal[]; closed: V3Closed[] }

export const ENGINE_NAME: Record<string, string> = {
  E1: 'Relative-strength continuation', E2: 'Volatility compression breakout', E3: 'Orderly trend pullback',
  E4: 'Residual mean reversion', E5: 'Failed breakdown and range reclaim', E6: 'Earnings surprise drift',
};
export const STATE_WORD: Record<EngineState, string> = {
  BLOCKED_DATA: 'Blocked: data missing', RESEARCH: 'Research', PAPER: 'Paper', VALIDATED: 'Validated', PAUSED: 'Paused', RETIRED: 'Retired',
};

export interface Card { key: string; engine: string; engineName: string; symbol: string; asOf: string; badge: string; live: boolean; lines: string[] }
export interface View { key: 'forming' | 'paper' | 'validated' | 'closed'; title: string; cards: Card[]; empty: string }
export interface ViewModel { status: 'missing' | 'stale' | 'ok'; note: string; engines: { id: string; name: string; state: string; why: string }[]; views: View[] }

const DAY = 86_400_000;
/** Sessions are weekdays: a feed is stale when its watermark is more than 4 calendar days behind (covers a weekend plus a holiday). */
export function isStale(watermark: string, now: Date): boolean {
  const w = Date.parse(`${watermark}T00:00:00Z`);
  return !Number.isFinite(w) || now.getTime() - w > 4 * DAY;
}

export function viewModel(feed: V3Feed | null, now: Date): ViewModel {
  if (!feed) {
    return { status: 'missing', engines: [], views: emptyViews('nothing has been published'),
      note: 'Not published. The engines run as research: their record is kept, and the site shows them only once the owner authorises publishing.' };
  }
  const stale = isStale(feed.data_watermark, now);
  const live = (s: EngineState) => s === 'VALIDATED' && feed.alerts_enabled === true;
  const card = (s: V3Signal, lines: string[]): Card => ({ key: s.id, engine: s.engine, engineName: ENGINE_NAME[s.engine] ?? s.engine, symbol: s.symbol, asOf: s.as_of,
    badge: STATE_WORD[s.state] ?? 'Research', live: live(s.state) && !stale, lines });
  const plan = (s: V3Signal) => [
    s.entry_rule ? `Entry: ${s.entry_rule}` : '', typeof s.invalidation === 'number' ? `Invalidation: ${s.invalidation}` : '',
    s.target_policy ? `Exit: ${s.target_policy}` : '', s.expiry ? `Expires: ${s.expiry}` : '', s.regime ? `Market context: ${s.regime.replace('_', ' ')}` : '',
  ].filter(Boolean);
  const views: View[] = [
    { key: 'forming', title: 'Forming setups', empty: 'No setup is forming on the latest session.',
      cards: feed.forming.map((f) => ({ key: `${f.engine}:${f.symbol}:${f.as_of}:f`, engine: f.engine, engineName: ENGINE_NAME[f.engine] ?? f.engine, symbol: f.symbol, asOf: f.as_of,
        badge: STATE_WORD[f.state] ?? 'Research', live: false, lines: [`Met: ${f.met}`, `Still needs: ${f.missing}`] })) },
    { key: 'paper', title: 'Paper signals', empty: 'No engine fired on the latest session.', cards: feed.paper.map((s) => card(s, plan(s))) },
    { key: 'validated', title: 'Validated alerts', empty: 'No engine has passed validation. Nothing here is an alert.', cards: feed.validated.map((s) => card(s, plan(s))) },
    { key: 'closed', title: 'Closed record', empty: 'No paper signal has closed yet.',
      cards: feed.closed.map((c) => card(c, [c.status === 'filled' ? `Result: ${c.r_net === null ? 'not measured' : `${signed(c.r_net, 2, 'R')} net of costs`}` : `Not entered: ${c.status === 'cancelled_gap' ? 'opened at or below the invalidation' : c.status === 'cancelled_risk' ? 'at the opening price the stop sat outside 1–10% of it' : 'opened above the chase limit'}`,
        c.exit_reason ? `Exit: ${c.exit_reason.replace('_', ' ')}${c.exit_date ? `, ${c.exit_date}` : ''}` : ''].filter(Boolean))) },
  ];
  const engines = Object.entries(feed.engines).map(([id, e]) => ({ id, name: ENGINE_NAME[id] ?? id, state: STATE_WORD[e.state] ?? 'Research', why: e.why ?? '' }));
  return { status: stale ? 'stale' : 'ok', engines, views,
    note: stale ? `Stale: the latest session in this feed is ${feed.data_watermark}. Nothing below describes today.` : `Data through ${feed.data_watermark}. Research and paper records only; alerts are ${feed.alerts_enabled ? 'on' : 'off'}.` };
}

function emptyViews(why: string): View[] {
  return [
    { key: 'forming', title: 'Forming setups', cards: [], empty: `No forming setups: ${why}.` },
    { key: 'paper', title: 'Paper signals', cards: [], empty: `No paper signals: ${why}.` },
    { key: 'validated', title: 'Validated alerts', cards: [], empty: 'No engine has passed validation. Nothing here is an alert.' },
    { key: 'closed', title: 'Closed record', cards: [], empty: `No closed record: ${why}.` },
  ];
}

/** Copy-lint (spec §6): phrases no engine card, note or reason may ever contain. */
export const BANNED = [/\bguarantee(d|s)?\b/i, /\bsafe (bottom|bet|trade|entry|stock)s?\b/i, /\bloss[- ]protected\b/i, /\bsure[- ]?shot\b/i, /\bwin(ning)? probability\b/i, /\bprobability of (winning|profit|success)\b/i, /\brisk[- ]free\b/i];
export function copyViolations(text: string): string[] {
  return BANNED.filter((re) => re.test(text)).map((re) => re.source);
}
