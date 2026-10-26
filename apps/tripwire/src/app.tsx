import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { DEFAULTS, parseState, type State } from './store.ts';
import { useScreen } from './data.ts';
import { Icon, UiProvider } from './ui.tsx';
import { Today } from './screens/today.tsx';
import { Discover } from './screens/discover.tsx';
import { Signals } from './screens/signals.tsx';
import { Desk } from './screens/desk.tsx';
import { Profile } from './screens/profile.tsx';
import { Company } from './screens/company.tsx';
import { Compare } from './screens/compare.tsx';
import { Report } from './screens/report.tsx';
import { MacroPage } from './screens/Macro.tsx';
import { Welcome } from './screens/welcome.tsx';
import { SearchSheet, PlannerSheet, ThesisSheet, ExplainSheet } from './sheets.tsx';
import { freshness } from './fresh.ts';

/* ---- state: this device only, until an identity provider is configured ---- */
const KEY = 'tripwire:v1';
let mem: State | null = null;
function load(): State { try { const t = localStorage.getItem(KEY); const p = t ? parseState(t) : null; return p ?? DEFAULTS; } catch { return DEFAULTS; } }
const subs = new Set<() => void>();
export function setState(fn: (s: State) => State) {
  mem = fn(mem ?? load());
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* private mode: keep it in memory for this session */ }
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

const TABS = [{ id: 'today', label: 'Today' }, { id: 'discover', label: 'Discover' }, { id: 'signals', label: 'Signals' }, { id: 'desk', label: 'My Desk' }, { id: 'profile', label: 'Profile' }];
const tabOf = (p: string[]) => (p[0] === 'c' || p[0] === 'compare' ? 'discover' : p[0] === 'm' ? 'today' : p[0] === 'report' ? 'desk' : TABS.some((t) => t.id === p[0]) ? p[0] : 'today');

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
  const ctx = useMemo(() => ({ open: setSheet }), []);
  useEffect(() => { const h = (e: Event) => { const f = (e as CustomEvent).detail; setSheet(f === 'plan' ? { k: 'plan' } : { k: 'explain' }); }; window.addEventListener('tw-sheet', h); return () => window.removeEventListener('tw-sheet', h); }, []);
  const tab = tabOf(loc.path); const ti = Math.max(0, TABS.findIndex((t) => t.id === tab));
  useEffect(() => { window.scrollTo(0, 0); document.title = `${TABS[ti].label} · Tripwire`; }, [loc.raw, ti]);

  if (!s.onboarded) return <UiProvider haptics={s.prefs.haptics}><Welcome /></UiProvider>;
  const head = loc.path[0], f = screen.data ? freshness(screen.data.as_of) : null;
  let view: ReactNode;
  if (head === 'c' && loc.path[1]) view = <Company sym={decodeURIComponent(loc.path[1])} />;
  else if (head === 'm' && loc.path[1]) view = <MacroPage k={decodeURIComponent(loc.path[1]).toUpperCase()} />;
  else if (head === 'compare') view = <Compare syms={(loc.q.get('s') ?? '').split(',').filter(Boolean).slice(0, 3)} />;
  else if (head === 'report' && loc.path[1]) view = <Report sym={decodeURIComponent(loc.path[1])} />;
  else if (tab === 'discover') view = <Discover />;
  else if (tab === 'signals') view = <Signals seg={loc.q.get('v') ?? 'picks'} />;
  else if (tab === 'desk') view = <Desk seg={loc.q.get('v') ?? 'follow'} />;
  else if (tab === 'profile') view = <Profile />;
  else view = <Today />;
  return <UiProvider haptics={s.prefs.haptics}><SheetCtx.Provider value={ctx}>
    <a className="sr" href="#/today">Skip to Today</a>
    <div className="app">
      <main className="main" id="main">
        {!online && <div className="banner" role="status">Offline: showing the last saved copy{screen.data ? `, data through ${screen.data.as_of}` : ''}. Notes you write are kept on this device.</div>}
        {online && f && f.behind !== null && f.behind > 1 && <div className="banner" role="status">The data stops {f.behind} sessions before the last finished one. Treat everything as old.</div>}
        <div className="view" key={loc.path.slice(0, 2).join('/')}>{view}</div>
      </main>
      <nav className="tabs" aria-label="Primary">
        <span className="pill" style={{ transform: `translate${matchMedia('(min-width:900px)').matches ? 'Y' : 'X'}(${ti * 100}%)` }} aria-hidden="true" />
        {TABS.map((t) => <a key={t.id} href={`#/${t.id}`} aria-current={t.id === tab ? 'page' : undefined}><Icon n={t.id} /><span>{t.label}</span></a>)}
      </nav>
    </div>
    {sheet?.k === 'search' && <SearchSheet onClose={close} />}
    {sheet?.k === 'plan' && <PlannerSheet onClose={close} sym={sheet.sym} entry={sheet.entry} stop={sheet.stop} />}
    {sheet?.k === 'thesis' && <ThesisSheet onClose={close} sym={sheet.sym} id={sheet.id} />}
    {sheet?.k === 'explain' && <ExplainSheet onClose={close} id={sheet.id} />}
  </SheetCtx.Provider></UiProvider>;
}
