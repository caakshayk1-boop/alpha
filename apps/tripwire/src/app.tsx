import { StatusBar } from './statusbar.tsx';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { DEFAULTS, readSaved, type State } from './store.ts';
import { useScreen } from './data.ts';
import { Icon, UiProvider } from './ui.tsx';
import { Today } from './screens/today.tsx';
import { Discover } from './screens/discover.tsx';
import { Signals } from './screens/signals.tsx';
import { Desk } from './screens/desk.tsx';
import { Profile } from './screens/profile.tsx';
import { Company } from './screens/company.tsx';
import { Compare } from './screens/compare.tsx';
import { DataPage } from './screens/Data.tsx';
import { Live } from './screens/Live.tsx';
import { Report } from './screens/report.tsx';
import { MacroPage } from './screens/Macro.tsx';
import { Welcome } from './screens/welcome.tsx';
import { SearchSheet, PlannerSheet, ThesisSheet, ExplainSheet } from './sheets.tsx';
import { freshness } from './fresh.ts';
import { applyTheme } from './theme.ts';
import { haptic } from './haptic.ts';
import { lockId } from './lock.ts';
import { LockScreen } from './screens/LockScreen.tsx';

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
export const back = () => { if (history.length > 1) history.back(); else go('/today'); };

/* ---- sheets ---- */
type Sheet = { k: 'search' } | { k: 'plan'; sym?: string; entry?: number; stop?: number } | { k: 'thesis'; sym: string; id?: string } | { k: 'explain'; id?: string };
const SheetCtx = createContext<{ open: (s: Sheet) => void }>({ open: () => {} });
export const useSheets = () => useContext(SheetCtx);

const TABS = [{ id: 'today', label: 'Today', c: 'var(--lime)' }, { id: 'discover', label: 'Discover', c: 'var(--a2)' }, { id: 'signals', label: 'Signals', c: 'var(--a3)' }, { id: 'desk', label: 'My Desk', c: 'var(--a4)' }, { id: 'profile', label: 'Profile', c: 'var(--a5)' }];
const tabOf = (p: string[]) => (p[0] === 'c' || p[0] === 'compare' ? 'discover' : p[0] === 'm' ? 'today' : p[0] === 'report' ? 'desk' : p[0] === 'data' ? 'profile' : p[0] === 'live' ? 'today' : TABS.some((t) => t.id === p[0]) ? p[0] : 'today');

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
  const tab = tabOf(loc.path); const ti = Math.max(0, TABS.findIndex((t) => t.id === tab));
  useEffect(() => { window.scrollTo(0, 0); document.title = `${TABS[ti].label} · Tripwire`; }, [loc.raw, ti]);

  if (locked && lockId()) return <UiProvider haptics={s.prefs.haptics}><LockScreen onOpen={() => setLocked(false)} /></UiProvider>;
  if (!s.onboarded) return <UiProvider haptics={s.prefs.haptics}><Welcome unreadable={health.unreadable} /></UiProvider>;
  const head = loc.path[0], f = screen.data ? freshness(screen.data.as_of) : null;
  let view: ReactNode;
  if (head === 'c' && loc.path[1]) view = <Company sym={decodeURIComponent(loc.path[1])} />;
  else if (head === 'm' && loc.path[1]) view = <MacroPage k={decodeURIComponent(loc.path[1]).toUpperCase()} />;
  else if (head === 'compare') view = <Compare syms={(loc.q.get('s') ?? '').split(',').filter(Boolean).slice(0, 3)} />;
  else if (head === 'report' && loc.path[1]) view = <Report sym={decodeURIComponent(loc.path[1])} />;
  else if (head === 'data') view = <DataPage />;
  else if (head === 'live') view = <Live />;
  else if (tab === 'discover') view = <Discover />;
  else if (tab === 'signals') view = <Signals seg={loc.q.get('v') ?? 'picks'} />;
  else if (tab === 'desk') view = <Desk seg={loc.q.get('v') ?? 'follow'} />;
  else if (tab === 'profile') view = <Profile />;
  else view = <Today />;
  return <UiProvider haptics={s.prefs.haptics}><SheetCtx.Provider value={ctx}>
    <a className="sr" href="#/today">Skip to Today</a>
    <div className="app">
      <main className="main" id="main">
        <StatusBar asOf={screen.data?.as_of} />
        {!health.persisted && <div className="banner" role="alert">This browser is not keeping Tripwire's data (private mode, or storage is full). Notes, plans and paper trades will be lost when this tab closes. Export a backup from Profile now.</div>}
        {health.unreadable && <div className="banner" role="alert">Saved data on this device could not be read. A copy was kept, and nothing was erased. Import a backup from Profile to restore your notes.</div>}
        {!online && <div className="banner" role="status">Offline: showing the last saved copy{screen.data ? `, data through ${screen.data.as_of}` : ''}. Notes you write are kept on this device.</div>}
        {online && f && f.behind !== null && f.behind > 1 && <div className="banner" role="status">The data stops {f.behind} sessions before the last finished one. Treat everything as old.</div>}
        <div className="view" key={loc.path.slice(0, 2).join('/')}>{view}</div>
      </main>
      <nav className="tabs" aria-label="Primary" style={{ '--tc': TABS[ti].c } as React.CSSProperties}>
        <span className="pill" style={{ transform: `translate${matchMedia('(min-width:900px)').matches ? 'Y' : 'X'}(${ti * 100}%)` }} aria-hidden="true" />
        {TABS.map((t) => <a key={t.id} href={`#/${t.id}`} style={{ '--c': t.c } as React.CSSProperties} aria-current={t.id === tab ? 'page' : undefined}><Icon n={t.id} /><span>{t.label}</span></a>)}
      </nav>
    </div>
    {sheet?.k === 'search' && <SearchSheet onClose={close} />}
    {sheet?.k === 'plan' && <PlannerSheet onClose={close} sym={sheet.sym} entry={sheet.entry} stop={sheet.stop} />}
    {sheet?.k === 'thesis' && <ThesisSheet onClose={close} sym={sheet.sym} id={sheet.id} />}
    {sheet?.k === 'explain' && <ExplainSheet onClose={close} id={sheet.id} />}
  </SheetCtx.Provider></UiProvider>;
}
