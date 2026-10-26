import type { CSSProperties, ReactNode } from 'react';
import { hueOf } from './mood.ts';

/** Each symbol keeps its own colour everywhere it appears. */
export const avatarStyle = (sym: string): CSSProperties => { const h = hueOf(sym); return { background: `hsl(${h} 55% 20%)`, color: `hsl(${h} 95% 74%)`, boxShadow: `inset 0 0 0 1px hsl(${h} 70% 40% / .45)` }; };

/** A ring that fills to value/max. The number inside is the caller's, so it can roll. */
export function Ring({ value, max, size = 74, stroke = 8, label, children, color = 'var(--lime)' }: { value: number; max: number; size?: number; stroke?: number; label: string; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return <span className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--s3)" strokeWidth={stroke} />
      <circle className="fg" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - f)} />
    </svg><span className="mid">{children}</span></span>;
}

export interface HeatCell { k: string; n: number; up: number; down: number }
/** Sectors as tiles. Each shows the split in three parts (uptrend, sideways, downtrend) as a bar, because "5% up, 44% down" hides that half the sector is
 *  simply sideways, and the net (up minus down) as the one headline figure. A tile is tinted only when the sector is clearly lopsided (15 points or more);
 *  anything closer is left neutral, so a market that is mostly sideways does not read as a sea of red. */
export function Heat({ cells, href }: { cells: HeatCell[]; href: (c: HeatCell) => string }) {
  return <div className="heat" role="list" aria-label="Sectors by trend">{cells.map((c) => {
    const net = Math.round(c.up - c.down); const side = Math.max(0, 100 - c.up - c.down); const tone = Math.abs(net) >= 15 ? (net > 0 ? 'pos' : 'neg') : '';
    return <a key={c.k} role="listitem" className={tone} href={href(c)}>
      <span className="n">{c.k}</span>
      <span className="v num">{net > 0 ? '+' : net < 0 ? '−' : ''}{Math.abs(net)}<small> net</small></span>
      <span className="tri" aria-hidden="true"><i style={{ flexGrow: c.up || .01, background: 'var(--up)' }} /><i style={{ flexGrow: side || .01, background: 'var(--s3)' }} /><i style={{ flexGrow: c.down || .01, background: 'var(--down)' }} /></span>
      <span className="s num">{Math.round(c.up)}% up · {Math.round(side)}% side · {Math.round(c.down)}% down<span className="sr"> of {c.n} names. Opens Discover.</span></span></a>;
  })}</div>;
}
