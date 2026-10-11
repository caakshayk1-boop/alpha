'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { Async, Bar, Chg, CountUp, Notice, Ring, Rv, SectionHead, Skel } from '@/components/ui';
import Ladder from '@/components/Ladder';
import StockChart from '@/components/StockChart';
import { DecisionDesk, ExternalLinks, Lookalikes, RiskCone } from '@/components/CompanyTools';
import { useEngines, useFeed, usePx } from '@/lib/data';
import { useStoredList } from '@/lib/store';
import { ago, crore, dash, dateLabel, heat, num, pct } from '@/lib/format';
import type { Row, Year } from '@/lib/types';

const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Kv({ k, v }: { k: string; v: string }) {
  return <div><div className="k">{k}</div><div className="v">{v}</div></div>;
}

function Range({ r }: { r: Row }) {
  if (!has(r.low52) || !has(r.high52) || !has(r.price) || r.high52 <= r.low52) return null;
  const p = Math.max(0, Math.min(100, ((r.price - r.low52) / (r.high52 - r.low52)) * 100));
  return (
    <div>
      <div className="range" role="img" aria-label={`Price is ${p.toFixed(0)}% of the way from the 52-week low to the high`}><span className="dot" style={{ left: `${p}%` }} /></div>
      <div className="qrow num" style={{ fontSize: 13 }}><span>52w low ₹{num(r.low52, 2)}</span><span className="dim">{p.toFixed(0)}% of range</span><span>52w high ₹{num(r.high52, 2)}</span></div>
    </div>
  );
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

function Financials({ sym }: { sym: string }) {
  const d = useFeed('screen-detail');
  const years: Year[] = [...(d.data?.detail[sym]?.years ?? [])].reverse();
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
                <span className="num" style={{ fontSize: 12 }}>{has(v) ? num(v) : dash}</span>
                <span className="dim" style={{ fontSize: 11 }}>{y.fy}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <Async loading={d.loading} error={d.error} rows={2}>
      {years.length === 0 ? <Notice>No statements are held for this company.</Notice> : (
        <>
          <div className="grid g2">{bars('rev_cr', 'Revenue, ₹ crore')}{bars('pat_cr', 'Net profit, ₹ crore')}</div>
          <div className="tbl-wrap" style={{ marginTop: 20, maxHeight: 'none' }}>
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

function Swot({ sym }: { sym: string }) {
  const f = useFeed('swot');
  const s = f.data?.swot[sym];
  const quad: [keyof NonNullable<typeof s>, string, string][] = [['s', 'Strengths', 'var(--up)'], ['w', 'Weaknesses', 'var(--down)'], ['o', 'Opportunities', 'var(--accent-2)'], ['t', 'Threats', 'var(--warn)']];
  return (
    <Async loading={f.loading} error={f.error} rows={2}>
      {!s ? <Notice>No strengths or weaknesses were flagged for this company.</Notice> : (
        <div className="swot">
          {quad.map(([k, label, c]) => (
            <div className="panel tight" key={k}>
              <h4 style={{ color: c }}>{label}</h4>
              <ul>{s[k].length === 0 ? <li className="dim">None flagged by the rules.</li> : s[k].map((x) => <li key={x.t}>{x.t}<small>{x.k}</small></li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </Async>
  );
}

function Ownership({ sym }: { sym: string }) {
  const f = useFeed('institutional');
  const i = f.data?.rows[sym];
  return (
    <Async loading={f.loading} error={f.error} rows={1}>
      {!i || i.quality === 'unavailable' ? <Notice>Shareholding data is not available for this company.</Notice> : (
        <>
          <div className="kv">
            <Kv k="Promoter" v={has(i.promoter) ? `${i.promoter.toFixed(1)}%` : dash} />
            <Kv k="FII" v={has(i.fii) ? `${i.fii.toFixed(1)}%` : dash} />
            <Kv k="DII" v={has(i.dii) ? `${i.dii.toFixed(1)}%` : dash} />
            <Kv k="Mutual funds" v={has(i.mf) ? `${i.mf.toFixed(1)}%` : dash} />
            <Kv k="Public" v={has(i.publicHold) ? `${i.publicHold.toFixed(1)}%` : dash} />
          </div>
          <p className="dim" style={{ fontSize: 12.5, marginTop: 10 }}>As of {i.period}. Quarter change: FII {pct(i.fii_pp, 2).replace('%', ' pp')} · DII {pct(i.dii_pp, 2).replace('%', ' pp')}. Source: NSE shareholding patterns.</p>
        </>
      )}
    </Async>
  );
}

function Seasons({ sym }: { sym: string }) {
  const f = useFeed('seasonality');
  const s = f.data?.stocks[sym];
  return (
    <Async loading={f.loading} error={f.error} rows={1}>
      {!s ? <Notice>Not enough monthly history to say what this name has done in each month.</Notice> : (
        <>
          <div className="sector-strip" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))' }}>
            {s.m.map((m, i) => (
              <div className="sector-cell" key={MONTHS[i]} style={{ ['--c' as string]: heat(m[1], 6), minHeight: 70 }} title={`${m[2]} years observed`}>
                <span className="n">{MONTHS[i]}</span>
                <span className="v" style={{ fontSize: 15 }}>{pct(m[1], 1)}</span>
                <span className="dim" style={{ fontSize: 11 }}>up {m[0]}%</span>
              </div>
            ))}
          </div>
          <p className="dim" style={{ fontSize: 12.5, marginTop: 10 }}>Median return and share of years that were up, over {s.y} years. A month has no causal pull on a price; this records what repeatedly happened, not what will.</p>
        </>
      )}
    </Async>
  );
}

function Company() {
  const sp = useSearchParams();
  const sym = (sp.get('s') ?? '').toUpperCase();
  const s = useFeed('screen');
  const eng = useEngines();
  const px = usePx(sym ? [sym] : []);
  const [watch, addWatch, removeWatch] = useStoredList('alpha-watchlist');
  const mySignals = useMemo(() => (eng.data?.signals ?? []).filter((x) => x.sym.toUpperCase() === sym), [eng.data, sym]);
  const r = useMemo(() => s.data?.rows.find((x) => x.sym.toUpperCase() === sym), [s.data, sym]);
  if (!sym) return <div className="wrap section"><Notice>Pick a company from the <Link href="/screen/" style={{ color: 'var(--accent-2)' }}>screen</Link> or press ⌘K to search.</Notice></div>;
  if (s.loading) return <div className="wrap section"><Skel h={64} w="50%" /><div style={{ height: 24 }} /><Skel h={220} /></div>;
  if (s.error || !r) return <div className="wrap section"><Notice>{s.error ? `Could not load the screen (${s.error}).` : `No company with the symbol ${sym} is in the screen.`} <Link href="/screen/" style={{ color: 'var(--accent-2)' }}>Back to the screen</Link></Notice></div>;
  const lender = /financial|bank|insurance|real estate/i.test(`${r.sector} ${r.ind}`);
  return (
    <>
      <header className="wrap co-head">
        <div>
          <div className="eyebrow"><Link href="/screen/" style={{ color: 'var(--accent-2)' }}>← Screen</Link> &nbsp;·&nbsp; {r.sector} · {r.ind}</div>
          <h1 className="disp">{r.name}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="tag acc">{r.sym}</span>
            {r.tier && <span className="tag">{r.tier} cap</span>}
            {r.ahimsa && <span className="tag up">Ahimsa 500</span>}
            {r.vet && <span className={`tag ${r.vet.s === 'cleared' ? 'up' : 'warn'}`}>{r.vet.s === 'cleared' ? `Vetted ${r.vet.p}/${r.vet.n}` : `Not vetted · ${r.vet.w}`}</span>}
            {r.risk && r.risk.level !== 'LOW' && <span className="tag warn">Risk {r.risk.level.toLowerCase()}</span>}
          </div>
        </div>
        <div className="co-price">
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="chip" aria-pressed={watch.includes(r.sym)} onClick={() => (watch.includes(r.sym) ? removeWatch(r.sym) : addWatch(r.sym))}>{watch.includes(r.sym) ? '★ Watching' : '☆ Watch'}</button>
            <Link className="chip" href={`/compare/?s=${r.sym}`}>Compare</Link>
          </div><div className="px"><CountUp value={px.quotes[sym]?.price ?? r.price} format={(n) => `₹${num(n, 2)}`} /></div><div style={{ marginTop: 6 }}><Chg v={px.quotes[sym]?.pct ?? r.r1d} /> <span className="dim" style={{ fontSize: 12.5 }}>{px.quotes[sym] ? `live · ${ago(px.at)}` : `last close ${r.last_date ? dateLabel(r.last_date) : ''}`}</span></div></div>
      </header>

      <section className="wrap section">
        <div className="scores">
          <Rv><Ring value={r.q} label="Quality" hue="acc" /></Rv>
          <Rv><Ring value={r.g} label="Growth" hue="acc" /></Rv>
          <Rv><Ring value={r.v} label="Value" hue="acc" /></Rv>
          <Rv><Ring value={r.tech} label="Technical" hue="acc" /></Rv>
        </div>
        <p className="dim" style={{ fontSize: 12.5, margin: '10px 2px 0' }}>Scores are percentiles within the screen’s {num(s.data?.count)} companies, not predictions.{lender ? ' This is a lender or insurer, so cash-conversion and leverage ratios are read differently.' : ''}</p>
      </section>

      <section className="wrap section">
        <SectionHead eyebrow="Chart" title="Price, trend and levels" />
        <Rv className="panel"><StockChart sym={r.sym} plans={mySignals.filter((x) => x.status === 'open' || x.status === 'pending').map((x) => ({ sl: x.stop_now ?? x.sl, entry: x.entry ?? x.ref_price, targets: x.targets, label: x.engine_name }))} /><div style={{ marginTop: 12 }}><ExternalLinks sym={r.sym} /></div></Rv>
      </section>

      <section className="wrap section"><SectionHead eyebrow="AI desk" title="What the numbers add up to" /><DecisionDesk r={r} sigs={mySignals} /></section>

      <section className="wrap section"><SectionHead eyebrow="AI desk" title="Where the price could go" /><Rv className="panel"><RiskCone sym={r.sym} plan={(() => { const x = mySignals.find((y) => y.status === 'open' || y.status === 'pending'); return x ? { sl: x.stop_now ?? x.sl, targets: x.targets } : undefined; })()} /></Rv></section>

      <section className="wrap section">
        <div className="grid g-7-5">
          <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 6 }}>Price</div><Range r={r} /><div style={{ height: 22 }} /><Returns r={r} /></Rv>
          <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 14 }}>What the screen notes</div>
            {r.vd?.o ? <p className="disp" style={{ fontSize: 26, lineHeight: 1.2, margin: 0 }}>{r.vd.o}.</p> : <p className="muted">Nothing notable.</p>}
            {r.risk && r.risk.flags.length > 0 && <ul className="muted" style={{ paddingLeft: 18, marginBottom: 0 }}>{r.risk.flags.map((f, i) => typeof f === 'string' ? <li key={i}>{f}</li> : <li key={i}>{f.t}{f.k && <small className="dim" style={{ display: 'block', fontFamily: 'var(--f-mono)', fontSize: 11.5 }}>{f.k}</small>}</li>)}</ul>}
            {r.next_earnings && <p className="dim" style={{ fontSize: 13, marginBottom: 0 }}>Next results expected {r.next_earnings}.</p>}
          </Rv>
        </div>
      </section>

      {mySignals.length > 0 && (
        <section className="wrap section">
          <SectionHead eyebrow="Engines" title="Selected by an engine" href="/engines/" cta="How they are tested" />
          <div className="grid g2">{mySignals.map((x) => (
            <Rv key={`${x.engine}${x.date}`} className="panel spot">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14 }}>
                <div><div className="eyebrow">{x.engine_name} · {x.setup} · {x.horizon}</div>
                  <div className="kv" style={{ marginTop: 12 }}><div><div className="k">Buy zone</div><div className="v" style={{ fontSize: 14 }}>₹{num(x.entry_zone[0], 2)}–{num(x.entry_zone[1], 2)}</div></div><div><div className="k">Stop</div><div className="v down" style={{ fontSize: 14 }}>₹{num(x.sl, 2)}</div></div><div><div className="k">T1 · T2 · T3</div><div className="v up" style={{ fontSize: 13 }}>{x.targets.map((t) => num(t, 0)).join(' · ')}</div></div><div><div className="k">Time limit</div><div className="v" style={{ fontSize: 14 }}>{x.max_hold_days} sessions</div></div></div>
                  <p className="dim" style={{ fontSize: 12.5, margin: '12px 0 0' }}>This engine&apos;s record: <span className={`tag ${({ 'EDGE SHOWN': 'up', 'LEANING POSITIVE': 'acc', 'NO EDGE SHOWN': 'warn', 'WORSE THAN RANDOM': 'down' } as Record<string, string>)[x.engine_status] ?? ''}`}>{x.engine_status}</span></p></div>
                <Ladder sl={x.sl} entry={x.ref_price} targets={x.targets} last={x.last_close} />
              </div>
            </Rv>))}</div>
        </section>
      )}

      <section className="wrap section">
        <SectionHead title="Key numbers" />
        <Rv className="kv">
          <Kv k="Market cap" v={crore(r.mcap_cr)} /><Kv k="P/E" v={has(r.pe) ? `${r.pe.toFixed(1)}×` : dash} /><Kv k="P/B" v={has(r.pb) ? `${r.pb.toFixed(2)}×` : dash} />
          <Kv k="ROCE" v={has(r.roce) ? `${r.roce.toFixed(1)}%` : dash} /><Kv k="ROE" v={has(r.roe) ? `${r.roe.toFixed(1)}%` : dash} /><Kv k="EBIT margin" v={has(r.ebit_margin) ? `${r.ebit_margin.toFixed(1)}%` : dash} />
          <Kv k="Debt / equity" v={has(r.de) ? r.de.toFixed(2) : dash} /><Kv k="Interest cover" v={has(r.icover) ? `${r.icover.toFixed(1)}×` : dash} /><Kv k="Dividend yield" v={has(r.div_yield) ? `${r.div_yield.toFixed(2)}%` : dash} />
          <Kv k="Revenue CAGR" v={has(r.rev_cagr) ? `${r.rev_cagr.toFixed(1)}%` : dash} /><Kv k="EPS CAGR" v={has(r.eps_cagr) ? `${r.eps_cagr.toFixed(1)}%` : dash} /><Kv k="Cash / profit" v={has(r.cfo_pat) ? `${r.cfo_pat.toFixed(2)}×` : dash} />
          <Kv k="Piotroski F" v={has(r.piotroski) ? `${r.piotroski} / ${r.piotroski_of ?? 9}` : dash} /><Kv k="RSI (14)" v={has(r.rsi) ? r.rsi.toFixed(0) : dash} />
          {r.mf?.rank && <Kv k="Magic Formula" v={`#${r.mf.rank} of ${r.mf.of}`} />}
          <Kv k="P/E vs own history" v={has(r.pe_pctile) ? `${Math.round(r.pe_pctile)}th pctile` : dash} /><Kv k="Daily turnover" v={crore(r.turnover_cr)} />
        </Rv>
      </section>

      <section className="wrap section"><SectionHead title="The business, year by year" /><Financials sym={r.sym} /></section>
      <section className="wrap section"><SectionHead title="Strengths, weaknesses, threats" /><Swot sym={r.sym} /></section>
      <section className="wrap section"><SectionHead title="Who owns it" /><Ownership sym={r.sym} /></section>
      <section className="wrap section"><SectionHead title="By calendar month" /><Seasons sym={r.sym} /></section>
      <section className="wrap section"><SectionHead eyebrow="Comparables" title="Companies with the same profile" /><Lookalikes r={r} rows={s.data?.rows ?? []} /></section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="wrap section"><Skel h={64} w="50%" /></div>}>
      <Company />
    </Suspense>
  );
}
