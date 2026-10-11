'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Async, PageHead } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { crore, num, pct } from '@/lib/format';
import { canAnimate, gsap } from '@/lib/motion';
import { squarify } from '@/lib/treemap';
import type { Row } from '@/lib/types';

type Mode = 'r1d' | 'r1w' | 'r1m' | 'r3m' | 'r1y';
const MODES: [Mode, string, number][] = [['r1d', 'Today', 3], ['r1w', 'Week', 6], ['r1m', 'Month', 12], ['r3m', '3 months', 20], ['r1y', 'Year', 50]];
const TOP = 420;

const mix = (a: [number, number, number], b: [number, number, number], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
const NEUTRAL: [number, number, number] = [36, 42, 51];
const UP: [number, number, number] = [24, 160, 106];
const DOWN: [number, number, number] = [200, 50, 74];
const colorFor = (p: number | null | undefined, max: number) =>
  typeof p !== 'number' || !Number.isFinite(p) ? 'rgb(48,52,60)' : mix(NEUTRAL, p >= 0 ? UP : DOWN, Math.min(1, Math.abs(p) / max) ** 0.8);

export default function MapPage() {
  const s = useFeed('screen');
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [mode, setMode] = useState<Mode>('r1d');
  const [hover, setHover] = useState<Row | null>(null);

  // Measure now (layout effect) and on resize. ResizeObserver does not fire in a hidden tab, so the first read must not depend on it.
  useLayoutEffect(() => {
    const measure = () => box.current && setSize({ w: box.current.clientWidth, h: box.current.clientHeight });
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (box.current) ro?.observe(box.current);
    return () => { window.removeEventListener('resize', measure); ro?.disconnect(); };
  }, [s.loading]);

  const { rows, skipped } = useMemo(() => {
    const all = (s.data?.rows ?? []).filter((r) => typeof r.mcap_cr === 'number' && r.mcap_cr > 0);
    return { rows: all.sort((a, b) => (b.mcap_cr as number) - (a.mcap_cr as number)).slice(0, TOP), skipped: (s.data?.rows.length ?? 0) - all.length };
  }, [s.data]);

  const max = MODES.find((m) => m[0] === mode)![2];
  const tiles = useMemo(() => {
    if (!size.w || !size.h || !rows.length) return { sectors: [], stocks: [] };
    const bySector = new Map<string, Row[]>();
    for (const r of rows) bySector.set(r.sector || 'Other', [...(bySector.get(r.sector || 'Other') ?? []), r]);
    const sectorItems = [...bySector.entries()].map(([name, list]) => ({ value: list.reduce((t, r) => t + (r.mcap_cr as number), 0), data: { name, list } }));
    const sectors = squarify(sectorItems, { x: 0, y: 0, w: size.w, h: size.h });
    const stocks = sectors.flatMap((sec) => {
      const head = sec.w > 90 && sec.h > 60 ? 18 : 0;
      return squarify(sec.data.list.map((r) => ({ value: r.mcap_cr as number, data: r })), { x: sec.x + 1, y: sec.y + head + 1, w: sec.w - 2, h: sec.h - head - 2 });
    });
    return { sectors, stocks };
  }, [rows, size]);

  // wave-in from the top-left, only when the tab can animate
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!stage.current || !canAnimate() || !tiles.stocks.length) return;
    const els = stage.current.querySelectorAll<HTMLElement>('.tile:not(.sectorhead)');
    gsap.fromTo(els, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out', stagger: { amount: 0.9, grid: 'auto', from: 'start' }, immediateRender: false, clearProps: 'opacity,transform' });
  }, [tiles.stocks.length]);

  return (
    <>
      <PageHead eyebrow="Market map" title="Every name" em="on one screen." lede={`The ${num(rows.length)} largest companies by market value, sized by market cap and grouped by sector. Colour is the price move over the window you pick.`} />
      <section className="wrap">
        <div className="filters" role="group" aria-label="Colour by">
          {MODES.map(([k, l]) => <button key={k} className="chip" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}
          <span className="legend" style={{ marginLeft: 'auto' }}>−{max}% <i /> +{max}%</span>
        </div>
        <Async loading={s.loading} error={s.error} rows={3}>
          <div className="map" ref={box}>
            <div ref={stage} style={{ position: 'absolute', inset: 0 }}>
              {tiles.sectors.map((sec) => sec.w > 90 && sec.h > 60 ? <div key={sec.data.name} className="tile sectorhead" style={{ left: sec.x, top: sec.y, width: sec.w, height: 18, padding: '2px 6px', background: 'rgba(0,0,0,.35)', border: 0 }}><b style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.85 }}>{sec.data.name}</b></div> : null)}
              {tiles.stocks.map((t) => {
                const r = t.data;
                const big = t.w > 54 && t.h > 34;
                const v = r[mode];
                return (
                  <div key={r.sym} className="tile" role="link" tabIndex={0} aria-label={`${r.name}, ${pct(v)}`} style={{ left: t.x, top: t.y, width: t.w, height: t.h, background: colorFor(v, max), padding: big ? undefined : 0 }}
                    onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(r)} onBlur={() => setHover(null)}
                    onClick={() => router.push(`/company/?s=${encodeURIComponent(r.sym)}`)} onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/company/?s=${encodeURIComponent(r.sym)}`); }}>
                    {big && <><b style={{ fontSize: t.w > 110 ? 14 : 12 }}>{r.sym}</b>{t.h > 48 && <span>{pct(v, 1)}</span>}</>}
                  </div>
                );
              })}
            </div>
            <div style={{ position: 'absolute', left: 12, bottom: 12, pointerEvents: 'none', zIndex: 8, minWidth: 220, padding: '10px 14px', borderRadius: 12, background: 'rgba(8,10,14,.86)', backdropFilter: 'blur(10px)', border: '1px solid var(--line-2)', color: '#fff', opacity: hover ? 1 : 0, transition: 'opacity .2s' }} aria-live="polite">
              {hover && <><div style={{ fontWeight: 600 }}>{hover.name}</div><div className="num" style={{ fontSize: 12, opacity: 0.8 }}>{hover.sym} · {hover.sector} · {crore(hover.mcap_cr)}</div><div className="num" style={{ marginTop: 4 }}>{MODES.find((m) => m[0] === mode)![1]}: <b>{pct(hover[mode], 1)}</b></div></>}
            </div>
          </div>
          <p className="dim" style={{ fontSize: 12.5, marginTop: 12 }}>{skipped > 0 ? `${num(skipped)} companies have no published market cap and are left off the map; ` : ''}the smallest of the top {num(rows.length)} are too small to label. Select any tile to open the company.</p>
        </Async>
      </section>
    </>
  );
}
