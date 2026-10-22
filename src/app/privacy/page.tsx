/** Privacy and terms (Pro §11): what is kept, where, and what is ever sent. Every statement describes the code as it is;
 *  change this page in the same commit as any change to storage, analytics or what the Worker forwards. */
import Link from 'next/link';
import { PageHead } from '@/components/ui';

const KEPT: [string, string][] = [
  ['Watchlist', 'alpha-watchlist'],
  ['Research cards', 'alpha-cards-v1'],
  ['Journal', 'alpha-journal'],
  ['Saved screens and screen columns', 'alpha-screen-saved, alpha-screen-cols'],
  ['Results you opened from search (not what you typed)', 'alpha-recent'],
  ['Settings (theme, accent, motion, market colours, density, contrast, shortcuts)', 'alpha-theme, alpha-accent, alpha-motion, alpha-market, alpha-density, alpha-contrast, alpha-shortcuts'],
  ['Holdings you enter in the X-ray tool', 'alpha-xray'],
  ['News: saved stories, read stories, last visit', 'alpha-news-saved, alpha-news-seen, alpha-news-visit'],
  ['When you last exported', 'alpha-last-export'],
  ['Pages you opened and the site\'s code files, so pages you have seen open offline (browser cache storage; never data or prices)', 'alpha-shell-v1, alpha-assets-v1'],
  ['Page layout on Company and Compare (Quick look or Deep dive)', 'alpha-company-layout, alpha-compare-layout'],
  ['Your data conditions on My Desk', 'alpha-conditions'],
  ['The list you opened a company from, for its back link (this tab only, cleared when the tab closes)', 'alpha-from'],
];

export default function Privacy() {
  return (
    <>
      <PageHead eyebrow="Privacy and terms" title="What alpha keeps," em="and what it sends." />
      <section className="wrap prose-col">
        <h2>There is no account</h2>
        <p>alpha has no sign-in and no user database. Everything personal you do here is kept in <b>this browser only</b>, in its local storage, and never uploaded. Clearing this site&rsquo;s data in your browser deletes it. Export a copy from <Link href="/watchlist/#cards">Watchlist</Link> or <Link href="/journal/">Journal</Link> to keep it.</p>
        <table className="tbl tbl-text" style={{ margin: '12px 0 20px', tableLayout: 'fixed', width: '100%', minWidth: 0 }}>
          <thead><tr><th scope="col">What</th><th scope="col">Where in this browser</th></tr></thead>
          <tbody>{KEPT.map(([w, k]) => <tr key={k}><td>{w}</td><td className="dim" style={{ fontFamily: 'var(--f-mono)', fontSize: 13, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{k}</td></tr>)}</tbody>
        </table>

        <h2>What is sent, and to whom</h2>
        <ul>
          <li><b>Pages and data.</b> Your browser loads pages and data files from alpha.askakshay.com, served by Cloudflare. Like any web server, Cloudflare sees your IP address and the address requested.</li>
          <li><b>Live prices.</b> When a page shows live prices, alpha&rsquo;s server asks Yahoo Finance for the ticker symbols on that page. Yahoo receives the symbols from alpha&rsquo;s server, not your browser, and nothing about you.</li>
          <li><b>Ask (AI), when it is switched on.</b> The question you type and the facts alpha built for it are sent to Anthropic&rsquo;s API to write an answer. alpha does not store or log the question. Requests are rate-limited per address; the address is used for that count only.</li>
          <li><b>Search box.</b> What you type in search (<kbd className="kbd">/</kbd> or <kbd className="kbd">⌘K</kbd>) never leaves your browser.</li>
          <li><b>Page speed, sampled.</b> About one page load in four sends a single speed reading when you leave the page: which kind of page it was (for example &ldquo;a company page&rdquo;, never which company), phone or desktop, and four load and responsiveness timings. No address, cookie, identifier or browser details are stored, only running totals, kept for eight days and published on the <Link href="/about/#speed">About page</Link>. It is not sent when your browser asks sites not to track you (Do Not Track or Global Privacy Control).</li>
          <li><b>Visit counts.</b> If Cloudflare Web Analytics is enabled for the domain, it counts page views without cookies. No research, watchlist, journal or question text is ever included in analytics.</li>
        </ul>

        <h2>Terms</h2>
        <p>alpha is for information and education only. It is not investment advice, a recommendation, a research report under any regulation, or an offer to buy or sell a security. Signals are experimental research on paper; a paper trade is never a broker fill. Figures can be delayed, incomplete or wrong: check the source before acting. Past results do not indicate future results.</p>
        <p>Data comes from public company filings, exchanges and AMFI, through the providers named on the <Link href="/about/">Method</Link> page, and belongs to its owners. Machine-written studies carry a review status; problems found after publication are listed in the <Link href="/reads/#corrections">corrections log</Link> and the text is never silently changed.</p>

        <h2>Contact</h2>
        <p className="dim">A contact address for corrections and data requests has not been published yet.</p>
      </section>
    </>
  );
}
