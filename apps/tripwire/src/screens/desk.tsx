import { recentDecisions } from '../decisions.ts';
import { useState } from 'react';
import { go, setState, useAppState, useLoc, useSheets } from '../app.tsx';
import { useScreen } from '../data.ts';
import { Seg, Empty, useUi } from '../ui.tsx';
import { Head, PageBar } from './common.tsx';
import { closePlan, current, editEntry, istDay, journalCsv, markPaperFill, reviewDue, setArchived, weeklyReview, type Entry, type State } from '../store.ts';
import { changeCopy, lastChange } from '../sincevisit.ts';
import { followFacts } from '../followfacts.ts';
import { deskHas } from '../home.ts';
import { dayWord, inr, pct, tone } from '../fmt.ts';
import { download } from '../backupfile.ts';
import { Fold, Workflow } from './fold.tsx';
import { planFigures } from '../planview.ts';
import { FollowReview } from './FollowReview.tsx';
import { PaperSnapshot } from './PaperSnapshot.tsx';
import { DEFAULT_STATE, discoverPath, withFilters } from '../discoverstate.ts';

export function Desk({ seg }: { seg: string }) {
  const loc = useLoc(); const explicit = loc.q.get('v'); const st = useAppState(); const has = deskHas(st);
  const v = ['follow', 'journal', 'plans', 'saved'].includes(seg) && explicit ? seg : 'desk';
  // a view is offered when it holds something, or when the person has opened it on purpose (its link always works)
  const items = [{ id: 'desk', label: 'Desk' }, ...([['follow', 'Following'], ['journal', 'Journal'], ['plans', 'Plans'], ['saved', 'Saved']] as const).filter(([id]) => has[id] || v === id).map(([id, label]) => ({ id, label }))];
  return <div>
    <PageBar title="My Desk" sub="Kept on this device" />
    {items.length > 1 && <Seg label="Desk view" value={v as 'desk'} onChange={(x) => go(x === 'desk' ? '/desk' : `/desk?v=${x}`)} items={items} />}
    {v === 'desk' ? (has.any ? <Workspace /> : <NewDesk />) : v === 'follow' ? <Following /> : v === 'journal' ? <Journal /> : v === 'plans' ? <Plans /> : <Saved />}
  </div>;
}
/** A desk with nothing on it says so once and offers the ways to put something there. No panel of zeros. */
function NewDesk() {
  const { open } = useSheets();
  return <div className="dsk dsk-empty" data-desk="new"><section className="card desk-start" aria-labelledby="dsk-new"><span className="k">Your research, in one place</span><h2 id="dsk-new" className="sec">Your next idea starts here.</h2>
    <p className="dim">Follow a company to track what changes, then save your thesis when you are ready. Your notes stay on this device.</p>
    <button className="btn pri" onClick={() => open({ k: 'search' })}>Find a company</button></section>
    <Fold id="workflow" title="A guide to researching a company" summary="From first look to your own thesis."><Workflow /></Fold>
    <div className="dsk-way"><h3>Explore a paper plan</h3><p className="small dim">Calculate position size and modelled risk. No order is placed.</p><button className="btn" onClick={() => open({ k: 'plan' })}>Size a paper position</button><a className="btn" href="#/desk?v=plans">Paper snapshot and CSV import</a></div>
    </div>;
}
const DAY = 86400000;
const addD = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
function Workspace() {
  const s = useAppState(); const { open } = useSheets(); const scr = useScreen(); const { toast } = useUi(); const today = istDay();
  const active = s.entries.filter((e) => !e.archived);
  const upcoming = active.filter((e) => { const r = current(e).reviewOn; return r && r <= addD(today, 14); }).sort((a, b) => current(a).reviewOn!.localeCompare(current(b).reviewOn!));
  const withQ = active.filter((e) => (current(e).question ?? '').trim()); const withoutQ = active.filter((e) => !(current(e).question ?? '').trim());
  const decisions = recentDecisions(s); const overdue = active.filter((e) => reviewDue(e, today) === 'overdue').length;
  const [qFor, setQFor] = useState<string>(''); const [qText, setQText] = useState(''); const [addQ, setAddQ] = useState(false);
  const saveQ = (e: Entry) => { const t = qText.trim(); if (!t) return; setState((x) => editEntry(x, e.id, { ...(({ at: _a, ...rest }) => rest)(current(e)), question: t })); setQText(''); setQFor(''); setAddQ(false); toast('Question saved as a new version. The earlier one is kept.'); };
  const reviewTag = (e: Entry) => { const d = reviewDue(e, today); const r = current(e).reviewOn; return d === 'overdue' ? <span className="tag peach">Overdue · {dayWord(r)}</span> : d === 'today' ? <span className="tag peach">Today</span> : r ? <span className="tag">{dayWord(r)}</span> : <span className="tag">No date</span>; };
  const left = upcoming.length > 0 || withQ.length > 0 || decisions.length > 0, right = s.follows.length > 0 || active.length > 0;
  return <div className="dsk" data-desk="workspace">
    {s.plans.some((p) => p.status === 'paper-filled') && <PaperSnapshot />}
    {s.follows.length > 0 && <a className="btn" href="#/desk?v=follow">Review changes in followed companies →</a>}
    {(left || right) && <div className={`dsk-grid${left && right ? '' : ' one'}`}>
      {left && <div className="dsk">
        {upcoming.length > 0 && <section aria-labelledby="dsk-rev"><h2 id="dsk-rev" className="sec" style={{ marginBottom: 8 }}>Upcoming reviews</h2>
          <div className="card" style={{ padding: '2px 14px' }}><div className="list">{upcoming.map((e) => <button key={e.id} className="dsk-row" onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}><span className="sym">{e.sym}</span><span className="grow dim small">{current(e).trigger || current(e).thesis.slice(0, 80)}</span>{reviewTag(e)}</button>)}</div></div></section>}
        {withQ.length > 0 && <section aria-labelledby="dsk-q"><h2 id="dsk-q" className="sec" style={{ marginBottom: 8 }}>Open questions</h2>
          <div className="card" style={{ padding: '2px 14px' }}><div className="list">{withQ.map((e) => <button key={e.id} className="dsk-row" onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}><span className="sym">{e.sym}</span><span className="grow">{current(e).question}</span></button>)}</div></div></section>}
        {decisions.length > 0 && <section aria-labelledby="dsk-dec"><h2 id="dsk-dec" className="sec" style={{ marginBottom: 8 }}>Recent decisions</h2>
          <div className="card" style={{ padding: '2px 14px' }}><div className="list">{decisions.map((d, i) => <a key={d.at + d.sym + i} className="dsk-row" href={d.href}><span className="sym">{d.sym}</span><span className="grow small">{d.what}</span><span className="mute small">{dayWord(d.at)}</span></a>)}</div></div></section>}
      </div>}
      {right && <div className="dsk">
        {s.follows.length > 0 && <section aria-labelledby="dsk-fol"><h2 id="dsk-fol" className="sec" style={{ marginBottom: 8 }}>Followed companies</h2>
          <div className="card" style={{ padding: '2px 14px' }}><div className="list">{s.follows.map((sym) => { const r = scr.data?.rows.find((x) => x.sym === sym); const c = lastChange(s, sym, today, r);
            const facts = r ? followFacts(r, today) : [];
            return <a key={sym} className="dsk-row dsk-follow" href={`#/c/${sym}`}>
              <span className="dsk-fl1"><span className="sym">{sym}</span><span className="grow small dim trunc">{r?.name ?? 'not in the current screen'}</span>{r?.price != null && <span className="small num dsk-px">{inr(r.price)} <span className={tone(r.r1d)}>{pct(r.r1d)}</span></span>}</span>
              <span className="dsk-fl2 small" data-lastchange>
                {c && <span className="dsk-change">{changeCopy(c, today).title} <span className="mute">· {dayWord(c.curDay)}</span></span>}
                {facts.map((f) => <span key={f.id} className={`dsk-fact ${f.tone}`}>{f.text}</span>)}
                {!c && facts.length === 0 && <span className="mute">{r ? 'Nothing unusual. No change recorded yet.' : 'No figures for it in the current screen.'}</span>}
              </span></a>; })}</div></div></section>}
        {active.length > 0 && <section aria-labelledby="dsk-th"><h2 id="dsk-th" className="sec" style={{ marginBottom: 8 }}>Saved theses</h2>
          <div className="card" style={{ padding: '2px 14px' }}><div className="list">{active.slice(0, 6).map((e) => <button key={e.id} className="dsk-row" onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}><span className="sym">{e.sym}</span><span className="grow small">{current(e).thesis || 'No thesis written'}{current(e).invalidation ? <span className="dim"> · wrong if: {current(e).invalidation}</span> : null}</span>{reviewTag(e)}</button>)}</div>
            {active.length > 6 && <a className="small" href="#/desk?v=journal" style={{ display: 'block', padding: '8px 0 12px', textDecoration: 'underline' }}>All {active.length} in the Journal</a>}</div></section>}
      </div>}
    </div>}
    {addQ && withoutQ.length > 0 && <section className="card dsk-q" aria-labelledby="dsk-addq"><h2 id="dsk-addq" className="sec">Add a question to a thesis</h2>
      <form onSubmit={(ev) => { ev.preventDefault(); const e = active.find((x) => x.id === qFor); if (e) saveQ(e); }}>
        <select id="dsk-qsel" className="field" aria-label="Thesis" value={qFor} onChange={(ev) => setQFor(ev.target.value)} style={{ flex: '0 1 10rem' }}><option value="">Choose a thesis</option>{withoutQ.map((e) => <option key={e.id} value={e.id}>{e.sym}</option>)}</select>
        <input className="field" aria-label="Question" maxLength={300} placeholder="What do you still need to find out?" value={qText} onChange={(ev) => setQText(ev.target.value)} />
        <button className="btn sm" type="submit" disabled={!qFor || !qText.trim()}>Save</button><button className="btn sm" type="button" onClick={() => setAddQ(false)}>Cancel</button></form></section>}
    <Fold id="workflow" title="How the desk fits the research workflow" summary="Understand, check evidence and risks, compare, write a thesis, track."><Workflow compact heading="The five steps" /></Fold>
    <div className="dsk-add" role="group" aria-label="Add to your desk"><button className="btn" onClick={() => open({ k: 'search' })}>Find a company</button>
      {withoutQ.length > 0 && !addQ && <button className="btn" onClick={() => setAddQ(true)}>Add a question</button>}<button className="btn" onClick={() => open({ k: 'plan' })}>Size a paper position</button></div>
  </div>;
}
function Following() {
  const s = useAppState(); const scr = useScreen();
  if (!s.follows.length) return <Empty title="Nothing followed" action={<button className="btn pri" onClick={() => go('/discover')}>Find a company</button>}>Follow a name from Discover or its research page. Today then reports what changed in it.</Empty>;
  return <FollowReview rows={scr.data?.rows ?? []} />;
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

  const W = { saved: 'Saved plan', 'paper-filled': 'Paper fill (you recorded it)', closed: 'Closed' } as const;
  return <><PaperSnapshot /><button className="btn" onClick={() => open({ k: 'plan' })}>Size a paper position</button>{s.plans.map((p) => <div key={p.id} className="card"><div className="row between"><a href={`#/c/${p.sym}`}><b>{p.sym}</b></a><span className={`tag ${p.status === 'paper-filled' ? 'lime' : ''}`}>{W[p.status]}</span></div>
    <p className="num small" style={{ margin: '8px 0' }}>{p.qty} shares · entry {inr(p.entry)} · stop {inr(p.stop)} · risk {p.riskPct}% · revision {p.rev}{p.expiry ? ` · expires ${dayWord(p.expiry)}` : ''}</p>
    {(() => { const f = planFigures(p, s.prefs.equity, s.prefs.cash, null); return <p className="small dim" style={{ margin: '0 0 8px' }} data-plan-saved>Hypothetical allocation {inr(f.capital)}{f.allocationPct != null ? ` (${f.allocationPct < 10 ? f.allocationPct.toFixed(1) : Math.round(f.allocationPct)}% of equity)` : ''} · modelled loss at your assumed stop {inr(f.lossAtStop)}. A gap can lose more.</p>; })()}
    {p.note && <p className="dim small" style={{ margin: '0 0 8px' }}>{p.note}</p>}
    <div className="row">{p.status === 'saved' && <button className="btn sm" onClick={() => { setState((x) => markPaperFill(x, p.id)); toast('Marked as a paper fill'); }}>Record paper fill</button>}
      {p.status === 'paper-filled' && <button className="btn sm" onClick={() => { setState((x) => closePlan(x, p.id)); toast('Plan closed'); }}>Close</button>}
      {p.status === 'saved' && <button className="btn sm" onClick={() => open({ k: 'plan', sym: p.sym, entry: p.entry, stop: p.stop })}>Edit</button>}</div></div>)}
    <p className="mute small">Paper plans only. Tripwire connects to no broker and places no order.</p></>;
}
function Saved() {
  const s = useAppState();
  return <>
    <Head>Comparisons</Head>{s.compares.length ? <div className="card"><div className="list">{s.compares.map((c) => <a key={c.join()} className="li" href={`#/compare?s=${c.join(',')}`}><span className="grow sym">{c.join(' · ')}</span></a>)}</div></div> : <div className="card dim">None saved. Compare two or three names and save the result. <a href="#/compare" style={{ textDecoration: 'underline' }}>Open Compare</a></div>}
    <Head>Screens</Head>{s.screens.length ? <div className="card"><div className="list">{s.screens.map((x) => <a key={x.name} className="li" href={`#${discoverPath(withFilters(DEFAULT_STATE, x.f))}`}><span className="grow">{x.name}</span></a>)}</div></div> : <div className="card dim">None saved. Set filters in Discover, then save them.</div>}
  </>;
}
