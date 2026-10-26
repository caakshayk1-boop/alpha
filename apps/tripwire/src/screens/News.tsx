import { useMemo } from 'react';
import { ago, companyQ, MARKET_Q, useNews, type NewsItem } from '../news.ts';
import { useScreen } from '../data.ts';
import { Empty } from '../ui.tsx';

/** One headline: the story once, who carried it, what it is about (a keyword match, never a verdict on whether it is good news). */
export function NewsRow({ it, sym }: { it: NewsItem; sym?: string }) {
  return <a className="li news" href={it.url} target="_blank" rel="noopener noreferrer" style={{ alignItems: 'flex-start', display: 'block' }}>
    <span className="nt">{it.title}<span className="sr"> (opens in a new tab)</span></span>
    <span className="small dim" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3, alignItems: 'center' }}>
      {sym && <span className="tag lime" style={{ fontSize: 10 }}>{sym}</span>}
      <span>{it.source}{it.also > 0 ? ` +${it.also} more` : ''}</span><span aria-hidden="true">·</span><span>{ago(it.t)}</span>
      {it.tags.map((t) => <span key={t} className="tag" style={{ fontSize: 10 }}>{t}</span>)}
    </span></a>;
}
function Footer({ at, err, refresh, loading }: { at: number | null; err: string | null; refresh: () => void; loading: boolean }) {
  return <div className="row between small mute" style={{ marginTop: 8 }}>
    <span>{err ? <span className="down">{err}</span> : at ? `Checked ${new Date(at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} · refreshes every hour` : 'Loading…'}</span>
    <button className="btn sm" onClick={refresh} disabled={loading}>{loading ? 'Checking…' : 'Check now'}</button></div>;
}
const NOTE = 'Headlines are collected from Google News, English only, with filler removed and the same story from several outlets folded into one line. Tags are keyword matches on the headline. Nothing here is read for sentiment, and nothing is a recommendation.';

/** News for one company, from its own name. */
export function CompanyNews({ name }: { name: string }) {
  const n = useNews(companyQ(name));
  return <div className="card" style={{ padding: '2px 14px 12px' }}>
    {n.loading && !n.data ? <div style={{ padding: '12px 0' }}><div className="sk" style={{ height: 14, width: '90%', marginBottom: 8 }} /><div className="sk" style={{ height: 14, width: '70%' }} /></div>
      : n.data && n.data.items.length ? <div className="list">{n.data.items.slice(0, 6).map((it) => <NewsRow key={it.url} it={it} />)}</div>
      : n.data ? <div style={{ padding: '12px 0' }}><Empty title="Nothing in the last 7 days">No English headline matched this name in the past week.</Empty></div>
      : <p className="small down" style={{ margin: '12px 0 0' }}>News could not be loaded ({n.err}). Nothing is shown in its place.</p>}
    <Footer at={n.at} err={n.data ? null : n.err} refresh={n.refresh} loading={n.loading} />
    <p className="mute small" style={{ margin: '6px 0 0' }}>{NOTE}</p></div>;
}

/** The market, then the names the user holds or follows, most material first. At most six names, three headlines each. */
export function TodayNews({ syms }: { syms: string[] }) {
  const scr = useScreen(); const names = useMemo(() => syms.slice(0, 6).map((s) => ({ s, name: scr.data?.rows.find((r) => r.sym === s)?.name ?? '' })).filter((x) => x.name), [syms.join(), scr.data]);   // eslint-disable-line react-hooks/exhaustive-deps
  const market = useNews(MARKET_Q);
  return <>
    <div className="card" style={{ padding: '2px 14px 12px' }}>
      {market.data && market.data.items.length ? <div className="list">{market.data.items.slice(0, 5).map((it) => <NewsRow key={it.url} it={it} />)}</div>
        : market.loading ? <div style={{ padding: '12px 0' }}><div className="sk" style={{ height: 14, width: '90%', marginBottom: 8 }} /><div className="sk" style={{ height: 14, width: '70%' }} /></div>
        : <p className="small down" style={{ margin: '12px 0 0' }}>{market.data ? 'No market headline in the last day.' : `Market news could not be loaded (${market.err}). Nothing is shown in its place.`}</p>}
      <Footer at={market.at} err={market.data ? null : market.err} refresh={market.refresh} loading={market.loading} />
    </div>
    {names.length > 0 && <>
      <div className="k" style={{ margin: '14px 0 6px' }}>Your names</div>
      {names.map(({ s, name }) => <NameNews key={s} sym={s} name={name} />)}
    </>}
    <p className="mute small" style={{ marginTop: 8 }}>{NOTE}</p></>;
}
function NameNews({ sym, name }: { sym: string; name: string }) {
  const n = useNews(companyQ(name)); const items = n.data?.items.slice(0, 3) ?? [];
  if (n.data && !items.length) return null;
  return <div className="card" style={{ padding: '2px 14px', marginBottom: 8 }}>{items.length ? <div className="list">{items.map((it) => <NewsRow key={it.url} it={it} sym={sym} />)}</div> : n.err ? <p className="small mute" style={{ margin: '10px 0' }}>{sym}: news could not be loaded.</p> : <div className="sk" style={{ height: 14, margin: '14px 0' }} />}</div>;
}
