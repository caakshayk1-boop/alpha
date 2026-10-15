'use client';

// Old address (/company/?s=INFY): forwards to the company's own page (/company/INFY/), keeping any tab (#financials).
// With no symbol, it points to the screen and search.
import Link from 'next/link';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Notice } from '@/components/ui';
import { companyHref } from '@/lib/slug';

function Forward() {
  const raw = (useSearchParams().get('s') ?? '').trim();
  const sym = /^[A-Za-z0-9&-]{1,20}$/.test(raw) ? raw : '';   // same rule as the Worker's 301: anything else is not a symbol
  useEffect(() => { if (sym) window.location.replace(`${companyHref(sym)}${window.location.hash}`); }, [sym]);
  return (
    <div className="wrap section">
      <h1 className="sr">Company research</h1>
      {sym
        ? <Notice>Opening <Link href={companyHref(sym)} style={{ color: 'var(--accent-2)' }}>{sym.toUpperCase()}</Link>…</Notice>
        : <Notice>Pick a company from the <Link href="/screen/" style={{ color: 'var(--accent-2)' }}>screen</Link> or press ⌘K to search.</Notice>}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="wrap section"><h1 className="sr">Company research</h1></div>}><Forward /></Suspense>;
}
