// Purpose: read the day's stories against the market. Primary action: open a story, or tap a stock it names to see that company.
// Everything here is rule-based and shows its basis: themes from words in the story, stocks from the exact name or ticker, day moves from the live snapshot or the screen's close, whichever is the newer session (lib/price.ts).
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CompanyPeek } from '@/components/Peek';
import { Async, Chg, PageHead, Rv } from '@/components/ui';
import { useEngines, useFeed, useLive } from '@/lib/data';
import { priceLabel, priceView, sessionLabel } from '@/lib/price';
import { screenClass } from '@/lib/decision';
import { plainText } from '@/lib/format';
import { groupStories } from '@/lib/news';
import { BUCKETS, TOPICS, bucketOf, makeMatcher, summarise, topicsOf, type Bucket, type Mention, type TopicId } from '@/lib/newsdesk';

const SEEN = 'alpha-news-seen', SAVED = 'alpha-news-saved', VISIT = 'alpha-news-visit', WATCH = 'alpha-watchlist';
type View = 'all' | 'unread' | 'saved' | 'watch';
const VIEWS: readonly [View, string][] = [['all', 'All'], ['unread', 'Unread'], ['saved', 'Saved'], ['watch', 'Watchlist']];

const read = (key: string): string[] => { try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; } };
const write = (key: string, v: string[]) => { try { localStorage.setItem(key, JSON.stringify(v.slice(-400))); } catch { /* storage blocked or full: the page works without it */ } };

const clock = (iso?: string | null) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return 'time not stated';
  const o = { timeZone: 'Asia/Kolkata' } as const;
  return `${d.toLocaleDateString('en-GB', { ...o, day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { ...o, hour: '2-digit', minute: '2-digit', hour12: false })} IST`;
};

export default function News() {
  const feed = useFeed('news');
  const scr = useFeed('screen');
  const eng = useEngines();
  const lv = useLive();

  // state kept in the address, so a filtered view can be shared or returned to
  const [topic, setTopic] = useState<TopicId | ''>('');
  const [source, setSource] = useState('');
  const [view, setView] = useState<View>('all');
  const [q, setQ] = useState('');
  const [peek, setPeek] = useState<string | null>(null);
  const ready = useRef(false);
  const [seen, setSeen] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [watch, setWatch] = useState<string[]>([]);
  const [lastVisit, setLastVisit] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('topic'), v = p.get('view');
    if (TOPICS.some((x) => x.id === t)) setTopic(t as TopicId);
    if (VIEWS.some(([k]) => k === v)) setView(v as View);
    setSource(p.get('source') ?? ''); setQ(p.get('q') ?? '');
    setSeen(read(SEEN)); setSaved(read(SAVED)); setWatch(read(WATCH));
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
  const items = useMemo(() => (feed.data ?? []).map((story) => {
    const text = `${plainText(story.title)}. ${plainText(story.summary)}`;
    return { story, topics: topicsOf(text), mentions: match(text) as Mention[], text: text.toLowerCase() };
  }), [feed.data, match]);
  const desk = useMemo(() => summarise(items, (sym) => byIndex.get(sym)?.sector), [items, byIndex]);
  const sources = useMemo(() => Array.from(new Set(items.map((i) => i.story.source))).sort(), [items]);

  const query = q.trim().toLowerCase();
  const shown = useMemo(() => items.filter((i) => {
    if (topic && !i.topics.includes(topic)) return false;
    if (source && i.story.source !== source) return false;
    if (query && !i.text.includes(query) && !i.mentions.some((m) => m.sym.toLowerCase() === query)) return false;
    if (view === 'unread' && seen.includes(i.story.link)) return false;
    if (view === 'saved' && !saved.includes(i.story.link)) return false;
    if (view === 'watch' && !i.mentions.some((m) => watch.includes(m.sym))) return false;
    return true;
  }).sort((a, b) => (b.story.published ?? '').localeCompare(a.story.published ?? '')), [items, topic, source, query, view, seen, saved, watch]);

  const groups = useMemo(() => groupStories(shown.map((i) => ({ ...i.story, _i: i }))), [shown]);
  const sections = useMemo(() => BUCKETS.map((b) => ({ b, gs: groups.filter((g) => bucketOf(g.lead.published, now) === b) })).filter((s) => s.gs.length > 0), [groups, now]);

  const unreadCount = items.filter((i) => !seen.includes(i.story.link)).length;
  const newSince = lastVisit ? items.filter((i) => i.story.published && new Date(i.story.published).getTime() > lastVisit).length : null;
  const filtered = !!(topic || source || query || view !== 'all');
  const clear = () => { setTopic(''); setSource(''); setQ(''); setView('all'); };
  const rail = desk.names.slice(0, 8);
  const topTheme = desk.themes[0];

  return (
    <>
      <PageHead eyebrow="News desk" title="The day's stories," em="read against the market." lede="Each story is tied to the companies it names, with their last move and any open signal. Themes and company links come from the words in the story, and the basis is always shown." />
      <section className="wrap">
        <Async loading={feed.loading} error={feed.error}>
          {feed.data && (
            <>
              <div className="deskline" role="status">
                <b>{desk.stories} stories</b> from {desk.sources} {desk.sources === 1 ? 'source' : 'sources'}
                {topTheme && <> · most covered: <b>{topTheme.label.toLowerCase()}</b> ({topTheme.n})</>}
                {rows && <> · <b>{desk.names.length}</b> {desk.names.length === 1 ? 'company' : 'companies'} named</>}
                {newSince !== null && <> · <b>{newSince}</b> new since your last visit</>}
              </div>

              {rail.length > 0 && (
                <ul className="chiprow" aria-label={`Companies named most in these stories, with the day move (${dayNote})`}>
                  {rail.slice(0, 6).map(({ sym }) => <li key={sym}><button type="button" className="namedco" onClick={() => setPeek(sym)}><b>{sym}</b><Chg v={mv(sym)} dp={1} /></button></li>)}
                </ul>
              )}

              <div className="newsgrid">
                <div className="newsmain">
                  <div className="newsbar">
                    <div className="seg2" role="group" aria-label="Which stories">
                      {VIEWS.map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}>{l}{k === 'unread' ? ` (${unreadCount})` : k === 'saved' ? ` (${saved.filter((s) => items.some((i) => i.story.link === s)).length})` : ''}</button>)}
                    </div>
                    <label className="sr" htmlFor="news-q">Search stories or a symbol</label>
                    <input id="news-q" className="field" type="search" placeholder="Search stories or a symbol" value={q} onChange={(e) => setQ(e.target.value)} />
                  </div>
                  <div className="tabrow" role="group" aria-label="Theme">
                    <button type="button" className="chip" aria-pressed={topic === ''} onClick={() => setTopic('')}>All themes</button>
                    {TOPICS.map((t) => { const n = desk.themes.find((x) => x.id === t.id)?.n ?? 0; return <button key={t.id} type="button" className="chip" aria-pressed={topic === t.id} disabled={n === 0} onClick={() => setTopic(topic === t.id ? '' : t.id)}>{t.label} · {n}</button>; })}
                  </div>
                  <div className="newsmeta">
                    <label className="muted" htmlFor="news-src">Source</label>
                    <select id="news-src" className="field" value={source} onChange={(e) => setSource(e.target.value)}>
                      <option value="">All {sources.length} sources</option>
                      {sources.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {filtered && <button type="button" className="chip" onClick={clear}>Clear filters</button>}
                    {unreadCount > 0 && <button type="button" className="chip" onClick={() => { const n = Array.from(new Set([...seen, ...items.map((i) => i.story.link)])); setSeen(n); write(SEEN, n); }}>Mark all read</button>}
                  </div>

                  {sections.map(({ b, gs }) => (
                    <section key={b} aria-label={b}>
                      <h2 className="bucket">{b} <span>{gs.length}</span></h2>
                      <ul className="stories">
                        {gs.map(({ lead, more }) => {
                          const it = (lead as typeof lead & { _i: (typeof items)[number] })._i;
                          const s = it.story, isNew = lastVisit !== null && !!s.published && new Date(s.published).getTime() > lastVisit, isRead = seen.includes(s.link), isSaved = saved.includes(s.link);
                          const sum = plainText(s.summary), title = plainText(s.title);
                          const text = s.summary.length >= 380 ? sum.replace(/\s+\S*$/, '…') : sum;
                          return (
                            <li key={s.link}>
                              <Rv className={`story${isRead ? ' read' : ''}`}>
                                <div className="story-meta">
                                  <span>{s.source} · <time dateTime={s.published ?? undefined}>{clock(s.published)}</time></span>
                                  {isNew && !isRead && <span className="tag acc">New</span>}
                                  {more.length > 0 && <span className="tag">{more.length + 1} sources</span>}
                                </div>
                                <a className="story-h" href={s.link} target="_blank" rel="noopener noreferrer" onClick={() => markSeen(s.link)}>{title}<span className="sr"> (opens the publisher in a new tab)</span><span aria-hidden className="ext">↗</span></a>
                                {text && text !== title && <p className="story-s">{text}</p>}
                                {it.mentions.length > 0 && (
                                  <ul className="named" aria-label="Companies named in this story">
                                    {it.mentions.slice(0, 5).map((m) => {
                                      const r = byIndex.get(m.sym);
                                      const sc = r ? screenClass(r.vd) : null;
                                      return (
                                        <li key={m.sym}>
                                          <button type="button" className="namedco" onClick={() => setPeek(m.sym)} title={`Matched on ${m.basis}. Opens a quick look.`}>
                                            <b>{m.sym}</b>
                                            {r && <Chg v={mv(m.sym)} dp={1} />}
                                            {signalSyms.has(m.sym) && <span className="tag acc">Engine signal</span>}
                                            {sc && sc.text && <span className="tag">{sc.text}</span>}
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                                {it.topics.length > 0 && <div className="story-tags">{it.topics.map((t) => <button key={t} type="button" className="tag" onClick={() => setTopic(t)}>{TOPICS.find((x) => x.id === t)?.label}</button>)}</div>}
                                {more.length > 0 && <details className="sig-why"><summary>Also reported by {more.length} other {more.length === 1 ? 'source' : 'sources'}</summary><ul>{more.map((m) => <li key={m.link}><a href={m.link} target="_blank" rel="noopener noreferrer" onClick={() => markSeen(m.link)}>{m.source}: {plainText(m.title)}</a></li>)}</ul></details>}
                                <div className="story-act">
                                  <button type="button" className="chip" aria-pressed={isSaved} onClick={() => toggleSaved(s.link)}>{isSaved ? '★ Saved' : '☆ Save'}</button>
                                  {!isRead ? <button type="button" className="chip" onClick={() => markSeen(s.link)}>Mark read</button> : <span className="dim">Read</span>}
                                </div>
                              </Rv>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                  {groups.length === 0 && (
                    <div className="notice">
                      {view === 'watch' ? (watch.length === 0 ? 'Your watchlist is empty. Add companies on their pages, and stories that name them will collect here.' : 'No story names a company on your watchlist right now.')
                        : view === 'saved' ? 'Nothing saved yet. Use Save on a story to keep it here.' : view === 'unread' ? 'You have read everything that is here.' : 'No story matches these filters.'}
                      {filtered && <> <button type="button" className="chip" onClick={clear}>Clear filters</button></>}
                    </div>
                  )}
                </div>

                <aside className="newsrail" aria-label="Stocks and sectors in these stories">
                  <Rv className="panel">
                    <div className="eyebrow">Stocks in the news</div>
                    {!rows && <p className="muted" style={{ fontSize: 14 }}>Loading the company list to match names…</p>}
                    {rows && rail.length === 0 && <p className="muted" style={{ fontSize: 14, margin: '8px 0 0' }}>No story here names a screened company by its full name or ticker. That is a fact about these stories, not a gap in the match.</p>}
                    <ul className="railist">
                      {rail.map(({ sym, n }) => {
                        const r = byIndex.get(sym);
                        return (
                          <li key={sym}>
                            <button type="button" className="railrow" onClick={() => setPeek(sym)}>
                              <span className="railid"><b>{sym}</b><span>{r?.name}</span></span>
                              <span className="railmv"><Chg v={mv(sym)} dp={1} /><span>{n} {n === 1 ? 'story' : 'stories'}</span></span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {rail.length > 0 && <p className="dim" style={{ fontSize: 13, margin: '10px 0 0' }}>Day move: {dayNote}. The same rule prices every page: live while NSE trades, otherwise the latest close.</p>}
                  </Rv>
                  {desk.sectors.length > 0 && (
                    <Rv className="panel">
                      <div className="eyebrow">Sectors in the news</div>
                      <ul className="railist">
                        {desk.sectors.slice(0, 6).map((s) => <li key={s.sector} className="sectorrow"><span>{s.sector}</span><b className="num">{s.n}</b></li>)}
                      </ul>
                      <p className="dim" style={{ fontSize: 13, margin: '8px 0 0' }}>Count of named companies in each sector.</p>
                    </Rv>
                  )}
                  <Rv className="panel">
                    <div className="eyebrow">How to read this page</div>
                    <p className="muted" style={{ fontSize: 14, margin: '8px 0 0', lineHeight: 1.55 }}>Stories are fetched from the publishers&apos; own feeds and the summaries are theirs. Themes are matched on words, and a company is linked only when its ticker or full name is written in the story. Nothing here is scored, ranked or advice. Read, saved and last-visit are kept in this browser only.</p>
                  </Rv>
                </aside>
              </div>
            </>
          )}
        </Async>
      </section>
      <CompanyPeek sym={peek} onClose={() => setPeek(null)} />
    </>
  );
}
