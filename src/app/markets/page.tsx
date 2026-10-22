'use client';
// Markets: every instrument with its own last-trade time (E18). Commodity futures carry the contract's price unit, which is
// fixed by the exchange's contract specification; the contract month (expiry) is not in the quotes feed, so it is never
// guessed: each one reads "front-month future; expiry not in the feed".

import { useState } from 'react';
import Link from 'next/link';
import { InstrumentSheet } from '@/components/InstrumentSheet';
import type { Quote } from '@/lib/types';
import { MarketStance } from '@/components/AiTools';
import { DataStamp } from '@/components/DataStamp';
import { Chg, Flash, PageHead, Skel, Spark } from '@/components/ui';
import { useLiveQuotes } from '@/lib/data';
import { ago, num, quoteState } from '@/lib/format';

const GROUPS = ['All', 'India', 'Sectors', 'World', 'Commodities', 'Currency', 'Rates', 'Crypto'] as const;

/** Exchange contract units for the futures the quotes feed carries, keyed by symbol (contract specifications, not market data). */
const FUTURES: Record<string, { unit: string; venue: string }> = {
  'GC=F': { unit: 'US$ per troy ounce', venue: 'COMEX' },
  'SI=F': { unit: 'US$ per troy ounce', venue: 'COMEX' },
  'CL=F': { unit: 'US$ per barrel', venue: 'NYMEX' },
  'BZ=F': { unit: 'US$ per barrel', venue: 'ICE' },
  'NG=F': { unit: 'US$ per MMBtu', venue: 'NYMEX' },
  'HG=F': { unit: 'US$ per pound', venue: 'COMEX' },
};

export default function Markets() {
  const q = useLiveQuotes();
  const [g, setG] = useState<(typeof GROUPS)[number]>('All');
  const [open, setOpen] = useState<Quote | null>(null);
  const list = (q.data?.quotes ?? []).filter((x) => x.price !== null && (g === 'All' || x.group === g));
  const missing = q.data ? q.data.total - q.data.live : 0;
  const counts = new Map<string, number>(); for (const x of q.data?.quotes ?? []) if (x.price !== null) counts.set(x.group, (counts.get(x.group) ?? 0) + 1);
  return (
    <div className="sp">
      <PageHead method="markets" eyebrow="Markets" title="Indices, commodities and currencies," em="each with its own time." />
      <section className="wrap" style={{ paddingTop: 0 }}><DataStamp ids={['prices', 'barometer', 'screen']} /></section>
      <section className="wrap">
        <div className="sp-chips scroll mk-groups" role="group" aria-label="Instrument group">
          {GROUPS.map((x) => <button key={x} type="button" className="sp-chip" aria-pressed={g === x} onClick={() => setG(x)}>{x}{x !== 'All' && counts.has(x) ? <span className="num">{counts.get(x)}</span> : null}</button>)}
        </div>
        {q.loading ? <div className="mk-grid" aria-busy="true">{Array.from({ length: 8 }, (_, i) => <Skel key={i} h={150} />)}</div>
          : q.error && !q.data ? (
            <div className="state"><b>Quotes could not be fetched from Yahoo Finance.</b><p>No level is shown in place of a missing one ({q.error}). Index levels at the last close are on the <Link className="link" href="/brief/">brief</Link>.</p><div className="acts"><button type="button" className="act" onClick={() => window.location.reload()}>Try again</button></div></div>
          ) : list.length === 0 && g === 'All' ? (
            <div className="state"><b>No live quote answered{q.data ? `: 0 of ${q.data.total} instruments` : ''}.</b><p>Yahoo Finance returned nothing for this refresh. No level is shown in place of a missing one, and nothing is set to 0%. The Barometer below uses the last published close.</p><div className="acts"><button type="button" className="act" onClick={() => window.location.reload()}>Try again</button><Link className="act quiet" href="/brief/">Read the brief</Link></div></div>
          ) : list.length === 0 ? (
            <div className="state"><b>No instrument in this group answered.</b><p>Missing quotes are left out rather than shown as 0%.</p><div className="acts"><button type="button" className="act" onClick={() => setG('All')}>Show all groups</button></div></div>
          ) : (
            <div className="mk-grid">
              {list.map((x) => {
                const fut = FUTURES[x.symbol];
                const st = quoteState(x.at);
                return (
                  <article key={x.id} className="card tight mk-card">
                    <button type="button" className="mk-hit" onClick={() => setOpen(x)} aria-label={`${x.name}: open levels, ranges and returns`} />
                    <div className="mk-top"><span className="mk-nm">{x.name}</span><span className="mk-grp">{x.group}</span></div>
                    <div className="mk-px">
                      <Flash value={x.price}><span className="num">{x.prefix}{num(x.price, x.dp)}{x.group === 'Rates' ? '%' : ''}</span></Flash>
                      {x.group === 'Rates' && typeof x.prev === 'number' && typeof x.price === 'number' ? <Chg v={(x.price - x.prev) * 100} dp={0} suffix=" bp" /> : <Chg v={x.pct} />}
                    </div>
                    {fut && <p className="mk-unit">{fut.unit} · {fut.venue} front-month future; expiry not in the feed</p>}
                    <Spark series={x.series} up={(x.pct ?? 0) >= 0} height={40} />
                    <p className="mk-when">{st.label}</p>
                  </article>
                );
              })}
            </div>
          )}
        {open && <InstrumentSheet q={list.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
        <div className="sp-sec"><MarketStance /></div>
        {q.data && <p className="sp-note mk-foot">Fetched {ago(q.data.fetched_at)} from Yahoo Finance{q.error ? ` (the last refresh failed: ${q.error}; these are the previous quotes)` : ''}. Each card shows its own last-trade time, because markets close at different hours.{missing > 0 ? ` ${missing} instrument${missing > 1 ? 's' : ''} did not answer and ${missing > 1 ? 'are' : 'is'} left out rather than shown as 0%.` : ''} Commodities are futures: they differ from spot prices, and the contract rolls to the next month before expiry, which can move the level without any trade at the old price.</p>}
      </section>
    </div>
  );
}
