/** Since your last visit: what changed in the companies you follow, measured against what you were last SHOWN.
 *  Pure functions only. Nothing here reads the clock, the network or the DOM; the caller passes `now` and the rows.
 *  Rules kept (each is pinned by tests/sincevisit.test.ts):
 *   - a change is reported only against a stored earlier snapshot; the first time a name is seen there is no comparison ("Tracking starts today");
 *   - only the explicit, named thresholds below make an item; an ordinary price move does not;
 *   - a change is tied to a saved thesis only by the one stated rule (a price level written in the invalidation text); otherwise it says "New information to review";
 *   - dismissing is reversible, and nothing a user wrote is read out of this module into a URL or a request. */
import type { Row, Trend } from './screen.ts';
import { trendChecks, trendOf } from './screen.ts';
import { eligibilityOf } from './eligibility.ts';
import type { Entry, State } from './store.ts';
import { current } from './store.ts';

/** Every threshold in one place so a test (and a reader) can see the whole rule set. */
export const THRESHOLDS = {
  /** a close-to-close move since the snapshot counts when it exceeds this many of the name's own daily ATRs (atr_pct) */
  atrMultiple: 2,
  rsiHigh: 70, rsiLow: 30,
  /** results date this close (calendar days, inclusive) is surfaced once */
  resultsDays: 7,
  /** a 52-week high or low is "new" when the close is within this percent of it */
  extremePct: 0.1,
  /** snapshots kept per name */
  history: 5,
  /** an unacknowledged change is dropped after this many days */
  inboxDays: 14, inboxMax: 50,
  /** the module must have been on screen this long (ms) before a snapshot is recorded */
  visibleMs: 3000,
} as const;

export interface SeenSnap {
  at: string; day: string; px: number | null; rsi: number | null; rs3m: number | null; from_high: number | null; atr_pct: number | null; sma200: number | null; high52: number | null; low52: number | null;
  trend: Trend | null; rules: number | null; next_earnings: string | null; risk: string | null; elig: string | null;
}
export type ChangeKind = 'invalidation' | 'trend' | 'sma200' | 'high52' | 'low52' | 'rsi' | 'results' | 'risk' | 'elig' | 'move';
export interface SeenChange {
  id: string; sym: string; kind: ChangeKind; title: string; before: string; after: string;
  /** the source and dates of both snapshots, in words */
  basis: string; prevDay: string; curDay: string; prevAt: string; curAt: string;
  /** "crossed your stated invalidation level 2,400" (explicit rule) or "New information to review" */
  framing: string; entryId: string | null;
}
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const n2 = (v: number | null | undefined): number | null => (num(v) ? v : null);
const f0 = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const f2 = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const px = (v: number) => '₹' + (Math.abs(v) >= 1000 ? f0(v) : f2(v));
const WORD: Record<Trend, string> = { up: 'Uptrend', down: 'Downtrend', mixed: 'Sideways' };
const NEUTRAL = 'New information to review';

/** What the screen row says today, in the shape stored. `day` is the screen's data day. */
export function snapOf(r: Row, day: string, nowIso: string): SeenSnap {
  const t = trendOf(r); const k = trendChecks(r);
  const e = eligibilityOf(r); const lim = (Object.keys(e.metrics) as (keyof typeof e.metrics)[]).filter((m) => !e.metrics[m].ok);
  return { at: nowIso, day, px: n2(r.price), rsi: n2(r.rsi), rs3m: n2(r.rs3m), from_high: n2(r.from_high), atr_pct: n2(r.atr_pct), sma200: n2(r.sma200), high52: n2(r.high52), low52: n2(r.low52),
    trend: t.trend, rules: k ? k.up.filter(([, ok]) => ok).length : null, next_earnings: r.next_earnings ?? null, risk: r.risk_lvl ?? null, elig: e.financial ? 'financial sector' : lim.length ? `limited: ${lim.join(', ')}` : 'full' };
}
const same = (a: SeenSnap, b: SeenSnap) => (['day', 'px', 'rsi', 'rs3m', 'from_high', 'atr_pct', 'sma200', 'high52', 'low52', 'trend', 'rules', 'next_earnings', 'risk', 'elig'] as const).every((k) => a[k] === b[k]);

/** The invalidation text, read the one way that is explainable: "below 2,400" / "under ₹2400" / "above 3,100". Anything else is not a level. */
export function parseLevel(text: string): { dir: 'below' | 'above'; level: number; shown: string } | null {
  const m = /\b(below|under|beneath|above|over|breaks?\s+above|breaks?\s+below)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)/i.exec(text ?? '');
  if (!m) return null;
  const level = Number(m[2].replace(/,/g, '')); if (!Number.isFinite(level) || level <= 0) return null;
  const w = m[1].toLowerCase(); const dir = /below|under|beneath/.test(w) ? 'below' : 'above';
  return { dir, level, shown: m[2] };
}
const daysTo = (to: string, from: string) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
const rid = (...p: (string | number)[]) => p.join('|');

export interface DetectIn { sym: string; prev: SeenSnap; cur: SeenSnap; entry?: Entry | null; /** a live print from today, used ONLY for the stated-invalidation rule, and labelled as live */ live?: number | null; today: string }
export function detect({ sym, prev, cur, entry, live, today }: DetectIn): SeenChange[] {
  const out: SeenChange[] = []; const base = `Screen data, ${prev.day} to ${cur.day}`;
  const mk = (kind: ChangeKind, key: string, title: string, before: string, after: string, o: { framing?: string; basis?: string } = {}) => out.push({ id: rid(sym, kind, key, cur.day), sym, kind, title, before, after, basis: o.basis ?? `${base}. Seen ${prev.at.slice(0, 10)}, now ${cur.at.slice(0, 10)}.`, prevDay: prev.day, curDay: cur.day, prevAt: prev.at, curAt: cur.at, framing: o.framing ?? NEUTRAL, entryId: entry?.id ?? null });
  // 1. the user's own stated invalidation level, the only link to a thesis
  const lv = entry && !entry.archived ? parseLevel(current(entry).invalidation) : null;
  if (lv && num(prev.px)) {
    const now = num(live) ? live : cur.px; const src = num(live) ? 'live price' : `close of ${cur.day}`;
    if (num(now) && ((lv.dir === 'below' && prev.px >= lv.level && now < lv.level) || (lv.dir === 'above' && prev.px <= lv.level && now > lv.level)))
      mk('invalidation', `${lv.dir}${lv.level}${num(live) ? 'live' : ''}`, `${lv.dir === 'below' ? 'Fell below' : 'Rose above'} ${px(lv.level)}`, `${px(prev.px)} (close of ${prev.day})`, `${px(now)} (${src})`, { framing: `crossed your stated invalidation level ${lv.shown}`, basis: `Your thesis says "${current(entry!).invalidation.trim().slice(0, 80)}". Compared ${prev.day} close with the ${src}.` });
  }
  if (prev.trend && cur.trend && prev.trend !== cur.trend) mk('trend', `${prev.trend}-${cur.trend}`, 'Trend class changed', WORD[prev.trend], WORD[cur.trend]);
  if (num(prev.px) && num(prev.sma200) && num(cur.px) && num(cur.sma200)) {
    const a = prev.px > prev.sma200, b = cur.px > cur.sma200;
    if (a !== b) mk('sma200', b ? 'up' : 'down', b ? 'Moved above its 200-day average' : 'Fell below its 200-day average', `${px(prev.px)} vs ${px(prev.sma200)}`, `${px(cur.px)} vs ${px(cur.sma200)}`);
  }
  const atHigh = (s: SeenSnap) => num(s.px) && num(s.high52) && s.px >= s.high52 * (1 - THRESHOLDS.extremePct / 100);
  const atLow = (s: SeenSnap) => num(s.px) && num(s.low52) && s.px <= s.low52 * (1 + THRESHOLDS.extremePct / 100);
  if (atHigh(cur) && !atHigh(prev)) mk('high52', 'h', 'New 52-week high', prev.from_high != null ? `${f2(prev.from_high)}% from its high` : 'below its high', `${px(cur.px!)} at the 52-week high ${px(cur.high52!)}`);
  if (atLow(cur) && !atLow(prev)) mk('low52', 'l', 'New 52-week low', prev.low52 != null && num(prev.px) ? `${px(prev.px)} (low ${px(prev.low52)})` : 'above its low', `${px(cur.px!)} at the 52-week low ${px(cur.low52!)}`);
  if (num(prev.rsi) && num(cur.rsi)) {
    const { rsiHigh: H, rsiLow: L } = THRESHOLDS;
    if (prev.rsi < H && cur.rsi >= H) mk('rsi', 'up70', `RSI crossed ${H}`, `RSI ${prev.rsi.toFixed(0)}`, `RSI ${cur.rsi.toFixed(0)}`);
    else if (prev.rsi >= H && cur.rsi < H) mk('rsi', 'dn70', `RSI fell back under ${H}`, `RSI ${prev.rsi.toFixed(0)}`, `RSI ${cur.rsi.toFixed(0)}`);
    else if (prev.rsi > L && cur.rsi <= L) mk('rsi', 'dn30', `RSI crossed ${L}`, `RSI ${prev.rsi.toFixed(0)}`, `RSI ${cur.rsi.toFixed(0)}`);
    else if (prev.rsi <= L && cur.rsi > L) mk('rsi', 'up30', `RSI recovered above ${L}`, `RSI ${prev.rsi.toFixed(0)}`, `RSI ${cur.rsi.toFixed(0)}`);
  }
  if (cur.next_earnings) {
    const d = daysTo(cur.next_earnings, today); const was = prev.next_earnings === cur.next_earnings && daysTo(prev.next_earnings, prev.day) <= THRESHOLDS.resultsDays && daysTo(prev.next_earnings, prev.day) >= 0;
    if (d >= 0 && d <= THRESHOLDS.resultsDays && !was) mk('results', cur.next_earnings, d === 0 ? 'Results due today' : `Results in ${d} day${d === 1 ? '' : 's'}`, prev.next_earnings ? `date ${prev.next_earnings}` : 'no date published', `estimated date ${cur.next_earnings}`);
  }
  if (prev.risk && cur.risk && prev.risk !== cur.risk) mk('risk', `${prev.risk}-${cur.risk}`, 'Risk grade changed', prev.risk, cur.risk);
  if (prev.elig && cur.elig && prev.elig !== cur.elig) mk('elig', cur.elig, 'Eligibility status changed', prev.elig, cur.elig);
  if (num(prev.px) && num(cur.px) && num(cur.atr_pct) && cur.atr_pct > 0) {
    const mv = (cur.px / prev.px - 1) * 100; const lim = THRESHOLDS.atrMultiple * cur.atr_pct;
    if (Math.abs(mv) >= lim) mk('move', mv > 0 ? 'up' : 'down', `${mv > 0 ? 'Up' : 'Down'} ${Math.abs(mv).toFixed(1)}% since ${prev.day}`, px(prev.px), px(cur.px), { basis: `${base}. A move of ${THRESHOLDS.atrMultiple}x its daily range (ATR ${cur.atr_pct.toFixed(1)}%) or more.` });
  }
  return out;
}

export interface Surface {
  /** no followed name has an earlier snapshot: nothing can be compared yet */
  first: boolean;
  /** followed names whose first snapshot has not been taken ("Tracking starts today") */
  starting: string[];
  fresh: SeenChange[]; earlier: SeenChange[]; dismissed: SeenChange[];
  /** the screen day of the earlier snapshot and the current one, when the day advanced */
  dayFrom: string | null; dayTo: string | null;
  /** names compared (had a prior snapshot) */
  compared: number;
}
const rank: Record<ChangeKind, number> = { invalidation: 0, elig: 1, risk: 2, trend: 3, sma200: 4, high52: 5, low52: 5, results: 6, rsi: 7, move: 8 };
const order = (a: SeenChange, b: SeenChange) => rank[a.kind] - rank[b.kind] || a.sym.localeCompare(b.sym);

/** `baseline` is each name's last snapshot as it stood when the module mounted (before this visit wrote anything). */
export function surface(s: State, baseline: Record<string, SeenSnap | undefined>, rows: readonly Row[], day: string | null, today: string, nowIso: string, live: Record<string, number | null | undefined> = {}): Surface {
  const empty: Surface = { first: true, starting: [], fresh: [], earlier: [], dismissed: [], dayFrom: null, dayTo: null, compared: 0 };
  if (!day) return empty;
  const found: SeenChange[] = []; const starting: string[] = []; let compared = 0; let dayFrom = null as string | null;
  for (const sym of s.follows) {
    const r = rows.find((x) => x.sym === sym); if (!r) continue;
    const prev = baseline[sym]; if (!prev) { starting.push(sym); continue; }
    compared++; if (prev.day < day) dayFrom = !dayFrom || prev.day < dayFrom ? prev.day : dayFrom;
    const entry = s.entries.find((e) => e.sym === sym && !e.archived) ?? null;
    found.push(...detect({ sym, prev, cur: snapOf(r, day, nowIso), entry, live: live[sym], today }));
  }
  const dis = s.dismissed ?? {}; const ids = new Set(found.map((c) => c.id));
  const kept = (s.inbox ?? []).filter((c) => !ids.has(c.id) && s.follows.includes(c.sym) && daysTo(today, c.curAt.slice(0, 10)) <= THRESHOLDS.inboxDays);
  const all = [...found.map((c) => ({ c, fresh: true })), ...kept.map((c) => ({ c, fresh: false }))];
  return { first: compared === 0, starting, fresh: all.filter((x) => x.fresh && !dis[x.c.id]).map((x) => x.c).sort(order), earlier: all.filter((x) => !x.fresh && !dis[x.c.id]).map((x) => x.c).sort(order),
    dismissed: all.filter((x) => dis[x.c.id]).map((x) => x.c).sort(order), dayFrom, dayTo: compared ? day : null, compared };
}

/** Record what the user was shown. Called only after the module has been visible for THRESHOLDS.visibleMs. Idempotent: the same data adds nothing. */
export function recordSeen(s: State, rows: readonly Row[], day: string | null, shown: readonly SeenChange[], nowIso: string, today: string): State {
  if (!day) return s;
  const seen: NonNullable<State['seen']> = { ...(s.seen ?? {}) }; let touched = false;
  for (const sym of s.follows) {
    const r = rows.find((x) => x.sym === sym); if (!r) continue;
    const list = seen[sym] ?? []; const snap = snapOf(r, day, nowIso); const last = list[list.length - 1];
    if (last && same(last, snap)) continue;                      // nothing new was shown for this name
    seen[sym] = [...list, snap].slice(-THRESHOLDS.history); touched = true;
  }
  const prevIn = s.inbox ?? []; const have = new Set(prevIn.map((c) => c.id));
  let inbox = [...shown.filter((c) => !have.has(c.id)), ...prevIn].filter((c) => daysTo(today, c.curAt.slice(0, 10)) <= THRESHOLDS.inboxDays).slice(0, THRESHOLDS.inboxMax);
  const keep = new Set(inbox.map((c) => c.id)); const dis = Object.fromEntries(Object.entries(s.dismissed ?? {}).filter(([id]) => keep.has(id)));   // a dismissal outlives its item by nothing
  if (!touched && inbox.length === prevIn.length && inbox.every((c, i) => c === prevIn[i]) && Object.keys(dis).length === Object.keys(s.dismissed ?? {}).length) return s;
  return { ...s, seen, inbox, dismissed: dis };
}
export const lastSeen = (s: State): Record<string, SeenSnap | undefined> => Object.fromEntries(Object.entries(s.seen ?? {}).map(([k, v]) => [k, v[v.length - 1]]));
export const dismissChange = (s: State, id: string, nowIso: string): State => ((s.dismissed ?? {})[id] ? s : { ...s, dismissed: { ...(s.dismissed ?? {}), [id]: nowIso } });
export const restoreChange = (s: State, id: string): State => { if (!(s.dismissed ?? {})[id]) return s; const d = { ...(s.dismissed ?? {}) }; delete d[id]; return { ...s, dismissed: d }; };
