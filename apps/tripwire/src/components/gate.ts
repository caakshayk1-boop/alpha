// What the Signals gate card and pill say, read from the signals feed that is already published. Pure: no React, so it is unit-tested.
// Nothing here is invented: if the feed has no gate, there is no line (callers render nothing); if the feed has no holdout figure, the line stops after the checks.
import type { SignalsFeed } from '../data.ts';

export interface GateLine {
  on: boolean;
  passed: number;
  total: number;
  /** "Signals gate: OFF — 1/4 checks · holdout t −0.62 (needs +2.0)" */
  text: string;
  /** the compact form for the top bar: "Gate OFF · 1/4" */
  short: string;
  /** holdout month-clustered t and the bar it must clear, when the feed's own sentence carries them */
  holdout: { t: number; needs: number } | null;
}

/** The feed states the holdout figure in one sentence (alert_why): "Alerts off: the holdout month-clustered t is -0.62, needs +2.0." That sentence is the only place it is published. */
export function holdoutOf(why: string | undefined | null): { t: number; needs: number } | null {
  if (!why) return null;
  const m = /holdout[^.]*?\bt is\s*([+\-−]?\d+(?:\.\d+)?)\s*,\s*needs\s*([+\-−]?\d+(?:\.\d+)?)/i.exec(why);
  if (!m) return null;
  const n = (s: string) => Number(s.replace('−', '-'));
  const t = n(m[1]), needs = n(m[2]);
  return Number.isFinite(t) && Number.isFinite(needs) ? { t, needs } : null;
}
const signed = (v: number, d = 2) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(d)}`;

export function gateLine(feed: Pick<SignalsFeed, 'gate' | 'alert_why'> | null | undefined): GateLine | null {
  const g = feed?.gate; if (!g || typeof g.on !== 'boolean' || !Array.isArray(g.checks) || !g.checks.length) return null;
  const total = g.checks.length; const passed = Number.isFinite(g.passed) ? g.passed : g.checks.filter((c) => c.ok).length;
  const holdout = holdoutOf(feed?.alert_why);
  const state = g.on ? 'ON' : 'OFF';
  const tail = holdout ? ` · holdout t ${signed(holdout.t)} (needs ${signed(holdout.needs, 1)})` : '';
  return { on: g.on, passed, total, holdout, text: `Signals gate: ${state} — ${passed}/${total} checks${tail}`, short: `Gate ${state} · ${passed}/${total}` };
}
