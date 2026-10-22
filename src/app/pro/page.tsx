'use client';
/** /pro/: the Alpha Pro waitlist (Lane A Phase 0). The copy is the owner's approved text, verbatim. The form is honest about
 *  its state: while the server's mail is not configured it says the waitlist is not open and sends nothing; a success message
 *  only ever repeats what the server answered. Nothing here gates, prices or sells anything. */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { WaitlistForm } from '@/components/WaitlistForm';

const DONE: Record<string, string> = {
  confirmed: 'Confirmed. Your place on the waitlist is held. You will get one email when Pro opens.',
  unsubscribed: 'Done. Your address has been deleted from the waitlist.',
  invalid: 'That link is no longer valid. If you joined again later, use the newest email.',
};

export default function Pro() {
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => { const w = new URLSearchParams(window.location.search).get('waitlist'); if (w && DONE[w]) setDone(DONE[w]); }, []);
  return (
    <article className="wrap pro">
      <header className="pro-head">
        <div className="eyebrow">Alpha Pro</div>
        <h1>Alpha Pro — coming soon</h1>
        <p className="pro-lede">Free Alpha gives you the insight: the screens, the evidence, the methods beside the numbers. Pro will sell you the one thing a free screener can&apos;t — <b>time</b>.</p>
      </header>
      {done && <p className="notice" role="status">{done}</p>}
      <div className="pro-grid">
        <section className="card" aria-labelledby="inc-h">
          <h2 id="inc-h" className="sec-title">What Pro will include</h2>
          <ul className="pro-list">
            <li><b>Same-session data.</b> Free Alpha runs one session behind. Pro won&apos;t wait.</li>
            <li><b>Change alerts.</b> Your watchlist, your saved screens, results dates — get told when something moves, not when you remember to check.</li>
            <li><b>Full history + exports.</b> Every screen result and record, downloadable as CSV. Your research, portable.</li>
            <li><b>Research memos.</b> One click turns a company page into a sourced PDF memo — snapshot date, limitations and sources on the cover.</li>
            <li><b>Room to work.</b> Five watchlists, a change inbox that shows what moved since you saved a research question.</li>
          </ul>
        </section>
        <section className="card" aria-labelledby="never-h">
          <h2 id="never-h" className="sec-title">What Pro will never include</h2>
          <p className="pro-never">Buy/sell calls, tips, or &ldquo;pro picks.&rdquo; Signals stay free, on paper, and labelled experimental — exactly as they are now. Pro is better tools, not advice.</p>
        </section>
      </div>
      <section className="card pro-join" aria-labelledby="join-h">
        <h2 id="join-h" className="sec-title">Join the waitlist.</h2>
        <p className="sec-sub">Founding members get launch pricing first and a say in what gets built. One email when it opens. Nothing else, ever.</p>
        <WaitlistForm source="pro" />
        <p className="dim pro-fine">We store your email, when and where you joined, and nothing else; never sold, deleted the moment you unsubscribe. <Link className="link" href="/privacy/#waitlist">Privacy</Link>. Alpha is information and education only, not investment advice.</p>
      </section>
    </article>
  );
}
