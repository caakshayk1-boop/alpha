/** The Plan: pure arithmetic on what the visitor wrote. No return assumptions, no projected corpus. */
import { nextSession, isSession } from './calendar.ts';
export interface Plan { createdOn: string; goal: string; horizonYears: number; monthly: number; maxFallPct: number; stopReason: string; escalationPct: number; escalationOptedOutOn: string | null;
  tradingCapPct: number; screenId: string; buckets: Bucket[] }
export interface Bucket { id: string; name: string; target: number; byDate: string; saved: number; trading?: boolean }
const DAY = 86400000, ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const monthsBetween = (a: string, b: string) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)) - (+b.slice(8, 10) < +a.slice(8, 10) ? 1 : 0);
/** Monthly amount in force on a date: steps up by escalationPct every 12 months, unless opted out (active, dated). */
export function monthlyOn(p: Plan, date: string): number {
  const m = Math.max(0, monthsBetween(p.createdOn, date)), steps = p.escalationOptedOutOn && date >= p.escalationOptedOutOn ? Math.floor(Math.max(0, monthsBetween(p.createdOn, p.escalationOptedOutOn)) / 12) : Math.floor(m / 12);
  return Math.round(p.monthly * (1 + p.escalationPct / 100) ** steps);
}
export function onTrack(b: Bucket, today: string, created: string): { status: 'on-track' | 'behind' | 'ahead' | 'past-date'; words: string; fraction: number } {
  const total = ms(b.byDate) - ms(created), done = ms(today) - ms(created), fraction = b.target > 0 ? b.saved / b.target : 0;
  if (today >= b.byDate) return fraction >= 1 ? { status: 'on-track', words: 'Target reached.', fraction } : { status: 'past-date', words: `The date has passed with ₹${Math.round(b.target - b.saved).toLocaleString('en-IN')} still to go.`, fraction };
  const expected = total > 0 ? Math.max(0, done / total) : 0;
  if (fraction >= expected + 0.05) return { status: 'ahead', words: 'Ahead of a straight line to the target.', fraction };
  if (fraction >= expected - 0.05) return { status: 'on-track', words: 'On a straight line to the target.', fraction };
  return { status: 'behind', words: 'Behind a straight line to the target. Nothing in the plan changes because of that.', fraction };
}
/** Split one month's deployment across a screen's current list, equal weight. Empty list: nothing deployed, the cash stays cash. */
export function sipSplit(amount: number, symbols: string[]): { symbol: string; amount: number }[] {
  if (!symbols.length) return []; const each = Math.floor((amount / symbols.length) * 100) / 100; return symbols.map((s) => ({ symbol: s, amount: each }));
}
export function drift(target: Record<string, number>, current: Record<string, number>): { symbol: string; target: number; current: number; drift: number }[] {
  const tot = Object.values(current).reduce((a, b) => a + b, 0) || 1;
  return Object.keys({ ...target, ...current }).sort().map((s) => { const c = (current[s] ?? 0) / tot; return { symbol: s, target: target[s] ?? 0, current: Math.round(c * 1e4) / 1e4, drift: Math.round((c - (target[s] ?? 0)) * 1e4) / 1e4 }; });
}
/** Rebalance on the first session of each quarter (Jan, Apr, Jul, Oct). */
export function nextRebalance(today: string): string {
  const y = +today.slice(0, 4), m = +today.slice(5, 7); let qy = y, qm = Math.floor((m - 1) / 3) * 3 + 4; if (qm > 12) { qm -= 12; qy++; }
  let d = `${qy}-${String(qm).padStart(2, '0')}-01`; while (!isSession(d)) d = new Date(ms(d) + DAY).toISOString().slice(0, 10); return d;
}
export const tradingBucketOk = (p: Plan): { ok: boolean; pct: number } => { const tot = p.buckets.reduce((a, b) => a + b.saved, 0), tr = p.buckets.filter((b) => b.trading).reduce((a, b) => a + b.saved, 0); const pct = tot ? (tr / tot) * 100 : 0; return { ok: pct <= p.tradingCapPct, pct: Math.round(pct * 10) / 10 }; };
/** The panic card shows only if both closes exist, are consecutive benchmark days, and the fall reaches the plan's threshold. Missing data shows nothing. */
export function panic(prevClose: number | null, lastClose: number | null, thresholdPct: number): { show: boolean; fallPct: number | null } {
  if (!(prevClose && lastClose && prevClose > 0)) return { show: false, fallPct: null }; const fall = ((lastClose - prevClose) / prevClose) * 100; return { show: fall <= -Math.abs(thresholdPct), fallPct: Math.round(fall * 100) / 100 };
}
export const planText = (p: Plan) => `Written ${p.createdOn}. Goal: ${p.goal}. Horizon: ${p.horizonYears} years. Monthly: ₹${p.monthly.toLocaleString('en-IN')}${p.escalationPct ? `, rising ${p.escalationPct}% every 12 months` : ''}. A fall of ${p.maxFallPct}% is inside this plan. I will stop if: ${p.stopReason}.`;
export { nextSession };
