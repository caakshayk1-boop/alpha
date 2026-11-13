import type { MouseEvent, ReactNode } from 'react';

/** The Tripwire wordmark as a real link home (13 Nov 2026). It is an ordinary `<a href="#/today">`, so Enter, middle click and "copy link" all work; a plain click on it does the right thing for where you are:
 *  from any other page it follows the link (the app opens Today at the top), and when you are already on Today it scrolls to the top instead of doing nothing, then puts focus on the page so the next key press reads from the top.
 *  The scroll is instant unless motion is on (html.fx) and the device has not asked for less. The accessible name is "Tripwire, home" (it contains the visible word, as WCAG 2.5.3 asks). */
export const HOME_HASH = '#/today';
/** Is this address Today itself (no hash, #/, or #/today with or without a query)? Pure, so a test can drive it. */
export const isHomeHash = (hash: string): boolean => { const p = hash.replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, ''); return p === '' || p === 'today'; };

export function goHome(e: MouseEvent<HTMLElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // a new tab or window is the browser's to open
  const main = document.getElementById('main');
  if (isHomeHash(location.hash)) {
    e.preventDefault();
    const calm = !document.documentElement.classList.contains('fx') || matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); main?.focus({ preventScroll: true });
  }
}

export function Brand({ className, children }: { className: string; children?: ReactNode }) {
  return <a className={className} href={HOME_HASH} aria-label="Tripwire, home" data-brand onClick={goHome}><i aria-hidden="true" />Tripwire{children}</a>;
}
