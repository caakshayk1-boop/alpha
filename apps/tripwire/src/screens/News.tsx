import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { lastVisitSec, markVisited, useNameNews, useNewsBoard, type RefreshState } from '../news.ts';
import { isNewStory, plural, storyTime, type NewsHealth } from '../newshealth.ts';
import { fmtIst } from '../stamp.ts';
import { entityLine, inTab, labelsOf, safeHref, tabCounts, TABS, todayList, type Lists, type NewsEvent, type Tab } from '../newsview.ts';
import { RANKING_VERSION, PIPELINE_VERSION, TIERS, WEIGHTS, HALF_LIFE_H, TODAY_WINDOW_H, DIVERSITY, CADENCE, DELAY_AFTER, MAX_AGE_DAYS } from '../../news/config.js';
import { EVENT_TYPES, SIGNIFICANCE } from '../../news/events.js';

const TAGC: Record<string, string> = { Results: 'amber', IPO: 'violet', Deal: 'aqua', Order: 'blue', Rating: 'pink', Payout: 'lime', Regulator: 'peach', Policy: 'peach', Macro: 'blue', Filing: 'aqua', People: '', Update: '' };
const FLAG_WORD: Record<string, string> = { date_unknown: 'Publication time unknown', date_zone_assumed: 'Time zone not stated by the feed; read as the feed\'s own', aggregator_source: 'From an aggregator, not the original publisher', market_scope: 'India-wide: no single company', no_event_keyword: 'No event type recognised in the headline', exchange_filing: 'A dated exchange or regulator document' };

/** One line saying how current the news is, in the one vocabulary (newshealth.ts). */
export function NewsHealthLine({ h, full }: { h: NewsHealth; full?: boolean }) {
  return <div className={`nw-health ${h.state}`} role="status"><span className="nw-state"><span className="nw-dot" aria-hidden="true" />{h.word}</span><span className="nw-hline">{h.line}</span>
    {full && <dl className="nw-times"><div><dt>Last successful check</dt><dd>{h.lastGood ?? 'none yet'}</dd></div><div><dt>Latest check</dt><dd>{h.checked ?? 'none yet'}</dd></div><div><dt>Next check due</dt><dd>{h.state === 'unavailable' ? 'unknown' : h.next ?? 'unknown'}</dd></div></dl>}</div>;
}
const REFRESH_LABEL: Record<RefreshState, string> = { idle: 'Check for updates', checking: 'Checking…', updated: 'Updated', none: 'No new stories', failed: 'Failed, try again' };
export function RefreshControl({ state, message, onClick }: { state: RefreshState; message: string; onClick: () => void }) {
  return <span className="nw-refresh"><button className="btn sm" onClick={onClick} disabled={state === 'checking'} aria-describedby="nw-refresh-msg">{REFRESH_LABEL[state]}</button><span id="nw-refresh-msg" className="sr" role="status" aria-live="polite">{message}</span></span>;
}
export function UpdateOffer({ n, apply }: { n: number; apply: () => void }) {
  return <div className="nw-offer-wrap" aria-live="polite">{n > 0 && <button className="nw-offer" onClick={apply}><b>{plural(n, 'new update')}</b><span>Show</span></button>}</div>;
}

/** One event. `lead` draws the first row larger and gives its summary room; every row carries the same facts: headline (a link), source and publication age, one event tag, the company, an optional one-line summary, and a drawer. */
export function NewsRow({ ev, lists, lead, seenSec, nowMs, label }: { ev: NewsEvent; lists: Lists; lead?: boolean; seenSec: number; nowMs: number; label?: boolean }) {
  const t = storyTime(ev.publishedAt, nowMs); const href = safeHref(ev.canonicalUrl); const fresh = isNewStory(ev, seenSec); const tags = label ? labelsOf(ev, lists) : [];
  const first = storyTime(ev.firstSeenAt, nowMs); const unknownDate = !t.known;
  return <li className={`nw-row${lead ? ' lead' : ''}`}>
    {href ? <a className="nw-head" href={href} target="_blank" rel="noopener noreferrer">{ev.headline}<span className="sr"> (opens in a new tab)</span></a> : <span className="nw-head">{ev.headline}</span>}
    <span className="nw-meta">
      {fresh && <span className="tag aqua nw-tag" title="Published, and first seen by the news check, since you last looked">New</span>}
      <span>{ev.sourceTitle}{ev.moreSources > 0 ? ` +${plural(ev.moreSources, 'more source')}` : ''}</span><span aria-hidden="true">·</span>
      <time dateTime={ev.publishedAt ?? undefined} title={t.ist} className={unknownDate ? 'nw-unknown' : ''}>{t.ageWord}</time>
      <span className={`tag nw-tag ${TAGC[ev.eventType] ?? ''}`}>{ev.eventType}</span>
      <span className="nw-entity" title="The company this story was matched to by name or symbol">{entityLine(ev)}</span>
      {tags.map((x) => <span key={x} className="nw-label">{x}</span>)}
    </span>
    {ev.summary && <p className="nw-summary" title={`Source: the publisher's own description in ${ev.summary.provenance.feedId}, retrieved ${ev.summary.provenance.retrievedAt ?? 'at an unknown time'}`}>{ev.summary.text}</p>}
    <details className="nw-more"><summary>Coverage and ranking</summary><div className="nw-body">
      <p><b>{ev.sources.length > 1 ? `${plural(ev.sources.length, 'outlet')} carried this` : '1 outlet'}</b>{ev.sources.length > 1 ? '; the first listed is the primary source.' : '.'}</p>
      <ul className="nw-src">{ev.sources.map((s) => { const h = safeHref(s.canonicalUrl); const st = storyTime(s.publishedAt, nowMs); return <li key={s.sourceId}>{h ? <a href={h} target="_blank" rel="noopener noreferrer">{s.sourceTitle}</a> : s.sourceTitle} <span className="mute">· {s.tier} · {st.known ? st.ist : 'publication time unknown'}</span></li>; })}</ul>
      <p><b>Dates.</b> {t.known ? `First reported ${fmtIst(Date.parse(ev.publishedAt as string) / 1000, nowMs)}.` : 'The feed gave no usable publication time, so none is shown and the story is kept off Today.'} {first.known ? `First seen by the news check ${fmtIst(Date.parse(ev.firstSeenAt as string) / 1000, nowMs)}.` : ''}</p>
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
    <p><b>Order.</b> {RANKING_VERSION}, a fixed weighted sum, not a model: significance {WEIGHTS.significance}, verified company match {WEIGHTS.entity}, source reliability {WEIGHTS.source}, recency {WEIGHTS.recency}, novelty {WEIGHTS.novelty}, your lists {WEIGHTS.user}. Significance by type: {EVENT_TYPES.filter((x: string) => x !== 'Update').map((x: string) => `${x} ${(SIGNIFICANCE[x] ?? 0).toFixed(2)}`).join(', ')}. Recency halves every {HALF_LIFE_H.default} hours ({HALF_LIFE_H.Policy} for policy and macro). Source tiers: {Object.entries(TIERS as Record<string, number>).map(([k, v]) => `${k} ${v}`).join(', ')}. The wording of a headline (surges, slumps) never changes its rank.</p>
    <p><b>Today.</b> Company events up to {TODAY_WINDOW_H.company} hours old and India-wide events up to {TODAY_WINDOW_H.market} hours old, at most {DIVERSITY.perCompanyDefault} per company in the first {DIVERSITY.firstPage} ({DIVERSITY.perCompanyExtended} in the extended list; a regulator, policy or deal event carried by an official source or three outlets may take a third place). If three qualify, three are shown. The News page keeps the whole archive.</p>
    <p><b>Summaries.</b> Shown only when the publisher's own feed description is available and permitted (official release feeds); otherwise a story is its headline alone, with no summary and no judgement of its tone. Article bodies are never fetched.</p>
    <p className="mute">Pipeline {PIPELINE_VERSION}. Paper-only research; nothing here is a recommendation.</p>{extra}</div></details>;
}

function Tabs({ tab, setTab, counts }: { tab: Tab; setTab: (t: Tab) => void; counts: Record<Tab, number> }) {
  return <div className="nw-tabs" role="group" aria-label="Which updates">{TABS.map((t) => <button key={t.id} className="chip" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label} <span className="num mute">{counts[t.id]}</span></button>)}</div>;
}
/** What an empty tab says. Following never borrows the paper book's names. */
export function EmptyTab({ tab, lists, haveSnapshot, anyOther }: { tab: Tab; lists: Lists; haveSnapshot: boolean; anyOther: boolean }) {
  if (tab === 'following' && lists.follows.length === 0) return <div className="nw-empty"><b>You follow no companies yet.</b><p>Follow a company in Discover and its verified updates appear here. Following is only the names you choose; it is never filled from the paper book.</p><a className="btn sm pri" href="#/discover">Find companies in Discover</a></div>;
  if (tab === 'paper' && lists.paper.length === 0) return <div className="nw-empty"><b>The paper book holds no names right now.</b><p>Names in the paper book get their own tab. Nothing is borrowed from your follows.</p></div>;
  if (!haveSnapshot) return <div className="nw-empty"><b>No news has been published yet.</b><p>The first scheduled check has not completed. Nothing is shown in its place.</p></div>;
  return <div className="nw-empty"><b>No verified updates{tab === 'following' ? ' for the names you follow' : tab === 'paper' ? ' for the paper book' : tab === 'market' ? ' for the market' : ''} right now.</b><p>{anyOther ? 'Other tabs have some.' : 'Quiet days are quiet: nothing is added to fill the page.'}</p></div>;
}

/** Today's news block. One lead event and four compact updates, expandable to ten, never padded. Self-contained: it draws its own heading and takes no layout from its parent.
 *  `follows`: names the reader follows (state.follows). `paper`: names in the paper book. They are separate on purpose. */
export function WhatMattersNow({ follows, paper }: { follows: string[]; paper: string[] }) {
  const lists = useMemo<Lists>(() => ({ follows, paper }), [follows.join(), paper.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const b = useNewsBoard(lists); const [tab, setTab] = useState<Tab>('all'); const [more, setMore] = useState(false); const [seen] = useState(() => lastVisitSec());
  const list = useMemo(() => todayList(b.pool, tab, lists, b.at), [b.pool, tab, lists, b.at]); const counts = useMemo(() => tabCounts(b.pool, lists, b.at), [b.pool, lists, b.at]);
  const shown = more ? list : list.slice(0, 5); const rest = list.length - 5;
  useEffect(() => { if (!list.length) return; const t = window.setTimeout(() => markVisited(), 4000); return () => window.clearTimeout(t); }, [list.length]);
  const anyOther = (['market', 'following', 'paper'] as Tab[]).some((x) => x !== tab && counts[x] > 0);
  return <section className="nw" aria-labelledby="nw-title">
    <div className="nw-bar"><h2 id="nw-title" className="nw-title">What matters now</h2><a className="nw-all" href="#/news">All news</a></div>
    <NewsHealthLine h={b.health} />
    <Tabs tab={tab} setTab={(t) => { setTab(t); setMore(false); }} counts={counts} />
    <UpdateOffer n={b.pending} apply={b.apply} />
    {b.loading ? <div className="nw-skel" aria-hidden="true"><div className="sk" style={{ height: 18, width: '92%' }} /><div className="sk" style={{ height: 14, width: '60%' }} /><div className="sk" style={{ height: 14, width: '80%' }} /></div>
      : shown.length ? <ul className="nw-list">{shown.map((ev, i) => <NewsRow key={ev.eventClusterId} ev={ev} lists={lists} lead={i === 0} seenSec={seen} nowMs={b.at} label={tab === 'all'} />)}</ul>
      : <EmptyTab tab={tab} lists={lists} haveSnapshot={b.hasSnapshot} anyOther={anyOther} />}
    {!b.loading && shown.length > 0 && list.length <= shown.length && list.length < 10 && <p className="nw-quiet">{plural(list.length, 'verified update')}. There are no more right now.</p>}
    <div className="nw-foot">{rest > 0 ? <button className="btn sm" onClick={() => setMore(!more)} aria-expanded={more}>{more ? 'Show fewer' : `Show ${rest} more`}</button> : <span />}
      <RefreshControl state={b.refreshState.state} message={b.refreshState.message} onClick={() => void b.refresh()} /></div>
    {b.liveFailed > 0 && <p className="nw-quiet">{plural(b.liveFailed, 'followed name')} could not be checked just now.</p>}
    <NewsMethod />
  </section>;
}

/** News for one company, from its own name, through the same pipeline and gates: only stories that name it. */
export function CompanyNews({ name, sym }: { name: string; sym?: string }) {
  const n = useNameNews(name, sym ?? null); const h = n.r; const now = Date.now(); const lists: Lists = { follows: [], paper: [] };
  const events = useMemo(() => (h?.events ?? []).filter((e) => e.entities.length > 0).slice(0, 3), [h]);
  return <div className="card nw-company">
    {n.loading && !h ? <div style={{ padding: '12px 0' }}><div className="sk" style={{ height: 14, width: '90%', marginBottom: 8 }} /><div className="sk" style={{ height: 14, width: '70%' }} /></div>
      : h?.ok ? (events.length ? <ul className="nw-list">{events.map((ev) => <NewsRow key={ev.eventClusterId} ev={ev} lists={lists} seenSec={0} nowMs={now} />)}</ul> : <div className="nw-empty"><b>No verified update in the last 7 days.</b><p>Nothing that names this company and reports an event passed the filters.</p></div>)
        : <p className="small down" style={{ margin: '12px 0 0' }}>News could not be loaded ({h?.error ?? 'no answer'}). Nothing is shown in its place.</p>}
    <div className="nw-foot"><span className="small mute">{h?.checkedAt ? `Checked ${fmtIst(Date.parse(h.checkedAt) / 1000, now)}${h.ok ? '' : ' (last good copy)'}` : 'Not checked yet'}</span><button className="btn sm" onClick={n.refresh} disabled={n.loading}>{n.loading ? 'Checking…' : 'Check now'}</button></div>
    <p className="mute small" style={{ margin: '6px 0 0' }}>Stories are admitted only if they name this company and report an event. <a href="#/news" style={{ textDecoration: 'underline' }}>How news is chosen</a></p></div>;
}
export { inTab };
