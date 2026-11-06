import { useAppState, useSheets } from '../app.tsx';
import { current, istDay } from '../store.ts';
import { lastChange } from '../sincevisit.ts';
import type { Row } from '../screen.ts';
import { followFacts } from '../followfacts.ts';
import { sourceLink } from '../research.ts';
const STATES = { new: 'New', waiting: 'Waiting for evidence', results: 'After results', reviewed: 'Reviewed' };
export function FollowReview({ rows }: { rows: Row[] }) {
  const s = useAppState(); const { open } = useSheets(); const today = istDay();
  return <div data-follow-review>{s.follows.map((sym) => {
    const row = rows.find((r) => r.sym === sym); const e = s.entries.find((x) => x.sym === sym && !x.archived); const v = e ? current(e) : null;
    const change = lastChange(s, sym, today, row); const changedSince = !!(v && change && change.curAt > v.at);
    return <article className="card" key={sym}><div className="row between"><a href={`#/c/${encodeURIComponent(sym)}`}><b>{sym}</b><span className="small dim" style={{ display: 'block' }}>{row?.name ?? 'Not in the current screen'}</span></a><span className="tag">{changedSince ? 'New evidence since thesis update' : STATES[v?.reviewState ?? 'new']}</span></div>
      {change ? <div className="review-delta"><b>{change.title}</b><div className="small"><span>{change.before}<small>{change.prevDay}</small></span><span aria-hidden="true">→</span><span>{change.after}<small>{change.curDay}</small></span></div><p className="small mute">{change.basis}</p></div> : <p className="small dim">No material change recorded between visits. A comparable earlier snapshot is needed; absence of a change is not a fresh review.</p>}
      <p className="small">{v ? <>Assumption to revisit: {v.invalidation || v.question || 'not written yet'}<br /><span className="dim">{change?.entryId === e!.id ? change.framing : 'No automatic link to a thesis assumption was established.'}</span></> : 'Save a question and an invalidation to connect changes to your research.'}</p>
      <p className="small dim">Your evidence assessment: {v?.evidenceChange ?? 'unassessed'}{v ? ` · thesis v${e!.versions.length} · ${v.at.slice(0, 10)}` : ''}. {v?.reviewOn ? `Next review ${v.reviewOn}.` : 'No review date set.'}</p>
      {row && <p className="small mute">{followFacts(row, today, 1).map((f) => f.text).join(' ')} · Screen close {row.last_date ?? 'date unavailable'}. <a href={sourceLink(sym)} target="_blank" rel="noopener noreferrer">Price source ↗</a>{row.next_earnings ? ` Results date ${row.next_earnings} is provider-listed; confirm the announcement.` : ''}</p>}
      <button className="btn sm" onClick={() => open({ k: 'thesis', sym, id: e?.id })}>{e ? 'Review existing thesis' : 'Save a research question'}</button>
    </article>;
  })}<p className="small mute">Changes are checked when you use Tripwire. No monitoring or notifications while the app is closed. Notes and reviews stay on this device and are included in backup/export.</p></div>;
}
