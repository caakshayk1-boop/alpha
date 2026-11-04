import { useEffect, useMemo, useState } from 'react';
import { go, useAppState, useLoc, useSheets, setState } from '../app.tsx';
import { useCompany, useScreen } from '../data.ts';
import { Icon, Seg, useUi } from '../ui.tsx';
import { FollowButton, Head, Failed, Loading, PageBar } from './common.tsx';
import { trendOf, TREND_RULE_TEXT, TREND_WORD } from '../screen.ts';
import { curateCase, eligibilityOf, meaningful, riskGradeOf, riskSentence, NO_FLAGS_SENTENCE } from '../eligibility.ts';
import { ACTIVE, evaluate, type Q } from '../quant.ts';
import { useEngines } from '../useEngines.ts';
import { cr, dayWord, inr, isNum, pct, plural, tone, x1, dash } from '../fmt.ts';
import { checklistFor } from '../insight.ts';
import { istDay, current, toggleFollow } from '../store.ts';
import { freshness } from '../fresh.ts';
import { PriceChart } from './PriceChart.tsx';
import { FinancialCharts } from './FinancialCharts.tsx';
import { sectorPeers, similarTo } from '../similar.ts';
import { metricOf } from '../screener.ts';
import { levelsFor } from '../levels.ts';
import { reprice } from '../basis.ts';
import { useAutoPicks } from '../book.ts';
import { Tick, TvButton, TvIcon } from '../live.tsx';
import { Intel } from './Intel.tsx';
import { DecisionCard } from './DecisionCard.tsx';
import { CompanyNews } from './News.tsx';
import { livePrice, useQuote, useWatchQuotes } from '../quotes.ts';
import { fmtIst } from '../stamp.ts';
import { changeLine } from '../overview.ts';
import { Pill } from '../components/index.ts';
import { FirstThought } from './firstthought.tsx';
import { NotFound } from './notfound.tsx';

type Tab = 'overview' | 'financials' | 'ownership' | 'risks' | 'thesis';
export function Company({ sym }: { sym: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  useWatchQuotes([sym]); const quote = useQuote(sym); const first = useLoc().q.get('first') === '1';   // set only by first use: the case and countercase come first, with the optional thought beneath them
  const c = useCompany(sym); const scr = useScreen(); const s = useAppState(); const { open } = useSheets(); const { toast } = useUi();
  const row = c.data?.row; const el = row ? eligibilityOf(row, c.data?.years ?? []) : null;
  const day = scr.data?.as_of ?? null;
  const notes = s.entries.filter((e) => e.sym === sym && !e.archived);
  const { out: eng } = useEngines(); const picks = useAutoPicks();
  const evals = useMemo(() => (row && eng ? ACTIVE.map((e) => ({ e, ev: evaluate(e.id, row as Q, eng.ctx) })) : []), [row, eng]);
  const yrs = [...(c.data?.years ?? [])].slice(0, 4).reverse();
  const maxRev = Math.max(0, ...yrs.map((y) => (isNum(y.rev_cr) ? y.rev_cr : 0)));
  // The action bar floats above the tab bar. Once the person has actually scrolled on this page, and the bar would sit on top of the price chart, it steps aside; it returns as soon as the chart is clear of it.
  // On arrival it is always there (a page can open already scrolled), so the first scroll event after the page has settled is what arms it.
  const [barOverChart, setBarOverChart] = useState(false);
  useEffect(() => {
    const t0 = Date.now(); let armed = false; let raf = 0;
    const check = () => { raf = 0; const plot = document.querySelector('.chart-plot'); const bar = document.querySelector('.fab-row');
      if (!armed || !plot || !bar) { setBarOverChart(false); return; } const a = plot.getBoundingClientRect(), b = bar.getBoundingClientRect(); setBarOverChart(a.bottom > b.top && a.top < b.bottom); };
    const queue = () => { if (!raf) raf = requestAnimationFrame(check); };
    const onScroll = () => { if (Date.now() - t0 > 500) armed = true; queue(); };
    window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', queue);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', queue); if (raf) cancelAnimationFrame(raf); setBarOverChart(false); };
  }, [sym]);
  if (c.loading) return <div><PageBar title={sym} onBack /><Loading what={sym} /></div>;
  if (c.err === 'not published') return <NotFound asked={sym} company total={scr.data?.count ?? null} />;
  if (c.err || !c.data || !row) return <div><PageBar title={sym} onBack /><Failed what={sym} err={c.err ?? 'no data'} retry={c.retry} /></div>;
  const fr = freshness(row.last_date ?? day);
  const lp = livePrice(row, quote); const rp = reprice(row, lp.fromQuote ? lp.px : null); const lo = rp.low52, hi = rp.high52, px = lp.px;   // figures that are a function of the price follow the live print; the rest stay at the close (basis.ts)
  const pxWord = lp.live ? 'live' : 'last traded';   // a figure worked out at a print says LIVE only while the market is open and the print is fresh (lp.live)
  const at = (v?: number | null) => (isNum(v) && isNum(lo) && isNum(hi) && hi > lo ? Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100)) : null);
  const pxAt = at(px);
  const swot = c.data.swot; const flags = c.data.risk?.flags ?? [];
  const cur = curateCase({ strengths: swot?.s ?? [], flags, weaknesses: swot?.w ?? [] }, el!); const cases = cur.strengths; const counters = cur.counters; const grade = riskGradeOf(row, el!);
  const caseBlock = <>
    <Head>Case and countercase</Head>
    <details className="ev" open={first || undefined}><summary><span className="up">●</span> Case ({cases.length})<span className="chev">▾</span></summary><div className="body">
      {cases.length ? cases.map((x) => <p key={x.t} style={{ margin: '0 0 10px' }}>{x.t}<br /><span className="mute small">{x.k}</span></p>) : <span className="dim">The screen found no strengths clear enough to list. That is not a negative finding.</span>}</div></details>
    <details className="ev" open={first || undefined}><summary><span className="down">●</span> Countercase ({counters.length})<span className="chev">▾</span></summary><div className="body">
      {counters.length ? counters.map((x) => <p key={x.t} style={{ margin: '0 0 10px' }}>{x.t}<br /><span className="mute small">{x.k}</span></p>) : <span className="dim">{NO_FLAGS_SENTENCE}</span>}</div></details>
    <p className="mute small" style={{ margin: '8px 0 0' }}>Facts and calculations from the screen, listed as it states them. Interpretation is yours.{grade.level ? ` ${riskSentence(grade.level, flags.length)}` : ''}{grade.note ? ` ${grade.note}` : ''}</p>
    {el!.notes.length > 0 && <div className="note info" style={{ marginTop: 8 }}>{el!.notes.map((t, k) => <p key={t} style={{ margin: k === el!.notes.length - 1 ? 0 : '0 0 6px' }}>{t}</p>)}</div>}
    {(cur.hidden.length > 0 || cur.merged > 0) && <details className="more"><summary>How the case and countercase were listed</summary><div>{cur.hidden.length > 0 ? `${plural(cur.hidden.length, 'statement-based line')} left out because ${cur.hidden.length === 1 ? 'its figure is' : 'their figures are'} not meaningful for this company. ` : ''}{cur.merged > 0 ? `${plural(cur.merged, 'line')} on a topic already listed ${cur.merged === 1 ? 'was' : 'were'} merged into the first.` : ''}</div></details>}
  </>;
  const mainRisk = counters[0] ? { line: counters[0].t, note: counters[0].k } : { line: 'The screen raised no flag or weakness for this company.', note: NO_FLAGS_SENTENCE };
  const riskNote = [grade.level ? riskSentence(grade.level, flags.length) : null, mainRisk.note].filter(Boolean).join(' ') || null;
  const Metric = ({ id, label, v }: { id: string; label: string; v: string }) => <button className="li" style={{ width: '100%', textAlign: 'left', minHeight: 48 }} onClick={() => open({ k: 'explain', id })}><span className="grow dim">{label}</span><span className="num">{v}</span><Icon n="info" className="mute" /></button>;
  const overview = <>
    <section className="card" aria-label="What changed and the trend">
      <p className="small" style={{ margin: '12px 0 0' }}><span className="k">What changed</span><br />{changeLine(row, lp.ch ?? null, lp.fromQuote ? (lp.live ? 'today' : 'last session') : 'on the day')}</p>
      {(() => { const tr = trendOf(row); const short = { up: 'All four trend rules hold.', down: 'All four mirrored rules hold.', mixed: 'It meets neither the uptrend nor the downtrend rule.' };
        return tr.trend ? <div style={{ margin: '12px 0 0' }}><p className="small" style={{ margin: 0 }}><span className={`tag ${tr.trend === 'up' ? 'lime' : tr.trend === 'down' ? 'peach' : ''}`}>{tr.trend === 'up' ? '↑' : tr.trend === 'down' ? '↓' : '→'} {TREND_WORD[tr.trend]}</span> <span className="dim">{short[tr.trend]}{lp.fromQuote ? ' Measured at the last close.' : ''}</span></p>
          <details className="more"><summary>Why this trend</summary><div><p style={{ margin: '0 0 6px' }}>{tr.detail}</p><p style={{ margin: 0 }}>The rule for an uptrend: {TREND_RULE_TEXT.up}. A downtrend is {TREND_RULE_TEXT.down}. Anything else is sideways. It describes the past and forecasts nothing.</p></div></details></div>
          : <p className="small mute" style={{ margin: '12px 0 0' }}>Trend not tagged: a moving average is missing.</p>; })()}
      {pxAt !== null ? <><div className="meter" aria-label={`52-week range: low ${inr(lo)}, high ${inr(hi)}, now ${inr(px)}`}>
        <div className="fill" style={{ width: `${pxAt}%` }} />
        {([['50d', row.sma50], ['200d', row.sma200]] as const).map(([l, v]) => { const a = at(v); return a === null ? null : <span key={l} className="mk" style={{ left: `${a}%` }} title={`${l} average ${inr(v!)}`} />; })}
        <span className="now" style={{ left: `${pxAt}%` }} /></div>
        <div className="row between small dim num"><span>52w low {inr(lo, 0)}</span><span>{pct(rp.fromHigh)} from {rp.newHigh ? 'its old high: a new 52-week high' : 'high'} {inr(hi, 0)}<span className="mute"> · {rp.basis === 'live' ? pxWord : 'at close'}</span></span></div>
        <div className="small num mute" style={{ marginTop: 4 }}>{[['50D', row.sma50], ['200D', row.sma200]].filter(([, v]) => typeof v === 'number' && (v as number) > 0).map(([l, v]) => `${l} ${inr(v as number)}`).join(' · ')}</div></> : <p className="dim small">52-week range not available.</p>}
    </section>
    {(() => { const peers = scr.data ? sectorPeers(sym, scr.data.rows, 5) : null; return peers && <><Head>Same sector</Head>
      <section className="card" aria-label="Companies in the same sector">{peers.list.length > 0 ? <>{peers.list.map((r) => <a key={r.sym} className="li" href={`#/c/${encodeURIComponent(r.sym)}`}><span className="grow" style={{ minWidth: 0 }}><b>{r.sym}</b> <span className="mute small">{r.name}</span></span><span className="small mute num">{cr(r.turnover_cr)} a day</span></a>)}
        <p className="small mute" style={{ margin: '8px 0 0' }}>{peers.sector}, {peers.tier} cap, by value traded a day. A sector label is a broad grouping from the data provider: it does not mean the same products, customers or risks.</p></> : <p className="small dim" style={{ margin: 0 }}>{peers.why}</p>}</section></>; })()}
    {(() => { const like = scr.data ? similarTo(sym, scr.data.rows, 5) : []; return like.length > 0 && <><Head>Similar measured patterns</Head>
      <section className="card" aria-label="Companies whose measured figures are nearest">{like.map((l) => <a key={l.row.sym} className="li" href={`#/c/${encodeURIComponent(l.row.sym)}`}><span className="grow" style={{ minWidth: 0 }}><b>{l.row.sym}</b> <span className="mute small">{l.row.name}{l.row.sector && l.row.sector !== row.sector ? ` · ${l.row.sector}` : ''}</span><br /><span className="small mute">Nearest on {l.closest.map((k) => metricOf(k)?.short ?? k).join(', ')} · {plural(l.shared, 'figure')} compared</span></span></a>)}
        <p className="small mute" style={{ margin: '8px 0 0' }}>These are statistically close on today's measured figures, from any sector. Close figures do not make the businesses alike, and the shares need not move together.</p></section></>; })()}

    <Head>Engine check</Head>
    {evals.map(({ e, ev }) => <details key={e.id} className="ev"><summary><span style={{ color: ev.pass ? 'var(--lime)' : 'var(--mute)' }}>{ev.pass ? '●' : '○'}</span><span className="grow">{e.name}</span><span className={`tag ${ev.pass ? 'lime' : ''}`}>{ev.pass ? 'Qualifies' : ev.eligible ? 'Does not qualify' : 'Not eligible'}</span><span className="chev">▾</span></summary>
      <div className="body">{ev.criteria.map((c) => <div key={c.label} className="row small" style={{ marginBottom: 6, alignItems: 'flex-start' }}><span style={{ width: 16, color: c.pass === true ? 'var(--lime)' : c.pass === false ? 'var(--peach)' : 'var(--mute)' }}><span aria-hidden="true">{c.pass === true ? '✓' : c.pass === false ? '✗' : '?'}</span><span className="sr">{c.pass === true ? 'Passes: ' : c.pass === false ? 'Fails: ' : 'Not measured: '}</span></span><span className="grow">{c.label}<span className="mute" style={{ display: 'block' }}>{c.value}{c.pass === null ? ' · unmeasured counts as not passed' : ''}</span></span><span className="sr">{c.pass === true ? 'passed' : c.pass === false ? 'failed' : 'unmeasured'}</span></div>)}
        {ev.score != null && <p className="small dim" style={{ marginBottom: 0 }}>Score {ev.score.toFixed(0)} of 100 among eligible names. A rank, not a probability.</p>}</div></details>)}
    {!evals.length && <div className="card dim">Engine results load with the screen.</div>}
    <p className="small" style={{ margin: '8px 0 0' }}><a href="#/signals" style={{ textDecoration: 'underline' }}>See the rules that fired</a> <span className="dim">across all companies, and their record.</span></p>

    <Head>News</Head>
    <CompanyNews name={row.name} />
    <Head>Calendar</Head>
    <div className="card"><div className="list">
      <div className="li"><span className="tag">{dayWord(row.last_date)}</span><span className="grow dim">Last close in this data{row.stale ? <b className="down"> · this name has not printed a close for more than a session; its figures are older than the rest of the screen</b> : null}</span></div>
      <div className="li"><span className="tag">{row.next_earnings ? dayWord(row.next_earnings) : 'Unknown'}</span><span className="grow dim">{row.next_earnings ? 'Next results, estimated date' : 'No results date is published'}</span></div>
      <div className="li"><span className="tag">{row.fy ?? 'Unknown'}</span><span className="grow dim">Latest fiscal year held</span></div>
    </div><p className="mute small" style={{ margin: '8px 0 0' }}>Announcements and corporate actions are not in this data yet. Read the exchange filings for those.</p></div>

    <Intel c={c.data} rows={scr.data?.rows ?? []} only={['season']} />
  </>;
  const financials = <>
    <Head>Business</Head>
    <FinancialCharts years={c.data.years ?? []} margins={meaningful(el!, 'margin')} />
    {el!.notes.length > 0 && <p className="small dim" style={{ margin: '10px 0 0' }}>Margin, ROCE and debt-to-equity are withheld for this company (reason in the Risks section), not shown as zero.</p>}
    <div className="card" style={{ padding: '2px 14px', marginTop: 10 }}><div className="list">
      <Metric id="pe" label={rp.basis === 'live' ? `PE (trailing), at the ${pxWord} price` : 'PE (trailing), at the close'} v={x1(rp.pe)} />
      {meaningful(el!, 'roce') && <Metric id="roce" label="ROCE (median)" v={pct(row.roce_med, 1, false)} />}
      {meaningful(el!, 'leverage') && <Metric id="de" label="Debt to equity" v={x1(row.de, 2)} />}
      {meaningful(el!, 'margin') && <Metric id="net_margin" label="Net margin" v={pct(row.net_margin, 1, false)} />}
      <Metric id="rev_cagr" label="Revenue growth, 3y" v={pct(row.rev_cagr, 1)} />
      <Metric id="rsi" label="RSI (14)" v={x1(row.rsi, 0)} />
      <Metric id="rs3m" label="Against the Nifty, 3m" v={isNum(row.rs3m) ? `${row.rs3m > 0 ? '+' : '−'}${Math.abs(row.rs3m).toFixed(1)} pts` : dash} />
      <Metric id="turnover_cr" label="Traded value a day" v={cr(row.turnover_cr)} />
    </div></div>
    <details className="more"><summary>Which figures follow the latest price, which are at the close{rp.basis === 'live' ? ` (PE and range follow the ${pxWord} price)` : ''}</summary><div>{rp.basis === 'live' ? `PE and the 52-week range use the ${pxWord} print of ${lp.t ? fmtIst(lp.t) : 'now'}. ` : ''}RSI, the Nifty comparison, the averages and the scores are as of the close of {dayWord(row.last_date)}; ROCE, debt, margins and growth come from the {row.fy ?? 'latest'} accounts and do not move with the price.</div></details>

    <Intel c={c.data} rows={scr.data?.rows ?? []} only={['val', 'eq', 'peers']} />
    {row.pe_pctile == null && <p className="small mute" style={{ margin: '8px 0 0' }}>Valuation history: not enough data. Only a single percentile of the trailing PE is held when it exists, not a PE series, so there is no history to chart; none is drawn.</p>}
  </>;
  const ownership = <>
    <Head>Ownership</Head>
    <Intel c={c.data} rows={scr.data?.rows ?? []} only={['own']} />
    {!c.data.inst?.promoter && !c.data.inst?.fii && !c.data.inst?.dii && <div className="card dim">Ownership: not enough data. No shareholding pattern is held for this company, so nothing is estimated.</div>}
  </>;
  const risks = <>
    {!first && caseBlock}
    <Intel c={c.data} rows={scr.data?.rows ?? []} only={['risk', 'fp']} />
  </>;
  const thesis = <>
    <Head>Check this idea</Head>
    <details className="ev"><summary>Review checklist<span className="chev">▾</span></summary><div className="body"><ol style={{ margin: 0, paddingLeft: 20 }}>{checklistFor(row, istDay()).map((t) => <li key={t} style={{ marginBottom: 8 }}>{t}</li>)}</ol>
      <p className="mute small" style={{ marginBottom: 0 }}>Built by fixed rules from the figures above. Not written by an AI model.</p></div></details>
    <Head>Your thesis</Head>
    {notes.length ? notes.map((e) => <button key={e.id} className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => open({ k: 'thesis', sym, id: e.id })}><div className="k">Saved {dayWord(current(e).at)}{e.versions.length > 1 ? ` · ${e.versions.length} versions` : ''}</div><p style={{ margin: '6px 0 0' }}>{current(e).thesis}</p></button>)
      : <div className="card dim">You have written nothing on {sym}. A thesis with its invalidation is the part that protects you.</div>}

  </>;
  const TABS: { id: Tab; label: string }[] = [{ id: 'overview', label: 'Overview' }, { id: 'financials', label: 'Financials' }, { id: 'ownership', label: 'Ownership' }, { id: 'risks', label: 'Risks' }, { id: 'thesis', label: 'Thesis' }];
  return <div>
    <PageBar title={row.name} onBack right={<><TvIcon sym={sym} /><FollowButton sym={sym} name={row.name} /></>} sub={<>{sym} · NSE · {row.sector ?? 'sector not stated'}</>} />
    <section className="card glass c-head">
      <div className="row between"><div><div className="num" style={{ font: '600 1.875rem/1 var(--sans)', letterSpacing: '-.8px' }}><Tick v={px}>{inr(px)}</Tick></div><div className={`num ${tone(lp.ch)}`} style={{ marginTop: 4 }}>{pct(lp.ch)} {lp.fromQuote ? (lp.live ? 'today' : 'last session') : 'on the day'}</div></div>
        {row.tier && <div className="c-pills" role="group" aria-label="Size class"><Pill>{row.tier[0].toUpperCase() + row.tier.slice(1)} cap</Pill></div>}</div>
      <div className="c-times small">{lp.fromQuote ? <span className={lp.live ? 'up' : 'mute'} title={`Source: Yahoo Finance. Exchange timestamp ${fmtIst(lp.t!)}.`}>{lp.word} · {fmtIst(lp.t!)}</span> : <span className={fr.tone === 'peach' ? '' : 'mute'} style={fr.tone === 'peach' ? { color: 'var(--a4)' } : undefined}>Close of {dayWord(row.last_date)}</span>}{lp.fromQuote ? <span className="mute">Screen figures: close of {dayWord(row.last_date)}</span> : <span className="mute">Live price not available</span>}</div>
    </section>

    {first && <>
      <div className="note info ft-strip" data-first="strip">First look at {row.name}. Read the case and the countercase, then save a thought if you want one. Nothing here is a recommendation.</div>
      {caseBlock}
      <FirstThought sym={sym} name={row.name} risk={{ line: mainRisk.line, note: riskNote }} />
    </>}

    <div className="co-grid has-side" style={{ marginTop: 'var(--sp-4)', gap: 'var(--sp-4)' }}>
      <div><PriceChart sym={sym} levels={levelsFor(sym, picks)} events={row.next_earnings ? [{ t: Date.parse(`${row.next_earnings}T00:00:00+05:30`) / 1000, label: 'Results date', basis: 'as listed by the data provider; an estimate until reported' }] : []} /></div>
      <div className="co-side"><DecisionCard c={c.data} lp={lp} /></div>
    </div>

    <div className="co-tabs"><Seg label="Company sections" value={tab} onChange={setTab} items={TABS} /></div>
    <div role="tabpanel" aria-label={TABS.find((x) => x.id === tab)!.label}>
      {tab === 'overview' && overview}{tab === 'financials' && financials}{tab === 'ownership' && ownership}{tab === 'risks' && risks}{tab === 'thesis' && thesis}
    </div>
    <div className={`fab-row${barOverChart ? ' fab-away' : ''}`} role="group" aria-label="Actions">
      <FollowText sym={sym} />
      <button className="btn" onClick={() => { const cur = s.follows.includes(sym) ? s.follows.filter((x) => x !== sym).slice(0, 1) : []; go(`/compare?s=${[sym, ...cur].join(',')}`); }}><Icon n="compare" />Compare</button>
      <button className="btn" onClick={() => open({ k: 'thesis', sym })}><Icon n="note" />Thesis</button>
      <button className="btn pri" onClick={() => open({ k: 'plan', sym })}><Icon n="plan" />Paper plan</button>
    </div>
    <p className="mute small" style={{ textAlign: 'center', marginTop: 10 }}><TvButton sym={sym} label="Full chart on TradingView" /> <a href={`#/report/${sym}`} data-print-report style={{ textDecoration: 'underline' }}>Print report</a> <span className="mute">(a white-paper version you can print or save as PDF)</span></p>
  </div>;
  function FollowText({ sym }: { sym: string }) {
    const on = s.follows.includes(sym);
    return <button className="btn" aria-pressed={on} onClick={() => { setState((x) => toggleFollow(x, sym)); toast(on ? `Stopped following ${sym}` : `Following ${sym}. Kept on this device.`); }}><Icon n="star" />{on ? 'Following' : 'Follow'}</button>;
  }
}
