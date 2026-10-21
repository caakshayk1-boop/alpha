'use client';
/** A link to a company page whose ticker travels into the company header (lib/nav.ts). A modified click (new tab, etc.)
 *  is left to the browser. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { navigate } from '@/lib/nav';
import { companyHref } from '@/lib/slug';

export function TickerLink({ sym, className, title, children }: { sym: string; className?: string; title?: string; children?: ReactNode }) {
  const router = useRouter();
  const href = companyHref(sym);
  return (
    <Link href={href} className={className} title={title} onClick={(e) => {
      e.stopPropagation();
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      navigate(router, href, (e.currentTarget.querySelector('[data-ticker]') as HTMLElement | null) ?? e.currentTarget);
    }}>{children ?? sym}</Link>
  );
}
