import { QuestionOrb } from '../components/QuestionOrb.tsx';
import { useState } from 'react';
import type { Company } from '../data.ts';
import { useAppState, useSheets } from '../app.tsx';
import { companyRead, researchEvidence } from '../research.ts';
import { current } from '../store.ts';

export function ResearchRead({ company }: { company: Company }) {
  const facts = companyRead(company); const { open } = useSheets(); const s = useAppState(); const [asking, setAsking] = useState(false);
  const entry = s.entries.find((e) => e.sym === company.sym && !e.archived);
  return <section className="card research-read" aria-labelledby="research-read-h" data-research-read>
    <div className="row between"><div><h2 className="sec" id="research-read-h">One-minute read</h2></div><QuestionOrb label={`Ask about ${company.sym}'s evidence`} expanded={asking} onClick={() => setAsking(!asking)} /></div>
    <p className="small dim">Close {company.row.last_date ?? 'date unavailable'} · accounts {company.row.fy ?? 'period unavailable'}{company.row.stale ? ' · stale prices' : ''}.</p>
    <div className="research-lines">{facts.map((x) => <details key={x.id} className="ev"><summary><span className="grow"><span className="k">{x.label}</span><b>{x.read}</b><span className="small dim">{x.fact}</span></span><span aria-hidden="true">＋</span></summary><div className="body"><p>{x.rule}</p><p className="small dim">{x.period}</p><p className="small"><a href={x.href} target="_blank" rel="noopener noreferrer">{x.source} ↗</a></p><p className="small mute">{x.limit}</p><button className="btn sm" onClick={() => open({ k: 'explain', id: x.id, sym: company.sym })}>Formula and limits</button></div></details>)}</div>
    {!facts.length && <p>Not enough measured evidence for a summary. Missing figures are not a negative finding.</p>}
    {!facts.some((x) => x.id === 'ownership') && <p className="small mute">Ownership change: comparable quarterly figures are unavailable. No direction inferred.</p>}
    {asking && <div className="research-questions" role="region" aria-label="Questions to investigate"><h3>Questions to investigate</h3><p className="small dim">Each prompt names its evidence. Save it in your existing thesis to investigate; nothing is sent to an AI service.</p>{facts.map((x) => <article key={x.id}><p><b>{x.question}</b></p><p className="small dim">Triggered by {x.fact} · {x.period}</p><button className="btn sm" onClick={() => open({ k: 'thesis', sym: company.sym, id: entry?.id, seed: { question: x.question, evidence: researchEvidence(company, x) } })}>Connect to {entry ? `thesis v${entry.versions.length}` : 'a thesis'}</button></article>)}{entry && <p className="small dim">Current question: {current(entry).question || 'not written'}</p>}</div>}
    {!asking && <button className="linkbtn" onClick={() => setAsking(true)}>Questions to investigate →</button>}
  </section>;
}
