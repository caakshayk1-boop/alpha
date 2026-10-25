/** The evidence digest: for each company you follow, what the site's own feeds say happened lately, each item with where it
 *  came from and when. Pure functions, tested in tests/lib.test.ts.
 *
 *  Rules, all stated on the page:
 *    news      a publisher story from the last 72 hours that names the company by ticker or full name (lib/newsdesk.ts, strict)
 *    results   the screen's estimated results date, within the next 14 days; unconfirmed
 *    move      a one-day move of 5% or more at the screen's close
 *    volume    volume at 2x or more of its recent average (the screen's spike measure) at the close
 *    high      a close at a new 52-week high
 *    review    a figure that changed since you last marked the company reviewed (lib/review.ts)
 *    paper     a Swing v2 paper setup that is pending or open for it
 *  A field the feed does not carry produces no item, never a zero. No item for a company is "nothing on the record from these
 *  sources", not an all-clear: the digest cannot see filings, announcements or anything outside these feeds. Nothing predicts. */
import { num } from './format.ts';
import { diffSnapshot, type Snapshot } from './review.ts';
import type { Row, Sig } from './types.ts';

export type EvKind = 'news' | 'results' | 'move' | 'volume' | 'high' | 'review' | 'paper';
export interface Evidence { sym: string; kind: EvKind; text: string; source: string; at: string | null; href?: string; basis?: string }
export interface Story { title: string; source: string; link: string; published?: string | null }
export const NEWS_HOURS = 72, RESULTS_DAYS = 14, MOVE_PCT = 5, VOLUME_X = 2;
export const KIND_LABEL: Record<EvKind, string> = { news: 'News', results: 'Results', move: 'Move', volume: 'Volume', high: '52-week high', review: 'Since review', paper: 'Paper book' };
const ORDER: EvKind[] = ['paper', 'results', 'news', 'move', 'volume', 'high', 'review'];

type EvRow = Row & { vol_spike?: number | null; brk52w?: boolean | null };
const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export interface EvidenceInput {
  sym: string; row: Row | null; snap: Snapshot | null; signals: readonly Sig[];
  stories: readonly { story: Story; basis: string }[];      // stories already matched to this company, with the matcher's basis
  todayIso: string; nowMs: number;
}

export function evidenceFor(i: EvidenceInput): Evidence[] {
  const out: Evidence[] = [];
  const r = i.row as EvRow | null;
  for (const { story, basis } of i.stories) {
    const t = story.published ? Date.parse(story.published) : NaN;
    if (!Number.isFinite(t) || i.nowMs - t > NEWS_HOURS * 3600e3 || t - i.nowMs > 6 * 3600e3) continue;     // no stated time, too old, or from the future: not evidence of "lately"
    out.push({ sym: i.sym, kind: 'news', text: story.title.trim(), source: story.source, at: story.published ?? null, href: story.link, basis });
  }
  if (r) {
    const d = r.last_date ?? null, close = 'close';
    if (r.next_earnings && r.next_earnings >= i.todayIso && dayMs(r.next_earnings) - dayMs(i.todayIso) <= RESULTS_DAYS * 864e5)
      out.push({ sym: i.sym, kind: 'results', text: `Results expected ${r.next_earnings}. The screen's estimate; no exchange has confirmed it.`, source: 'Alpha screen (estimate)', at: r.next_earnings });
    if (fin(r.r1d) && Math.abs(r.r1d) >= MOVE_PCT)
      out.push({ sym: i.sym, kind: 'move', text: `${r.r1d > 0 ? 'Rose' : 'Fell'} ${num(Math.abs(r.r1d), 1)}% in one session. The screen does not say why.`, source: `Alpha screen, ${close}`, at: d });
    if (fin(r.vol_spike) && r.vol_spike >= VOLUME_X)
      out.push({ sym: i.sym, kind: 'volume', text: `Volume ${num(r.vol_spike, 1)}x its recent average.`, source: `Alpha screen, ${close}`, at: d });
    if (r.brk52w === true)
      out.push({ sym: i.sym, kind: 'high', text: 'Closed at a new 52-week high.', source: `Alpha screen, ${close}`, at: d });
    if (i.snap) for (const c of diffSnapshot(i.snap, r))
      out.push({ sym: i.sym, kind: 'review', text: `${c.field}: ${c.from} to ${c.to}`, source: `Your review of ${i.snap.at.slice(0, 10)}`, at: d });
  }
  for (const s of i.signals)
    if (s.sym === i.sym && (s.status === 'pending' || s.status === 'open'))
      out.push({ sym: i.sym, kind: 'paper', text: `Swing v2 paper setup, ${s.status === 'open' ? 'entered' : 'waiting for entry'}. Paper only, not advice.`, source: 'Swing v2 paper book', at: s.date, href: '/trades/' });
  return out.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || (b.at ?? '').localeCompare(a.at ?? ''));
}

/** Evidence across several names, newest first, for the compact card on Today. Items without a time sort last. */
export function newestFirst(all: readonly Evidence[], limit: number): Evidence[] {
  return [...all].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')).slice(0, limit);
}
