'use client';

import { Async, Bar, Chg, Notice, PageHead, Rv, SectionHead } from '@/components/ui';
import { useFeed, useIpoLive } from '@/lib/data';
import { ago, dash, dateLabel, nseDate, num, rupeeBand } from '@/lib/format';
import type { IpoLiveIssue, IpoUpcoming } from '@/lib/types';

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
  if (n === null) return o.days_left > 0 ? `${o.days_left} day${o.days_left > 1 ? 's' : ''} left when the mirror was built` : 'closing day when the mirror was built';
  return n > 0 ? `${n} day${n > 1 ? 's' : ''} left · closes ${dateLabel(o.close_date)}` : n === 0 ? 'Closes today' : `Closed ${dateLabel(o.close_date)}`;
};

function LiveBook({ i }: { i: IpoLiveIssue }) {
  const cats = [...(i.categories ?? [])].sort((a, b) => b.x - a.x);
  const max = Math.max(1, ...cats.map((c) => c.x), i.total_x ?? 0);
  const noBids = !i.total_x && cats.every((c) => !c.x);
  return (
    <Rv className="panel spot">
      <div className="eyebrow">Live subscription · {i.status ?? 'active'}</div>
      <div className="disp" style={{ fontSize: 30, margin: '12px 0 4px' }}>{i.company ?? i.symbol}</div>
      <div className="dim num" style={{ fontSize: 14, marginBottom: 18 }}>{[i.price_band ? rupeeBand(i.price_band) : null, i.opens && i.closes ? `open ${nseDate(i.opens)} to ${nseDate(i.closes)}` : null].filter(Boolean).join(' · ')}</div>
      {noBids ? (
        <div className="muted" style={{ fontSize: 16, lineHeight: 1.5 }}>No bids reported yet. NSE publishes the book during the day, so this fills in as bidding starts.</div>
      ) : (
        <div className="disp" style={{ fontSize: 'clamp(40px, 6vw, 56px)' }}>{i.total_x != null ? `${i.total_x.toFixed(2)}×` : dash}<span className="dim" style={{ fontSize: 18 }}> subscribed overall</span></div>
      )}
      {!noBids && cats.length > 0 && (
        <div className="meter" style={{ marginTop: 18 }}>
          {cats.map((c) => (
            <div className="meter-row" key={c.cat}>
              <span className="lab">{c.cat}</span>
              <Bar pct={(c.x / max) * 100} kind={c.x >= 1 ? 'up' : 'down'} />
              <span className="num">{c.x.toFixed(2)}×</span>
            </div>
          ))}
        </div>
      )}
    </Rv>
  );
}

function Upcoming({ u }: { u: IpoUpcoming }) {
  const parts = Object.entries(u.score?.parts ?? {});
  return (
    <Rv className="panel spot">
      <div className="eyebrow">Opens {dateLabel(u.open_date)} · closes {dateLabel(u.close_date)}{u.sector ? ` · ${u.sector}` : ''}</div>
      <div className="disp" style={{ fontSize: 34, margin: '12px 0' }}>{u.company}</div>
      <div className="kv">
        <div><div className="k">Price band</div><div className="v" style={{ fontSize: 15 }}>{rupeeBand(u.price_band)}</div></div>
        <div><div className="k">Issue size</div><div className="v">₹{num(u.issue_size_cr)} cr</div></div>
        <div><div className="k">Lot · minimum</div><div className="v" style={{ fontSize: 15 }}>{u.lot_size} · ₹{num(u.min_investment)}</div></div>
        <div><div className="k">Grey market (unofficial)</div><div className="v" style={{ fontSize: 15 }}>{u.gmp_text ?? dash}</div><div className="dim" style={{ fontSize: 12, marginTop: 3 }}>Source and time are not stated in the feed; not scored.</div></div>
        <div><div className="k">Revenue · profit</div><div className="v" style={{ fontSize: 15 }}>{u.revenue_cr ? `₹${num(u.revenue_cr, 0)} · ₹${num(u.pat_cr, 0)} cr` : dash}</div></div>
        <div><div className="k">Listing date</div><div className="v" style={{ fontSize: 15 }}>{u.listing_date ? dateLabel(u.listing_date) : 'Not announced yet'}</div></div>
        <div><div className="k">P/E post issue vs peers</div><div className="v" style={{ fontSize: 15 }}>{u.pe_post_issue ? `${u.pe_post_issue.toFixed(1)}× vs ${u.peer_pe?.toFixed(1) ?? dash}×` : dash}</div></div>
      </div>
      {u.score && (
        <div style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Mechanical attributes, not a quality rating · {u.score.points} of {u.score.of} points measured</div>
          <div className="meter">{parts.map(([k, v]) => { const [a, b] = v.split('/').map(Number); return <div className="meter-row" key={k}><span className="lab">{k}</span><Bar pct={(a / b) * 100} /><span className="num">{v}</span></div>; })}</div>
          <ul className="dim" style={{ fontSize: 13.5, margin: '12px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
            {'Size' in (u.score.parts ?? {}) && <li><b>Size</b>: the issue size, ₹{num(u.issue_size_cr)} cr; this attribute scores a bigger issue higher; size alone says nothing about quality.</li>}
            {'Pricing' in (u.score.parts ?? {}) && u.price_low && u.price_high ? <li><b>Pricing</b>: how narrow the price band is ({(((u.price_high - u.price_low) / u.price_low) * 100).toFixed(1)}% wide here); this attribute scores a narrower band higher. It does not measure valuation and does not establish the underwriter&apos;s intent.</li> : null}
            <li>The P/E post issue and peer P/E shown above are <b>not part of this score</b>: valuation multiples are not measured by it, which is why they appear in the not-measured list.</li>
            <li>Not measured at all: {u.score.not_measured.join(', ')}. The grey-market premium is shown and deliberately not scored.</li>
          </ul>
          {u.enriched_url && <p className="dim" style={{ fontSize: 13.5, margin: '8px 0 0' }}>Issue data: <a href={u.enriched_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-2)', textDecoration: 'underline' }}>Chittorgarh issue page ↗</a>. The offer document is on the NSE and company sites; this feed does not link to it.</p>}
        </div>
      )}
    </Rv>
  );
}

export default function Ipo() {
  const f = useFeed('ipo');
  const live = useIpoLive();
  const d = f.data;
  const liveIssues = live.data?.ok ? live.data.issues : [];
  return (
    <>
      <PageHead eyebrow="IPO" title="Books open now," em="and what is coming." lede="The live NSE subscription book where an issue is open, the issues about to open with what the numbers do and do not support, then how recent listings have actually traded since." />
      <section className="wrap">
        <Async loading={f.loading} error={f.error}>
          {d && (
            <>
              {liveIssues.length > 0 && <><div id="open" /><SectionHead eyebrow="Live from NSE" title="Open books" /><div className="grid g2">{liveIssues.map((i) => <LiveBook key={i.symbol} i={i} />)}</div><p className="dim" style={{ fontSize: 13.5, marginTop: 8 }}>Fetched {ago(live.data?.at)} from NSE, cached 15 minutes. The book moves fastest on the last day.</p><div style={{ height: 36 }} /></>}
              {live.data && !live.data.ok && <><Notice>The live NSE book could not be reached right now, so open issues below use the daily mirror (built {istStamp(d.generated_at)}, {ago(utc(d.generated_at))}).</Notice><div style={{ height: 24 }} /></>}

              <ol className="filters" aria-label="Issue lifecycle" style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
                {([['Upcoming', d.upcoming.length, 'upcoming'], ['Open', liveIssues.length || d.open.length, 'open'], ['Closed, awaiting listing', d.awaiting_listing.length, 'closed'], ['Listed (measured)', d.recent_listed.filter((r) => r.measured).length, 'listed']] as const).map(([l, n, id], i) => <li key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{i > 0 && <span aria-hidden className="dim step-arrow">→</span>}{n > 0 ? <a className="chip" href={`#${id}`}>{l} · {n}</a> : <span className="chip" aria-disabled="true" style={{ opacity: 0.55 }}>{l} · none</span>}</li>)}
              </ol>
              <p className="dim" style={{ fontSize: 13.5, margin: '-8px 0 20px' }}>Upcoming, closed and listed issues come from the daily mirror, built {istStamp(d.generated_at)}{liveIssues.length > 0 ? '; open books above are live from NSE' : ''}.</p>
              <div id="upcoming" /><SectionHead eyebrow="Next" title="Opening soon" />
              {d.upcoming.length === 0 ? <p className="muted">No mainboard issue is scheduled to open yet.</p> : <div className="grid g2">{d.upcoming.map((u) => <Upcoming key={u.symbol} u={u} />)}</div>}

              {liveIssues.length === 0 && d.open.length > 0 && <>
                <div style={{ height: 36 }} /><div id="open" /><SectionHead title="Open (daily mirror)" />
                <div className="grid g2">{d.open.map((o) => (
                  <Rv key={o.symbol} className="panel spot"><div className="eyebrow">{leftLabel(o)}</div>
                    <div className="disp" style={{ fontSize: 30, margin: '12px 0' }}>{o.company}</div>
                    <div className="dim num">{rupeeBand(o.price_band)} · {o.subscription_x ? `${o.subscription_x.toFixed(2)}× subscribed as of ${istStamp(d.generated_at)}` : 'subscription pending'}</div></Rv>))}</div></>}

              <div style={{ height: 36 }} />
              <div id="closed" /><SectionHead title="Closed, awaiting listing" />
              <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)"><table className="tbl"><thead><tr><th>Company</th><th>Price band</th><th>Closed</th><th>Lists</th><th>Revenue</th><th>PAT</th><th>P/E post issue</th><th>Peer P/E</th></tr></thead><tbody>
                {d.awaiting_listing.map((a) => <tr key={a.symbol} style={{ cursor: 'default' }}><td><div className="co"><b>{a.symbol}</b><span>{a.company}</span></div></td><td>{rupeeBand(a.price_band)}</td><td>{dateLabel(a.close_date)}</td><td>{a.listing_date ? dateLabel(a.listing_date) : <span className="dim">Not announced</span>}</td><td className="num">{a.revenue_cr ? `₹${num(a.revenue_cr, 1)} cr` : dash}</td><td className="num">{a.pat_cr ? `₹${num(a.pat_cr, 1)} cr` : dash}</td><td className="num">{a.pe_post_issue ? `${a.pe_post_issue.toFixed(1)}×` : dash}</td><td className="num">{a.peer_pe ? `${a.peer_pe.toFixed(1)}×` : dash}</td></tr>)}
                {d.awaiting_listing.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center' }}>None awaiting listing.</td></tr>}
              </tbody></table></div>

              <div style={{ height: 36 }} />
              <div id="listed" /><SectionHead eyebrow="Track record" title="How recent listings traded" />
              <div className="panel">
                <div className="meter">
                  {d.recent_listed.filter((r) => r.measured && typeof r.since_listing_pct === 'number').slice(0, 24).map((r) => {
                    const v = r.since_listing_pct as number;
                    return <div className="meter-row" key={r.symbol} style={{ gridTemplateColumns: '120px 1fr 80px' }}><span className="lab">{r.symbol}</span><Bar pct={Math.min(100, (Math.abs(v) / 60) * 100)} kind={v >= 0 ? 'up' : 'down'} /><Chg v={v} dp={1} /></div>;
                  })}
                </div>
                <p className="dim" style={{ fontSize: 13.5, margin: '14px 0 0' }}>Measured from the first close to the last close in the mirror built {istStamp(d.generated_at)}, not from the issue price. Bars saturate at ±60%. {d.recent_listed.filter((r) => r.measured).length} of the last {d.recent_listed.length} listings have enough trading history to measure.</p>
              </div>
            </>
          )}
        </Async>
      </section>
    </>
  );
}
