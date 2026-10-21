'use client';
/** A link to a company page whose ticker travels into the company header (lib/nav.ts). A modified click (new tab, etc.)
 *  is left to the browser. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { navigate } from '@/lib/nav';
import { companyHref } from '@/lib/slug';
import { pageFor } from '@/lib/routes';
import { useEffect, useState } from 'react';

export function TickerLink({ sym, className, title, children }: { sym: string; className?: string; title?: string; children?: ReactNode }) {
  const router = useRouter();
  const href = companyHref(sym);
  return (
    <Link href={href} className={className} title={title} onClick={(e) => {
      e.stopPropagation();
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      // remember where the reader came from, so the company page's back link returns to the same filtered list
      try { sessionStorage.setItem('alpha-from', JSON.stringify({ href: location.pathname + location.search, label: pageFor(location.pathname)?.label ?? 'Back' })); } catch { /* none */ }
      navigate(router, href, (e.currentTarget.querySelector('[data-ticker]') as HTMLElement | null) ?? e.currentTarget);
    }}>{children ?? sym}</Link>
  );
}

/** "← Back to Screen" on a company page: back to the list (with its filters) the reader came from. Browser Back restores
 *  scroll too, so it is used when the previous entry is that list; otherwise the link goes to the list's address. */
export function BackToContext() {
  const router = useRouter();
  const [from, setFrom] = useState<{ href: string; label: string } | null>(null);
  useEffect(() => { try { const v = JSON.parse(sessionStorage.getItem('alpha-from') ?? 'null'); if (v && typeof v.href === 'string' && v.href.startsWith('/') && !v.href.startsWith('//')) setFrom(v); } catch { /* none */ } }, []);
  const href = from?.href ?? '/screen/';
  return (
    <Link href={href} style={{ color: 'var(--accent-2)', textDecoration: 'underline', textUnderlineOffset: 3 }} onClick={(e) => { if (from && window.history.length > 1) { e.preventDefault(); router.back(); } }}>
      ← {from ? `Back to ${from.label}` : 'Screen'}
    </Link>
  );
}
