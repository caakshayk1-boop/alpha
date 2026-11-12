import { startTransition, useDeferredValue, useLayoutEffect, useRef, useState } from 'react';

/** Route transitions (12 Nov 2026). Under html.fx only, and only where the browser has the View Transitions API, a hash route change is bracketed by document.startViewTransition:
 *  deeper (a list to a company, a tab to a page under it) arrives from the right by 12px, back reverses it, and a move to another tab (or a sibling page) is a short crossfade.
 *  Everything else (no API, motion off, reduced motion, a change that only edits the query) keeps the old behaviour: the screen follows the address one render later (useDeferredValue)
 *  and the keyed `.view` rises. The page only swaps INSIDE the transition's callback, so the old screen is what the browser captures. A new navigation mid-transition skips the running
 *  one and retargets to the latest address. The callback waits for the screen to commit (a lazy chunk keeps the old one, as before) but never longer than VT_WAIT_MS. */
export type RouteDir = 'fwd' | 'back' | 'tab';
export const VT_WAIT_MS = 300;
const ROOTS = new Set(['', 'today', 'discover', 'signals', 'more']);
/** 1 for a tab's own screen, 2 for anything opened from it (a company, a page under Menu, News, Markets, Compare). */
export const routeDepth = (path: string[]): number => (ROOTS.has(path[0] ?? '') ? 1 : 2);
/** Which way the screen should travel. A different tab, or a sibling at the same depth, is a crossfade. */
export function routeDirection(from: string[], to: string[], tabOf: (p: string[]) => string): RouteDir {
  if (tabOf(from) !== tabOf(to)) return 'tab';
  const a = routeDepth(from), b = routeDepth(to); return b > a ? 'fwd' : b < a ? 'back' : 'tab';
}
export const samePath = (a: { path: string[] }, b: { path: string[] }) => a.path.join('/') === b.path.join('/');
type VT = { finished: Promise<void>; skipTransition: () => void };
type Doc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => VT };
/** True when this moment can use a view transition: motion is on (html.fx is the app's own gate, which already folds in the device setting) and the API exists. */
export function canViewTransition(doc: Document = document): boolean {
  try { return typeof (doc as Doc).startViewTransition === 'function' && doc.documentElement.classList.contains('fx') && !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** The location the screen should show. `loc` is the address; the return value follows it, through a view transition where one is possible. */
export function useRouteView<L extends { path: string[]; raw: string }>(loc: L, tabOf: (p: string[]) => string, isQuiet: (raw: string) => boolean): L {
  const deferred = useDeferredValue(loc);
  const [vs, setVs] = useState<L>(loc);
  const on = canViewTransition();
  const latest = useRef(loc); latest.current = loc;
  const shown = useRef(vs.raw); const waiting = useRef<{ raw: string; done: () => void } | null>(null); const active = useRef<VT | null>(null);
  // not transition-managed (or only the query changed): follow the deferred address exactly as before, and keep `vs` current so switching motion on never shows a stale screen
  const follow = !on || samePath(vs, loc);
  if (follow && vs.raw !== deferred.raw) setVs(deferred);
  const view = follow ? deferred : vs;
  useLayoutEffect(() => { shown.current = view.raw; const w = waiting.current; if (w && w.raw === view.raw) { waiting.current = null; w.done(); } });
  useLayoutEffect(() => {
    if (!on || isQuiet(loc.raw) || samePath(vs, loc)) return;
    const root = document.documentElement; const dir = routeDirection(vs.path, loc.path, tabOf);
    active.current?.skipTransition();
    const swap = () => {
      const target = latest.current; if (shown.current === target.raw) return Promise.resolve();
      return new Promise<void>((res) => { let t = 0; const done = () => { clearTimeout(t); waiting.current = null; res(); }; waiting.current = { raw: target.raw, done }; t = window.setTimeout(done, VT_WAIT_MS); startTransition(() => setVs(target)); });
    };
    let vt: VT | undefined;
    try { root.dataset.vt = dir; vt = (document as Doc).startViewTransition!(swap); } catch { delete root.dataset.vt; startTransition(() => setVs(latest.current)); return; }
    active.current = vt; const mine = vt;
    const clear = () => { if (active.current === mine) { active.current = null; delete root.dataset.vt; } };
    mine.finished.then(clear, clear);
  }, [loc.raw]); // eslint-disable-line react-hooks/exhaustive-deps
  return view;
}
