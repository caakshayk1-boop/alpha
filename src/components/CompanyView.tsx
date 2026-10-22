'use client';

import { fixCopy } from '@/lib/copyfix';
import { eligibility } from '@/lib/coverage';
import { RangeBar } from '@/components/Peek';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Async, Bar, Chg, Flash, LazyMount, Notice, Rv, Said, Scorecard, SectionHead, Skel } from '@/components/ui';
import { STATE_TEXT, STATE_TONE, STOP_TEXT, mark, markSource, money, noSessionDays, priceFor } from '@/lib/plan';
import { AskAI, AskCompany, MetricPanel } from '@/components/Explain';
import { GLOSSARY } from '@/lib/glossary';
import StockChart from '@/components/StockChart';
import { CaseBlock, ShareButton, ShareImageButton, WhatChanged, DecisionDesk, ExternalLinks, LookalikesLazy, RiskCone, SaveCardButton } from '@/components/CompanyTools';
import { BackToContext } from '@/components/TickerLink';
import { Drawer, Overflow } from '@/components/company/Parts';
import { EarningsQuality, NotesColumn, ResearchSummary, SixMetrics } from '@/components/company/Workspace';
import { isLender } from '@/lib/sector';
import { useSignals, useFeedWhen, useLive, usePx, useShard, type Shard } from '@/lib/data';
import { priceLabel, priceView, sessionLabel } from '@/lib/price';
import { useStoredList } from '@/lib/store';
import { crore, dash, dateLabel, heat, num, pct, ratio, sayCrore } from '@/lib/format';
import { ordinal } from '@/lib/status';
import type { Row, Year } from '@/lib/types';

const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Kv({ k, v, onPick, on, say }: { k: string; v: string; onPick?: (k: string, v: string) => void; on?: boolean; say?: string }) {
  const known = !!onPick && k in GLOSSARY;
  return <div><div className="k">{known ? <button type="button" className="kq" aria-expanded={on} onClick={() => onPick(k, v)} title={`Explain ${k}`}>{k} <span aria-hidden>ⓘ</span></button> : k}</div><div className="v">{say ? <Said say={say}>{v}</Said> : v}</div></div>;
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

/** Every line of the yearly table; a click opens its history and source (the financial explorer, Pro §28 P1). */
const LINES = [['Revenue', 'rev_cr', false], ['EBITDA', 'ebitda_cr', false], ['Net profit', 'pat_cr', false], ['Operating cash flow', 'cfo_cr', false], ['Free cash flow', 'fcf_cr', false], ['ROCE %', 'roce', true], ['ROE %', 'roe', true], ['EBIT margin %', 'ebit_margin', true]] as const;

function Financials({ sym, pre }: { sym: string; pre?: Shard['years'] }) {
  const d = useFeedWhen('screen-detail', pre === undefined);
  const [open, setOpen] = useState<(typeof LINES)[number][1] | null>(null);
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
                {LINES.map(([l, k, pctLine]) => (
                  <tr key={k} style={{ cursor: 'default' }}>
                    <td><button type="button" className="fin-line" aria-expanded={open === k} onClick={() => setOpen((o) => (o === k ? null : k))} title="Show this line's history and source">{l}</button></td>
                    {years.map((y) => <td key={y.fy} className="num">{has(y[k]) ? num(y[k], pctLine ? 1 : 0) : dash}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {open && (() => {
            const [label, key, pctLine] = LINES.find((x) => x[1] === open)!;
            const vals = years.map((y) => y[key]);
            const max = Math.max(1e-9, ...vals.map((v) => Math.abs(v ?? 0)));
            return (
              <div className="panel tight fin-explore" role="region" aria-label={`${label}, year by year`}>
                <div className="eyebrow">{label} · year by year</div>
                <div className="fin-bars" style={{ marginTop: 10 }}>{years.map((y) => { const v = y[key]; return <div className="fin-bar" key={y.fy}><i className={has(v) && v < 0 ? 'neg' : ''} style={{ height: `${has(v) ? Math.max(3, (Math.abs(v) / max) * 100) : 0}%` }} /><span className="num" style={{ fontSize: 13 }}>{has(v) ? num(v, pctLine ? 1 : 0) : dash}</span><span className="dim" style={{ fontSize: 12 }}>{y.fy}{y.end ? ` · to ${y.end.slice(0, 7)}` : ''}</span></div>; })}</div>
                <p className="dim" style={{ fontSize: 13, margin: '8px 0 0' }}>Each bar is one fiscal year, labelled with its period end. Source: the company&apos;s annual statements as published by Yahoo Finance, in Alpha&apos;s screen. A restated year shows the restated figure; the feed does not mark restatements. Check a figure against the company&apos;s own results filing: <a href={`https://www.nseindia.com/companies-listing/corporate-filings-financial-results?symbol=${encodeURIComponent(sym)}`} target="_blank" rel="noopener noreferrer">NSE results filings ↗</a> · <a href={`https://www.bseindia.com/stock-share-price/x/x/${encodeURIComponent(sym)}/financials-results/`} target="_blank" rel="noopener noreferrer">BSE ↗</a></p>
              </div>
            );
          })()}
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
            <Kv k="Promoter" v={has(i.promoter) ? `${pct(i.promoter, 1, false)}` : dash} />
            <Kv k="FII" v={has(i.fii) ? `${pct(i.fii, 1, false)}` : dash} />
            <Kv k="DII" v={has(i.dii) ? `${pct(i.dii, 1, false)}` : dash} />
            <Kv k="Mutual funds" v={has(i.mf) ? `${pct(i.mf, 1, false)}` : dash} />
            <Kv k="Public" v={has(i.publicHold) ? `${pct(i.publicHold, 1, false)}` : dash} />
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
/** Pro §22.4: the price in its own context, from the screen's own fields. Where it sits in its traded 52-week range, and
 *  the P/E against its own history. Each part drops out when its field is missing; nothing is filled in. */
function PriceContext({ r, price }: { r: Row; price: number | null | undefined }) {
  const parts: string[] = [];
  if (has(price) && has(r.low52) && has(r.high52) && r.high52 > r.low52) {
    const at = Math.round(Math.min(Math.max((price - r.low52) / (r.high52 - r.low52), 0), 1) * 100);
    parts.push(`${at}% of the way up its 52-week range (₹${num(r.low52, 2)} to ₹${num(r.high52, 2)})`);
  }
  if (has(r.pe_pctile)) parts.push(`P/E at the ${ordinal(r.pe_pctile)} percentile of its own history`);
  if (!parts.length) return null;
  return <p className="dim co-context">{parts.join(' · ')}</p>;
}

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
  const TABS = ['overview', 'financials', 'valuation', 'ownership', 'events', 'notes', 'engines'] as const;
  type Tab = (typeof TABS)[number];
  const [tab, setTab] = useState<Tab>('overview');
  const [metric, setMetric] = useState<{ k: string; v: string } | null>(null);
  const [ask, setAsk] = useState(false);
  useEffect(() => { setMetric(null); setAsk(false); }, [sym]);
  useEffect(() => {
    // old anchors keep working: #seasonality lives under Valuation now
    const h = window.location.hash.slice(1);
    const t = (h === 'seasonality' ? 'valuation' : h) as Tab;
    if ((TABS as readonly string[]).includes(t)) setTab(t);
  }, [sym]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (t: Tab) => { setTab(t); try { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${t}`); } catch { /* history unavailable */ } };
  const mySignals = useMemo(() => (eng.data?.signals ?? []).filter((x) => x.sym.toUpperCase() === sym), [eng.data, sym]);
  const r = useMemo(() => sh.data?.row ?? full.data?.rows.find((x) => x.sym.toUpperCase() === sym), [sh.data, full.data, sym]);
  if (!sym) return <div className="wrap section"><Notice>Pick a company from the <Link href="/screen/" style={{ color: 'var(--accent-2)' }}>screen</Link> or press ⌘K to search.</Notice></div>;
  if (s.loading) return <div className="wrap section"><Skel h={64} w="50%" /><div style={{ height: 14 }} /><Skel h={220} /></div>;
  if (s.error || !r) return <div className="wrap section"><Notice>{s.error ? `Could not load the screen (${s.error}).` : `No company with the symbol ${sym} is in the screen.`} <Link href="/screen/" style={{ color: 'var(--accent-2)' }}>Back to the screen</Link></Notice></div>;
  const lender = isLender(r) || /real estate/i.test(`${r.sector} ${r.ind}`);      // the scorecard note also covers real estate
  // Price and day move follow the site's one rule: the live snapshot when it is a newer session than the screen, then this
  // symbol's own quote, then the screen close. Everything below the header is the screen close, and says which day that is.
  const pv = priceView(r.sym, r, lv.snap, px.quotes[sym]);
  const pl = priceLabel(pv);
  const closeOn = sessionLabel(r.last_date);
  const elig = eligibility(r);
  const years = pre?.years ? pre.years.length : undefined;
  const thin = elig?.thin ?? false;
  const watching = watch.includes(r.sym);
  const toggleWatch = () => { const on = watching; if (on ? removeWatch(r.sym) : addWatch(r.sym)) setWatchNote(on ? 'Removed from your watchlist' : 'Watching: saved in this browser'); };
  const tabOptions: (readonly [Tab, string])[] = [['overview', 'Overview'], ['financials', 'Financials'], ['valuation', 'Valuation'], ['ownership', 'Ownership'], ['events', 'Events'], ['notes', 'Notes'], ...(mySignals.length > 0 ? [['engines', `Signals (${mySignals.length})`] as const] : [])];
  const view: Tab = tabOptions.some(([k]) => k === tab) ? tab : 'overview';      // a link to #engines on a company with no signal falls back to Overview
  const explain = (k: string, v: string) => setMetric(metric?.k === k ? null : { k, v });
  const kv = (k: string, v: string, say?: string) => <Kv k={k} v={v} say={say} onPick={explain} on={metric?.k === k} />;
  const plansOpen = mySignals.filter((x) => x.status === 'open' || x.status === 'pending');
  return (
    <>
      <header className="wrap co-head2">
        <div className="co-id">
          <div className="eyebrow plain"><BackToContext /> &nbsp;·&nbsp; {r.sector}{r.ind && r.ind.trim().toLowerCase() !== (r.sector ?? '').trim().toLowerCase() ? ` · ${r.ind}` : ''}</div>
          <h1>{r.name}</h1>
          <div className="co-tags">
            <span className="tag acc" style={{ viewTransitionName: 'ticker' }}>{r.sym}</span>
            {r.tier && <span className="tag">{r.tier} cap</span>}
            {r.ahimsa && <span className="tag up">Ahimsa 500</span>}
            {/* the screen's DATA gate, named for what it is: it is not Alpha's research checks and not an editorial review */}
            {elig && <span className={`tag ${elig.ok ? '' : 'warn'}`} title={elig.detail}>{elig.label}</span>}
            {r.risk && r.risk.level !== 'LOW' && <span className="tag warn">Risk {r.risk.level.toLowerCase()}</span>}
          </div>
        </div>
        <div className="co-quote">
          <div className="px num"><Flash value={pv.price}>{pv.price === null ? dash : `₹${num(pv.price, 2)}`}</Flash></div>
          <div className="co-chg"><Flash value={pv.pct} dir={null}><Chg v={pv.pct} /></Flash> <span className="dim">{pl.live ? <><span className="tag up" style={{ fontSize: 11.5 }}>live</span> {pl.text.replace(/^live /, '')}</> : pl.text}</span></div>
          <PriceContext r={r} price={pv.price ?? r.price} />
        </div>
        <div className="co-acts">
          <button type="button" className="act primary watch-act" aria-pressed={watching} onClick={toggleWatch}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill={watching ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
            {watching ? 'Watching' : 'Watch'}
          </button>
          <Link className="act" href={`/compare/?s=${r.sym}`}>Compare</Link>
          <button type="button" className="act" onClick={() => { pick('notes'); window.setTimeout(() => document.getElementById('co-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); }}>Save a note</button>
          <button type="button" className="act" onClick={() => setAsk(true)}>Ask about this evidence</button>
          <Overflow label="Share and export">
            <ShareButton r={r} />
            <ShareImageButton r={r} sigs={mySignals} years={years} />
            <SaveCardButton r={r} sigs={mySignals} years={years} />
          </Overflow>
          {(watchError || watchNote) && <span className={watchError ? 'warn' : 'dim'} role="status" style={{ fontSize: 13 }}>{watchError ?? watchNote}</span>}
        </div>
      </header>
      {(() => {
        const live = pv.source === 'close' ? null : pv.price;
        if (!has(live) || !has(r.price) || r.price <= 0 || Math.abs(live / r.price - 1) <= 0.08) return null;
        return <section className="wrap"><p className="notice" role="alert">The live quote (₹{num(live, 2)}) differs from the screen&apos;s close (₹{num(r.price, 2)}{r.last_date ? ` on ${closeOn}` : ''}) by {pct(Math.abs((live / r.price - 1) * 100), 1, false)}. A split, bonus or other corporate action, or a symbol mismatch at the price source, can cause this. Check before relying on price-based figures; scores and levels below use the screen close.</p></section>;
      })()}

      <section className="wrap co-open"><ResearchSummary r={r} sigs={mySignals} /></section>
      <CaseBlock r={r} sigs={mySignals} years={years} />
      <section className="wrap section2" aria-label="Price chart">
        <div className="card"><StockChart sym={r.sym} plans={plansOpen.map((x) => ({ sl: x.stop_now ?? x.sl, entry: x.entry ?? x.ref_price, targets: [x.t1 ?? x.t1_plan, x.t2 ?? x.t2_plan], label: `Swing ${x.setup}` }))} /><div style={{ marginTop: 12 }}><ExternalLinks sym={r.sym} /></div></div>
      </section>
      <section className="wrap section2" aria-labelledby="six-h">
        <div className="card-h"><h2 id="six-h" className="sec-title">Six measures{lender ? ' for a lender' : ''}</h2><span className="dim" style={{ fontSize: 13 }}>Screen close {closeOn}; statement figures to {r.fy ?? 'the latest filing'}</span></div>
        <SixMetrics r={r} onExplain={explain} />
        {metric && <MetricPanel metric={metric.k} value={metric.v} sym={r.sym} onClose={() => setMetric(null)} />}
      </section>

      <nav className="secnav section2" aria-label="Company sections" id="co-body">
        <div className="wrap" role="tablist" aria-label="Company sections">
          {tabOptions.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => pick(k)}>{l}</button>)}
        </div>
      </nav>
      <div className={`wrap co-body${view === 'notes' ? ' one' : ''}`}>
        <div className="co-main" role="tabpanel" aria-label={tabOptions.find(([k]) => k === view)?.[1]}>
          {view === 'overview' && (<>
            <section className="section2">
              <SectionHead eyebrow={`Scorecard · screen close ${closeOn}`} title="Where it ranks" />
              <Scorecard of={s.count} items={[{ label: 'Quality', value: r.q, tone: 'lav', note: 'ROCE, ROE, margins, debt and interest cover' }, { label: 'Growth', value: r.g, tone: 'mint', note: thin ? `Ranked on only ${r.fy_count ?? 'a few'} statement years: not a multi-year record` : 'Revenue, EBITDA and EPS growth' }, { label: 'Value', value: r.v, tone: 'lime', note: 'P/E and P/B against its own history; higher is cheaper' }, { label: 'Technical', value: r.tech, tone: 'peach', note: 'Trend, momentum, breakouts and volume (longer horizon than the chart’s key line)' }]} />
              <p className="dim" style={{ fontSize: 13.5, margin: '10px 2px 0' }}>Scores are percentiles within the screen’s {num(s.count)} companies, not predictions. 50 is the median company, which is not a neutral rating.{lender ? ' This is a lender or insurer, so cash-conversion and leverage ratios are read differently.' : ''}</p>
            </section>
            <section className="section2"><SectionHead eyebrow="Research summary" title="Why this name?" /><DecisionDesk r={r} sigs={mySignals} years={years} /></section>
            <section className="section2">
              <div className="grid g-7-5">
                <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 6 }}>Price · to the {closeOn} close</div><Range r={r} /><div style={{ height: 14 }} /><Returns r={r} /></Rv>
                <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 14 }}>What the screen notes</div>
                  {r.vd?.o ? <p style={{ fontSize: 19, lineHeight: 1.35, margin: 0, fontWeight: 600 }}>{fixCopy(r.vd.o)}.</p> : <p className="muted">Nothing notable.</p>}
                  {r.risk && r.risk.flags.length > 0 && <ul className="muted" style={{ paddingLeft: 18, marginBottom: 0 }}>{r.risk.flags.map((f, i) => typeof f === 'string' ? <li key={i}>{fixCopy(f)}</li> : <li key={i}>{fixCopy(f.t)}{f.k && <small className="dim" style={{ display: 'block', fontSize: 12 }}>{f.k}</small>}</li>)}</ul>}
                </Rv>
              </div>
            </section>
            <section className="section2">
              <div className="card-h"><h2 className="sec-title">All key numbers</h2><button type="button" className="act quiet" onClick={() => setAsk(true)}>Ask about these figures</button></div>
              <p className="dim" style={{ fontSize: 13.5, margin: '-6px 2px 12px' }}>From the screen: price-based ratios use the {closeOn} close; the rest come from the latest filed statements. Select a label to see its formula, period, source and limits.</p>
              <Rv className="kv">
                {kv('Market cap', has(r.mcap_cr) && r.mcap_cr > 0 ? crore(r.mcap_cr) : 'Not in the feed', has(r.mcap_cr) && r.mcap_cr > 0 ? sayCrore(r.mcap_cr) : undefined)}{kv('P/E', has(r.pe) ? `${ratio(r.pe, 1)}` : dash)}{kv('P/B', has(r.pb) ? `${ratio(r.pb, 2)}` : dash)}
                {kv('ROCE', has(r.roce) ? `${pct(r.roce, 1, false)}` : dash)}{kv('ROE', has(r.roe) ? `${pct(r.roe, 1, false)}` : dash)}{kv('EBIT margin', has(r.ebit_margin) ? `${pct(r.ebit_margin, 1, false)}` : dash)}
                {kv('Debt / equity', has(r.de) ? num(r.de, 2) : dash)}{kv('Interest cover', has(r.icover) ? `${ratio(r.icover, 1)}` : dash)}{kv('Dividend yield', has(r.div_yield) ? `${pct(r.div_yield, 2, false)}` : dash)}
                {kv('Revenue CAGR', has(r.rev_cagr) ? `${pct(r.rev_cagr, 1, false)}` : dash)}{kv('EPS CAGR', has(r.eps_cagr) ? `${pct(r.eps_cagr, 1, false)}` : dash)}{kv('Cash / profit', has(r.cfo_pat) ? `${ratio(r.cfo_pat, 2)}` : dash)}
                {kv('Piotroski F', has(r.piotroski) ? `${r.piotroski} / ${r.piotroski_of ?? 9}` : dash)}{kv('RSI (14)', has(r.rsi) ? num(r.rsi, 0) : dash)}
                {r.mf?.rank && kv('Magic Formula', `#${r.mf.rank} of ${r.mf.of}`)}
                {kv('P/E vs own history', has(r.pe_pctile) ? `${ordinal(r.pe_pctile)} percentile` : dash)}{kv('Daily turnover', crore(r.turnover_cr), sayCrore(r.turnover_cr))}
              </Rv>
            </section>
          </>)}
          {view === 'financials' && (<>
            <section className="section2"><SectionHead title="The business, year by year" /><Financials sym={r.sym} pre={pre?.years} /></section>
            <section className="section2"><EarningsQuality years={pre?.years} lender={isLender(r)} /></section>
            <section className="section2"><SectionHead title="Strengths, weaknesses, threats" /><Swot sym={r.sym} pre={pre?.swot} years={years} /></section>
          </>)}
          {view === 'valuation' && (<>
            <section className="section2"><SectionHead eyebrow="Calculated insight" title="Price performance and research context" /><LazyMount minHeight={280}><Rv className="panel"><RiskCone sym={r.sym} plan={(() => { const x = plansOpen[0]; return x ? { sl: x.stop_now ?? x.sl, targets: [x.t1 ?? x.t1_plan, x.t2 ?? x.t2_plan] } : undefined; })()} /></Rv></LazyMount></section>
            <section className="section2"><SectionHead eyebrow="Comparables" title="Companies with the same profile" /><LookalikesLazy r={r} /></section>
            <section className="section2" id="seasonality"><SectionHead title="By calendar month" /><Seasons sym={r.sym} pre={pre?.season} /></section>
          </>)}
          {view === 'ownership' && <section className="section2"><SectionHead title="Who owns it" /><Ownership sym={r.sym} pre={pre?.inst} /></section>}
          {view === 'events' && (<>
            <section className="section2 card tight" aria-labelledby="res-h">
              <div className="card-h"><h3 id="res-h">Next results</h3><Link className="more" href="/calendar/">Calendar →</Link></div>
              <p style={{ margin: 0 }}>{r.next_earnings ? <>A results date of <b>{dateLabel(r.next_earnings)}</b> is on file. It is the screen&apos;s estimate, not an exchange confirmation: check the company&apos;s own announcement.</> : 'No results date is on file for this company.'} <a className="link" href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(r.sym)}`} target="_blank" rel="noopener noreferrer">Filings on NSE ↗</a></p>
            </section>
            <LazyMount minHeight={180}><WhatChanged r={r} sigs={mySignals} /></LazyMount>
            <section className="section2"><SectionHead title="Latest exchange announcements" /><AskAI subject="filing" sym={r.sym} title={`Summarise ${r.sym}'s latest filings`} compact /><p className="dim" style={{ fontSize: 13, margin: '6px 0 0' }}>Read from the text of the company&apos;s own NSE announcements when you ask; nothing is recalled from memory.</p></section>
          </>)}
          {view === 'notes' && <section className="section2"><NotesColumn r={r} sigs={mySignals} /></section>}
          {view === 'engines' && mySignals.length > 0 && (
            <section className="section2">
              <SectionHead eyebrow="Signals · Swing v2" title="This stock's plans" href="/engines/" cta="The rule book" />
              <div className="grid g2">{mySignals.map((x) => {
                // the same price rule and mark as the Trades page: the engines' close unless a live session is newer
                const m = mark(x, priceFor(x, lv.snap, px.quotes[sym]), noSessionDays(lv.snap?.session, lv.snap ? Date.parse(lv.snap.fetchedAt) / 1000 : null));
                return (
                  <Rv key={x.id} className="panel spot">
                    <div className="sig2-head">
                      <div><div className="eyebrow">{x.setup} · signal {sessionLabel(x.date)}</div><span className={`tag ${STATE_TONE[m.state]}`}>{STATE_TEXT[m.state]}</span></div>
                      <div className="sig2-now">{m.r !== null && <div className={`v num ${m.r >= 0 ? 'up' : 'down'}`}>{m.r > 0 ? '+' : m.r < 0 ? '−' : ''}{num(Math.abs(m.r), 2)}R</div>}<div className="dim num" style={{ fontSize: 12 }}>{x.status === 'closed' ? `closed ${sessionLabel(x.closed_date)}` : m.price !== null ? markSource(m) : ''}</div></div>
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
        </div>
        {view !== 'notes' && <aside className="co-aside" aria-label="Your notes on this company"><NotesColumn r={r} sigs={mySignals} /></aside>}
      </div>
      <Drawer open={ask} onClose={() => setAsk(false)} title={`Ask about ${r.sym}`}>
        <p className="dim" style={{ fontSize: 14, margin: '0 0 12px' }}>Questions are answered from the figures on this page, with each figure cited and dated. The mode of every answer is shown: Rules, Glossary or AI-assisted.</p>
        <AskAI subject="move" sym={r.sym} title={`Why did ${r.sym} move?`} compact />
        <div style={{ height: 16 }} />
        <AskCompany sym={r.sym} />
      </Drawer>
    </>
  );
}

