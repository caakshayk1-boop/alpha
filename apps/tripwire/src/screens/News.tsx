import { useEffect, useMemo, useState } from 'react';
import { ago, companyQ, companyStories, decisionNews, markNewsSeen, MARKET_Q, newsEvery, newsSeenAt, useNews, useNewsMany, type Merged, type NewsItem } from '../news.ts';
import { useScreen } from '../data.ts';
import { Empty } from '../ui.tsx';
const TAGC: Record<string, string> = { Results: 'amber', IPO: 'violet', Deal: 'aqua', Order: 'blue', Rating: 'pink', Payout: 'lime', Regulator: 'peach', People: '' };

/** One headline: the story once, who carried it, what it is about (a keyword match, never a verdict on whether it is good news). */
export function NewsRow({ it, sym, fresh, broad }: { it: NewsItem; sym?: string; fresh?: boolean; broad?: boolean }) {
  return <a className="li news" href={it.url} target="_blank" rel="noopener noreferrer" style={{ alignItems: 'flex-start', display: 'block' }}>
    <span className="nt">{it.title}<span className="sr"> (opens in a new tab)</span></span>
    <span className="small dim" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3, alignItems: 'center' }}>
      {fresh && <span className="tag aqua" style={{ fontSize: '0.625rem' }} title="Published since you last looked">New</span>}
      {sym && <span className="tag lime" style={{ fontSize: '0.625rem' }}>{sym}</span>}
      <span>{it.source}{it.also > 0 ? ` +${it.also} ${it.also === 1 ? 'outlet' : 'outlets'}` : ''}</span><span aria-hidden="true">·</span><span>{ago(it.t)}</span>
      {it.tags.map((t) => <span key={t} className={`tag ${TAGC[t] ?? ''}`} style={{ fontSize: '0.625rem' }}>{t}</span>)}
      {broad && <span className="mute" title="This line passed only the wider test: no results, deal or regulator keyword in the headline, or older than three days.">wider match</span>}
    </span></a>;
}
function Footer({ at, err, refresh, loading }: { at: number | null; err: string | null; refresh: () => void; loading: boolean }) {
  return <div className="row between small mute" style={{ marginTop: 8 }}>
    <span>{err ? <span className="down">{err}</span> : at ? `Checked ${new Date(at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} · again every ${Math.round(newsEvery() / 60000)} min` : 'Loading…'}</span>
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

/** One short list for Today: market and your names merged, the same story once, most material first. Five lines; the rest behind a button.
 *  Three views of the same list (all, your names, the market), the lines published since you last looked marked "New", and a clock that says when it was read and when it will be again. */
type View = 'all' | 'mine' | 'market';
export function TodayNews({ syms }: { syms: string[] }) {
  const scr = useScreen(); const [all, setAll] = useState(false); const [view, setView] = useState<View>('all');
  const [seen] = useState(() => newsSeenAt());
  const names = useMemo(() => syms.slice(0, 10).map((s) => ({ s, name: scr.data?.rows.find((r) => r.sym === s)?.name ?? '' })).filter((x) => x.name), [syms.join(), scr.data]);   // eslint-disable-line react-hooks/exhaustive-deps
  const n = useNewsMany([MARKET_Q, ...names.map((x) => companyQ(x.name))]);
  const merged = useMemo(() => decisionNews(n.feeds[0]?.items ?? [], names.map((x, i) => ({ sym: x.s, name: x.name, items: n.feeds[i + 1]?.items ?? [] })), Date.now(), 12), [n.feeds, names]);
  useEffect(() => { if (!merged.length) return; const t = window.setTimeout(() => markNewsSeen(), 4000); return () => window.clearTimeout(t); }, [merged.length]);
  const mineN = merged.filter((m) => m.sym).length, marketN = merged.length - mineN;
  const pool: Merged[] = view === 'mine' ? merged.filter((m) => m.sym) : view === 'market' ? merged.filter((m) => !m.sym) : merged;
  const shown = all ? pool : pool.slice(0, 5); const newN = merged.filter((m) => seen > 0 && m.t > seen).length;
  const everyMin = Math.round(newsEvery() / 60000);
  const chip = (v: View, label: string, k: number) => <button key={v} className="chip" aria-pressed={view === v} onClick={() => { setView(v); setAll(false); }}>{label} <span className="num mute">{k}</span></button>;
  return <div className="card" style={{ padding: '2px 14px 10px' }}>
    {merged.length > 0 && <div className="row" style={{ gap: 6, padding: '10px 0 2px', flexWrap: 'wrap' }} role="group" aria-label="Which headlines">{chip('all', 'All', merged.length)}{chip('mine', 'My names', mineN)}{chip('market', 'Market', marketN)}{newN > 0 && <span className="small" style={{ color: 'var(--a2, var(--lime))' }}>{newN} new since you last looked</span>}</div>}
    {pool.length ? <div className="list">{shown.map((it) => <NewsRow key={it.url} it={it} sym={it.sym} fresh={seen > 0 && it.t > seen} broad={it.broad} />)}</div>
      : n.loading ? <div style={{ padding: '12px 0' }}><div className="sk" style={{ height: 14, width: '90%', marginBottom: 8 }} /><div className="sk" style={{ height: 14, width: '70%' }} /></div>
      : <p className="small dim" style={{ margin: '12px 0 0' }}>{n.failed === n.feeds.length && n.feeds.length ? 'News could not be loaded. Nothing is shown in its place.' : view === 'mine' ? (names.length ? 'No headline about the names you hold or follow in the last four days.' : 'You hold and follow nothing yet, so there is nothing to read here.') : 'No headline from the last day and a half passed the filter.'}</p>}
    <div className="row between small mute" style={{ marginTop: 8 }}>
      <span>{n.at ? `Read ${new Date(n.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} · again every ${everyMin} min${n.failed ? ` · ${n.failed} of ${n.feeds.length} sources did not answer` : ''}` : 'Loading…'}</span>
      <span className="row" style={{ gap: 6 }}>{pool.length > 5 && <button className="btn sm" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show ${pool.length - 5} more`}</button>}<button className="btn sm" onClick={n.refresh} disabled={n.loading}>{n.loading ? 'Checking…' : 'Check now'}</button></span></div>
    <details className="ev" style={{ marginTop: 6 }}><summary>How these are chosen<span className="chev">▾</span></summary><div className="body small dim">{NOTE} Lines about a name you hold or follow need a results, deal, order, rating, payout, regulator or people keyword and to be under three days old; market lines need a macro driver (RBI, SEBI, rates, crude, tariffs, flows) and to be under a day old. When fewer than four lines pass, the test is widened (four days for your names, a day and a half for the market) and each widened line says "wider match".</div></details></div>;
}
