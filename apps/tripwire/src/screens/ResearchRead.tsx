import { QuestionOrb } from '../components/QuestionOrb.tsx';
import { useState } from 'react';
import type { Company } from '../data.ts';
import { useAppState, useSheets } from '../app.tsx';
import { companyRead, researchEvidence } from '../research.ts';
import { current } from '../store.ts';
import { dayWord } from '../fmt.ts';

/** The one-minute read: conclusion, then the fact, the screen rule, its limits and the open evidence. Three to five findings; the rationale stays one tap away.
 *  Each finding is labelled by kind (Source fact · Screen rule), and a statement-based finding says beside itself that the filing's publication date is not held. */
export function ResearchRead({ company }: { company: Company }) {
  const facts = companyRead(company); const { open } = useSheets(); const s = useAppState(); const [asking, setAsking] = useState(false);
  const entry = s.entries.find((e) => e.sym === company.sym && !e.archived);
  return <details className="fold research-read" data-fold="read" data-research-read>
    <summary><span className="fold-main"><h2 className="fold-t" id="research-read-h">One-minute read</h2><span className="fold-s">{facts.length ? `${facts.map((x) => x.label).join(", ")}: each with its source and period` : "Not enough measured evidence for a summary"}</span></span><span className="chev" aria-hidden="true">▾</span></summary>
    <div className="fold-body rr-wrap"><div className="row between"><span className="small dim">Open a line for its method and limits.</span><QuestionOrb label={`Ask about ${company.sym}'s evidence`} expanded={asking} onClick={() => setAsking(!asking)} /></div>
    <p className="small dim rr-key"><span className="rr-kind fact">Source fact</span> what the data says · <span className="rr-kind rule">Screen rule</span> how Tripwire reads it · interpretation is yours.</p>
    <div className="research-lines">{facts.map((x) => <details key={x.id} className="ev rr-item" data-fact={x.id}><summary><span className="grow rr-sum"><span className="k">{x.label}</span><b>{x.read}</b><span className="small dim rr-fact">{x.fact}{x.statement && !x.published && <span className="rr-pub" data-pub-missing><span className="rr-pub-long">Publication date unavailable</span><span className="rr-pub-short" aria-hidden="true">†</span></span>}</span></span><span className="rr-plus" aria-hidden="true">＋</span></summary>
      <div className="body rr-body">
        <p className="rr-line"><span className="rr-kind fact">Source fact</span> {x.fact}</p>
        <p className="rr-line"><span className="rr-kind rule">Screen rule</span> {x.rule}</p>
        <div className="rr-method" role="group" aria-label="Method and limits">
          <p className="k" style={{ margin: 0 }}>Method &amp; limits</p>
          <dl className="rr-prov">
            <div><dt>Period</dt><dd>{x.period}</dd></div>
            <div><dt>Source</dt><dd><a href={x.href} target="_blank" rel="noopener noreferrer">{x.source} ↗</a></dd></div>
            <div><dt>Snapshot built</dt><dd>{x.snapshotBuilt ? dayWord(x.snapshotBuilt) : 'unavailable'}</dd></div>
            <div><dt>Published</dt><dd>{x.published ? dayWord(x.published) : 'Publication date unavailable'}</dd></div>
            <div><dt>Does not establish</dt><dd>{x.limit}</dd></div>
          </dl>
        </div>
        <button className="btn sm" onClick={() => open({ k: 'explain', id: x.id, sym: company.sym })}>Formula and limits</button></div></details>)}</div>
    {facts.some((x) => x.statement && !x.published) && <p className="small mute rr-foot" aria-hidden="true">† Publication date unavailable.</p>}
    {!facts.length && <p>Not enough measured evidence for a summary. Missing figures are not a negative finding.</p>}
    {!facts.some((x) => x.id === 'ownership') && <p className="small mute">Ownership change: comparable quarterly figures are unavailable. No direction inferred.</p>}
    {asking && <div className="research-questions" role="region" aria-label="Questions to investigate"><h3>Questions to investigate</h3><p className="small dim">Each prompt names its evidence. Save it in your existing thesis to investigate; nothing is sent to an AI service.</p>{facts.map((x) => <article key={x.id}><p><b>{x.question}</b></p><p className="small dim">Triggered by {x.fact} · {x.period}</p><button className="btn sm" onClick={() => open({ k: 'thesis', sym: company.sym, id: entry?.id, seed: { question: x.question, evidence: researchEvidence(company, x) } })}>Connect to {entry ? `thesis v${entry.versions.length}` : 'a thesis'}</button></article>)}{entry && <p className="small dim">Current question: {current(entry).question || 'not written'}</p>}</div>}
    {!asking && <button className="linkbtn" onClick={() => setAsking(true)}>Questions to investigate →</button>}
    </div>
  </details>;
}
