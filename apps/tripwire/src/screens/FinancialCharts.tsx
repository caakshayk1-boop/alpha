import { useState } from 'react';
import type { Year } from '../data.ts';
import { ChartFrame, BASIS, financialsTakeaway, netMargin, signedPct, type FrameMode } from '../charts/index.ts';
import { dash } from '../fmt.ts';

const isN = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const lakh = (v: number) => Math.round(v).toLocaleString('en-IN');
/** Revenue, profit after tax and margin in three panels that share ONE set of fiscal years on the x axis, so a year lines up top to bottom.
 *  Each panel has its own zero line and its own scale (they are different units); a loss is drawn below zero, outlined and signed, never as a short positive bar; a year with no figure is a gap, not a zero.
 *  `margins` is false for a lender, whose margins the screen withholds. */
export function FinancialCharts({ years, margins }: { years: readonly Year[]; margins: boolean }) {
  const [mode, setMode] = useState<FrameMode>('chart');
  const ys = [...years].slice(0, 6).reverse();      // oldest first
  if (!ys.length) return <div className="card dim">No financial statements are held for this name. Every ratio that depends on them is missing, not zero.</div>;
  const n = ys.length; const colW = 100; const W = n * colW; const H = 120; const pad = 14;
  const rev = ys.map((y) => (isN(y.rev_cr) ? y.rev_cr : null)), pat = ys.map((y) => (isN(y.pat_cr) ? y.pat_cr : null));
  const nm = ys.map((y) => netMargin(y)), em = ys.map((y) => (isN(y.ebit_margin) ? y.ebit_margin : null));
  const take = financialsTakeaway(ys);
  const last = ys[n - 1];
  const bars = (vals: (number | null)[], fmtv: (v: number) => string, unit: string, name: string) => {
    const ok = vals.filter(isN); const mx = Math.max(0, ...ok), mn = Math.min(0, ...ok); const span = (mx - mn) || 1; const y0 = pad + (mx / span) * (H - 2 * pad);
    return <div className="fin-panel"><span className="k">{name} <span className="mute">{unit}</span></span>
      <svg className="fin-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${name} by fiscal year: ${ys.map((y, i) => `${y.fy} ${vals[i] === null ? 'not held' : fmtv(vals[i] as number)}`).join(', ')}`}>
        <line x1="0" x2={W} y1={y0} y2={y0} stroke="var(--line-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {vals.map((v, i) => { if (v === null) return <line key={i} x1={i * colW + 30} x2={i * colW + 70} y1={y0} y2={y0} stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />;
          const h = Math.abs(v / span) * (H - 2 * pad); const top = v >= 0 ? y0 - h : y0; const neg = v < 0;
          return <rect key={i} x={i * colW + 22} width={colW - 44} y={top} height={Math.max(1.5, h)} fill={neg ? 'var(--bg)' : 'var(--series-1)'} stroke="var(--series-1)" strokeWidth="1.5" strokeDasharray={neg ? '4 2' : undefined} vectorEffect="non-scaling-stroke" />; })}
      </svg>
      {axis}
      <div className="fin-val" style={{ gridTemplateColumns: `repeat(${n},1fr)` }}>{vals.map((v, i) => <span key={i} className="num">{v === null ? dash : fmtv(v)}</span>)}</div></div>;
  };
  const marginPanel = () => {
    const all = [...nm, ...em].filter(isN); const mx = Math.max(0, ...all), mn = Math.min(0, ...all); const span = (mx - mn) || 1; const y = (v: number) => pad + ((mx - v) / span) * (H - 2 * pad);
    const line = (vals: (number | null)[]) => vals.map((v, i) => (v === null ? '' : `${vals.slice(0, i).some((p) => p !== null) && vals[i - 1] !== null ? 'L' : 'M'}${i * colW + colW / 2} ${y(v).toFixed(1)}`)).join('');
    return <div className="fin-panel"><span className="k">Margins <span className="mute">% of revenue</span></span>
      <svg className="fin-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Margins by fiscal year: ${ys.map((_, i) => `${ys[i].fy} net ${nm[i] === null ? 'not held' : signedPct(nm[i] as number)}, EBIT ${em[i] === null ? 'not held' : signedPct(em[i] as number)}`).join('; ')}`}>
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={line(nm)} fill="none" stroke="var(--series-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={line(em)} fill="none" stroke="var(--series-2)" strokeWidth="2" strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />
      </svg>
      {axis}
      <div className="fin-val" style={{ gridTemplateColumns: `repeat(${n},1fr)` }}>{ys.map((_, i) => <span key={i} className="num">{nm[i] === null ? dash : `${(nm[i] as number).toFixed(1)}%`}<br /><span className="mute">{em[i] === null ? dash : `${(em[i] as number).toFixed(1)}%`}</span></span>)}</div>
      <p className="small mute" style={{ margin: '4px 0 0' }}>Solid line, upper figure: net margin (profit after tax over revenue). Dashed line, lower figure: EBIT margin.</p></div>;
  };
  const axis = <div className="fin-axis" style={{ gridTemplateColumns: `repeat(${n},1fr)` }} aria-hidden="true">{ys.map((y) => <span key={y.fy}>{y.fy}</span>)}</div>;
  const table = <div className="cf-table"><div className="scroll-x" tabIndex={0} role="region" aria-label="Annual figures, scrolls sideways"><table className="tbl"><caption className="sr">Revenue, profit after tax and margins by fiscal year</caption>
    <thead><tr><th scope="col" style={{ textAlign: 'left' }}>Fiscal year</th><th scope="col" style={{ textAlign: 'right' }}>Revenue (₹ cr)</th><th scope="col" style={{ textAlign: 'right' }}>Profit after tax (₹ cr)</th>{margins && <th scope="col" style={{ textAlign: 'right' }}>Net margin</th>}{margins && <th scope="col" style={{ textAlign: 'right' }}>EBIT margin</th>}</tr></thead>
    <tbody>{ys.map((y, i) => <tr key={y.fy}><th scope="row" style={{ textAlign: 'left', fontWeight: 500 }}>{y.fy}</th><td className="num" style={{ textAlign: 'right' }}>{rev[i] === null ? dash : lakh(rev[i] as number)}</td><td className="num" style={{ textAlign: 'right' }}>{pat[i] === null ? dash : (pat[i] as number) < 0 ? `−${lakh(-(pat[i] as number))}` : lakh(pat[i] as number)}</td>{margins && <td className="num" style={{ textAlign: 'right' }}>{nm[i] === null ? dash : `${(nm[i] as number).toFixed(1)}%`}</td>}{margins && <td className="num" style={{ textAlign: 'right' }}>{em[i] === null ? dash : `${(em[i] as number).toFixed(1)}%`}</td>}</tr>)}</tbody></table></div>
    <p className="small mute" style={{ margin: '8px 0 0' }}>All {n} fiscal years drawn on the chart.</p></div>;
  return <ChartFrame className="fin-frame" label="Revenue, profit and margins" mode={mode} onMode={setMode} tableLabel="The same figures as a table"
    title="Revenue, profit and margins by fiscal year" meta={`${take.span ?? ''} · ₹ crore and % of revenue · latest year held ${last.fy}${last.end ? `, ended ${last.end}` : ''}`}
    takeaway={{ headline: take.lines[0], lines: take.lines.slice(1), dataThrough: `Statements through ${last.fy}` }} table={table}
    basis={BASIS.statements + (margins ? '' : ' Margins are withheld for this company (the screen does not measure them for a lender), not shown as zero.')}>
    <div className={`fin-grid ${margins ? 'three' : ''}`}>{bars(rev, lakh, '₹ crore', 'Revenue')}{bars(pat, (v) => (v < 0 ? `−${lakh(-v)}` : lakh(v)), '₹ crore, a loss is below zero and outlined', 'Profit after tax')}{margins && marginPanel()}</div>
  </ChartFrame>;
}
