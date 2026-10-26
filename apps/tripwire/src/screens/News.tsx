import { useMemo, useState } from 'react';
import { ago, companyQ, companyStories, decisionNews, MARKET_Q, useNews, useNewsMany, type NewsItem } from '../news.ts';
import { useScreen } from '../data.ts';
import { Empty } from '../ui.tsx';
const TAGC: Record<string, string> = { Results: 'amber', IPO: 'violet', Deal: 'aqua', Order: 'blue', Rating: 'pink', Payout: 'lime', Regulator: 'peach', People: '' };

/** One headline: the story once, who carried it, what it is about (a keyword match, never a verdict on whether it is good news). */
export function NewsRow({ it, sym }: { it: NewsItem; sym?: string }) {
  return <a className="li news" href={it.url} target="_blank" rel="noopener noreferrer" style={{ alignItems: 'flex-start', display: 'block' }}>
    <span className="nt">{it.title}<span className="sr"> (opens in a new tab)</span></span>
    <span className="small dim" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3, alignItems: 'center' }}>
      {sym && <span className="tag lime" style={{ fontSize: '0.625rem' }}>{sym}</span>}
      <span>{it.source}{it.also > 0 ? ` +${it.also} ${it.also === 1 ? 'outlet' : 'outlets'}` : ''}</span><span aria-hidden="true">·</span><span>{ago(it.t)}</span>
      {it.tags.map((t) => <span key={t} className={`tag ${TAGC[t] ?? ''}`} style={{ fontSize: '0.625rem' }}>{t}</span>)}
    </span></a>;
}
function Footer({ at, err, refresh, loading }: { at: number | null; err: string | null; refresh: () => void; loading: boolean }) {
  return <div className="row between small mute" style={{ marginTop: 8 }}>
    <span>{err ? <span className="down">{err}</span> : at ? `Checked ${new Date(at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} · refreshes every hour` : 'Loading…'}</span>
    <button className="btn sm" onClick={refresh} disabled={loading}>{loading ? 'Checking…' : 'Check now'}</button></div>;
}
const NOTE = 'Headlines are collected from Google News (or Bing News when Google does not answer), English only, with filler removed and the same story from several outlets folded into one line. Tags are keyword matches on the headline. Nothing here is read for sentiment, and nothing is a recommendation.';

/** News for one company, from its own name. */
export function CompanyNews({ name }: { name: string }) {
  const n = useNews(companyQ(name)); const stories = useMemo(() => companyStories(name, n.data?.items ?? [], 3), [name, n.data]);
  return <div className="card" style={{ padding: '2px 14px 12px' }}>
    {n.loading && !n.data ? <div style={{ padding: '12px 0' }}><div className="sk" style={{ height: 14, width: '90%', marginBottom: 8 }} /><div className="sk" style={{ height: 14, width: '70%' }} /></div>
      : stories.length ? <div className="list">{stories.map((it) => <NewsRow key={it.url} it={it} />)}</div>
      : n.data ? <div style={{ padding: '12px 0' }}><Empty title="Nothing in the last 7 days">No English headline matched this name in the past week.</Empty></div>
      : <p className="small down" style={{ margin: '12px 0 0' }}>News could not be loaded ({n.err}). Nothing is shown in its place.</p>}
    <Footer at={n.at} err={n.data ? null : n.err} refresh={n.refresh} loading={n.loading} />
    <p className="mute small" style={{ margin: '6px 0 0' }}>{NOTE}</p></div>;
}

/** One short list for Today: market and your names merged, the same story once, most material first. Five lines; the rest behind a button. */
export function TodayNews({ syms }: { syms: string[] }) {
  const scr = useScreen(); const [all, setAll] = useState(false);
  const names = useMemo(() => syms.slice(0, 6).map((s) => ({ s, name: scr.data?.rows.find((r) => r.sym === s)?.name ?? '' })).filter((x) => x.name), [syms.join(), scr.data]);   // eslint-disable-line react-hooks/exhaustive-deps
  const n = useNewsMany([MARKET_Q, ...names.map((x) => companyQ(x.name))]);
  const merged = useMemo(() => decisionNews(n.feeds[0]?.items ?? [], names.map((x, i) => ({ sym: x.s, name: x.name, items: n.feeds[i + 1]?.items ?? [] })), Date.now(), 8), [n.feeds, names]);
  const shown = all ? merged : merged.slice(0, 5);
  return <div className="card" style={{ padding: '2px 14px 10px' }}>
    {merged.length ? <div className="list">{shown.map((it) => <NewsRow key={it.url} it={it} sym={it.sym} />)}</div>
      : n.loading ? <div style={{ padding: '12px 0' }}><div className="sk" style={{ height: 14, width: '90%', marginBottom: 8 }} /><div className="sk" style={{ height: 14, width: '70%' }} /></div>
      : <p className="small dim" style={{ margin: '12px 0 0' }}>{n.failed === n.feeds.length && n.feeds.length ? 'News could not be loaded. Nothing is shown in its place.' : 'Nothing new that could change a decision on your names or the market.'}</p>}
    <div className="row between small mute" style={{ marginTop: 8 }}>
      <span>{n.at ? `Checked ${new Date(n.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} · hourly` : 'Loading…'}</span>
      <span className="row" style={{ gap: 6 }}>{merged.length > 5 && <button className="btn sm" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show ${merged.length - 5} more`}</button>}<button className="btn sm" onClick={n.refresh} disabled={n.loading}>{n.loading ? 'Checking…' : 'Check now'}</button></span></div>
    <details className="ev" style={{ marginTop: 6 }}><summary>How these are chosen<span className="chev">▾</span></summary><div className="body small dim">{NOTE}</div></details></div>;
}
