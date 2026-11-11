/** Today's departure board (revamp v2, 11 Nov 2026): one row per followed company, and the paper book's two positions nearest a level. PURE: no React, no clock, no network;
 *  the caller passes every input, so tests/todayboard.test.ts drives each rule. It only arranges facts the app already holds (the screen row, the since-visit changes, the news pool,
 *  the thesis review dates, the paper book). It predicts nothing, ranks no company as better than another, and changes no engine, eligibility or exit rule. */
import type { ChangeKind, SeenChange } from './sincevisit.ts';
import { fitForToday, isMarket, type NewsEvent } from './newsview.ts';

export type ChipTone = 'up' | 'down' | 'amber' | 'accent' | '';
export interface BoardChip { id: string; text: string; tone: ChipTone }

/** The short word a change carries on its row. The full sentence (before and after, basis) is in the expanded row. */
export const CHANGE_CHIP: Record<ChangeKind, (c: SeenChange) => { text: string; tone: ChipTone }> = {
  invalidation: () => ({ text: 'Thesis level crossed', tone: 'down' }),
  trend: (c) => ({ text: `Now ${c.after.toLowerCase()}`, tone: c.after === 'Uptrend' ? 'up' : c.after === 'Downtrend' ? 'down' : '' }),
  sma200: (c) => ({ text: /above/i.test(c.title) ? 'Crossed above 200-day' : 'Fell below 200-day', tone: /above/i.test(c.title) ? 'up' : 'down' }),
  high52: () => ({ text: '52-week high', tone: 'up' }),
  low52: () => ({ text: '52-week low', tone: 'down' }),
  rsi: (c) => ({ text: c.title.replace('RSI crossed', 'RSI above').replace('RSI fell back under', 'RSI back under'), tone: '' }),
  results: () => ({ text: 'Results soon', tone: 'amber' }),
  risk: (c) => ({ text: `Risk ${c.after}`, tone: 'amber' }),
  elig: () => ({ text: 'Eligibility changed', tone: 'amber' }),
  move: (c) => ({ text: c.title.replace(/ since .*/, ''), tone: /^Up/.test(c.title) ? 'up' : 'down' }),
};

export interface RowFacts {
  sym: string;
  /** the since-visit changes for this name (not dismissed), most important first */
  changes: readonly SeenChange[];
  /** fit-for-Today news events naming this company */
  news: readonly NewsEvent[];
  /** a saved thesis whose review date is today or past */
  review: 'overdue' | 'today' | null;
  /** an open, pending or waiting paper position in this name (the automatic book or one taken by hand) */
  inBook: boolean;
  /** the screen's next results date (estimated), YYYY-MM-DD, or null */
  nextResults: string | null;
  /** today's India date, YYYY-MM-DD */
  today: string;
}
const daysTo = (to: string, from: string) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
/** Within this many days a results date is worth a chip on the row. */
export const RESULTS_CHIP_DAYS = 14;
const SHORT = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The chips under one row, in a fixed order of how much they ask of the reader: a crossed thesis level, a review due, results, the changes, headlines, the paper book.
 *  Each fact appears once: a results reminder from the since-visit changes is not repeated beside the results chip. */
export function boardChips(f: RowFacts): BoardChip[] {
  const out: BoardChip[] = [];
  const inv = f.changes.find((c) => c.kind === 'invalidation'); if (inv) out.push({ id: 'inv', ...CHANGE_CHIP.invalidation(inv) });
  if (f.review) out.push({ id: 'review', text: f.review === 'overdue' ? 'Thesis review overdue' : 'Thesis review due', tone: 'amber' });
  const resultsNews = f.news.some((e) => e.eventType === 'Results');
  if (resultsNews) out.push({ id: 'results', text: 'Results out', tone: 'amber' });
  else if (f.nextResults) { const d = daysTo(f.nextResults, f.today); if (d >= 0 && d <= RESULTS_CHIP_DAYS) out.push({ id: 'results', text: d === 0 ? 'Results today' : `Results ${SHORT(f.nextResults)}`, tone: 'amber' }); }
  for (const c of f.changes) { if (c.kind === 'invalidation' || c.kind === 'results') continue; out.push({ id: `c|${c.id}`, ...CHANGE_CHIP[c.kind](c) }); }
  if (f.news.length) out.push({ id: 'news', text: `${f.news.length} headline${f.news.length === 1 ? '' : 's'}`, tone: 'accent' });
  if (f.inBook) out.push({ id: 'book', text: 'In paper book', tone: '' });
  return out;
}
/** How much a row asks for attention, for the order of the board: a crossed thesis level, then a review due, then any change, then news, then the rest. Ties keep the follow order. */
export function attention(f: Pick<RowFacts, 'changes' | 'news' | 'review'>): number {
  if (f.changes.some((c) => c.kind === 'invalidation')) return 4;
  if (f.review) return 3;
  if (f.changes.length) return 2;
  if (f.news.length) return 1;
  return 0;
}
export function orderBoard<T extends { sym: string; score: number }>(rows: readonly T[], follows: readonly string[]): T[] {
  return [...rows].sort((a, b) => b.score - a.score || follows.indexOf(a.sym) - follows.indexOf(b.sym));
}

const symsOf = (e: NewsEvent) => e.entities.map((x) => x.sym).filter((s): s is string => !!s);
const pubMs = (e: NewsEvent) => { const t = e.publishedAt ? Date.parse(e.publishedAt) : NaN; return Number.isFinite(t) ? t : 0; };
/** Splits the news pool for Today: each followed company's own stories (newest first, at most `perCompany`), and at most `marketMax` India-wide stories from `market` (already ranked),
 *  with any story already shown on the board left out, so the same event is never listed twice on the page (dedupe by event id). */
export function splitNews(pool: readonly NewsEvent[], market: readonly NewsEvent[], follows: readonly string[], nowMs: number, perCompany = 3, marketMax = 3): { bySym: Record<string, NewsEvent[]>; market: NewsEvent[] } {
  const bySym: Record<string, NewsEvent[]> = {}; const onBoard = new Set<string>();
  for (const sym of follows) {
    const mine = pool.filter((e) => fitForToday(e, nowMs) && symsOf(e).includes(sym) && !onBoard.has(e.eventClusterId)).sort((a, b) => pubMs(b) - pubMs(a)).slice(0, perCompany);
    for (const e of mine) onBoard.add(e.eventClusterId);
    bySym[sym] = mine;
  }
  return { bySym, market: market.filter((e) => isMarket(e) && !onBoard.has(e.eventClusterId)).slice(0, marketMax) };
}

export interface LevelPos { id: string; sym: string; mark: number; stop: number; target: number | null }
/** How far the price is from the nearer of its stop and its next unfilled target, as a share of the price (0.02 = 2%). Null without a usable price. */
export function levelGap(p: LevelPos): { gap: number; near: 'stop' | 'target' } | null {
  if (!(p.mark > 0) || !Number.isFinite(p.stop)) return null;
  const s = Math.abs(p.mark - p.stop) / p.mark; const t = p.target != null && Number.isFinite(p.target) ? Math.abs(p.target - p.mark) / p.mark : Infinity;
  return t < s ? { gap: t, near: 'target' } : { gap: s, near: 'stop' };
}
/** The `n` open positions whose price sits nearest a stop or a target, nearest first. Ties go to the stop (it is the one that closes the position). */
export function nearestLevels<T extends LevelPos>(ps: readonly T[], n = 2): (T & { gap: number; near: 'stop' | 'target' })[] {
  return ps.map((p) => { const g = levelGap(p); return g ? { ...p, ...g } : null; }).filter((x): x is T & { gap: number; near: 'stop' | 'target' } => !!x)
    .sort((a, b) => a.gap - b.gap || (a.near === 'stop' ? -1 : 1) - (b.near === 'stop' ? -1 : 1)).slice(0, n);
}
