'use client';

import { RangeBar } from '@/components/Peek';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Async, Bar, Chg, Flash, LazyMount, Notice, Rv, Scorecard, SectionHead, Skel, TabRow } from '@/components/ui';
import { DataStamp } from '@/components/DataStamp';
import { STATE_TEXT, STATE_TONE, STOP_TEXT, mark, markSource, money, noSessionDays, priceFor } from '@/lib/plan';
import { AskCompany, MetricPanel } from '@/components/Explain';
import { GLOSSARY } from '@/lib/glossary';
import StockChart from '@/components/StockChart';
import { DecisionDesk, ExternalLinks, LookalikesLazy, RiskCone, SaveCardButton } from '@/components/CompanyTools';
import { useSignals, useFeedWhen, useLive, usePx, useShard, type Shard } from '@/lib/data';
import { priceLabel, priceView, sessionLabel } from '@/lib/price';
import { useStoredList } from '@/lib/store';
import { crore, dash, heat, num, pct } from '@/lib/format';
import { ordinal } from '@/lib/status';
import type { Row, Year } from '@/lib/types';

const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Kv({ k, v, onPick, on }: { k: string; v: string; onPick?: (k: string, v: string) => void; on?: boolean }) {
  const known = !!onPick && k in GLOSSARY;
  return <div><div className="k">{known ? <button type="button" className="kq" aria-expanded={on} onClick={() => onPick(k, v)} title={`Explain ${k}`}>{k} <span aria-hidden>ⓘ</span></button> : k}</div><div className="v">{v}</div></div>;
}

function Range({ r }: { r: Row }) {
  return <RangeBar row={r} />;
}

function Returns({ r }: { r: Row }) {
  const items: [string, number | null | undefined][] = [['1D', r.r1d], ['1W', r.r1w], ['1M', r.r1m], ['3M', r.r3m], ['6M', r.r6m], ['1Y', r.r1y]];
  const max = Math.max(5, ...items.map(([, v]) => Math.abs(v ?? 0)));
  return (
    <div className="meter">
      {items.map(([l, v]) => (
        <div className="meter-row" key={l}>
          <span className="lab">{l}</span>
          {has(v) ? <Bar pct={(Math.abs(v) / max) * 100} kind={v >= 0 ? 'up' : 'down'} /> : <span className="dim">{dash}</span>}
          <Chg v={v} dp={1} />
        </div>
      ))}
    </div>
  );
}

function Financials({ sym, pre }: { sym: string; pre?: Shard['years'] }) {
  const d = useFeedWhen('screen-detail', pre === undefined);
  const years: Year[] = [...(pre !== undefined ? pre ?? [] : d.data?.detail[sym]?.years ?? [])].reverse();
  const bars = (key: 'rev_cr' | 'pat_cr', title: string) => {
    const vals = years.map((y) => y[key]);
    const max = Math.max(1, ...vals.map((v) => Math.abs(v ?? 0)));
    return (
      <div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>{title}</div>
        <div className="fin-bars">
          {years.map((y) => {
            const v = y[key];
            return (
              <div className="fin-bar" key={y.fy}>
                <i className={has(v) && v < 0 ? 'neg' : ''} style={{ height: `${has(v) ? Math.max(3, (Math.abs(v) / max) * 100) : 0}%` }} />
                <span className="num" style={{ fontSize: 13 }}>{has(v) ? num(v) : dash}</span>
                <span className="dim" style={{ fontSize: 12 }}>{y.fy}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <Async loading={pre === undefined && d.loading} error={pre === undefined ? d.error : null} rows={2}>
      {years.length === 0 ? <Notice>No statements are held for this company.</Notice> : (
        <>
          <div className="grid g2">{bars('rev_cr', 'Revenue, ₹ crore')}{bars('pat_cr', 'Net profit, ₹ crore')}</div>
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)" style={{ marginTop: 20, maxHeight: 'none' }}>
            <table className="tbl" style={{ minWidth: 560 }}>
              <thead><tr><th>₹ crore</th>{years.map((y) => <th key={y.fy}>{y.fy}</th>)}</tr></thead>
              <tbody>
                {([['Revenue', 'rev_cr'], ['EBITDA', 'ebitda_cr'], ['Net profit', 'pat_cr'], ['Operating cash flow', 'cfo_cr'], ['Free cash flow', 'fcf_cr']] as const).map(([l, k]) => <tr key={k} style={{ cursor: 'default' }}><td>{l}</td>{years.map((y) => <td key={y.fy} className="num">{has(y[k]) ? num(y[k]) : dash}</td>)}</tr>)}
                {([['ROCE %', 'roce'], ['ROE %', 'roe'], ['EBIT margin %', 'ebit_margin']] as const).map(([l, k]) => <tr key={k} style={{ cursor: 'default' }}><td>{l}</td>{years.map((y) => <td key={y.fy} className="num">{has(y[k]) ? y[k]!.toFixed(1) : dash}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Async>
  );
}

/** The upstream text says "3Y median" even when fewer statement years exist; say what was actually used. */
const honestHistory = (k: string, years?: number) => k.replace(/\b(\d)Y median\b/, (m, n) => (typeof years === 'number' && years < Number(n) ? `median of the ${years} year${years === 1 ? '' : 's'} on file` : m));

function Swot({ sym, pre, years }: { sym: string; pre?: Shard['swot']; years?: number }) {
  const f = useFeedWhen('swot', pre === undefined);
  const s = pre !== undefined ? pre : f.data?.swot[sym];
  const quad: [keyof NonNullable<typeof s>, string, string][] = [['s', 'Strengths', 'var(--up)'], ['w', 'Weaknesses', 'var(--down)'], ['o', 'Opportunities', 'var(--accent-2)'], ['t', 'Threats', 'var(--warn)']];
  return (
    <Async loading={pre === undefined && f.loading} error={pre === undefined ? f.error : null} rows={2}>
      {!s ? <Notice>No strengths or weaknesses were flagged for this company.</Notice> : (
        <div className="swot">
          {quad.map(([k, label, c]) => (
            <div className="panel tight" key={k}>
              <h4 style={{ color: c }}>{label}</h4>
              <ul>{s[k].length === 0 ? <li className="dim">None flagged by the rules.</li> : s[k].map((x) => <li key={x.t}>{x.t}<small>{honestHistory(x.k, years)}</small></li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </Async>
  );
}

function Ownership({ sym, pre }: { sym: string; pre?: Shard['inst'] }) {
  const f = useFeedWhen('institutional', pre === undefined);
  const i = pre !== undefined ? pre : f.data?.rows[sym];
  return (
    <Async loading={pre === undefined && f.loading} error={pre === undefined ? f.error : null} rows={1}>
      {!i || i.quality === 'unavailable' ? <Notice>Shareholding data is not available for this company.</Notice> : (
        <>
          <div className="kv">
            <Kv k="Promoter" v={has(i.promoter) ? `${i.promoter.toFixed(1)}%` : dash} />
            <Kv k="FII" v={has(i.fii) ? `${i.fii.toFixed(1)}%` : dash} />
            <Kv k="DII" v={has(i.dii) ? `${i.dii.toFixed(1)}%` : dash} />
            <Kv k="Mutual funds" v={has(i.mf) ? `${i.mf.toFixed(1)}%` : dash} />
            <Kv k="Public" v={has(i.publicHold) ? `${i.publicHold.toFixed(1)}%` : dash} />
          </div>
          <p className="dim" style={{ fontSize: 13.5, marginTop: 10 }}>As of {i.period}. Quarter change: FII {pct(i.fii_pp, 2).replace('%', ' pp')} · DII {pct(i.dii_pp, 2).replace('%', ' pp')}. Source: NSE shareholding patterns.</p>
        </>
      )}
    </Async>
  );
}

function Seasons({ sym, pre }: { sym: string; pre?: Shard['season'] }) {
  const f = useFeedWhen('seasonality', pre === undefined);
  const s = pre !== undefined ? pre : f.data?.stocks[sym];
  return (
    <Async loading={pre === undefined && f.loading} error={pre === undefined ? f.error : null} rows={1}>
      {!s ? <Notice>Not enough monthly history to say what this name has done in each month.</Notice> : (
        <>
          <div className="sector-strip" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))' }}>
            {s.m.map((m, i) => (
              <div className="sector-cell" key={MONTHS[i]} style={{ ['--c' as string]: heat(m[1], 6), minHeight: 70 }} title={`${m[2]} years observed`}>
                <span className="n">{MONTHS[i]}</span>
                <span className="v" style={{ fontSize: 15 }}>{pct(m[1], 1)}</span>
                <span className="dim" style={{ fontSize: 12 }}>up {m[0]}%</span>
              </div>
            ))}
          </div>
          <p className="dim" style={{ fontSize: 13.5, marginTop: 10 }}>Median return and share of years that were up, over {s.y} years. A month has no causal pull on a price; this records what repeatedly happened, not what will.</p>
        </>
      )}
    </Async>
  );
}

/** One company. `initial` is the company's slice as of the last build (pre-rendered into the static page, so the page has
 *  real content for readers and search engines before any script runs); the live slice replaces it as soon as it loads. */
export function CompanyView({ sym, initial }: { sym: string; initial?: Shard | null }) {
  const live = useShard(sym);
  const sh = { data: live.data ?? initial ?? null, loading: live.loading && !initial, error: live.error && !initial ? live.error : null };
  const full = useFeedWhen('screen', !!sym && !!sh.error);      // the full screen only when there is no per-company shard
  const s = { loading: sh.loading || (!!sh.error && full.loading), error: sh.error ? full.error : null, count: sh.data?.count ?? full.data?.count };
  const pre = sh.data;
  const eng = useSignals();
  const px = usePx(sym ? [sym] : []);
  const lv = useLive();
  const [watch, addWatch, removeWatch, , watchError] = useStoredList('alpha-watchlist');
  const [watchNote, setWatchNote] = useState('');
  const TABS = ['overview', 'financials', 'valuation', 'engines', 'ownership', 'seasonality'] as const;
  type Tab = (typeof TABS)[number];
  const [tab, setTab] = useState<Tab>('overview');
  const [metric, setMetric] = useState<{ k: string; v: string } | null>(null);
  useEffect(() => { setMetric(null); }, [sym]);
  useEffect(() => { const h = window.location.hash.slice(1) as Tab; if ((TABS as readonly string[]).includes(h)) setTab(h); }, [sym]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (t: Tab) => { setTab(t); try { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${t}`); } catch { /* history unavailable */ } };
  const mySignals = useMemo(() => (eng.data?.signals ?? []).filter((x) => x.sym.toUpperCase() === sym), [eng.data, sym]);
  const r = useMemo(() => sh.data?.row ?? full.data?.rows.find((x) => x.sym.toUpperCase() === sym), [sh.data, full.data, sym]);
  if (!sym) return <div className="wrap section"><Notice>Pick a company from the <Link href="/screen/" style={{ color: 'var(--accent-2)' }}>screen</Link> or press ⌘K to search.</Notice></div>;
  if (s.loading) return <div className="wrap section"><Skel h={64} w="50%" /><div style={{ height: 14 }} /><Skel h={220} /></div>;
  if (s.error || !r) return <div className="wrap section"><Notice>{s.error ? `Could not load the screen (${s.error}).` : `No company with the symbol ${sym} is in the screen.`} <Link href="/screen/" style={{ color: 'var(--accent-2)' }}>Back to the screen</Link></Notice></div>;
  const lender = /financial|bank|insurance|real estate/i.test(`${r.sector} ${r.ind}`);
  // Price and day move follow the site's one rule: the live snapshot when it is a newer session than the screen, then this
  // symbol's own quote, then the screen close. Everything below the header is the screen close, and says which day that is.
  const pv = priceView(r.sym, r, lv.snap, px.quotes[sym]);
  const pl = priceLabel(pv);
  const closeOn = sessionLabel(r.last_date);
  const tabOptions: (readonly [Tab, string])[] = [['overview', 'Overview'], ['financials', 'Financials'], ['valuation', 'Valuation'], ...(mySignals.length > 0 ? [['engines', `Signals (${mySignals.length})`] as const] : []), ['ownership', 'Ownership'], ['seasonality', 'Seasonality']];
  const view: Tab = tabOptions.some(([k]) => k === tab) ? tab : 'overview';      // a link to #engines on a company with no signal falls back to Overview
  return (
    <>
      <header className="wrap co-head">
        <div>
          <div className="eyebrow"><Link href="/screen/" style={{ color: 'var(--accent-2)', textDecoration: 'underline', textUnderlineOffset: 3 }}>← Screen</Link> &nbsp;·&nbsp; {r.sector}{r.ind && r.ind.trim().toLowerCase() !== (r.sector ?? '').trim().toLowerCase() ? ` · ${r.ind}` : ''}</div>
          <h1 className="disp">{r.name}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="tag acc" style={{ viewTransitionName: 'ticker' }}>{r.sym}</span>
            {r.tier && <span className="tag">{r.tier} cap</span>}
            {r.ahimsa && <span className="tag up">Ahimsa 500</span>}
            {r.vet && <span className={`tag ${r.vet.s === 'cleared' ? 'up' : 'warn'}`}>{r.vet.s === 'cleared' ? `Vetted ${r.vet.p}/${r.vet.n}` : `Not vetted · ${r.vet.w}`}</span>}
            {r.risk && r.risk.level !== 'LOW' && <span className="tag warn">Risk {r.risk.level.toLowerCase()}</span>}
          </div>
        </div>
        <div className="co-price">
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
            <button className={`chip watch-btn${watch.includes(r.sym) ? ' on' : ''}`} aria-pressed={watch.includes(r.sym)} onClick={() => { const on = watch.includes(r.sym); if (on ? removeWatch(r.sym) : addWatch(r.sym)) setWatchNote(on ? 'Removed from your watchlist' : 'Saved to your watchlist, in this browser'); }}><span className="star" aria-hidden>{watch.includes(r.sym) ? '★' : '☆'}</span> {watch.includes(r.sym) ? 'Watching' : 'Watch'}</button>
            {(watchError || watchNote) && <span className={watchError ? 'warn' : 'dim'} role="status" style={{ fontSize: 13 }}>{watchError ?? watchNote}</span>}
            <Link className="chip" href={`/compare/?s=${r.sym}`}>Compare</Link>
            <SaveCardButton r={r} sigs={mySignals} years={pre?.years ? pre.years.length : undefined} />
          </div><div className="px"><Flash value={pv.price}>{pv.price === null ? dash : `₹${num(pv.price, 2)}`}</Flash></div><div style={{ marginTop: 6 }}><Flash value={pv.pct} dir={null}><Chg v={pv.pct} /></Flash> <span className="dim" style={{ fontSize: 13.5 }}>{pl.live ? <><span className="tag up" style={{ fontSize: 11.5 }}>live</span> {pl.text.replace(/^live /, '')}</> : pl.text}</span></div></div>
      </header>
      <section className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}><DataStamp ids={['prices', 'screen']} /></section>
      {(() => {
        const live = pv.source === 'close' ? null : pv.price;
        if (!has(live) || !has(r.price) || r.price <= 0 || Math.abs(live / r.price - 1) <= 0.08) return null;
        return <section className="wrap"><p className="notice" role="alert">The live quote (₹{num(live, 2)}) differs from the screen&apos;s close (₹{num(r.price, 2)}{r.last_date ? ` on ${closeOn}` : ''}) by {Math.abs((live / r.price - 1) * 100).toFixed(1)}%. A split, bonus or other corporate action, or a symbol mismatch at the price source, can cause this. Check before relying on price-based figures; scores and levels below use the screen close.</p></section>;
      })()}

      <section className="wrap" style={{ paddingTop: 8 }}>
        <h2 className="sr">Price chart</h2>
        <Rv className="panel"><StockChart sym={r.sym} plans={mySignals.filter((x) => x.status === 'open' || x.status === 'pending').map((x) => ({ sl: x.stop_now ?? x.sl, entry: x.entry ?? x.ref_price, targets: [x.t1 ?? x.t1_plan, x.t2 ?? x.t2_plan], label: `Swing ${x.setup}` }))} /><div style={{ marginTop: 12 }}><ExternalLinks sym={r.sym} /></div></Rv>
      </section>
      <section className="wrap section">
        <SectionHead eyebrow={`Scorecard · screen close ${closeOn}`} title="Where it ranks" />
        <Scorecard of={s.count} items={[{ label: 'Quality', value: r.q, tone: 'lav', note: 'ROCE, ROE, margins, debt and interest cover' }, { label: 'Growth', value: r.g, tone: 'mint', note: 'Revenue, EBITDA and EPS growth' }, { label: 'Value', value: r.v, tone: 'lime', note: 'P/E and P/B against its own history; higher is cheaper' }, { label: 'Technical', value: r.tech, tone: 'peach', note: 'Trend, momentum, breakouts and volume' }]} />
        <p className="dim" style={{ fontSize: 13.5, margin: '10px 2px 0' }}>Scores are percentiles within the screen’s {num(s.count)} companies, not predictions. 50 is the median company, which is not a neutral rating.{lender ? ' This is a lender or insurer, so cash-conversion and leverage ratios are read differently.' : ''}</p>
      </section>
      <section className="wrap" style={{ paddingTop: 0 }}>
        <TabRow label="Company views" value={view} onChange={pick} options={tabOptions} />
      </section>

      {view === 'overview' && (<>
      <section className="wrap section"><SectionHead eyebrow="Research summary" title="Why this name?" /><DecisionDesk r={r} sigs={mySignals} years={pre?.years ? pre.years.length : undefined} /></section>
      <section className="wrap section">
        <div className="grid g-7-5">
          <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 6 }}>Price · to the {closeOn} close</div><Range r={r} /><div style={{ height: 14 }} /><Returns r={r} /></Rv>
          <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 14 }}>What the screen notes</div>
            {r.vd?.o ? <p className="disp" style={{ fontSize: 26, lineHeight: 1.2, margin: 0 }}>{r.vd.o}.</p> : <p className="muted">Nothing notable.</p>}
            {r.risk && r.risk.flags.length > 0 && <ul className="muted" style={{ paddingLeft: 18, marginBottom: 0 }}>{r.risk.flags.map((f, i) => typeof f === 'string' ? <li key={i}>{f}</li> : <li key={i}>{f.t}{f.k && <small className="dim" style={{ display: 'block', fontFamily: 'var(--f-mono)', fontSize: 12 }}>{f.k}</small>}</li>)}</ul>}
            {r.next_earnings && <p className="dim" style={{ fontSize: 14, marginBottom: 0 }}>Next results expected {r.next_earnings}.</p>}
          </Rv>
        </div>
      </section>
      <section className="wrap section">
        <SectionHead title="Key numbers" />
        <p className="dim" style={{ fontSize: 13.5, margin: '-6px 2px 12px' }}>From the screen: price-based ratios use the {closeOn} close; the rest come from the latest filed statements.</p>
        <Rv className="kv">
          <Kv k="Market cap" v={has(r.mcap_cr) && r.mcap_cr > 0 ? crore(r.mcap_cr) : 'Not in the feed'} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'Market cap'} /><Kv k="P/E" v={has(r.pe) ? `${r.pe.toFixed(1)}×` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'P/E'} /><Kv k="P/B" v={has(r.pb) ? `${r.pb.toFixed(2)}×` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'P/B'} />
          <Kv k="ROCE" v={has(r.roce) ? `${r.roce.toFixed(1)}%` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'ROCE'} /><Kv k="ROE" v={has(r.roe) ? `${r.roe.toFixed(1)}%` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'ROE'} /><Kv k="EBIT margin" v={has(r.ebit_margin) ? `${r.ebit_margin.toFixed(1)}%` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'EBIT margin'} />
          <Kv k="Debt / equity" v={has(r.de) ? r.de.toFixed(2) : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'Debt / equity'} /><Kv k="Interest cover" v={has(r.icover) ? `${r.icover.toFixed(1)}×` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'Interest cover'} /><Kv k="Dividend yield" v={has(r.div_yield) ? `${r.div_yield.toFixed(2)}%` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'Dividend yield'} />
          <Kv k="Revenue CAGR" v={has(r.rev_cagr) ? `${r.rev_cagr.toFixed(1)}%` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'Revenue CAGR'} /><Kv k="EPS CAGR" v={has(r.eps_cagr) ? `${r.eps_cagr.toFixed(1)}%` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'EPS CAGR'} /><Kv k="Cash / profit" v={has(r.cfo_pat) ? `${r.cfo_pat.toFixed(2)}×` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'Cash / profit'} />
          <Kv k="Piotroski F" v={has(r.piotroski) ? `${r.piotroski} / ${r.piotroski_of ?? 9}` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'Piotroski F'} /><Kv k="RSI (14)" v={has(r.rsi) ? r.rsi.toFixed(0) : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'RSI (14)'} />
          {r.mf?.rank && <Kv k="Magic Formula" v={`#${r.mf.rank} of ${r.mf.of}`} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'Magic Formula'} />}
          <Kv k="P/E vs own history" v={has(r.pe_pctile) ? `${ordinal(r.pe_pctile)} percentile` : dash} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'P/E vs own history'} /><Kv k="Daily turnover" v={crore(r.turnover_cr)} onPick={(k, v) => setMetric(metric?.k === k ? null : { k, v })} on={metric?.k === 'Daily turnover'} />
        </Rv>
        {metric && <MetricPanel metric={metric.k} value={metric.v} sym={r.sym} onClose={() => setMetric(null)} />}
        <div style={{ height: 16 }} /><AskCompany sym={r.sym} />
      </section>
      </>)}
      {view === 'financials' && (<>
      <section className="wrap section"><SectionHead title="The business, year by year" /><Financials sym={r.sym} pre={pre?.years} /></section>
      <section className="wrap section"><SectionHead title="Strengths, weaknesses, threats" /><Swot sym={r.sym} pre={pre?.swot} years={pre?.years ? pre.years.length : undefined} /></section>
      </>)}
      {view === 'valuation' && (<>
      <section className="wrap section"><SectionHead eyebrow="Calculated insight" title="Price performance and research context" /><LazyMount minHeight={280}><Rv className="panel"><RiskCone sym={r.sym} plan={(() => { const x = mySignals.find((y) => y.status === 'open' || y.status === 'pending'); return x ? { sl: x.stop_now ?? x.sl, targets: [x.t1 ?? x.t1_plan, x.t2 ?? x.t2_plan] } : undefined; })()} /></Rv></LazyMount></section>
      <section className="wrap section"><SectionHead eyebrow="Comparables" title="Companies with the same profile" /><LookalikesLazy r={r} /></section>
      </>)}
      {view === 'engines' && (<>
      {mySignals.length > 0 && (
        <section className="wrap section">
          <SectionHead eyebrow="Signals · Swing v2" title="This stock's plans" href="/engines/" cta="The rule book" />
          <div className="grid g2">{mySignals.map((x) => {
            // the same price rule and mark as the Trades page: the engines' close unless a live session is newer
            const m = mark(x, priceFor(x, lv.snap, px.quotes[sym]), noSessionDays(lv.snap?.session, lv.snap ? Date.parse(lv.snap.fetchedAt) / 1000 : null));
            return (
            <Rv key={x.id} className="panel spot">
              <div className="sig2-head">
                <div><div className="eyebrow">{x.setup} · signal {sessionLabel(x.date)}</div><span className={`tag ${STATE_TONE[m.state]}`}>{STATE_TEXT[m.state]}</span></div>
                <div className="sig2-now">{m.r !== null && <div className={`v num ${m.r >= 0 ? 'up' : 'down'}`}>{m.r > 0 ? '+' : m.r < 0 ? '−' : ''}{Math.abs(m.r).toFixed(2)}R</div>}<div className="dim num" style={{ fontSize: 12 }}>{x.status === 'closed' ? `closed ${sessionLabel(x.closed_date)}` : m.price !== null ? markSource(m) : ''}</div></div>
              </div>
              <div className="kv sig2-plan">
                <div><div className="k">{x.entry ? 'Entry' : 'Signal close'}</div><div className="v">{money(x.entry ?? x.ref_price)}</div></div>
                <div><div className="k">{STOP_TEXT[m.stopKind]}</div><div className="v">{money(m.stop)}</div></div>
                <div><div className="k">T1 · sell half</div><div className="v">{money(m.t1)}</div></div>
                <div><div className="k">T2 · the rest</div><div className="v">{money(m.t2)}</div></div>
              </div>
              <ul className="sig2-why">{x.why.map((w) => <li key={w}>{w}</li>)}</ul>
            </Rv>); })}</div>
        </section>
      )}
      </>)}
      {view === 'ownership' && (<>
      <section className="wrap section"><SectionHead title="Who owns it" /><Ownership sym={r.sym} pre={pre?.inst} /></section>
      </>)}
      {view === 'seasonality' && (<>
      <section className="wrap section"><SectionHead title="By calendar month" /><Seasons sym={r.sym} pre={pre?.season} /></section>
      </>)}
    </>
  );
}

