/** The Gate: a paper terminal where a trade cannot be entered without a checklist, a computed size and an attached stop.
 *  Pure state functions over the visitor's book (`rulebook-book/1`, kept in their browser). There is deliberately NO delete or edit of a closed trade here.
 *  The lock is a self-commitment device in the browser: clearing site data bypasses it. The rules page says so. */
import { evaluate, positionSize, type Fill } from './accounting.ts';
import { chargesFor } from './charges.ts';
import { nextSession } from './calendar.ts';
export interface Rules { accountSize: number; riskPct: number; dailyLossLimit: number; maxTradesPerDay: number; ruleText: string; strictUntil: string | null; setOn: string }
export interface Review { setupQuality: number; emotion: number; followedPlan: boolean }
export interface GateTrade { id: string; symbol: string; setup: string; trigger: string; stop: number; target: number; riskPct: number; qty: number; qtyOverrideReason: string | null;
  entry: { date: string; price: number }; exit: { date: string; price: number } | null; ruleBreak: boolean; review: Review | null; reviewSkipped: boolean }
export interface Book { schema: 'rulebook-book/1'; rules: Rules | null; trades: GateTrade[] }
export const emptyBook = (): Book => ({ schema: 'rulebook-book/1', rules: null, trades: [] });
export interface EntryInput { symbol: string; setup: string; trigger: string; stop: number | null; target: number | null; riskPct: number | null; entryPrice: number | null; qtyOverride?: number | null; overrideReason?: string }
export interface EntryCheck { ok: boolean; missing: string[]; qty: number | null; computedQty: number | null; error?: string }

const real = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
const text = (s: string | undefined) => !!s && s.trim().length >= 3;

/** Checks the five checklist items, the computed size, and the stop. Submit is enabled iff ok. */
export function checkEntry(i: EntryInput, rules: Rules | null): EntryCheck {
  const missing: string[] = [];
  if (!i.symbol || !/^[A-Za-z0-9&-]{1,20}$/.test(i.symbol.trim())) missing.push('stock');
  if (!text(i.setup)) missing.push('setup');
  if (!text(i.trigger)) missing.push('entry trigger');
  if (!real(i.stop)) missing.push('stop price');
  if (!real(i.target)) missing.push('target price');
  if (!real(i.riskPct) || i.riskPct > 5) missing.push('risk % (0–5)');
  if (!real(i.entryPrice)) missing.push('entry price');
  if (!rules) missing.push('account rules');
  if (missing.length) return { ok: false, missing, qty: null, computedQty: null };
  if (i.stop! >= i.entryPrice!) return { ok: false, missing: ['stop below entry'], qty: null, computedQty: null, error: 'The stop must be below the entry price.' };
  if (i.target! <= i.entryPrice!) return { ok: false, missing: ['target above entry'], qty: null, computedQty: null, error: 'The target must be above the entry price.' };
  const computed = positionSize(rules!.accountSize, i.riskPct!, i.entryPrice!, i.stop!);
  if (!computed || computed < 1) return { ok: false, missing: ['a size that fits the account'], qty: null, computedQty: computed, error: 'At this risk %, stop distance and account size the position is under one share.' };
  if (i.qtyOverride != null && i.qtyOverride !== computed) {
    if (!text(i.overrideReason)) return { ok: false, missing: ['a reason for the size override'], qty: null, computedQty: computed };
    if (!real(i.qtyOverride) || !Number.isInteger(i.qtyOverride)) return { ok: false, missing: ['a whole-share override'], qty: null, computedQty: computed };
    return { ok: true, missing: [], qty: i.qtyOverride, computedQty: computed };
  }
  return { ok: true, missing: [], qty: computed, computedQty: computed };
}

export const tradeFills = (t: GateTrade): Fill[] => {
  const f: Fill[] = [{ date: t.entry.date, side: 'buy', qty: t.qty, price: t.entry.price, charges: chargesFor('buy', t.qty, t.entry.price) }];
  if (t.exit) f.push({ date: t.exit.date, side: 'sell', qty: t.qty, price: t.exit.price, charges: chargesFor('sell', t.qty, t.exit.price) });
  return f;
};
export const tradeResult = (t: GateTrade, mark: number | null) => evaluate(tradeFills(t), t.stop, t.exit ? null : mark ?? t.entry.price);

export interface Lock { locked: boolean; reason: 'daily-loss' | 'max-trades' | null; until: string | null; quote: string | null }
/** Locked until the next session once today's realised loss reaches the limit or today's trade count reaches the maximum. `today` is a session date (YYYY-MM-DD). */
export function lockState(book: Book, today: string): Lock {
  const r = book.rules; if (!r) return { locked: false, reason: null, until: null, quote: null };
  const opened = book.trades.filter((t) => t.entry.date === today).length;
  const lost = -book.trades.filter((t) => t.exit?.date === today).reduce((a, t) => a + tradeResult(t, null).total, 0);
  const reason = lost >= r.dailyLossLimit && r.dailyLossLimit > 0 ? 'daily-loss' : opened >= r.maxTradesPerDay ? 'max-trades' : null;
  return reason ? { locked: true, reason, until: nextSession(today), quote: r.ruleText } : { locked: false, reason: null, until: null, quote: null };
}
/** Strict mode: while strictUntil is in the future the rules cannot be loosened. Tightening is always allowed. */
export function canEditRules(book: Book, today: string, next: Rules): { ok: boolean; why?: string } {
  const cur = book.rules; if (!cur || !cur.strictUntil || today >= cur.strictUntil) return { ok: true };
  const looser = next.riskPct > cur.riskPct || next.dailyLossLimit > cur.dailyLossLimit || next.maxTradesPerDay > cur.maxTradesPerDay || (next.strictUntil ?? '') < cur.strictUntil || next.ruleText !== cur.ruleText;
  return looser ? { ok: false, why: `Strict mode: these rules are locked until ${cur.strictUntil}. They can be tightened, not loosened.` } : { ok: true };
}
export function openTrade(book: Book, i: EntryInput, today: string): { book: Book; error?: string } {
  const lock = lockState(book, today); if (lock.locked) return { book, error: 'The terminal is locked until the next session.' };
  const c = checkEntry(i, book.rules); if (!c.ok) return { book, error: 'Checklist incomplete: ' + c.missing.join(', ') };
  const t: GateTrade = { id: `${today}-${book.trades.length + 1}`, symbol: i.symbol.trim().toUpperCase(), setup: i.setup.trim(), trigger: i.trigger.trim(), stop: i.stop!, target: i.target!, riskPct: i.riskPct!, qty: c.qty!,
    qtyOverrideReason: c.qty !== c.computedQty ? i.overrideReason!.trim() : null, entry: { date: today, price: i.entryPrice! }, exit: null, ruleBreak: false, review: null, reviewSkipped: false };
  return { book: { ...book, trades: [...book.trades, t] } };
}
/** Closing tags a rule break at the moment it happens: a long closed below its own logged stop. */
export function closeTrade(book: Book, id: string, price: number, date: string): { book: Book; error?: string } {
  const t = book.trades.find((x) => x.id === id); if (!t || t.exit) return { book, error: 'No open trade with that id.' };
  if (!real(price)) return { book, error: 'Enter a real exit price.' };
  const closed = { ...t, exit: { date, price }, ruleBreak: price < t.stop };
  return { book: { ...book, trades: book.trades.map((x) => (x.id === id ? closed : x)) } };
}
export function reviewTrade(book: Book, id: string, r: Review | 'skip'): Book {
  return { ...book, trades: book.trades.map((t) => { if (t.id !== id || !t.exit || t.review || t.reviewSkipped) return t; return r === 'skip' ? { ...t, reviewSkipped: true } : { ...t, review: r }; }) };
}
export interface Journal { closed: number; assessed: number; followed: number; planPct: number | null; skipped: number; mistakeCost: number; planCurve: { date: string; v: number }[]; breakCurve: { date: string; v: number }[]; pnl: number }
export function journal(book: Book): Journal {
  const cl = book.trades.filter((t) => t.exit).sort((a, b) => a.exit!.date.localeCompare(b.exit!.date));
  const follow = (t: GateTrade) => !t.ruleBreak && t.review?.followedPlan === true, brk = (t: GateTrade) => t.ruleBreak || t.review?.followedPlan === false;
  const assessed = cl.filter((t) => t.review || t.ruleBreak), followed = assessed.filter(follow);
  const curve = (pred: (t: GateTrade) => boolean) => { let v = 0; return cl.filter(pred).map((t) => ({ date: t.exit!.date, v: (v += tradeResult(t, null).total) })); };
  const mistake = cl.filter(brk).reduce((a, t) => a + Math.max(0, -tradeResult(t, null).total), 0);
  return { closed: cl.length, assessed: assessed.length, followed: followed.length, planPct: assessed.length ? Math.round((followed.length / assessed.length) * 100) : null, skipped: cl.filter((t) => t.reviewSkipped).length,
    mistakeCost: Math.round(mistake * 100) / 100, planCurve: curve(follow), breakCurve: curve(brk), pnl: Math.round(cl.reduce((a, t) => a + tradeResult(t, null).total, 0) * 100) / 100 };
}
/** Process behaviours only. Never trade count, never P&L. */
export function processBadges(book: Book, today: string): string[] {
  const j = journal(book), out: string[] = [];
  if (j.closed >= 5 && j.skipped === 0 && book.trades.filter((t) => t.exit).every((t) => t.review)) out.push('Journal completed on every closed trade');
  if (j.assessed >= 5 && j.planPct === 100) out.push('Followed the plan on every assessed trade');
  if (lockState(book, today).locked) out.push('Sat out a locked day');
  return out;
}
