import { useEffect, useRef } from 'react';

/** Back to top, with a ring that fills as the page is read: how far down you are, and (in the label) how much is still below.
 *  It floats (fixed, bottom-right, above the action bar and the tab bar) and offers itself only when the person is plausibly heading back: past ~1.2 screens AND scrolling up
 *  (shown after 80px of upward travel, put away after 40px down or within 300px of the top), and always at the foot of a long page. Everything is written straight to the DOM
 *  from one rAF-throttled passive scroll listener, so a scroll never re-renders the app. With motion off (or reduced) the jump is instant. Tests: tests/scrolltop.mjs. */
const R = 22; const C = 2 * Math.PI * R;
export const SCROLLTOP_RULE = { pastScreens: 1.2, nearTop: 300, showAfterUp: 80, hideAfterDown: 40 } as const;
export function ScrollTop() {
  const btn = useRef<HTMLButtonElement>(null); const ring = useRef<SVGCircleElement>(null); const num = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0; let last = window.scrollY; let up = 0; let down = 0; let on = false;
    const set = (v: boolean) => { if (v === on) return; on = v; const b = btn.current; if (!b) return; b.setAttribute('data-hidden', v ? 'false' : 'true'); if (v) { b.removeAttribute('aria-hidden'); b.tabIndex = 0; } else { b.setAttribute('aria-hidden', 'true'); b.tabIndex = -1; } };
    const update = () => {
      raf = 0; const vh = window.innerHeight; const room = Math.max(1, document.documentElement.scrollHeight - vh); const y = window.scrollY; const p = Math.min(1, Math.max(0, y / room)); const pct = Math.round(p * 100);
      ring.current?.style.setProperty('stroke-dashoffset', String(C * (1 - p))); if (num.current) num.current.textContent = String(pct);
      btn.current?.setAttribute('aria-label', `Back to top. ${pct}% of this page scrolled, ${100 - pct}% below.`); btn.current?.setAttribute('title', `${pct}% scrolled · ${100 - pct}% below`);
      const dy = y - last; last = y; if (dy < 0) { up -= dy; down = 0; } else if (dy > 0) { down += dy; up = 0; }
      const long = room > vh * 0.8; const atEnd = long && y >= room - 4; const R_ = SCROLLTOP_RULE;
      if (!long || y < R_.nearTop || y < vh * R_.pastScreens && !atEnd) set(false);
      else if (atEnd) set(true);
      else if (down >= R_.hideAfterDown) set(false);
      else if (up >= R_.showAfterUp) set(true);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    const reset = () => { up = 0; down = 0; last = window.scrollY; set(false); queue(); };
    window.addEventListener('scroll', queue, { passive: true }); window.addEventListener('resize', queue); window.addEventListener('hashchange', reset);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null; ro?.observe(document.body); queue();
    return () => { window.removeEventListener('scroll', queue); window.removeEventListener('resize', queue); window.removeEventListener('hashchange', reset); ro?.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const up = () => {
    const calm = !document.documentElement.classList.contains('fx') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); document.getElementById('main')?.focus({ preventScroll: true });
  };
  return <button ref={btn} type="button" className="scrolltop" data-hidden="true" data-noprint aria-hidden="true" tabIndex={-1} onClick={up} aria-label="Back to top">
    <svg viewBox="0 0 52 52" aria-hidden="true" focusable="false"><circle className="trk" cx="26" cy="26" r={R} /><circle ref={ring} className="bar" cx="26" cy="26" r={R} strokeDasharray={C} strokeDashoffset={C} /></svg>
    <span className="lbl" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m6 14 6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg><span ref={num} className="num">0</span></span>
  </button>;
}
