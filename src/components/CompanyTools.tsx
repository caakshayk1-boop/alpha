'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Rv } from '@/components/ui';
import { decide, lookalikes } from '@/lib/decision';
import type { EngineSignal, Row } from '@/lib/types';
import { dash, num } from '@/lib/format';

/** One-click research on the sites analysts already use. Opens in a new tab; nothing about the visitor is sent. */
export function ExternalLinks({ sym, isin }: { sym: string; isin?: string }) {
  const e = encodeURIComponent(sym);
  const links: [string, string, string][] = [
    ['Screener.in', `https://www.screener.in/company/${e}/consolidated/`, 'Ten-year financials, ratios and peers'],
    ['TradingView', `https://www.tradingview.com/chart/?symbol=NSE%3A${e}`, 'Full charting with drawing tools'],
    ['NSE India', `https://www.nseindia.com/get-quotes/equity?symbol=${e}`, 'Exchange quote, filings and announcements'],
    ['Trendlyne', `https://trendlyne.com/equity/search/?q=${e}`, 'Analyst estimates and DVM scores'],
    ['Google Finance', `https://www.google.com/finance/quote/${e}:NSE`, 'Quick news and comparison'],
    ['Yahoo Finance', `https://finance.yahoo.com/quote/${e}.NS`, 'The price source behind the chart'],
  ];
  return (
    <div className="grid g3">
      {links.map(([name, href, sub]) => (
        <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="panel tight" style={{ display: 'block' }}>
          <div className="eyebrow">{sub}</div>
          <div className="disp" style={{ fontSize: 22, margin: '6px 0 0' }}>{name} <span aria-hidden className="dim">↗</span></div>
        </a>
      ))}
      {isin && <p className="dim" style={{ fontSize: 12, gridColumn: '1 / -1', margin: 0 }}>ISIN {isin}. Links search by the NSE symbol; if a site shows a different company, check the symbol there.</p>}
    </div>
  );
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
