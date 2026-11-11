/** Today's market news (revamp v2, 11 Nov 2026): at most three India-wide stories, then "All news". Company stories are on the "Your names" board, never here as well
 *  (todayboard.ts splitNews dedupes by event id). The tabs, the reading controls, "Show more" and the method drawer live on the News page; Today keeps the one health line, the
 *  "new updates" offer and the check control, so a stale or failed news check is still said here, in the news vocabulary (newshealth.ts). */
import { useEffect, useState } from 'react';
import { lastVisitSec, markVisited, type useNewsBoard } from './news.ts';
import { NewsHealthLine, NewsRow, RefreshControl, UpdateOffer, EmptyTab } from './screens/News.tsx';
import { newsViewState } from './newshealth.ts';
import type { Lists, NewsEvent } from './newsview.ts';

export function MarketNews({ b, market, lists }: { b: ReturnType<typeof useNewsBoard>; market: NewsEvent[]; lists: Lists }) {
  const [seen] = useState(() => lastVisitSec());
  useEffect(() => { if (!market.length) return; const t = window.setTimeout(() => markVisited(), 4000); return () => window.clearTimeout(t); }, [market.length]);
  const view = newsViewState(b.health, { loading: b.loading, rows: market.length });
  return <section className="nw tnw" aria-labelledby="nw-title">
    <div className="nw-bar"><h2 id="nw-title" className="nw-title">Market news</h2></div>
    <NewsHealthLine h={b.health} />
    <p className="sr" data-news-view>{view}</p>
    <UpdateOffer n={b.pending} apply={b.apply} />
    {b.loading ? <div className="nw-skel" aria-hidden="true"><div className="sk" style={{ height: 18, width: '92%' }} /><div className="sk" style={{ height: 14, width: '60%' }} /><div className="sk" style={{ height: 14, width: '80%' }} /></div>
      : market.length ? <ul className="nw-list">{market.map((ev) => <NewsRow key={ev.eventClusterId} ev={ev} lists={lists} seenSec={seen} nowMs={b.at} />)}</ul>
      : <EmptyTab tab="market" lists={lists} haveSnapshot={b.hasSnapshot} anyOther={false} view={view} />}
    <div className="nw-foot"><a className="btn sm" href="#/news">All news</a><RefreshControl state={b.refreshState.state} message={b.refreshState.message} onClick={() => void b.refresh()} /></div>
  </section>;
}
