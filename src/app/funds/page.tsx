'use client';

// Funds: compare the three direct-plan funds the pipeline lists per category, on return, the falls it took to get there,
// and what each one actually holds. Primary action: pick a category. Category and sort live in the address.

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Async, Chg, PageHead, Rv, TabRow } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { dash, dateLabel, num, pct } from '@/lib/format';
import { ordinal } from '@/lib/status';
import type { Fund } from '@/lib/types';

type SortKey = 'r3' | 'r5' | 'r1' | 'dd3' | 'volatility';
const SORTS: readonly (readonly [SortKey, string])[] = [['r3', '3-yr return'], ['r5', '5-yr return'], ['r1', '1-yr return'], ['dd3', 'Smallest fall'], ['volatility', 'Lowest volatility']];
const isSort = (x: string | null): x is SortKey => SORTS.some(([k]) => k === x);
const fin = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const short = (n: string) => n.replace(/\s*-\s*Direct Plan\s*-\s*Growth( Option)?/i, '').replace(/\s*-\s*Direct\s*-\s*Growth/i, '');

/** One figure per order: the card's headline is the figure the funds are ordered by, so changing the order changes the number. */
const METRIC: Record<SortKey, { k: string; head: string; tone: 'chg' | 'down' | 'plain' }> = {
  r1: { k: '1 year', head: '1-year return', tone: 'chg' },
  r3: { k: '3 years, a year', head: '3-year return, a year', tone: 'chg' },
  r5: { k: '5 years, a year', head: '5-year return, a year', tone: 'chg' },
  dd3: { k: 'Worst fall, 3 yrs', head: 'worst fall in the last 3 years', tone: 'down' },
  volatility: { k: 'Volatility', head: 'volatility, last 3 years', tone: 'plain' },
};
const ORDER: readonly SortKey[] = ['r1', 'r3', 'r5', 'dd3', 'volatility'];

function Figure({ f, k }: { f: Fund; k: SortKey }) {
  const v = f[k];
  if (!fin(v)) return k === 'r5' && f.history_years < 5 ? <span className="dim" style={{ fontSize: 14 }}>under 5 yrs old</span> : k === 'r3' && f.history_years < 3 ? <span className="dim" style={{ fontSize: 14 }}>under 3 yrs old</span> : <>{dash}</>;
  const t = METRIC[k].tone;
  return t === 'chg' ? <Chg v={v} dp={1} /> : <span className={t === 'down' ? 'down' : undefined}>{pct(v, 1, false)}</span>;
}

function FundCard({ f, rank, sort, sortLabel }: { f: Fund; rank: number; sort: SortKey; sortLabel: string }) {
  const p = f.portfolio;
  const m = METRIC[sort];
  const has = fin(f[sort]);
  const rest = ORDER.filter((k) => k !== sort).slice(0, 4);
  // newest four calendar years, newest first (the feed's order is not guaranteed: sort, never slice blindly)
  const cal = [...(f.calendar ?? [])].sort((a, b) => b.year - a.year).slice(0, 4);
  const calMax = Math.max(5, ...cal.map((c) => Math.abs(c.ret)));
  return (
    <Rv className="panel" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
      <div>
        <span className="tag acc">#{rank} by {sortLabel.toLowerCase()}</span>
        <h2 style={{ font: '600 18px/1.3 var(--f-ui)', margin: '10px 0 2px' }}>{short(f.name)}</h2>
        <div className="dim" style={{ fontSize: 13.5 }}>{f.house} · launched {dateLabel(f.inception)}</div>
      </div>
      <div>
        <div className="disp" style={{ fontSize: 44, lineHeight: 1 }}><Figure f={f} k={sort} /></div>
        <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>{has ? m.head : `no ${m.head.replace(/, a year$/, '')} figure: ${num(f.history_years, 1)} yrs of history`}{sort === 'r3' && fin(f.percentile_r3) ? ` · ${ordinal(f.percentile_r3)} percentile in its category` : ''}</div>
      </div>
      <div className="kv" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {rest.map((k) => <div key={k}><div className="k">{METRIC[k].k}</div><div className="v"><Figure f={f} k={k} /></div></div>)}
      </div>
      {cal.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Calendar years</div>
          <div className="secbars" style={{ marginTop: 0 }}>
            {cal.map((c) => (
              <div className="secbar" key={c.year} style={{ gridTemplateColumns: '48px minmax(0, 1fr) 64px' }}>
                <span className="num">{c.year}</span>
                <span className="track" aria-hidden><i style={c.ret >= 0 ? { left: '50%', width: `${(Math.abs(c.ret) / calMax) * 50}%`, background: 'var(--up)' } : { right: '50%', width: `${(Math.abs(c.ret) / calMax) * 50}%`, background: 'var(--down)' }} /></span>
                <span className={`v num ${c.ret >= 0 ? 'up' : 'down'}`}>{c.ret >= 0 ? '+' : ''}{pct(c.ret, 1, false)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {p && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>What it holds · as on {p.as_on}</div>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 14 }}>{num(p.holdings_count)} holdings{fin(p.equity_pct) ? `, ${pct(p.equity_pct, 0, false)} in equity` : ''}.</p>
          {p.top_sectors.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>{p.top_sectors.slice(0, 3).map((s) => <span key={s.name} className="tag">{s.name} {pct(s.pct, 0, false)}</span>)}</div>}
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4, fontSize: 14 }}>
            {p.top_stocks.slice(0, 5).map((s) => <li key={s.name}><span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{s.name}</span><span className="num dim">{pct(s.pct, 1, false)}</span></span></li>)}
          </ol>
          {p.source_url && <a className="dim" href={p.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3 }}>Holdings source: ETMoney ↗</a>}
        </div>
      )}
      <div className="dim num" style={{ fontSize: 13, borderTop: '1px solid var(--line)', paddingTop: 10 }}>NAV ₹{num(f.nav, 2)} on {dateLabel(f.nav_date)} · AMFI scheme {f.code}</div>
    </Rv>
  );
}

function FundsPage() {
  const f = useFeed('funds');
  const sp = useSearchParams();
  const router = useRouter();
  const cats = f.data?.categories ?? [];
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<SortKey>('r3');
  useEffect(() => { const c = sp.get('cat'); const s = sp.get('sort'); if (c) setCat(c); if (isSort(s)) setSort(s); }, [sp]);
  const active = cats.find((c) => c.key === cat) ?? cats[0];
  const go = (c: string, s: SortKey) => { setCat(c); setSort(s); router.replace(`/funds/?cat=${encodeURIComponent(c)}${s === 'r3' ? '' : `&sort=${s}`}`, { scroll: false }); };
  const funds = useMemo(() => [...(active?.funds ?? [])].sort((a, b) => {
    const av = a[sort], bv = b[sort];
    if (!fin(av)) return 1;
    if (!fin(bv)) return -1;
    return sort === 'volatility' ? av - bv : bv - av;          // fall (dd3) is negative: the smallest fall is the largest number
  }), [active, sort]);
  const sortLabel = SORTS.find(([k]) => k === sort)?.[1] ?? '';
  const navDates = funds.map((x) => x.nav_date).sort();
  return (
    <>
      <PageHead method="funds" eyebrow="Funds" title="Direct-plan funds," em="return against risk." />
      <section className="wrap">
        <Async loading={f.loading} error={f.error} rows={3}>
          {cats.length > 0 && <TabRow label="Fund categories" value={active?.key ?? ''} onChange={(k) => go(k, sort)} options={cats.map((c) => [c.key, c.label] as const)} />}
          {active && <p className="muted" style={{ margin: '14px 0 12px', maxWidth: '70ch' }}>{active.blurb}</p>}
          <div className="filters" role="group" aria-label="Order the funds by">
            <span className="eyebrow">Order by</span>
            {SORTS.map(([k, l]) => <button key={k} className="chip" aria-pressed={sort === k} onClick={() => go(active?.key ?? '', k)}>{l}</button>)}
          </div>
          <div className="grid g3" style={{ alignItems: 'start' }}>{funds.map((x, i) => <FundCard key={x.code} f={x} rank={i + 1} sort={sort} sortLabel={sortLabel} />)}</div>
          <div className="panel tight" style={{ marginTop: 14 }}>
            <p className="dim" style={{ fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>
              <b style={{ color: 'var(--text)' }}>How these three are chosen:</b> the highest 3-year returns in the category. A ranking on past returns favours what has
              just done well, and last period&apos;s leaders often do not lead the next. Read the worst fall and the holdings before the return.
              {navDates.length > 0 && <> NAV dates {dateLabel(navDates[0])}{navDates[0] !== navDates[navDates.length - 1] ? ` to ${dateLabel(navDates[navDates.length - 1])}` : ''}.</>}
              {' '}{(f.data?.basis ?? '').replace(/\.\s*$/, '')}. 1, 3 and 5-year figures are annualised changes in NAV between two dates; the worst fall is the deepest peak-to-trough drop in the last three years; volatility is the annualised standard deviation of monthly returns over the last three years (one NAV per month, so daily valuation noise does not inflate it). Not investment advice.
            </p>
          </div>
        </Async>
      </section>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="wrap section"><h1 className="sr">Direct-plan funds</h1></div>}><FundsPage /></Suspense>;
}
