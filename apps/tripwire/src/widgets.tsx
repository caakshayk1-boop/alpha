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
/** Sectors as coloured tiles: green where more of the sector is in an uptrend than a downtrend, coral where it is the other way round. The
 *  depth of colour is how lopsided it is, so a sector split evenly stays neutral. */
export function Heat({ cells, href }: { cells: HeatCell[]; href: (c: HeatCell) => string }) {
  return <div className="heat" role="list" aria-label="Sectors by trend">{cells.map((c) => {
    const net = c.up - c.down; const hi = Math.min(60, Math.abs(net) * 0.9);
    return <a key={c.k} role="listitem" href={href(c)} style={{ '--hc': net >= 0 ? 'var(--up)' : 'var(--down)', '--hi': hi } as CSSProperties}>
      <span className="n">{c.k}</span>
      <span><span className="v num">{Math.round(c.up)}% <small>up</small></span><span className="s num" style={{ display: 'block' }}>{Math.round(c.down)}% down<span className="sr"> of {c.n} names. Opens Discover.</span></span></span></a>;
  })}</div>;
}
