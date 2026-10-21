'use client';

// Field speed (Pro §31): one beacon per sampled page load, sent when the page is hidden, to /api/rum. It carries the route
// template, phone or desktop, and the Core Web Vitals this browser measured. No identifier, symbol, query or cookie.
// Not sent when the browser asks not to be tracked (Do Not Track or Global Privacy Control). Measures the page that was
// LOADED: later in-app navigations are not separate loads and are not timed.

/** The route template, the same rule as routeOf() in worker/rum.js (a test holds the two equal). */
export function routeOfPath(path: string): string | null {
  if (path.length > 80) return null;
  if (path === '/') return '/';
  if (/^\/company\/[^/]+\/$/.test(path)) return '/company/[slug]/';
  return /^\/[a-z][a-z-]{0,20}\/$/.test(path) ? path : null;
}

const SAMPLE = 0.25;
let started = false;

export function startRum() {
  if (started || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
  started = true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true || Math.random() >= SAMPLE) return;
  const route = routeOfPath(window.location.pathname);
  if (!route) return;
  const m: Record<string, number> = {};
  const watch = (type: string, cb: (e: PerformanceEntry) => void, extra: Record<string, unknown> = {}) => {
    try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra } as PerformanceObserverInit); } catch { /* not supported here */ }
  };
  watch('largest-contentful-paint', (e) => { m.lcp = Math.round(e.startTime); });
  let cls = 0;
  watch('layout-shift', (e) => { const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean }; if (!s.hadRecentInput) { cls += s.value; m.cls = Math.round(cls * 1000) / 1000; } });
  // INP, approximated as the slowest interaction (exact for pages with fewer than 50 interactions)
  watch('event', (e) => { const t = e as PerformanceEntry & { interactionId?: number }; if (t.interactionId) m.inp = Math.max(m.inp ?? 0, Math.round(t.duration)); }, { durationThreshold: 40 });
  const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (n && n.responseStart > 0) m.ttfb = Math.round(n.responseStart);
  let sent = false;
  const send = (e: Event) => {
    if (sent || (e.type === 'visibilitychange' && document.visibilityState !== 'hidden') || !Object.keys(m).length) return;
    sent = true;
    const body = JSON.stringify({ r: route, d: window.matchMedia('(max-width: 760px)').matches ? 'phone' : 'desktop', m });
    try { navigator.sendBeacon('/api/rum', new Blob([body], { type: 'text/plain' })); } catch { /* best effort */ }
  };
  document.addEventListener('visibilitychange', send);
  window.addEventListener('pagehide', send);
}
