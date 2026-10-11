'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import SymbolPicker from '@/components/SymbolPicker';
import { Async, Chg, PageHead } from '@/components/ui';
import { useEngines, useFeed, usePx } from '@/lib/data';
import { dash, dateLabel, num } from '@/lib/format';
import { useStoredList } from '@/lib/store';

export default function Watchlist() {
  const s = useFeed('screen');
  const eng = useEngines();
  const [list, add, remove] = useStoredList('alpha-watchlist');
  const px = usePx(list);
  const rows = useMemo(() => list.map((x) => s.data?.rows.find((r) => r.sym === x)).filter((r): r is NonNullable<typeof r> => !!r), [list, s.data]);
  const sigs = useMemo(() => new Map((eng.data?.signals ?? []).map((x) => [x.sym, x])), [eng.data]);
  const csv = () => {
    const lines = ['symbol,name,price,1d_pct,1m_pct,1y_pct,composite,next_results', ...rows.map((r) => [r.sym, `"${r.name}"`, r.price, r.r1d, r.r1m, r.r1y, r.comp, r.next_earnings].join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'alpha-watchlist.csv';
    a.click();
  };
  return (
    <>
      <PageHead eyebrow="Watchlist" title="Your names," em="kept in this browser." lede="Nothing is uploaded: the list lives in your browser's own storage, so it is private and it goes if you clear site data. Flags show an upcoming results date or a live engine signal." />
      <section className="wrap">
        <div className="filters"><SymbolPicker onPick={add} exclude={list} />{rows.length > 0 && <><button className="chip" onClick={csv}>Download CSV</button><Link className="chip" href={`/compare/?s=${rows.slice(0, 4).map((r) => r.sym).join(',')}`}>Compare the first {Math.min(4, rows.length)}</Link></>}</div>
        <Async loading={s.loading} error={s.error} rows={3}>
          {rows.length === 0 ? <p className="notice">Empty. Search above, or press the star on any company page.</p> : (
            <div className="tbl-wrap" style={{ maxHeight: 'none' }}><table className="tbl">
              <thead><tr><th>Company</th><th>Price</th><th>1D</th><th>1M</th><th>1Y</th><th>Composite</th><th>Flags</th><th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.sym} style={{ cursor: 'default' }}>
                  <td><Link href={`/company/?s=${r.sym}`} className="co"><b>{r.sym}</b><span>{r.name}</span></Link></td>
                  <td className="num">₹{num(px.quotes[r.sym]?.price ?? r.price, 2)}{px.quotes[r.sym] && <span className="tag acc" style={{ marginLeft: 6 }}>live</span>}</td><td><Chg v={px.quotes[r.sym]?.pct ?? r.r1d} dp={1} /></td><td><Chg v={r.r1m} dp={1} /></td><td><Chg v={r.r1y} dp={1} /></td>
                  <td className="num">{typeof r.comp === 'number' ? Math.round(r.comp) : dash}</td>
                  <td style={{ textAlign: 'left' }}>{r.next_earnings && <span className="tag">Results {dateLabel(r.next_earnings)}</span>} {sigs.get(r.sym) && <Link href="/engines/" className="tag acc">{sigs.get(r.sym)?.engine_name} signal</Link>}</td>
                  <td><button className="chip" onClick={() => remove(r.sym)} aria-label={`Remove ${r.sym}`}>✕</button></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Async>
      </section>
    </>
  );
}
