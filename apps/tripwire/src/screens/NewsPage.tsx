import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '../app.tsx';
import { useAutoBook } from '../book.ts';
import { lastVisitSec, markVisited, useNewsBoard } from '../news.ts';
import { plural } from '../newshealth.ts';
import { archiveList, tabCounts, TABS, type ArchiveFilter, type Lists, type Tab } from '../newsview.ts';
import { PageBar } from './common.tsx';
import { NewsHealthLine, NewsMethod, NewsRow, RefreshControl, UpdateOffer, EmptyTab } from './News.tsx';
import { REJECT } from '../../news/rules.js';
import { EVENT_TYPES } from '../../news/events.js';

/** The names in the paper book, from the automatic book and the reader's own paper trades. Kept apart from follows. */
export function usePaperSyms(): string[] {
  const s = useAppState(); const auto = useAutoBook(false);
  return useMemo(() => [...new Set([...auto.rows.filter((r) => r.v.status === 'open' || r.v.status === 'pending' || r.v.status === 'waiting').map((r) => r.p.sym), ...s.paper.filter((p) => !p.closedByUser).map((p) => p.sym)])], [auto.rows, s.paper]);
}
const DAYS = [{ d: 2, l: 'Last 2 days' }, { d: 7, l: 'Last 7 days' }, { d: 14, l: 'Last 14 days' }];
const PAGE = 40;

/** The News page: the whole archive of what the checks kept, with the health of the checks, filters and the methodology in a Details drawer. #/news */
export function NewsPage() {
  const s = useAppState(); const paper = usePaperSyms(); const lists = useMemo<Lists>(() => ({ follows: s.follows, paper }), [s.follows, paper]);
  const b = useNewsBoard(lists); const [seen] = useState(() => lastVisitSec());
  const [f, setF] = useState<ArchiveFilter>({ tab: 'all', types: [], days: 7, includeOther: false, covered: false, text: '' }); const [shown, setShown] = useState(PAGE);
  useEffect(() => { document.title = 'News · Tripwire'; const t = window.setTimeout(() => markVisited(), 4000); return () => window.clearTimeout(t); }, []);
  const rows = useMemo(() => archiveList(b.pool, f, lists, b.at), [b.pool, f, lists, b.at]); const counts = useMemo(() => tabCounts(b.pool, lists, b.at), [b.pool, lists, b.at]);
  const types = useMemo(() => EVENT_TYPES.filter((t: string) => t !== 'Update' && b.pool.some((e) => e.eventType === t)), [b.pool]);
  const set = (p: Partial<ArchiveFilter>) => { setF({ ...f, ...p }); setShown(PAGE); };
  const snap = b.snapshot;
  return <div className="nw">
    <PageBar title="News" onBack sub={`${b.health.word}${b.health.lastGood ? ` · last good check ${b.health.lastGood}` : ''}`} />
    <NewsHealthLine h={b.health} full />
    <div className="nw-tabs" role="group" aria-label="Which updates">{TABS.map((t) => <button key={t.id} className="chip" aria-pressed={f.tab === t.id} onClick={() => set({ tab: t.id as Tab })}>{t.label} <span className="num mute">{counts[t.id as Tab]}</span></button>)}</div>
    <div className="nwp-filters">
      <label>Event type <select value={f.types[0] ?? ''} onChange={(e) => set({ types: e.target.value ? [e.target.value] : [] })}><option value="">All types</option>{types.map((t: string) => <option key={t} value={t}>{t}</option>)}</select></label>
      <label>Period <select value={f.days} onChange={(e) => set({ days: Number(e.target.value) })}>{DAYS.map((d) => <option key={d.d} value={d.d}>{d.l}</option>)}</select></label>
      <label><input type="search" placeholder="Search headline or symbol" aria-label="Search headline or symbol" value={f.text} onChange={(e) => set({ text: e.target.value })} /></label>
      <label><input type="checkbox" checked={f.includeOther} onChange={(e) => set({ includeOther: e.target.checked })} /> Include other updates</label>
      <label><input type="checkbox" checked={f.covered} onChange={(e) => set({ covered: e.target.checked })} /> Every covered name</label>
    </div>
    <UpdateOffer n={b.pending} apply={b.apply} />
    <div className="nw-foot" style={{ marginTop: 0, marginBottom: 6 }}><p className="nwp-count" role="status">{b.loading ? 'Loading…' : `${plural(rows.length, 'update')}${f.includeOther ? '' : ' (events only)'}`}</p><RefreshControl state={b.refreshState.state} message={b.refreshState.message} onClick={() => void b.refresh()} /></div>
    <div className="card" style={{ padding: '2px 14px 8px' }}>
      {b.loading ? <div className="nw-skel" aria-hidden="true"><div className="sk" style={{ height: 18, width: '90%' }} /><div className="sk" style={{ height: 14, width: '65%' }} /></div>
        : rows.length ? <ul className="nw-list">{rows.slice(0, shown).map((ev) => <NewsRow key={ev.eventClusterId} ev={ev} lists={lists} seenSec={seen} nowMs={b.at} label />)}</ul>
        : <EmptyTab tab={f.tab} lists={lists} haveSnapshot={b.hasSnapshot} anyOther={false} />}
      {rows.length > shown && <div className="nw-foot"><button className="btn sm" onClick={() => setShown(shown + PAGE)}>{`Show ${Math.min(PAGE, rows.length - shown)} more`}</button><span className="small mute">{shown} of {rows.length}</span></div>}
    </div>
    <NewsMethod extra={snap ? <>
      <p><b>The last check, by source.</b></p>
      <table className="nwp-table"><thead><tr><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Answered</th><th scope="col">Failed</th></tr></thead><tbody>{snap.sources.map((x) => <tr key={x.id}><th scope="row">{x.label}</th><td>{x.status}{x.error ? ` (${x.error})` : ''}</td><td className="num">{(x.ok ?? 0) + 0}</td><td className="num">{(x.failed ?? 0) + (x.skipped ?? 0)}</td></tr>)}</tbody></table>
      <p style={{ marginTop: 10 }}><b>What was refused, by reason.</b></p>
      <table className="nwp-table"><tbody>{Object.entries(snap.rejections).sort((a, c) => c[1] - a[1]).map(([k, n]) => <tr key={k}><th scope="row">{k.replace(/_/g, ' ')}</th><td className="num">{n}</td><td>{(REJECT as Record<string, string>)[k] ?? ''}</td></tr>)}</tbody></table>
      <p className="mute" style={{ marginTop: 8 }}>Snapshot {snap.snapshotVersion} · pipeline {snap.pipelineVersion} · ranking {snap.rankingVersion} · scheduled {snap.scheduledAt ?? 'unknown'} · started {snap.startedAt ?? 'unknown'} · completed {snap.completedAt ?? 'unknown'} (UTC). {snap.coverage.unresolvedNames.length ? `Paper-book names with no known company name, not searched: ${snap.coverage.unresolvedNames.join(', ')}.` : ''}</p></> : null} />
  </div>;
}
