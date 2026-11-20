/** The daily brief, written from the day's feed with fixed rules and no model. Every number in it is read from the feed at build; nothing is typed in. */
import { type Feed, type Row, num, f1, spct, pct } from './feed.ts'; import { sectors, median, vals } from './stats.ts'; import { dmy } from './view.ts';
export interface Brief { asOf: string; builtOn: string; headline: string; paragraphs: string[]; counts: { label: string; value: number; of: number }[]; unusual: { up: Row[]; down: Row[] }; scoreRise: Row[]; scoreFall: Row[]; compared: string | null }
export function brief(F: Feed): Brief {
  const b = F.meta.breadth ?? {}, rows = F.rows, adv = b.advancing as number | undefined, dec = b.declining as number | undefined, tot = (adv ?? 0) + (dec ?? 0);
  const share = adv != null && tot ? adv / tot : null; const tone = share == null ? 'mixed' : share >= 0.6 ? 'broadly positive' : share <= 0.4 ? 'broadly negative' : 'split';
  const sec = sectors(rows); const lead = sec[0], lag = sec[sec.length - 1]; const liquid = rows.filter((r) => r.liquid);
  const c = (f: (r: Row) => boolean) => rows.filter(f).length;
  const spikes = liquid.filter((r) => (num(r, 'vol_spike') ?? 0) >= 2).length; const mv = liquid.filter((r) => (num(r, 'vol_spike') ?? 0) >= 1.5 && num(r, 'r1d') != null).sort((a, b) => b.r1d - a.r1d);
  const rise = rows.filter((r) => num(r.delta, 'comp') != null).sort((a, b) => b.delta.comp - a.delta.comp), fall = [...rise].reverse();
  const p1 = `The tracked market was ${tone} on ${dmy(F.asOf)}: ${adv ?? '—'} stocks closed up, ${dec ?? '—'} closed down${b.counted != null && tot ? ` and ${b.counted - tot} were unchanged` : ''}. ${b.above200 != null ? `${pct(b.above200 as number, 0)} trade above their 200-day average, ${pct(b.above50 as number, 0)} above their 50-day and ${pct(b.above20 as number, 0)} above their 20-day.` : ''} ${b.nifty_1m != null ? `The Nifty is ${spct(b.nifty_1m as number)} over a month and ${spct(b.nifty_1y as number)} over a year.` : ''}`.replace(/\s+/g, ' ').trim();
  const p2 = lead && lag ? `By one-month median return, ${lead.sector} leads at ${spct(lead.r1m)} and ${lag.sector} trails at ${spct(lag.r1m)}. ${sec.filter((s) => (s.r1m ?? 0) > 0).length} of ${sec.length} sectors are positive over the month.` : '';
  const p3 = `${c((r) => !!r.brk52w)} stocks closed at a fresh 52-week high or breakout, ${spikes} liquid names traded on at least twice their usual volume, ${c((r) => (num(r, 'rsi') ?? 0) >= 70)} have a 14-day RSI of 70 or more and ${c((r) => (num(r, 'rsi') ?? 100) <= 30)} are at 30 or less.`;
  const med1d = median(vals(rows, 'r1d')); const p4 = med1d != null ? `The median stock moved ${spct(med1d, 2)} on the day.` : '';
  return { asOf: F.asOf, builtOn: F.builtOn, headline: `${tone[0].toUpperCase()}${tone.slice(1)} session: ${adv ?? '—'} up, ${dec ?? '—'} down${lead ? `, ${lead.sector} ahead over the month` : ''}`,
    paragraphs: [p1, p2, p3, p4].filter(Boolean), counts: [{ label: 'Advancing', value: adv ?? 0, of: tot }, { label: 'Above 200-day', value: b.above200_count, of: b.above200_eligible }, { label: 'Volume spikes (liquid)', value: spikes, of: liquid.length }],
    unusual: { up: mv.slice(0, 5), down: mv.slice(-5).reverse() }, scoreRise: rise.slice(0, 5), scoreFall: fall.slice(0, 5), compared: F.meta.changes?.compared_with ?? null };
}
