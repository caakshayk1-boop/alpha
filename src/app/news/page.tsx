// Purpose: what is being said today about the companies you follow, then the rest of the market's stories. Primary action:
// open a story at its publisher. Everything here is rule-based and shows its basis: themes from words in the story, companies
// from the exact name or ticker (lib/newsdesk.ts makeMatcher, deliberately strict), day moves from the live snapshot or the
// screen's close, whichever is the newer session (lib/price.ts).
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CompanyPeek } from '@/components/Peek';
import { Chg, PageHead, Skel } from '@/components/ui';
import { useSignals, useFeed, useLive } from '@/lib/data';
import { priceLabel, priceView, sessionLabel } from '@/lib/price';
import { screenClass } from '@/lib/decision';
import { plainText } from '@/lib/format';
import { groupStories } from '@/lib/news';
import { BUCKETS, TOPICS, bucketOf, makeMatcher, summarise, topicsOf, type Mention, type TopicId } from '@/lib/newsdesk';
import { companyHref } from '@/lib/slug';
import { useStoredList } from '@/lib/store';

const SEEN = 'alpha-news-seen', SAVED = 'alpha-news-saved', VISIT = 'alpha-news-visit';
type View = 'all' | 'unread' | 'saved';
const VIEWS: readonly [View, string][] = [['all', 'All'], ['unread', 'Unread'], ['saved', 'Saved']];

const read = (key: string): string[] => { try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; } };
const write = (key: string, v: string[]) => { try { localStorage.setItem(key, JSON.stringify(v.slice(-400))); } catch { /* storage blocked or full: the page works without it */ } };

const clock = (iso?: string | null) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return 'time not stated';
  const o = { timeZone: 'Asia/Kolkata' } as const;
  return `${d.toLocaleDateString('en-GB', { ...o, day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { ...o, hour: '2-digit', minute: '2-digit', hour12: false })} IST`;
};

/** The matcher's basis, in a sentence a reader can check against the headline. */
const basisWords = (m: Mention) => m.basis.startsWith('ticker ') ? `its ticker ${m.sym}, written in capitals`
  : m.basis.includes('a large company') ? `the word ${m.basis.split(' (')[0]}: a large company, and no other listed name starts with it`
    : `its full name ${m.basis}`;

type Item = { story: { title: string; summary: string; source: string; link: string; published?: string }; topics: TopicId[]; mentions: Mention[]; text: string };

export default function News() {
  const feed = useFeed('news');
  const scr = useFeed('screen');
  const eng = useSignals();
  const lv = useLive();
  const [watch] = useStoredList('alpha-watchlist');

  // state kept in the address, so a filtered view can be shared or returned to
  const [topic, setTopic] = useState<TopicId | ''>('');
  const [source, setSource] = useState('');
  const [view, setView] = useState<View>('all');
  const [q, setQ] = useState('');
  const [peek, setPeek] = useState<string | null>(null);
  const ready = useRef(false);
  const [seen, setSeen] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [lastVisit, setLastVisit] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('topic'), v = p.get('view');
    if (TOPICS.some((x) => x.id === t)) setTopic(t as TopicId);
    if (VIEWS.some(([k]) => k === v)) setView(v as View);
    setSource(p.get('source') ?? ''); setQ(p.get('q') ?? '');
    setSeen(read(SEEN)); setSaved(read(SAVED));
    const prev = Number(read(VISIT)[0]);
    setLastVisit(Number.isFinite(prev) && prev > 0 ? prev : null);
    write(VISIT, [String(Date.now())]);
    ready.current = true;
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!ready.current) return;
    const p = new URLSearchParams();
    if (topic) p.set('topic', topic); if (source) p.set('source', source); if (view !== 'all') p.set('view', view); if (q.trim()) p.set('q', q.trim());
    const s = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${s ? `?${s}` : ''}`);
  }, [topic, source, view, q]);

  const markSeen = useCallback((link: string) => setSeen((cur) => { if (cur.includes(link)) return cur; const n = [...cur, link]; write(SEEN, n); return n; }), []);
  const toggleSaved = useCallback((link: string) => setSaved((cur) => { const n = cur.includes(link) ? cur.filter((x) => x !== link) : [...cur, link]; write(SAVED, n); return n; }), []);

  const rows = scr.data?.rows;
  const byIndex = useMemo(() => new Map((rows ?? []).map((r) => [r.sym, r])), [rows]);
  const cos = useMemo(() => (rows ?? []).map((r) => ({ sym: r.sym, name: r.name, mcap: r.mcap_cr })), [rows]);
  // Day moves follow the site's one rule (lib/price.ts): live when the snapshot is a newer session than the screen, else the close.
  const asOf = scr.data?.breadth.as_of ?? rows?.[0]?.last_date ?? null;
  const mv = (sym: string) => priceView(sym, byIndex.get(sym), lv.snap).pct;
  const dayNote = lv.snap && (!asOf || lv.snap.session > asOf) ? priceLabel({ source: 'live', session: lv.snap.session, at: lv.snap.newest }).text : `${sessionLabel(asOf)} close`;
  const signalSyms = useMemo(() => new Set((eng.data?.signals ?? []).filter((s) => s.status === 'open' || s.status === 'pending').map((s) => s.sym)), [eng.data]);

  const match = useMemo(() => makeMatcher(cos), [cos]);
  const items = useMemo<Item[]>(() => (feed.data ?? []).map((story) => {
    const text = `${plainText(story.title)}. ${plainText(story.summary)}`;
    return { story, topics: topicsOf(text), mentions: match(text) as Mention[], text: text.toLowerCase() };
  }), [feed.data, match]);
  const desk = useMemo(() => summarise(items, (sym) => byIndex.get(sym)?.sector), [items, byIndex]);
  const sources = useMemo(() => Array.from(new Set(items.map((i) => i.story.source))).sort(), [items]);
  const newest = useMemo(() => items.map((i) => i.story.published).filter((x): x is string => !!x && !Number.isNaN(Date.parse(x))).sort().pop() ?? null, [items]);

  // 1. your names: every story that names a company you follow, newest first, each with the rule that matched it
  const yours = useMemo(() => {
    const w = new Set(watch);
    return items.map((i) => ({ i, hits: i.mentions.filter((m) => w.has(m.sym)) })).filter((x) => x.hits.length > 0)
      .sort((a, b) => (b.i.story.published ?? '').localeCompare(a.i.story.published ?? ''));
  }, [items, watch]);
  const yourLinks = useMemo(() => new Set(yours.map((y) => y.i.story.link)), [yours]);

  // 2. everything else, filtered
  const query = q.trim().toLowerCase();
  const shown = useMemo(() => items.filter((i) => {
    if (topic && !i.topics.includes(topic)) return false;
    if (source && i.story.source !== source) return false;
    if (query && !i.text.includes(query) && !i.mentions.some((m) => m.sym.toLowerCase() === query)) return false;
    if (view === 'unread' && seen.includes(i.story.link)) return false;
    if (view === 'saved' && !saved.includes(i.story.link)) return false;
    return true;
  }).sort((a, b) => (b.story.published ?? '').localeCompare(a.story.published ?? '')), [items, topic, source, query, view, seen, saved]);

  const groups = useMemo(() => groupStories(shown.map((i) => ({ ...i.story, _i: i }))), [shown]);
  const sections = useMemo(() => BUCKETS.map((b) => ({ b, gs: groups.filter((g) => bucketOf(g.lead.published, now) === b) })).filter((s) => s.gs.length > 0), [groups, now]);

  const unreadCount = items.filter((i) => !seen.includes(i.story.link)).length;
  const savedCount = saved.filter((s) => items.some((i) => i.story.link === s)).length;
  const newSince = lastVisit ? items.filter((i) => i.story.published && new Date(i.story.published).getTime() > lastVisit).length : null;
  const filtered = !!(topic || source || query || view !== 'all');
  const clear = () => { setTopic(''); setSource(''); setQ(''); setView('all'); };
  const rail = desk.names.slice(0, 8);

  const story = (it: Item, more: { link: string; source: string; title: string }[] = [], mine?: Mention[]) => {
    const s = it.story, isNew = lastVisit !== null && !!s.published && new Date(s.published).getTime() > lastVisit, isRead = seen.includes(s.link), isSaved = saved.includes(s.link);
    const sum = plainText(s.summary), title = plainText(s.title);
    const text = s.summary.length >= 380 ? sum.replace(/\s+\S*$/, '…') : sum;
    return (
      <article className={`nw-story${isRead ? ' read' : ''}`}>
        <div className="nw-meta">
          <span className="nw-src">{s.source}</span><span aria-hidden>·</span><time dateTime={s.published ?? undefined}>{clock(s.published)}</time>
          {isNew && !isRead && <span className="pill acc nodot">New</span>}
          {more.length > 0 && <span className="pill nodot">{more.length + 1} sources</span>}
        </div>
        <a className="nw-h" href={s.link} target="_blank" rel="noopener noreferrer" onClick={() => markSeen(s.link)}>{title}<span className="sr"> (opens {s.source} in a new tab)</span><span aria-hidden className="nw-ext"> ↗</span></a>
        {text && text !== title && <p className="nw-s">{text}</p>}
        {mine && mine.length > 0 && (
          <ul className="nw-why" aria-label="Why this story is in your names">
            {mine.map((m) => <li key={m.sym}><Link className="link" href={companyHref(m.sym)}>{m.sym}</Link> matched on {basisWords(m)}.</li>)}
          </ul>
        )}
        <div className="nw-foot">
          {it.mentions.length > 0 && (
            <ul className="nw-named" aria-label="Companies named in this story">
              {it.mentions.slice(0, 5).map((m) => {
                const r = byIndex.get(m.sym);
                const sc = r ? screenClass(r.vd) : null;
                return (
                  <li key={m.sym}>
                    <button type="button" className="nw-co" onClick={() => setPeek(m.sym)} title={`Matched on ${basisWords(m)}. Opens a quick look.`}>
                      <b>{m.sym}</b>{r && <Chg v={mv(m.sym)} dp={1} />}
                      {signalSyms.has(m.sym) && <span className="nw-tag">Engine signal</span>}
                      {sc && sc.text && <span className="nw-tag">{sc.text}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {it.topics.length > 0 && <span className="nw-topics">{it.topics.map((t) => <button key={t} type="button" className="nw-topic" onClick={() => setTopic(t)}>{TOPICS.find((x) => x.id === t)?.label}</button>)}</span>}
          <span className="nw-acts">
            <button type="button" className="act quiet" aria-pressed={isSaved} onClick={() => toggleSaved(s.link)}>{isSaved ? 'Saved' : 'Save'}</button>
            {!isRead ? <button type="button" className="act quiet" onClick={() => markSeen(s.link)}>Mark read</button> : <span className="dim nw-readmark">Read</span>}
          </span>
        </div>
        {more.length > 0 && <details className="nw-more"><summary>Also reported by {more.length} other {more.length === 1 ? 'source' : 'sources'}</summary><ul>{more.map((m) => <li key={m.link}><a href={m.link} target="_blank" rel="noopener noreferrer" onClick={() => markSeen(m.link)}>{m.source}: {plainText(m.title)} <span aria-hidden>↗</span></a></li>)}</ul></details>}
      </article>
    );
  };

  return (
    <div className="sp">
      <PageHead method="news" eyebrow="News" title="Market news," em="your names first." />
      <section className="wrap">
        {feed.loading ? <div className="sp-stack" aria-busy="true"><Skel h={56} /><Skel h={180} /><Skel h={320} /></div>
          : feed.error ? <div className="state"><b>The news feed did not load.</b><p>Nothing is shown in its place ({feed.error}). The feed is read live, so a refresh usually brings it back.</p><div className="acts"><button type="button" className="act" onClick={() => window.location.reload()}>Refresh</button><Link className="act quiet" href="/">Back to Today</Link></div></div>
            : !feed.data || feed.data.length === 0 ? <div className="state"><b>The news feed is empty right now.</b><p>No publisher stories are on file. That is a gap in the feed, not a quiet market.</p><div className="acts"><Link className="act" href="/">Back to Today</Link></div></div>
              : (
                <>
                  <p className="sp-statusline" role="status">
                    <b className="num">{desk.stories}</b> stories from <b className="num">{desk.sources}</b> {desk.sources === 1 ? 'publisher' : 'publishers'}
                    {newest && <> · newest {clock(newest)}</>}
                    {newSince !== null && <> · <b className="num">{newSince}</b> new since your last visit</>}
                    <span className="dim"> · headlines and summaries are the publishers&apos;; open a story to read it at its source.</span>
                  </p>

                  <div className="nw-grid">
                    <div className="nw-main">
                      <section className="card" aria-labelledby="yours-h">
                        <div className="card-h"><h2 id="yours-h">Your names in the news</h2>{watch.length > 0 && <Link className="more" href="/watchlist/">Watchlist →</Link>}</div>
                        {watch.length === 0 ? (
                          <div className="state"><b>You are not following any company yet.</b><p>Watch a company from its page and every story that names it collects here first, with the reason it matched.</p><div className="acts"><button type="button" className="act primary" onClick={() => window.dispatchEvent(new Event('alpha:search'))}>Find a company</button><Link className="act" href="/screen/">Browse the screen</Link></div></div>
                        ) : !rows ? <Skel h={80} /> : yours.length === 0 ? (
                          <div className="state"><b>None of your {watch.length} {watch.length === 1 ? 'name is' : 'names are'} named in these {desk.stories} stories.</b><p>A story counts only when it writes the ticker in capitals or the company&apos;s full name, so a passing reference to a brand or a group does not. Following: {watch.slice(0, 8).join(', ')}{watch.length > 8 ? ` and ${watch.length - 8} more` : ''}.</p></div>
                        ) : (
                          <ul className="nw-list">{yours.map(({ i, hits }) => <li key={i.story.link}>{story(i, [], hits)}</li>)}</ul>
                        )}
                      </section>

                      <section className="sp-sec" aria-labelledby="all-h">
                        <div className="card-h"><div><h2 id="all-h" className="sec-title">All market news</h2><p className="sec-sub">Every story in the feed, newest first. Stories that name your companies also appear above.</p></div></div>
                        <div className="nw-bar">
                          <div className="sp-seg" role="group" aria-label="Which stories">
                            {VIEWS.map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}>{l}{k === 'unread' ? <span className="num"> {unreadCount}</span> : k === 'saved' ? <span className="num"> {savedCount}</span> : ''}</button>)}
                          </div>
                          <label className="sr" htmlFor="news-q">Search stories or a symbol</label>
                          <input id="news-q" className="field" type="search" placeholder="Search stories or a symbol" value={q} onChange={(e) => setQ(e.target.value)} />
                          <label className="sr" htmlFor="news-src">Publisher</label>
                          <select id="news-src" className="field" value={source} onChange={(e) => setSource(e.target.value)}>
                            <option value="">All {sources.length} publishers</option>
                            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="sp-chips" role="group" aria-label="Theme">
                          <button type="button" className="sp-chip" aria-pressed={topic === ''} onClick={() => setTopic('')}>All themes</button>
                          {TOPICS.map((t) => { const n = desk.themes.find((x) => x.id === t.id)?.n ?? 0; return <button key={t.id} type="button" className="sp-chip" aria-pressed={topic === t.id} disabled={n === 0} onClick={() => setTopic(topic === t.id ? '' : t.id)}>{t.label} <span className="num">{n}</span></button>; })}
                        </div>
                        {(filtered || unreadCount > 0) && (
                          <div className="nw-tools">
                            {filtered && <button type="button" className="act quiet" onClick={clear}>Clear filters</button>}
                            {unreadCount > 0 && <button type="button" className="act quiet" onClick={() => { const n = Array.from(new Set([...seen, ...items.map((i) => i.story.link)])); setSeen(n); write(SEEN, n); }}>Mark all read</button>}
                          </div>
                        )}

                        {sections.map(({ b, gs }) => (
                          <section key={b} aria-label={b} className="nw-bucket">
                            <h3 className="nw-bh">{b} <span className="num">{gs.length}</span></h3>
                            <ul className="nw-list card">
                              {gs.map(({ lead, more }) => {
                                const it = (lead as typeof lead & { _i: Item })._i;
                                return <li key={it.story.link} className={yourLinks.has(it.story.link) ? 'mine' : undefined}>{story(it, more)}</li>;
                              })}
                            </ul>
                          </section>
                        ))}
                        {groups.length === 0 && (
                          <div className="state">
                            <b>{view === 'saved' ? 'Nothing saved yet.' : view === 'unread' ? 'You have read everything here.' : 'No story matches these filters.'}</b>
                            <p>{view === 'saved' ? 'Use Save on a story to keep it here, in this browser only.' : view === 'unread' ? 'New stories arrive as the feed refreshes.' : 'Try a wider theme or another publisher.'}</p>
                            {filtered && <div className="acts"><button type="button" className="act" onClick={clear}>Clear filters</button></div>}
                          </div>
                        )}
                      </section>
                    </div>

                    <aside className="nw-rail" aria-label="Companies and sectors in these stories">
                      <section className="card tight">
                        <div className="card-h"><h2>Companies in the news</h2></div>
                        {!rows ? <Skel h={120} /> : rail.length === 0 ? <p className="sp-note">No story here names a screened company by its full name or ticker. That is a fact about these stories, not a gap in the match.</p> : (
                          <ul className="rows">
                            {rail.map(({ sym, n }) => (
                              <li key={sym}>
                                <button type="button" className="row nw-railrow" onClick={() => setPeek(sym)}>
                                  <span className="nw-railid"><span className="row-t">{sym}{watch.includes(sym) && <span className="pill acc nodot nw-follow">Following</span>}</span><span className="row-s">{byIndex.get(sym)?.name}</span></span>
                                  <span className="row-r"><Chg v={mv(sym)} dp={1} /><small>{n} {n === 1 ? 'story' : 'stories'}</small></span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {rail.length > 0 && <p className="card-foot">Day move: {dayNote}. Live while NSE trades, otherwise the latest close.</p>}
                      </section>
                      {desk.sectors.length > 0 && (
                        <section className="card tight">
                          <div className="card-h"><h2>Sectors named</h2></div>
                          <ul className="rows">{desk.sectors.slice(0, 6).map((s) => <li key={s.sector} className="row"><span className="row-s">{s.sector}</span><span className="row-r num">{s.n}</span></li>)}</ul>
                          <p className="card-foot">Count of named companies in each sector.</p>
                        </section>
                      )}
                      <section className="card tight">
                        <div className="card-h"><h2>How a company is matched</h2></div>
                        <ul className="sp-bullets">
                          <li>Its ticker, written in capitals as its own word.</li>
                          <li>Or its full name without &ldquo;Ltd&rdquo;, not inside a longer name (&ldquo;Bank of India&rdquo; never matches &ldquo;Reserve Bank of India&rdquo;).</li>
                          <li>Or, for a large company only, a distinctive first word no other listed name shares.</li>
                        </ul>
                        <p className="card-foot">Strict on purpose: a missed mention is better than a story filed under the wrong company. <Link className="link" href="/about/#news">Method</Link></p>
                      </section>
                    </aside>
                  </div>
                </>
              )}
      </section>
      <CompanyPeek sym={peek} onClose={() => setPeek(null)} />
    </div>
  );
}
