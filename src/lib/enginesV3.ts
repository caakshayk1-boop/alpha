/** Signal engines v3: the four views (spec §6) as pure functions of the feed, so every state is testable.
 *  Views: Forming setups · Paper signals · Validated alerts · Closed record. A card shows the engine, as-of date, the condition
 *  met, the missing trigger (forming only), the expiry and the data status. Nothing here carries a live badge unless the engine is
 *  VALIDATED and alerts are enabled; no research card ever does. No probability is shown anywhere: no engine has a calibrated one. */

import { signed } from './format.ts';
import { journalHref } from './journal.ts';
import { companyHref } from './slug.ts';

export type EngineState = 'BLOCKED_DATA' | 'RESEARCH' | 'PAPER' | 'VALIDATED' | 'PAUSED' | 'RETIRED';
export interface V3Signal { id: string; engine: string; symbol: string; as_of: string; state: EngineState; regime?: string; entry_rule?: string; invalidation?: number; target_policy?: string; initial_risk_pct?: number; expiry?: string; ref_close?: number }
export interface V3Forming { engine: string; symbol: string; as_of: string; state: EngineState; met: string; missing: string }
export interface V3Closed extends V3Signal { status: string; r_net: number | null; exit_reason: string | null; exit_date: string | null }
export interface V3Feed { schema: string; generated: string; data_watermark: string; evidence: string; alerts_enabled: boolean;
  engines: Record<string, { state: EngineState; why?: string; version?: string }>; forming: V3Forming[]; paper: V3Signal[]; validated: V3Signal[]; closed: V3Closed[];
  /** per engine, the night's exclusion funnel; a stage that is not decided on the night is null */
  funnel?: Record<string, Partial<Record<FunnelStage | 'candidates', number | null>>>;
  health?: { status: 'ok' | 'stale' | 'unknown'; watermark: string | null; expected: string | null; days_behind: number | null };
  provenance?: { source?: string; ingested_at?: string; dataset_version?: string; adjustment_policy?: Record<string, string> } | null; job_key?: string }
export type FunnelStage = 'available' | 'clean' | 'liquid' | 'setup' | 'context' | 'executable' | 'portfolio_selected';

export const ENGINE_NAME: Record<string, string> = {
  E1: 'Relative-strength continuation', E2: 'Volatility compression breakout', E3: 'Orderly trend pullback',
  E4: 'Residual mean reversion', E5: 'Failed breakdown and range reclaim', E6: 'Earnings surprise drift', E7: 'Relative strength, held to the time limit',
};
export const STATE_WORD: Record<EngineState, string> = {
  BLOCKED_DATA: 'Blocked (data)', RESEARCH: 'Research', PAPER: 'Paper', VALIDATED: 'Validated', PAUSED: 'Paused', RETIRED: 'Retired',
};

export interface CardLink { label: string; href: string }
export interface Card { key: string; engine: string; engineName: string; symbol: string; asOf: string; badge: string; live: boolean; lines: string[]; links: CardLink[] }
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
    badge: STATE_WORD[s.state] ?? 'Research', live: live(s.state) && !stale, lines, links: linksFor(s.symbol, s.ref_close, s.invalidation) });
  const plan = (s: V3Signal) => [
    s.entry_rule ? `Entry: ${s.entry_rule}` : '', typeof s.invalidation === 'number' ? `Invalidation: ${s.invalidation}` : '',
    s.target_policy ? `Exit: ${s.target_policy}` : '', s.expiry ? `Expires: ${s.expiry}` : '', s.regime ? `Market context: ${s.regime.replace('_', ' ')}` : '',
  ].filter(Boolean);
  const views: View[] = [
    { key: 'forming', title: 'Forming setups', empty: 'No setup is forming on the latest session.',
      cards: feed.forming.map((f) => ({ key: `${f.engine}:${f.symbol}:${f.as_of}:f`, engine: f.engine, engineName: ENGINE_NAME[f.engine] ?? f.engine, symbol: f.symbol, asOf: f.as_of,
        badge: STATE_WORD[f.state] ?? 'Research', live: false, lines: [`Met: ${f.met}`, `Still needs: ${f.missing}`], links: linksFor(f.symbol) })) },
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

/** The v3 lifecycle as last decided, for when engines_v3.json is not published (configs/engines/states.yaml, RELEASE_GATES.md,
 *  RESEARCH_REPORT.md and DECISIONS #12–#15, 22 Oct 2026). A decision record, not a feed: it carries no figure, and a published
 *  feed replaces it. No v3 engine inherits any Swing v2 result, and no row here is a record of trades. */
export interface RegistryRow { id: string; name: string; state: EngineState; version: string; decided: string; why: string }
export const V3_REGISTRY: RegistryRow[] = [
  { id: 'E1', name: ENGINE_NAME.E1, state: 'RESEARCH', version: 'v1.0.0', decided: '2026-10-22', why: 'Its walk-forward result did not beat matched random entries on the same plan. Kept as the control for E7.' },
  { id: 'E2', name: ENGINE_NAME.E2, state: 'RETIRED', version: 'v1.0.0', decided: '2026-10-22', why: 'Negative at twice the modelled costs, and below the exposure-matched Nifty.' },
  { id: 'E3', name: ENGINE_NAME.E3, state: 'RETIRED', version: 'v1.0.0', decided: '2026-10-22', why: 'Negative in every walk-forward period but one.' },
  { id: 'E4', name: ENGINE_NAME.E4, state: 'RETIRED', version: 'v1.0.0', decided: '2026-10-22', why: 'No event coverage, so paper-only by definition; its paper cohort lost money.' },
  { id: 'E5', name: ENGINE_NAME.E5, state: 'RESEARCH', version: 'v1.0.0', decided: '2026-10-22', why: 'No better than its random baseline. Kept in research with a forward record.' },
  { id: 'E6', name: ENGINE_NAME.E6, state: 'BLOCKED_DATA', version: 'v1.0.0', decided: '2026-10-22', why: 'Point-in-time announcement timestamps and quarterly statements are not available.' },
  { id: 'E7', name: ENGINE_NAME.E7, state: 'PAPER', version: 'v1.1.0', decided: '2026-10-22', why: 'E1 without its trailing exit. Chosen after seeing history, so no historical figure counts: it is judged on its forward paper ledger alone.' },
];
/** The rows the Method view shows: the published feed's own states when it exists, otherwise the decision record above. */
export function lifecycleRows(feed: V3Feed | null): { source: 'feed' | 'record'; asOf: string; rows: RegistryRow[] } {
  if (!feed) return { source: 'record', asOf: '2026-10-22', rows: V3_REGISTRY };
  return { source: 'feed', asOf: feed.data_watermark, rows: Object.entries(feed.engines).map(([id, e]) => ({ id, name: ENGINE_NAME[id] ?? id, state: e.state, version: e.version ?? 'not stated', decided: feed.data_watermark, why: e.why ?? '' })) };
}

/** Copy-lint (spec §6): phrases no engine card, note or reason may ever contain. */
export const BANNED = [/\bguarantee(d|s)?\b/i, /\bsafe (bottom|bet|trade|entry|stock)s?\b/i, /\bloss[- ]protected\b/i, /\bsure[- ]?shot\b/i, /\bwin(ning)? probability\b/i, /\bprobability of (winning|profit|success)\b/i, /\brisk[- ]free\b/i];
export function copyViolations(text: string): string[] {
  return BANNED.filter((re) => re.test(text)).map((re) => re.source);
}

/** From a setup to the rest of the product: the company's research (where it can be followed), the position calculator filled with
 *  the reference close, the invalidation and the paper risk of 0.25%, and the journal pre-filled the same way. A number that is not on
 *  the record is left out of the link, never guessed. */
export function linksFor(symbol: string, ref?: number | null, stop?: number | null): CardLink[] {
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
  const out: CardLink[] = [{ label: 'Research and follow', href: companyHref(symbol) }];
  if (ok(ref) && ok(stop) && stop < ref) {
    out.push({ label: 'Size a paper position', href: `/tools/?p=${Math.round(ref * 100) / 100}&sl=${Math.round(stop * 100) / 100}&rk=0.25` });
    out.push({ label: 'Write it in the journal', href: journalHref(symbol, ref, stop, null) });
  }
  return out;
}

export const FUNNEL_STAGES: readonly { id: FunnelStage; label: string; why: string }[] = [
  { id: 'available', label: 'Universe', why: 'Symbols with a bar on the session' },
  { id: 'clean', label: 'Clean', why: 'A complete bar, no unexplained overnight jump, not just back from a suspension' },
  { id: 'liquid', label: 'Liquid', why: 'The engine\'s price and traded-value floors' },
  { id: 'setup', label: 'Setup met', why: 'Every setup condition including the trigger' },
  { id: 'context', label: 'Context fits', why: 'The market context is one the engine accepts' },
  { id: 'executable', label: 'Executable', why: 'Decided at the next open by the simulator, so not counted on the night' },
  { id: 'portfolio_selected', label: 'In the book', why: 'Decided by the portfolio limits, so not counted on the night' },
];
export interface HealthRow { engine: string; name: string; state: string; stages: (number | null)[]; candidates: number | null }
export interface HealthModel { status: 'missing' | 'stale' | 'ok'; line: string; detail: string[]; rows: HealthRow[] }

/** The engine-health and exclusion-diagnostics view. Missing data is a state, never a row of zeros. */
export function healthModel(feed: V3Feed | null, now: Date): HealthModel {
  if (!feed) return { status: 'missing', line: 'No engine health to show: nothing has been published.', detail: [], rows: [] };
  const stale = isStale(feed.data_watermark, now) || feed.health?.status === 'stale';
  const h = feed.health;
  const line = h?.status === 'ok' ? `The record is current: it describes the last finished session, ${feed.data_watermark}.`
    : h?.status === 'stale' ? `The record is ${h.days_behind} day${h.days_behind === 1 ? '' : 's'} behind the last finished session (${h.expected}).`
      : stale ? `Stale: the latest session in this feed is ${feed.data_watermark}.` : `Data through ${feed.data_watermark}. The feed does not say whether that is the latest finished session.`;
  const p = feed.provenance;
  const detail = [p?.source ? `Source: ${p.source}` : '', p?.ingested_at ? `Read at ${p.ingested_at}` : '', p?.dataset_version ? `Dataset ${p.dataset_version}` : '',
    p?.adjustment_policy?.levels ? `Levels: ${p.adjustment_policy.levels}` : '', p?.adjustment_policy?.returns ? `Returns: ${p.adjustment_policy.returns}` : ''].filter(Boolean);
  const rows = Object.entries(feed.funnel ?? {}).map(([id, f]) => ({ engine: id, name: ENGINE_NAME[id] ?? id, state: STATE_WORD[feed.engines[id]?.state] ?? 'Research',
    stages: FUNNEL_STAGES.map((st) => (typeof f[st.id] === 'number' ? (f[st.id] as number) : null)), candidates: typeof f.candidates === 'number' ? f.candidates : null }));
  return { status: stale ? 'stale' : 'ok', line, detail, rows };
}
