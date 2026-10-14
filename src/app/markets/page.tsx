'use client';

import { useState } from 'react';
import { MarketStance } from '@/components/AiTools';
import { DataStamp } from '@/components/DataStamp';
import { Async, Chg, PageHead, Rv, Spark } from '@/components/ui';
import { useQuotes } from '@/lib/data';
import { ago, num, quoteState } from '@/lib/format';

const GROUPS = ['All', 'India', 'Sectors', 'World', 'Commodities', 'Currency', 'Rates', 'Crypto'] as const;

export default function Markets() {
  const q = useQuotes();
  const [g, setG] = useState<(typeof GROUPS)[number]>('All');
  const list = (q.data?.quotes ?? []).filter((x) => x.price !== null && (g === 'All' || x.group === g));
  const missing = q.data ? q.data.total - q.data.live : 0;
  return (
    <>
      <PageHead eyebrow="Indices, commodities, currencies, rates" title="Markets" em="at a glance." lede="India, its sectors, the world, commodities, currencies and rates, each with a month of closes. Quotes come from Yahoo Finance, cached for up to five minutes, and each shows when it last traded." />
      <section className="wrap" style={{ paddingTop: 0 }}><DataStamp ids={['barometer', 'screen']} /><p className="dim" style={{ fontSize: 13.5, margin: '8px 0 0' }}>Each quote shows its own last-trade time. The stance, barometer and breadth are from the sessions stamped above.</p></section>
      <section className="wrap">
        <div className="filters" role="group" aria-label="Instrument group">
          {GROUPS.map((x) => <button key={x} className="chip" aria-pressed={g === x} onClick={() => setG(x)}>{x}</button>)}
        </div>
        <Async loading={q.loading} error={q.error} rows={3}>
          <div className="qgrid">
            {list.map((x) => (
              <Rv key={x.id} className="qcard spot">
                <div className="qrow"><span className="nm">{x.name}</span><span className="tag">{x.group}</span></div>
                <div className="qrow"><span className="px">{x.prefix}{num(x.price, x.dp)}{x.group === 'Rates' ? '%' : ''}</span>{x.group === 'Rates' && typeof x.prev === 'number' && typeof x.price === 'number' ? <span className={`chg num ${x.price - x.prev >= 0 ? 'up' : 'down'}`}>{x.price - x.prev >= 0 ? '+' : '−'}{Math.abs((x.price - x.prev) * 100).toFixed(1)} bp</span> : <Chg v={x.pct} />}</div>
                <Spark series={x.series} up={(x.pct ?? 0) >= 0} height={46} />
                <div className="dim" style={{ fontSize: 13, fontFamily: 'var(--f-mono)' }}>{quoteState(x.at).label}</div>
              </Rv>
            ))}
          </div>
          <div style={{ height: 24 }} /><MarketStance />
          {q.data && <p className="dim" style={{ fontSize: 13.5, marginTop: 16 }}>Fetched {ago(q.data.fetched_at)} from Yahoo Finance.{missing > 0 ? ` ${missing} instrument${missing > 1 ? 's' : ''} did not answer and ${missing > 1 ? 'are' : 'is'} omitted rather than shown as 0%.` : ''} Gold, silver, oil and gas are futures contracts, so they differ slightly from spot prices.</p>}
        </Async>
      </section>
    </>
  );
}
