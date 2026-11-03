/** Fetch the other screens' code ahead of the tap that needs it. They are separate files so the first screen loads fast; without this a tap on a tab waits for the network.
 *  It is NOT run at start-up: that competed with the first screen and its data on a phone connection (PageSpeed measured it). A returning visitor gets it once the page has loaded and gone idle; a first-time
 *  visitor, who sees the welcome screen, gets it the moment they touch it, because their next tap needs these files. */
const LOADERS: (() => Promise<unknown>)[] = [
  () => import('./screens/today.tsx'), () => import('./screens/markets.tsx'), () => import('./screens/discover.tsx'), () => import('./screens/company.tsx'), () => import('./screens/signals.tsx'),
  () => import('./screens/desk.tsx'), () => import('./screens/settings.tsx'), () => import('./screens/More.tsx'), () => import('./screens/NewsPage.tsx'),
];
let started = false;
export function prefetchScreens(): void {
  if (started) return; started = true;
  for (const load of LOADERS) void load().catch(() => { /* a failed prefetch is retried by the tap that needs the file */ });
}
/** Run `prefetchScreens` after the page has loaded and gone idle. Returns a cancel function. */
export function prefetchWhenIdle(afterMs = 2500): () => void {
  let t = 0; let idle = 0; const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };
  const start = () => { t = window.setTimeout(() => { if (w.requestIdleCallback) idle = w.requestIdleCallback(prefetchScreens, { timeout: 4000 }); else prefetchScreens(); }, afterMs); };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
  return () => { window.removeEventListener('load', start); window.clearTimeout(t); if (idle) w.cancelIdleCallback?.(idle); };
}
