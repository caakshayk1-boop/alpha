// Markets page parts (v6, 13 Nov 2026). Each card has ONE job and a one-line title; explanations live on #/info. Display only: every figure is read from the same feeds and
// published screen the page read before (indexFacts, sectorHeat, the trend summary, the macro feed, the news pool). Nothing here predicts, and a missing figure is a word, never a zero.
import { useMemo, useState, type CSSProperties } from 'react';
import { indexFacts } from '../indexfacts.ts';
import { pct, tone, dayWord } from '../fmt.ts';
import { Tick, Ago } from '../live.tsx';
import { quoteTick } from '../tickbasis.ts';
import { DayChart } from '../components/DayChart.tsx';
import { fmtMacro, MACRO, useMacro } from '../macro.ts';
import { heatStrength, sectorHeat, signed, type HeatWindow } from '../sectorheat.ts';
import { breadthWord, shortcuts } from '../breadthstats.ts';
import { cueById } from '../../news/cues.js';
import { isGlobal, type NewsEvent } from '../newsview.ts';
import { asOfTime } from '../quotes.ts';
import type { Quote } from '../data.ts';
import type { Row } from '../screen.ts';
import type { MapData } from './TrendMap.tsx';

const num = (v: number, d: number) => v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (v: number, d: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), d)}`;

/** One index as a tile: level, move, the day's shape and where the price sits in today's range. Always drawn (dashes until the quote arrives) so the row never changes height. */
export function IndexTile({ k, name, q, d, vix, err }: { k: string; name: string; q: Quote | undefined; d: number; vix?: boolean; err: boolean }) {
  const f = indexFacts(q); const col = f == null ? '' : vix ? (f.ch > 0 ? 'down' : f.ch < 0 ? 'up' : '') : tone(f.ch);
  const arrow = f == null ? '' : f.ch > 0 ? '▲' : f.ch < 0 ? '▼' : '–';
  return <div role="listitem" className="mk-tile" data-index={k}>
    <span className="mk-tile-top"><span className="mk-nm">{name}</span><span className={`mk-ch num ${col}`}>{f ? <><span aria-hidden="true">{arrow} </span>{pct(f.ch)}</> : err ? 'unavailable' : '—'}</span></span>
    <span className="mk-px num"><Tick v={f?.px} {...quoteTick(q?.pt, Date.now())}>{f ? num(f.px, d) : '—'}</Tick></span>
    <span className="mk-spark">{q && q.c.length > 2 ? <DayChart q={q} size="compact" nse good={vix ? (f?.ch ?? 0) <= 0 : (f?.ch ?? 0) >= 0} label={`${name} over the session`} /> : null}</span>
    <span className="rg mk-rg" role="img" aria-label={f ? `${name} day range ${num(f.lo, d)} to ${num(f.hi, d)}; now ${f.pos == null ? 'level' : `${Math.round(f.pos * 100)} percent of the way up`}` : `${name} range not available`}>
      <i className="trk" />{f?.prevPos != null && <i className="pv" style={{ left: `${f.prevPos * 100}%` }} title={`Previous close ${num(f.prev, d)}`} />}{f?.pos != null && <i className={`nw ${col}`} style={{ left: `${f.pos * 100}%` }} />}</span>
    <span className="mk-rg-ends num"><span>{f ? num(f.lo, d) : '—'}</span><span>{f ? `${sgn(f.pts, d)} pts` : ''}</span><span>{f ? num(f.hi, d) : '—'}</span></span></div>;
}

/** The trend split of liquid names: one stacked bar and the numbers. Breadth figures and the rule live on #/info. */
export function BreadthCard({ rows, map, day, live, liveAt, open }: { rows: Row[]; map: MapData; day: string | null; live: boolean; liveAt: number | null; open: boolean }) {
  const w = breadthWord(map.up, map.down, map.n); const sc = useMemo(() => shortcuts(rows), [rows]);
  const p = (v: number) => (map.n ? Math.round((v / map.n) * 100) : null);
  const when = live && open ? <>live · fetched <Ago at={liveAt} /></> : live ? 'last prices' : `close of ${dayWord(day)}`;
  return <section className="card mk-card trendmap" aria-labelledby="mk-tm" data-breadth>
    <div className="mk-head"><h2 id="mk-tm" className="mk-h">Trend map</h2><span className="small mute">{when}</span></div>
    <div className="rangebar mk-split" role="img" aria-label={`Of ${map.n} liquid stocks, ${map.up} are in an uptrend, ${map.mixed} sideways and ${map.down} in a downtrend`}>
      <i style={{ flexGrow: map.up || .01, background: 'var(--up)' }} /><i style={{ flexGrow: map.mixed || .01, background: 'var(--line-2)' }} /><i style={{ flexGrow: map.down || .01, background: 'var(--down)' }} /></div>
    <dl className="mk-nums num"><div><dt className="up">Uptrend</dt><dd>{p(map.up) ?? '—'}%<small>{map.up}</small></dd></div><div><dt>Sideways</dt><dd>{p(map.mixed) ?? '—'}%<small>{map.mixed}</small></dd></div><div><dt className="down">Downtrend</dt><dd>{p(map.down) ?? '—'}%<small>{map.down}</small></dd></div></dl>
    <p className="mk-line small"><b>{w.word}</b><span className="mute"> · {map.n.toLocaleString('en-IN')} liquid names · <a href="#/info?s=markets">About these numbers</a></span></p>
    {sc.length > 0 && <div className="mk-go" role="group" aria-label="Open Research with these filters">{sc.map((x) => <a key={x.id} href={x.href} className="mk-chip"><b className="num">{x.n}</b> {x.title}</a>)}</div>}
  </section>;
}

/** Sector tiles sorted by the day's change; each opens Research on that sector. Colour strength follows the change, the number is printed. */
export function SectorTiles({ rows, day }: { rows: Row[]; day: string | null }) {
  const [win, setWin] = useState<HeatWindow>('r1d');
  const list = useMemo(() => [...sectorHeat(rows, win)].sort((a, b) => b.chg - a.chg), [rows, win]);
  if (!list.length) return <section className="card mk-card" data-sectorheat><div className="mk-head"><h2 className="mk-h">Sectors</h2></div><p className="small mute">Not enough liquid names with a price change to rank sectors.</p></section>;
  return <section className="card mk-card" data-sectorheat aria-labelledby="mk-sh">
    <div className="mk-head"><h2 id="mk-sh" className="mk-h">Sectors · {day ? `close of ${dayWord(day)}` : 'last close'}</h2>
      <div className="mini-seg" role="group" aria-label="Change over">{(['r1d', 'r1w', 'r1m'] as HeatWindow[]).map((w) => <button key={w} type="button" aria-pressed={win === w} onClick={() => setWin(w)}>{w === 'r1d' ? '1D' : w === 'r1w' ? '1W' : '1M'}</button>)}</div></div>
    <ul className="mk-sectors">{list.map((s) => <li key={s.sector}><a className="sh-cell mk-sec" href={`#/discover?sector=${encodeURIComponent(s.sector)}`} style={{ ['--heat' as string]: Math.max(.1, heatStrength(s.chg, win)), ['--tone' as string]: s.chg > 0 ? 'var(--up)' : s.chg < 0 ? 'var(--down)' : 'var(--ink-3)' } as CSSProperties}>
      <span className="mk-sec-n">{s.sector}</span><b className={`num ${s.chg > 0 ? 'up' : s.chg < 0 ? 'down' : ''}`}>{signed(s.chg, 2)}</b></a></li>)}</ul>
  </section>;
}

/** Top gainers and losers among the screen's liquid names, at its last close. */
export function Movers({ rows, day }: { rows: Row[]; day: string | null }) {
  const [side, setSide] = useState<'up' | 'down'>('up');
  const m = useMemo(() => { const ok = rows.filter((r) => r.liquid && !r.stale && typeof r.r1d === 'number' && Number.isFinite(r.r1d)); const s = [...ok].sort((a, b) => (b.r1d as number) - (a.r1d as number) || a.sym.localeCompare(b.sym));
    return { n: ok.length, up: s.slice(0, 6), down: s.slice(-6).reverse() }; }, [rows]);
  const list = side === 'up' ? m.up : m.down;
  return <section className="card mk-card" data-movers aria-labelledby="mk-mv">
    <div className="mk-head"><h2 id="mk-mv" className="mk-h">Movers</h2>
      <div className="mini-seg" role="group" aria-label="Movers"><button type="button" aria-pressed={side === 'up'} onClick={() => setSide('up')}>Gainers</button><button type="button" aria-pressed={side === 'down'} onClick={() => setSide('down')}>Losers</button></div></div>
    {list.length ? <ul className="mk-list">{list.map((r) => <li key={r.sym}><a href={`#/c/${encodeURIComponent(r.sym)}`} className="mk-row"><span className="mk-row-n"><b>{r.sym}</b><small className="mute">{r.name}</small></span><span className="num mk-row-p">{typeof r.price === 'number' ? r.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</span><b className={`num ${(r.r1d as number) > 0 ? 'up' : (r.r1d as number) < 0 ? 'down' : ''}`}>{(r.r1d as number) > 0 ? '▲ ' : (r.r1d as number) < 0 ? '▼ ' : ''}{pct(r.r1d as number)}</b></a></li>)}</ul> : <p className="small mute">No liquid name has a one-day change to rank.</p>}
    <p className="small mute mk-foot">Of {m.n.toLocaleString('en-IN')} liquid names · close of {dayWord(day)}</p>
  </section>;
}

/** Headlines from outside India, newest first, each with its cue. The full list and the measured moves are on the News page. */
export function CuesList({ pool, loading }: { pool: readonly NewsEvent[]; loading: boolean }) {
  const items = useMemo(() => pool.filter((e) => isGlobal(e) && !!cueById(e.cues?.[0] ?? '')).sort((a, b) => (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0)).slice(0, 4), [pool]);
  return <section className="card mk-card" data-cues aria-labelledby="mk-cu">
    <div className="mk-head"><h2 id="mk-cu" className="mk-h">Global cues</h2><a className="small" href="#/news">All news</a></div>
    {loading && !items.length ? <div className="sk" style={{ height: 64 }} aria-label="Loading headlines" /> : items.length ? <ul className="mk-list mk-cuelist">{items.map((e) => { const cue = cueById(e.cues?.[0] ?? '');
      return <li key={e.eventClusterId}><a href={e.canonicalUrl} target="_blank" rel="noopener noreferrer" className="mk-cue"><span className="mk-cue-h">{e.headline}<span className="sr"> (opens in a new tab)</span></span><small className="mute">{cue?.label} · {e.sourceTitle}{e.publishedAt ? ` · ${asOfTime(Math.floor(Date.parse(e.publishedAt) / 1000))} IST` : ''}</small></a></li>; })}</ul>
      : <p className="small mute">No global headlines are in the news record right now.</p>}
  </section>;
}

const FX = ['GOLD', 'SILVER', 'BRENT', 'WTI', 'USDINR', 'BTC'];
/** Gold, silver, oil, the rupee and Bitcoin: compact tiles with the last session's shape. Each opens its own page, where the India link is. */
export function FxStrip() {
  const m = useMacro();
  return <section className="market-macro mk-fx" aria-labelledby="mk-fx"><h2 id="mk-fx" className="mk-h">Commodities, currencies, Bitcoin</h2>
    <div className="mk-fx-grid" role="list">{MACRO.filter((d) => FX.includes(d.key)).map((d) => { const q = m.data?.quotes[d.key]; const ch = q ? (q.px / q.prev - 1) * 100 : null;
      return <a key={d.key} role="listitem" className="tile mk-fx-tile" href={`#/m/${d.key}`}><span className="mk-nm">{d.label}<span className="sr">, chart</span></span>
        <b className="num mk-px"><Tick v={q?.px} {...quoteTick(q?.pt, Date.now(), false)}>{q ? fmtMacro(d, q.px) : '—'}</Tick></b>
        <span className={`small num ${ch == null ? 'dim' : ch >= 0 ? 'up' : 'down'}`}>{ch == null ? (m.err ? 'unavailable' : '…') : <><span aria-hidden="true">{ch >= 0 ? '▲ ' : '▼ '}</span>{pct(ch, 2)}</>}</span>
        <span className="mk-spark">{q ? <DayChart q={q} size="compact" nse={false} good={ch == null || ch >= 0} label={`${d.label} over the last session`} /> : <span className="sk" style={{ display: 'block', height: 28 }} />}</span></a>; })}</div>
  </section>;
}
