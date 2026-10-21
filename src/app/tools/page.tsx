'use client';

import Link from 'next/link';
import { Confluence, PortfolioXray, ReverseDcf } from '@/components/AiTools';
import { PageHead, Rv, SectionHead } from '@/components/ui';
import { Cagr, ExpectedValue, Position, Recovery, Sip } from './calc';

/** The decision board: each card is one question a tool answers, in one line, with one action. */
const BOARD: { id: string; n: string; q: string; a: string; go: string; href?: string }[] = [
  { id: 'size', n: '01', q: 'How many shares does my stop allow?', a: 'Size from capital, risk per trade, entry and stop.', go: 'Size a position' },
  { id: 'ev', n: '02', q: 'Is this plan worth taking, on its own numbers?', a: 'Expected value, break-even win rate and the spread over many trades.', go: 'Test a plan' },
  { id: 'xray', n: '03', q: 'What am I really holding?', a: 'Concentration, sector weight, trend and quality of pasted holdings.', go: 'X-ray holdings' },
  { id: 'dcf', n: '04', q: 'What growth does today’s price assume?', a: 'Reverse DCF: solve for the earnings growth a price needs.', go: 'Solve for growth' },
  { id: 'cagr', n: '05', q: 'What was the annual return?', a: 'The steady yearly rate between a start and an end value.', go: 'Work out a rate' },
  { id: 'recovery', n: '06', q: 'How deep is this hole?', a: 'The gain it takes to get back to even after a fall.', go: 'Measure a fall' },
  { id: 'sip', n: '07', q: 'What could a monthly SIP become?', a: 'Contributions and step-ups at a return you choose, with a band.', go: 'Project a SIP' },
  { id: 'compare', n: '08', q: 'How do these companies line up?', a: 'Two to four companies, every number in one table.', go: 'Compare companies', href: '/compare/' },
];

const NAV: [string, string][] = [['risk', 'Risk'], ['portfolio', 'Portfolio'], ['valuation', 'Valuation'], ['planning', 'Planning'], ['evidence', 'Evidence']];

export default function Tools() {
  return (
    <>
      <PageHead method="tools" eyebrow="Tools" title="Think a decision through," em="with the working shown." />
      <section className="wrap">
        <ol className="board" aria-label="What each tool answers">
          {BOARD.map((b) => (
            <li key={b.id}>
              <Rv className="board-card">
                <span className="board-n" aria-hidden>{b.n}</span>
                <h2 className="board-q">{b.q}</h2>
                <p className="board-a">{b.a}</p>
                {b.href ? <Link className="board-go" href={b.href}>{b.go} <span aria-hidden>→</span></Link> : <a className="board-go" href={`#${b.id}`}>{b.go} <span aria-hidden>↓</span></a>}
              </Rv>
            </li>
          ))}
        </ol>

        <nav aria-label="Tool groups" className="toolnav">
          {NAV.map(([id, label]) => <a key={id} className="chip" href={`#${id}`}>{label}</a>)}
        </nav>

        <div className="toolsec" id="risk">
          <SectionHead eyebrow="Risk" title="Size it, then test it" />
          <div className="toolstack">
            <div id="size" className="anchor"><Position /></div>
            <div id="ev" className="anchor"><ExpectedValue /></div>
            <div id="recovery" className="anchor"><Recovery /></div>
          </div>
        </div>

        <div className="toolsec" id="portfolio">
          <SectionHead eyebrow="Portfolio" title="Look at what you hold" />
          <p className="toolsec-l">Paste holdings to see concentration, sector weight and trend. Calculated in this browser; nothing is uploaded.</p>
          <div id="xray" className="anchor"><PortfolioXray /></div>
        </div>

        <div className="toolsec" id="valuation">
          <SectionHead eyebrow="Valuation" title="What a price assumes" />
          <p className="toolsec-l">Work backwards from a price to the growth it implies, and measure what a return really was.</p>
          <div className="toolstack">
            <div id="dcf" className="anchor"><ReverseDcf /></div>
            <div id="cagr" className="anchor"><Cagr /></div>
          </div>
        </div>

        <div className="toolsec" id="planning">
          <SectionHead eyebrow="Planning" title="Plan contributions" />
          <div id="sip" className="anchor"><Sip /></div>
        </div>

        <div className="toolsec" id="evidence">
          <SectionHead eyebrow="Research" title="Evidence across checks" />
          <p className="toolsec-l">Companies where several of the screen&apos;s checks point the same way, with the conflicts and missing checks shown.</p>
          <Rv className="panel"><Confluence limit={10} /></Rv>
        </div>
        <p className="dim" style={{ fontSize: 13.5, marginTop: 18 }}>Information and arithmetic only. Not investment, tax or legal advice.</p>
      </section>
    </>
  );
}
