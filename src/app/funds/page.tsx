'use client';

import { useMemo, useState } from 'react';
import { Async, Chg, PageHead } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { dash, dateLabel, num } from '@/lib/format';

type SortKey = 'r3' | 'r5' | 'r1' | 'volatility' | 'dd3';

export default function Funds() {
  const f = useFeed('funds');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<SortKey>('r3');
  const cats = f.data?.categories ?? [];
  const active = cats.find((c) => c.key === cat) ?? cats[0];
  const funds = useMemo(() => {
    const list = [...(active?.funds ?? [])];
    // drawdown and volatility: lower magnitude is better; returns: higher is better
    return list.sort((a, b) => {
      const av = a[sort], bv = b[sort];
      if (av == null) return 1;
      if (bv == null) return -1;
      return sort === 'volatility' ? av - bv : sort === 'dd3' ? bv - av : bv - av;
    });
  }, [active, sort]);
  return (
    <>
      <PageHead eyebrow="Funds" title="Direct-plan funds," em="return against risk." lede="Annualised returns set against the worst fall and the volatility it took to get there, from AMFI's official NAV history. These are lump-sum returns, not SIP returns, for direct plans only." />
      <section className="wrap">
        <Async loading={f.loading} error={f.error}>
          <div className="filters" style={{ alignItems: 'center' }}>
            <label className="eyebrow" htmlFor="fund-cat">Category</label>
            <select id="fund-cat" className="field" style={{ height: 38, minWidth: 240 }} value={active?.key ?? ''} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
            {active && <span className="muted num" style={{ fontSize: 14 }}>{funds.length} funds · NAV dates {dateLabel(funds.map((x) => x.nav_date).sort()[0])}{funds.length > 0 && funds.map((x) => x.nav_date).sort()[0] !== funds.map((x) => x.nav_date).sort().slice(-1)[0] ? ` to ${dateLabel(funds.map((x) => x.nav_date).sort().slice(-1)[0])}` : ''}</span>}
          </div>
          {active && <p className="muted" style={{ marginTop: 0 }}>{active.blurb}</p>}
          <div className="filters" role="group" aria-label="Sort by">
            <span className="eyebrow">Sort</span>
            {([['r3', '3-yr return'], ['r5', '5-yr return'], ['r1', '1-yr return'], ['dd3', 'Smallest fall'], ['volatility', 'Lowest volatility']] as const).map(([k, l]) => <button key={k} className="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}
          </div>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Fund</th><th>NAV</th><th>1Y</th><th>3Y p.a.</th><th>5Y p.a.</th><th>Worst fall (3Y)</th><th>Volatility</th><th>Rolling 3Y worst / median</th></tr></thead><tbody>
            {funds.map((x) => (
              <tr key={x.code} style={{ cursor: 'default' }}>
                <td><div className="co"><b>{x.name.replace(/ - Direct Plan - Growth/i, '')}</b><span>{x.house} · {num(x.history_years, 1)} yrs of history · AMFI scheme {x.code}</span></div></td>
                <td className="num">₹{num(x.nav, 2)}<div className="dim" style={{ fontSize: 12, fontFamily: 'var(--f-mono)' }}>as of {dateLabel(x.nav_date)}</div></td>
                <td><Chg v={x.r1} dp={1} /></td><td><Chg v={x.r3} dp={1} /></td><td><Chg v={x.r5} dp={1} /></td>
                <td className="num down">{x.dd3 == null ? dash : `${x.dd3.toFixed(1)}%`}</td>
                <td className="num">{x.volatility == null ? dash : `${x.volatility.toFixed(1)}%`}</td>
                <td className="num">{x.rolling3y ? `${x.rolling3y.worst.toFixed(1)}% / ${x.rolling3y.median.toFixed(1)}%` : dash}</td>
              </tr>
            ))}
          </tbody></table></div>
          <p className="dim" style={{ fontSize: 13.5, marginTop: 12 }}>{f.data?.basis}. Method: 1Y, 3Y and 5Y are annualised changes in NAV between two dates (a dash where the fund has not existed that long); &ldquo;worst fall&rdquo; is the deepest peak-to-trough NAV drop in the last three years; volatility is the annualised standard deviation of daily NAV changes; &ldquo;rolling 3Y&rdquo; takes every possible three-year window in the fund&apos;s history and shows the worst and the median annualised result. Funds with under three years of history have no 3Y figures. Past returns do not indicate future returns. Expense ratios are not in the data, which is why only direct plans are listed.</p>
        </Async>
      </section>
    </>
  );
}
