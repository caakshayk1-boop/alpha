/** The Signals workspace as pure functions of the feeds, so every state it can show is testable (tests/plan.test.ts).
 *
 *  One lifecycle vocabulary for every engine family (Swing v2 and the v3 research engines): Research, Paper, Validated, Paused,
 *  Retired, Blocked (data). Each family is read from its own feed and its own run; no figure from one family or one model version
 *  is ever added to another's.
 *
 *  The empty Setups view never says only "nothing today": it names each reason apart (H05): the market gate, the input data
 *  against the calendar, the model's validation and whether the engine is published at all. Nothing here estimates a figure the
 *  feeds do not carry; where one is missing the function says so instead. */
import { num, signed } from './format.ts';
import { sessionLabel as day } from './price.ts';
import type { BtStats, GateCheck, SignalsFeed } from './types.ts';

export type Lifecycle = 'Research' | 'Paper' | 'Validated' | 'Paused' | 'Retired' | 'Blocked (data)';
export const LIFECYCLE: Lifecycle[] = ['Research', 'Paper', 'Validated', 'Paused', 'Retired', 'Blocked (data)'];
export const LIFECYCLE_NOTE: Record<Lifecycle, string> = {
  Research: 'Tested on history; no forward record counts yet and nothing is published as a setup.',
  Paper: 'Runs forward on paper, recorded nightly. Not validated: alerts stay off.',
  Validated: 'Passed its validation and may alert, if alerts are switched on.',
  Paused: 'Stopped by a decision; its record is kept.',
  Retired: 'Withdrawn after its evidence; the record is kept, nothing new is issued.',
  'Blocked (data)': 'Cannot be tested: a required dataset is not available.',
};
export const LIFECYCLE_TONE: Record<Lifecycle, 'ok' | 'warn' | 'bad' | 'acc' | ''> = { Research: '', Paper: 'acc', Validated: 'ok', Paused: 'warn', Retired: 'bad', 'Blocked (data)': 'warn' };

/** Swing v2 has no lifecycle field: it runs a forward paper book, and alerts switch on only when its validation passes. */
export const swingLifecycle = (f: Pick<SignalsFeed, 'alertable'>): Lifecycle => (f.alertable ? 'Validated' : 'Paper');

/** The gate funnel the feed can support: sessions on file, sessions the gate was on, and the latest session's checks. Per-check
 *  history is not in the feed (gate_history holds on/off only), so per-check counts exist for the latest session alone. */
export interface GateFunnel { sessions: number; on: number; from: string | null; to: string | null; passed: number; total: number; failed: GateCheck[]; offRun: number }
export function gateFunnel(f: Pick<SignalsFeed, 'gate' | 'gate_history'>): GateFunnel {
  const h = [...(f.gate_history ?? [])].sort((a, b) => a.d.localeCompare(b.d));
  let offRun = 0;
  for (let i = h.length - 1; i >= 0 && !h[i].on; i--) offRun++;
  return { sessions: h.length, on: h.filter((x) => x.on).length, from: h[0]?.d ?? null, to: h[h.length - 1]?.d ?? null,
    passed: f.gate.checks.filter((c) => c.ok).length, total: f.gate.checks.length, failed: f.gate.checks.filter((c) => !c.ok), offRun };
}

/** How the engines dataset stands against the calendar (DataStatus from lib/status.ts, id "engines"). */
export interface Lag { state: string; lagSessions: number; reference: string | null }
export interface Reason { key: 'gate' | 'data' | 'validation' | 'publication'; label: string; text: string; tone: 'ok' | 'warn' | 'bad'; blocking: boolean }

/** A rule as a clause: "At least 50%…" → "at least 50%…"; a name ("Nifty", "India VIX") keeps its capital. */
const lowerFirst = (r: string) => (/^(Nifty|India|NSE)\b/.test(r) ? r : r.charAt(0).toLowerCase() + r.slice(1));

/** Every reason the Setups view can be empty, kept apart. `blocking` marks the ones that by themselves stop a new setup. */
export function setupReasons(f: SignalsFeed, lag: Lag | null, v3Published: boolean): Reason[] {
  const g = gateFunnel(f);
  const behind = !!lag && lag.state !== 'current' && lag.lagSessions > 0;
  const tStat = f.backtest?.rules.holdout.clustered_t_clustered;
  return [
    { key: 'gate', label: 'Market gate', tone: f.gate.on ? 'ok' : 'bad', blocking: !f.gate.on,
      text: f.gate.on ? `On: all ${g.total} checks pass at the ${day(f.gate.date)} close.` : `Off: ${g.passed} of ${g.total} checks pass at the ${day(f.gate.date)} close (${g.failed.map((c) => lowerFirst(c.rule.split(',')[0])).join('; ')} ${g.failed.length === 1 ? 'fails' : 'fail'}). No new setup opens while it is off.` },
    { key: 'data', label: 'Input data', tone: behind ? 'warn' : lag ? 'ok' : 'warn', blocking: behind,
      text: !lag ? `Through ${day(f.data_through)}; the calendar check has not loaded.` : behind ? `Through ${day(f.data_through)}: ${lag.lagSessions} session${lag.lagSessions === 1 ? '' : 's'} behind the expected ${lag.reference ? day(lag.reference) : ''} session. A decision for a later session has not been made.` : `Current: through ${day(f.data_through)}, the expected session.` },
    { key: 'validation', label: 'Model validation', tone: f.alertable ? 'ok' : 'warn', blocking: false,
      text: f.alertable ? 'Holdout passed: alerts may be sent.' : `Holdout not passed${typeof tStat === 'number' ? ` (month-clustered t ${signed(tStat, 2)})` : ''}: setups are paper only and alerts are off.` },
    { key: 'publication', label: 'Publication', tone: v3Published ? 'ok' : 'warn', blocking: false,
      text: v3Published ? 'Swing v2 paper setups and the v3 research feed are both published.' : 'Swing v2 paper setups are published. The v3 research engines are not: their record is kept privately until the owner authorises publishing.' },
  ];
}

/** The evening runs that write the book: 18:00, 20:00 and 22:30 IST on every weekday (the cron also runs on an exchange holiday; it then records no new session). */
export const RUN_SLOTS_IST: [number, number][] = [[18, 0], [20, 0], [22, 30]];
export function nextRun(now: Date): Date {
  const ist = new Date(now.getTime() + 5.5 * 3600000);                 // the IST wall clock, read through UTC getters
  for (let d = 0; d < 8; d++) {
    const day = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + d));
    const wd = day.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    for (const [h, m] of RUN_SLOTS_IST) {
      const at = new Date(day.getTime() + (h * 60 + m) * 60000 - 5.5 * 3600000);
      if (at.getTime() > now.getTime()) return at;
    }
  }
  return now;
}
const IST_DT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
/** "Thu 22 Oct, 18:00 IST" */
export const istStamp = (d: Date): string => { const p = Object.fromEntries(IST_DT.formatToParts(d).map((x) => [x.type, x.value])); return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute} IST`; };

/** A round trip's cost in R for one trade: cost_round_trip_pct of the entry value, over the risk per share. The engine books a
 *  closed trade as gross R minus exactly this (engines/swing.py to_trade), so gross = net + costR. */
export const costR = (entry: number, risk: number, costPct: number): number | null => (entry > 0 && risk > 0 && Number.isFinite(costPct) ? (costPct / 100) * entry / risk : null);
export function grossNet(rNet: number | null | undefined, entry: number | null | undefined, risk: number | null | undefined, costPct: number): { gross: number | null; net: number | null; cost: number | null } {
  const c = typeof entry === 'number' && typeof risk === 'number' ? costR(entry, risk, costPct) : null;
  const net = typeof rNet === 'number' && Number.isFinite(rNet) ? rNet : null;
  return { net, cost: c, gross: net !== null && c !== null ? net + c : null };
}

/** The evidence a reader should weigh before any alert, read from the backtest object and the forward record. The engine's own
 *  switch is the holdout month-clustered t; the rest are reported beside it, and a measure the feed does not carry says so. */
export interface Evidence { key: string; label: string; value: string; basis: string; verdict: 'pass' | 'fail' | 'info' | 'absent' }
const sg = (v: number | null | undefined, dp = 2, unit = '') => (typeof v === 'number' && Number.isFinite(v) ? signed(v, dp, unit) : 'not in the feed');
export function tNeeded(alertWhy: string): number { const m = /needs\s*\+?(-?\d+(?:\.\d+)?)/i.exec(alertWhy ?? ''); return m ? Number(m[1]) : 2; }
export function evidence(f: SignalsFeed): Evidence[] {
  const b = f.backtest;
  if (!b) return [{ key: 'bt', label: 'Backtest', value: 'not run', basis: 'Until the rules are tested, alerts stay off.', verdict: 'absent' }];
  const h: BtStats = b.rules.holdout, rnd = b.random.holdout, ng = b.no_gate.holdout;
  const need = tNeeded(f.alert_why);
  const t = h.clustered_t_clustered;
  return [
    { key: 't', label: 'Holdout month-clustered t', value: sg(t), basis: `The engine's alert switch needs ${sg(need, 1)}. Between −2 and +2 a result cannot be told apart from luck.`, verdict: typeof t === 'number' && t >= need ? 'pass' : 'fail' },
    { key: 'n', label: 'Sample size', value: `${h.n} holdout trades`, basis: `${b.rules.development.n} in development (${day(b.periods.development[0])} to ${day(b.periods.development[1])}); holdout ${day(b.periods.holdout[0])} to ${day(b.periods.holdout[1])}. One holdout is one sample, read once.`, verdict: 'info' },
    { key: 'months', label: 'Monthly coverage', value: typeof h.clustered_months === 'number' ? `${h.clustered_months} months` : 'not in the feed', basis: typeof h.clustered_positive_months_pct === 'number' ? `${Math.round(h.clustered_positive_months_pct)}% of holdout months positive.` : 'Positive-month share not in the feed.', verdict: typeof h.clustered_months === 'number' ? 'info' : 'absent' },
    { key: 'exp', label: 'Holdout result, after costs', value: `${sg(h.expectancy_r, 2, 'R')} a trade`, basis: `Profit factor ${typeof h.profit_factor === 'number' ? num(h.profit_factor, 2) : 'not in the feed'}. Random stocks on the same plan: ${sg(rnd?.expectancy_r, 2, 'R')}; without the market gate: ${sg(ng?.expectancy_r, 2, 'R')}.`, verdict: typeof h.expectancy_r === 'number' && h.expectancy_r > 0 && typeof rnd?.expectancy_r === 'number' && h.expectancy_r > rnd.expectancy_r ? 'pass' : 'fail' },
    { key: 'cost', label: 'Cost stress', value: 'not in this feed', basis: `Every figure is at one cost, ${f.cost_round_trip_pct}% a round trip. No higher-cost run is published for Swing v2.`, verdict: 'absent' },
    { key: 'fwd', label: 'Forward evidence', value: f.record.closed ? `${f.record.closed} closed, ${sg(f.record.total_r, 2, 'R')}` : 'none yet', basis: `Paper record since ${day(f.launched)}. The only figure that cannot have been fitted to the past; it is never added to the backtest.`, verdict: 'info' },
  ];
}
