'use client';
/** Navigation with continuity (Pro §26.2). Same-document View Transitions around a client navigation, as an enhancement:
 *  skipped under reduced motion or where the browser lacks the API, and never allowed to hold navigation for more than
 *  400 ms. A ticker passed as `from` takes the shared name "ticker", so it travels into the company header, which carries
 *  the same name. Names are set only for the moment of the transition, so no two elements on a page ever share one. */
import type { useRouter } from 'next/navigation';
import { prefersReduced } from './motion';

type VT = { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };
export function navigate(router: ReturnType<typeof useRouter>, href: string, from?: HTMLElement | null) {
  const doc = document as Document & VT;
  if (!doc.startViewTransition || prefersReduced()) { router.push(href); return; }
  if (from) from.style.viewTransitionName = 'ticker';
  doc.startViewTransition(() => new Promise<void>((done) => {
    const target = new URL(href, location.href).pathname;
    const t0 = performance.now();
    router.push(href);
    const wait = () => { if (location.pathname === target || performance.now() - t0 > 400) done(); else requestAnimationFrame(wait); };
    requestAnimationFrame(wait);
  })).finished.finally(() => { if (from) from.style.viewTransitionName = ''; });
}
