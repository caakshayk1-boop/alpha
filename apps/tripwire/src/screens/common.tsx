import type { ReactNode } from 'react';
import { Icon, useUi } from '../ui.tsx';
import { back, go, setState, useAppState, useSheets } from '../app.tsx';
import { toggleFollow } from '../store.ts';
import { trendOf, TREND_WORD, type Row } from '../screen.ts';
import { initials, inr, pct, tone } from '../fmt.ts';
import { avatarStyle } from '../widgets.tsx';
import { asOfTime, useLivePrice } from '../quotes.ts';

/** Up, down or sideways, by the Alpha site's own uptrend rule (and its mirror for down). Untagged when a figure is missing. */
export function TrendTag({ r, compact = false }: { r: Pick<Row, 'price' | 'sma50' | 'sma200'>; compact?: boolean }) {
  const { trend, detail } = trendOf(r); if (!trend) return null;
  const glyph = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'; const cls = trend === 'up' ? 'lime' : trend === 'down' ? 'peach' : '';
  if (compact) return <span className={`tag ${cls}`} title={detail} style={{ width: 20, height: 20, padding: 0, justifyContent: 'center', fontSize: '0.8125rem', flex: 'none' }}><span aria-hidden="true">{glyph}</span><span className="sr">{TREND_WORD[trend]}</span></span>;
  return <span className={`tag ${cls}`} title={detail} style={{ padding: '1px 7px', fontSize: '0.6562rem', flex: 'none', whiteSpace: 'nowrap' }}>{glyph} {TREND_WORD[trend]}</span>;
}
export function PageBar({ title, sub, onBack, right }: { title: string; sub?: ReactNode; onBack?: boolean; right?: ReactNode }) {
  const { open } = useSheets();
  return <header className="bar">
    {onBack && <button className="icon-btn" onClick={back} aria-label="Back"><Icon n="back" /></button>}
    <div className="grow"><h1 className="trunc">{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
    {right}
    <button className="icon-btn" onClick={() => open({ k: 'search' })} aria-label="Search"><Icon n="search" /></button>
  </header>;
}
export function Head({ children, aside }: { children: ReactNode; aside?: ReactNode }) { return <h2 className="h">{children}<span className="rule" />{aside}</h2>; }

export function FollowButton({ sym, name }: { sym: string; name?: string }) {
  const s = useAppState(); const { toast, tick } = useUi();
  const on = s.follows.includes(sym);
  return <button className="icon-btn" aria-pressed={on} aria-label={`${on ? 'Unfollow' : 'Follow'} ${name ?? sym}`}
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setState((x) => toggleFollow(x, sym)); tick(); toast(on ? `Stopped following ${sym}` : `Following ${sym}. Kept on this device.`); }}>
    <Icon n="star" /></button>;
}
export function CompanyRow({ r, extra, meta, compare }: { r: Row; extra?: ReactNode; meta?: ReactNode; compare?: { on: boolean; toggle: () => void; disabled: boolean } }) {
  const lp = useLivePrice(r);          // the live price when the Worker has one from today, otherwise the published close
  return <div className="li">
    <a className="row grow" href={`#/c/${encodeURIComponent(r.sym)}`} style={{ minWidth: 0 }}>
      <span className="avatar" style={avatarStyle(r.sym)} aria-hidden="true">{initials(r.sym)}</span>
      <span className="grow" style={{ minWidth: 0 }}><span className="sym trunc" style={{ display: 'block' }}>{r.sym}</span><span className="row" style={{ gap: 6, minWidth: 0 }}><TrendTag r={r} compact />{meta}<span className="dim small trunc">{r.name}</span></span></span>
      <span className="px num" style={{ flex: 'none' }} title={lp.fromQuote ? `${lp.live ? 'Live' : 'Last price'}, as of ${asOfTime(lp.t)} IST` : 'Close of the last session in the published data'}><b>{inr(lp.px)}</b><span className={tone(lp.ch)}>{pct(lp.ch)}</span></span>
    </a>
    {extra}
    {compare && <button className="icon-btn" aria-pressed={compare.on} disabled={compare.disabled && !compare.on} aria-label={`${compare.on ? 'Remove from' : 'Add to'} comparison: ${r.sym}`} onClick={compare.toggle}><Icon n="compare" /></button>}
    <FollowButton sym={r.sym} name={r.name} />
  </div>;
}
export const openCompany = (sym: string) => go(`/c/${encodeURIComponent(sym)}`);
export function Loading({ what }: { what: string }) { return <div className="card" aria-busy="true"><div className="sk" style={{ height: 26, width: '60%', marginBottom: 12 }} /><div className="sk" style={{ height: 14, width: '90%', marginBottom: 8 }} /><div className="sk" style={{ height: 14, width: '70%' }} /><span className="sr">Loading {what}</span></div>; }
export function Failed({ what, err, retry }: { what: string; err: string; retry: () => void }) {
  return <div className="note" role="alert">Could not load {what} ({err}). Nothing is shown in its place. <button className="btn sm" onClick={retry} style={{ marginLeft: 8 }}>Try again</button></div>;
}
