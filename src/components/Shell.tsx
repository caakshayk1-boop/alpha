'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { feed } from '@/lib/data';
import { initMotion } from '@/lib/motion';
import type { Row } from '@/lib/types';

export const PAGES = [
  { href: '/', label: 'Today', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { href: '/brief/', label: 'Brief', icon: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5' },
  { href: '/markets/', label: 'Markets', icon: 'M3 17l5-6 4 3 8-9M16 5h4v4' },
  { href: '/screen/', label: 'Screen', icon: 'M4 6h16M7 12h10M10 18h4' },
  { href: '/map/', label: 'Map', icon: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
  { href: '/engines/', label: 'Engines', icon: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18M12 9a3 3 0 100 6 3 3 0 000-6z' },
  { href: '/magic/', label: 'Magic', icon: 'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z' },
  { href: '/reads/', label: 'Reads', icon: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM9 8h6M9 12h6' },
  { href: '/ipo/', label: 'IPO', icon: 'M12 3v18M5 10l7-7 7 7' },
  { href: '/funds/', label: 'Funds', icon: 'M12 3a9 9 0 109 9h-9zM15 3.5A9 9 0 0120.5 9H15z' },
  { href: '/tools/', label: 'Tools', icon: 'M14 6l4 4-9 9H5v-4zM12 8l4 4' },
  { href: '/news/', label: 'News', icon: 'M4 5h13v14H6a2 2 0 01-2-2zM17 9h3v8a2 2 0 01-2 2M8 9h5M8 13h5' },
] as const;

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

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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
    const move = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>('.spot');
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', `${e.clientX - r.left}px`);
      t.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    if (fine) window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('alpha-theme', next); } catch { /* private mode: the theme just will not persist */ }
    setTheme(next);
  };

  const tabs = ['/', '/brief/', '/screen/', '/engines/'].map((h) => PAGES.find((p) => p.href === h)!);
  return (
    <>
      <a href="#main" className="sr">Skip to content</a>
      <header className="topbar">
        <div className="wrap">
          <Link href="/" className="brand" aria-label="alpha, home">
            <span className="brand-mark">α</span>
            <span>alpha</span>
          </Link>
          <nav className="nav" aria-label="Primary">
            {PAGES.map((p) => (
              <Link key={p.href} href={p.href} aria-current={isActive(path, p.href) ? 'page' : undefined}>{p.label}</Link>
            ))}
          </nav>
          <div className="top-actions">
            <button className="iconbtn search-btn" onClick={() => setOpen(true)} aria-label="Search companies and pages">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <button className="iconbtn" onClick={flip} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                {theme === 'dark' ? <path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      <nav className="tabbar" aria-label="Quick navigation">
        {tabs.map((p) => (
          <Link key={p.href} href={p.href} aria-current={isActive(path, p.href) ? 'page' : undefined}>
            <Icon d={p.icon} />
            {p.label}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} aria-label="Search and more pages">
          <Icon d="M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4" />
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
            <div><h4>Markets</h4><Link href="/brief/">Daily brief</Link><Link href="/markets/">Live board</Link><Link href="/map/">Heat lab</Link><Link href="/ipo/">IPOs</Link></div>
            <div><h4>Research</h4><Link href="/screen/">Screen</Link><Link href="/engines/">Engines</Link><Link href="/magic/">Magic Formula</Link><Link href="/reads/">Weekly reads</Link></div>
            <div><h4>Desk</h4><Link href="/tools/">Tools</Link><Link href="/funds/">Funds</Link><Link href="/news/">News</Link><Link href="/about/">Method &amp; sources</Link></div>
          </div>
          <p className="footer-legal">
            For information and education only. This is not investment advice, a recommendation or an offer to buy or sell any security. Figures are computed from public filings, exchange and AMFI data and may be delayed or incomplete: always check the source and your own situation before acting. Past performance does not indicate future results.
          </p>
        </div>
      </footer>
      <Palette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
