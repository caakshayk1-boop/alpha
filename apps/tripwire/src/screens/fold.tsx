import type { ReactNode } from 'react';

/** A section that leads with one plain line and keeps its detail one tap away. The detail is never removed: it is the same content that used to be always open, in a native <details> (keyboard, find-in-page and
 *  screen readers all work, and the summary row is a 44px target). `open` is for the few disclosures that must be read without a tap (the trust statements). */
export function Fold({ id, title, summary, aside, open, children }: { id: string; title: string; summary?: ReactNode; aside?: ReactNode; open?: boolean; children: ReactNode }) {
  return <details className="fold" data-fold={id} open={open}>
    <summary><span className="fold-main"><h2 className="fold-t">{title}</h2>{summary ? <span className="fold-s">{summary}</span> : null}</span>{aside}<span className="chev" aria-hidden="true">▾</span></summary>
    <div className="fold-body">{children}</div>
  </details>;
}

/** The research workflow in five steps, the same words on Help and My Desk. A step is a place to go, not a promise of an outcome; nothing here advises, and every position is paper. */
export const WORKFLOW: { n: number; title: string; line: string; href: string; cta: string }[] = [
  { n: 1, title: 'Understand', line: 'Read a company\'s page: its price and the time of that price, what changed, and what the screen measured.', href: '#/discover', cta: 'Find a company' },
  { n: 2, title: 'Check evidence and risks', line: 'Read the case for and against, and the flags raised. A name with no flags is not a name with no risks.', href: '#/methodology', cta: 'How flags are counted' },
  { n: 3, title: 'Compare', line: 'Put two or three names side by side, with the date windows aligned and the gaps stated.', href: '#/compare', cta: 'Compare names' },
  { n: 4, title: 'Write a thesis', line: 'Say why, what would prove you wrong, and when to look again. Each edit keeps the earlier version.', href: '#/desk?v=journal', cta: 'Your journal' },
  { n: 5, title: 'Track', line: 'Follow the name; Today reports what changed. Size a paper plan to see the modelled loss at your assumed stop. Nothing is ordered.', href: '#/desk?v=plans', cta: 'Paper plans' },
];
export function Workflow({ compact, heading = 'The research workflow' }: { compact?: boolean; heading?: string }) {
  return <section className={`wf${compact ? ' compact' : ''}`} aria-labelledby="wf-h" data-workflow>
    <h2 id="wf-h" className="wf-h">{heading}</h2>
    <ol className="wf-list">{WORKFLOW.map((x) => <li key={x.n} className="wf-step"><span className="wf-n num" aria-hidden="true">{x.n}</span><span className="wf-b"><b>{x.title}</b><span className="small dim wf-l">{x.line}</span>{compact ? null : <a className="small wf-a" href={x.href}>{x.cta}</a>}</span></li>)}</ol>
    <p className="small mute wf-note">Paper only: a thesis is your reasoning, not a recommendation, and a plan is a calculation, not an order.</p>
  </section>;
}
