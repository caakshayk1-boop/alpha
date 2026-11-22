/** The daily edition and the Saturday weekly note (22 Nov 2026). An edition is one frozen record per trading day, written once after the feed for that day lands (never rewritten): the day's breakout observations first, then
 *  what the paper book did and how the market breadth looked. The weekly note is computed from that week's editions. ONE structure (blocks) feeds both the archive pages and the email text, so they cannot differ.
 *  Everything here is a pure function of the feed, the ledger and earlier editions. Observations, not recommendations; nothing predicts. */
import { num, type Feed } from './feed.ts';
import type { Ledger } from './ledger.ts';
import { tradeRows, heroSeries, dmy, signed, inr } from './view.ts';
import { isSession } from './calendar.ts';
import { SCREENS } from './screens.ts';
import { scanBreakouts, BREAKOUT, type BreakoutScan } from './breakouts.ts';

export const EDITION_SCHEMA = 'rulebook-edition/1';
export const DISCLAIMER = 'Educational and paper-only. Rulebook is not investment advice or a research report, and nothing here is a recommendation to buy, sell or hold any security. Every figure is simulated or a published market fact, and past moves do not predict future ones.';
export interface EarlierItem { sym: string; listed_on: string; listed_px: number; now_px: number | null; ret_pct: number | null; sessions: number }
export interface Edition {
  schema: string; date: string; generated_at: string;
  feed: { price_date: string; built_on: string | null; rows: number };
  market: { priced: number; advancers: number; decliners: number; unchanged: number; above_50_pct: number | null; above_200_pct: number | null; new_50_highs: number; new_52w_highs: number };
  book: { as_of: string | null; equity: number | null; day_change: number | null; return_pct: number | null; benchmark_pct: number | null; open: number; closed: number };
  screens: { id: string; name: string; listed: string[]; passed: number }[];
  closed_today: { symbol: string; reason: string; pnl: number | null; r: number | null }[];
  breakouts: BreakoutScan; earlier: EarlierItem[];
}
const px2 = (x: number) => '₹' + x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r1 = (x: number) => Math.round(x * 10) / 10, r2 = (x: number) => Math.round(x * 100) / 100;
/** Trading sessions in (a, b]. */
export function sessionsBetween(a: string, b: string): number { let n = 0; for (let t = Date.parse(a + 'T00:00:00Z') + 864e5; t <= Date.parse(b + 'T00:00:00Z'); t += 864e5) if (isSession(new Date(t).toISOString().slice(0, 10))) n++; return n; }
export const EARLIER_WINDOW = 20;

export interface EditionInputs { feed: Pick<Feed, 'rows' | 'bySym' | 'asOf' | 'builtOn'>; ledger: Ledger; mark: (s: string) => number | null; prior: Edition[]; now: string }
export function buildEdition(inp: EditionInputs): Edition {
  const F = inp.feed, L = inp.ledger, date = F.asOf, today = F.rows.filter((r) => num(r, 'price') != null && r.last_date === date);
  const up = today.filter((r) => (num(r, 'r1d') ?? 0) > 0).length, down = today.filter((r) => (num(r, 'r1d') ?? 0) < 0).length;
  const frac = (key: 'sma50' | 'sma200') => { const have = today.filter((r) => num(r, key) != null); return have.length ? r1((have.filter((r) => r.price > r[key]).length / have.length) * 100) : null; };
  const days = L.book_days.filter((b) => b.screen_id === 'all').sort((a, b) => a.date.localeCompare(b.date)), last = days.at(-1), prev = days.at(-2), series = heroSeries(L, 'all'), tip = series.at(-1);
  const a = L.aggregates.find((x) => x.screen_id === 'all');
  const earlier: EarlierItem[] = [];
  for (const p of inp.prior.filter((e) => e.date < date).sort((x, y) => y.date.localeCompare(x.date))) {
    const n = sessionsBetween(p.date, date); if (n < 1 || n > EARLIER_WINDOW) continue;
    for (const b of p.breakouts.listed) { const row = F.bySym.get(b.sym), px = row && row.last_date === date ? num(row, 'price') : null; earlier.push({ sym: b.sym, listed_on: p.date, listed_px: b.price, now_px: px, ret_pct: px != null && b.price > 0 ? r2((px / b.price - 1) * 100) : null, sessions: n }); }
  }
  return {
    schema: EDITION_SCHEMA, date, generated_at: inp.now, feed: { price_date: date, built_on: F.builtOn ?? null, rows: F.rows.length },
    market: { priced: today.length, advancers: up, decliners: down, unchanged: today.length - up - down, above_50_pct: frac('sma50'), above_200_pct: frac('sma200'), new_50_highs: today.filter((r) => r.brk50 === true).length, new_52w_highs: today.filter((r) => r.brk52w === true).length },
    book: { as_of: L.as_of, equity: last?.equity ?? null, day_change: last && prev && last.date !== prev.date ? r2(last.equity - prev.equity) : null, return_pct: tip?.ret ?? null, benchmark_pct: tip?.bench ?? null, open: a?.n_open ?? 0, closed: a?.n_closed ?? 0 },
    screens: SCREENS.flatMap((s) => { const run = L.runs.find((r) => r.screen_id === s.id && r.run_date === date); return run ? [{ id: s.id, name: s.name, listed: run.listed ?? run.passed ?? [], passed: run.passed?.length ?? 0 }] : []; }),
    closed_today: tradeRows(L, inp.mark).filter((t) => t.status === 'closed' && t.exit === date).map((t) => ({ symbol: t.symbol, reason: t.reason, pnl: t.pnl, r: t.r })),
    breakouts: scanBreakouts({ rows: F.rows, asOf: date }), earlier,
  };
}
/** Refuses an edition that is out of order, malformed or for a day the exchange was shut. Returns problems (empty = fine to write). */
export function checkEdition(e: Edition, prior: Edition[]): string[] {
  const bad: string[] = [];
  if (e.schema !== EDITION_SCHEMA) bad.push(`schema is ${e.schema}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) bad.push('date is not YYYY-MM-DD'); else if (!isSession(e.date)) bad.push(`${e.date} is not an NSE session by our calendar`);
  if (e.feed.price_date !== e.date) bad.push('the feed day and the edition date differ');
  if (prior.some((p) => p.date === e.date)) bad.push(`an edition for ${e.date} already exists and is never rewritten`);
  if (prior.some((p) => p.date > e.date)) bad.push('an edition for a later day exists; editions are written in order');
  if (e.market.priced < 500) bad.push(`only ${e.market.priced} stocks have a price for ${e.date}`);
  return bad;
}

export interface Block { h?: string; p?: string[]; li?: string[] }
const list = (xs: string[]) => (xs.length ? xs.join(', ') : 'none');
const pct = (x: number | null, d = 1) => (x == null ? 'not available' : `${x.toFixed(d)}%`);
/** What happened to the names listed on earlier days, close to close and before any charges; a summary, then the lines. */
export function earlierSummary(items: EarlierItem[]) {
  const have = items.filter((i) => i.ret_pct != null), rets = have.map((i) => i.ret_pct!).sort((a, b) => a - b), mid = rets.length ? (rets.length % 2 ? rets[(rets.length - 1) / 2] : (rets[rets.length / 2 - 1] + rets[rets.length / 2]) / 2) : null;
  return { n: items.length, measured: have.length, up: have.filter((i) => i.ret_pct! > 0).length, down: have.filter((i) => i.ret_pct! < 0).length, median_pct: mid == null ? null : r2(mid) };
}
export function editionBlocks(e: Edition): Block[] {
  const b = e.breakouts, es = earlierSummary(e.earlier), m = e.market;
  const out: Block[] = [
    { h: `Breakout observations, ${dmy(e.date)}`, p: [b.listed.length ? `${b.listed.length} stock${b.listed.length === 1 ? '' : 's'} closed above the highest close of the previous 50 sessions and also passed seven confirming checks (volume, trend, momentum, relative strength, extension and range). They are listed alphabetically, not ranked. This is an observation, not a recommendation.` : 'No stock passed all eight checks today. An empty list is a result, not a gap.', `Checked: ${b.universe_n.toLocaleString('en-IN')} liquid stocks of at least ₹2,000 crore. ${b.near_misses.length} more missed exactly one check.`], li: b.listed.map((x) => `${x.sym} (${x.name}) · close ${px2(x.price)} · volume ${x.vol_x?.toFixed(1) ?? '—'}× · RSI ${x.rsi?.toFixed(0) ?? '—'} · ${x.tag}`) },
  ];
  if (e.earlier.length) out.push({ h: 'What happened to earlier observations', p: [`${es.n} listing${es.n === 1 ? '' : 's'} in the last ${EARLIER_WINDOW} sessions, measured from the close on the day listed to today's close, before any charges: ${es.up} up, ${es.down} down${es.median_pct == null ? '' : `, median ${signed(es.median_pct, 2, '%')}`}. Losers are included.`], li: e.earlier.map((i) => `${i.sym}: listed ${dmy(i.listed_on)} at ${px2(i.listed_px)}, now ${i.now_px == null ? 'no current price' : px2(i.now_px) + ' (' + signed(i.ret_pct, 2, '%') + ')'}, ${i.sessions} session${i.sessions === 1 ? '' : 's'}`) });
  out.push({ h: 'The market that day', p: [`${m.advancers.toLocaleString('en-IN')} stocks rose and ${m.decliners.toLocaleString('en-IN')} fell of ${m.priced.toLocaleString('en-IN')} priced. ${pct(m.above_50_pct)} are above their 50-day average and ${pct(m.above_200_pct)} above their 200-day. ${m.new_50_highs} closed at a new 50-session high and ${m.new_52w_highs} at or near a 52-week high.`] });
  const bk = e.book; out.push({ h: 'The paper book', p: [bk.equity == null ? 'The ledger has no book day yet.' : `Ledger ${dmy(bk.as_of)}: ${inr(bk.equity)} on the ₹1 crore paper account (${signed(bk.return_pct, 2, '%')} since the record began${bk.benchmark_pct == null ? '' : `, Nifty 500 ${signed(bk.benchmark_pct, 2, '%')}`}); ${bk.open} open, ${bk.closed} closed. Simulated, not real returns.`] , li: [...e.screens.map((s) => `${s.name}: ${s.passed} passed, listed ${list(s.listed)}`), ...e.closed_today.map((c) => `Closed: ${c.symbol}, ${c.reason}${c.pnl == null ? '' : ', ' + inr(c.pnl) + ' after charges'}`)] });
  out.push({ p: [DISCLAIMER, `Method: breakout confirmation, version ${BREAKOUT.version}; the thresholds were fixed before any results were seen. https://lockedfree.askakshay.com/method/`] });
  return out;
}

export interface Weekly { week_ending: string; sessions: number; first: string; last: string; days: { date: string; listed: string[] }[]; repeat: string[]; earlier: ReturnType<typeof earlierSummary>; book: { start: number | null; end: number | null; change: number | null }; closed: Edition['closed_today']; breadth: { first: { adv: number; dec: number }; last: { adv: number; dec: number } } }
/** The week's editions (Monday to Friday, already filtered) rolled into one note. */
export function buildWeekly(eds: Edition[]): Weekly | null {
  const w = eds.slice().sort((a, b) => a.date.localeCompare(b.date)); if (!w.length) return null; const f = w[0], l = w[w.length - 1];
  const counts = new Map<string, number>(); for (const e of w) for (const x of e.breakouts.listed) counts.set(x.sym, (counts.get(x.sym) ?? 0) + 1);
  const inWeek = l.earlier.filter((i) => i.listed_on >= f.date && i.listed_on <= l.date);
  const eq = (e: Edition) => e.book.equity, start = eq(f), end = eq(l);
  return { week_ending: l.date, sessions: w.length, first: f.date, last: l.date, days: w.map((e) => ({ date: e.date, listed: e.breakouts.listed.map((x) => x.sym) })), repeat: [...counts].filter(([, n]) => n >= 2).map(([s]) => s).sort(),
    earlier: earlierSummary(inWeek), book: { start, end, change: start != null && end != null ? r2(end - start) : null }, closed: w.flatMap((e) => e.closed_today), breadth: { first: { adv: f.market.advancers, dec: f.market.decliners }, last: { adv: l.market.advancers, dec: l.market.decliners } } };
}
export function weeklyBlocks(k: Weekly): Block[] {
  const n = k.days.reduce((s, d) => s + d.listed.length, 0), e = k.earlier;
  return [
    { h: `The week to ${dmy(k.week_ending)}`, p: [`${k.sessions} trading day${k.sessions === 1 ? '' : 's'}: ${n} breakout observation${n === 1 ? '' : 's'} were listed in all${k.repeat.length ? `, and ${k.repeat.length} name${k.repeat.length === 1 ? ' was' : 's were'} listed on more than one day: ${k.repeat.join(', ')}` : ''}.`], li: k.days.map((d) => `${dmy(d.date)}: ${list(d.listed)}`) },
    { h: 'How this week\'s observations did', p: [e.n === 0 ? 'Nothing listed earlier in the week has a measurable close yet.' : `${e.n} listing${e.n === 1 ? '' : 's'} from this week, measured from the close on the day listed to ${dmy(k.last)}, before any charges: ${e.up} up, ${e.down} down${e.median_pct == null ? '' : `, median ${signed(e.median_pct, 2, '%')}`}. A single week proves nothing either way.`] },
    { h: 'The paper book', p: [k.book.change == null ? 'The ledger has no comparable week yet.' : `The paper account moved ${inr(k.book.change)} over the week, to ${inr(k.book.end)}. ${k.closed.length ? `${k.closed.length} call${k.closed.length === 1 ? '' : 's'} closed: ${k.closed.map((c) => `${c.symbol} (${c.reason})`).join(', ')}.` : 'No call closed this week.'} Simulated, not real returns.`] },
    { h: 'Breadth', p: [`First day: ${k.breadth.first.adv.toLocaleString('en-IN')} stocks rose, ${k.breadth.first.dec.toLocaleString('en-IN')} fell. Last day: ${k.breadth.last.adv.toLocaleString('en-IN')} rose, ${k.breadth.last.dec.toLocaleString('en-IN')} fell.`] },
    { p: [DISCLAIMER] },
  ];
}
export function blocksToText(title: string, blocks: Block[]): string {
  return [title, '='.repeat(Math.min(60, title.length)), '', ...blocks.flatMap((b) => [...(b.h ? [b.h.toUpperCase()] : []), ...(b.p ?? []).flatMap((p) => [p, '']), ...(b.li ?? []).map((l) => `- ${l}`), ...(b.li?.length ? [''] : [])])].join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function blocksToHtml(title: string, blocks: Block[]): string {
  return `<!doctype html><html lang="en-IN"><body style="margin:0;background:#f5f3ee;color:#121528;font:16px/1.55 system-ui,sans-serif"><div style="max-width:620px;margin:0 auto;padding:24px"><h1 style="font:600 26px/1.2 Georgia,serif;margin:0 0 16px">${esc(title)}</h1>${blocks.map((b) => `${b.h ? `<h2 style="font:600 18px/1.3 Georgia,serif;margin:24px 0 8px">${esc(b.h)}</h2>` : ''}${(b.p ?? []).map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join('')}${b.li?.length ? `<ul style="margin:0 0 12px;padding-left:20px">${b.li.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`).join('')}</div></body></html>`;
}

/** Editions grouped by calendar week (Monday to Sunday); each group is one weekly note, addressed by the date of its last edition. */
export function weeksOf(eds: Edition[]): Edition[][] {
  const key = (d: string) => { const t = new Date(d + 'T00:00:00Z'); const back = (t.getUTCDay() + 6) % 7; return new Date(+t - back * 864e5).toISOString().slice(0, 10); };
  const m = new Map<string, Edition[]>(); for (const e of eds.slice().sort((a, b) => a.date.localeCompare(b.date))) m.set(key(e.date), [...(m.get(key(e.date)) ?? []), e]);
  return [...m.values()];
}
