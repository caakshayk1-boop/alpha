'use client';
// Tools: choose one task, see one calculator, its result and its working. One tool is open at a time; the choice lives in
// the address (#size, #dcf …), so a link can open a tool directly and the back button returns to the previous one.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Confluence, PortfolioXray } from '@/components/AiTools';
import { PageHead } from '@/components/ui';
import { Cagr, ExpectedValue, Position, Recovery, Sip } from './calc';
import { ReverseDcf } from './dcf';

type Task = { id: string; group: string; q: string; a: string; href?: string };
const TASKS: Task[] = [
  { id: 'size', group: 'Risk', q: 'How many shares does my stop allow?', a: 'Size from capital, risk per trade, entry and stop.' },
  { id: 'ev', group: 'Risk', q: 'Is this plan worth taking on its own numbers?', a: 'Expected value, break-even win rate, the spread over many trades.' },
  { id: 'recovery', group: 'Risk', q: 'How deep is this hole?', a: 'The gain it takes to get back to even after a fall.' },
  { id: 'dcf', group: 'Valuation', q: 'What growth does today’s price assume?', a: 'Reverse DCF, a teaching model.' },
  { id: 'cagr', group: 'Valuation', q: 'What was the annual return?', a: 'The steady yearly rate between two values.' },
  { id: 'sip', group: 'Planning', q: 'What could a monthly SIP become?', a: 'Contributions and step-ups at a return you choose.' },
  { id: 'xray', group: 'Portfolio', q: 'What am I really holding?', a: 'Concentration, sector weight and trend of pasted holdings.' },
  { id: 'confluence', group: 'Research', q: 'Where do several checks agree?', a: 'Companies the screen’s checks point the same way on.' },
  { id: 'compare', group: 'Research', q: 'How do these companies line up?', a: 'Two to four companies in one table.', href: '/compare/' },
];
const isTask = (x: string) => TASKS.some((t) => t.id === x && !t.href);

function Body({ id }: { id: string }) {
  switch (id) {
    case 'size': return <Position />;
    case 'ev': return <ExpectedValue />;
    case 'recovery': return <Recovery />;
    case 'dcf': return <ReverseDcf />;
    case 'cagr': return <Cagr />;
    case 'sip': return <Sip />;
    case 'xray': return <><p className="sp-note tl-lede">Paste holdings to see concentration, sector weight and trend. Calculated in this browser; nothing is uploaded.</p><PortfolioXray /></>;
    default: return <section className="card"><div className="card-h"><h2>Where several checks agree</h2></div><p className="sp-note tl-lede">Companies where several of the screen&apos;s checks point the same way, with the conflicts and missing checks shown. A place to start reading, not a recommendation.</p><Confluence limit={10} /></section>;
  }
}

export default function Tools() {
  const [cur, setCur] = useState('size');
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (isTask(h)) setCur(h); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const pick = (id: string) => { setCur(id); window.history.pushState(null, '', `#${id}`); };
  const task = TASKS.find((t) => t.id === cur) ?? TASKS[0];
  return (
    <div className="sp">
      <PageHead method="tools" eyebrow="Tools" title="Pick a question," em="get the answer with its working." />
      <section className="wrap tl-wrap">
        <nav className="tl-tasks" aria-label="Choose a tool">
          <ul>
            {TASKS.map((t, i) => (
              <li key={t.id}>
                {i === 0 || TASKS[i - 1].group !== t.group ? <span className="tl-g">{t.group}</span> : null}
                {t.href ? <Link className="tl-task" href={t.href}><b>{t.q}</b><span>{t.a} <span aria-hidden>→</span></span></Link>
                  : <button type="button" className="tl-task" aria-current={cur === t.id ? 'true' : undefined} onClick={() => pick(t.id)}><b>{t.q}</b><span>{t.a}</span></button>}
              </li>
            ))}
          </ul>
        </nav>
        <div className="tl-body" id={task.id}>
          <div className="tl-sel"><span className="eyebrow plain">{task.group}</span><label className="sr" htmlFor="tl-pick">Choose a tool</label>
            <select id="tl-pick" className="field tl-pick" value={cur} onChange={(e) => pick(e.target.value)}>{TASKS.filter((t) => !t.href).map((t) => <option key={t.id} value={t.id}>{t.q}</option>)}</select>
          </div>
          <Body id={cur} />
          <p className="sp-note tl-foot">Information and arithmetic only. Not investment, tax or legal advice.</p>
        </div>
      </section>
    </div>
  );
}
