'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Async, Chg, PageHead } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { crore, num, pct } from '@/lib/format';
import { canAnimate, gsap } from '@/lib/motion';
import { squarify } from '@/lib/treemap';
import type { Row } from '@/lib/types';

type Metric = { id: string; label: string; get: (r: Row) => number | null | undefined; max: number; unit: string; invert?: boolean; group: string };
const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const METRICS: Metric[] = [
  { id: 'r1d', label: 'Today', get: (r) => r.r1d, max: 3, unit: '%', group: 'Price move' },
  { id: 'r1w', label: 'Week', get: (r) => r.r1w, max: 6, unit: '%', group: 'Price move' },
  { id: 'r1m', label: 'Month', get: (r) => r.r1m, max: 12, unit: '%', group: 'Price move' },
  { id: 'r3m', label: '3 months', get: (r) => r.r3m, max: 20, unit: '%', group: 'Price move' },
  { id: 'r6m', label: '6 months', get: (r) => r.r6m, max: 30, unit: '%', group: 'Price move' },
  { id: 'r1y', label: 'Year', get: (r) => r.r1y, max: 50, unit: '%', group: 'Price move' },
  { id: 'fromhigh', label: 'From 52-week high', get: (r) => r.from_high, max: 40, unit: '%', group: 'Position' },
  { id: 'rs3m', label: 'Vs index, 3 months', get: (r) => r.rs3m, max: 20, unit: '%', group: 'Position' },
  { id: 'rsi', label: 'RSI (50 = neutral)', get: (r) => (n(r.rsi) === null ? null : (r.rsi as number) - 50), max: 25, unit: '', group: 'Position' },
  { id: 'comp', label: 'Composite score (50 = neutral)', get: (r) => (n(r.comp) === null ? null : (r.comp as number) - 50), max: 30, unit: '', group: 'Quality' },
  { id: 'q', label: 'Quality score', get: (r) => (n(r.q) === null ? null : (r.q as number) - 50), max: 40, unit: '', group: 'Quality' },
  { id: 'roce', label: 'ROCE (15% = neutral)', get: (r) => (n(r.roce) === null ? null : (r.roce as number) - 15), max: 20, unit: '', group: 'Quality' },
  { id: 'pe', label: 'Cheapness: P/E under 25', get: (r) => (n(r.pe) !== null && (r.pe as number) > 0 ? 25 - (r.pe as number) : null), max: 20, unit: '', group: 'Quality' },
];
const SIZES = [
  { id: 'mcap', label: 'Market cap', get: (r: Row) => n(r.mcap_cr) },
  { id: 'turnover', label: 'Traded value', get: (r: Row) => n(r.turnover_cr) },
  { id: 'equal', label: 'Equal', get: () => 1 },
] as const;
const GROUPS = [
  { id: 'sector', label: 'Sector', get: (r: Row) => r.sector || 'Other' },
  { id: 'industry', label: 'Industry', get: (r: Row) => r.ind || 'Other' },
  { id: 'tier', label: 'Cap tier', get: (r: Row) => (r.tier ? `${r.tier[0].toUpperCase()}${r.tier.slice(1)} cap` : 'Other') },
  { id: 'none', label: 'None', get: () => 'All' },
] as const;
const COUNTS = [60, 150, 300, 600];

const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
const NEUTRAL = [38, 44, 54];
const UP = [24, 164, 108];
const DOWN = [206, 52, 76];
const colorFor = (v: number | null | undefined, max: number) =>
  v === null || v === undefined || !Number.isFinite(v) ? 'rgb(52,56,64)' : mix(NEUTRAL, v >= 0 ? UP : DOWN, Math.min(1, Math.abs(v) / max) ** 0.8);

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Label that is always legible: the font is derived from the tile, and only a tile too small for 6px text goes unlabeled. */
function labelFor(w: number, h: number, sym: string) {
  const byWidth = (w - 6) / (Math.max(sym.length, 3) * 0.62);
  const byHeight = (h - 4) * 0.55;
  const font = Math.min(15, byWidth, byHeight);
  return font >= 6 ? font : 0;
}

function Rotation({ rows }: { rows: Row[] }) {
  const pts = useMemo(() => {
    const by = new Map<string, Row[]>();
    for (const r of rows) if (r.sector) by.set(r.sector, [...(by.get(r.sector) ?? []), r]);
    const all3 = median(rows.map((r) => n(r.r3m)).filter((x): x is number => x !== null)) ?? 0;
    const all1 = median(rows.map((r) => n(r.r1m)).filter((x): x is number => x !== null)) ?? 0;
    return [...by.entries()].map(([name, list]) => ({
      name,
      x: (median(list.map((r) => n(r.r3m)).filter((x): x is number => x !== null)) ?? 0) - all3,
      y: (median(list.map((r) => n(r.r1m)).filter((x): x is number => x !== null)) ?? 0) - all1,
      size: list.reduce((t, r) => t + (n(r.mcap_cr) ?? 0), 0),
      count: list.length,
    }));
  }, [rows]);
  const ext = Math.max(4, ...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))) * 1.15;
  const maxSize = Math.max(...pts.map((p) => p.size), 1);
  const W = 720, H = 480, pad = 44;
  const X = (v: number) => pad + ((v + ext) / (2 * ext)) * (W - 2 * pad);
  const Y = (v: number) => H - pad - ((v + ext) / (2 * ext)) * (H - 2 * pad);
  const quad = (p: { x: number; y: number }) => (p.x >= 0 ? (p.y >= 0 ? 'Leading' : 'Weakening') : p.y >= 0 ? 'Improving' : 'Lagging');
  const color = (q: string) => (q === 'Leading' ? 'var(--up)' : q === 'Improving' ? 'var(--accent-2)' : q === 'Weakening' ? 'var(--warn)' : 'var(--down)');
  return (
    <div className="grid g-7-5">
      <div className="panel">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sector rotation: 3-month strength against 1-month momentum, relative to the whole market" style={{ width: '100%', height: 'auto' }}>
          <rect x={X(0)} y={pad} width={W - pad - X(0)} height={Y(0) - pad} fill="var(--up-soft)" opacity=".5" />
          <rect x={pad} y={pad} width={X(0) - pad} height={Y(0) - pad} fill="var(--accent-soft)" opacity=".7" />
          <rect x={pad} y={Y(0)} width={X(0) - pad} height={H - pad - Y(0)} fill="var(--down-soft)" opacity=".5" />
          <rect x={X(0)} y={Y(0)} width={W - pad - X(0)} height={H - pad - Y(0)} fill="color-mix(in srgb, var(--warn) 12%, transparent)" />
          <line x1={X(0)} x2={X(0)} y1={pad} y2={H - pad} stroke="var(--line-2)" />
          <line x1={pad} x2={W - pad} y1={Y(0)} y2={Y(0)} stroke="var(--line-2)" />
          {([['Improving', pad + 8, pad + 18], ['Leading', W - pad - 8, pad + 18], ['Lagging', pad + 8, H - pad - 8], ['Weakening', W - pad - 8, H - pad - 8]] as const).map(([t, x, y]) => (
            <text key={t} x={x} y={y} textAnchor={x > W / 2 ? 'end' : 'start'} fill="var(--dim)" fontSize="12" fontFamily="var(--f-mono)" letterSpacing="1.5">{t.toUpperCase()}</text>
          ))}
          <text x={W / 2} y={H - 10} textAnchor="middle" fill="var(--dim)" fontSize="11" fontFamily="var(--f-mono)">3-MONTH MOVE VS THE MARKET →</text>
          <text x={14} y={H / 2} textAnchor="middle" fill="var(--dim)" fontSize="11" fontFamily="var(--f-mono)" transform={`rotate(-90 14 ${H / 2})`}>1-MONTH MOVE VS THE MARKET →</text>
          {pts.map((p) => (
            <g key={p.name}>
              <circle cx={X(p.x)} cy={Y(p.y)} r={7 + Math.sqrt(p.size / maxSize) * 16} fill={color(quad(p))} opacity=".28" stroke={color(quad(p))} />
              <text x={X(p.x)} y={Y(p.y) + 4} textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="600">{p.name.replace('Consumer ', 'Cons. ').replace('Communication Services', 'Comms').replace('Financial Services', 'Financials').replace('Basic Materials', 'Materials')}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="panel">
        <div className="eyebrow">How to read it</div>
        <p className="muted" style={{ marginTop: 12 }}>Each bubble is a sector. Across: how far its median stock is ahead of or behind the whole market over three months. Up: the same over one month. A sector moving from <b>Lagging</b> to <b>Improving</b> is where leadership starts; <b>Leading</b> to <b>Weakening</b> is where it tires.</p>
        <div className="list" style={{ marginTop: 8 }}>
          {[...pts].sort((a, b) => b.x + b.y - (a.x + a.y)).map((p) => (
            <div className="li" key={p.name}><div><div className="t">{p.name}</div><div className="s">{p.count} stocks</div></div><span className="tag" style={{ color: color(quad(p)) }}>{quad(p)}</span></div>
          ))}
        </div>
        <p className="dim" style={{ fontSize: 12.5 }}>Medians of the screened stocks, relative to the median of all of them. Describes what happened, not what comes next.</p>
      </div>
    </div>
  );
}

export default function MapPage() {
  const s = useFeed('screen');
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tab, setTab] = useState<'map' | 'rotation'>('map');
  const [metric, setMetric] = useState('r1d');
  const [sizeBy, setSizeBy] = useState<(typeof SIZES)[number]['id']>('mcap');
  const [groupBy, setGroupBy] = useState<(typeof GROUPS)[number]['id']>('sector');
  const [count, setCount] = useState(150);
  const [vsGroup, setVsGroup] = useState(false);
  const [onlyVetted, setOnlyVetted] = useState(false);
  const [tiers, setTiers] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  const [sel, setSel] = useState<Row | null>(null);
  const [tip, setTip] = useState<{ r: Row; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => box.current && setSize({ w: box.current.clientWidth, h: box.current.clientHeight });
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (box.current) ro?.observe(box.current);
    return () => { window.removeEventListener('resize', measure); ro?.disconnect(); };
  }, [s.loading, tab]);

  const m = METRICS.find((x) => x.id === metric) ?? METRICS[0];
  const grp = GROUPS.find((g) => g.id === groupBy) ?? GROUPS[0];
  const sz = SIZES.find((x) => x.id === sizeBy) ?? SIZES[0];

  const universe = useMemo(() => {
    let list = (s.data?.rows ?? []).filter((r) => (sz.get(r) ?? 0) > 0);
    if (onlyVetted) list = list.filter((r) => r.vet?.s === 'cleared');
    if (tiers.size) list = list.filter((r) => r.tier && tiers.has(r.tier));
    return list.sort((a, b) => (sz.get(b) ?? 0) - (sz.get(a) ?? 0)).slice(0, count);
  }, [s.data, sz, onlyVetted, tiers, count]);

  // "vs group": each stock minus its group's median, which separates a stock's own story from its sector's
  const valueOf = useMemo(() => {
    if (!vsGroup) return (r: Row) => n(m.get(r));
    const by = new Map<string, number[]>();
    for (const r of universe) {
      const v = n(m.get(r));
      if (v !== null) by.set(grp.get(r), [...(by.get(grp.get(r)) ?? []), v]);
    }
    const med = new Map([...by.entries()].map(([k, v]) => [k, median(v) as number]));
    return (r: Row) => {
      const v = n(m.get(r));
      return v === null ? null : v - (med.get(grp.get(r)) ?? 0);
    };
  }, [vsGroup, universe, m, grp]);

  const shown = useMemo(() => (zoom ? universe.filter((r) => grp.get(r) === zoom) : universe), [universe, zoom, grp]);

  const layout = useMemo(() => {
    if (!size.w || !size.h || !shown.length) return { groups: [], tiles: [] };
    const by = new Map<string, Row[]>();
    for (const r of shown) by.set(grp.get(r), [...(by.get(grp.get(r)) ?? []), r]);
    const items = [...by.entries()].map(([name, list]) => ({ value: list.reduce((t, r) => t + (sz.get(r) ?? 0), 0), data: { name, list } }));
    const groups = squarify(items, { x: 0, y: 0, w: size.w, h: size.h });
    const tiles = groups.flatMap((g) => {
      const head = grp.id === 'none' ? 0 : g.w > 70 && g.h > 46 ? 17 : 0;
      return squarify(g.data.list.map((r) => ({ value: sz.get(r) ?? 0, data: r })), { x: g.x + 1, y: g.y + head + 1, w: g.w - 2, h: g.h - head - 2 });
    });
    return { groups, tiles };
  }, [shown, size, grp, sz]);

  // summary strip for what is on screen right now
  const summary = useMemo(() => {
    const vals = shown.map((r) => valueOf(r)).filter((v): v is number => v !== null);
    const up = vals.filter((v) => v > 0).length;
    const ranked = shown.map((r) => ({ r, v: valueOf(r) })).filter((x): x is { r: Row; v: number } => x.v !== null).sort((a, b) => b.v - a.v);
    return { n: vals.length, up, down: vals.length - up, med: median(vals), top: ranked.slice(0, 5), bottom: ranked.slice(-5).reverse() };
  }, [shown, valueOf]);

  useEffect(() => {
    if (!stage.current || !canAnimate() || !layout.tiles.length) return;
    const els = stage.current.querySelectorAll<HTMLElement>('.tile:not(.sectorhead)');
    gsap.fromTo(els, { opacity: 0, scale: 0.88 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out', stagger: { amount: 0.8, from: 'start' }, immediateRender: false, clearProps: 'opacity,transform' });
  }, [layout.tiles.length, zoom, groupBy]);

  const q = query.trim().toLowerCase();
  const dimmed = (r: Row) => !!q && !(r.sym.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
  const fmtV = (v: number | null) => (v === null ? '—' : m.unit === '%' ? pct(v, 1) : `${v > 0 ? '+' : ''}${v.toFixed(1)}`);
  const toggleTier = (t: string) => setTiers((p) => { const x = new Set(p); if (x.has(t)) x.delete(t); else x.add(t); return x; });
  const metricGroups = Array.from(new Set(METRICS.map((x) => x.group)));

  return (
    <>
      <PageHead eyebrow="Heat lab" title="Every name," em="read three ways." lede="Colour by almost any measure, size by value or trading, group by sector or industry, then zoom in. Switch on outlier mode to see which stocks are doing something their own sector is not." />
      <section className="wrap">
        <div className="filters" role="tablist" aria-label="View">
          <button className="chip" role="tab" aria-selected={tab === 'map'} onClick={() => setTab('map')}>Heat map</button>
          <button className="chip" role="tab" aria-selected={tab === 'rotation'} onClick={() => setTab('rotation')}>Sector rotation</button>
        </div>
        <Async loading={s.loading} error={s.error} rows={3}>
          {tab === 'rotation' ? <Rotation rows={s.data?.rows ?? []} /> : (
            <>
              <div className="panel tight" style={{ marginBottom: 12, display: 'grid', gap: 12 }}>
                {metricGroups.map((g) => (
                  <div className="filters" style={{ margin: 0 }} key={g} role="group" aria-label={`Colour by: ${g}`}>
                    <span className="eyebrow" style={{ minWidth: 92 }}>{g}</span>
                    {METRICS.filter((x) => x.group === g).map((x) => <button key={x.id} className="chip" aria-pressed={metric === x.id} onClick={() => setMetric(x.id)}>{x.label}</button>)}
                  </div>
                ))}
                <div className="filters" style={{ margin: 0 }}>
                  <span className="eyebrow" style={{ minWidth: 92 }}>Size by</span>
                  {SIZES.map((x) => <button key={x.id} className="chip" aria-pressed={sizeBy === x.id} onClick={() => setSizeBy(x.id)}>{x.label}</button>)}
                  <span className="eyebrow" style={{ margin: '0 4px 0 12px' }}>Group</span>
                  {GROUPS.map((x) => <button key={x.id} className="chip" aria-pressed={groupBy === x.id} onClick={() => { setGroupBy(x.id); setZoom(null); }}>{x.label}</button>)}
                  <span className="eyebrow" style={{ margin: '0 4px 0 12px' }}>Show</span>
                  {COUNTS.map((x) => <button key={x} className="chip" aria-pressed={count === x} onClick={() => setCount(x)}>Top {x}</button>)}
                </div>
                <div className="filters" style={{ margin: 0 }}>
                  <span className="eyebrow" style={{ minWidth: 92 }}>Filter</span>
                  {['large', 'mid', 'small'].map((t) => <button key={t} className="chip" aria-pressed={tiers.has(t)} onClick={() => toggleTier(t)}>{t[0].toUpperCase() + t.slice(1)} cap</button>)}
                  <button className="chip" aria-pressed={onlyVetted} onClick={() => setOnlyVetted((v) => !v)}>Vetted only</button>
                  <button className="chip" aria-pressed={vsGroup} onClick={() => setVsGroup((v) => !v)} title="Colour each stock by how far it is from its own group's median">Outliers: vs own {grp.id === 'none' ? 'market' : grp.label.toLowerCase()}</button>
                  <input className="field" style={{ minWidth: 180, height: 34 }} placeholder="Find a stock…" aria-label="Find a stock on the map" value={query} onChange={(e) => setQuery(e.target.value)} />
                  <span className="legend" style={{ marginLeft: 'auto' }}>−{m.max}{m.unit} <i /> +{m.max}{m.unit}</span>
                </div>
              </div>

              <div className="grid g4" style={{ marginBottom: 12 }}>
                <div className="panel tight"><div className="eyebrow">On screen</div><div className="disp" style={{ fontSize: 34 }}>{num(summary.n)}</div></div>
                <div className="panel tight"><div className="eyebrow">Up vs down</div><div className="disp" style={{ fontSize: 34 }}><span className="up">{summary.up}</span> <span className="dim">/</span> <span className="down">{summary.down}</span></div></div>
                <div className="panel tight"><div className="eyebrow">Median</div><div className="disp" style={{ fontSize: 34 }}>{fmtV(summary.med)}</div></div>
                <div className="panel tight"><div className="eyebrow">Leaders</div><div className="num" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>{summary.top.map((x) => x.r.sym).join(' · ') || '—'}</div></div>
              </div>

              {zoom && <div className="filters"><button className="chip on" onClick={() => setZoom(null)}>← All {grp.label.toLowerCase()}s</button><span className="muted">Zoomed into <b>{zoom}</b>, {shown.length} stocks. Select a tile for detail.</span></div>}

              <div className="map" ref={box} onMouseLeave={() => setTip(null)}>
                <div ref={stage} style={{ position: 'absolute', inset: 0 }}>
                  {layout.groups.map((g) => g.w > 70 && g.h > 46 && grp.id !== 'none' ? (
                    <button key={g.data.name} className="tile sectorhead" style={{ left: g.x, top: g.y, width: g.w, height: 17, padding: '1px 6px', background: 'rgba(0,0,0,.45)', border: 0, pointerEvents: 'auto', cursor: zoom ? 'default' : 'zoom-in' }} onClick={() => !zoom && setZoom(g.data.name)} aria-label={`Zoom into ${g.data.name}`}>
                      <b style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.9 }}>{g.data.name}{!zoom ? ' ⌕' : ''}</b>
                    </button>
                  ) : null)}
                  {layout.tiles.map((t) => {
                    const r = t.data;
                    const v = valueOf(r);
                    const font = labelFor(t.w, t.h, r.sym);
                    const showV = font >= 9 && t.h > font * 2.4 && t.w > 38;
                    return (
                      <div key={r.sym} className="tile" role="link" tabIndex={0} aria-label={`${r.name}, ${fmtV(v)}`}
                        style={{ left: t.x, top: t.y, width: t.w, height: t.h, background: colorFor(v, m.max), padding: font ? 2 : 0, opacity: dimmed(r) ? 0.18 : 1, outline: sel?.sym === r.sym ? '2px solid #fff' : undefined, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
                        onMouseMove={(e) => { const b = box.current?.getBoundingClientRect(); if (b) setTip({ r, x: e.clientX - b.left, y: e.clientY - b.top }); }}
                        onFocus={() => setSel(r)}
                        onClick={() => setSel(r)} onKeyDown={(e) => { if (e.key === 'Enter') setSel(r); }}>
                        {font > 0 && <b style={{ fontSize: font, lineHeight: 1.05, overflow: 'hidden', textOverflow: 'clip', maxWidth: '100%' }}>{r.sym}</b>}
                        {showV && <span style={{ fontSize: Math.max(8, font * 0.78) }}>{fmtV(v)}</span>}
                      </div>
                    );
                  })}
                </div>
                {tip && (
                  <div style={{ position: 'absolute', left: Math.min(tip.x + 14, size.w - 230), top: Math.min(tip.y + 14, size.h - 120), pointerEvents: 'none', zIndex: 9, minWidth: 210, padding: '10px 13px', borderRadius: 12, background: 'rgba(8,10,14,.92)', border: '1px solid var(--line-2)', color: '#fff' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{tip.r.name}</div>
                    <div className="num" style={{ fontSize: 11, opacity: 0.75 }}>{tip.r.sym} · {tip.r.sector} · {crore(tip.r.mcap_cr)}</div>
                    <div className="num" style={{ marginTop: 5, fontSize: 12 }}>{m.label}: <b>{fmtV(valueOf(tip.r))}</b></div>
                    <div className="num" style={{ fontSize: 11, opacity: 0.8 }}>1D {pct(tip.r.r1d)} · 1M {pct(tip.r.r1m)} · 1Y {pct(tip.r.r1y)}</div>
                  </div>
                )}
              </div>

              <div className="grid g-7-5" style={{ marginTop: 14 }}>
                <div className="panel">
                  {sel ? (
                    <>
                      <div className="eyebrow">Selected · {sel.sector}</div>
                      <div className="disp" style={{ fontSize: 32, margin: '8px 0' }}>{sel.name}</div>
                      <div className="kv">
                        <div><div className="k">Price</div><div className="v">₹{num(sel.price, 2)}</div></div>
                        <div><div className="k">Market cap</div><div className="v" style={{ fontSize: 15 }}>{crore(sel.mcap_cr)}</div></div>
                        <div><div className="k">1D · 1M · 1Y</div><div className="v" style={{ fontSize: 14 }}><Chg v={sel.r1d} dp={1} /> <Chg v={sel.r1m} dp={0} /> <Chg v={sel.r1y} dp={0} /></div></div>
                        <div><div className="k">P/E · ROCE</div><div className="v" style={{ fontSize: 15 }}>{n(sel.pe) !== null ? (sel.pe as number).toFixed(1) : '—'} · {n(sel.roce) !== null ? `${(sel.roce as number).toFixed(1)}%` : '—'}</div></div>
                        <div><div className="k">Composite</div><div className="v">{n(sel.comp) !== null ? Math.round(sel.comp as number) : '—'}</div></div>
                        <div><div className="k">From 52w high</div><div className="v">{n(sel.from_high) !== null ? `${(sel.from_high as number).toFixed(0)}%` : '—'}</div></div>
                      </div>
                      <Link className="btn" href={`/company/?s=${encodeURIComponent(sel.sym)}`} style={{ marginTop: 14 }}>Open {sel.sym} <span aria-hidden>→</span></Link>
                    </>
                  ) : <p className="muted" style={{ margin: 0 }}>Select a tile for the numbers behind it. {zoom ? '' : 'Select a sector title to zoom into it.'}</p>}
                </div>
                <div className="panel">
                  <div className="eyebrow">Leaders and laggards on this view</div>
                  <div className="grid g2" style={{ marginTop: 8 }}>
                    <div className="list">{summary.top.map((x) => <button className="li" key={x.r.sym} style={{ textAlign: 'left' }} onClick={() => setSel(x.r)}><div className="t">{x.r.sym}</div><span className="num up">{fmtV(x.v)}</span></button>)}</div>
                    <div className="list">{summary.bottom.map((x) => <button className="li" key={x.r.sym} style={{ textAlign: 'left' }} onClick={() => setSel(x.r)}><div className="t">{x.r.sym}</div><span className="num down">{fmtV(x.v)}</span></button>)}</div>
                  </div>
                </div>
              </div>
              <p className="dim" style={{ fontSize: 12.5, marginTop: 12 }}>{num((s.data?.rows.length ?? 0) - (s.data?.rows.filter((r) => n(r.mcap_cr) !== null).length ?? 0))} companies with no published market cap cannot be sized by it. Tiles too small for readable text are left unlabeled; zoom into their sector. Colour describes what happened.</p>
            </>
          )}
        </Async>
      </section>
    </>
  );
}
