import { StatusBar } from './statusbar.tsx';
import { Suspense, lazy, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { DEFAULTS, effectsOf, updownOf, type State } from './store.ts';
import { SAVE_FAILURE_WORDS, loadState, saveState, shouldAdoptStorageEvent, type SaveFailure } from './persist.ts';
import { downloadBackup } from './backupfile.ts';
import { prefetchWhenIdle } from './prefetch.ts';
import { useScreen } from './data.ts';
import { Icon, UiProvider } from './ui.tsx';
const Today = lazy(() => import('./screens/today.tsx').then((m) => ({ default: m.Today })));
const Discover = lazy(() => import('./screens/discover.tsx').then((m) => ({ default: m.Discover })));
const Signals = lazy(() => import('./screens/signals.tsx').then((m) => ({ default: m.Signals })));
const Desk = lazy(() => import('./screens/desk.tsx').then((m) => ({ default: m.Desk })));
const More = lazy(() => import('./screens/More.tsx').then((m) => ({ default: m.More })));
const Settings = lazy(() => import('./screens/settings.tsx').then((m) => ({ default: m.Settings })));
const Company = lazy(() => import('./screens/company.tsx').then((m) => ({ default: m.Company })));
const Compare = lazy(() => import('./screens/compare.tsx').then((m) => ({ default: m.Compare })));
const DataPage = lazy(() => import('./screens/Data.tsx').then((m) => ({ default: m.DataPage })));
const Live = lazy(() => import('./screens/Live.tsx').then((m) => ({ default: m.Live })));
const NewsPage = lazy(() => import('./screens/NewsPage.tsx').then((m) => ({ default: m.NewsPage })));
const Markets = lazy(() => import('./screens/markets.tsx').then((m) => ({ default: m.Markets })));
const Lab = lazy(() => import('./screens/Lab.tsx').then((m) => ({ default: m.Lab })));
const Methodology = lazy(() => import('./screens/Methodology.tsx').then((m) => ({ default: m.Methodology })));
const Help = lazy(() => import('./screens/Help.tsx').then((m) => ({ default: m.Help })));
const Operations = lazy(() => import('./screens/ops.tsx').then((m) => ({ default: m.Operations })));
const Report = lazy(() => import('./screens/report.tsx').then((m) => ({ default: m.Report })));
const Privacy = lazy(() => import('./screens/legal.tsx').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./screens/legal.tsx').then((m) => ({ default: m.Terms })));
const NotFound = lazy(() => import('./screens/notfound.tsx').then((m) => ({ default: m.NotFound })));
const MacroPage = lazy(() => import('./screens/Macro.tsx').then((m) => ({ default: m.MacroPage })));
import { Welcome } from './screens/welcome.tsx';
const SearchSheet = lazy(() => import('./sheets.tsx').then((m) => ({ default: m.SearchSheet })));
const PlannerSheet = lazy(() => import('./sheets.tsx').then((m) => ({ default: m.PlannerSheet })));
const ThesisSheet = lazy(() => import('./sheets.tsx').then((m) => ({ default: m.ThesisSheet })));
const ExplainSheet = lazy(() => import('./sheets.tsx').then((m) => ({ default: m.ExplainSheet })));
import { freshness } from './fresh.ts';
import { bannerSlot, readHint, writeHint } from './bannerslot.ts';
import { applyTheme } from './theme.ts';
import { haptic } from './haptic.ts';
import { lockId } from './lock.ts';
import { lastDiscoverQuery } from './discoverstate.ts';
import { ScrollTop } from './components/ScrollTop.tsx';
import { LockScreen } from './screens/LockScreen.tsx';
import { applyUpdate, usePwa } from './pwa.ts';
import { pathOnly, resolveRoute } from './route.ts';
import { useRouteView } from './routevt.ts';

/* ---- state: this device only, until an identity provider is configured ---- */
const KEY = 'tripwire:v1';
let mem: State | null = null;
/** Whether this browser is really keeping the data. Private modes and a full disk make setItem throw; saying nothing would let a person write notes that vanish. */
const health: { persisted: boolean; unreadable: boolean; why: SaveFailure | null } = { persisted: true, unreadable: false, why: null };
const store = (): Storage | null => { try { return localStorage; } catch { return null; } };
function load(): State {
  const r = loadState(store(), KEY); if (r.unreadable) health.unreadable = true;   // loadState keeps a copy of what could not be read before anything is written over it
  if (r.blocked) { health.persisted = false; health.why = 'blocked'; } return r.state;
}
const subs = new Set<() => void>();
export function setState(fn: (s: State) => State) {
  mem = fn(mem ?? load());
  const r = saveState(store(), KEY, mem); health.persisted = r.ok; health.why = r.ok ? null : r.why;   // on failure the state stays in memory for this session, and the banner says so and offers a backup
  subs.forEach((f) => f());
}
export function useAppState(): State {
  return useSyncExternalStore((f) => { subs.add(f); const st = (e: StorageEvent) => { if (!shouldAdoptStorageEvent(e, KEY, health.persisted)) return; mem = load(); f(); }; /* never replace edits this browser would not save with an older copy */ window.addEventListener('storage', st); return () => { subs.delete(f); window.removeEventListener('storage', st); }; }, () => (mem ??= load()), () => DEFAULTS);
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
/** `force` is for the one caller that deliberately rewrites ONE route into another (#/profile to #/settings). Every other caller describes the screen it is drawing, so it only writes while the address still names that screen:
 *  a Discover write that fires after the person has already left (a debounce, or a screen that only just arrived through a route transition) used to put #/discover back over #/desk (12 Nov 2026, audit.mjs). */
export function replaceHash(to: string, force = false) { try { if (!force && pathOnly(location.hash) !== pathOnly(to)) return; history.replaceState(history.state, '', `#${to}`); quietRaw = read().raw; const y = scrollAt.get(curRaw); curRaw = quietRaw; if (y !== undefined) scrollAt.set(curRaw, y); } catch { /* see above */ } }
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
type Sheet = { k: 'search' } | { k: 'plan'; sym?: string; entry?: number; stop?: number } | { k: 'thesis'; sym: string; id?: string; seed?: { question: string; evidence: string } } | { k: 'explain'; id?: string; sym?: string };
const SheetCtx = createContext<{ open: (s: Sheet) => void }>({ open: () => {} });
export const useSheets = () => useContext(SheetCtx);

/** Five destinations. Today, Signals, Discover and My Desk are the daily ones; everything else is under More. News, Markets, Live and a macro series are reached from Today, so they stay in its tab; the Lab from Discover. */
export const TABS = [{ id: 'today', label: 'Today', c: 'var(--accent)' }, { id: 'discover', label: 'Research', c: 'var(--accent)' }, { id: 'signals', label: 'Book', c: 'var(--accent)' }, { id: 'more', label: 'Menu', c: 'var(--accent)' }];   /* 11 Nov 2026: three daily places and a Menu (My Desk, settings, data, method, help). */
const MORE_HEADS = ['more', 'settings', 'profile', 'data', 'methodology', 'help', 'ops', 'privacy', 'terms'];
export const tabOf = (p: string[]) => (p[0] === 'c' || p[0] === 'compare' || p[0] === 'lab' ? 'discover' : p[0] === 'm' || p[0] === 'news' || p[0] === 'markets' || p[0] === 'live' ? 'today' : p[0] === 'report' || p[0] === 'desk' ? 'more' : MORE_HEADS.includes(p[0]) ? 'more' : TABS.some((t) => t.id === p[0]) ? p[0] : p[0] ? 'more' : 'today');
const TITLES: Record<string, string> = { signals: 'Book', settings: 'Settings', profile: 'Settings', data: 'Data and coverage', methodology: 'Methodology and evidence', help: 'Help', ops: 'Operations', news: 'News', markets: 'Markets', live: 'Paper P&L', paper: 'Paper P&L', book: 'Paper P&L', lab: 'Lab', c: 'Company', compare: 'Compare', report: 'Report', m: 'Macro', privacy: 'Privacy', terms: 'Terms of use' };
/** The last place each tab was left, so a tap on another tab and back returns to it. Discover keeps its own (discoverstate), which also knows its scroll and revealed rows. */
const tabLast: Record<string, string> = {};
/** Replaces the address (no extra Back step) and draws nothing. */
function Redirect({ to }: { to: string }) { useEffect(() => { location.replace(to); }, [to]); return null; }

export function App(): ReactNode {
  const s = useAppState();
  const loc = useLoc();
  /** The screen follows the address one render later, so a tap on a tab keeps the last screen until the next one has arrived: no blank frame, no spinner. The tab bar uses `loc` and answers at once. */
  const vl = useRouteView(loc, tabOf, isQuiet);   // 12 Nov 2026: through a View Transition under html.fx (routevt.ts); otherwise the deferred address, as before
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const screen = useScreen();
  const hint = useRef<string | null>(null); if (hint.current === null) hint.current = readHint() ?? '';   // read once, before the screen answers; '' = nothing remembered
  useEffect(() => { writeHint(screen.data?.as_of); }, [screen.data?.as_of]);
  const close = useCallback(() => setSheet(null), []);
  useEffect(() => { const a = () => setOnline(true), b = () => setOnline(false); window.addEventListener('online', a); window.addEventListener('offline', b); return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); }; }, []);
  useEffect(() => {
    const root = document.documentElement; const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      const mode = effectsOf(s.prefs); const on = s.prefs.motion === 'auto' && !mq.matches && mode !== 'off';
      root.classList.toggle('fx', on); root.classList.toggle('fx-calm', on && mode === 'calm'); root.classList.toggle('fx-lively', on && mode === 'lively');   // 12 Nov 2026: the Effects preset; the device setting is re-read live, not once
      root.dataset.effects = mode;
    };
    apply(); mq.addEventListener?.('change', apply); return () => mq.removeEventListener?.('change', apply);
  }, [s.prefs.motion, s.prefs.effects]);
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
  useLayoutEffect(() => { document.documentElement.dataset.updown = updownOf(s.prefs); }, [s.prefs.updown]);   // 13 Nov 2026: the up/down palette is html[data-updown] in tokens.css; set before paint so a blue-and-orange reader never sees green and red first
  useEffect(() => { const h = (e: Event) => { const t = e.target as HTMLElement | null; if (t?.closest('.btn,.chip,.icon-btn,.seg button,.mini-seg button,.tabs a,.pick-row,.swatch')) haptic('tap'); }; document.addEventListener('click', h, true); return () => document.removeEventListener('click', h, true); }, []);
  // the lock: on at launch if it is set, and again after a minute in the background
  const [locked, setLocked] = useState(() => !!lockId());
  useEffect(() => { let hiddenAt = 0; const f = () => { if (document.visibilityState === 'hidden') hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 60000 && lockId()) { setLocked(true); hiddenAt = 0; } }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  useEffect(() => { const h = (e: Event) => { const f = (e as CustomEvent).detail; setSheet(f === 'plan' ? { k: 'plan' } : { k: 'explain' }); }; window.addEventListener('tw-sheet', h); return () => window.removeEventListener('tw-sheet', h); }, []);
  // Route chunks are fetched once the page has loaded and gone idle (a first-time visitor's welcome screen fetches them when touched): see prefetch.ts. Not at start-up, where they compete with the first screen.
  useEffect(() => (s.onboarded ? prefetchWhenIdle() : undefined), [s.onboarded]);
  const pwa = usePwa(); const [updMsg, setUpdMsg] = useState('');
  const tab = tabOf(loc.path); const tiRaw = TABS.findIndex((t) => t.id === tab); const ti = Math.max(0, tiRaw);   /* a Menu page (desk, more) highlights no tab */
  if (!isQuiet(loc.raw) && resolveRoute(loc.path).kind === 'ok' && (tab === 'more' || tab === 'signals' || loc.path[0] === 'today' || !loc.path[0])) tabLast[tab] = loc.raw;   // Today remembers only Today itself: Markets and News are pages opened FROM it, not places it lives
  // a quiet URL rewrite (Discover keeping its link current) is not a navigation; a return to Discover scrolls itself
  const nav = useRef(loc.raw); if (!isQuiet(loc.raw)) nav.current = loc.raw;
  useEffect(() => {
    const own = loc.path[0] === 'discover' && isRestoring(loc.raw);   // Discover puts itself back
    if (!own && !(isRestoring(loc.raw) && restoreScroll(loc.raw))) window.scrollTo(0, 0);
    document.title = `${resolveRoute(loc.path).kind === 'notfound' ? 'Not found' : TITLES[loc.path[0]] ?? (loc.path[0] === 'desk' ? 'My Desk' : TABS[ti].label)} · Tripwire`;
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
  const legalHead = vl.path[0] === 'privacy' || vl.path[0] === 'terms';   // a first-time visitor can read both pages from a link before choosing anything
  if (!s.onboarded && !legalHead) return <UiProvider haptics={s.prefs.haptics}><Suspense fallback={null}><Welcome unreadable={health.unreadable} /></Suspense></UiProvider>;
  const vtab = tabOf(vl.path);
  const head = vl.path[0], f = screen.data ? freshness(screen.data.as_of) : null;
  const slot = bannerSlot({ online, loading: screen.loading, hasData: !!screen.data, behind: f ? f.behind : null, hintDay: hint.current });
  // the stale-data banner (wording and severity unchanged). On Today the page draws it itself, directly under the brief; everywhere else it stays at the top.
  const staleBanner = slot === 'show' ? <div className="banner" role="status" data-stale-banner>The data stops {f!.behind} sessions before the last finished one. Treat everything as old.</div>
    : slot === 'reserve' ? <div className="banner banner-ghost" aria-hidden="true" data-banner-slot>The data stops 2 sessions before the last finished one. Treat everything as old.</div> : null;
  let onToday = false;
  let view: ReactNode;
  const route = resolveRoute(vl.path);
  if (route.kind === 'notfound') view = <NotFound asked={route.asked} />;
  else if (head === 'c' && vl.path[1]) view = <Company sym={decodeURIComponent(vl.path[1])} />;
  else if (head === 'm' && vl.path[1]) view = <MacroPage k={decodeURIComponent(vl.path[1]).toUpperCase()} />;
  else if (head === 'compare') view = <Compare syms={(vl.q.get('s') ?? '').split(',').filter(Boolean).slice(0, 3)} />;
  else if (head === 'report' && vl.path[1]) view = <Report sym={decodeURIComponent(vl.path[1])} />;
  else if (head === 'more') view = <More />;
  else if (head === 'signals') view = <Signals seg={vl.q.get('v')} />;   // 11 Nov 2026: the Book opens on Positions; every older ?v= still lands (bookview.ts)
  else if (head === 'settings' || head === 'profile') view = <Settings />;   // #/profile is the older address of the same screen
  else if (head === 'data') view = <DataPage />;
  else if (head === 'methodology') view = <Methodology />;
  else if (head === 'help') view = <Help />;
  else if (head === 'ops') view = <Operations />;
  else if (head === 'privacy') view = <Privacy />;
  else if (head === 'terms') view = <Terms />;
  else if (head === 'live') view = <Live />;
  else if (head === 'paper' || head === 'book') view = <Redirect to="#/signals?v=positions" />;   // the obvious addresses for the paper book land on it (Book > Positions), not on a dead end
  else if (head === 'news') view = <NewsPage />;
  else if (head === 'markets') view = <Markets />;
  else if (head === 'lab') view = <Lab />;
  else if (vtab === 'discover') view = <Discover />;
  else if (vl.path[0] === 'desk') view = <Desk seg={vl.q.get('v') ?? 'follow'} />;
  else { onToday = true; view = <Today banner={staleBanner} />; }
  return <UiProvider haptics={s.prefs.haptics}><SheetCtx.Provider value={ctx}>
    <a className="sr skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.focus({ preventScroll: true }); m?.scrollIntoView(); }}>Skip to main content</a>
    <div className="app">
      <main className="main" id="main" tabIndex={-1}>
        <StatusBar asOf={screen.data?.as_of} />
        {!health.persisted && <div className="banner" role="alert">Tripwire could not save: {SAVE_FAILURE_WORDS[health.why ?? 'other']}. What you have written is still here, but notes, plans and paper trades will be lost when this tab closes. <button className="btn sm" onClick={() => downloadBackup(s)}>Download a backup now</button></div>}
        {health.unreadable && <div className="banner" role="alert">Saved data on this device could not be read. A copy was kept, and nothing was erased. Import a backup from Settings (More) to restore your notes.</div>}
        {pwa.updateReady && <div className="banner upd" role="status"><span>Update ready.</span><button className="btn sm" onClick={() => { const r = applyUpdate(); setUpdMsg(r === 'busy' ? 'Finish what you are editing first, then reload.' : ''); }}>Reload</button>{updMsg && <span className="why small">{updMsg}</span>}</div>}
        {!online && <div className="banner" role="status">Offline: showing the last saved copy{screen.data ? `, data through ${screen.data.as_of}` : ''}. Notes you write are kept on this device.</div>}
        {!onToday && staleBanner}
        {/* The legacy Settings address is the same screen: its quiet URL rewrite must preserve an import result and other local state. */}
        <div className="view" key={head === 'profile' ? 'settings' : vl.path.slice(0, 2).join('/')}><Suspense fallback={<div className="routewait" role="status" aria-label="Loading the page" />}>{view}</Suspense></div>
        <ScrollTop />
      </main>
      <nav className="tabs" aria-label="Primary" data-none={tiRaw < 0 ? '' : undefined} style={{ '--tc': TABS[ti].c, '--i': ti, '--n': TABS.length } as React.CSSProperties}>
        <span className="rail-brand" aria-hidden="true"><i />Tripwire<small>Research workspace</small></span>
        <span className="pill" aria-hidden="true" />
        {TABS.map((t) => <a key={t.id} href={`#/${t.id}`} style={{ '--c': t.c } as React.CSSProperties} aria-current={t.id === tab ? 'page' : undefined} onClick={onTab(t.id)}><Icon n={t.id} /><span>{t.label}</span></a>)}
        <span className="rail-note">Your research.<br />Your perspective.<small>Local-first · Paper-only</small></span>
      </nav>
    </div>
    <Suspense fallback={null}>
    {sheet?.k === 'search' && <SearchSheet onClose={close} />}
    {sheet?.k === 'plan' && <PlannerSheet onClose={close} sym={sheet.sym} entry={sheet.entry} stop={sheet.stop} />}
    {sheet?.k === 'thesis' && <ThesisSheet key={`${sheet.sym}-${sheet.id ?? "new"}-${sheet.seed?.evidence ?? ""}`} onClose={close} sym={sheet.sym} id={sheet.id} seed={sheet.seed} />}
    {sheet?.k === 'explain' && <ExplainSheet onClose={close} id={sheet.id} sym={sheet.sym} />}
    </Suspense>
  </SheetCtx.Provider></UiProvider>;
}
