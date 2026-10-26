import { useState } from 'react';
import { go, setState, useAppState, useSheets } from '../app.tsx';
import { useScreen } from '../data.ts';
import { Seg, Empty, useUi } from '../ui.tsx';
import { CompanyRow, Head, PageBar } from './common.tsx';
import { useWatchQuotes } from '../quotes.ts';
import { closePlan, current, istDay, journalCsv, markPaperFill, reviewDue, setArchived, weeklyReview } from '../store.ts';
import { dayWord, inr } from '../fmt.ts';
import { download } from './profile.tsx';

export function Desk({ seg }: { seg: string }) {
  const v = ['follow', 'journal', 'plans', 'saved'].includes(seg) ? seg : 'follow';
  return <div>
    <PageBar title="My Desk" sub="Kept on this device" />
    <Seg label="Desk view" value={v as 'follow'} onChange={(x) => go(`/desk?v=${x}`)} items={[{ id: 'follow', label: 'Following' }, { id: 'journal', label: 'Journal' }, { id: 'plans', label: 'Plans' }, { id: 'saved', label: 'Saved' }]} />
    {v === 'follow' ? <Following /> : v === 'journal' ? <Journal /> : v === 'plans' ? <Plans /> : <Saved />}
  </div>;
}
function Following() {
  const s = useAppState(); const scr = useScreen(); useWatchQuotes(s.follows);
  const rows = s.follows.map((x) => scr.data?.rows.find((r) => r.sym === x));
  if (!s.follows.length) return <Empty title="Nothing followed" action={<button className="btn pri" onClick={() => go('/discover')}>Find a company</button>}>Follow a name from Discover or its research page. Today then reports what changed in it.</Empty>;
  return <div className="card" style={{ padding: '2px 14px' }}><div className="list">{rows.map((r, i) => r ? <CompanyRow key={r.sym} r={r} /> : <div key={s.follows[i]} className="li"><span className="sym">{s.follows[i]}</span><span className="dim small">not in the current screen</span></div>)}</div></div>;
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
