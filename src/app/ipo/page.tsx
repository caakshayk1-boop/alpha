'use client';
// IPOs: where each issue is in its life (upcoming, open, closed, listed), what was published about it, and how recent listings
// have traded since their first close. Issue details are the source's, as published; nothing here is checked against the
// offer document or the exchange's own filings, and the page says so (E16, E17).

import Link from 'next/link';
import { Chg, PageHead, Skel } from '@/components/ui';
import { useFeed, useIpoLive } from '@/lib/data';
import { ago, dash, dateLabel, nseDate, num, rupeeBand, ratio, pct } from '@/lib/format';
import { plural } from '@/lib/status';
import type { IpoListed, IpoLiveIssue, IpoOpen, IpoUpcoming } from '@/lib/types';

type Doc = { enriched_url?: string | null };

/** The mirror's generated_at has no timezone. It is written by ipo_radar.py with datetime.now() on a GitHub runner, which runs
 *  in UTC, so a stamp without an offset is read as UTC (not as the reader's local time). */
const utc = (iso: string | null | undefined) => (iso && !/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? `${iso}Z` : iso);
const istStamp = (iso: string | null | undefined) => {
  const d = iso ? new Date(utc(iso) as string) : null;
  if (!d || Number.isNaN(d.getTime())) return 'time not stated';
  const o = { timeZone: 'Asia/Kolkata' } as const;
  return `${d.toLocaleDateString('en-GB', { ...o, day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { ...o, hour: '2-digit', minute: '2-digit', hour12: false })} IST`;
};
/** Days from today in India to a YYYY-MM-DD close date. The feed's own days_left is fixed when the mirror is built, so it goes
 *  stale overnight; the close date does not. */
const daysTo = (iso: string) => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
};
const leftLabel = (o: { close_date?: string | null; days_left: number }) => {
  const n = o.close_date && /^\d{4}-\d{2}-\d{2}$/.test(o.close_date) ? daysTo(o.close_date) : null;
  if (n === null) return o.days_left > 0 ? `${plural(o.days_left, 'day')} left when the mirror was built` : 'closing day when the mirror was built';
  return n > 0 ? `Closes ${dateLabel(o.close_date)} · ${plural(n, 'day')} left` : n === 0 ? 'Closes today' : `Closed ${dateLabel(o.close_date)}`;
};
const cr = (v: number | null | undefined, dp = 0) => (typeof v === 'number' && Number.isFinite(v) ? `${v < 0 ? '−' : ''}₹${num(Math.abs(v), dp)} cr` : dash);

function DocLink({ url }: { url?: string | null }) {
  return url ? <a className="link" href={url} target="_blank" rel="noopener noreferrer">Issue page (Chittorgarh) ↗</a> : <span className="dim">No document link in the feed</span>;
}

function LiveBook({ i }: { i: IpoLiveIssue }) {
  const cats = [...(i.categories ?? [])].sort((a, b) => b.x - a.x);
  const max = Math.max(1, ...cats.map((c) => c.x), i.total_x ?? 0);
  const noBids = !i.total_x && cats.every((c) => !c.x);
  return (
    <article className="card ip-card">
      <div className="ip-top"><span className="pill ok">Open · live NSE book</span><span className="dim">{i.opens && i.closes ? `${nseDate(i.opens)} to ${nseDate(i.closes)}` : 'dates not stated'}</span></div>
      <h3 className="ip-name">{i.company ?? i.symbol}</h3>
      <p className="sp-note">{i.price_band ? `Band ${rupeeBand(i.price_band)}` : 'Band not stated'} · symbol {i.symbol}</p>
      {noBids ? <div className="state"><b>No bids reported yet.</b><p>NSE publishes the book during the day; this fills in as bidding starts.</p></div> : (
        <>
          <div className="big-stat ip-big"><b>{i.total_x != null ? ratio(i.total_x, 2) : dash}</b><span>subscribed overall</span></div>
          {cats.length > 0 && (
            <ul className="ip-meter" aria-label="Subscription by investor category">
              {cats.map((c) => <li key={c.cat}><span>{c.cat}</span><span className="ip-bar" aria-hidden><i className={c.x >= 1 ? 'up' : 'down'} style={{ width: `${(c.x / max) * 100}%` }} /></span><b className="num">{ratio(c.x, 2)}</b></li>)}
            </ul>
          )}
        </>
      )}
    </article>
  );
}

function Facts({ items }: { items: [string, React.ReactNode, string?][] }) {
  return <dl className="ip-facts">{items.map(([k, v, n]) => <div key={k}><dt>{k}</dt><dd>{v}{n && <small>{n}</small>}</dd></div>)}</dl>;
}

function MirrorOpen({ o, built }: { o: IpoOpen & Partial<IpoUpcoming>; built: string }) {
  return (
    <article className="card ip-card">
      <div className="ip-top"><span className="pill ok">Open</span><span className="dim">{leftLabel(o)}</span></div>
      <h3 className="ip-name">{o.company}</h3>
      <Facts items={[
        ['Price band', rupeeBand(o.price_band)],
        ['Issue size', cr(o.issue_size_cr)],
        ['Lot · minimum', `${num(o.lot_size)} · ₹${num(o.min_investment)}`],
        ['Subscribed', typeof o.subscription_x === 'number' ? ratio(o.subscription_x, 2) : 'pending', `as of the mirror, ${built}`],
        ['Grey market', o.gmp_text ?? dash, 'unofficial; source and time not stated; not scored'],
        ['Listing date', o.listing_date ? dateLabel(o.listing_date) : 'not announced'],
      ]} />
      <p className="ip-doc"><DocLink url={o.enriched_url} /></p>
    </article>
  );
}

function Upcoming({ u }: { u: IpoUpcoming }) {
  const parts = Object.entries(u.score?.parts ?? {});
  return (
    <article className="card ip-card">
      <div className="ip-top"><span className="pill acc">Upcoming</span><span className="dim">Opens {dateLabel(u.open_date)} · closes {dateLabel(u.close_date)}{u.sector ? ` · ${u.sector}` : ''}</span></div>
      <h3 className="ip-name">{u.company}</h3>
      <Facts items={[
        ['Price band', rupeeBand(u.price_band)],
        ['Issue size', cr(u.issue_size_cr)],
        ['Lot · minimum', `${num(u.lot_size)} · ₹${num(u.min_investment)}`],
        ['Revenue · profit', u.revenue_cr ? `₹${num(u.revenue_cr, 0)} · ₹${num(u.pat_cr, 0)} cr` : dash, 'latest year in the offer summary'],
        ['P/E post issue · peers', u.pe_post_issue ? `${ratio(u.pe_post_issue, 1)} · ${u.peer_pe ? ratio(u.peer_pe, 1) : dash}` : dash, 'at the top of the band'],
        ['Grey market', u.gmp_text ?? dash, 'unofficial; not scored'],
        ['Listing date', u.listing_date ? dateLabel(u.listing_date) : 'not announced'],
      ]} />
      {u.score && (
        <details className="ip-score">
          <summary>Mechanical attributes, not a quality rating · {u.score.points} of {u.score.of} points</summary>
          <ul className="ip-meter">{parts.map(([k, v]) => { const [a, b] = v.split('/').map(Number); return <li key={k}><span>{k}</span><span className="ip-bar" aria-hidden><i style={{ width: `${b ? (a / b) * 100 : 0}%` }} /></span><b className="num">{v}</b></li>; })}</ul>
          <p className="sp-note">Size scores a bigger issue higher; Pricing scores a narrower band higher{u.price_low && u.price_high ? ` (${pct(((u.price_high - u.price_low) / u.price_low) * 100, 1, false)} wide here)` : ''}. Neither measures quality or valuation. Not measured: {u.score.not_measured.join(', ')}.</p>
        </details>
      )}
      <p className="ip-doc"><DocLink url={u.enriched_url} /></p>
    </article>
  );
}

export default function Ipo() {
  const f = useFeed('ipo');
  const live = useIpoLive();
  const d = f.data;
  const liveIssues = live.data?.ok ? live.data.issues : [];
  const measured = (d?.recent_listed ?? []).filter((r): r is IpoListed & { since_listing_pct: number } => !!r.measured && typeof r.since_listing_pct === 'number');
  const built = d ? istStamp(d.generated_at) : '';
  const nOpen = liveIssues.length || d?.open.length || 0;
  const stages: [string, string, number, string][] = d ? [
    ['upcoming', 'Upcoming', d.upcoming.length, 'dates announced, book not open'],
    ['open', 'Open', nOpen, liveIssues.length ? 'live NSE book' : 'from the daily mirror'],
    ['closed', 'Closed', d.awaiting_listing.length, 'awaiting listing'],
    ['listed', 'Listed', measured.length, `measured, last ${d.recent_listed.length} listings`],
  ] : [];
  return (
    <div className="sp">
      <PageHead method="ipo" eyebrow="IPOs" title="Issues by stage," em="from upcoming to listed." />
      <section className="wrap">
        {f.loading ? <div className="sp-stack" aria-busy="true"><Skel h={90} /><Skel h={260} /></div>
          : f.error || !d ? <div className="state"><b>The IPO feed did not load.</b><p>Nothing is shown in its place{f.error ? ` (${f.error})` : ''}. A refresh usually brings it back.</p><div className="acts"><button type="button" className="act" onClick={() => window.location.reload()}>Refresh</button></div></div>
            : (
              <>
                <ol className="ip-stages" aria-label="Issue lifecycle">
                  {stages.map(([id, l, n, note]) => (
                    <li key={id} className={n > 0 ? 'has' : undefined}>
                      {n > 0 ? <a href={`#${id}`}><span className="ip-sl">{l}</span><b className="num">{n}</b><small>{note}</small></a>
                        : <span><span className="ip-sl">{l}</span><b className="num dim">0</b><small>none right now</small></span>}
                    </li>
                  ))}
                </ol>
                <p className="sp-note ip-src">Issue details are <b>as published by the source</b> (Chittorgarh, through the daily mirror built {built}; open books live from NSE), <b>not verified against exchange documents</b>. Check the offer document on the NSE or company site before relying on any figure. <Link className="link" href="/about/#ipo">Method</Link></p>
                {live.data && !live.data.ok && <div className="state ip-warn" role="status"><b>The live NSE book could not be reached.</b><p>Open issues below use the daily mirror, built {built} ({ago(utc(d.generated_at))}), so their subscription is that old.</p></div>}

                <section id="open" className="sp-sec" aria-labelledby="ip-open">
                  <div className="card-h"><h2 id="ip-open" className="sec-title">Open now</h2>{liveIssues.length > 0 && <span className="sp-note">Fetched {ago(live.data?.at)} from NSE, cached 15 minutes</span>}</div>
                  {liveIssues.length > 0 ? <div className="grid-2">{liveIssues.map((i) => <LiveBook key={i.symbol} i={i} />)}</div>
                    : d.open.length > 0 ? <div className="grid-2">{d.open.map((o) => <MirrorOpen key={o.symbol} o={o as IpoOpen & Partial<IpoUpcoming>} built={built} />)}</div>
                      : <div className="state"><b>No mainboard book is open.</b><p>Upcoming issues are listed below when dates are announced.</p></div>}
                </section>

                <section id="upcoming" className="sp-sec" aria-labelledby="ip-up">
                  <div className="card-h"><h2 id="ip-up" className="sec-title">Upcoming</h2></div>
                  {d.upcoming.length === 0 ? <div className="state"><b>No mainboard issue is scheduled to open yet.</b><p>The mirror lists an issue once its dates are announced.</p></div> : <div className="grid-2">{d.upcoming.map((u) => <Upcoming key={u.symbol} u={u} />)}</div>}
                </section>

                <section id="closed" className="sp-sec" aria-labelledby="ip-cl">
                  <div className="card-h"><h2 id="ip-cl" className="sec-title">Closed, awaiting listing</h2></div>
                  {d.awaiting_listing.length === 0 ? <div className="state"><b>No closed issue is awaiting listing.</b><p>Listed issues are measured below.</p></div> : (
                    <div className="card flush">
                      <div className="sp-tblwrap" tabIndex={0} role="region" aria-label="Closed issues (scrolls sideways on small screens)">
                        <table className="sp-tbl ip-tbl">
                          <thead><tr><th scope="col">Company</th><th scope="col">Price band</th><th scope="col">Closed</th><th scope="col">Lists</th><th scope="col" className="r">Revenue</th><th scope="col" className="r">Profit</th><th scope="col" className="r">P/E post issue</th><th scope="col" className="r">Peer P/E</th><th scope="col">Documents</th></tr></thead>
                          <tbody>{d.awaiting_listing.map((a) => (
                            <tr key={a.symbol}>
                              <td className="co"><b>{a.symbol}</b><span>{a.company}</span></td>
                              <td>{rupeeBand(a.price_band)}</td>
                              <td className="num">{dateLabel(a.close_date)}</td>
                              <td>{a.listing_date ? <span className="num">{dateLabel(a.listing_date)}</span> : <span className="dim">not announced</span>}</td>
                              <td className="r">{cr(a.revenue_cr, 1)}</td>
                              <td className="r">{typeof a.pat_cr === 'number' ? <span className={a.pat_cr < 0 ? 'down' : undefined}>{cr(a.pat_cr, 1)}</span> : dash}</td>
                              <td className="r">{a.pe_post_issue ? ratio(a.pe_post_issue, 1) : <span className="dim">{typeof a.pat_cr === 'number' && a.pat_cr < 0 ? 'loss-making' : dash}</span>}</td>
                              <td className="r">{a.peer_pe ? ratio(a.peer_pe, 1) : dash}</td>
                              <td><DocLink url={(a as Doc).enriched_url} /></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                      <p className="card-foot">Revenue and profit: the latest year in the issue summary, as published by the source.</p>
                    </div>
                  )}
                </section>

                <section id="listed" className="sp-sec" aria-labelledby="ip-li">
                  <div className="card-h"><div><h2 id="ip-li" className="sec-title">How recent listings traded</h2><p className="sec-sub"><b>Baseline: first close to latest close, not the issue price.</b> A listing-day pop or drop is not in these figures.</p></div></div>
                  {measured.length === 0 ? <div className="state"><b>No recent listing has enough trading to measure.</b><p>A listing is measured once it has traded for a few sessions.</p></div> : (
                    <div className="card">
                      <ul className="ip-listed" aria-label="Change from first close to latest close">
                        {measured.slice(0, 24).map((r) => {
                          const v = r.since_listing_pct;
                          const x = r as IpoListed & { sessions?: number };
                          return (
                            <li key={r.symbol}>
                              <span className="ip-lid"><b>{r.symbol}</b><small>listed {r.listing_date ? dateLabel(r.listing_date) : 'date not stated'}{typeof x.sessions === 'number' ? ` · ${plural(x.sessions, 'session')}` : ''}</small></span>
                              <span className="ip-lbar" aria-hidden><i className={v >= 0 ? 'up' : 'down'} style={{ width: `${Math.min(50, (Math.abs(v) / 60) * 50)}%`, [v >= 0 ? 'left' : 'right']: '50%' }} /></span>
                              <span className="ip-lv"><Chg v={v} dp={1} /><small>{typeof r.first_close === 'number' && typeof r.last_close === 'number' ? `₹${num(r.first_close, 1)} → ₹${num(r.last_close, 1)}` : 'first close to latest'}</small></span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="card-foot">Every figure: first close after listing to the latest close in the mirror built {built}. Bars saturate at ±60%. {measured.length} of the last {d.recent_listed.length} listings have enough trading to measure{measured.length > 24 ? '; the 24 most recent are shown' : ''}.</p>
                    </div>
                  )}
                </section>
              </>
            )}
      </section>
    </div>
  );
}
