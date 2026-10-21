'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { FreshnessBanner } from '@/components/DataStamp';
import { MarketClock } from '@/components/MarketClock';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { feed } from '@/lib/data';
import { fadeTheme, initMotion, initPointerLight, prefersReduced } from '@/lib/motion';
import { startRum } from '@/lib/rum';
import { PREFS, readPref, setPref, type PrefName } from '@/lib/prefs';
import { AREAS, PAGES, SHORTCUTS, areaFor, isActive, pageOf, pagesIn } from '@/lib/routes';
import { SCREEN_DEFAULT, toQuery } from '@/lib/screenUrl';
import type { Row } from '@/lib/types';
import { companyHref } from '@/lib/slug';
import { anyModalOpen, useModal } from '@/lib/useModal';
import { navigate } from '@/lib/nav';

export { PAGES } from '@/lib/routes';

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const typing = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);
const readJson = <T,>(k: string, d: T): T => { try { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); return v ?? d; } catch { return d; } };

// ── The command palette (Pro §28 P1) ───────────────────────────────────────────────────────────────────────────────
type Hit = { kind: 'company' | 'page' | 'screen' | 'action'; label: string; sub: string; href?: string; run?: () => void; id: string };
const KIND: Record<Hit['kind'], string> = { company: 'Companies', page: 'Pages', screen: 'Saved screens', action: 'Actions' };
interface SavedScreen { name: string; conds: { f: string; op: '>=' | '<='; v: string }[]; flags: string[]; sector: string; tier: string; nl?: { text: string; off: string[] } }

function Palette({ open, onClose, onShortcuts, onSettings }: { open: boolean; onClose: () => void; onShortcuts: () => void; onSettings: () => void }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [i, setI] = useState(0);
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  useModal(panel, open, onClose, 'input');
  const [recent, setRecent] = useState<Hit[]>([]);
  const [saved, setSaved] = useState<SavedScreen[]>([]);

  useEffect(() => {
    if (!open) return;
    setQ(''); setI(0);
    setRecent(readJson<Hit[]>('alpha-recent', []).filter((h) => h.href).slice(0, 6));
    setSaved(readJson<SavedScreen[]>('alpha-screen-saved', []).filter((s) => s && typeof s.name === 'string'));
    feed('screen').then((s) => setRows(s.rows), () => undefined);
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    const flip = () => { const next = readPref('theme') === 'dark' ? 'light' : 'dark'; fadeTheme(); setPref('theme', next); };
    const actions: Hit[] = [
      { kind: 'action', id: 'a-theme', label: 'Switch light / dark theme', sub: 'Settings', run: flip },
      { kind: 'action', id: 'a-settings', label: 'Open settings', sub: 'Theme, accent, motion, market colours, density, contrast', run: onSettings },
      { kind: 'action', id: 'a-keys', label: 'Keyboard shortcuts', sub: 'Press ? anywhere', run: onShortcuts },
    ];
    const bySym = new Map(rows.map((r) => [r.sym.toLowerCase(), r]));
    // "compare tcs infy" and "watch tcs": typed actions, resolved against the real company list
    const words = term.split(/[\s,]+/).filter(Boolean);
    if (words[0] === 'compare' && words.length >= 3) {
      const syms = words.slice(1).map((w) => bySym.get(w)?.sym).filter((x): x is string => !!x).slice(0, 4);
      if (syms.length >= 2) actions.unshift({ kind: 'action', id: `a-cmp-${syms.join()}`, label: `Compare ${syms.join(', ')}`, sub: 'Open in Compare', href: `/compare/?s=${syms.map(encodeURIComponent).join(',')}` });
    }
    const pages: Hit[] = PAGES.filter((p) => !term || p.label.toLowerCase().includes(term) || p.desc.toLowerCase().includes(term)).map((p) => ({ kind: 'page', id: `p-${p.href}`, label: p.label, sub: p.desc, href: p.href }));
    const screens: Hit[] = saved.filter((s) => !term || s.name.toLowerCase().includes(term)).map((s) => ({ kind: 'screen', id: `s-${s.name}`, label: s.name, sub: 'Saved screen', href: `/screen/${toQuery({ ...SCREEN_DEFAULT, conds: s.conds ?? [], flags: s.flags ?? [], sector: s.sector ?? '', tier: s.tier ?? '', ask: s.nl?.text ?? '', off: s.nl?.off ?? [] })}` }));
    const acts = actions.filter((a) => !term || a.label.toLowerCase().includes(term) || a.id.startsWith('a-cmp'));
    if (!term) return [...recent.map((h) => ({ ...h, id: `r-${h.id}`, sub: `Recent · ${h.sub}` })), ...pages.slice(0, 8), ...screens.slice(0, 4), ...acts];
    const scored: [number, Row][] = [];
    for (const r of rows) {
      const s = r.sym.toLowerCase(), n = r.name.toLowerCase();
      const sc = s === term ? 0 : s.startsWith(term) ? 1 : n.startsWith(term) ? 2 : n.split(/\s+/).some((w) => w.startsWith(term)) ? 3 : n.includes(term) ? 4 : s.includes(term) ? 5 : 9;
      if (sc < 9) scored.push([sc, r]);
    }
    scored.sort((a, b) => a[0] - b[0] || (b[1].mcap_cr ?? 0) - (a[1].mcap_cr ?? 0));
    const cos: Hit[] = scored.slice(0, 8).map(([, r]) => ({ kind: 'company', id: `c-${r.sym}`, label: r.sym, sub: `${r.name} · ${r.sector}`, href: companyHref(r.sym) }));
    return [...acts.filter((a) => a.id.startsWith('a-cmp')), ...cos, ...pages, ...screens, ...acts.filter((a) => !a.id.startsWith('a-cmp'))];
  }, [q, rows, recent, saved, onSettings, onShortcuts]);

  const go = useCallback((h: Hit | undefined) => {
    if (!h) return;
    onClose();
    if (h.run) { window.setTimeout(h.run, 0); return; }
    if (!h.href) return;
    try { const prev = readJson<Hit[]>('alpha-recent', []); localStorage.setItem('alpha-recent', JSON.stringify([{ ...h, id: h.id.replace(/^r-/, ''), sub: h.sub.replace(/^Recent · /, '') }, ...prev.filter((x) => x.href !== h.href)].slice(0, 8))); } catch { /* not kept */ }
    navigate(router, h.href);
  }, [onClose, router]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(hits.length - 1, n + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setI(0); }
    else if (e.key === 'End') { e.preventDefault(); setI(hits.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); go(hits[i]); }
  };
  useEffect(() => { document.getElementById(`cmdk-${i}`)?.scrollIntoView({ block: 'nearest' }); }, [i]);

  if (!open || typeof document === 'undefined') return null;
  let last = '';
  return createPortal(
    <div className="cmdk-back" onMouseDown={onClose} role="presentation">
      <div ref={panel} className="cmdk" role="dialog" aria-modal="true" aria-label="Search and commands" onMouseDown={(e) => e.stopPropagation()}>
        <input value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={onKey} placeholder="Company, page, saved screen, or “compare tcs infy”" spellCheck={false}
          role="combobox" aria-expanded aria-controls="cmdk-list" aria-autocomplete="list" aria-activedescendant={hits[i] ? `cmdk-${i}` : undefined} aria-label="Search companies, pages and commands" />
        <ul id="cmdk-list" role="listbox" aria-label="Results">
          {hits.length === 0 && <li className="grp" role="presentation">{rows.length || !q.trim() ? 'No match. Try a ticker or a company name.' : 'Loading companies…'}</li>}
          {hits.map((h, n) => {
            const grp = h.id.startsWith('r-') ? 'Recent' : KIND[h.kind];
            const head = grp !== last ? <li key={`g-${grp}`} className="grp" role="presentation">{grp}</li> : null;
            last = grp;
            return [head, (
              <li key={h.id} id={`cmdk-${n}`} role="option" aria-selected={n === i} onMouseEnter={() => setI(n)} onMouseDown={(e) => { e.preventDefault(); go(h); }}>
                <span><b>{h.label}</b> <span className="dim" style={{ fontSize: 13.5 }}>{h.sub}</span></span>
                <span className="tag">{KIND[h.kind].replace(/s$/, '').replace('Companie', 'Company')}</span>
              </li>
            )];
          })}
        </ul>
        <div className="cmdk-foot dim"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span><span>Nothing you type here leaves this browser.</span></div>
      </div>
    </div>,
    document.body,
  );
}

// ── Keyboard shortcuts (Pro §28 P1) ────────────────────────────────────────────────────────────────────────────────
function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useModal(panel, open, onClose);
  const [on, setOn] = useState(true);
  useEffect(() => { if (open) setOn(readPref('shortcuts') === 'on'); }, [open]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="cmdk-back" onMouseDown={onClose} role="presentation">
      <div ref={panel} className="cmdk keys" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onMouseDown={(e) => e.stopPropagation()}>
        <div className="peek-top"><h2 className="peek-h" style={{ margin: 0 }}>Keyboard shortcuts</h2><button type="button" className="chip" data-close onClick={onClose}>Close ✕</button></div>
        <dl className="keys-list">
          <div><dt><kbd>⌘</kbd><kbd>K</kbd> or <kbd>/</kbd></dt><dd>Search companies, pages and commands</dd></div>
          {SHORTCUTS.map((s) => <div key={s.keys}><dt>{s.keys.split(' ').map((k) => <kbd key={k}>{k}</kbd>)}</dt><dd>Go to {s.label}</dd></div>)}
          <div><dt><kbd>?</kbd></dt><dd>This list</dd></div>
        </dl>
        <label className="keys-toggle"><input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); setPref('shortcuts', e.target.checked ? 'on' : 'off'); }} /> Letter shortcuts on (they never fire while you type in a field)</label>
      </div>
    </div>,
    document.body,
  );
}

// ── Settings (theme, accent, motion, market colours, density, shortcuts) ───────────────────────────────────────────
export const ACCENTS = [['violet', 'Violet'], ['cyan', 'Electric cyan'], ['lime', 'Lime'], ['coral', 'Coral']] as const;
const SETTINGS: { name: PrefName; label: string; opts: [string, string][]; note?: string }[] = [
  { name: 'theme', label: 'Theme', opts: [['light', 'Light'], ['dark', 'Dark']] },
  { name: 'accent', label: 'Accent', opts: ACCENTS.map(([k, l]) => [k, l]), note: 'Only the highlight changes.' },
  { name: 'market', label: 'Market colours', opts: [['standard', 'Green / red'], ['cb', 'Blue / orange']], note: 'Up and down always also carry a sign and an arrow.' },
  { name: 'motion', label: 'Motion', opts: [['system', 'As the device'], ['reduced', 'Reduced']] },
  { name: 'density', label: 'Density', opts: [['comfortable', 'Comfortable'], ['compact', 'Compact']] },
  { name: 'contrast', label: 'Contrast', opts: [['system', 'As the device'], ['high', 'High']], note: 'Stronger text, lines and focus rings. No colour carries meaning alone.' },
];
function Settings({ open, onClose, anchor }: { open: boolean; onClose: () => void; anchor: React.RefObject<HTMLButtonElement | null> }) {
  const panel = useRef<HTMLDivElement>(null);
  useModal(panel, open, onClose, '[aria-checked="true"]');
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => { if (open) setVals(Object.fromEntries(Object.keys(PREFS).map((k) => [k, readPref(k as PrefName)]))); }, [open]);
  if (!open || typeof document === 'undefined') return null;
  const r = anchor.current?.getBoundingClientRect();
  const pick = (n: PrefName, v: string) => { if (n === 'theme' || n === 'accent' || n === 'market') fadeTheme(); setPref(n, v); setVals((x) => ({ ...x, [n]: v })); };
  const onKey = (n: PrefName, opts: [string, string][]) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const at = opts.findIndex(([k]) => k === vals[n]);
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (at + 1) % opts.length : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (at - 1 + opts.length) % opts.length : -1;
    if (next < 0) return;
    e.preventDefault(); pick(n, opts[next][0]);
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
  return createPortal(
    <div className="setpop-back" onMouseDown={onClose} role="presentation">
      <div ref={panel} className="setpop" role="dialog" aria-modal="true" aria-label="Settings" onMouseDown={(e) => e.stopPropagation()} style={r ? { top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) } : undefined}>
        <div className="peek-top"><span className="eyebrow">Settings · kept in this browser</span><button type="button" className="chip" data-close onClick={onClose} aria-label="Close settings">✕</button></div>
        {SETTINGS.map((s) => (
          <div key={s.name} className="setrow">
            <div className="setlabel" id={`set-${s.name}`}>{s.label}</div>
            <div className="seg" role="radiogroup" aria-labelledby={`set-${s.name}`} onKeyDown={onKey(s.name, s.opts)}>
              {s.opts.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={vals[s.name] === k} tabIndex={vals[s.name] === k ? 0 : -1} data-sw={s.name === 'accent' ? k : undefined} onClick={() => pick(s.name, k)}>{s.name === 'accent' && <i aria-hidden />}{l}</button>)}
            </div>
            {s.note && <div className="dim setnote">{s.note}</div>}
          </div>
        ))}
        <div className="setrow"><div className="setlabel">Letter shortcuts</div><label className="keys-toggle" style={{ margin: 0 }}><input type="checkbox" checked={vals.shortcuts !== 'off'} onChange={(e) => pick('shortcuts', e.target.checked ? 'on' : 'off')} /> On (press ? for the list)</label></div>
      </div>
    </div>,
    document.body,
  );
}

// ── The phone's More sheet ──────────────────────────────────────────────────────────────────────────────────────────
function MoreSheet({ open, onClose, onSearch, onSettings, path }: { open: boolean; onClose: () => void; onSearch: () => void; onSettings: () => void; path: string }) {
  const startY = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useModal(panel, open, onClose, '.sheet-search');
  if (!mounted) return null;
  return createPortal(
    <div className={`sheet-wrap${open ? ' open' : ''}`} aria-hidden={!open} {...(!open ? ({ inert: "" } as Record<string, string>) : {})}>
      <div className="sheet-back" onClick={onClose} />
      <div ref={panel} className="sheet" role="dialog" aria-modal="true" aria-label="All pages" style={{ transform: open ? `translateY(${dy}px)` : undefined, transition: dy ? 'none' : undefined }}>
        <div className="sheet-grab" onPointerDown={(e) => { startY.current = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (startY.current !== null) setDy(Math.max(0, e.clientY - startY.current)); }}
          onPointerUp={() => { if (dy > 90) onClose(); setDy(0); startY.current = null; }}><i /></div>
        <button className="sheet-search" onClick={() => { onClose(); window.setTimeout(onSearch, 150); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <span>Search companies and pages</span>
        </button>
        {[...AREAS, { id: 'utility' as const, label: 'About alpha', hint: 'How it works and what is kept', home: '/about/' }].map((g) => (
          <div key={g.id}>
            <div className="sheet-h">{g.label} <span>{g.hint}</span></div>
            <div className="sheet-grid">
              {pagesIn(g.id).map((p) => (
                <Link key={p.href} href={p.href} onClick={onClose} aria-current={isActive(path, p.href) ? 'page' : undefined}>
                  <span className="ic"><Icon d={p.icon} /></span>
                  <span>{p.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
        <div className="sheet-foot">
          <button type="button" className="chip" onClick={() => { onClose(); window.setTimeout(onSettings, 150); }}>Settings</button>
          <span className="dim">In Safari: Share → Add to Home Screen for a full-screen app.</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState(false);
  const [settings, setSettings] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [sheet, setSheet] = useState(false);
  const gear = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    initMotion();
    const stopLight = initPointerLight();
    startRum();      // sampled, anonymous field speed of this page load (lib/rum.ts)
    let pending = '', pendingAt = 0;
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || anyModalOpen()) return;
      if (e.key === '/') { e.preventDefault(); setOpen(true); return; }
      if (readPref('shortcuts') === 'off') return;
      if (e.key === '?') { e.preventDefault(); setKeys(true); return; }
      const k = e.key.toLowerCase();
      if (pending && Date.now() - pendingAt < 1200) {
        const hit = SHORTCUTS.find((s) => s.keys === `${pending} ${k}`);
        pending = '';
        if (hit) { e.preventDefault(); navigate(router, hit.href); }
        return;
      }
      if (k === 'g') { pending = 'g'; pendingAt = Date.now(); }
    };
    window.addEventListener('keydown', key);
    const openSearch = () => setOpen(true);   // a page can ask for the palette: window.dispatchEvent(new Event('alpha:search'))
    window.addEventListener('alpha:search', openSearch);
    // scroll progress: one custom property, no layout
    let raf = 0;
    const prog = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      document.documentElement.style.setProperty('--p', h > 0 ? String(Math.min(1, window.scrollY / h)) : '0');
      setShowTop(window.scrollY > 500);
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(prog); };
    window.addEventListener('scroll', onScroll, { passive: true });
    prog();
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('alpha:search', openSearch);
      window.removeEventListener('scroll', onScroll);
      stopLight();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [router]);

  // After a client navigation, focus moves to the new page's heading (Next's route announcer reads its title).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const h = document.querySelector<HTMLElement>('main h1');
    if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }, [path]);

  const navRef = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState<string | null>(null);
  // The ink pill slides to the active area when the page changes (and settles on resize). Reduced motion: it jumps.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const place = () => {
      const a = nav.querySelector<HTMLElement>('.navgroup > a[aria-current="page"]');
      if (!a) { nav.style.setProperty('--po', '0'); return; }
      const g = a.parentElement as HTMLElement;
      nav.style.setProperty('--px', `${g.offsetLeft}px`);
      nav.style.setProperty('--pw', `${g.offsetWidth}px`);      // the whole group, caret included
      nav.style.setProperty('--po', '1');
      nav.classList.add('has-pill');
    };
    place();
    const t = window.setTimeout(place, 150);   // after web fonts settle the widths
    window.addEventListener('resize', place);
    return () => { window.clearTimeout(t); window.removeEventListener('resize', place); };
  }, [path]);
  useEffect(() => { setMenu(null); }, [path]);
  // menus open by click or keyboard (a separate toggle from the area's own link); hover only previews on wide screens
  useEffect(() => {
    if (!menu) return undefined;
    const away = (e: PointerEvent) => { if (!navRef.current?.contains(e.target as Node)) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { const id = menu; setMenu(null); navRef.current?.querySelector<HTMLElement>(`[data-menu="${id}"]`)?.focus(); } };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [menu]);

  const here = areaFor(path);
  const tabs = AREAS.map((a) => ({ ...a, icon: pageOf(a.home)!.icon }));
  const tabIndex = here && here !== 'utility' ? AREAS.findIndex((a) => a.id === here) : 4;
  return (
    <>
      <a href="#main" className="sr">Skip to content</a>
      <div className="progress" aria-hidden />
      <header className="topbar">
        <div className="wrap">
          <Link href="/" className="brand" title="alpha, home">
            <span className="brand-mark" aria-hidden><i /></span>
            <span>alpha</span>
          </Link>
          <nav className="nav" aria-label="Primary" ref={navRef}>
            <span className="ink-pill" aria-hidden />
            {AREAS.map((g) => {
              const on = here === g.id;
              const list = pagesIn(g.id);
              return (
                <div className={`navgroup${menu === g.id ? ' open' : ''}`} key={g.id} onPointerEnter={(e) => { if (e.pointerType === 'mouse' && menu && menu !== g.id) setMenu(g.id); }}>
                  <Link href={g.home} aria-current={on ? 'page' : undefined}>{g.label}</Link>
                  {list.length > 1 && (
                    <button type="button" className="navcaret" data-menu={g.id} aria-expanded={menu === g.id} aria-controls={`menu-${g.id}`} aria-label={`${g.label} pages`} onClick={() => setMenu((m) => (m === g.id ? null : g.id))}>
                      <svg className="caret" width="9" height="9" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                    </button>
                  )}
                  {list.length > 1 && menu === g.id && (
                    <div className="menu" id={`menu-${g.id}`} role="group" aria-label={`${g.label} pages`}>
                      <div className="menu-hint">{g.hint}</div>
                      {list.map((p) => <Link key={p.href} href={p.href} aria-current={isActive(path, p.href) ? 'page' : undefined} onClick={() => setMenu(null)}><span className="ic"><Icon d={p.icon} /></span><span className="mi"><b>{p.label}</b><span>{p.desc}</span></span></Link>)}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="top-actions">
            <MarketClock />
            <button className="iconbtn search-btn" onClick={() => setOpen(true)} aria-keyshortcuts="Meta+K /">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <span className="search-word">Search</span><span className="sr"> companies, pages and commands</span>
              <kbd aria-hidden>⌘K</kbd>
            </button>
            <button ref={gear} className="iconbtn gearbtn" aria-label="Settings: theme, accent, motion, market colours, density, contrast" aria-haspopup="dialog" aria-expanded={settings} onClick={() => setSettings(true)}>
              <Icon size={18} d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
            </button>
          </div>
        </div>
      </header>

      <FreshnessBanner />
      <main id="main" key={path} className="page-in">{children}</main>

      {/* One pill slides to the current area; a utility page lights "More". Reduced motion: it moves without sliding. */}
      <nav className="tabbar" aria-label="Areas" style={{ ['--ti' as string]: tabIndex }}>
        <span className="tab-pill" aria-hidden />
        {tabs.map((p) => (
          <Link key={p.id} href={p.home} aria-current={here === p.id ? 'page' : undefined}>
            <Icon d={p.icon} />
            {p.id === 'desk' ? 'Desk' : p.label}
          </Link>
        ))}
        <button onClick={() => setSheet(true)} aria-label="More: every page, search and settings" aria-haspopup="dialog" data-on={tabIndex === 4 ? '1' : undefined}>
          <Icon d="M4 7h16M4 12h16M4 17h16" />
          More
        </button>
      </nav>

      <footer className="footer">
        <div className="wrap">
          <div className="footer-grid">
            <div>
              <div className="brand" style={{ marginBottom: 12 }}><span className="brand-mark" aria-hidden><i /></span><span>alpha</span></div>
              <p style={{ margin: 0, maxWidth: '34ch' }}>Your daily Indian-equity research desk: what changed, what supports the view, and what still needs checking.</p>
            </div>
            {AREAS.map((a) => <div key={a.id}><h2 className="fh">{a.label}</h2>{pagesIn(a.id).map((p) => <Link key={p.href} href={p.href}>{p.label}</Link>)}</div>)}
            <div><h2 className="fh">Trust</h2>{pagesIn('utility').map((p) => <Link key={p.href} href={p.href}>{p.label}</Link>)}<Link href="/reads/#corrections">Corrections</Link></div>
          </div>
          <p className="footer-legal">
            For information and education only. This is not investment advice, a recommendation or an offer to buy or sell any security. Figures are computed from public filings, exchange and AMFI data and may be delayed or incomplete: always check the source and your own situation before acting. Past performance does not indicate future results. Signals are experimental research on paper; nothing here is a broker fill. The author holds no position in any company shown here (stated 21 Oct 2026); rankings and signals come from the published rules on this site, applied the same way to every company.
          </p>
        </div>
      </footer>
      <button className={`totop${showTop ? ' show' : ''}`} aria-label="Back to top" tabIndex={showTop ? 0 : -1} onClick={() => window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' })}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
      <MoreSheet open={sheet} onClose={() => setSheet(false)} onSearch={() => setOpen(true)} onSettings={() => setSettings(true)} path={path} />
      <Palette open={open} onClose={() => setOpen(false)} onShortcuts={() => setKeys(true)} onSettings={() => setSettings(true)} />
      <ShortcutsDialog open={keys} onClose={() => setKeys(false)} />
      <Settings open={settings} onClose={() => setSettings(false)} anchor={gear} />
    </>
  );
}
