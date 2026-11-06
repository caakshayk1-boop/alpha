import { useState } from 'react';
import type { Filters, Row } from '../screen.ts';
import { explainScreen } from '../screenfeedback.ts';
import { sourceLink } from '../research.ts';
export function ScreenFeedback({ rows, filters }: { rows: Row[]; filters: Filters }) {
  const [query, setQuery] = useState(''); const [sym, setSym] = useState('');
  const row = rows.find((r) => r.sym === sym); const explanation = row ? explainScreen(row, filters) : null;
  const matches = query.trim() ? rows.filter((r) => `${r.sym} ${r.name}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];
  return <details className="card screen-feedback"><summary>Why did a company match—or get excluded?</summary><label className="l" htmlFor="screen-why">Check any company in the full universe</label><input id="screen-why" className="field" type="search" value={query} placeholder="Company or symbol" onChange={(e) => { setQuery(e.target.value); setSym(''); }} />
    {!row && <div className="chips wrap">{matches.map((r) => <button key={r.sym} className="chip" onClick={() => { setSym(r.sym); setQuery(r.sym); }}>{r.sym}</button>)}</div>}
    {query && !matches.length && <p className="small dim">No company found in the loaded universe.</p>}
    {row && explanation && <div><h3>{row.sym} · {explanation.matched ? 'Matches this screen' : 'Excluded from this screen'}</h3><p className="small dim">Close {row.last_date ?? 'date unavailable'} · accounts {row.fy ?? 'period unavailable'}. <a href={sourceLink(row.sym)} target="_blank" rel="noopener noreferrer">Source reference ↗</a></p>
      {explanation.checks.length ? <ul className="screen-checks">{explanation.checks.map((c, i) => <li key={i}><b>{c.outcome === 'ignored' ? 'Ignored' : c.outcome === 'passed' ? 'Passed' : 'Excluded'} · {c.rule}</b><span>{c.actual}. {c.reason}</span></li>)}</ul> : <p>No active conditions. Every company in the loaded universe is included.</p>}
      <p className="small dim">Next: verify reporting periods and missing figures, inspect the business explanation, then record what would change your view. Passing a screen is a research starting point.</p><a className="btn sm" href={`#/c/${encodeURIComponent(row.sym)}`}>Inspect {row.sym} evidence →</a></div>}
  </details>;
}
