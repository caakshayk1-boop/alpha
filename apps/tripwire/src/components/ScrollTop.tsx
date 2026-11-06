import { useEffect, useRef, useState } from 'react';

/** Back to top, with a ring that fills as the page is read: how far down you are, and (in the label) how much is still below.
 *  It appears only on a long page, once the top is well behind, and sits in normal flow after the content so it never covers a chart. The ring is updated straight on the DOM from one
 *  rAF-throttled scroll listener, so a scroll never re-renders the app. With motion off (or reduced) the ring still shows the position, it just does not animate, and the jump is instant. */
const R = 22; const C = 2 * Math.PI * R;
export function ScrollTop() {
  const btn = useRef<HTMLButtonElement>(null); const ring = useRef<SVGCircleElement>(null); const num = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0; const room = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); const y = window.scrollY; const p = Math.min(1, Math.max(0, y / room)); const pct = Math.round(p * 100);
      ring.current?.style.setProperty('stroke-dashoffset', String(C * (1 - p))); if (num.current) num.current.textContent = String(pct);
      btn.current?.setAttribute('aria-label', `Back to top. ${pct}% of this page scrolled, ${100 - pct}% below.`); btn.current?.setAttribute('title', `${pct}% scrolled · ${100 - pct}% below`);
      setShown(room > window.innerHeight * 0.8 && y > Math.max(480, window.innerHeight * 0.6));
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', queue, { passive: true }); window.addEventListener('resize', queue); window.addEventListener('hashchange', queue);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null; ro?.observe(document.body); queue();
    return () => { window.removeEventListener('scroll', queue); window.removeEventListener('resize', queue); window.removeEventListener('hashchange', queue); ro?.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const up = () => {
    const calm = !document.documentElement.classList.contains('fx') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); document.getElementById('main')?.focus({ preventScroll: true });
  };
  return <button ref={btn} type="button" className="scrolltop" data-hidden={shown ? 'false' : 'true'} data-noprint aria-hidden={shown ? undefined : true} tabIndex={shown ? 0 : -1} onClick={up} aria-label="Back to top">
    <svg viewBox="0 0 52 52" aria-hidden="true" focusable="false"><circle className="trk" cx="26" cy="26" r={R} /><circle ref={ring} className="bar" cx="26" cy="26" r={R} strokeDasharray={C} strokeDashoffset={C} /></svg>
    <span className="lbl" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m6 14 6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg><span ref={num} className="num">0</span></span>
  </button>;
}
