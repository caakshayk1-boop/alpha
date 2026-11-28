'use client';
/** The askakshay family on Today (28 Nov 2026): four ruled cells, one per product, each with what it is and how current its own
 *  data is. The names, words and links are in the first paint; only the data line waits for /api/family, and says "Checking" until
 *  then, never a state it has not read. Nothing moves. */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FAMILY, familyLine, type FamilyFeed } from '@/lib/family';

export function Family() {
  const [feed, setFeed] = useState<FamilyFeed | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let live = true;
    setNow(new Date());
    fetch('/api/family', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: FamilyFeed) => { if (live) { if (j?.ok && Array.isArray(j.products)) setFeed(j); else setFailed(true); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  return (
    <section className="wrap fam" aria-labelledby="fam-h">
      <h2 id="fam-h" className="fam-h">The askakshay family <span className="fam-sub">Four tools, one method: published rules, a source on every figure, no buy or sell calls.</span></h2>
      <ul className="fam-grid">
        {FAMILY.map((m) => {
          const here = m.id === 'alpha';
          const line = failed ? { state: 'unavailable' as const, text: 'Data date could not be read just now', detail: '' } : familyLine(feed?.products.find((p) => p.id === m.id), now ?? new Date(0));
          const shown = feed || failed ? line : { state: 'checking' as const, text: 'Checking its data date', detail: '' };
          return (
            <li key={m.id} className={`fam-cell${here ? ' is-here' : ''}`}>
              <p className="fam-name"><b>{m.name}</b><span className="fam-host">{m.host}</span></p>
              <p className="fam-what">{m.what}</p>
              <p className="fam-data" data-state={shown.state}><span className="fam-dot" aria-hidden />{shown.text}</p>
              {shown.detail && <p className="fam-detail">{shown.detail}</p>}
              {here
                ? <p className="fam-go">You are here</p>
                : <a className="fam-go" href={m.href}>Open {m.name}<span aria-hidden> ↗</span></a>}
            </li>
          );
        })}
      </ul>
      <p className="fam-foot"><Link className="link" href="/status/">How &ldquo;current&rdquo; is decided</Link></p>
    </section>
  );
}
