// changes.ts — "What changed in 30 days" for one company (Pro §28 P2). Pure: every item is a dated fact from a feed the
// site already holds, with where it came from. Nothing is inferred about why anything happened.
//   price      the move over the window from daily closes, beside the Nifty's over the same closes
//   extremes   a close at a new 52-week high or low inside the window
//   big day    the largest one-day move, if it was 5% or more
//   results    a results date on file inside the window (unverified, as the Calendar says)
//   news       stories in the news feed that name the company by Alpha's matcher (A05 rules), with source and date
//   signals    Swing signals filed, entered, closed or voided in the window
// Rank: only the screen's comparison with its previous build exists (rank_move); a longer rank history is not stored (C13).
import type { ChartFeed, Row, Sig } from './types';
import type { Story } from './news';
import { pct } from './format.ts';

export interface Change { date: string; kind: 'price' | 'extreme' | 'move' | 'results' | 'news' | 'signal' | 'rank'; text: string; source: string; href?: string }
const DAY = 864e5;
const iso = (s: number) => new Date(s * 1000 + 5.5 * 3600e3).toISOString().slice(0, 10);      // the session date in India
const label = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function whatChanged(o: { row: Row; chart: ChartFeed | null; news: (Story & { mentions: string[] })[]; sigs: Sig[]; now: number; days?: number; prevBuild?: string | null }): { items: Change[]; window: [string, string]; notes: string[] } {
  const days = o.days ?? 30;
  const end = new Date(o.now + 5.5 * 3600e3).toISOString().slice(0, 10);
  const start = new Date(o.now - days * DAY + 5.5 * 3600e3).toISOString().slice(0, 10);
  const inWin = (d?: string | null) => !!d && d >= start && d <= end;
  const items: Change[] = [];
  const notes: string[] = [];
  const c = o.chart;
  if (c?.ok && c.t.length > 2) {
    const idx = c.t.map((t, i) => [iso(t), i] as const);
    const first = idx.find(([d]) => d >= start)?.[1];
    const last = c.t.length - 1;
    if (first !== undefined && first > 0 && first < last) {
      const base = first - 1;                       // the close before the window opened
      const mv = (c.c[last] / c.c[base] - 1) * 100;
      const n0 = c.nifty[base], n1 = c.nifty[last];
      const nifty = typeof n0 === 'number' && typeof n1 === 'number' ? ` against the Nifty's ${pct((n1 / n0 - 1) * 100, 1)}` : '';
      // a bar for today while the session can still be trading is a price, not a close (C11)
      const istNow = new Date(o.now + 5.5 * 3600e3), mins = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
      const intraday = iso(c.t[last]) === end && mins < 15 * 60 + 40;
      const to = intraday ? `the latest intraday price on ${label(iso(c.t[last]))}` : `the ${label(iso(c.t[last]))} close`;
      items.push({ date: iso(c.t[last]), kind: 'price', text: `${mv >= 0 ? 'Up' : 'Down'} ${pct(Math.abs(mv), 1, false)} from the ${label(iso(c.t[base]))} close to ${to}${nifty}`, source: 'Daily closes (Yahoo Finance)' });
      // new 52-week extremes: a close above (below) every close of the 252 sessions before it
      let hi: string | null = null, lo: string | null = null;
      for (let i = first; i <= last; i++) {
        const prior = c.c.slice(Math.max(0, i - 252), i);
        if (prior.length < 200) continue;
        if (c.c[i] > Math.max(...prior)) hi = iso(c.t[i]);
        if (c.c[i] < Math.min(...prior)) lo = iso(c.t[i]);
      }
      if (hi) items.push({ date: hi, kind: 'extreme', text: `Closed at a 52-week high on ${label(hi)}${hi !== iso(c.t[last]) ? ' (the latest such close in the window)' : ''}`, source: 'Daily closes' });
      if (lo) items.push({ date: lo, kind: 'extreme', text: `Closed at a 52-week low on ${label(lo)}${lo !== iso(c.t[last]) ? ' (the latest such close in the window)' : ''}`, source: 'Daily closes' });
      let big = 0, bigAt = -1;
      for (let i = first; i <= last; i++) { const m = (c.c[i] / c.c[i - 1] - 1) * 100; if (Math.abs(m) > Math.abs(big)) { big = m; bigAt = i; } }
      if (bigAt > 0 && Math.abs(big) >= 5) items.push({ date: iso(c.t[bigAt]), kind: 'move', text: `${big > 0 ? 'Rose' : 'Fell'} ${pct(Math.abs(big), 1, false)} on ${label(iso(c.t[bigAt]))}, the largest one-day move in the window`, source: 'Daily closes' });
    }
  } else notes.push('Price history could not be loaded, so price changes are not listed.');
  if (inWin(o.row.next_earnings)) items.push({ date: o.row.next_earnings!, kind: 'results', text: `Results date on file: ${label(o.row.next_earnings!)} (unverified; check the exchange filing)`, source: 'Results calendar (screen feed)' });
  for (const s of o.news) {
    const d = s.published ? new Date(s.published).toISOString().slice(0, 10) : null;
    if (!d || !inWin(d) || !s.mentions.includes(o.row.sym)) continue;
    items.push({ date: d, kind: 'news', text: s.title, source: s.source, href: s.link });
  }
  for (const g of o.sigs.filter((x) => x.sym === o.row.sym)) {
    if (inWin(g.date)) items.push({ date: g.date, kind: 'signal', text: `Swing ${g.setup.toLowerCase()} signal filed`, source: 'Swing engine' });
    if (inWin(g.entry_date)) items.push({ date: g.entry_date!, kind: 'signal', text: `Swing plan entered${g.entry ? ` at ₹${g.entry}` : ''}`, source: 'Swing engine' });
    if (g.status === 'closed' && inWin(g.closed_date)) items.push({ date: g.closed_date!, kind: 'signal', text: `Swing plan closed (${g.exit_reason ?? 'exit'})${typeof g.r_net === 'number' ? `, ${g.r_net >= 0 ? '+' : '−'}${Math.abs(g.r_net).toLocaleString('en-IN', { maximumFractionDigits: 2 })}R after costs` : ''}`, source: 'Swing engine' });
    if (g.status === 'void' && inWin(g.first_seen)) items.push({ date: g.first_seen, kind: 'signal', text: `Swing signal voided${g.void_reason ? `: ${g.void_reason}` : ''}`, source: 'Swing engine' });
  }
  const mv = (o.row as Row & { rank_move?: number | null }).rank_move;
  if (typeof mv === 'number' && mv !== 0) items.push({ date: o.row.last_date ?? end, kind: 'rank', text: `${mv > 0 ? 'Up' : 'Down'} ${Math.abs(mv)} place${Math.abs(mv) === 1 ? '' : 's'} in the screen's composite rank since its ${o.prevBuild ? `${label(o.prevBuild)} ` : 'previous '}build`, source: 'Screen, previous-build comparison' });
  notes.push('Only the previous-build rank comparison is available; a longer rank history is not stored.');
  const newsDays = o.news.map((s) => (s.published ? Date.parse(s.published) : NaN)).filter(Number.isFinite);
  if (newsDays.length) { const oldest = new Date(Math.min(...newsDays)).toISOString().slice(0, 10); if (oldest > start) notes.push(`The news feed reaches back only to ${label(oldest)}, so earlier stories in the window are not listed.`); }
  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { items, window: [start, end], notes };
}
