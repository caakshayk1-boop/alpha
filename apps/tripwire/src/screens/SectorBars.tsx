import { useMemo } from 'react';
import { rankSectors, sectorsFromRows, type SectorIn } from '../sectorrank.ts';
import type { Row } from '../screen.ts';
import { dayWord } from '../fmt.ts';

const sgn = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))}`;
/** Every sector with enough counted names, ranked by net trend (share in an uptrend minus share in a downtrend), each with the number of names it rests on and a bar that runs left of the centre line
 *  for a negative net and right for a positive one. The sign is in the number, not the colour. Sectors under the minimum are not ranked, and the page says how many and why. */
export function SectorBars({ sectors, rows, day }: { sectors: readonly SectorIn[]; rows: readonly Row[]; day: string | null }) {
  const rk = useMemo(() => rankSectors(sectors), [sectors]);
  const small = useMemo(() => rankSectors(sectorsFromRows(rows)).below, [rows]);
  const max = Math.max(20, ...rk.ranked.map((s) => Math.abs(s.net)));
  return <section className="card sbars" aria-labelledby="mk-sect" data-sectors>
    <h2 id="mk-sect" className="sec" style={{ margin: 0 }}>Sectors ranked by trend</h2>
    <p className="small dim" style={{ margin: '4px 0 10px' }}>Net = share of the sector's counted names in an uptrend minus the share in a downtrend, at the close of {dayWord(day)}. Only sectors with at least {rk.min} counted names are ranked.</p>
    {rk.ranked.length === 0 ? <p className="small dim" style={{ margin: 0 }}>No sector has {rk.min} or more counted names, so none is ranked.</p>
      : <ol className="sbars-list" aria-label="Sectors, strongest net trend first">{rk.ranked.map((s) => { const w = (Math.abs(s.net) / max) * 50;
        return <li key={s.k}><a className="sbar" href={`#/discover?sector=${encodeURIComponent(s.k)}&trend=${s.net >= 0 ? 'up' : 'down'}`}>
          <span className="sb-n"><span className="sb-name trunc">{s.k}</span><small className="mute num" data-n={s.n}>{s.n} names</small></span>
          <span className="sb-bar" aria-hidden="true"><i className="sb-mid" /><i className={`sb-fill ${s.net >= 0 ? 'pos' : 'neg'}`} style={{ left: s.net >= 0 ? '50%' : `${50 - w}%`, width: `${w}%` }} /></span>
          <span className={`sb-v num ${s.net > 0 ? 'up' : s.net < 0 ? 'down' : ''}`}>{sgn(s.net)}<small> net</small></span>
          <span className="sr">{`Rank ${s.rank}. ${Math.round(s.up)} percent in an uptrend, ${Math.round(s.down)} percent in a downtrend, of ${s.n} names. Opens Discover.`}</span></a></li>; })}</ol>}
    <p className="small mute" style={{ margin: '10px 0 0' }}>{small.length ? `${small.length} ${small.length === 1 ? 'sector has' : 'sectors have'} fewer than ${rk.min} counted names and ${small.length === 1 ? 'is' : 'are'} not ranked: ${small.map((x) => `${x.k} (${x.n})`).join(', ')}. ` : ''}A rank describes the last close. It is not a recommendation and forecasts nothing.</p>
  </section>;
}
