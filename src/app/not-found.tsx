'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CompanyView } from '@/components/CompanyView';
import { slugToSym } from '@/lib/slug';

/** 404. One case is not really missing: /company/<SYM>/ for a company with no pre-built page (an engine pick outside the
 *  build-time screen, or a listing added since the last deploy). That loads the company live from /c/<SYM>.json, which says
 *  plainly if the symbol is not in the screen at all. */
export default function NotFound() {
  const [sym, setSym] = useState<string | null>(null);
  useEffect(() => {
    const m = /^\/company\/([A-Za-z0-9_&%-]{1,40})\/?$/.exec(window.location.pathname);
    if (m) setSym(slugToSym(m[1]));
  }, []);
  if (sym) return <CompanyView sym={sym} />;
  return (
    <div className="wrap page-head">
      <div className="eyebrow"><b>●</b> 404</div>
      <h1 className="disp">Nothing at <em>this address.</em></h1>
      <p className="lede">The page may have moved when Signal, Vision and Gems became one desk. Start from <Link href="/" style={{ color: 'var(--accent-2)', textDecoration: 'underline', textUnderlineOffset: 3 }}>today</Link> or press ⌘K to search companies and pages.</p>
    </div>
  );
}
