'use client';

import { Async, Chg, PageHead, Rv, SectionHead } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { dash, dateLabel, num } from '@/lib/format';

export default function Ipo() {
  const f = useFeed('ipo');
  const d = f.data;
  return (
    <>
      <PageHead eyebrow="IPO" title="Books open now," em="and how last year listed." lede="Mainboard issues only. Demand, pricing and a first read of the financials, then how recent listings have actually traded since." />
      <section className="wrap">
        <Async loading={f.loading} error={f.error}>
          {d && (
            <>
              <SectionHead title="Open for subscription" />
              {d.open.length === 0 ? <p className="muted">No mainboard issue is open today.</p> : (
                <div className="grid g2">
                  {d.open.map((o) => (
                    <Rv key={o.symbol} className="panel spot">
                      <div className="eyebrow">{o.phase} · {o.days_left > 0 ? `${o.days_left} day${o.days_left > 1 ? 's' : ''} left` : 'closes today'}</div>
                      <div className="disp" style={{ fontSize: 34, margin: '12px 0' }}>{o.company}</div>
                      <div className="kv">
                        <div><div className="k">Price band</div><div className="v" style={{ fontSize: 15 }}>{o.price_band}</div></div>
                        <div><div className="k">Issue size</div><div className="v">₹{num(o.issue_size_cr)} cr</div></div>
                        <div><div className="k">Subscribed</div><div className="v">{o.subscription_x ? `${o.subscription_x.toFixed(2)}×` : dash}</div></div>
                        <div><div className="k">Lot / minimum</div><div className="v" style={{ fontSize: 15 }}>{o.lot_size} · ₹{num(o.min_investment)}</div></div>
                      </div>
                    </Rv>
                  ))}
                </div>
              )}
              <div style={{ height: 40 }} />
              <SectionHead title="Closed, awaiting listing" />
              <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Company</th><th>Price band</th><th>Closed</th><th>Lists</th><th>Revenue</th><th>PAT</th><th>P/E post issue</th><th>Peer P/E</th></tr></thead><tbody>
                {d.awaiting_listing.map((a) => <tr key={a.symbol}><td><div className="co"><b>{a.symbol}</b><span>{a.company}</span></div></td><td>{a.price_band}</td><td>{dateLabel(a.close_date)}</td><td>{dateLabel(a.listing_date)}</td><td className="num">{a.revenue_cr ? `₹${num(a.revenue_cr, 1)} cr` : dash}</td><td className="num">{a.pat_cr ? `₹${num(a.pat_cr, 1)} cr` : dash}</td><td className="num">{a.pe_post_issue ? `${a.pe_post_issue.toFixed(1)}×` : dash}</td><td className="num">{a.peer_pe ? `${a.peer_pe.toFixed(1)}×` : dash}</td></tr>)}
                {d.awaiting_listing.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center' }}>None awaiting listing.</td></tr>}
              </tbody></table></div>
              <div style={{ height: 40 }} />
              <SectionHead title="Recent listings, since listing" />
              <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Company</th><th>Price band</th><th>Listed</th><th>Since listing</th><th>From high</th></tr></thead><tbody>
                {d.recent_listed.slice(0, 40).map((r) => <tr key={r.symbol}><td><div className="co"><b>{r.symbol}</b><span>{r.company}</span></div></td><td>{r.price_band}</td><td>{dateLabel(r.listing_date)}</td><td>{r.measured ? <Chg v={r.since_listing_pct} dp={1} /> : <span className="dim">not measured</span>}</td><td>{r.measured ? <Chg v={r.from_high_pct} dp={1} /> : dash}</td></tr>)}
              </tbody></table></div>
              <p className="dim" style={{ fontSize: 12.5, marginTop: 12 }}>“Since listing” is measured from the first close, not the issue price. Grey-market premium is shown only where a source published it and is not a forecast.</p>
            </>
          )}
        </Async>
      </section>
    </>
  );
}
