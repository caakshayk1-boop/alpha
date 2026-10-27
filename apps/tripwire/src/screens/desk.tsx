import { useState } from 'react';
import { go, setState, useAppState, useLoc, useSheets } from '../app.tsx';
import { useScreen } from '../data.ts';
import { Seg, Empty, useUi } from '../ui.tsx';
import { CompanyRow, Head, PageBar } from './common.tsx';
import { useWatchQuotes } from '../quotes.ts';
import { closePlan, current, editEntry, istDay, journalCsv, markPaperFill, reviewDue, setArchived, weeklyReview, type Entry, type State } from '../store.ts';
import { lastChange } from '../sincevisit.ts';
import { dayWord, inr } from '../fmt.ts';
import { download } from './profile.tsx';

export function Desk({ seg }: { seg: string }) {
  const loc = useLoc(); const explicit = loc.q.get('v');
  const v = ['follow', 'journal', 'plans', 'saved'].includes(seg) && explicit ? seg : 'desk';
  return <div>
    <PageBar title="My Desk" sub="Kept on this device" />
    <Seg label="Desk view" value={v as 'desk'} onChange={(x) => go(x === 'desk' ? '/desk' : `/desk?v=${x}`)} items={[{ id: 'desk', label: 'Desk' }, { id: 'follow', label: 'Following' }, { id: 'journal', label: 'Journal' }, { id: 'plans', label: 'Plans' }, { id: 'saved', label: 'Saved' }]} />
    {v === 'desk' ? <Workspace /> : v === 'follow' ? <Following /> : v === 'journal' ? <Journal /> : v === 'plans' ? <Plans /> : <Saved />}
  </div>;
}
const DAY = 86400000;
const addD = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
interface Decision { at: string; sym: string; what: string; href: string }
/** Everything the person has decided, newest first: a thesis version with a decision, a saved plan, a paper trade taken from a pick. Recorded facts only. */
export function recentDecisions(s: State, n = 8): Decision[] {
  const out: Decision[] = [];
  for (const e of s.entries) for (const v of e.versions) if (v.decision.trim()) out.push({ at: v.at, sym: e.sym, what: `Thesis decision: ${v.decision.trim()}`, href: `#/desk?v=journal` });
  for (const p of s.plans) out.push({ at: p.filledAt ?? p.at, sym: p.sym, what: p.status === 'paper-filled' ? `Paper fill recorded, ${p.qty} shares` : p.status === 'closed' ? 'Plan closed' : `Plan saved, ${p.qty} shares, stop ${inr(p.stop)}`, href: '#/desk?v=plans' });
  for (const t of s.paper) out.push({ at: new Date(t.takenAt * 1000).toISOString(), sym: t.sym, what: `Paper trade taken from a ${t.engine} pick${t.closedByUser ? ' (closed by hand)' : ''}`, href: '#/signals?v=tracker' });
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, n);
}
function Workspace() {
  const s = useAppState(); const { open } = useSheets(); const scr = useScreen(); const { toast } = useUi(); const today = istDay();
  const active = s.entries.filter((e) => !e.archived);
  const upcoming = active.filter((e) => { const r = current(e).reviewOn; return r && r <= addD(today, 14); }).sort((a, b) => current(a).reviewOn!.localeCompare(current(b).reviewOn!));
  const withQ = active.filter((e) => (current(e).question ?? '').trim()); const withoutQ = active.filter((e) => !(current(e).question ?? '').trim());
  const decisions = recentDecisions(s); const overdue = active.filter((e) => reviewDue(e, today) === 'overdue').length;
  const [qFor, setQFor] = useState<string>(''); const [qText, setQText] = useState('');
  const saveQ = (e: Entry) => { const t = qText.trim(); if (!t) return; setState((x) => editEntry(x, e.id, { ...(({ at: _a, ...rest }) => rest)(current(e)), question: t })); setQText(''); setQFor(''); toast('Question saved as a new version. The earlier one is kept.'); };
  const reviewTag = (e: Entry) => { const d = reviewDue(e, today); const r = current(e).reviewOn; return d === 'overdue' ? <span className="tag peach">Overdue · {dayWord(r)}</span> : d === 'today' ? <span className="tag peach">Today</span> : r ? <span className="tag">{dayWord(r)}</span> : <span className="tag">No date</span>; };
  return <div className="dsk" data-desk="workspace">
    <section className="card" aria-label="Summary"><div className="dsk-sum num">
      <div><b>{s.follows.length}</b><span className="small dim">followed</span></div><div><b>{active.length}</b><span className="small dim">theses</span></div><div><b>{overdue}</b><span className="small dim">reviews overdue</span></div><div><b>{withQ.length}</b><span className="small dim">open questions</span></div></div></section>
    <div className="dsk-grid"><div className="dsk">
      <section aria-labelledby="dsk-rev"><h2 id="dsk-rev" className="sec" style={{ marginBottom: 8 }}>Upcoming reviews</h2>
        {upcoming.length ? <div className="card" style={{ padding: '2px 14px' }}><div className="list">{upcoming.map((e) => <button key={e.id} className="dsk-row" onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}><span className="sym">{e.sym}</span><span className="grow dim small">{current(e).trigger || current(e).thesis.slice(0, 80)}</span>{reviewTag(e)}</button>)}</div></div>
          : <div className="card dim small">No review falls due in the next 14 days.{active.length ? '' : ' Write a thesis with a review date and it appears here.'}</div>}</section>
      <section aria-labelledby="dsk-q"><h2 id="dsk-q" className="sec" style={{ marginBottom: 8 }}>Open questions</h2>
        <div className="card" style={{ padding: '2px 14px' }}>{withQ.length ? <div className="list">{withQ.map((e) => <button key={e.id} className="dsk-row" onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}><span className="sym">{e.sym}</span><span className="grow">{current(e).question}</span></button>)}</div> : <p className="small dim" style={{ margin: '10px 0' }}>No open questions. A question is what you still need to find out before you would act.</p>}
          {withoutQ.length > 0 && <div className="dsk-q"><label className="small dim" htmlFor="dsk-qsel">Add a question to a thesis</label>
            <form onSubmit={(ev) => { ev.preventDefault(); const e = active.find((x) => x.id === qFor); if (e) saveQ(e); }}>
              <select id="dsk-qsel" className="field" value={qFor} onChange={(ev) => setQFor(ev.target.value)} style={{ flex: '0 1 10rem' }}><option value="">Choose a thesis</option>{withoutQ.map((e) => <option key={e.id} value={e.id}>{e.sym}</option>)}</select>
              <input className="field" aria-label="Question" maxLength={300} placeholder="What do you still need to find out?" value={qText} onChange={(ev) => setQText(ev.target.value)} />
              <button className="btn sm" type="submit" disabled={!qFor || !qText.trim()}>Save</button></form></div>}</div></section>
      <section aria-labelledby="dsk-dec"><h2 id="dsk-dec" className="sec" style={{ marginBottom: 8 }}>Recent decisions</h2>
        {decisions.length ? <div className="card" style={{ padding: '2px 14px' }}><div className="list">{decisions.map((d, i) => <a key={d.at + d.sym + i} className="dsk-row" href={d.href}><span className="sym">{d.sym}</span><span className="grow small">{d.what}</span><span className="mute small">{dayWord(d.at)}</span></a>)}</div></div> : <div className="card dim small">Nothing decided yet. Theses, plans and paper trades you record appear here.</div>}</section>
    </div><div className="dsk">
      <section aria-labelledby="dsk-fol"><h2 id="dsk-fol" className="sec" style={{ marginBottom: 8 }}>Followed companies</h2>
        {s.follows.length ? <div className="card" style={{ padding: '2px 14px' }}><div className="list">{s.follows.map((sym) => { const c = lastChange(s, sym); const r = scr.data?.rows.find((x) => x.sym === sym);
          return <a key={sym} className="dsk-row" href={`#/c/${sym}`}><span className="sym">{sym}</span><span className="grow small dim">{r?.name ?? 'not in the current screen'}</span><span className="small" data-lastchange>{c ? <>{c.title} <span className="mute">· {dayWord(c.curDay)}</span></> : <span className="mute">No change recorded yet</span>}</span></a>; })}</div></div>
          : <div className="card"><p style={{ margin: 0 }}>Nothing followed.</p><p className="small dim" style={{ margin: '6px 0 10px' }}>Follow a name from Discover or its research page. Today then reports what changed in it.</p><a className="btn pri" href="#/discover">Find a company</a></div>}</section>
      <section aria-labelledby="dsk-th"><h2 id="dsk-th" className="sec" style={{ marginBottom: 8 }}>Saved theses</h2>
        {active.length ? <div className="card" style={{ padding: '2px 14px' }}><div className="list">{active.slice(0, 6).map((e) => <button key={e.id} className="dsk-row" onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}><span className="sym">{e.sym}</span><span className="grow small">{current(e).thesis || 'No thesis written'}{current(e).invalidation ? <span className="dim"> · wrong if: {current(e).invalidation}</span> : null}</span>{reviewTag(e)}</button>)}</div>
          {active.length > 6 && <a className="small" href="#/desk?v=journal" style={{ display: 'block', padding: '8px 0 12px', textDecoration: 'underline' }}>All {active.length} in the Journal</a>}</div>
          : <div className="card dim small">No theses yet. Open a company and tap Thesis.</div>}</section>
    </div></div>
  </div>;
}
function Following() {
  const s = useAppState(); const scr = useScreen(); useWatchQuotes(s.follows);
  const rows = s.follows.map((x) => scr.data?.rows.find((r) => r.sym === x));
  if (!s.follows.length) return <Empty title="Nothing followed" action={<button className="btn pri" onClick={() => go('/discover')}>Find a company</button>}>Follow a name from Discover or its research page. Today then reports what changed in it.</Empty>;
  return <div className="card" style={{ padding: '2px 14px' }}><div className="list">{rows.map((r, i) => r ? <CompanyRow key={r.sym} r={r} meta={(() => { const c = lastChange(s, r.sym); return c ? <span className="small" style={{ color: 'var(--lime)' }}>{c.title}</span> : null; })()} /> : <div key={s.follows[i]} className="li"><span className="sym">{s.follows[i]}</span><span className="dim small">not in the current screen</span></div>)}</div></div>;
}
function Journal() {
  const s = useAppState(); const { open } = useSheets(); const [q, setQ] = useState(''); const [arch, setArch] = useState(false); const { toast } = useUi();
  const today = istDay(); const w = weeklyReview(s, today);
  const list = s.entries.filter((e) => e.archived === arch && (!q.trim() || (e.sym + ' ' + JSON.stringify(current(e))).toLowerCase().includes(q.toLowerCase())));
  return <>
    <div className="card glass"><div className="k">Process review, last 7 days</div>
      <div className="row" style={{ marginTop: 10, gap: 18, flexWrap: 'wrap' }}>
        {([['Reviewed', w.decisionsTouched], ['Changed', w.thesesChanged], ['No invalidation', w.entriesWithoutInvalidation], ['Overdue', w.overdue]] as const).map(([l, n]) => <div key={l}><div className="num" style={{ font: '600 1.75rem/1 var(--sans)' }}>{n}</div><div className="small dim">{l}</div></div>)}</div>
      <p className="small dim" style={{ margin: '10px 0 0' }}>Counts your process. A decision is not graded by what the price did next.</p></div>
    <div className="row" style={{ margin: '12px 0' }}><input className="field" type="search" placeholder="Search your notes" aria-label="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="btn" onClick={() => setArch((a) => !a)} aria-pressed={arch}>{arch ? 'Active' : 'Archived'}</button></div>
    {list.length ? list.map((e) => { const c = current(e), d = reviewDue(e, today); return <div key={e.id} className="card">
      <button style={{ width: '100%', textAlign: 'left' }} onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}>
        <div className="row between"><b>{e.sym}</b>{d === 'overdue' ? <span className="tag peach">Review overdue</span> : d === 'today' ? <span className="tag peach">Review today</span> : c.reviewOn ? <span className="tag">Review {dayWord(c.reviewOn)}</span> : <span className="tag">No review date</span>}</div>
        <p style={{ margin: '8px 0 4px' }}>{c.thesis || <span className="dim">No thesis written</span>}</p>
        <p className="small dim" style={{ margin: 0 }}>{c.decision ? `Decision: ${c.decision}. ` : ''}{c.invalidation ? `Wrong if: ${c.invalidation}` : 'No invalidation written.'}</p></button>
      <div className="row" style={{ marginTop: 10 }}><span className="mute small grow">{e.versions.length} version{e.versions.length > 1 ? 's' : ''} · last {dayWord(c.at)}</span>
        <button className="btn sm" onClick={() => { setState((x) => setArchived(x, e.id, !e.archived)); toast(e.archived ? 'Restored' : 'Archived. History is kept.'); }}>{e.archived ? 'Restore' : 'Archive'}</button></div></div>; })
      : <Empty title={arch ? 'Nothing archived' : q ? 'No note matches' : 'No theses yet'}>{q ? 'Try fewer words.' : 'Open a company and tap Thesis. Seven short fields, and edits keep every earlier version.'}</Empty>}
    {s.entries.length > 0 && <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => download('tripwire-journal.csv', journalCsv(s), 'text/csv')}>Export journal (CSV, every version)</button>}
  </>;
}
function Plans() {
  const s = useAppState(); const { open } = useSheets(); const { toast } = useUi();
  if (!s.plans.length) return <Empty title="No paper plans" action={<button className="btn pri" onClick={() => open({ k: 'plan' })}>Size a position</button>}>A plan is a saved calculation. It is not a fill and not a holding.</Empty>;
  const W = { saved: 'Saved plan', 'paper-filled': 'Paper fill (you recorded it)', closed: 'Closed' } as const;
  return <>{s.plans.map((p) => <div key={p.id} className="card"><div className="row between"><a href={`#/c/${p.sym}`}><b>{p.sym}</b></a><span className={`tag ${p.status === 'paper-filled' ? 'lime' : ''}`}>{W[p.status]}</span></div>
    <p className="num small" style={{ margin: '8px 0' }}>{p.qty} shares · entry {inr(p.entry)} · stop {inr(p.stop)} · risk {p.riskPct}% · revision {p.rev}{p.expiry ? ` · expires ${dayWord(p.expiry)}` : ''}</p>
    {p.note && <p className="dim small" style={{ margin: '0 0 8px' }}>{p.note}</p>}
    <div className="row">{p.status === 'saved' && <button className="btn sm" onClick={() => { setState((x) => markPaperFill(x, p.id)); toast('Marked as a paper fill'); }}>Record paper fill</button>}
      {p.status === 'paper-filled' && <button className="btn sm" onClick={() => { setState((x) => closePlan(x, p.id)); toast('Plan closed'); }}>Close</button>}
      {p.status === 'saved' && <button className="btn sm" onClick={() => open({ k: 'plan', sym: p.sym, entry: p.entry, stop: p.stop })}>Edit</button>}</div></div>)}
    <p className="mute small">Paper plans only. Tripwire connects to no broker and places no order.</p></>;
}
function Saved() {
  const s = useAppState();
  return <>
    <Head>Comparisons</Head>{s.compares.length ? <div className="card"><div className="list">{s.compares.map((c) => <a key={c.join()} className="li" href={`#/compare?s=${c.join(',')}`}><span className="grow sym">{c.join(' · ')}</span></a>)}</div></div> : <div className="card dim">None saved. Compare two or three names and save the result.</div>}
    <Head>Screens</Head>{s.screens.length ? <div className="card"><div className="list">{s.screens.map((x) => <a key={x.name} className="li" href="#/discover"><span className="grow">{x.name}</span></a>)}</div></div> : <div className="card dim">None saved. Set filters in Discover, then save them.</div>}
  </>;
}
