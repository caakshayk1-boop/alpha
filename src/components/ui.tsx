'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { canAnimate, countUp, gsap, observeReveal } from '@/lib/motion';
import { dash, tone } from '@/lib/format';
import { ordinal } from '@/lib/status';

/** Fades/rises its children in when scrolled into view (see motion.ts for the safety rules). */
export function Rv({ as, className, style, children }: { as?: ElementType; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const Tag = (as ?? 'div') as ElementType;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => (ref.current ? observeReveal(ref.current) : undefined), []);
  return (
    <Tag ref={ref} data-rv="" className={className} style={style}>
      {children}
    </Tag>
  );
}

/** A number that counts up once on screen. Renders the final value in the markup, so it is right with no JS. */
export function CountUp({ value, format, className }: { value: number | null | undefined; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof value !== 'number' || !Number.isFinite(value)) return;
    if (!canAnimate()) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        io.disconnect();
        countUp(el, value, format);
      }
    });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span ref={ref} className={className}>
      {typeof value === 'number' && Number.isFinite(value) ? format(value) : dash}
    </span>
  );
}

/** Signed change with colour that is never the only signal: the sign and arrow are text too. */
export function Chg({ v, dp = 2, suffix = '%' }: { v: number | null | undefined; dp?: number; suffix?: string }) {
  const t = tone(v);
  if (typeof v !== 'number' || !Number.isFinite(v)) return <span className="num flat">{dash}</span>;
  return (
    <span className={`num ${t}`}>
      {v > 0 ? '▲ +' : v < 0 ? '▼ ' : ''}
      {v.toFixed(dp)}
      {suffix}
    </span>
  );
}

/** Sparkline that draws itself. `series` must have 2+ finite points. */
export function Spark({ series, up, height = 38 }: { series: number[] | undefined; up: boolean; height?: number }) {
  const ref = useRef<SVGPathElement>(null);
  const id = useId().replace(/:/g, '');
  const pts = (series ?? []).filter((n) => Number.isFinite(n));
  useEffect(() => {
    const p = ref.current;
    if (!p || !canAnimate()) return;
    const len = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out', immediateRender: false, clearProps: 'strokeDasharray,strokeDashoffset' });
  }, [pts.length]);
  if (pts.length < 2) return <svg className="spark" viewBox="0 0 100 38" aria-hidden />;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo || 1;
  const w = 100;
  const h = height;
  const xy = pts.map((n, i) => [(i / (pts.length - 1)) * w, h - 3 - ((n - lo) / span) * (h - 8)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const color = up ? 'var(--up)' : 'var(--down)';
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.9" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="f" d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path ref={ref} className="l" d={d} stroke={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Radial score 0-100 that sweeps to its value. */
export function Ring({ value, label, hue }: { value: number | null | undefined; label: string; hue?: 'up' | 'down' | 'acc' }) {
  const ref = useRef<SVGCircleElement>(null);
  const r = 44;
  const c = 2 * Math.PI * r;
  const v = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
  const color = hue === 'up' ? 'var(--up)' : hue === 'down' ? 'var(--down)' : 'var(--accent)';
  useEffect(() => {
    const el = ref.current;
    if (!el || v === null || !canAnimate()) return;
    gsap.fromTo(el, { strokeDashoffset: c }, { strokeDashoffset: c * (1 - v / 100), duration: 1.3, ease: 'power3.out', immediateRender: false });
  }, [v, c]);
  return (
    <div className="ring panel tight" role="img" aria-label={`${label}: ${v === null ? 'not available' : Math.round(v)} out of 100`}>
      <svg viewBox="0 0 108 108" aria-hidden>
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--panel-3)" strokeWidth="8" />
        {v !== null && <circle ref={ref} cx="54" cy="54" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 54 54)" />}
        <text x="54" y="62" textAnchor="middle">{v === null ? dash : Math.round(v)}</text>
      </svg>
      <div className="lab">{label}</div>
    </div>
  );
}

/** Percentile profile: one labelled row per score, a tick at the median (50), and the value in words. Compact and exact, unlike a ring. */
export function PercentileBars({ items }: { items: { label: string; value: number | null | undefined; note?: string }[] }) {
  return (
    <div className="panel tight" role="group" aria-label="Score percentiles within the screen" style={{ display: 'grid', gap: 10 }}>
      {items.map(({ label, value, note }) => {
        const v = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
        return (
          <div key={label} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 150px', gap: 12, alignItems: 'center' }}>
            <span className="eyebrow">{label}</span>
            <div style={{ position: 'relative', height: 8, borderRadius: 9, background: 'var(--panel-3)' }} role="img" aria-label={v === null ? `${label}: not scored` : `${label}: ${ordinal(v)} percentile`}>
              {v !== null && <div style={{ width: `${v}%`, height: '100%', borderRadius: 9, background: 'var(--accent)' }} />}
              <span aria-hidden title="Median company" style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 2, background: 'var(--text)', opacity: 0.55 }} />
            </div>
            <span className="num" style={{ fontSize: 13 }}>{v === null ? <span className="dim">not scored</span> : <>{ordinal(v)} percentile</>}{note ? <span className="dim"> · {note}</span> : null}</span>
          </div>
        );
      })}
    </div>
  );
}

/** A bar that grows from the left to `pct` (0-100). */
export function Bar({ pct, kind }: { pct: number; kind?: 'up' | 'down' }) {
  const ref = useRef<HTMLElement>(null);
  const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  useEffect(() => {
    const el = ref.current;
    if (!el || !canAnimate()) return;
    gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'power3.out', immediateRender: false, clearProps: 'transform' });
  }, [p]);
  return (
    <div className={`bar ${kind ?? ''}`} role="presentation">
      <i ref={ref} style={{ width: `${p}%` }} />
    </div>
  );
}

export function SectionHead({ title, href, cta, eyebrow }: { title: string; href?: string; cta?: string; eyebrow?: string }) {
  return (
    <Rv className="sec-h">
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      {href && (
        <Link href={href} className="more">
          {cta ?? 'See all'} <span aria-hidden>→</span>
        </Link>
      )}
    </Rv>
  );
}

/** `compact` (the default) puts the working surface inside the first screen; `editorial` keeps the large hero for reading pages. */
export function PageHead({ eyebrow, title, em, lede, variant = 'compact' }: { eyebrow: string; title: string; em?: string; lede?: string; variant?: 'compact' | 'editorial' }) {
  return (
    <header className={`page-head wrap${variant === 'compact' ? ' compact' : ''}`}>
      <div className="eyebrow"><b>●</b> {eyebrow}</div>
      <h1 className="disp">
        {title} {em && <em>{em}</em>}
      </h1>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}

export function Skel({ h = 16, w = '100%', style }: { h?: number; w?: number | string; style?: CSSProperties }) {
  return <div className="skel" style={{ height: h, width: w, ...style }} aria-hidden />;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice" role="status">{children}</div>;
}

/** Loading / error / content in one place so every page degrades the same way. */
export function Async({ loading, error, children, rows = 4 }: { loading: boolean; error: string | null; children: ReactNode; rows?: number }) {
  if (loading)
    return (
      <div className="grid" aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }, (_, i) => (
          <Skel key={i} h={72} />
        ))}
      </div>
    );
  if (error) return <Notice>This data could not be loaded right now ({error}). It is read live, so a refresh usually fixes it.</Notice>;
  return <>{children}</>;
}

/** A segmented control with a sliding thumb. Use for one-of-many choices (ranges, modes, tabs). */
export function Segmented<T extends string>({ value, options, onChange, label, role = 'tablist' }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string; role?: 'tablist' | 'group' }) {
  const i = Math.max(0, options.findIndex(([k]) => k === value));
  // Tabs follow the arrow-key pattern: one tab stop, Left/Right (and Home/End) move and select.
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (role !== 'tablist') return;
    const keys = options.map(([k]) => k);
    const at = keys.indexOf(value);
    const next = e.key === 'ArrowRight' ? (at + 1) % keys.length : e.key === 'ArrowLeft' ? (at - 1 + keys.length) % keys.length : e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(keys[next]);
    (e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
  };
  return (
    <div className="seg" role={role} aria-label={label} onKeyDown={onKey} style={{ ['--n' as string]: options.length, ['--i' as string]: i }}>
      <span className="thumb" aria-hidden />
      {options.map(([k, l]) => (role === 'tablist'
        ? <button key={k} role="tab" aria-selected={value === k} tabIndex={value === k ? 0 : -1} onClick={() => onChange(k)}>{l}</button>
        : <button key={k} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>))}
    </div>
  );
}

/** Tabs for a row that can be wider than the screen: scrolls sideways, keeps the selected tab in view, one tab stop with arrow keys. Unlike Segmented it does not assume equal widths. */
export function TabRow<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [value]);
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = options.map(([k]) => k), at = keys.indexOf(value);
    const next = e.key === 'ArrowRight' ? (at + 1) % keys.length : e.key === 'ArrowLeft' ? (at - 1 + keys.length) % keys.length : e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(keys[next]);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  return (
    <div ref={ref} role="tablist" aria-label={label} onKeyDown={onKey} className="tabrow">
      {options.map(([k, l]) => <button key={k} role="tab" className={`chip${value === k ? ' on' : ''}`} aria-selected={value === k} tabIndex={value === k ? 0 : -1} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

/** An on/off switch. Use for independent yes/no options. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" className="sw" aria-checked={checked} aria-disabled={disabled} disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="track" aria-hidden />
      <span>{label}</span>
    </button>
  );
}

/** Mounts its children only when they are about to scroll into view, so below-the-fold widgets cost nothing on first load. */
export function LazyMount({ children, minHeight = 200, margin = 500 }: { children: ReactNode; minHeight?: number; margin?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: `${margin}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  return <div ref={ref} style={{ minHeight }}>{near ? children : null}</div>;
}
