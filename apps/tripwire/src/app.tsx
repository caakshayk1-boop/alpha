import { StatusBar } from './statusbar.tsx';
import { Suspense, lazy, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { DEFAULTS, readSaved, type State } from './store.ts';
import { useScreen } from './data.ts';
import { Icon, UiProvider } from './ui.tsx';
import { Today } from './screens/today.tsx';
const Discover = lazy(() => import('./screens/discover.tsx').then((m) => ({ default: m.Discover })));
const Signals = lazy(() => import('./screens/signals.tsx').then((m) => ({ default: m.Signals })));
const Desk = lazy(() => import('./screens/desk.tsx').then((m) => ({ default: m.Desk })));
const More = lazy(() => import('./screens/More.tsx').then((m) => ({ default: m.More })));
const Profile = lazy(() => import('./screens/profile.tsx').then((m) => ({ default: m.Profile })));
const Company = lazy(() => import('./screens/company.tsx').then((m) => ({ default: m.Company })));
const Compare = lazy(() => import('./screens/compare.tsx').then((m) => ({ default: m.Compare })));
const DataPage = lazy(() => import('./screens/Data.tsx').then((m) => ({ default: m.DataPage })));
const Live = lazy(() => import('./screens/Live.tsx').then((m) => ({ default: m.Live })));
const NewsPage = lazy(() => import('./screens/NewsPage.tsx').then((m) => ({ default: m.NewsPage })));
const Markets = lazy(() => import('./screens/markets.tsx').then((m) => ({ default: m.Markets })));
const Lab = lazy(() => import('./screens/Lab.tsx').then((m) => ({ default: m.Lab })));
const Methodology = lazy(() => import('./screens/Methodology.tsx').then((m) => ({ default: m.Methodology })));
const Help = lazy(() => import('./screens/Help.tsx').then((m) => ({ default: m.Help })));
const Operations = lazy(() => import('./screens/profile.tsx').then((m) => ({ default: m.Operations })));
const Report = lazy(() => import('./screens/report.tsx').then((m) => ({ default: m.Report })));
import { MacroPage } from './screens/Macro.tsx';
const Welcome = lazy(() => import('./screens/welcome.tsx').then((m) => ({ default: m.Welcome })));
const SearchSheet = lazy(() => import('./sheets.tsx').then((m) => ({ default: m.SearchSheet })));
const PlannerSheet = lazy(() => import('./sheets.tsx').then((m) => ({ default: m.PlannerSheet })));
const ThesisSheet = lazy(() => import('./sheets.tsx').then((m) => ({ default: m.ThesisSheet })));
const ExplainSheet = lazy(() => import('./sheets.tsx').then((m) => ({ default: m.ExplainSheet })));
import { freshness } from './fresh.ts';
import { applyTheme } from './theme.ts';
import { haptic } from './haptic.ts';
import { lockId } from './lock.ts';
import { lastDiscoverQuery } from './discoverstate.ts';
import { LockScreen } from './screens/LockScreen.tsx';
import { applyUpdate, usePwa } from './pwa.ts';

/* ---- state: this device only, until an identity provider is configured ---- */
const KEY = 'tripwire:v1';
let mem: State | null = null;
/** Whether this browser is really keeping the data. Private modes and a full disk make setItem throw; saying nothing would let a person write notes that vanish. */
const health = { persisted: true, unreadable: false };
function load(): State {
  try { const t = localStorage.getItem(KEY); const r = readSaved(t);
    if (r.unreadable) { health.unreadable = true; try { localStorage.setItem(KEY + ':unreadable', t as string); } catch { /* nothing more can be done */ } }   // keep what could not be read before anything is written over it
    return r.state; } catch { health.persisted = false; return DEFAULTS; }
}
const subs = new Set<() => void>();
export function setState(fn: (s: State) => State) {
  mem = fn(mem ?? load());
  try { localStorage.setItem(KEY, JSON.stringify(mem)); health.persisted = true; } catch { health.persisted = false; }   // kept in memory for this session, and said so on screen
  subs.forEach((f) => f());
}
export function useAppState(): State {
  return useSyncExternalStore((f) => { subs.add(f); const st = () => { mem = load(); f(); }; window.addEventListener('storage', st); return () => { subs.delete(f); window.removeEventListener('storage', st); }; }, () => (mem ??= load()), () => DEFAULTS);
}

/* ---- router: hash based, so it works offline and from a static host ---- */
export interface Loc { path: string[]; q: URLSearchParams; raw: string }
const read = (): Loc => { const h = location.hash.replace(/^#/, '') || '/today'; const [p, qs] = h.split('?'); return { path: p.split('/').filter(Boolean), q: new URLSearchParams(qs ?? ''), raw: h }; };
let lastRaw = ''; let lastLoc: Loc = read();
const getLoc = (): Loc => { const h = location.hash; if (h !== lastRaw) { lastRaw = h; lastLoc = read(); } return lastLoc; };
export const useLoc = (): Loc => useSyncExternalStore((f) => { window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, getLoc);
export const go = (to: string) => { location.hash = to; };
/* ---- Discover support: URL rewrites that are not navigation, and scroll restoration ----
 * replaceHash rewrites the current URL in place: no history entry, no hashchange. The screen calling it already holds the state the URL now describes, so `quietRaw` names that URL and the
 * effects below do not treat it as arriving somewhere (no jump to the top). Safari limits replaceState calls; a refused one only leaves the URL one edit behind.
 * restoreHash marks the URL a Back/Forward (popstate) or a Discover tab tap is returning to, so the page can put the person back where they were instead of at the top. */
let quietRaw = '', restoreHash = '', bootRestore = false;
try { history.scrollRestoration = 'manual'; const t = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type; bootRestore = t === 'reload' || t === 'back_forward'; } catch { /* the browser then restores as it likes */ }
/* Where each screen was scrolled to when it was left, by location. Back, Forward and a tab tap put the person back there; a fresh link opens at the top. Kept in memory for the session. */
const scrollAt = new Map<string, number>(); let curRaw = read().raw;
const leave = () => { scrollAt.delete(curRaw); scrollAt.set(curRaw, Math.round(window.scrollY)); if (scrollAt.size > 80) scrollAt.delete(scrollAt.keys().next().value as string); curRaw = read().raw; };
window.addEventListener('popstate', () => { restoreHash = location.hash; });
window.addEventListener('hashchange', () => { leave(); quietRaw = ''; if (location.hash !== restoreHash) restoreHash = ''; });
export function replaceHash(to: string) { try { history.replaceState(history.state, '', `#${to}`); quietRaw = read().raw; const y = scrollAt.get(curRaw); curRaw = quietRaw; if (y !== undefined) scrollAt.set(curRaw, y); } catch { /* see above */ } }
/** Put the page back where `raw` was left, once the screen has the height for it (a lazy screen is still arriving). A touch, wheel or key press means the person has taken over: stop. */
function restoreScroll(raw: string): boolean {
  const y = scrollAt.get(raw); if (y === undefined || y < 2) return false;
  // keep it there for a moment: a lazy screen grows as it arrives, and the browser's scroll anchoring would otherwise carry the page past the place
  let stop = false; const until = Date.now() + 1200; const off = () => { stop = true; }; for (const e of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(e, off, { once: true, passive: true });
  const step = () => { if (stop) return; if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y); if (Date.now() < until) setTimeout(step, 50); }; step(); return true;
}
export const requestRestore = (to: string) => { restoreHash = `#${to}`; };
export const isRestoring = (raw: string) => restoreHash !== '' && restoreHash === `#${raw}`;
/** True once, for the first screen after a reload or a browser restart-from-history; and whenever a Back, Forward or tab tap is returning to `raw`. */
export const wantsRestore = (raw: string) => { const b = bootRestore; bootRestore = false; return b || isRestoring(raw); };
export const isQuiet = (raw: string) => raw === quietRaw;
export const back = () => { if (history.length > 1) history.back(); else go('/today'); };

/* ---- sheets ---- */
type Sheet = { k: 'search' } | { k: 'plan'; sym?: string; entry?: number; stop?: number } | { k: 'thesis'; sym: string; id?: string } | { k: 'explain'; id?: string };
const SheetCtx = createContext<{ open: (s: Sheet) => void }>({ open: () => {} });
export const useSheets = () => useContext(SheetCtx);

/** Four destinations. Today and Discover and My Desk are the daily ones; everything else is under More. News, Markets, Live and a macro series are reached from Today, so they stay in its tab; the Lab from Discover. */
export const TABS = [{ id: 'today', label: 'Today', c: 'var(--lime)' }, { id: 'discover', label: 'Discover', c: 'var(--a2)' }, { id: 'desk', label: 'My Desk', c: 'var(--a4)' }, { id: 'more', label: 'More', c: 'var(--a5)' }];
const MORE_HEADS = ['more', 'signals', 'profile', 'data', 'methodology', 'help', 'ops'];
export const tabOf = (p: string[]) => (p[0] === 'c' || p[0] === 'compare' || p[0] === 'lab' ? 'discover' : p[0] === 'm' || p[0] === 'news' || p[0] === 'markets' || p[0] === 'live' ? 'today' : p[0] === 'report' ? 'desk' : MORE_HEADS.includes(p[0]) ? 'more' : TABS.some((t) => t.id === p[0]) ? p[0] : 'today');
const TITLES: Record<string, string> = { signals: 'Signals', profile: 'Settings', data: 'Data and coverage', methodology: 'Methodology and evidence', help: 'Help', ops: 'Operations', news: 'News', markets: 'Markets', live: 'Live paper P&L', lab: 'Lab', c: 'Company', compare: 'Compare', report: 'Report', m: 'Macro' };
/** The last place each tab was left, so a tap on another tab and back returns to it. Discover keeps its own (discoverstate), which also knows its scroll and revealed rows. */
const tabLast: Record<string, string> = {};

export function App(): ReactNode {
  const s = useAppState();
  const loc = useLoc();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const screen = useScreen();
  const close = useCallback(() => setSheet(null), []);
  useEffect(() => { const a = () => setOnline(true), b = () => setOnline(false); window.addEventListener('online', a); window.addEventListener('offline', b); return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); }; }, []);
  useEffect(() => {
    const root = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.toggle('fx', s.prefs.motion === 'auto' && !reduced);
  }, [s.prefs.motion]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSheet({ k: 'search' }); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  // the on-screen keyboard: sticky bars step aside while a field is being typed in, and sheets size to what is actually visible
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return; const root = document.documentElement;
    const f = () => { const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); root.style.setProperty('--kb', `${Math.round(kb)}px`); root.style.setProperty('--vvh', `${Math.round(vv.height)}px`); root.classList.toggle('kb', kb > 120); };
    vv.addEventListener('resize', f); vv.addEventListener('scroll', f); f();
    return () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); };
  }, []);
  const ctx = useMemo(() => ({ open: setSheet }), []);
  // look: theme, hidden amounts; a tap on a control gives a light tap (never on a link that only scrolls)
  useEffect(() => { applyTheme(s.prefs.theme); }, [s.prefs.theme]);
  useEffect(() => { document.documentElement.classList.toggle('priv', !!s.prefs.hideAmounts); }, [s.prefs.hideAmounts]);
  useEffect(() => { const h = (e: Event) => { const t = e.target as HTMLElement | null; if (t?.closest('.btn,.chip,.icon-btn,.seg button,.mini-seg button,.tabs a,.pick-row,.swatch')) haptic('tap'); }; document.addEventListener('click', h, true); return () => document.removeEventListener('click', h, true); }, []);
  // the lock: on at launch if it is set, and again after a minute in the background
  const [locked, setLocked] = useState(() => !!lockId());
  useEffect(() => { let hiddenAt = 0; const f = () => { if (document.visibilityState === 'hidden') hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 60000 && lockId()) { setLocked(true); hiddenAt = 0; } }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  useEffect(() => { const h = (e: Event) => { const f = (e as CustomEvent).detail; setSheet(f === 'plan' ? { k: 'plan' } : { k: 'explain' }); }; window.addEventListener('tw-sheet', h); return () => window.removeEventListener('tw-sheet', h); }, []);
  // the other screens are separate files; fetch the common ones once the first screen is up, so a tap on a tab does not wait for the network
  useEffect(() => { const run = () => { void import('./screens/discover.tsx'); void import('./screens/company.tsx'); void import('./screens/signals.tsx'); void import('./screens/More.tsx'); void import('./screens/desk.tsx'); }; const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }; const id = window.setTimeout(run, 500); void w; return () => window.clearTimeout(id); }, []);
  const pwa = usePwa(); const [updMsg, setUpdMsg] = useState('');
  const tab = tabOf(loc.path); const ti = Math.max(0, TABS.findIndex((t) => t.id === tab));
  if (!isQuiet(loc.raw) && (tab === 'desk' || tab === 'more' || loc.path[0] === 'today' || !loc.path[0])) tabLast[tab] = loc.raw;   // Today remembers only Today itself: Markets and News are pages opened FROM it, not places it lives
  // a quiet URL rewrite (Discover keeping its link current) is not a navigation; a return to Discover scrolls itself
  const nav = useRef(loc.raw); if (!isQuiet(loc.raw)) nav.current = loc.raw;
  useEffect(() => {
    const own = loc.path[0] === 'discover' && isRestoring(loc.raw);   // Discover puts itself back
    if (!own && !(isRestoring(loc.raw) && restoreScroll(loc.raw))) window.scrollTo(0, 0);
    document.title = `${TITLES[loc.path[0]] ?? TABS[ti].label} · Tripwire`;
  }, [nav.current, ti]); // eslint-disable-line react-hooks/exhaustive-deps
  /** A tap on a tab. On the tab you are in: back to the top, and if you are already there, back to the tab's first screen. On another: where you left it, scroll and all. */
  const onTab = (id: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (id === tab) { if (window.scrollY > 8) { window.scrollTo(0, 0); return; } const root = `/${id}`; if (loc.raw !== root && !(id === 'discover' && loc.path[0] === 'discover')) go(root); return; }
    const q = id === 'discover' ? lastDiscoverQuery() : ''; const to = id === 'discover' ? (q ? `/discover?${q}` : '/discover') : tabLast[id] ?? `/${id}`;
    requestRestore(to); go(to);
  };

  if (locked && lockId()) return <UiProvider haptics={s.prefs.haptics}><LockScreen onOpen={() => setLocked(false)} /></UiProvider>;
  if (!s.onboarded) return <UiProvider haptics={s.prefs.haptics}><Suspense fallback={null}><Welcome unreadable={health.unreadable} /></Suspense></UiProvider>;
  const head = loc.path[0], f = screen.data ? freshness(screen.data.as_of) : null;
  let view: ReactNode;
  if (head === 'c' && loc.path[1]) view = <Company sym={decodeURIComponent(loc.path[1])} />;
  else if (head === 'm' && loc.path[1]) view = <MacroPage k={decodeURIComponent(loc.path[1]).toUpperCase()} />;
  else if (head === 'compare') view = <Compare syms={(loc.q.get('s') ?? '').split(',').filter(Boolean).slice(0, 3)} />;
  else if (head === 'report' && loc.path[1]) view = <Report sym={decodeURIComponent(loc.path[1])} />;
  else if (head === 'more') view = <More />;
  else if (head === 'signals') view = <Signals seg={loc.q.get('v') ?? 'picks'} />;
  else if (head === 'profile') view = <Profile />;
  else if (head === 'data') view = <DataPage />;
  else if (head === 'methodology') view = <Methodology />;
  else if (head === 'help') view = <Help />;
  else if (head === 'ops') view = <Operations />;
  else if (head === 'live') view = <Live />;
  else if (head === 'news') view = <NewsPage />;
  else if (head === 'markets') view = <Markets />;
  else if (head === 'lab') view = <Lab />;
  else if (tab === 'discover') view = <Discover />;
  else if (tab === 'desk') view = <Desk seg={loc.q.get('v') ?? 'follow'} />;
  else view = <Today />;
  return <UiProvider haptics={s.prefs.haptics}><SheetCtx.Provider value={ctx}>
    <a className="sr skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.focus({ preventScroll: true }); m?.scrollIntoView(); }}>Skip to main content</a>
    <div className="app">
      <main className="main" id="main" tabIndex={-1}>
        <StatusBar asOf={screen.data?.as_of} />
        {!health.persisted && <div className="banner" role="alert">This browser is not keeping Tripwire's data (private mode, or storage is full). Notes, plans and paper trades will be lost when this tab closes. Export a backup from Settings (More) now.</div>}
        {health.unreadable && <div className="banner" role="alert">Saved data on this device could not be read. A copy was kept, and nothing was erased. Import a backup from Profile to restore your notes.</div>}
        {pwa.updateReady && <div className="banner upd" role="status"><span>Update ready.</span><button className="btn sm" onClick={() => { const r = applyUpdate(); setUpdMsg(r === 'busy' ? 'Finish what you are editing first, then reload.' : ''); }}>Reload</button>{updMsg && <span className="why small">{updMsg}</span>}</div>}
        {!online && <div className="banner" role="status">Offline: showing the last saved copy{screen.data ? `, data through ${screen.data.as_of}` : ''}. Notes you write are kept on this device.</div>}
        {online && f && f.behind !== null && f.behind > 1 && <div className="banner" role="status">The data stops {f.behind} sessions before the last finished one. Treat everything as old.</div>}
        <div className="view" key={loc.path.slice(0, 2).join('/')}><Suspense fallback={<div className="routewait" role="status" aria-label="Loading the page" />}>{view}</Suspense></div>
      </main>
      <nav className="tabs" aria-label="Primary" style={{ '--tc': TABS[ti].c, '--i': ti } as React.CSSProperties}>
        <span className="pill" aria-hidden="true" />
        {TABS.map((t) => <a key={t.id} href={`#/${t.id}`} style={{ '--c': t.c } as React.CSSProperties} aria-current={t.id === tab ? 'page' : undefined} onClick={onTab(t.id)}><Icon n={t.id} /><span>{t.label}</span></a>)}
      </nav>
    </div>
    <Suspense fallback={null}>
    {sheet?.k === 'search' && <SearchSheet onClose={close} />}
    {sheet?.k === 'plan' && <PlannerSheet onClose={close} sym={sheet.sym} entry={sheet.entry} stop={sheet.stop} />}
    {sheet?.k === 'thesis' && <ThesisSheet onClose={close} sym={sheet.sym} id={sheet.id} />}
    {sheet?.k === 'explain' && <ExplainSheet onClose={close} id={sheet.id} />}
    </Suspense>
  </SheetCtx.Provider></UiProvider>;
}
