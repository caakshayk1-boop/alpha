import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../ui.tsx';
import { lastVisitSec, markVisited, useNameNews, useNewsBoard, type RefreshState } from '../news.ts';
import { isNewStory, newsViewState, type NewsView, plural, storyTime, type NewsHealth } from '../newshealth.ts';
import { fmtIst } from '../stamp.ts';
import { checkedLabel } from '../timelabels.ts';
import { categoryOf, COUNT_DEFINITION, inTab, labelsOf, safeHref, timeLabels, todayTabCounts, TABS, todayList, type Lists, type NewsEvent, type Tab } from '../newsview.ts';
import { RANKING_VERSION, PIPELINE_VERSION, TIERS, WEIGHTS, HALF_LIFE_H, TODAY_WINDOW_H, DIVERSITY, CADENCE, DELAY_AFTER, MAX_AGE_DAYS } from '../../news/config.js';
import { EVENT_TYPES, SIGNIFICANCE } from '../../news/events.js';

const TAGC: Record<string, string> = { Results: 'amber', IPO: 'violet', Deal: 'aqua', Order: 'blue', Rating: 'pink', Payout: 'lime', Regulator: 'peach', Policy: 'peach', Macro: 'blue', Filing: 'aqua', People: '', Update: '' };
const FLAG_WORD: Record<string, string> = { date_unknown: 'Publication time unknown', date_zone_assumed: 'Time zone not stated by the feed; read as the feed\'s own', aggregator_source: 'From an aggregator, not the original publisher', market_scope: 'India-wide: no single company', no_event_keyword: 'No event type recognised in the headline', exchange_filing: 'A dated exchange or regulator document' };

/** Presentation only: never writes the research, holdings or news-seen stores. */
export function useNewsPreference(key: 'minimised' | 'summaries' | 'companyMinimised') {
  const storageKey = `tripwire:news:${key}`;
  const [value, setValue] = useState(() => { try { return localStorage.getItem(storageKey) === 'true'; } catch { return false; } });
  const change = (next: boolean) => { setValue(next); try { localStorage.setItem(storageKey, String(next)); } catch { /* The control still works when storage is unavailable. */ } };
  return [value, change] as const;
}
export function NewsReadingControl({ summaries, setSummaries }: { summaries: boolean; setSummaries: (v: boolean) => void }) {
  return <button className="btn sm" aria-pressed={summaries} onClick={() => setSummaries(!summaries)}>Show summaries</button>;
}

/** One line saying how current the news is, in the one vocabulary (newshealth.ts). */
export function NewsHealthLine({ h, full, compact }: { h: NewsHealth; full?: boolean; compact?: boolean }) {
  // compact (the News page header, revamp v2): the word shows; the sentence is spoken and is the tooltip, and the page prints it once under the title
  return <div className={`nw-health ${h.state}${compact ? ' compact' : ''}`} role="status" data-news-state={h.state} title={compact ? h.line : undefined}><span className="nw-state"><span className="nw-dot" aria-hidden="true" />{h.word}</span><span className={compact ? 'nw-hline sr' : 'nw-hline'}>{h.line}</span>
    {full && <details className="nw-checks"><summary>Check details</summary><NewsCheckTimes h={h} /></details>}</div>;
}
export function NewsCheckTimes({ h }: { h: NewsHealth }) {
  return <dl className="nw-times"><div><dt>Last successful check</dt><dd>{h.state === 'loading' ? 'checking…' : h.lastGood ?? 'none yet'}</dd></div>{h.onDemand && <div><dt>Refreshed on demand</dt><dd>{h.onDemand}</dd></div>}<div><dt>Latest check</dt><dd>{h.state === 'loading' ? 'checking…' : h.checked ?? 'none yet'}</dd></div><div><dt>Next check due</dt><dd>{h.state === 'loading' ? 'checking…' : h.state === 'unavailable' || h.state === 'error' ? 'unknown' : h.next ?? 'unknown'}</dd></div></dl>;
}
const REFRESH_LABEL: Record<RefreshState, string> = { idle: 'Check for updates', checking: 'Checking…', updated: 'Updated', none: 'No new stories', failed: 'Failed, try again' };
/** `icon`: the News page's header form (revamp v2, 11 Nov 2026), a 44 px icon button whose name is the same words the text button shows; the state is still spoken and still in its title. */
export function RefreshControl({ state, message, onClick, icon = false }: { state: RefreshState; message: string; onClick: () => void; icon?: boolean }) {
  const id = useId();
  if (icon) return <span className={`nw-refresh nw-refresh-icon is-${state}`}><button className="icon-btn" onClick={onClick} disabled={state === 'checking'} aria-describedby={id} aria-label={REFRESH_LABEL[state]} title={REFRESH_LABEL[state]}><Icon n="refresh" /></button><span id={id} className="sr" role="status" aria-live="polite">{message}</span></span>;
  return <span className="nw-refresh"><button className="btn sm" onClick={onClick} disabled={state === 'checking'} aria-describedby={id}>{REFRESH_LABEL[state]}</button><span id={id} className="sr" role="status" aria-live="polite">{message}</span></span>;
}
export function UpdateOffer({ n, apply }: { n: number; apply: () => void }) {
  return <div className="nw-offer-wrap" aria-live="polite">{n > 0 && <button className="nw-offer" onClick={apply}><b>{plural(n, 'new update')}</b><span>Show</span></button>}</div>;
}

/** One event. `lead` draws the first row larger and gives its summary room; every row carries the same facts: headline (a link), source and publication age, one event tag, the company, an optional one-line summary, and a drawer. */
/** `board` (the News page, revamp v2): the section heading says why the row is listed, so no list labels; the row carries a source-count chip and, under Your names, an "In paper book" chip
 *  instead of a second copy of the headline under Paper book. */
export function NewsRow({ ev, lists, lead, seenSec, nowMs, label, summaries = false, companySym, board = false, inPaper = false }: { ev: NewsEvent; lists: Lists; lead?: boolean; seenSec: number; nowMs: number; label?: boolean; summaries?: boolean; companySym?: string; board?: boolean; inPaper?: boolean }) {
  const t = storyTime(ev.publishedAt, nowMs); const href = safeHref(ev.canonicalUrl); const fresh = isNewStory(ev, seenSec); const tags = label ? labelsOf(ev, lists) : [];
  const first = storyTime(ev.firstSeenAt, nowMs); const unknownDate = !t.known; const clk = timeLabels(ev, nowMs);
  const nSrc = Math.max(ev.sources.length, ev.moreSources + 1, 1);
  return <li className={`nw-row${lead ? ' lead' : ''}${board ? ' nw-board' : ''}`}>
    {href ? <a className="nw-head" href={href} target="_blank" rel="noopener noreferrer">{ev.headline}<span className="sr"> (opens in a new tab)</span></a> : <span className="nw-head">{ev.headline}</span>}
    <span className="nw-meta">
      {fresh && <span className="tag aqua nw-tag" title="Published, and first seen by the news check, since you last looked">New</span>}
      <span>{ev.sourceTitle}</span><span aria-hidden="true">·</span>
      <time dateTime={ev.publishedAt ?? undefined} title={t.ist} className={unknownDate ? 'nw-unknown' : ''} data-clock="published"><span className="sr">Published </span>{t.ageWord}</time>
      <span className={`tag nw-tag ${TAGC[ev.eventType] ?? ''}`} title={board ? categoryOf(ev.eventType) : undefined}>{ev.eventType}</span>
      {board && nSrc > 1 && <span className="tag nw-src-n" title={`${plural(nSrc, 'outlet')} carried this event`}>{plural(nSrc, 'source')}</span>}
      {board && inPaper && <span className="tag nw-inpaper">In paper book</span>}
      {ev.entities.filter((e) => e.sym !== companySym).map((e) => e.sym ? <a key={e.sym} className="nw-entity" href={`#/c/${encodeURIComponent(e.sym)}`} title={`Research ${e.name ?? e.sym}`}>{e.sym}<span className="sr"> company evidence</span></a> : <span key={e.name} className="nw-entity">{e.name}</span>)}
      {tags.map((x) => <span key={x} className="nw-label">{x}</span>)}
    </span>
    {summaries && ev.summary && <p className="nw-summary" title={`Publisher description: ${ev.summary.provenance.feedId}; retrieved ${ev.summary.provenance.retrievedAt ?? 'at an unknown time'}`}>{ev.summary.text}</p>}
    <details className="nw-more"><summary>{!board && ev.moreSources > 0 ? `${plural(ev.moreSources + 1, 'source')} · ` : ''}Evidence &amp; context</summary><div className="nw-body">
      {!summaries && ev.summary && <p className="nw-summary">{ev.summary.text}<span className="mute"> — {ev.summary.provenance.feedId}, publisher description</span></p>}
      <p><b>{ev.sources.length > 1 ? `${plural(ev.sources.length, 'outlet')} carried this` : '1 outlet'}</b>{ev.sources.length > 1 ? '; the first listed is the primary source.' : '.'}</p>
      <ul className="nw-src" data-cover>{ev.sources.map((s) => { const h = safeHref(s.canonicalUrl); const st = storyTime(s.publishedAt, nowMs); return <li key={s.sourceId}>{h ? <a href={h} target="_blank" rel="noopener noreferrer">{s.sourceTitle}<span className="sr"> (opens in a new tab)</span></a> : s.sourceTitle} <span className="mute">· {s.tier} · {st.known ? st.ist : 'publication time unknown'}</span></li>; })}</ul>
      <p className="nw-clocks" data-clocks>{clk.collected}{clk.gap ? ` · ${clk.gap}` : ''}</p>
      <dl className="nw-dates" data-dates><div><dt>Published (the outlet's own time)</dt><dd>{t.known ? fmtIst(Date.parse(ev.publishedAt as string) / 1000, nowMs) : 'not given by the feed'}</dd></div><div><dt>Collected (first seen by Tripwire's check)</dt><dd>{first.known ? fmtIst(Date.parse(ev.firstSeenAt as string) / 1000, nowMs) : 'unknown'}</dd></div><div><dt>Category</dt><dd>{categoryOf(ev.eventType)}</dd></div></dl>
      <p className="mute small">{t.known ? 'Headline age uses the publication time. Collection is when Tripwire first found it.' : 'The feed gave no usable publication time, so none is shown (the collection time is not a substitute) and the story is kept off Today.'}</p>
      {ev.rank && <><p><b>Why it ranks here.</b> {ev.rank.reason}.</p><table className="nw-factors"><caption className="sr">Ranking factors</caption><thead><tr><th scope="col">Factor</th><th scope="col">Value</th><th scope="col">Weight</th><th scope="col">Points</th></tr></thead><tbody>{ev.rank.factors.map((f) => <tr key={f.k}><th scope="row">{f.k}</th><td className="num">{f.value.toFixed(2)}</td><td className="num">{f.weight.toFixed(2)}</td><td className="num">{f.points.toFixed(1)}</td></tr>)}</tbody></table><p className="mute small">Ranking {ev.rankingVersion}. A keyword rule typed this as {ev.eventType}; it says what the story is about, never whether it is good news.</p></>}
      {ev.qualityFlags.length > 0 && <p className="small">{ev.qualityFlags.map((f) => FLAG_WORD[f] ?? f).join(' · ')}</p>}
    </div></details>
  </li>;
}

/** How and why, once, behind a drawer: never under each headline. */
export function NewsMethod({ extra }: { extra?: ReactNode }) {
  return <details className="ev nw-method"><summary>Details: how these are chosen<span className="chev">▾</span></summary><div className="body small">
    <p><b>Where it comes from.</b> A scheduled job (GitHub Actions, no browser needed) reads Google News and Bing News search feeds, the RBI and SEBI release feeds, for the paper book's names, a rotating share of other large names, and the market. It publishes one snapshot that every reader shares. Names you follow that the snapshot does not cover are searched live, through the same rules, and kept five minutes. The job's own clock is best-effort: runs can start minutes late, which is why the page says "delayed" rather than trusting it.</p>
    <p><b>Schedule.</b> Every {CADENCE.session} minutes while the NSE cash session is on (by the exchange calendar, holidays included), every {CADENCE.off} minutes otherwise. The page calls the news delayed after {DELAY_AFTER.cadences} cadences plus {DELAY_AFTER.graceMin} minutes without a successful check. It never calls anything live: these are free feeds and may lag the sources, and no promise of real-time delivery is made.</p>
    <p><b>What is admitted.</b> A dated story with a readable link, a publication time that is not in the future and is under {MAX_AGE_DAYS} days old, in English, that names a covered company (by its name, an alias, or its symbol with an exchange marker; never inside another word, and a symbol that is also a common word such as SAIL, PAGE or IDEA needs "NSE:" beside it), or an India-wide event (RBI, SEBI, rates, inflation, tariffs, flows, crude, the rupee). Share-price and quote pages, announcements index pages, technical-price commentary, "stocks to watch", Gift Nifty and market-wrap previews, tip-sheet language, other countries' markets and mixed-language filler are refused, and each refusal is counted. A dated exchange or regulator document is admitted. Nothing is ever admitted by a "wider match".</p>
    <p><b>Same story, once.</b> Links are canonicalised (trackers, www, amp and fragments removed). Items about the same company within three days that share most of their words, or state the same figure for the same kind of event, are one event: the most authoritative outlet is primary and the rest are counted as more sources. A buyback and a results night, or "profit up 5%" and "profit down 3%", stay separate events.</p>
    <p data-news-definition><b>What the numbers count.</b> {COUNT_DEFINITION} A number on a tab is the number of events listed once you press it, under the same filters.</p>
    <p><b>Order.</b> {RANKING_VERSION}, a fixed weighted sum, not a model: significance {WEIGHTS.significance}, verified company match {WEIGHTS.entity}, source reliability {WEIGHTS.source}, recency {WEIGHTS.recency}, novelty {WEIGHTS.novelty}, your lists {WEIGHTS.user}. Significance by type: {EVENT_TYPES.filter((x: string) => x !== 'Update').map((x: string) => `${x} ${(SIGNIFICANCE[x] ?? 0).toFixed(2)}`).join(', ')}. Recency halves every {HALF_LIFE_H.default} hours ({HALF_LIFE_H.Policy} for policy and macro). Source tiers: {Object.entries(TIERS as Record<string, number>).map(([k, v]) => `${k} ${v}`).join(', ')}. The wording of a headline (surges, slumps) never changes its rank.</p>
    <p><b>Today.</b> Company events up to {TODAY_WINDOW_H.company} hours old and India-wide events up to {TODAY_WINDOW_H.market} hours old, at most {DIVERSITY.perCompanyDefault} per company in the first {DIVERSITY.firstPage} ({DIVERSITY.perCompanyExtended} in the extended list; a regulator, policy or deal event carried by an official source or three outlets may take a third place). If three qualify, three are shown. The News page keeps the whole archive.</p>
    <p><b>Summaries.</b> Shown only when the publisher's own feed description is available and permitted (official release feeds); otherwise a story is its headline alone, with no summary and no judgement of its tone. Article bodies are never fetched.</p>
    <p className="mute">Pipeline {PIPELINE_VERSION}. Paper-only research; nothing here is a recommendation.</p>{extra}</div></details>;
}

function Tabs({ tab, setTab, counts }: { tab: Tab; setTab: (t: Tab) => void; counts: Record<Tab, number> }) {
  return <div className="nw-tabs" role="group" aria-label="Which updates">{TABS.map((t) => <button key={t.id} className="chip" aria-pressed={tab === t.id} aria-label={`${t.label}: ${counts[t.id]} ${counts[t.id] === 1 ? 'event' : 'events'}`} onClick={() => setTab(t.id)}>{t.label} <span className="num mute">{counts[t.id]}</span></button>)}</div>;
}
/** What an empty tab says. Following never borrows the paper book's names. */
export function EmptyTab({ tab, lists, haveSnapshot, anyOther, view }: { tab: Tab; lists: Lists; haveSnapshot: boolean; anyOther: boolean; view?: NewsView }) {
  if (view === 'error') return <div className="nw-empty" data-news-empty="error"><b>News could not be loaded.</b><p>The news service did not answer and no earlier copy is saved on this device. This is a failure to load, not a quiet day. Nothing is shown in its place; use Check for updates to try again.</p></div>;
  if (view === 'delayed') return <div className="nw-empty" data-news-empty="delayed"><b>No stories to show, and the news check is delayed.</b><p>The last good check is older than its schedule allows, so this list may be missing recent stories. It is not a statement that nothing happened.</p></div>;
  if (tab === 'following' && lists.follows.length === 0) return <div className="nw-empty"><b>You follow no companies yet.</b><p>Follow a company in Discover and its verified updates appear here. Following is only the names you choose; it is never filled from the paper book.</p><a className="btn sm pri" href="#/discover">Find companies in Discover</a></div>;
  if (tab === 'paper' && lists.paper.length === 0) return <div className="nw-empty"><b>The paper book holds no names right now.</b><p>Names in the paper book get their own tab. Nothing is borrowed from your follows.</p></div>;
  if (!haveSnapshot) return <div className="nw-empty"><b>No news has been published yet.</b><p>The first scheduled check has not completed. Nothing is shown in its place.</p></div>;
  return <div className="nw-empty"><b>No verified updates{tab === 'following' ? ' for the names you follow' : tab === 'paper' ? ' for the paper book' : tab === 'market' ? ' for the market' : ''} right now.</b><p>{anyOther ? 'Other tabs have some.' : 'Quiet days are quiet: nothing is added to fill the page.'}</p></div>;
}

/** Today's news block. One lead event and four compact updates, expandable to ten, never padded. Self-contained: it draws its own heading and takes no layout from its parent.
 *  `follows`: names the reader follows (state.follows). `paper`: names in the paper book. They are separate on purpose. */
export function WhatMattersNow({ follows, paper }: { follows: string[]; paper: string[] }) {
  const lists = useMemo<Lists>(() => ({ follows, paper }), [follows.join(), paper.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [minimised, setMinimised] = useNewsPreference('minimised'); const [summaries, setSummaries] = useNewsPreference('summaries'); const contentId = useId();
  const b = useNewsBoard(lists); const [tab, setTab] = useState<Tab>('all'); const [more, setMore] = useState(false); const [seen] = useState(() => lastVisitSec());
  const list = useMemo(() => todayList(b.pool, tab, lists, b.at), [b.pool, tab, lists, b.at]); const counts = useMemo(() => todayTabCounts(b.pool, lists, b.at), [b.pool, lists, b.at]);
  const shown = more ? list : list.slice(0, 5); const rest = list.length - 5;
  useEffect(() => { if (minimised || !list.length) return; const t = window.setTimeout(() => markVisited(), 4000); return () => window.clearTimeout(t); }, [list.length, minimised]);
  const view = newsViewState(b.health, { loading: b.loading, rows: list.length }); const anyOther = (['market', 'following', 'paper'] as Tab[]).some((x) => x !== tab && counts[x] > 0);
  return <section className="nw" aria-labelledby="nw-title">
    <div className="nw-bar"><h2 id="nw-title" className="nw-title">What matters now</h2><div className="nw-actions"><button className="btn sm" aria-expanded={!minimised} aria-controls={contentId} onClick={() => setMinimised(!minimised)}>{minimised ? 'Expand news' : 'Minimise'}</button><a className="nw-all" href="#/news">All news</a></div></div>
    <NewsHealthLine h={b.health} />
    <p className="sr" data-news-view>{view}</p>
    {minimised && <p className="nw-quiet">{b.loading ? 'Checking headlines…' : `${plural(list.length, 'event')} in ${TABS.find((t) => t.id === tab)?.label ?? 'All'}`}{b.pending > 0 ? ` · ${plural(b.pending, 'new update')} available` : ''}</p>}
    <div id={contentId} hidden={minimised}>
    <Tabs tab={tab} setTab={(t) => { setTab(t); setMore(false); }} counts={counts} />
    <UpdateOffer n={b.pending} apply={b.apply} />
    {b.loading ? <div className="nw-skel" aria-hidden="true"><div className="sk" style={{ height: 18, width: '92%' }} /><div className="sk" style={{ height: 14, width: '60%' }} /><div className="sk" style={{ height: 14, width: '80%' }} /></div>
      : shown.length ? <ul className="nw-list">{shown.map((ev, i) => <NewsRow key={ev.eventClusterId} ev={ev} lists={lists} lead={i === 0} seenSec={seen} nowMs={b.at} label={tab === 'all'} summaries={summaries} />)}</ul>
      : <EmptyTab tab={tab} lists={lists} haveSnapshot={b.hasSnapshot} anyOther={anyOther} view={view} />}
    {!b.loading && shown.length > 0 && list.length <= shown.length && list.length < 10 && <p className="nw-quiet">{plural(list.length, 'verified update')}. There are no more right now.</p>}
    <div className="nw-reading"><NewsReadingControl summaries={summaries} setSummaries={setSummaries} /></div>
    <div className="nw-foot">{rest > 0 ? <button className="btn sm" onClick={() => setMore(!more)} aria-expanded={more}>{more ? 'Show fewer' : `Show ${rest} more`}</button> : <span />}
      <RefreshControl state={b.refreshState.state} message={b.refreshState.message} onClick={() => void b.refresh()} /></div>
    {b.liveFailed > 0 && <p className="nw-quiet">{plural(b.liveFailed, 'followed name')} could not be checked just now.</p>}
    </div>
    {!minimised && <NewsMethod />}
  </section>;
}

/** News for one company, from its own name, through the same pipeline and gates: only stories that name it. */
export function CompanyNews({ name, sym }: { name: string; sym?: string }) {
  const [minimised, setMinimised] = useNewsPreference('companyMinimised'); const contentId = useId();
  const n = useNameNews(name, sym ?? null); const h = n.r; const now = Date.now(); const lists: Lists = { follows: [], paper: [] };
  const events = useMemo(() => (h?.events ?? []).filter((e) => e.entities.length > 0).slice(0, 3), [h]);
  return <div className="card nw-company">
    <div className="nw-bar"><span className="small mute">{n.loading ? 'Checking headlines…' : !h?.ok ? 'News unavailable' : plural(events.length, 'recent event')}</span><button className="btn sm" aria-expanded={!minimised} aria-controls={contentId} onClick={() => setMinimised(!minimised)}>{minimised ? 'Expand news' : 'Minimise'}</button></div>
    <div id={contentId} hidden={minimised}>
    {n.loading && !h ? <div style={{ padding: '12px 0' }}><div className="sk" style={{ height: 14, width: '90%', marginBottom: 8 }} /><div className="sk" style={{ height: 14, width: '70%' }} /></div>
      : h?.ok ? (events.length ? <ul className="nw-list">{events.map((ev) => <NewsRow key={ev.eventClusterId} ev={ev} lists={lists} seenSec={0} nowMs={now} companySym={sym} />)}</ul> : <div className="nw-empty"><b>No verified update in the last 7 days.</b><p>Nothing that names this company and reports an event passed the filters.</p></div>)
        : <p className="small down" style={{ margin: '12px 0 0' }}>News could not be loaded ({h?.error ?? 'no answer'}). Nothing is shown in its place.</p>}
    </div>
    <div className="nw-foot"><span className="small mute">{checkedLabel(h?.checkedAt, now, { ok: h ? h.ok : true })}</span><button className="btn sm" onClick={n.refresh} disabled={n.loading}>{n.loading ? 'Checking…' : 'Check now'}</button></div>
    <p className="mute small" style={{ margin: '6px 0 0' }}><a href="#/news" style={{ textDecoration: 'underline' }}>How news is chosen</a></p></div>;
}
export { inTab };
