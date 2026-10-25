import { useMemo } from 'react';
import { go, useAppState, useSheets, setState } from '../app.tsx';
import { useCompany, useScreen } from '../data.ts';
import { Icon, Empty, useUi } from '../ui.tsx';
import { FollowButton, Head, Failed, Loading, PageBar } from './common.tsx';
import { isLender, trendOf, TREND_WORD } from '../screen.ts';
import { ENGINES, evaluate, type Q } from '../quant.ts';
import { useEngines } from '../useEngines.ts';
import { cr, dayWord, inr, isNum, pct, tone, x1, dash } from '../fmt.ts';
import { checklistFor } from '../insight.ts';
import { istDay, current, toggleFollow } from '../store.ts';
import { freshness } from '../fresh.ts';
import { PriceChart } from './PriceChart.tsx';

export function Company({ sym }: { sym: string }) {
  const c = useCompany(sym); const scr = useScreen(); const s = useAppState(); const { open } = useSheets(); const { toast } = useUi();
  const row = c.data?.row; const lender = row ? isLender(row) : false;
  const day = scr.data?.as_of ?? null;
  const notes = s.entries.filter((e) => e.sym === sym && !e.archived);
  const { out: eng } = useEngines();
  const evals = useMemo(() => (row && eng ? ENGINES.map((e) => ({ e, ev: evaluate(e.id, row as Q, eng.ctx) })) : []), [row, eng]);
  const yrs = [...(c.data?.years ?? [])].slice(0, 4).reverse();
  const maxRev = Math.max(0, ...yrs.map((y) => (isNum(y.rev_cr) ? y.rev_cr : 0)));
  if (c.loading) return <div><PageBar title={sym} onBack /><Loading what={sym} /></div>;
  if (c.err || !c.data || !row) return <div><PageBar title={sym} onBack />{c.err === 'not published' ? <Empty title={`${sym} is not in the screen`}>Tripwire covers the Nifty 500 screen. Check the symbol, or search by name.</Empty> : <Failed what={sym} err={c.err ?? 'no data'} retry={c.retry} />}</div>;
  const fr = freshness(row.last_date ?? day);
  const lo = row.low52, hi = row.high52, px = row.price;
  const at = (v?: number | null) => (isNum(v) && isNum(lo) && isNum(hi) && hi > lo ? Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100)) : null);
  const pxAt = at(px);
  const swot = c.data.swot; const flags = c.data.risk?.flags ?? [];
  const cases = swot?.s ?? []; const counters = [...flags.map((f) => ({ t: f.t, k: f.k })), ...(swot?.w ?? [])];
  const Metric = ({ id, label, v }: { id: string; label: string; v: string }) => <button className="li" style={{ width: '100%', textAlign: 'left', minHeight: 48 }} onClick={() => open({ k: 'explain', id })}><span className="grow dim">{label}</span><span className="num">{v}</span><Icon n="info" className="mute" /></button>;
  return <div>
    <PageBar title={row.name} onBack right={<FollowButton sym={sym} name={row.name} />} sub={<>{sym} · NSE · {row.sector ?? 'sector not stated'}</>} />
    <section className="card glass">
      <div className="row between"><div><div className="num" style={{ font: '600 38px/1 var(--sans)', letterSpacing: '-1px' }}>{inr(px)}</div><div className={`num ${tone(row.r1d)}`} style={{ marginTop: 4 }}>{pct(row.r1d)} on the day</div></div>
        <div style={{ textAlign: 'right' }}><span className={`tag ${fr.tone}`}>Close of {dayWord(row.last_date)}</span><div className="mute small" style={{ marginTop: 6 }}>Not a live quote</div></div></div>
      {(() => { const tr = trendOf(row); return tr.trend ? <p className="small" style={{ margin: '12px 0 0' }}><span className={`tag ${tr.trend === 'up' ? 'lime' : tr.trend === 'down' ? 'peach' : ''}`}>{tr.trend === 'up' ? '↑' : tr.trend === 'down' ? '↓' : '→'} {TREND_WORD[tr.trend]}</span> <span className="dim">{tr.detail.replace(/^[A-Za-z]+: /, '')}</span></p> : <p className="small mute" style={{ margin: '12px 0 0' }}>Trend not tagged: a moving average is missing.</p>; })()}
      {pxAt !== null ? <><div className="meter" aria-label={`52-week range: low ${inr(lo)}, high ${inr(hi)}, now ${inr(px)}`}>
        <div className="fill" style={{ width: `${pxAt}%` }} />
        {([['50d', row.sma50], ['200d', row.sma200]] as const).map(([l, v]) => { const a = at(v); return a === null ? null : <span key={l} className="mk" style={{ left: `${a}%` }}><i>{l}</i></span>; })}
        <span className="now" style={{ left: `${pxAt}%` }} /></div>
        <div className="row between small dim num"><span>52w low {inr(lo, 0)}</span><span>{pct(row.from_high)} from high {inr(hi, 0)}</span></div></> : <p className="dim small">52-week range not available.</p>}
    </section>

    <Head>Price history</Head>
    <PriceChart sym={sym} />

    <Head>Case and countercase</Head>
    <details className="ev" open><summary><span className="up">●</span> Case ({cases.length})<span className="chev">▾</span></summary><div className="body">
      {cases.length ? cases.map((x) => <p key={x.t} style={{ margin: '0 0 10px' }}>{x.t}<br /><span className="mute small">{x.k}</span></p>) : <span className="dim">The screen found no strengths clear enough to list. That is not a negative finding.</span>}</div></details>
    <details className="ev" open><summary><span className="down">●</span> Countercase ({counters.length})<span className="chev">▾</span></summary><div className="body">
      {counters.length ? counters.map((x) => <p key={x.t} style={{ margin: '0 0 10px' }}>{x.t}<br /><span className="mute small">{x.k}</span></p>) : <span className="dim">No risk flag or weakness was raised. Read the filings anyway; the screen only sees ratios.</span>}</div></details>
    <p className="mute small" style={{ margin: '8px 0 0' }}>Facts and calculations from the screen, listed as it states them. Interpretation is yours. Risk grade: {row.risk_lvl ?? 'not graded'}.</p>

    <Head>Engine check</Head>
    {evals.map(({ e, ev }) => <details key={e.id} className="ev"><summary><span style={{ color: ev.pass ? 'var(--lime)' : 'var(--mute)' }}>{ev.pass ? '●' : '○'}</span><span className="grow">{e.name}</span><span className={`tag ${ev.pass ? 'lime' : ''}`}>{ev.pass ? 'Qualifies' : ev.eligible ? 'Does not qualify' : 'Not eligible'}</span><span className="chev">▾</span></summary>
      <div className="body">{ev.criteria.map((c) => <div key={c.label} className="row small" style={{ marginBottom: 6, alignItems: 'flex-start' }}><span style={{ width: 16, color: c.pass === true ? 'var(--lime)' : c.pass === false ? 'var(--peach)' : 'var(--mute)' }} aria-hidden="true">{c.pass === true ? '✓' : c.pass === false ? '✗' : '?'}</span><span className="grow">{c.label}<span className="mute" style={{ display: 'block' }}>{c.value}{c.pass === null ? ' · unmeasured counts as not passed' : ''}</span></span><span className="sr">{c.pass === true ? 'passed' : c.pass === false ? 'failed' : 'unmeasured'}</span></div>)}
        {ev.score != null && <p className="small dim" style={{ marginBottom: 0 }}>Score {ev.score.toFixed(0)} of 100 among eligible names. A rank, not a probability.</p>}</div></details>)}
    {!evals.length && <div className="card dim">Engine results load with the screen.</div>}

    <Head>Business</Head>
    {yrs.length > 0 ? <div className="card"><div className="k">Revenue, ₹ crore, fiscal years</div>
      <div className="bars" role="img" aria-label={`Revenue by fiscal year: ${yrs.map((y) => `${y.fy} ${cr(y.rev_cr)}`).join(', ')}`}>{yrs.map((y) => <div className="b" key={y.fy}><i style={{ height: maxRev && isNum(y.rev_cr) ? `${Math.max(4, (y.rev_cr / maxRev) * 100)}%` : '3px', opacity: isNum(y.rev_cr) ? 1 : .25 }} /><span>{y.fy}</span></div>)}</div>
      <div className="scroll-x" style={{ marginTop: 12 }} tabIndex={0} role="region" aria-label="Financial statements, scrolls sideways"><table className="tbl"><thead><tr><th>₹ crore</th>{yrs.map((y) => <th key={y.fy}>{y.fy}</th>)}</tr></thead><tbody>
        <tr><td>Revenue</td>{yrs.map((y) => <td key={y.fy} className="num">{isNum(y.rev_cr) ? Math.round(y.rev_cr).toLocaleString('en-IN') : dash}</td>)}</tr>
        <tr><td>Profit after tax</td>{yrs.map((y) => <td key={y.fy} className="num">{isNum(y.pat_cr) ? Math.round(y.pat_cr).toLocaleString('en-IN') : dash}</td>)}</tr>
        {!lender && <tr><td>EBIT margin</td>{yrs.map((y) => <td key={y.fy} className="num">{pct(y.ebit_margin, 1, false)}</td>)}</tr>}
        {!lender && <tr><td>ROCE</td>{yrs.map((y) => <td key={y.fy} className="num">{pct(y.roce, 1, false)}</td>)}</tr>}
        <tr><td>EPS ₹</td>{yrs.map((y) => <td key={y.fy} className="num">{isNum(y.eps) ? y.eps.toFixed(1) : dash}</td>)}</tr></tbody></table></div>
      {lender && <p className="small dim" style={{ margin: '10px 0 0' }}>A lender: margin, ROCE and debt-to-equity are not meaningful here, so they are not shown or judged.</p>}
    </div> : <div className="card dim">No financial statements are held for this name. Every ratio below that depends on them is missing, not zero.</div>}
    <div className="card" style={{ padding: '2px 14px', marginTop: 10 }}><div className="list">
      <Metric id="pe" label="PE (trailing)" v={x1(row.pe)} />
      {!lender && <Metric id="roce" label="ROCE (median)" v={pct(row.roce_med, 1, false)} />}
      {!lender && <Metric id="de" label="Debt to equity" v={x1(row.de, 2)} />}
      <Metric id="net_margin" label="Net margin" v={pct(row.net_margin, 1, false)} />
      <Metric id="rev_cagr" label="Revenue growth, 3y" v={pct(row.rev_cagr, 1)} />
      <Metric id="rsi" label="RSI (14)" v={x1(row.rsi, 0)} />
      <Metric id="rs3m" label="Against the Nifty, 3m" v={isNum(row.rs3m) ? `${row.rs3m > 0 ? '+' : '−'}${Math.abs(row.rs3m).toFixed(1)} pts` : dash} />
      <Metric id="turnover_cr" label="Traded value a day" v={cr(row.turnover_cr)} />
    </div></div>

    <Head>Timeline</Head>
    <div className="card"><div className="list">
      <div className="li"><span className="tag">{dayWord(row.last_date)}</span><span className="grow dim">Last close in this data</span></div>
      <div className="li"><span className="tag">{row.next_earnings ? dayWord(row.next_earnings) : 'Unknown'}</span><span className="grow dim">{row.next_earnings ? 'Next results, estimated date' : 'No results date is published'}</span></div>
      <div className="li"><span className="tag">{row.fy ?? 'Unknown'}</span><span className="grow dim">Latest fiscal year held</span></div>
    </div><p className="mute small" style={{ margin: '8px 0 0' }}>Announcements and corporate actions are not in this data yet. Read the exchange filings for those.</p></div>

    <Head>Check this idea</Head>
    <details className="ev"><summary>Review checklist<span className="chev">▾</span></summary><div className="body"><ol style={{ margin: 0, paddingLeft: 20 }}>{checklistFor(row, istDay()).map((t) => <li key={t} style={{ marginBottom: 8 }}>{t}</li>)}</ol>
      <p className="mute small" style={{ marginBottom: 0 }}>Built by fixed rules from the figures above. Not written by an AI model.</p></div></details>
    <Head>Your thesis</Head>
    {notes.length ? notes.map((e) => <button key={e.id} className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => open({ k: 'thesis', sym, id: e.id })}><div className="k">Saved {dayWord(current(e).at)}{e.versions.length > 1 ? ` · ${e.versions.length} versions` : ''}</div><p style={{ margin: '6px 0 0' }}>{current(e).thesis}</p></button>)
      : <div className="card dim">You have written nothing on {sym}. A thesis with its invalidation is the part that protects you.</div>}

    <div className="fab-row" role="group" aria-label="Actions">
      <FollowText sym={sym} />
      <button className="btn" onClick={() => { const cur = s.follows.includes(sym) ? s.follows.filter((x) => x !== sym).slice(0, 1) : []; go(`/compare?s=${[sym, ...cur].join(',')}`); }}><Icon n="compare" />Compare</button>
      <button className="btn" onClick={() => open({ k: 'thesis', sym })}><Icon n="note" />Thesis</button>
      <button className="btn pri" onClick={() => open({ k: 'plan', sym })}><Icon n="plan" />Paper plan</button>
    </div>
    <p className="mute small" style={{ textAlign: 'center', marginTop: 10 }}><a href={`#/report/${sym}`} style={{ textDecoration: 'underline' }}>Report for printing or saving as PDF</a></p>
  </div>;
  function FollowText({ sym }: { sym: string }) {
    const on = s.follows.includes(sym);
    return <button className="btn" aria-pressed={on} onClick={() => { setState((x) => toggleFollow(x, sym)); toast(on ? `Stopped following ${sym}` : `Following ${sym}. Kept on this device.`); }}><Icon n="star" />{on ? 'Following' : 'Follow'}</button>;
  }
}
