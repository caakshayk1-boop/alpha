'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { feed } from '@/lib/data';
import { initMotion, prefersReduced } from '@/lib/motion';
import type { Row } from '@/lib/types';

export const PAGES = [
  { href: '/', label: 'Today', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { href: '/brief/', label: 'Brief', icon: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5' },
  { href: '/markets/', label: 'Markets', icon: 'M3 17l5-6 4 3 8-9M16 5h4v4' },
  { href: '/screen/', label: 'Screen', icon: 'M4 6h16M7 12h10M10 18h4' },
  { href: '/map/', label: 'Map', icon: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
  { href: '/rotation/', label: 'Rotation', icon: 'M20 12a8 8 0 11-3-6.2M20 4v5h-5' },
  { href: '/engines/', label: 'Engines', icon: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18M12 9a3 3 0 100 6 3 3 0 000-6z' },
  { href: '/magic/', label: 'Magic', icon: 'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z' },
  { href: '/reads/', label: 'Reads', icon: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM9 8h6M9 12h6' },
  { href: '/ipo/', label: 'IPO', icon: 'M12 3v18M5 10l7-7 7 7' },
  { href: '/funds/', label: 'Funds', icon: 'M12 3a9 9 0 109 9h-9zM15 3.5A9 9 0 0120.5 9H15z' },
  { href: '/tools/', label: 'Tools', icon: 'M14 6l4 4-9 9H5v-4zM12 8l4 4' },
  { href: '/news/', label: 'News', icon: 'M4 5h13v14H6a2 2 0 01-2-2zM17 9h3v8a2 2 0 01-2 2M8 9h5M8 13h5' },
  { href: '/compare/', label: 'Compare', icon: 'M7 4v16M17 4v16M3 8h8M13 16h8' },
  { href: '/calendar/', label: 'Calendar', icon: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4' },
  { href: '/watchlist/', label: 'Watchlist', icon: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' },
  { href: '/about/', label: 'Method', icon: 'M12 4a8 8 0 100 16 8 8 0 000-16zM12 11v5M12 8h.01' },
] as const;

/** The five jobs people come to do. Every page stays one step away; the header shows five groups instead of seventeen links. */
export const GROUPS: { label: string; hint: string; hrefs: string[] }[] = [
  { label: 'Today', hint: 'What is happening now', hrefs: ['/', '/brief/', '/markets/'] },
  { label: 'Discover', hint: 'Find companies and patterns', hrefs: ['/screen/', '/map/', '/rotation/', '/ipo/', '/funds/', '/news/', '/reads/'] },
  { label: 'Analyze', hint: 'Inspect and compare evidence', hrefs: ['/engines/', '/magic/', '/compare/', '/tools/'] },
  { label: 'Track', hint: 'Keep a few names in view', hrefs: ['/watchlist/', '/calendar/'] },
  { label: 'Methods', hint: 'How every number is made', hrefs: ['/about/'] },
];
const pageOf = (h: string) => PAGES.find((p) => p.href === h)!;

const Icon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const norm = (p: string) => (p.endsWith('/') ? p : `${p}/`);
const isActive = (path: string, href: string) => (href === '/' ? path === '/' : norm(path).startsWith(href));

type Hit = { kind: 'page' | 'company'; label: string; sub: string; href: string };

function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [i, setI] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setI(0);
    window.setTimeout(() => input.current?.focus(), 10);
    feed('screen').then((s) => setRows(s.rows), () => undefined);
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    const pages: Hit[] = PAGES.filter((p) => !term || p.label.toLowerCase().includes(term)).map((p) => ({ kind: 'page', label: p.label, sub: 'Go to', href: p.href }));
    if (!term) return pages;
    const scored: [number, Row][] = [];
    for (const r of rows) {
      const s = r.sym.toLowerCase();
      const n = r.name.toLowerCase();
      const sc = s === term ? 0 : s.startsWith(term) ? 1 : n.startsWith(term) ? 2 : n.includes(term) ? 3 : s.includes(term) ? 4 : 9;
      if (sc < 9) scored.push([sc, r]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].sym.length - b[1].sym.length);
    const cos: Hit[] = scored.slice(0, 10).map(([, r]) => ({ kind: 'company', label: r.sym, sub: `${r.name} · ${r.sector}`, href: `/company/?s=${encodeURIComponent(r.sym)}` }));
    return [...cos, ...pages];
  }, [q, rows]);

  const go = useCallback(
    (h: Hit | undefined) => {
      if (!h) return;
      onClose();
      router.push(h.href);
    },
    [onClose, router],
  );

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(hits.length - 1, n + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
      else if (e.key === 'Enter') go(hits[i]);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, hits, i, go, onClose]);

  if (!open) return null;
  return (
    <div className="cmdk-back" onMouseDown={onClose} role="presentation">
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder="Search companies or jump to a page" aria-label="Search" spellCheck={false} />
        <ul role="listbox">
          {hits.length === 0 && <li className="grp">{rows.length ? 'No match' : 'Loading companies…'}</li>}
          {hits.map((h, n) => (
            <li key={`${h.kind}-${h.href}`} role="option" aria-selected={n === i}>
              <button onMouseEnter={() => setI(n)} onClick={() => go(h)}>
                <span><b>{h.label}</b> <span className="dim" style={{ fontSize: 12.5 }}>{h.sub}</span></span>
                <span className="tag">{h.kind === 'page' ? 'Page' : 'Company'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MoreSheet({ open, onClose, onSearch, path }: { open: boolean; onClose: () => void; onSearch: () => void; path: string }) {
  const startY = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.documentElement.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.documentElement.style.overflow = ''; };
  }, [open, onClose]);
  return (
    <div className={`sheet-wrap${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="sheet-back" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Menu" style={{ transform: open ? `translateY(${dy}px)` : undefined, transition: dy ? 'none' : undefined }}>
        <div className="sheet-grab" onPointerDown={(e) => { startY.current = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (startY.current !== null) setDy(Math.max(0, e.clientY - startY.current)); }}
          onPointerUp={() => { if (dy > 90) onClose(); setDy(0); startY.current = null; }}><i /></div>
        <button className="sheet-search" onClick={() => { onClose(); window.setTimeout(onSearch, 150); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <span>Search companies and pages</span>
        </button>
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div className="sheet-h">{g.label} <span>{g.hint}</span></div>
            <div className="sheet-grid">
              {g.hrefs.map((h) => (
                <Link key={h} href={h} onClick={onClose} aria-current={isActive(path, h) ? 'page' : undefined}>
                  <span className="ic"><Icon d={pageOf(h).icon} /></span>
                  <span>{pageOf(h).label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
        <div className="sheet-foot">
          <span className="dim">Tip: in Safari, Share → Add to Home Screen for a full-screen app.</span>
        </div>
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showTop, setShowTop] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    initMotion();
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', key);
    // pointer-follow light on .spot panels (fine pointers only)
    const fine = window.matchMedia('(pointer: fine)').matches;
    let hot: HTMLElement | null = null;
    const move = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      const t = el?.closest<HTMLElement>('.spot');
      if (t) {
        const r = t.getBoundingClientRect();
        t.style.setProperty('--mx', `${e.clientX - r.left}px`);
        t.style.setProperty('--my', `${e.clientY - r.top}px`);
        if (t.classList.contains('tilt') && document.documentElement.classList.contains('anim')) {
          t.classList.add('is-tilting');
          t.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 5}deg`);
          t.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 5}deg`);
          hot = t;
        }
      }
      if (hot && hot !== t) { hot.classList.remove('is-tilting'); hot.style.removeProperty('--rx'); hot.style.removeProperty('--ry'); hot = null; }
      const b = el?.closest<HTMLElement>('.btn');
      if (b && document.documentElement.classList.contains('anim')) {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--tx', `${(e.clientX - r.left - r.width / 2) * 0.12}px`);
        b.style.setProperty('--ty', `${(e.clientY - r.top - r.height / 2) * 0.18}px`);
      }
    };
    const leave = (e: PointerEvent) => {
      const b = (e.target as HTMLElement | null)?.closest<HTMLElement>('.btn');
      if (b) { b.style.removeProperty('--tx'); b.style.removeProperty('--ty'); }
    };
    if (fine) { window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('pointerout', leave, { passive: true }); }
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
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerout', leave);
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('alpha-theme', next); } catch { /* private mode: the theme just will not persist */ }
    setTheme(next);
  };

  const navRef = useRef<HTMLElement>(null);
  const glide = useCallback((target?: HTMLElement | null) => {
    const nav = navRef.current;
    if (!nav) return;
    const el = target ?? nav.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!el) { nav.style.setProperty('--o', '0'); return; }
    nav.style.setProperty('--x', `${el.offsetLeft}px`);
    nav.style.setProperty('--w', `${el.offsetWidth}px`);
    nav.style.setProperty('--o', '1');
  }, []);
  // A menu opens on hover or focus, so after choosing a page it would stay open under the pointer: close it on navigation and on Escape, and let it open again once the pointer has left.
  const closeMenus = useCallback(() => {
    const nav = navRef.current; if (!nav) return;
    nav.dataset.closed = '1';                                   // set first, so moving focus to the trigger does not reopen it
    const a = document.activeElement as HTMLElement | null;
    const trigger = a?.closest('.navgroup')?.querySelector<HTMLElement>(':scope > a');
    if (a && trigger && a !== trigger) trigger.focus();         // keep the keyboard user's place instead of dropping focus to the page
  }, []);
  const lastEscape = useRef(false);
  const lastPath = useRef(path);
  useEffect(() => { if (lastPath.current !== path) { lastPath.current = path; closeMenus(); } }, [path, closeMenus]);
  useEffect(() => { glide(); const r = () => glide(); window.addEventListener('resize', r); const t = window.setTimeout(r, 120); return () => { window.removeEventListener('resize', r); window.clearTimeout(t); }; }, [path, glide]);

  const tabs = ['/', '/brief/', '/screen/', '/engines/'].map((h) => PAGES.find((p) => p.href === h)!);
  return (
    <>
      <a href="#main" className="sr">Skip to content</a>
      <div className="aurora" aria-hidden><i /><i /><i /></div>
      <div className="progress" aria-hidden />
      <header className="topbar">
        <div className="wrap">
          <Link href="/" className="brand" title="alpha, home">
            <span className="brand-mark">α</span>
            <span>alpha</span>
          </Link>
          <nav className="nav" aria-label="Primary" ref={navRef} onPointerLeave={() => { glide(); delete navRef.current?.dataset.closed; }} onFocus={(e) => { if (!(e.target as HTMLElement).closest('.menu') && !(e.target as HTMLElement).matches('.navgroup > a')) return; if (!lastEscape.current) delete navRef.current?.dataset.closed; lastEscape.current = false; }} onKeyDown={(e) => { if (e.key === 'Escape') { lastEscape.current = true; closeMenus(); window.setTimeout(() => { lastEscape.current = false; }, 0); } }}>
            <span className="glide" aria-hidden />
            {GROUPS.map((g) => {
              const on = g.hrefs.some((h) => isActive(path, h));
              return (
                <div className="navgroup" key={g.label}>
                  <Link href={g.hrefs[0]} aria-current={on ? 'page' : undefined} onPointerEnter={(e) => glide(e.currentTarget)} onFocus={(e) => glide(e.currentTarget)}>{g.label}{g.hrefs.length > 1 && <svg className="caret" width="9" height="9" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}</Link>
                  {g.hrefs.length > 1 && (
                    <div className="menu" role="group" aria-label={`${g.label} pages`}>
                      <div className="menu-hint">{g.hint}</div>
                      {g.hrefs.map((h) => <Link key={h} href={h} aria-current={isActive(path, h) ? 'page' : undefined}><span className="ic"><Icon d={pageOf(h).icon} /></span>{pageOf(h).label}</Link>)}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="top-actions">
            <button className="iconbtn search-btn" onClick={() => setOpen(true)} aria-label="Search ⌘K: companies and pages">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <button className="themeswitch" role="switch" aria-checked={theme === 'light'} onClick={flip} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              <svg className="s1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              <svg className="s2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" /></svg>
              <span className="knob" aria-hidden>
                {theme === 'dark'
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" /></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="12" r="5" /></svg>}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main id="main" key={path} className="page-in">{children}</main>

      <nav className="tabbar" aria-label="Quick navigation">
        {tabs.map((p) => (
          <Link key={p.href} href={p.href} aria-current={isActive(path, p.href) ? 'page' : undefined}>
            <Icon d={p.icon} />
            {p.label}
          </Link>
        ))}
        <button onClick={() => setSheet(true)} aria-label="More: all pages and search" aria-haspopup="dialog">
          <Icon d="M4 7h16M4 12h16M4 17h16" />
          More
        </button>
      </nav>

      <footer className="footer">
        <div className="wrap">
          <div className="footer-grid">
            <div>
              <div className="brand" style={{ marginBottom: 12 }}><span className="brand-mark">α</span><span>alpha</span></div>
              <p style={{ margin: 0, maxWidth: '34ch' }}>An independent research desk for Indian equities. Numbers first, working shown.</p>
            </div>
            <div><h2 className="fh">Markets</h2><Link href="/brief/">Daily brief</Link><Link href="/markets/">Live board</Link><Link href="/map/">Heat lab</Link><Link href="/ipo/">IPOs</Link></div>
            <div><h2 className="fh">Research</h2><Link href="/screen/">Screen</Link><Link href="/engines/">Engines</Link><Link href="/magic/">Magic Formula</Link><Link href="/reads/">Weekly reads</Link></div>
            <div><h2 className="fh">Desk</h2><Link href="/tools/">Tools</Link><Link href="/funds/">Funds</Link><Link href="/news/">News</Link><Link href="/about/">Method &amp; sources</Link></div>
          </div>
          <p className="footer-legal">
            For information and education only. This is not investment advice, a recommendation or an offer to buy or sell any security. Figures are computed from public filings, exchange and AMFI data and may be delayed or incomplete: always check the source and your own situation before acting. Past performance does not indicate future results.
          </p>
        </div>
      </footer>
      <button className={`totop${showTop ? ' show' : ''}`} aria-label="Back to top" tabIndex={showTop ? 0 : -1} onClick={() => window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' })}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
      <MoreSheet open={sheet} onClose={() => setSheet(false)} onSearch={() => setOpen(true)} path={path} />
      <Palette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
