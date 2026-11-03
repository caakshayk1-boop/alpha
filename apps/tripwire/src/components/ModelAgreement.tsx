import { useState } from 'react';
import type { Agreement } from '../agreement.ts';
import type { Candidate } from '../signalengine.ts';

export function ModelAgreement({ agreement: a }: { agreement: Agreement }) {
  return <div className="model-agreement">
    <p className="small"><b>{a.count}/3 long votes · minimum {a.minimum}</b> · {a.reason}</p>
    <div className="model-grid">{a.models.map((m) => <article key={m.id} className="model-output">
      <div className="row between"><b>{m.name}</b><span className={`tag ${m.vote ? 'lime' : ''}`}>{m.vote ? 'Long vote' : !m.valid || !m.fresh ? 'No vote' : m.direction === 'bearish' ? 'Bearish' : 'Neutral'}</span></div>
      <p className="small dim">Direction: {m.direction} · confidence: {m.confidence}</p>
      <p className="small">{m.rationale}</p>
      <small className="dim">Data session: {m.timestamp ?? 'unavailable'} · {!m.valid ? 'invalid' : m.fresh ? 'fresh' : 'stale'}</small>
    </article>)}</div>
    <p className="small mute">Confidence describes rule confirmation, not a win probability. Checks inside a model provide evidence; each model contributes at most one vote.</p>
  </div>;
}

export function CandidateReview({ candidates, engine }: { candidates: Candidate[]; engine: string }) {
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('all'); const [limit, setLimit] = useState(12);
  const filtered = candidates.filter((c) => (status === 'all' || c.status === status) && `${c.sym} ${c.name}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => ({ passed: 0, watch: 1, failed: 2 }[a.status] - { passed: 0, watch: 1, failed: 2 }[b.status]) || (b.score ?? -1) - (a.score ?? -1));
  return <details className="card candidate-review"><summary>Review every candidate · {candidates.filter((c) => c.status === 'passed').length} passed · {candidates.filter((c) => c.status === 'watch').length} watch · {candidates.filter((c) => c.status === 'failed').length} failed</summary>
    <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
      <label>Find company <input type="search" aria-label={`Find company in ${engine}`} value={query} onChange={(e) => { setQuery(e.target.value); setLimit(12); }} /></label>
      <label>Status <select aria-label={`Candidate status in ${engine}`} value={status} onChange={(e) => { setStatus(e.target.value); setLimit(12); }}>{['all', 'passed', 'watch', 'failed'].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
    </div>
    <p className="small dim">{filtered.length} matching companies. Filters, model agreement and portfolio eligibility are separate decisions.</p>
    {filtered.slice(0, limit).map((c) => <details key={c.sym} className="ev"><summary>{c.sym} · {c.status} · {c.agreement.count}/3 long votes</summary><div className="body"><p>{c.reason}</p><ModelAgreement agreement={c.agreement} /></div></details>)}
    {filtered.length > limit && <button className="btn sm" onClick={() => setLimit(limit + 24)}>Show more candidates</button>}
  </details>;
}
