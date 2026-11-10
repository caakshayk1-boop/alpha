import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../ui.tsx';
import { dayWord, inr } from '../fmt.ts';
import { heatStrength, leadersLaggards, sectorHeat, signed, HEAT_SCALE, WINDOW_LABEL, type HeatName, type HeatWindow } from '../sectorheat.ts';
import type { Row } from '../screen.ts';

const heatStyle = (change: number, win: HeatWindow): CSSProperties => ({
  ['--heat' as string]: Math.max(.12, heatStrength(change, win)),
  ['--tone' as string]: change > 0 ? 'var(--up)' : change < 0 ? 'var(--down)' : 'var(--ink-3)',
});
const direction = (change: number) => change > 0 ? 'up' : change < 0 ? 'down' : '';

/** Equal readable tiles; area does not encode a figure. The activity share is printed.
 * Colour uses the existing turnover-weighted, dated calculation. Drill-down leads with
 * non-overlapping leaders/laggards; the complete universe stays one disclosure away. */
export function SectorHeat({ rows, day }: { rows: Row[]; day: string | null }) {
  const [win, setWin] = useState<HeatWindow>('r1d');
  const [sector, setSector] = useState<string | null>(null);
  const [sort, setSort] = useState<'activity' | 'strongest' | 'weakest'>('activity');
  const heading = useRef<HTMLHeadingElement>(null); const previousSector = useRef(sector);
  useEffect(() => { if (previousSector.current !== sector) { heading.current?.focus({ preventScroll: true }); previousSector.current = sector; } }, [sector]);
  const sectors = useMemo(() => sectorHeat(rows, win), [rows, win]);
  const ordered = useMemo(() => [...sectors].sort((a, b) => sort === 'activity' ? b.weight - a.weight : (sort === 'strongest' ? b.chg - a.chg : a.chg - b.chg) || b.weight - a.weight), [sectors, sort]);
  const cur = sectors.find((s) => s.sector === sector) ?? null;
  const names = useMemo(() => [...(cur?.names ?? [])].sort((a, b) => b.weight - a.weight), [cur]);
  const ll = useMemo(() => leadersLaggards(names, 5), [names]);
  const total = sectors.reduce((a, s) => a + s.weight, 0);
  const counted = sectors.reduce((a, s) => a + s.n, 0);
  const rising = sectors.filter((s) => s.chg > 0).length;
  const strongest = [...sectors].sort((a, b) => b.chg - a.chg)[0];
  const weakest = [...sectors].sort((a, b) => a.chg - b.chg)[0];
  if (!sectors.length) return <section className="card sh" data-sectorheat><h2 className="sec">Sector heat map</h2><p className="small dim">Not enough liquid names with a price change and a traded value to draw it.</p></section>;
  return <section className="card sh" data-sectorheat aria-labelledby="sh-h">
    <div className="sh-top"><div><span className="workspace-kicker">Market map</span><h2 ref={heading} tabIndex={-1} id="sh-h">{cur ? cur.sector : 'Sector heat map'}</h2></div>
      <div className="mini-seg" role="group" aria-label="Change over">{(['r1d', 'r1w', 'r1m'] as HeatWindow[]).map((w) => <button key={w} type="button" aria-pressed={win === w} onClick={() => setWin(w)}>{w === 'r1d' ? '1D' : w === 'r1w' ? '1W' : '1M'}</button>)}</div></div>
    <p className="sh-sub small dim">Close of {dayWord(day)} · {WINDOW_LABEL[win]} change · {cur ? cur.n : counted} liquid companies</p>
    {cur ? <>
      <div className="sh-crumb"><button type="button" className="btn sm" onClick={() => setSector(null)}><Icon n="back" /> All sectors</button><span className="small dim">{cur.n} names · {((cur.weight / total) * 100).toFixed(1)}% of counted traded value</span></div>
      <div className="sh-focus" style={heatStyle(cur.chg, win)}>
        <div><span className="small dim">Weighted sector move</span><strong className={`num ${direction(cur.chg)}`}>{signed(cur.chg, 2)}</strong></div>
        <div className="sh-focus-breadth"><span className="small dim">Participation</span><b className="num">{cur.up} up <span className="mute">/</span> {cur.down} down</b><Breadth up={cur.up} down={cur.down} n={cur.n} /><span className="small mute">{cur.n - cur.up - cur.down} unchanged</span></div>
      </div>
      <div className="sh-ll"><List title="Leaders" names={ll.leaders} win={win} tone="up" /><List title="Laggards" names={ll.laggards} win={win} tone="down" /></div>
      <p className="small mute sh-rank-note">Relative ranks within this sector; a leader can still be down, and a laggard can still be up.</p>
      <details className="sh-all more" key={cur.sector}><summary>Explore all {names.length} companies</summary><p className="small dim">Ordered by traded value. Open a company for its research and chart.</p>
        <div className="sh-box sh-names">{names.map((n) => <a key={n.sym} href={`#/c/${encodeURIComponent(n.sym)}`} className="sh-cell n" style={heatStyle(n.chg, win)}><b>{n.sym}</b><span className="sh-company-name">{n.name}</span><strong className="num">{signed(n.chg, 2)}</strong><span className="sr"> Change over {WINDOW_LABEL[win]}. Opens the company page.</span></a>)}</div>
      </details>
      <a className="btn sh-discover" href={`#/discover?sector=${encodeURIComponent(cur.sector)}`}>Research {cur.sector}<Icon n="search" /></a>
    </> : <>
      <div className="sh-read" aria-label="Sector overview"><div><span className="small dim">Sectors rising</span><strong className="num">{rising}<small> / {sectors.length}</small></strong></div>
        {([{ label: 'Strongest', s: strongest }, { label: 'Weakest', s: weakest }]).map(({ label, s }) => <button key={label} type="button" onClick={() => setSector(s.sector)}><span className="small dim">{label}</span><b>{s.sector}</b><span className={`num ${direction(s.chg)}`}>{signed(s.chg, 2)}</span></button>)}
      </div>
      <div className="sh-controls"><span className="small dim">Select a sector to explore</span><label className="small">Order <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sector order"><option value="activity">Most traded</option><option value="strongest">Strongest first</option><option value="weakest">Weakest first</option></select></label></div>
      <div className="sh-box" key={win}>{ordered.map((s) => <button key={s.sector} type="button" className="sh-cell" style={heatStyle(s.chg, win)} onClick={() => setSector(s.sector)}>
        <span className="sh-cell-top"><b>{s.sector}</b><span className="sh-open" aria-hidden="true">↗</span></span><strong className="sh-change num">{signed(s.chg, 2)}</strong>
        <span className="sh-cell-bottom"><Breadth up={s.up} down={s.down} n={s.n} /><span className="sh-counts num">{s.up} up · {s.down} down</span><span className="sh-share num">{((s.weight / total) * 100).toFixed(1)}% activity · {s.n} names</span></span>
        <span className="sr"> Change over {WINDOW_LABEL[win]}; {((s.weight / total) * 100).toFixed(1)} percent of traded value. Opens its leaders and laggards.</span>
      </button>)}</div>
      <div className="sh-legend"><span>−{HEAT_SCALE[win]}%</span><i aria-hidden="true" /><span>+{HEAT_SCALE[win]}%</span><span>Colour scale</span></div>
    </>}
    <details className="more sh-method"><summary>How this map is calculated</summary><p>Source: published company screen, close of {dayWord(day)}. Sector changes are weighted by the last session’s traded value, not market capitalisation. Activity is the share of traded value across the sectors shown. Tiles have equal size for readability. Participation counts companies rising, falling or unchanged over the selected window. Stale, illiquid and missing-data names are excluded; sectors need at least three qualifying names. Colour saturates at ±{HEAT_SCALE[win]}%; the printed number remains exact to two decimals. These are dated changes, not live prices or forecasts.</p></details>
    <details className="more sh-table"><summary>{cur ? `${cur.sector} as a table` : 'Heat map as a table'}</summary>
      <table className="num"><thead><tr><th scope="col">{cur ? 'Name' : 'Sector'}</th><th scope="col">{cur ? 'Symbol' : 'Names'}</th><th scope="col">Share of traded value</th><th scope="col">Change, {WINDOW_LABEL[win]}</th></tr></thead><tbody>{cur
        ? names.map((n) => <tr key={n.sym}><th scope="row"><a href={`#/c/${encodeURIComponent(n.sym)}`}>{n.name}</a></th><td>{n.sym}</td><td>{((n.weight / cur.weight) * 100).toFixed(1)}%</td><td className={direction(n.chg)}>{signed(n.chg, 2)}</td></tr>)
        : sectors.map((s) => <tr key={s.sector}><th scope="row"><button type="button" className="linkbtn" onClick={() => setSector(s.sector)}>{s.sector}</button></th><td>{s.n}</td><td>{((s.weight / total) * 100).toFixed(1)}%</td><td className={direction(s.chg)}>{signed(s.chg, 2)}</td></tr>)}</tbody></table>
    </details>
  </section>;
}
function Breadth({ up, down, n }: { up: number; down: number; n: number }) {
  return <span className="sh-breadth" aria-hidden="true"><i style={{ width: `${up / n * 100}%` }} /><i style={{ width: `${(n - up - down) / n * 100}%` }} /><i style={{ width: `${down / n * 100}%` }} /></span>;
}
function List({ title, names, win, tone }: { title: string; names: HeatName[]; win: HeatWindow; tone: 'up' | 'down' }) {
  return <div className={`sh-list ${tone}`}><h3><span aria-hidden="true">{tone === 'up' ? '↗' : '↘'}</span> {title}<small>{WINDOW_LABEL[win]}</small></h3>
    {!names.length ? <p className="small dim">Too few names to split.</p> : <ol>{names.map((n, i) => <li key={n.sym}><a href={`#/c/${encodeURIComponent(n.sym)}`}><span className="sh-rank num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><span><span className="sym">{n.sym}</span><span className="small dim sh-company-name">{n.name}</span></span></a><span className={`num ${direction(n.chg)}`}>{signed(n.chg, 2)}</span>{n.price != null && <span className="small mute num sh-px">{inr(n.price)}</span>}<span className="sr"> over {WINDOW_LABEL[win]}</span></li>)}</ol>}
  </div>;
}
