'use client';

import { DataStamp } from '@/components/DataStamp';
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
  { id: 'rsi', label: 'RSI (50 = midpoint)', get: (r) => (n(r.rsi) === null ? null : (r.rsi as number) - 50), max: 25, unit: '', group: 'Position' },
  { id: 'comp', label: 'Composite percentile (50 = universe median)', get: (r) => (n(r.comp) === null ? null : (r.comp as number) - 50), max: 30, unit: '', group: 'Quality' },
  { id: 'q', label: 'Quality score', get: (r) => (n(r.q) === null ? null : (r.q as number) - 50), max: 40, unit: '', group: 'Quality' },
  { id: 'roce', label: 'ROCE (colour centred on 15%)', get: (r) => (n(r.roce) === null ? null : (r.roce as number) - 15), max: 20, unit: '', group: 'Quality' },
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
const UP = [16, 130, 86];    // darker than the up colour so white tile labels keep 4.8:1 at full strength
const DOWN = [206, 52, 76];
const colorFor = (v: number | null | undefined, max: number) =>
  v === null || v === undefined || !Number.isFinite(v) ? 'rgb(52,56,64)' : mix(NEUTRAL, v >= 0 ? UP : DOWN, Math.min(1, Math.abs(v) / max) ** 0.8);

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Label that is always legible: the font is derived from the tile, and a tile too small for a 10px label goes unlabeled. */
function labelFor(w: number, h: number, sym: string) {
  const byWidth = (w - 6) / (Math.max(sym.length, 3) * 0.7);
  const byHeight = (h - 4) * 0.55;
  const font = Math.min(15, byWidth, byHeight);
  return font >= 10 ? font : 0;   // below 10px a label is noise; the list under the map carries every name
}

export default function MapPage() {
  const s = useFeed('screen');
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
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
  }, [s.loading]);

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
      const head = grp.id === 'none' ? 0 : g.w > 70 && g.h > 46 ? 24 : 0;
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
        <Async loading={s.loading} error={s.error} rows={3}>
          {(
            <>
              <div style={{ marginBottom: 10 }}><DataStamp ids={['screen']} /></div>
              <div className="panel tight" style={{ marginBottom: 12, display: 'grid', gap: 10 }}>
                <div className="filters" style={{ margin: 0, alignItems: 'center' }}>
                  <label className="eyebrow" htmlFor="heat-colour">Colour</label>
                  <select id="heat-colour" className="field" style={{ height: 36, minWidth: 0, width: 'min(100%, 260px)' }} value={metric} onChange={(e) => setMetric(e.target.value)}>
                    {metricGroups.map((g) => <optgroup key={g} label={g}>{METRICS.filter((x) => x.group === g).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>)}
                  </select>
                  <span className="eyebrow" style={{ marginLeft: 8 }}>Size</span>
                  <span role="group" aria-label="Size by" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{SIZES.map((x) => <button key={x.id} className="chip" aria-pressed={sizeBy === x.id} onClick={() => setSizeBy(x.id)}>{x.label}</button>)}</span>
                  <span className="eyebrow" style={{ marginLeft: 8 }}>Group</span>
                  <span role="group" aria-label="Group by" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{GROUPS.map((x) => <button key={x.id} className="chip" aria-pressed={groupBy === x.id} onClick={() => { setGroupBy(x.id); setZoom(null); }}>{x.label}</button>)}</span>
                  <input className="field" style={{ minWidth: 0, width: 'min(100%, 200px)', height: 36, marginLeft: 'auto' }} placeholder="Find a stock…" aria-label="Find a stock on the map" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="filters" style={{ margin: 0, justifyContent: 'space-between', alignItems: 'center' }}>
                  <details>
                    <summary className="chip" style={{ cursor: 'pointer', display: 'inline-block' }}>Filters{(tiers.size || onlyVetted || vsGroup || count !== COUNTS[1]) ? ' · active' : ''}</summary>
                    <div className="filters" style={{ margin: '10px 0 0' }}>
                      <span className="eyebrow">Show</span>
                      {COUNTS.map((x) => <button key={x} className="chip" aria-pressed={count === x} onClick={() => setCount(x)}>Top {x}</button>)}
                      <span className="eyebrow" style={{ marginLeft: 8 }}>Size class</span>
                      {['large', 'mid', 'small'].map((t) => <button key={t} className="chip" aria-pressed={tiers.has(t)} onClick={() => toggleTier(t)}>{t[0].toUpperCase() + t.slice(1)} cap</button>)}
                      <button className="chip" aria-pressed={onlyVetted} onClick={() => setOnlyVetted((v) => !v)}>Vetted only</button>
                      <button className="chip" aria-pressed={vsGroup} onClick={() => setVsGroup((v) => !v)} title="Colour each stock by how far it is from its own group's median">Outliers: vs own {grp.id === 'none' ? 'market' : grp.label.toLowerCase()}</button>
                    </div>
                  </details>
                  <span className="legend">−{m.max}{m.unit} <i /> +{m.max}{m.unit}</span>
                </div>
              </div>

              <div className="grid g4" style={{ marginBottom: 12 }}>
                <div className="panel tight"><div className="eyebrow">On screen</div><div className="disp" style={{ fontSize: 34 }}>{num(summary.n)}</div></div>
                <div className="panel tight"><div className="eyebrow">Up vs down</div><div className="disp" style={{ fontSize: 34 }}><span className="up">{summary.up}</span> <span className="dim">/</span> <span className="down">{summary.down}</span></div></div>
                <div className="panel tight"><div className="eyebrow">Median</div><div className="disp" style={{ fontSize: 34 }}>{fmtV(summary.med)}</div></div>
                <div className="panel tight"><div className="eyebrow">Leaders</div><div className="num" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>{summary.top.map((x) => x.r.sym).join(' · ') || '—'}</div></div>
              </div>

              {zoom && <div className="filters"><button className="chip on" onClick={() => setZoom(null)}>← All {grp.label.toLowerCase()}s</button><span className="muted">Zoomed into <b>{zoom}</b>, {shown.length} stocks. Select a tile for detail.</span></div>}

              <div className="map" ref={box} onMouseLeave={() => setTip(null)}>
                <div ref={stage} style={{ position: 'absolute', inset: 0 }}>
                  {layout.groups.map((g) => g.w > 70 && g.h > 46 && grp.id !== 'none' ? (
                    <button key={g.data.name} className="tile sectorhead" style={{ left: g.x, top: g.y, width: g.w, height: 24, padding: '4px 6px', background: 'rgba(10,12,16,.82)', border: 0, pointerEvents: 'auto', cursor: zoom ? 'default' : 'zoom-in' }} onClick={() => !zoom && setZoom(g.data.name)} aria-label={`Zoom into ${g.data.name}`}>
                      <b style={{ fontSize: 12 }}>{g.data.name}{!zoom ? ' ⌕' : ''}</b>
                    </button>
                  ) : null)}
                  {layout.tiles.map((t) => {
                    const r = t.data;
                    const v = valueOf(r);
                    const font = labelFor(t.w, t.h, r.sym);
                    const showV = font >= 9 && t.h > font * 2.4 && t.w > 38;
                    // A tile under 24px is too small to aim at by touch or reach usefully by keyboard; the text version below lists every
                    // stock as a link, so tiny tiles stay mouse-clickable but leave the tab order and the accessibility tree.
                    const tiny = t.w < 24 || t.h < 24;
                    const a11y = tiny ? { 'aria-hidden': true } : { role: 'link', tabIndex: 0, 'aria-label': showV ? `${r.sym} ${fmtV(v)}, ${r.name}` : font > 0 ? `${r.sym}, ${r.name}, ${fmtV(v)}` : `${r.name} (${r.sym}), ${fmtV(v)}` };
                    return (
                      <div key={r.sym} className="tile" {...a11y}
                        style={{ left: t.x, top: t.y, width: t.w, height: t.h, background: colorFor(v, m.max), padding: font ? 2 : 0, opacity: dimmed(r) ? 0.18 : 1, outline: sel?.sym === r.sym ? '2px solid #fff' : undefined, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
                        onMouseMove={(e) => { const b = box.current?.getBoundingClientRect(); if (b) setTip({ r, x: e.clientX - b.left, y: e.clientY - b.top }); }}
                        onFocus={() => setSel(r)}
                        onClick={() => setSel(r)} onKeyDown={(e) => { if (e.key === 'Enter') setSel(r); }}>
                        {font > 0 && <b style={{ fontSize: font, lineHeight: 1.05, overflow: 'hidden', textOverflow: 'clip', maxWidth: '100%' }}>{r.sym}</b>}
                        {showV && <>{' '}<span style={{ fontSize: Math.max(8, font * 0.78) }}>{fmtV(v)}</span></>}
                      </div>
                    );
                  })}
                </div>
                {tip && (
                  <div style={{ position: 'absolute', left: Math.min(tip.x + 14, size.w - 230), top: Math.min(tip.y + 14, size.h - 120), pointerEvents: 'none', zIndex: 9, minWidth: 210, padding: '10px 13px', borderRadius: 12, background: 'rgba(8,10,14,.92)', border: '1px solid var(--line-2)', color: '#fff' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{tip.r.name}</div>
                    <div className="num" style={{ fontSize: 12, opacity: 0.75 }}>{tip.r.sym} · {tip.r.sector} · {crore(tip.r.mcap_cr)}</div>
                    <div className="num" style={{ marginTop: 5, fontSize: 13 }}>{m.label}: <b>{fmtV(valueOf(tip.r))}</b></div>
                    <div className="num" style={{ fontSize: 12, opacity: 0.8 }}>1D {pct(tip.r.r1d)} · 1M {pct(tip.r.r1m)} · 1Y {pct(tip.r.r1y)}</div>
                  </div>
                )}
              </div>

              <details className="panel tight" style={{ marginTop: 14 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Text version of this map: {summary.n} stocks coloured by {m.label}</summary>
                <p className="dim" style={{ fontSize: 14, margin: '10px 0' }}>Colour is a second signal, not the only one: the same values are listed here, strongest first, for screen readers and for anyone who cannot tell red from green. {summary.up} of {summary.n} are above zero; the median is {fmtV(summary.med)}.</p>
                <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)" style={{ maxHeight: 360 }}>
                  <table className="tbl"><caption className="sr">Stocks on the map by {m.label}</caption>
                    <thead><tr><th>Stock</th><th>Sector</th><th>{m.label}</th></tr></thead>
                    <tbody>{shown.map((r) => ({ r, v: valueOf(r) })).filter((x): x is { r: Row; v: number } => x.v !== null).sort((a, b) => b.v - a.v).map(({ r, v }) => <tr key={r.sym} style={{ cursor: 'default' }}><td><Link href={`/company/?s=${encodeURIComponent(r.sym)}`} style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{r.name} ({r.sym})</Link></td><td>{r.sector}</td><td className="num">{fmtV(v)}</td></tr>)}</tbody>
                  </table>
                </div>
                <p className="dim" style={{ fontSize: 13, margin: '8px 0 0' }}>Every stock on the map with a value, strongest first. Each name opens its company page.</p>
              </details>

              <div className="grid g-7-5" style={{ marginTop: 14 }}>
                <div className="panel">
                  {sel ? (
                    <>
                      <div className="eyebrow">Selected · {sel.sector}</div>
                      <div className="disp" style={{ fontSize: 32, margin: '8px 0' }}>{sel.name}</div>
                      <div className="kv">
                        <div><div className="k">Price</div><div className="v">₹{num(sel.price, 2)}</div></div>
                        <div><div className="k">Market cap</div><div className="v" style={{ fontSize: 15 }}>{crore(sel.mcap_cr)}</div></div>
                        <div><div className="k">1D · 1M · 1Y</div><div className="v" style={{ fontSize: 15 }}><Chg v={sel.r1d} dp={1} /> <Chg v={sel.r1m} dp={0} /> <Chg v={sel.r1y} dp={0} /></div></div>
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
              <p className="dim" style={{ fontSize: 13.5, marginTop: 12 }}>{num((s.data?.rows.length ?? 0) - (s.data?.rows.filter((r) => n(r.mcap_cr) !== null).length ?? 0))} companies with no published market cap cannot be sized by it. Tiles too small for readable text are left unlabeled; zoom into their sector. Colour describes what happened.</p>
            </>
          )}
        </Async>
      </section>
    </>
  );
}
