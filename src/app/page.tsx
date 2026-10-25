'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { TodayProvider } from '@/components/widgets/DayContext';
import { TodayProgress } from '@/components/today/Progress';
import { ComingUp, EvidenceOnNames, Masthead, MarketRead, MarketStrip, Previews, WorthInvestigating, YourNames } from '@/components/today/Today';

/** Today: what matters right now, in about a minute. The detail lives on the pages each block links to (brief §3: one
 *  canonical view per dataset; Today shows previews). */
export default function Home() {
  // the retired since-your-last-visit panel left a snapshot in browsers that saw it; Privacy no longer lists the key, so it goes
  useEffect(() => { try { localStorage.removeItem('alpha-last-visit'); } catch { /* storage blocked */ } }, []);
  return (
    <TodayProvider>
      <Masthead />
      <section className="wrap grid-lead today-lead">
        <div className="today-main"><MarketRead /><TodayProgress /></div>
        <div className="today-side"><YourNames /><EvidenceOnNames /><ComingUp /></div>
      </section>
      <div className="section2"><MarketStrip /></div>
      <WorthInvestigating />
      <section className="wrap section2" aria-label="Signals and rotation"><Previews /></section>
      <section className="wrap section2" aria-label="Alpha Pro">
        <div className="card tight pro-strip">
          <p><b>Alpha Pro is coming.</b> <span className="muted">Same-session data, change alerts, exports and research memos. Better tools, never buy or sell calls.</span></p>
          <Link className="act" href="/pro/">Join the waitlist</Link>
        </div>
      </section>
    </TodayProvider>
  );
}
