import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../ui.tsx';
import { dayWord, inr } from '../fmt.ts';
import { squarify, withFloor } from '../treemap.ts';
import { abbrSector, cellLabel, heatNames, heatStrength, leadersLaggards, sectorHeat, shortSector, signed, HEAT_SCALE, WINDOW_LABEL, type HeatName, type HeatWindow } from '../sectorheat.ts';
import type { Row } from '../screen.ts';

/** The sector heat map. Cells are sized by traded value and coloured by the price change over the chosen window, at the last close. Tap a sector and the map zooms into its own names, with the
 *  leaders and laggards listed beside it; a table says the same in text. The map is drawn in a fixed-aspect box in percent, so it needs no measuring and moves nothing as it loads.
 *  What it is not: size is traded value, not market capitalisation (the screen does not carry that), and small groups are drawn at a minimum size so they can be read and tapped. */
const BOX_H = 80;                 // the virtual box is 100 wide and BOX_H high; CSS gives the element the same 100:80 aspect
const MIN_SECTOR_SHARE = 0.06; const MAX_NAMES = 36; const SMALL_SHOWN = 24;
const style = (r: { x: number; y: number; w: number; h: number }, chg: number, win: HeatWindow, extra: CSSProperties = {}): CSSProperties => ({
  left: `${r.x}%`, top: `${(r.y / BOX_H) * 100}%`, width: `${r.w}%`, height: `${(r.h / BOX_H) * 100}%`,
  ['--heat' as string]: String(chg === 0 ? 0 : Math.max(0.1, heatStrength(chg, win))), ['--tone' as string]: chg >= 0 ? 'var(--up)' : 'var(--down)', ...extra,
});

export function SectorHeat({ rows, day }: { rows: Row[]; day: string | null }) {
  const [win, setWin] = useState<HeatWindow>('r1d'); const [sector, setSector] = useState<string | null>(null); const [origin, setOrigin] = useState('50% 50%');
  const heading = useRef<HTMLHeadingElement>(null); const previousSector = useRef(sector);
  useEffect(() => { if (previousSector.current !== sector) { heading.current?.focus({ preventScroll: true }); previousSector.current = sector; } }, [sector]);
  const sectors = useMemo(() => sectorHeat(rows, win), [rows, win]);
  const cur = sector ? sectors.find((s) => s.sector === sector) ?? null : null;
  const names = useMemo(() => (cur ? heatNames(rows, win, cur.sector).sort((a, b) => b.weight - a.weight) : []), [rows, win, cur]);
  const shown = useMemo(() => names.slice(0, MAX_NAMES), [names]); const hidden = names.length - shown.length;
  const ll = useMemo(() => leadersLaggards(names, 5), [names]);
  const rects = useMemo(() => squarify(withFloor(sectors.map((s) => ({ id: s.sector, value: s.weight })), MIN_SECTOR_SHARE), 100, BOX_H), [sectors]);
  const total = sectors.reduce((a, s) => a + s.weight, 0);
  // Every name beyond the 36 drawn is also available in the list and table.
  const unlabelled = useMemo(() => names.slice(MAX_NAMES), [names]);
  if (!sectors.length) return <section className="card sh" data-sectorheat><h2 className="sec">Sector heat map</h2><p className="small dim" style={{ margin: 0 }}>Not enough liquid names with a price change and a traded value to draw it.</p></section>;
  const open = (s: string, r: { x: number; y: number; w: number; h: number }) => { setOrigin(`${r.x + r.w / 2}% ${((r.y + r.h / 2) / BOX_H) * 100}%`); setSector(s); };
  const byId = new Map(sectors.map((s) => [s.sector, s]));
  return <section className="card sh" data-sectorheat aria-labelledby="sh-h">
    <div className="row between sh-top"><h2 ref={heading} tabIndex={-1} id="sh-h" className="sec" style={{ margin: 0 }}>{cur ? cur.sector : 'Sector heat map'}</h2>
      <div className="mini-seg" role="group" aria-label="Change over">{(['r1d', 'r1w', 'r1m'] as HeatWindow[]).map((w) => <button key={w} type="button" aria-pressed={win === w} onClick={() => setWin(w)}>{w === 'r1d' ? '1D' : w === 'r1w' ? '1W' : '1M'}</button>)}</div></div>
    {cur
      ? <div className="row sh-crumb"><button type="button" className="btn sm" onClick={() => setSector(null)}><Icon n="back" /> All sectors</button>
          <span className="small dim num">{cur.n} names · {signed(cur.chg)} over {WINDOW_LABEL[win]} · {cur.up} up, {cur.down} down</span></div>
      : <p className="small dim sh-sub">Tap a sector to zoom into its names. Size is traded value; colour is the change over {WINDOW_LABEL[win]} at the close of {dayWord(day)}.</p>}
    {cur && <p className="small mute">Company tiles have equal size for readability, ordered by traded value. Colour shows the dated change; it is not a live quote.</p>}
    <div className={`sh-box ${cur ? 'zoomed sh-names' : ''}`} key={`${win}-${cur ? cur.sector : 'all'}`} style={{ ['--ox' as string]: origin } as CSSProperties}>
      {cur
        ? shown.map((n) => <a key={n.sym} href={`#/c/${encodeURIComponent(n.sym)}`} className="sh-cell n" style={{ ['--heat' as string]: Math.max(.1, heatStrength(n.chg, win)), ['--tone' as string]: n.chg >= 0 ? 'var(--up)' : 'var(--down)' }} aria-label={`${n.sym}, ${n.name}: ${signed(n.chg)} over ${WINDOW_LABEL[win]}. Opens the company page.`}><b>{n.sym}</b><span className="num">{signed(n.chg)}</span></a>)
        : rects.map((r) => { const s = byId.get(r.id)!; const L = cellLabel(r.w, r.h, shortSector(s.sector), abbrSector(s.sector), signed(s.chg)); return <button key={r.id} type="button" className={`sh-cell ${L.fp ? 'l' : L.text ? 'm' : 's'}`} style={style(r, s.chg, win, { ['--fn' as string]: `${L.fn}cqw`, ['--fp' as string]: `${L.fp ?? 0}cqw` })} onClick={() => open(s.sector, r)} aria-label={`${s.sector}: ${signed(s.chg)} over ${WINDOW_LABEL[win]}, ${Math.round((s.weight / total) * 100)} percent of traded value, ${s.n} names. Opens its leaders and laggards.`} title={`${s.sector} · ${signed(s.chg)}`}>
            {L.text && <b>{L.text}</b>}{L.fp && <span className="num">{signed(s.chg)}</span>}</button>; })}
    </div>
    <div className="sh-legend" aria-hidden="true"><span className="num">−{HEAT_SCALE[win]}%</span><i /><span className="num">+{HEAT_SCALE[win]}%</span></div>
    {cur && <div className="sh-ll">
      <List title="Leaders" names={ll.leaders} win={win} tone="up" /><List title="Laggards" names={ll.laggards} win={win} tone="down" />
    </div>}
    {cur && unlabelled.length > 0 && (() => { const chip = (n: HeatName) => <li key={n.sym}><a href={`#/c/${encodeURIComponent(n.sym)}`}><span className="sym">{n.sym}</span> <span className={`num ${n.chg < 0 ? 'down' : n.chg > 0 ? 'up' : ''}`}>{signed(n.chg)}</span><span className="sr"> {n.name}, over {WINDOW_LABEL[win]}</span></a></li>;
      const head = unlabelled.slice(0, SMALL_SHOWN), rest = unlabelled.slice(SMALL_SHOWN);   // the largest by traded value first; a sector of 200 names does not become a wall of chips
      return <div className="sh-small" data-unlabelled><h3 className="k">More companies · {unlabelled.length} of {cur.n}</h3>
        <ul>{head.map(chip)}</ul>
        {rest.length > 0 && <details className="more sh-rest"><summary>Show the other {rest.length}</summary><ul>{rest.map(chip)}</ul></details>}</div>; })()}
    {cur && hidden > 0 && <p className="small mute" style={{ margin: '8px 0 0' }}>The {shown.length} names with the most traded value are drawn; the other {hidden} are in the list above and the table.</p>}
    {cur && <p className="small" style={{ margin: '10px 0 0' }}><a href={`#/discover?sector=${encodeURIComponent(cur.sector)}`}>Open all {cur.n} {cur.sector} names in Discover</a></p>}
    {!cur && <p className="small mute" style={{ margin: '8px 0 0' }}>Size is traded value on the last session, not market capitalisation; the smallest sectors are drawn at a minimum size so they can be read and tapped.</p>}
    <details className="more sh-table"><summary>{cur ? `${cur.sector} as a table` : 'Heat map as a table'}</summary>
      <table className="num"><thead><tr><th scope="col">{cur ? 'Name' : 'Sector'}</th><th scope="col">{cur ? 'Symbol' : 'Names'}</th><th scope="col">Share of traded value</th><th scope="col">Change, {WINDOW_LABEL[win]}</th></tr></thead>
        <tbody>{cur
          ? names.map((n) => <tr key={n.sym}><th scope="row"><a href={`#/c/${encodeURIComponent(n.sym)}`}>{n.name}</a></th><td>{n.sym}</td><td>{((n.weight / cur.weight) * 100).toFixed(1)}%</td><td className={n.chg >= 0 ? 'up' : 'down'}>{signed(n.chg)}</td></tr>)
          : sectors.map((s) => <tr key={s.sector}><th scope="row"><button type="button" className="linkbtn" onClick={() => setSector(s.sector)}>{s.sector}</button></th><td>{s.n}</td><td>{((s.weight / total) * 100).toFixed(1)}%</td><td className={s.chg >= 0 ? 'up' : 'down'}>{signed(s.chg)}</td></tr>)}</tbody></table>
    </details>
  </section>;
}

function List({ title, names, win, tone }: { title: string; names: HeatName[]; win: HeatWindow; tone: 'up' | 'down' }) {
  return <div className={`sh-list ${tone}`}><h3 className="k">{title}</h3>
    {names.length === 0 ? <p className="small dim" style={{ margin: 0 }}>Too few names to split.</p>
      : <ol>{names.map((n) => <li key={n.sym}><a href={`#/c/${encodeURIComponent(n.sym)}`}><span className="sym">{n.sym}</span><span className="small dim trunc">{n.name}</span></a><span className={`num ${n.chg < 0 ? 'down' : n.chg > 0 ? 'up' : ''}`}>{signed(n.chg)}</span>{n.price != null && <span className="small mute num sh-px">{inr(n.price)}</span>}<span className="sr"> over {WINDOW_LABEL[win]}</span></li>)}</ol>}
  </div>;
}
