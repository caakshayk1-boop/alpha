import type { ReactNode } from 'react';
import { LiveBadge, Observed, Spark, Tick } from '../live.tsx';
import { quoteTick } from '../tickbasis.ts';
import { pct } from '../fmt.ts';
import type { Quote } from '../data.ts';

/** One tile of the "Market now" strip (v6 home, 13 Nov 2026): label, value, change with an arrow and a colour, and a sparkline only when the feed carried a series. No series, no line. */
export interface Tile { key: string; label: string; href: string; q: Quote | null | undefined; value: string; ch: number | null; /** a rise is bad news (India VIX): colour inverted */ inverse?: boolean; pending: boolean }

export function MarketTile({ t }: { t: Tile }) {
  const { q, ch } = t; const good = ch == null ? null : t.inverse ? ch <= 0 : ch >= 0; const tone = ch == null || ch === 0 ? '' : good ? 'up' : 'down';
  const c = q?.c ?? [];
  return <a role="listitem" href={t.href} className="mt" data-tile={t.key}>
    <span className="mt-k">{t.label}</span>
    <b className="mt-v num"><Tick v={q?.px} {...quoteTick(q?.pt, Date.now())}>{t.value}</Tick></b>
    <span className={`mt-c num ${tone}`}>{ch == null ? (t.pending ? '—' : 'Unavailable') : <><span aria-hidden="true">{ch > 0 ? '▲' : ch < 0 ? '▼' : '■'}</span> {pct(ch, t.key === 'USDINR' || t.key === 'GOLD' || t.key === 'BRENT' ? 1 : 2)}</>}</span>
    <span className="mt-sp" aria-hidden="true">{q && c.length > 2 ? <Spark c={c} up={good !== false} refs={[{ v: q.prev, kind: 'prev' }]} h={22} label={`${t.label} today`} /> : null}</span>
  </a>;
}

/** The breadth meter: one thin bar split into the uptrend, sideways and downtrend shares of the liquid universe, and the two shares in words. Draws only measured shares. */
export function BreadthMeter({ upPct, downPct, n }: { upPct: number | null | undefined; downPct: number | null | undefined; n: number | null | undefined }) {
  const ok = typeof upPct === 'number' && typeof downPct === 'number' && !!n;
  const up = ok ? Math.round(upPct as number) : 0; const down = ok ? Math.round(downPct as number) : 0; const side = ok ? Math.max(0, 100 - up - down) : 0;
  const label = ok ? `Of ${n} liquid stocks, ${up}% are in an uptrend, ${side}% sideways and ${down}% in a downtrend.` : 'The trend shares are not available right now.';
  return <figure className="bm" data-breadth>
    <div className="bm-bar" role="img" aria-label={label}>{ok ? <><i className="bm-up" style={{ flexBasis: `${up}%` }} /><i className="bm-mid" style={{ flexBasis: `${side}%` }} /><i className="bm-down" style={{ flexBasis: `${down}%` }} /></> : <i className="bm-off" />}</div>
    <figcaption className="small num">{ok ? <><b className="up">{up}%</b> in an uptrend · <b className="down">{down}%</b> in a downtrend <span className="mute">of {n}</span></> : <span className="mute">Trend shares unavailable</span>}</figcaption>
  </figure>;
}

export function MarketStrip({ tiles, take, takeLoading, breadth, live, wordLabel, session, obsSec, obsErr, flow, dataLine }: {
  tiles: Tile[]; take: string | null; takeLoading: boolean; breadth: { up: number | null | undefined; down: number | null | undefined; n: number | null | undefined };
  live: boolean; wordLabel: string; session: string; obsSec: number | null; obsErr: string | null; flow: ReactNode; dataLine: ReactNode;
}) {
  return <section className="tsec brief mkt" aria-labelledby="t-brief" data-sec="brief">
    <div className="row between mkt-head"><h2 id="t-brief" className="sec">Market now</h2><span className="mkt-sess small" data-session>{session}</span><LiveBadge live={live} label={wordLabel} /></div>
    <div className="mkt-tiles num" role="list" aria-label="Indices, commodities and the rupee">{tiles.map((t) => <MarketTile key={t.key} t={t} />)}</div>
    <div className="mkt-read">
      <p className="mkt-take" data-takeaway>{take ? take : takeLoading ? <span className="sk" style={{ display: 'inline-block', height: 16, width: '70%' }} aria-label="Reading the market" /> : 'No market figures are available right now.'}</p>
      <BreadthMeter upPct={breadth.up} downPct={breadth.down} n={breadth.n} />
    </div>
    <div className="mkt-flow">{flow}</div>
    <p className="small mute mkt-basis" data-brief><span className="mkt-px">Prices: <Observed sec={obsSec} err={obsErr} /> · times in IST</span>{dataLine}</p>
  </section>;
}
