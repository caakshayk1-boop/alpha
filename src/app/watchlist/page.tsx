'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import SymbolPicker from '@/components/SymbolPicker';
import CardPanel from '@/components/CardPanel';
import { Async, Chg, Flash, PageHead } from '@/components/ui';
import { DataStamp } from '@/components/DataStamp';
import { useSignals, useFeed, useLive, usePx } from '@/lib/data';
import { priceLabel, priceView, sessionLabel } from '@/lib/price';
import { dash, dateLabel, num } from '@/lib/format';
import { useStoredList } from '@/lib/store';
import type { CurrentCompany } from '@/lib/card';
import { companyHref } from '@/lib/slug';

export default function Watchlist() {
  const s = useFeed('screen');
  const eng = useSignals();
  const [list, add, remove, addAll] = useStoredList('alpha-watchlist');
  const px = usePx(list);
  const lv = useLive();
  const closeOn = sessionLabel(s.data?.breadth.as_of);
  const rows = useMemo(() => list.map((x) => s.data?.rows.find((r) => r.sym === x)).filter((r): r is NonNullable<typeof r> => !!r), [list, s.data]);
  const sigs = useMemo(() => new Map((eng.data?.signals ?? []).filter((x) => x.status === 'open' || x.status === 'pending').map((x) => [x.sym, x])), [eng.data]);
  const current = useMemo(() => {
    const m: Record<string, CurrentCompany> = {};
    for (const r of s.data?.rows ?? []) m[r.sym] = { price: typeof r.price === 'number' ? r.price : null, asOf: r.last_date ?? null, nextResults: r.next_earnings ?? null, engines: (eng.data?.signals ?? []).filter((x) => x.sym === r.sym && (x.status === 'open' || x.status === 'pending')).map((x) => ({ engine: `Swing ${x.setup}`, rankingStatus: null, tradingStatus: null })) };
    return m;
  }, [s.data, eng.data]);
  const csv = () => {
    const lines = ['symbol,name,close_date,close_price,1d_pct,1m_pct,1y_pct,composite,next_results', ...rows.map((r) => [r.sym, `"${r.name}"`, r.last_date ?? '', r.price, r.r1d, r.r1m, r.r1y, r.comp, r.next_earnings].join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'alpha-watchlist.csv';
    a.click();
  };
  return (
    <>
      <PageHead method="watchlist" eyebrow="Watchlist" title="Your names," em="kept in this browser." />
      <section className="wrap" style={{ paddingTop: 0 }}><DataStamp ids={['prices', 'screen']} /></section>
      <section className="wrap">
        <div className="filters"><SymbolPicker onPick={add} exclude={list} />{rows.length > 0 && <><button className="chip" onClick={csv}>Download CSV</button><Link className="chip" href={`/compare/?s=${rows.slice(0, 4).map((r) => r.sym).join(',')}`}>Compare the first {Math.min(4, rows.length)}</Link></>}</div>
        <Async loading={s.loading} error={s.error} rows={3}>
          {rows.length === 0 ? <div className="panel"><div className="eyebrow">Start in three steps</div><ol className="muted" style={{ paddingLeft: 20, lineHeight: 1.8, margin: '8px 0 0' }}><li>Find a company: search above, or <Link href="/screen/" style={{ color: 'var(--accent-2)' }}>run a screen</Link> and press Watch.</li><li>Press the star on its page, or save a Research Card below with the question you are asking.</li><li>Come back: this table shows results dates and engine signals for your names.</li></ol></div> : (
            <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}><table className="tbl">
              <thead><tr><th>Company</th><th>Price</th><th>Day</th><th>1M <span className="dim" style={{ fontWeight: 400 }}>to {closeOn}</span></th><th>1Y <span className="dim" style={{ fontWeight: 400 }}>to {closeOn}</span></th><th>Composite</th><th>Flags</th><th /></tr></thead>
              <tbody>{rows.map((r) => { const pv = priceView(r.sym, r, lv.snap, px.quotes[r.sym]); const pl = priceLabel(pv); return (
                <tr key={r.sym} style={{ cursor: 'default' }}>
                  <td><Link href={companyHref(r.sym)} className="co"><b>{r.sym}</b><span>{r.name}</span></Link></td>
                  <td className="num"><Flash value={pv.price}>₹{num(pv.price, 2)}</Flash><div className="dim" style={{ fontSize: 12, fontWeight: 400 }}>{pl.text}</div></td><td><Flash value={pv.pct} dir={null}><Chg v={pv.pct} dp={1} /></Flash></td><td><Chg v={r.r1m} dp={1} /></td><td><Chg v={r.r1y} dp={1} /></td>
                  <td className="num">{typeof r.comp === 'number' ? Math.round(r.comp) : dash}</td>
                  <td style={{ textAlign: 'left' }}>{r.next_earnings && <span className="tag">Results {dateLabel(r.next_earnings)}</span>} {sigs.get(r.sym) && <Link href="/engines/" className="tag acc">Swing {sigs.get(r.sym)?.setup.toLowerCase()} signal</Link>}</td>
                  <td><button className="chip" onClick={() => remove(r.sym)} aria-label={`Remove ${r.sym}`}>✕</button></td>
                </tr>); })}</tbody>
            </table></div>
          )}
        </Async>
      </section>
      <section className="wrap section"><CardPanel watchlist={list} onImportWatchlist={addAll} current={current} /></section>
    </>
  );
}
