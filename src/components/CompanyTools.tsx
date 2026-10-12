'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { chartFeed, useFeed } from '@/lib/data';
import { cone, type Bars } from '@/lib/ta';
import { Rv, Segmented, Switch } from '@/components/ui';
import { decide, lookalikes } from '@/lib/decision';
import type { EngineSignal, Row } from '@/lib/types';
import { dash, num } from '@/lib/format';

/** One thin row of one-click research on the sites analysts already use. Opens in a new tab; nothing about the visitor is sent. */
export function ExternalLinks({ sym }: { sym: string }) {
  const e = encodeURIComponent(sym);
  const links: [string, string][] = [
    ['Screener.in', `https://www.screener.in/company/${e}/consolidated/`],
    ['TradingView', `https://www.tradingview.com/chart/?symbol=NSE%3A${e}`],
    ['NSE', `https://www.nseindia.com/get-quotes/equity?symbol=${e}`],
    ['Trendlyne', `https://trendlyne.com/equity/search/?q=${e}`],
    ['Google', `https://www.google.com/finance/quote/${e}:NSE`],
    ['Yahoo', `https://finance.yahoo.com/quote/${e}.NS`],
  ];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} aria-label="Open on other sites">
      <span className="eyebrow" style={{ marginRight: 4 }}>Open on</span>
      {links.map(([name, href]) => <a key={name} className="chip" href={href} target="_blank" rel="noopener noreferrer">{name} ↗</a>)}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return <div><div className="k">{k}</div><div className="v" style={{ fontSize: 15 }}>{v}</div></div>;
}

const tone = (s: number | null) => (s === null ? 'var(--dim)' : s >= 1 ? 'var(--up)' : s <= -1 ? 'var(--down)' : 'var(--accent-2)');

export function DecisionDesk({ r, sigs }: { r: Row; sigs: EngineSignal[] }) {
  const d = useMemo(() => decide(r, sigs), [r, sigs]);
  return (
    <Rv className="panel spot">
      <div className="eyebrow">Decision desk · computed from this page&apos;s numbers</div>
      <p className="disp" style={{ fontSize: 28, lineHeight: 1.2, margin: '10px 0 16px' }}>{d.headline}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
        {d.dims.map((x) => (
          <div key={x.name} className="panel tight" style={{ background: 'var(--panel-2)' }}>
            <div className="eyebrow">{x.name}</div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', margin: '10px 0 6px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: `${x.score === null ? 50 : Math.max(2, Math.min(98, 50 + x.score * 20))}%`, top: -3, width: 12, height: 12, marginLeft: -6, borderRadius: 6, background: tone(x.score) }} />
            </div>
            <div className="dim" style={{ fontSize: 12 }}>{x.note}</div>
          </div>
        ))}
      </div>
      <div className="grid g2">
        <div><div className="eyebrow" style={{ color: 'var(--up)' }}>The case for</div><ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.6 }}>{d.bull.length ? d.bull.map((p) => <li key={p.text}>{p.text}</li>) : <li className="dim">No standout positives in the numbers.</li>}</ul></div>
        <div><div className="eyebrow" style={{ color: 'var(--down)' }}>The case against</div><ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.6 }}>{d.bear.length ? d.bear.map((p) => <li key={p.text}>{p.text}</li>) : <li className="dim">No standout negatives in the numbers.</li>}</ul></div>
      </div>
      <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Checklist</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
        {d.checks.map((c) => (
          <div key={c.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5 }}>
            <span aria-label={c.pass === null ? 'not applicable' : c.pass ? 'pass' : 'fail'} style={{ width: 20, height: 20, borderRadius: 10, flex: 'none', display: 'grid', placeItems: 'center', fontSize: 12, background: c.pass === null ? 'var(--line)' : c.pass ? 'var(--up-soft)' : 'var(--down-soft)', color: c.pass === null ? 'var(--dim)' : c.pass ? 'var(--up)' : 'var(--down)' }}>{c.pass === null ? '–' : c.pass ? '✓' : '✕'}</span>
            <span>{c.label}<small className="dim" style={{ display: 'block', fontFamily: 'var(--f-mono)', fontSize: 11.5 }}>{c.detail}</small></span>
          </div>
        ))}
      </div>
      {d.triggers.length > 0 && <><div className="eyebrow" style={{ margin: '18px 0 8px' }}>What would change the picture</div><ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.6, margin: 0 }}>{d.triggers.map((t) => <li key={t}>{t}</li>)}</ul></>}
      <p className="dim" style={{ fontSize: 12, margin: '16px 0 0' }}>Fixed rules applied to the screen&apos;s figures, shown with the number behind each line. It is a summary of what the data says, not a forecast and not advice. Banks and insurers skip the leverage and cash tests.</p>
    </Rv>
  );
}

export function Lookalikes({ r, rows }: { r: Row; rows: Row[] }) {
  const sims = useMemo(() => lookalikes(r, rows), [r, rows]);
  if (!sims.length) return <p className="notice">Not enough complete data to find look-alikes for this company.</p>;
  return (
    <>
      <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
        <table className="tbl" style={{ minWidth: 640 }}>
          <thead><tr><th>Company</th><th>Match</th><th>Quality</th><th>Growth</th><th>Value</th><th>Trend</th><th>P/E</th><th>1Y</th></tr></thead>
          <tbody>
            <tr style={{ cursor: 'default', background: 'var(--accent-soft)' }}><td><b>{r.sym}</b> <span className="dim">(this)</span></td><td className="num">—</td><td className="num">{r.q ?? dash}</td><td className="num">{r.g ?? dash}</td><td className="num">{r.v ?? dash}</td><td className="num">{r.tech ?? dash}</td><td className="num">{r.pe ? `${r.pe.toFixed(1)}×` : dash}</td><td className="num">{r.r1y != null ? `${r.r1y.toFixed(0)}%` : dash}</td></tr>
            {sims.map(({ row, sim }) => (
              <tr key={row.sym}><td><Link href={`/company/?s=${encodeURIComponent(row.sym)}`}><b>{row.sym}</b> <span className="dim">{row.name}</span></Link></td><td className="num">{sim}%</td><td className="num">{row.q != null ? Math.round(row.q) : dash}</td><td className="num">{row.g != null ? Math.round(row.g) : dash}</td><td className="num">{row.v != null ? Math.round(row.v) : dash}</td><td className="num">{row.tech != null ? Math.round(row.tech) : dash}</td><td className="num">{row.pe ? `${row.pe.toFixed(1)}×` : dash}</td><td className="num">{row.r1y != null ? `${row.r1y.toFixed(0)}%` : dash}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim" style={{ fontSize: 12.5, margin: '10px 0 0' }}>Nearest neighbours across the whole screen (any sector) on quality, growth, value, trend, 3-month strength, ROCE, net margin and leverage, each standardised so no single measure dominates. Similar profile is not similar future: use it to find comparables to read next ({num(rows.length)} companies searched).</p>
    </>
  );
}

/** Where the price could be, by resampling this stock's own year of daily moves. Drift-neutral unless asked: it shows the spread, not a forecast. */
export function RiskCone({ sym, plan }: { sym: string; plan?: { sl: number; targets: number[] } }) {
  const [bars, setBars] = useState<Bars | null>(null);
  const [days, setDays] = useState(63);
  const [drift, setDrift] = useState(false);
  useEffect(() => {
    let live = true;
    chartFeed(sym, '1y').then((d) => { if (live && d.ok) setBars(d); }, () => undefined);
    return () => { live = false; };
  }, [sym]);
  const c = useMemo(() => (bars ? cone(bars.c, days, 3000, drift) : null), [bars, days, drift]);
  if (!c) return <p className="dim">Simulating needs a year of price history.</p>;
  const W = 640, H = 230, pl = 8, pr = 62, T = 14, B = 26;
  const flat = c.bands.flat(), lo = Math.min(...flat) * 0.99, hi = Math.max(...flat) * 1.01;
  const X = (t: number) => pl + (t / days) * (W - pl - pr), Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = (k: number) => c.bands.map((b, t) => `${t ? 'L' : 'M'}${X(t).toFixed(1)},${Y(b[k]).toFixed(1)}`).join('');
  const area = (k1: number, k2: number) => `${c.bands.map((b, t) => `${t ? 'L' : 'M'}${X(t).toFixed(1)},${Y(b[k1]).toFixed(1)}`).join('')}${[...c.bands].reverse().map((b, t) => `L${X(days - t).toFixed(1)},${Y(b[k2]).toFixed(1)}`).join('')}Z`;
  const end = c.bands[days];
  return (
    <div className="grid g-7-5">
      <div>
        <div className="filters" style={{ marginBottom: 8 }}>
          <Segmented role="group" label="Horizon" value={String(days)} onChange={(v) => setDays(Number(v))} options={[['21', '1 month'], ['63', '3 months'], ['126', '6 months']] as const} />
          <Switch label="Keep past drift" checked={drift} onChange={setDrift} />
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Simulated range of prices" style={{ width: '100%', height: 'auto' }}>
          <path d={area(0, 4)} fill="var(--accent)" opacity=".10" /><path d={area(1, 3)} fill="var(--accent)" opacity=".18" />
          <path d={path(2)} fill="none" stroke="var(--accent-2)" strokeWidth="2" /><line x1={pl} x2={W - pr} y1={Y(c.p0)} y2={Y(c.p0)} stroke="var(--line-2)" strokeDasharray="3 4" />
          {plan && [plan.sl, ...plan.targets].filter((v) => v > lo && v < hi).map((v, i) => <g key={i}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke={i === 0 ? 'var(--down)' : 'var(--up)'} strokeDasharray="5 4" opacity=".7" /><text x={W - pr + 5} y={Y(v) + 4} fontSize="11" fill={i === 0 ? 'var(--down)' : 'var(--up)'} fontFamily="var(--f-mono)">{i === 0 ? 'Stop' : `T${i}`}</text></g>)}
          {[[4, '95%'], [3, '75%'], [2, 'median'], [1, '25%'], [0, '5%']].map(([k, l]) => <text key={String(l)} x={W - pr + 5} y={Y(end[k as number]) + 4} fontSize="11" fill="var(--muted)" fontFamily="var(--f-mono)">{num(end[k as number], 0)}</text>)}
          <text x={pl} y={H - 8} fontSize="11" fill="var(--dim)" fontFamily="var(--f-mono)">today</text><text x={W - pr} y={H - 8} textAnchor="end" fontSize="11" fill="var(--dim)" fontFamily="var(--f-mono)">+{days} sessions</text>
        </svg>
        <p className="dim" style={{ fontSize: 12, margin: '6px 0 0' }}>3,000 paths built by resampling this stock&apos;s own daily moves over the past year{drift ? ', keeping its average drift' : ', with the average drift removed so it shows spread, not a forecast'}. The bands are the 5th–95th and 25th–75th percentiles.</p>
      </div>
      <div className="panel tight" style={{ background: 'var(--panel-2)' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Risk profile · 1 year</div>
        <div className="kv" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Kv k="Annual volatility" v={`${(c.vol * 100).toFixed(0)}%`} />
          <Kv k="Worst day" v={`${(c.worst * 100).toFixed(1)}%`} />
          <Kv k="1-day 5% VaR" v={`${(c.var95 * 100).toFixed(1)}%`} />
          <Kv k="Max drawdown" v={`${(c.mdd * 100).toFixed(0)}%`} />
          <Kv k="Below its peak now" v={`${(c.fromHigh * 100).toFixed(0)}%`} />
          <Kv k={`Touch +10% in ${days}d`} v={`${(c.up10 * 100).toFixed(0)}%`} />
          <Kv k={`Touch −10% in ${days}d`} v={`${(c.dn10 * 100).toFixed(0)}%`} />
        </div>
        <p className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>In {days} sessions, half of simulated paths end between ₹{num(end[1], 0)} and ₹{num(end[3], 0)}; nine in ten between ₹{num(end[0], 0)} and ₹{num(end[4], 0)}.</p>
      </div>
    </div>
  );
}

function LookalikesLoaded({ r }: { r: Row }) {
  const f = useFeed('screen');
  if (f.loading) return <p className="dim">Finding companies with the same profile…</p>;
  if (f.error || !f.data) return <p className="notice">Could not load the screen to compare against.</p>;
  return <Lookalikes r={r} rows={f.data.rows} />;
}

/** Look-alikes need the whole screen, which is 500 KB. Fetch it only when the section is about to be seen. */
export function LookalikesLazy({ r }: { r: Row }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return <div ref={ref} style={{ minHeight: 120 }}>{near ? <LookalikesLoaded r={r} /> : null}</div>;
}
