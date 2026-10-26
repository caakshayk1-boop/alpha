import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const P: Record<string, string> = {
  today: 'M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  discover: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3',
  signals: 'M3 12h4l3-8 4 16 3-8h4',
  desk: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3',
  plus: 'M12 5v14M5 12h14', check: 'm5 12.5 4.5 4.5L19 7.5', x: 'M6 6l12 12M18 6 6 18', back: 'm15 5-7 7 7 7',
  star: 'm12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z',
  compare: 'M8 4v16M16 4v16M4 8h8M12 16h8', plan: 'M5 19 19 5M7 5h12v12', note: 'M6 4h9l3 3v13H6zM9 12h6M9 16h4',
  chart: 'M4 19h16M6 15l4-5 3 3 5-7', ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  chev: 'm6 9 6 6 6-6', share: 'M12 15V4m0 0L8 8m4-4 4 4M5 13v6h14v-6', bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  print: 'M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z', trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', filter: 'M4 6h16M7 12h10M10 18h4',
  up: 'm6 15 6-6 6 6', clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', flag: 'M6 21V4h11l-2 4 2 4H6',
};
export function Icon({ n, className = '' }: { n: string; className?: string }) {
  return <svg className={`ic ${className}`} viewBox="0 0 24 24" aria-hidden="true"><path d={P[n] ?? ''} /></svg>;
}

/** Toasts and haptics. A haptic is a 10 ms tick, only where the browser supports it and only when the preference is on. */
interface UiCtx { toast: (m: string) => void; tick: () => void }
export const Ui = createContext<UiCtx>({ toast: () => {}, tick: () => {} });
export const useUi = () => useContext(Ui);
export function UiProvider({ children, haptics }: { children: ReactNode; haptics: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number | undefined>(undefined);
  const toast = useCallback((m: string) => { setMsg(m); window.clearTimeout(t.current); t.current = window.setTimeout(() => setMsg(null), 2600); }, []);
  const tick = useCallback(() => { if (haptics && 'vibrate' in navigator) try { navigator.vibrate(10); } catch { /* unsupported */ } }, [haptics]);
  return <Ui.Provider value={{ toast, tick }}>{children}<div role="status" aria-live="polite">{msg && <div className="toast">{msg}</div>}</div></Ui.Provider>;
}

/** Bottom sheet: focus moves in, Escape and the scrim close it, focus returns, and the page behind does not scroll. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]')];
        if (!f.length) return; const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = o; prev?.focus?.(); };
  }, [onClose]);
  return <>
    <div className="scrim" onClick={onClose} />
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
      <div className="grab" aria-hidden="true" />
      <div className="row between"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon n="x" /></button></div>
      {children}
    </div>
  </>;
}

/** Segmented control with a sliding thumb. */
export function Seg<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[]; label: string }) {
  const i = Math.max(0, items.findIndex((x) => x.id === value));
  return <div className="seg" role="tablist" aria-label={label}>
    <span className="thumb" style={{ width: `calc((100% - 8px) / ${items.length})`, transform: `translateX(${i * 100}%)` }} aria-hidden="true" />
    {items.map((x) => <button key={x.id} role="tab" aria-selected={x.id === value} onClick={() => onChange(x.id)}>{x.label}</button>)}
  </div>;
}

/** A dotted arc: `lit` of `total` dots are filled. Discrete by design, so no value is ever shown between two measured states. */
export function DotArc({ lit, total = 28, label }: { lit: number; total?: number; label: string }) {
  const R = 118, cx = 150, cy = 150;
  const dots = Array.from({ length: total }, (_, i) => { const a = Math.PI * (1 - i / (total - 1)); return { x: cx + R * Math.cos(a), y: cy - R * Math.sin(a), on: i < lit }; });
  return <svg viewBox="0 0 300 168" role="img" aria-label={label}>
    {dots.map((d, i) => <circle key={i} className="dot" cx={d.x} cy={d.y} r={d.on ? 6.2 : 4} fill={d.on ? 'var(--lime)' : 'var(--s3)'} />)}
  </svg>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div aria-busy="true" aria-label="Loading">{Array.from({ length: lines }, (_, i) => <div key={i} className="sk" style={{ height: i === 0 ? 28 : 16, width: `${100 - i * 14}%`, marginBottom: 10 }} />)}</div>;
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="card" style={{ textAlign: 'center', padding: '22px 16px' }}><div className="lead" style={{ fontSize: 17 }}>{title}</div>{children && <p className="dim" style={{ margin: '8px 0 0' }}>{children}</p>}{action && <div style={{ marginTop: 14 }}>{action}</div>}</div>;
}
export function useEscape(fn: () => void) { useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && fn(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [fn]); }
