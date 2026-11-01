import type { BreadthGap } from '../universe.ts';
const N = (v: number) => v.toLocaleString('en-IN');
/** Why the trend map counts fewer names than the screen holds, in words with the real numbers (universe.ts breadthGap, which applies the Worker's own predicate). Used by the Data
 *  screen and the Methodology page so the two cannot give different reasons. */
export function BreadthGapText({ g }: { g: BreadthGap }) {
  const out = g.total - g.counted;
  return <>The screen holds <b className="num">{N(g.total)}</b> companies and the trend map counts <b className="num">{N(g.counted)}</b>. The {N(out)} left out are not an error: <b className="num">{N(g.notLiquid)}</b> are not flagged liquid, {g.noShortAverage ? <><b className="num">{N(g.noShortAverage)}</b> lack a price or a 20 or 50-day average, </> : null}<b className="num">{N(g.no200)}</b> more lack a 200-day average (recently listed), and <b className="num">{N(g.no3m)}</b> more have no 3-month return. Each name is counted once, under the first reason that applies, so the lines add up to {N(out)}. The trend rule needs all of those figures, and a name without one is left out rather than guessed. A sector is listed only with {g.minSector} or more counted names.</>;
}
export function BreadthGapTable({ g }: { g: BreadthGap }) {
  const rows = g.sectors.filter((s) => s.screen !== s.counted);
  return <details className="ev" style={{ margin: 0 }}><summary>Sector by sector: in the screen, and counted by the trend map<span className="chev">▾</span></summary>
    <div className="body small"><table className="tbl" style={{ width: '100%' }}><caption className="sr">Companies per sector in the screen and in the trend map</caption><thead><tr><th scope="col" style={{ textAlign: 'left' }}>Sector</th><th scope="col" style={{ textAlign: 'right' }}>Screen</th><th scope="col" style={{ textAlign: 'right' }}>Counted</th><th scope="col" style={{ textAlign: 'right' }}>Left out</th></tr></thead><tbody>
      {rows.map((s) => <tr key={s.k}><td>{s.k}</td><td className="num" style={{ textAlign: 'right' }}>{N(s.screen)}</td><td className="num" style={{ textAlign: 'right' }}>{N(s.counted)}</td><td className="num" style={{ textAlign: 'right' }}>{N(s.screen - s.counted)}</td></tr>)}
      <tr><th scope="row" style={{ textAlign: 'left' }}>All</th><td className="num" style={{ textAlign: 'right' }}><b>{N(g.total)}</b></td><td className="num" style={{ textAlign: 'right' }}><b>{N(g.counted)}</b></td><td className="num" style={{ textAlign: 'right' }}><b>{N(g.total - g.counted)}</b></td></tr></tbody></table></div></details>;
}
