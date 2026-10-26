import { useMemo, useState } from 'react';
import { go, setState, useAppState } from '../app.tsx';
import { useLedger } from '../data.ts';
import { Tracker } from './Tracker.tsx';
import { TvButton } from '../live.tsx';
import { Evidence } from './Evidence.tsx';
import { useBacktest } from '../data.ts';
import { engineEvidence } from '../evidence.ts';
import { DEFAULT_COST } from '../book.ts';
import { MIN_TRADES, summarizeLedger } from '../ledger.ts';
import { Seg, Empty, Icon, useUi } from '../ui.tsx';
import { Failed, Head, Loading, PageBar, TrendTag } from './common.tsx';
import { ENGINES, type Pick } from '../quant.ts';
import { useEngines } from '../useEngines.ts';
import { sizePlan } from '../planner.ts';
import { takePaper } from '../store.ts';
import { dayWord, inr, inr0, pct } from '../fmt.ts';


export function Signals({ seg }: { seg: string }) {
  const v = seg === 'tracker' ? 'tracker' : seg === 'record' ? 'record' : seg === 'evidence' ? 'evidence' : 'picks';
  const s = useAppState();
  return <div>
    <PageBar title="Signals" sub="Paper only. Not advice." />
    <Seg label="Signals view" value={v} onChange={(x) => go(`/signals?v=${x}`)} items={[{ id: 'picks', label: 'Picks' }, { id: 'tracker', label: `My paper${s.paper.length ? ` · ${s.paper.filter((p) => !p.closedByUser).length}` : ''}` }, { id: 'record', label: 'Record' }, { id: 'evidence', label: 'Evidence' }]} />
    {v === 'picks' ? <Picks /> : v === 'tracker' ? <Tracker /> : v === 'record' ? <RecordView /> : <Evidence />}
  </div>;
}

/** Create a paper trade from a pick, sized by the planner with the user's own defaults. Returns a reason when it cannot. */
export function usePaperTake() {
  const s = useAppState(); const { toast, tick } = useUi();
  return (p: Pick, quiet = false): boolean => {
    const plan = sizePlan({ equity: s.prefs.equity, cash: s.prefs.cash, riskPct: s.prefs.riskPct, entry: p.ref, stop: p.stop, maxPositionPct: s.prefs.maxPositionPct, costRoundTripPct: DEFAULT_COST });
    if (!plan.ok) { if (!quiet) toast(`${p.sym}: ${plan.error}`); return false; }
    let ok = false;
    setState((x) => { const r = takePaper(x, { sym: p.sym, engine: p.engine, asOf: p.asOf, ref: p.ref, stop: p.stop, horizon: p.horizon, qty: plan.qty }); ok = r.ok; return r.s; });
    if (!quiet) { tick(); toast(ok ? `${p.sym}: paper trade taken. Enters at the next open.` : `${p.sym} is already in your paper book`); }
    return ok;
  };
}

function Picks() {
  const { scr, out } = useEngines(); const s = useAppState(); const take = usePaperTake(); const { toast } = useUi(); const bt = useBacktest();
  if (scr.loading) return <Loading what="the engines" />;
  if (scr.err || !out) return <Failed what="the engines" err={scr.err ?? 'no data'} retry={scr.retry} />;
  const have = new Set(s.paper.filter((p) => !p.closedByUser).map((p) => p.sym));
  const all = out.picks;
  return <>
    <div className="note" style={{ margin: '0 0 12px' }}><b>These are experiments, not recommendations.</b> Three engines, each a published factor idea with fixed rules, run on the close of {dayWord(scr.data!.as_of)}. {bt.data ? 'In a ten-year back-test none beat the whole market after costs.' : 'The historical test has not been published yet.'} The forward record is the real test. <a href="#/signals?v=evidence" style={{ textDecoration: 'underline' }}>See the evidence</a>.</div>
    {all.length > 0 && <button className="btn" style={{ width: '100%', marginBottom: 6 }} onClick={() => { let n = 0; for (const p of all) if (!have.has(p.sym) && take(p, true)) { n++; have.add(p.sym); } toast(n ? `${n} paper trade${n > 1 ? 's' : ''} taken. They enter at the next open.` : 'Nothing new to take'); }}><Icon n="plan" />Paper-trade all {all.length} picks</button>}
    {out.runs.map((run) => { const def = ENGINES.find((e) => e.id === run.id)!; return <section key={run.id} aria-label={def.name}>
      <Head aside={<span className="tag num">{run.picks.length}</span>}>{def.name}</Head>
      <div className="card"><div className="row between"><span className="dim small">{def.line}</span><span className={`tag ${engineEvidence(def.id, bt.data).tone === 'bad' ? 'peach' : ''}`}>{engineEvidence(def.id, bt.data).short}</span></div>
        <p className="mute small" style={{ margin: '6px 0 0' }}>{def.theory}</p>
        <details className="ev" style={{ marginTop: 10 }}><summary>How it picks<span className="chev">▾</span></summary><div className="body"><ol style={{ margin: 0, paddingLeft: 20 }}>{def.how.map((h) => <li key={h} style={{ marginBottom: 6 }}>{h}</li>)}</ol>
          <p className="small dim" style={{ marginBottom: 0 }}>Funnel tonight: {run.funnel.universe} names → {run.funnel.eligible} eligible → {run.funnel.passed} passed every filter → {run.funnel.skippedWideStop} skipped for a stop wider than {def.maxStopPct}% → {run.funnel.picked} shown.</p></div></details></div>
      {run.picks.length ? run.picks.map((p) => <div key={p.sym} className="card">
        <div className="row between"><a href={`#/c/${p.sym}`} className="grow" style={{ minWidth: 0 }}><span className="sym">{p.rank}. {p.sym} {(() => { const r = scr.data!.rows.find((x) => x.sym === p.sym); return r ? <TrendTag r={r} /> : null; })()}</span><span className="dim small trunc" style={{ display: 'block' }}>{p.name}</span></a><span className="tag lime num">score {p.score}</span></div>
        <div className="num small" style={{ margin: '10px 0 4px' }}>Signal close <b>{inr(p.ref)}</b> · stop <b>{inr(p.stop)}</b> ({p.stopPct}% below) · exit by session {p.horizon}</div>
        <details className="ev"><summary>Why it qualified<span className="chev">▾</span></summary><div className="body">{p.why.map((w) => <div key={w} className="small" style={{ marginBottom: 4 }}>✓ {w}</div>)}{p.risk && <p className="small down" style={{ margin: '8px 0 0' }}>Main risk · {p.risk}</p>}</div></details>
        <div className="row" style={{ marginTop: 10, gap: 8 }}><button className={`btn grow ${have.has(p.sym) ? '' : 'pri'}`} disabled={have.has(p.sym)} onClick={() => take(p)}>{have.has(p.sym) ? 'In your paper book' : 'Paper trade this'}</button><TvButton sym={p.sym} className="btn" label="Chart" /></div></div>)
        : <Empty title="No pick tonight">{run.funnel.passed ? `${run.funnel.passed} names passed, but each needed a stop wider than the engine allows.` : 'No name passed every filter. Rules are never loosened to fill this list.'}</Empty>}
    </section>; })}
    <p className="mute small" style={{ marginTop: 14 }}>A pick is a starting point for your own research, never an instruction. Entry in the tracker is the open of the next session, so a pick published after the close is never filled at that close.</p>
  </>;
}

/** The engines' forward record: every pick of every night, taken by anyone or not. The only unbiased test of the three engines. */
function RecordView() {
  const feed = useLedger();
  const sum = useMemo(() => (feed.data?.ledger ? summarizeLedger(feed.data.ledger) : null), [feed.data]);
  if (feed.loading) return <Loading what="the record" />;
  if (feed.err || !sum || !feed.data) return <Empty title="The record has not started" action={<button className="btn" onClick={feed.retry}>Check again</button>}>{feed.err === 'the first nightly run has not happened yet' || feed.err === 'not published' ? 'It starts with the first nightly run, which writes down every pick after each trading day. Nothing before that night counts.' : `The record could not be read (${feed.err ?? 'no data'}). Nothing is shown in its place.`}</Empty>;
  const l = feed.data.ledger; const a = sum.all; const recent = l.picks.map((p) => ({ p, o: l.outcomes[p.id] })).filter((x) => x.o?.status === 'closed').sort((x, y) => (y.o!.exitDay ?? '').localeCompare(x.o!.exitDay ?? '')).slice(0, 8);
  const fmtR = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`);
  return <>
    <div className="card glass">
      <div className="k">Forward record since {dayWord(sum.first)}</div>
      <p className="lead" style={{ marginTop: 6 }}><em className="ed">{a.closed}</em> of {MIN_TRADES} trades closed</p>
      <div className="stage" role="img" aria-label={`${a.closed} of ${MIN_TRADES} closed`} style={{ marginTop: 10 }}>{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.floor((Math.min(a.closed, MIN_TRADES) / MIN_TRADES) * 10) ? 'on' : ''} />)}</div>
      <p className="dim small" style={{ margin: '10px 0 0' }}>{l.days.length} night{l.days.length === 1 ? '' : 's'} recorded, through {dayWord(sum.last)} · {a.picks} picks · {a.open} open · {a.skipped} skipped · {a.pending} waiting for prices.</p>
      <p className="small" style={{ margin: '8px 0 0' }}>{a.enough ? <>Average <b className="num">{fmtR(a.avgR)}</b> a trade · won {a.winRate}% {a.avgExcess != null ? <>· <span className="num">{a.avgExcess > 0 ? '+' : '−'}{Math.abs(a.avgExcess).toFixed(2)}%</span> against the Nifty over the same days</> : null}</> : <span className="dim">Average R, win rate and the comparison with the Nifty stay hidden until {MIN_TRADES} trades have closed. Fewer than that says nothing.</span>}</p>
    </div>
    <Head>By engine</Head>
    {sum.engines.map((e) => { const def = ENGINES.find((x) => x.id === e.engine)!; const idle = l.days.filter((d) => (d.engines[e.engine]?.picked ?? 0) === 0).length; return <div key={e.engine} className="card">
      <div className="row between"><b>{def.name}</b><span className="tag num">{e.picks} picks</span></div>
      <div className="num small dim" style={{ margin: '8px 0 0' }}>{e.closed} closed · {e.open} open · {e.skipped} skipped · {e.pending} pending · total <b style={{ color: 'var(--tx)' }}>{fmtR(e.closed ? e.totalR : null)}</b>{e.enough ? ` · average ${fmtR(e.avgR)}` : ''}</div>
      <div className="small mute" style={{ marginTop: 4 }}>{idle} of {l.days.length} night{l.days.length === 1 ? '' : 's'} with no pick.</div></div>; })}
    {recent.length > 0 && <><Head>Latest closed</Head><div className="card" style={{ padding: '2px 14px' }}><div className="list">{recent.map(({ p, o }) => <a key={p.id} className="li" href={`#/c/${p.sym}`}><span className="grow"><span className="sym">{p.sym}</span> <span className="tag">{p.engine}</span><span className="dim small" style={{ display: 'block' }}>{o!.reason} · {o!.sessions} session{o!.sessions === 1 ? '' : 's'} · {dayWord(o!.exitDay)}</span></span><span className={`num ${(o!.r ?? 0) > 0 ? 'up' : 'down'}`} style={{ fontWeight: 650 }}>{fmtR(o!.r)}</span></a>)}</div></div></>}
    <div className="note info" style={{ marginTop: 12 }}><b>How to read this.</b> Every night, each engine's picks are written down before anyone knows how they turn out, whether or not you took them, and replayed with the same rules as your own paper trades (next-open fill, stop first, time exit, costs). It is a forward record: nothing before the first night counts, and 30 trades is a minimum, not proof. Prices come from Yahoo Finance through a nightly job; if a night's prices could not be fetched, those picks wait rather than count as zero.</div>
  </>;
}
