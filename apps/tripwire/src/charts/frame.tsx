/** The shared chart frame. Every major chart (price, comparison, financials) sits in this one: a title with its timeframe, units and data-through date; a Chart / Table switch;
 *  the factual takeaway (from takeaway.ts, never typed in a screen); the legend with direct values and shapes; the drawing; the coverage notes; and one source-and-basis line.
 *  The frame holds the chart's height while it loads, so nothing moves when it arrives. Motion is not here: lines draw under html.fx in motion.css and style.css only. */
import { useId, type ReactNode } from 'react';
import { markerPath, type SeriesStyle } from './series.ts';
import { cellText, rowDate, tableNote, type ChartTableData } from './table.ts';

/** The words every chart prints under it. Adjustment basis lives here, once: a price chart and a comparison must not describe the same series differently. */
export const BASIS = {
  stock: 'Source: Yahoo Finance daily closes. Prices are adjusted for splits and bonuses, not for dividends: dividends are neither reinvested nor added back, so these are price returns and understate the total return of a company that pays them.',
  nifty: 'The Nifty 50 line is the index price level, also without dividends, so the stock and the index are measured the same way.',
  instrument: (name: string) => `Source: Yahoo Finance daily closes in ${name}'s own units. Futures contracts roll to the next month, which can leave a small step in the line. No dividend adjustment applies.`,
  statements: 'Source: annual statements from the data provider, in ₹ crore, by fiscal year ending 31 March. Figures are as reported, not adjusted; a year without a figure is left blank, not drawn as zero.',
} as const;

export function ChartFrame({ title, meta, takeaway, legend, children, table, tableOpen, notes, basis, label, tableLabel, busy, className = '' }: {
  title: ReactNode; meta?: ReactNode; takeaway?: { headline: string; lines: string[]; dataThrough: string } | null;
  legend?: ReactNode; children: ReactNode; table?: ReactNode; tableOpen?: boolean; notes?: ReactNode; basis?: ReactNode; label: string; tableLabel?: string; busy?: boolean; className?: string;
}) {
  const id = useId().replace(/:/g, '');
  return <section className={`card chart cf ${className}`.trim()} aria-label={label} aria-busy={busy || undefined}>
    <div className="cf-head">
      <div className="cf-title"><div className="cf-h">{title}</div>{meta && <div className="cf-meta">{meta}</div>}</div>
    </div>
    {takeaway && <div className="cf-take" id={`${id}-t`} data-takeaway><p className="cf-lead">{takeaway.headline}</p></div>}
    {legend}
    {children}
    {takeaway && <div className="cf-take2" data-takeaway>{takeaway.lines.map((l) => <p key={l} className="cf-line">{l}</p>)}<p className="cf-through num">{takeaway.dataThrough}</p></div>}
    {notes}
    {basis && <p className="cf-basis small mute">{basis}</p>}
    {table && <details className="ev cf-tbl" open={tableOpen}><summary>{tableLabel ?? 'The same chart as a table'}<span className="chev">▾</span></summary><div className="body">{table}</div></details>}
  </section>;
}

/** A line sample drawn the way the series is drawn: its colour, its dash and its marker. The same shape is the key and the mark at the end of the line. */
export function Swatch({ s }: { s: SeriesStyle }) {
  return <svg className="cf-sw" width="30" height="14" viewBox="0 0 30 14" aria-hidden="true" focusable="false">
    <line x1="1" x2="29" y1="7" y2="7" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash || undefined} strokeLinecap="round" />
    <path d={markerPath(s.marker, 15, 7, 3.4)} fill={s.color} stroke="var(--surface)" strokeWidth="1" />
  </svg>;
}
export interface LegendItem { style: SeriesStyle; /** the figure printed beside the name */ value?: string; /** ▲ ▼ ■ */ arrow?: string; title?: string }
/** The legend is also the direct label: each name carries its own value and a sign-and-arrow cue, so direction never depends on colour. */
export function SeriesLegend({ items, label = 'Lines on this chart' }: { items: LegendItem[]; label?: string }) {
  return <ul className="cf-legend" aria-label={label}>{items.map((it) => <li key={it.style.label} title={it.title}><Swatch s={it.style} /><span className="cf-ln">{it.style.label}</span>{it.value && <span className="cf-lv num">{it.arrow && <span aria-hidden="true">{it.arrow} </span>}{it.value}</span>}</li>)}</ul>;
}

/** The table that stands in for a chart. Built from `buildTable`, so it lists the first, last, highest and lowest drawn points. Focusable so a keyboard can scroll it. */
export function ChartTable({ data, caption, unitWord, dateHead = 'Date' }: { data: ChartTableData; caption: string; unitWord: string; dateHead?: string }) {
  return <div className="cf-table">
    <div className="scroll-x" tabIndex={0} role="region" aria-label={`${caption}, scrolls sideways`}>
      <table className="tbl"><caption className="sr">{caption}</caption>
        <thead><tr><th scope="col" style={{ textAlign: 'left' }}>{dateHead}</th>{data.cols.map((c) => <th key={c.key} scope="col" style={{ textAlign: 'right' }}>{c.label}{c.unit ? <span className="mute"> {c.unit}</span> : null}</th>)}</tr></thead>
        <tbody>{data.shown.map((i) => <tr key={i}><th scope="row" style={{ textAlign: 'left', fontWeight: 500 }}>{rowDate(data, i)}</th>{data.cols.map((c) => <td key={c.key} className="num" style={{ textAlign: 'right' }}>{cellText(c, i)}</td>)}</tr>)}</tbody></table>
    </div>
    <p className="small mute" style={{ margin: '8px 0 0' }}>{tableNote(data, unitWord)}</p>
  </div>;
}

/** A named reason a chart is empty, partial or failed, in the frame's own size, so the page does not jump when it resolves. */
export function ChartState({ title, children, action, busy }: { title: string; children?: ReactNode; action?: ReactNode; busy?: boolean }) {
  return <section className="card chart cf cf-state" aria-busy={busy || undefined} aria-label={title}>
    <div className="cf-h">{title}</div>{busy ? <><div className="sk" style={{ height: 28, width: '70%', margin: '12px 0' }} /><div className="sk cf-sk" /><span className="sr">Loading</span></> : <>{children && <p className="dim small" style={{ margin: '8px 0 12px' }}>{children}</p>}{action}</>}
  </section>;
}
