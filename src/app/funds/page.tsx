'use client';

// Funds: how current the NAVs are first (E14), then a concise comparison of the funds the pipeline lists in a category, with
// the falls and volatility beside the returns and the holdings one tap away (E15). Category and order live in the address.

import { Fragment, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Chg, PageHead, Skel } from '@/components/ui';
import { useFeed, useSummary } from '@/lib/data';
import { dash, dateLabel, num, pct } from '@/lib/format';
import { ordinal, plural, sessionGaps } from '@/lib/status';
import { navFreshness } from '@/lib/support';
import type { Fund } from '@/lib/types';

type SortKey = 'r3' | 'r5' | 'r1' | 'dd3' | 'volatility' | 'roll';
/** Two families of order: return first (the feed's own ranking basis) or risk first. */
const SORTS: readonly (readonly [SortKey, string, 'return' | 'risk'])[] = [
  ['r3', '3-yr return', 'return'], ['r5', '5-yr return', 'return'], ['r1', '1-yr return', 'return'],
  ['dd3', 'Smallest fall', 'risk'], ['volatility', 'Lowest volatility', 'risk'], ['roll', 'Best worst 3-yr window', 'risk'],
];
const isSort = (x: string | null): x is SortKey => SORTS.some(([k]) => k === x);
const fin = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const short = (n: string) => n.replace(/\s*-\s*Direct Plan\s*-\s*Growth( Option)?/i, '').replace(/\s*-\s*Direct\s*-\s*Growth/i, '');
const valueOf = (f: Fund, k: SortKey) => (k === 'roll' ? f.rolling3y?.worst ?? null : f[k]);

/** A return cell: the figure, or why it has none (too young), never a zero. */
function Ret({ f, k }: { f: Fund; k: 'r1' | 'r3' | 'r5' }) {
  const v = f[k];
  if (fin(v)) return <Chg v={v} dp={1} />;
  const yrs = k === 'r5' ? 5 : k === 'r3' ? 3 : 1;
  return <span className="dim">{f.history_years < yrs ? `under ${yrs} yrs old` : 'not in feed'}</span>;
}

function Holdings({ f }: { f: Fund }) {
  const p = f.portfolio;
  const cal = [...(f.calendar ?? [])].sort((a, b) => b.year - a.year).slice(0, 5);
  return (
    <div className="fd-x">
      <div>
        <h4>What it holds{p ? ` · as on ${p.as_on}` : ''}</h4>
        {!p ? <p className="sp-note">Holdings are not in the feed for this fund.</p> : (
          <>
            <p className="sp-note">{num(p.holdings_count)} holdings{fin(p.equity_pct) ? `, ${pct(p.equity_pct, 0, false)} in equity` : ''}{p.top_sectors.length ? `. Largest sectors: ${p.top_sectors.slice(0, 3).map((s) => `${s.name} ${pct(s.pct, 0, false)}`).join(', ')}` : ''}.</p>
            <ol className="fd-top">{p.top_stocks.slice(0, 6).map((s) => <li key={s.name}><span>{s.name}</span><span className="num">{pct(s.pct, 1, false)}</span></li>)}</ol>
            {p.source_url && <a className="link" href={p.source_url} target="_blank" rel="noopener noreferrer">Holdings source: ETMoney ↗</a>}
          </>
        )}
      </div>
      <div>
        <h4>Calendar years · NAV change</h4>
        {cal.length === 0 ? <p className="sp-note">No complete calendar year in the feed.</p> : (
          <ul className="fd-cal">{cal.map((c) => <li key={c.year}><span className="num">{c.year}</span><span className="fd-calbar" aria-hidden><i className={c.ret >= 0 ? 'up' : 'down'} style={{ width: `${Math.min(100, Math.abs(c.ret) * 2)}%` }} /></span><Chg v={c.ret} dp={1} /></li>)}</ul>
        )}
        {f.rolling3y && <p className="sp-note">Every 3-year window since launch ({num(f.rolling3y.windows)} monthly starts): best {pct(f.rolling3y.best, 1, false)}, median {pct(f.rolling3y.median, 1, false)}, worst {pct(f.rolling3y.worst, 1, false)} a year; {pct(f.rolling3y.above_7pct, 0, false)} of windows beat 7% a year.</p>}
      </div>
      <p className="sp-note fd-id">NAV ₹{num(f.nav, 2)} on {dateLabel(f.nav_date)} · AMFI scheme {f.code} · ISIN {f.isin} · launched {dateLabel(f.inception)} · <a className="link" href={`https://api.mfapi.in/mf/${f.code}`} target="_blank" rel="noopener noreferrer">NAV history ↗</a></p>
    </div>
  );
}

function FundsPage() {
  const f = useFeed('funds');
  const sum = useSummary();
  const sp = useSearchParams();
  const router = useRouter();
  const cats = useMemo(() => f.data?.categories ?? [], [f.data]);
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<SortKey>('r3');
  const [open, setOpen] = useState<number | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  useEffect(() => { const c = sp.get('cat'); const s = sp.get('sort'); if (c) setCat(c); if (isSort(s)) setSort(s); }, [sp]);
  const active = cats.find((c) => c.key === cat) ?? cats[0];
  const go = (c: string, s: SortKey) => { setCat(c); setSort(s); setOpen(null); router.replace(`/funds/?cat=${encodeURIComponent(c)}${s === 'r3' ? '' : `&sort=${s}`}`, { scroll: false }); };
  const funds = useMemo(() => [...(active?.funds ?? [])].sort((a, b) => {
    const av = valueOf(a, sort), bv = valueOf(b, sort);
    if (!fin(av)) return 1;
    if (!fin(bv)) return -1;
    return sort === 'volatility' ? av - bv : bv - av;          // a fall is negative: the smallest fall is the largest number
  }), [active, sort]);
  // E15: a market reference from the feed itself, a Nifty 50 index fund, never presented as a category's own benchmark
  const ref = useMemo(() => {
    const idx = cats.find((c) => c.key === 'index');
    if (!idx || active?.key === 'index') return null;
    return [...idx.funds].filter((x) => fin(x.r3)).sort((a, b) => b.history_years - a.history_years)[0] ?? null;
  }, [cats, active]);
  const all = useMemo(() => cats.flatMap((c) => c.funds), [cats]);
  const skip = useMemo(() => new Set(sessionGaps(sum.data?.sessions)), [sum.data?.sessions]);
  const fresh = useMemo(() => (now ? navFreshness(all.map((x) => x.nav_date), now, skip) : null), [all, now, skip]);
  const built = f.data?.generated_at ? new Date(f.data.generated_at) : null;
  const sortFamily = SORTS.find(([k]) => k === sort)?.[2] ?? 'return';
  const tone = fresh?.state === 'current' ? 'ok' : fresh?.state === 'delayed' ? 'warn' : 'bad';

  return (
    <div className="sp">
      <PageHead method="funds" eyebrow="Funds" title="Direct-plan funds," em="return beside risk." />
      <section className="wrap">
        {f.loading ? <div className="sp-stack" aria-busy="true"><Skel h={84} /><Skel h={52} /><Skel h={300} /></div>
          : f.error || !f.data ? <div className="state"><b>The fund feed did not load.</b><p>No fund figures are shown in its place{f.error ? ` (${f.error})` : ''}. It is read live, so a refresh usually brings it back.</p><div className="acts"><button type="button" className="act" onClick={() => window.location.reload()}>Refresh</button></div></div>
            : cats.length === 0 ? <div className="state"><b>The fund feed has no categories.</b><p>That is a gap in the feed, not an empty market. Nothing is estimated in its place.</p></div>
              : (
                <>
                  <div className="sp-status" role="group" aria-label="How current these funds are">
                    <div><span className="k">Latest NAV</span><span className="v">{fresh?.newest ? dateLabel(fresh.newest) : 'not stated'}</span><span className="n">{fresh && fresh.behind > 0 ? `${plural(fresh.behind, 'fund')} on an older NAV, earliest ${dateLabel(fresh.oldest)}` : `all ${all.length} funds on the same date`}</span></div>
                    <div><span className="k">Expected update</span><span className="v">Daily NAV</span><span className="n">AMFI publishes each business-day evening; this feed should hold {fresh ? dateLabel(fresh.expected) : 'the last business day'}</span></div>
                    <div><span className="k">Feed status</span><span className="v">{fresh ? <span className={`pill ${tone}`}>{fresh.state === 'current' ? 'Current' : fresh.state === 'unknown' ? 'NAV date not stated' : `${plural(fresh.lag, 'business day')} behind`}</span> : <Skel h={20} w={120} />}</span><span className="n">{fresh && fresh.lag > 0 ? 'Returns below run to the latest NAV, not today' : 'Computed from the NAV dates in the feed'}</span></div>
                    <div><span className="k">Feed built</span><span className="v">{built && !Number.isNaN(built.getTime()) ? dateLabel(f.data.generated_at.slice(0, 10)) : 'not stated'}</span><span className="n">{built && !Number.isNaN(built.getTime()) ? `${built.toISOString().slice(11, 16)} UTC` : ''}</span></div>
                  </div>
                  {fresh && fresh.lag > 1 && <div className="state fd-delay" role="alert"><b>Fund data is {plural(fresh.lag, 'business day')} behind; the fund job has not refreshed since {built && !Number.isNaN(built.getTime()) ? dateLabel(f.data.generated_at.slice(0, 10)) : 'a date the feed does not state'}.</b><p>The newest NAV here is {dateLabel(fresh.newest)}; the expected one is {dateLabel(fresh.expected)}. Every return, fall and volatility figure runs to the {dateLabel(fresh.newest)} NAV, and nothing is estimated for the missing days. <a className="link" href="https://www.amfiindia.com/net-asset-value" target="_blank" rel="noopener noreferrer">Today&apos;s NAVs on AMFI ↗</a></p></div>}

                  <div className="sp-controls">
                    <label className="sr" htmlFor="fd-cat">Fund category</label>
                    <select id="fd-cat" className="field fd-cat" value={active?.key ?? ''} onChange={(e) => go(e.target.value, sort)}>
                      {cats.map((c) => <option key={c.key} value={c.key}>{c.label} · {c.funds.length}</option>)}
                    </select>
                    <div className="grp" role="group" aria-label="Order the funds by">
                      <span className="lbl">Return first</span>
                      <div className="sp-seg">{SORTS.filter((s) => s[2] === 'return').map(([k, l]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => go(active?.key ?? '', k)}>{l}</button>)}</div>
                      <span className="lbl">Risk first</span>
                      <div className="sp-seg">{SORTS.filter((s) => s[2] === 'risk').map(([k, l]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => go(active?.key ?? '', k)}>{l}</button>)}</div>
                    </div>
                  </div>
                  {active?.blurb && <p className="sp-note fd-blurb">{active.blurb}</p>}

                  <section className="card flush" aria-labelledby="fd-h">
                    <div className="card-h"><h2 id="fd-h">{active?.label}: {plural(funds.length, 'fund')}, ordered by {SORTS.find(([k]) => k === sort)?.[1].toLowerCase()}</h2></div>
                    <div className="sp-tblwrap" tabIndex={0} role="region" aria-label="Fund comparison (scrolls sideways on small screens)">
                      <table className="sp-tbl fd-tbl">
                        <thead><tr>
                          <th scope="col">Fund</th>
                          <th scope="col" className="r">1 yr<small>change in NAV</small></th>
                          <th scope="col" className="r">3 yrs<small>a year</small></th>
                          <th scope="col" className="r">5 yrs<small>a year</small></th>
                          <th scope="col" className="r">Worst fall<small>last 3 yrs</small></th>
                          <th scope="col" className="r">Volatility<small>3 yrs, a year</small></th>
                          <th scope="col" className="r">Worst 3-yr window<small>a year</small></th>
                          <th scope="col">NAV date</th>
                          <th scope="col"><span className="sr">Details</span></th>
                        </tr></thead>
                        <tbody>
                          {funds.map((x, i) => (
                            <Fragment key={x.code}>
                              <tr className={open === x.code ? 'on' : undefined}>
                                <td className="co"><b><span className="fd-rank num">{i + 1}</span>{short(x.name)}</b><span>{x.house}{fin(x.percentile_r3) ? ` · 3-yr return ${ordinal(x.percentile_r3)} percentile in category` : ''}</span></td>
                                <td className="r"><Ret f={x} k="r1" /></td>
                                <td className="r"><Ret f={x} k="r3" /></td>
                                <td className="r"><Ret f={x} k="r5" /></td>
                                <td className="r">{fin(x.dd3) ? <span className="down">{pct(x.dd3, 1, false)}</span> : dash}</td>
                                <td className="r">{fin(x.volatility) ? pct(x.volatility, 1, false) : dash}</td>
                                <td className="r">{x.rolling3y ? <Chg v={x.rolling3y.worst} dp={1} /> : <span className="dim">not in feed</span>}</td>
                                <td className="num">{dateLabel(x.nav_date)}</td>
                                <td><button type="button" className="act quiet fd-more" aria-expanded={open === x.code} aria-controls={`fd-${x.code}`} onClick={() => setOpen(open === x.code ? null : x.code)}>{open === x.code ? 'Hide' : 'Holdings'}</button></td>
                              </tr>
                              {open === x.code && <tr className="fd-xrow" id={`fd-${x.code}`}><td colSpan={9}><Holdings f={x} /></td></tr>}
                            </Fragment>
                          ))}
                          {ref && (
                            <tr className="fd-ref">
                              <td className="co"><b>Reference: {short(ref.name)}</b><span>A Nifty 50 index fund from this feed: the broad market, not {active?.label}&apos;s own benchmark (the feed carries none)</span></td>
                              <td className="r"><Ret f={ref} k="r1" /></td>
                              <td className="r"><Ret f={ref} k="r3" /></td>
                              <td className="r"><Ret f={ref} k="r5" /></td>
                              <td className="r">{fin(ref.dd3) ? <span className="down">{pct(ref.dd3, 1, false)}</span> : dash}</td>
                              <td className="r">{fin(ref.volatility) ? pct(ref.volatility, 1, false) : dash}</td>
                              <td className="r">{ref.rolling3y ? <Chg v={ref.rolling3y.worst} dp={1} /> : dash}</td>
                              <td className="num">{dateLabel(ref.nav_date)}</td>
                              <td />
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="card-foot">Returns are annualised changes in NAV between two dates, to each fund&apos;s NAV date. Worst fall: the deepest peak-to-trough drop in the last three years. Volatility: annualised standard deviation of monthly returns over three years. Worst 3-yr window: the lowest annual return over any three-year holding since launch. {sortFamily === 'risk' ? 'Ordered risk first: the order says nothing about future falls.' : 'Ordered by past return: see the caveat below.'}</p>
                  </section>

                  <div className="grid-2 sp-sec fd-notes">
                    <section className="card tight">
                      <div className="card-h"><h2>How these funds are chosen</h2></div>
                      <p className="sp-note">The pipeline lists the <b>three highest 3-year returns</b> in each category. A ranking on past returns favours what has just done well, and last period&apos;s leaders often do not lead the next. Read the worst fall, the worst 3-year window and the holdings before the return.</p>
                      <p className="sp-note fd-gap">The full list of eligible funds in each category is not in this feed, so this page cannot show it, or say how many funds were passed over.</p>
                    </section>
                    <section className="card tight">
                      <div className="card-h"><h2>Basis</h2></div>
                      <p className="sp-note">{(f.data.basis ?? '').replace(/\.\s*$/, '')}. Holdings are read from ETMoney and carry their own date. Information only, not investment advice.</p>
                      <p className="sp-note fd-gap"><Link className="link" href="/about/#funds">How fund figures are computed</Link></p>
                    </section>
                  </div>
                </>
              )}
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="wrap section"><h1 className="sr">Direct-plan funds</h1></div>}><FundsPage /></Suspense>;
}
