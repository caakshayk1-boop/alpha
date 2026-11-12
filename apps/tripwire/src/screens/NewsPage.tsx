import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '../app.tsx';
import { useAutoBook } from '../book.ts';
import { lastVisitSec, markVisited, useNewsBoard } from '../news.ts';
import { newsViewState, plural } from '../newshealth.ts';
import { archiveList, countsLine, groupNews, newsCounts, NEWS_CATEGORIES, typeFilterValue, typesFromValue, isGlobal, type ArchiveFilter, type Lists, type NewsGroupId, type NewsScope } from '../newsview.ts';
import { Icon } from '../ui.tsx';
import { FilterSheet } from '../components/index.ts';
import { PageBar } from './common.tsx';
import { GlobalCues } from './GlobalCues.tsx';
import { NewsHealthLine, NewsCheckTimes, NewsMethod, NewsRow, RefreshControl, UpdateOffer, EmptyTab, useNewsPreference } from './News.tsx';
import { REJECT } from '../../news/rules.js';
import { EVENT_TYPES } from '../../news/events.js';

/** The names in the paper book, from the automatic book and the reader's own paper trades. Kept apart from follows. */
export function usePaperSyms(): string[] {
  const s = useAppState(); const auto = useAutoBook(false);
  return useMemo(() => [...new Set([...auto.rows.filter((r) => r.v.status === 'open' || r.v.status === 'pending' || r.v.status === 'waiting').map((r) => r.p.sym), ...s.paper.filter((p) => !p.closedByUser).map((p) => p.sym)])], [auto.rows, s.paper]);
}
const DAYS = [{ d: 2, l: 'Last 2 days' }, { d: 7, l: 'Last 7 days' }, { d: 14, l: 'Last 14 days' }];
const PAGE = 40;
const NO_FILTER: ArchiveFilter = { tab: 'all', types: [], days: 7, includeOther: false, covered: false, text: '', scope: 'all' };
const SCOPES: { id: NewsScope; l: string }[] = [{ id: 'all', l: 'All' }, { id: 'india', l: 'India' }, { id: 'global', l: 'Global' }];   // 12 Nov 2026
const GROUP_EMPTY: Record<NewsGroupId, string> = { global: '', yours: 'Nothing for the names you follow under these filters.', paper: 'Nothing for the paper book under these filters.', market: 'No India-wide event under these filters.', other: '' };

/** The News page (revamp v2, 11 Nov 2026): one list grouped by what each event is about (Your names, Paper book, Market), every event once (newsview.ts#groupNews); the freshness word and the
 *  check-for-updates button in the header; every filter behind one Filter button. The archive rules, the counts and the methodology are unchanged. #/news */
export function NewsPage() {
  const s = useAppState(); const paper = usePaperSyms(); const lists = useMemo<Lists>(() => ({ follows: s.follows, paper }), [s.follows, paper]);
  const b = useNewsBoard(lists); const [seen] = useState(() => lastVisitSec());
  const [f, setF] = useState<ArchiveFilter>(NO_FILTER); const [shown, setShown] = useState(PAGE); const [sheet, setSheet] = useState(false);
  useEffect(() => { document.title = 'News · Tripwire'; const t = window.setTimeout(() => markVisited(), 4000); return () => window.clearTimeout(t); }, []);
  const rows = useMemo(() => archiveList(b.pool, f, lists, b.at), [b.pool, f, lists, b.at]); const view = newsViewState(b.health, { loading: b.loading, rows: rows.length }); const india = useMemo(() => rows.filter((e) => !isGlobal(e)), [rows]); const nc = useMemo(() => newsCounts(rows), [rows]);   // every event listed, global cues included, so the section counts add up to this total
  const groups = useMemo(() => groupNews(rows, lists), [rows, lists]);
  const types = useMemo(() => EVENT_TYPES.filter((t: string) => t !== 'Update' && b.pool.some((e) => e.eventType === t)), [b.pool]);
  const set = (p: Partial<ArchiveFilter>) => { setF({ ...f, ...p }); setShown(PAGE); };
  const [summaries, setSummaries] = useNewsPreference('summaries');
  const changed = [f.types.length > 0, f.days !== 7, (f.scope ?? 'all') !== 'all', f.includeOther, f.covered, f.text.trim() !== ''].filter(Boolean).length;
  const snap = b.snapshot;
  let budget = shown;   // "Show more" reveals the grouped list in reading order: the first PAGE rows across the sections, then the next
  return <div className="nw nwp">
    <PageBar title="News" onBack sub={<span className="nwp-line" aria-hidden="true">{b.health.line}</span>} right={<span className="nwp-fresh"><NewsHealthLine h={b.health} compact /><RefreshControl icon state={b.refreshState.state} message={b.refreshState.message} onClick={() => void b.refresh()} /></span>} />
    <p className="sr" data-news-view>{view}</p>
    <div className="nwp-bar">
      <p className="nwp-count num" role="status">{b.loading ? 'Loading…' : countsLine(nc)}</p>
      <button className="chip dbtn nwp-filter" onClick={() => setSheet(true)} aria-haspopup="dialog" data-news-filter><Icon n="filter" />Filter{changed ? ` · ${changed}` : ''}</button>
    </div>
    <UpdateOffer n={b.pending} apply={b.apply} />
    {b.loading ? <div className="card nw-skel" aria-hidden="true"><div className="sk" style={{ height: 18, width: '90%' }} /><div className="sk" style={{ height: 14, width: '65%' }} /></div>
      : !rows.length ? <div className="card nwp-empty"><EmptyTab tab="all" lists={lists} haveSnapshot={b.hasSnapshot} anyOther={false} view={view} /></div>
      : groups.filter((g) => g.id !== 'other' || g.items.length).map((g) => {
        if (g.id === 'global') return (f.scope ?? 'all') === 'india' ? null : <GlobalCues key="global" events={g.items.map((x) => x.ev)} lists={lists} seenSec={seen} nowMs={b.at} summaries={summaries} emptyNote={view === 'delayed' || view === 'error' || view === 'partial' ? 'No global cues to show, and the news check is late or incomplete. This is not a statement that nothing happened.' : undefined} />;
        if ((f.scope ?? 'all') === 'global') return null;
        const items = g.items.slice(0, Math.max(0, budget)); budget -= items.length;
        return <section key={g.id} className="nwp-group" data-news-group={g.id} aria-labelledby={`nwg-${g.id}`}>
          <h2 className="nwp-gh" id={`nwg-${g.id}`}>{g.label}<span className="nwp-n num" aria-label={`, ${plural(g.items.length, 'event')}`}>{g.items.length}</span></h2>
          {g.items.length === 0 ? (g.id === 'yours' && lists.follows.length === 0 ? <p className="nwp-none">You follow no companies yet. <a href="#/discover">Find companies in Research</a>; their verified updates are listed here, never filled from the paper book.</p> : <p className="nwp-none">{g.id === 'paper' && groups.find((x) => x.id === 'yours')?.items.some((x) => x.inPaper) ? 'Its names with news are ones you follow: they are listed once, under Your names, marked In paper book.' : GROUP_EMPTY[g.id]}</p>)
            : items.length ? <ul className="nw-list card">{items.map(({ ev, inPaper }) => <NewsRow key={ev.eventClusterId} ev={ev} lists={lists} seenSec={seen} nowMs={b.at} summaries={summaries} board inPaper={inPaper} />)}</ul> : null}
        </section>; })}
    {india.length > shown && <div className="nw-foot"><button className="btn sm" onClick={() => setShown(shown + PAGE)}>{`Show ${Math.min(PAGE, india.length - shown)} more`}</button><span className="small mute">{shown} of {india.length}</span></div>}
    {sheet && <FilterSheet title="Filter news" onClose={() => setSheet(false)}>
      <div className="nwp-filters">
        <label>Search <input type="search" placeholder="Headline or symbol" aria-label="Search headline or symbol" value={f.text} onChange={(e) => set({ text: e.target.value })} /></label>
        <label>Category <select value={typeFilterValue(f.types)} onChange={(e) => set({ types: typesFromValue(e.target.value) })}><option value="">All categories</option>{NEWS_CATEGORIES.filter((c) => c.id !== 'other').map((c) => { const have = c.types.filter((t) => types.includes(t)); if (!have.length) return null;
          return <optgroup key={c.id} label={c.label}>{have.length > 1 && <option value={`cat:${c.id}`}>All of {c.label.toLowerCase()}</option>}{have.map((t: string) => <option key={t} value={t}>{t}</option>)}</optgroup>; })}</select></label>
        <label>Scope <select value={f.scope ?? 'all'} onChange={(e) => set({ scope: e.target.value as NewsScope })}>{SCOPES.map((s) => <option key={s.id} value={s.id}>{s.l}</option>)}</select></label>
        <label>Period <select value={f.days} onChange={(e) => set({ days: Number(e.target.value) })}>{DAYS.map((d) => <option key={d.d} value={d.d}>{d.l}</option>)}</select></label>
        <label className="nwp-check"><input type="checkbox" checked={f.includeOther} onChange={(e) => set({ includeOther: e.target.checked })} /> Include other updates</label>
        <label className="nwp-check"><input type="checkbox" checked={f.covered} onChange={(e) => set({ covered: e.target.checked })} /> Every covered name</label>
        <label className="nwp-check"><input type="checkbox" checked={summaries} onChange={(e) => setSummaries(e.target.checked)} /> Show publisher summaries</label>
      </div>
      <div className="row" style={{ marginTop: 12 }}><button className="btn grow" onClick={() => { setF(NO_FILTER); setShown(PAGE); }}>Clear</button><button className="btn pri grow" onClick={() => setSheet(false)}>Show {plural(rows.length, 'event')}</button></div>
    </FilterSheet>}
    <NewsMethod extra={<><NewsCheckTimes h={b.health} />{snap ? <>
      <p><b>The last check, by source.</b></p>
      <table className="nwp-table"><thead><tr><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Answered</th><th scope="col">Failed</th></tr></thead><tbody>{snap.sources.map((x) => <tr key={x.id}><th scope="row">{x.label}</th><td>{x.status}{x.error ? ` (${x.error})` : ''}</td><td className="num">{(x.ok ?? 0) + 0}</td><td className="num">{(x.failed ?? 0) + (x.skipped ?? 0)}</td></tr>)}</tbody></table>
      <p style={{ marginTop: 10 }}><b>What was refused, by reason.</b></p>
      <table className="nwp-table"><tbody>{Object.entries(snap.rejections).sort((a, c) => c[1] - a[1]).map(([k, n]) => <tr key={k}><th scope="row">{k.replace(/_/g, ' ')}</th><td className="num">{n}</td><td>{(REJECT as Record<string, string>)[k] ?? ''}</td></tr>)}</tbody></table>
      <p className="mute" style={{ marginTop: 8 }}>Snapshot {snap.snapshotVersion} · pipeline {snap.pipelineVersion} · ranking {snap.rankingVersion} · scheduled {snap.scheduledAt ?? 'unknown'} · started {snap.startedAt ?? 'unknown'} · completed {snap.completedAt ?? 'unknown'} (UTC). {snap.coverage.unresolvedNames.length ? `Paper-book names with no known company name, not searched: ${snap.coverage.unresolvedNames.join(', ')}.` : ''}</p></> : null}</>} />
  </div>;
}
