import { useMemo, useState } from 'react';
import { go, setState, useAppState } from '../app.tsx';
import { useLedger } from '../data.ts';
import { Tracker } from './Tracker.tsx';
import { AutoBook } from './AutoBook.tsx';
import { TvButton } from '../live.tsx';
import { Evidence } from './Evidence.tsx';
import { useBacktest } from '../data.ts';
import { engineEvidence, evidenceHeadline } from '../evidence.ts';
import { RANK_NOTE } from '../decision.ts';
import { DEFAULT_COST, useAutoBook } from '../book.ts';
import { MIN_TRADES, summarizeLedger } from '../ledger.ts';
import { Seg, Empty, Icon, useUi } from '../ui.tsx';
import { Failed, Head, Loading, PageBar, TrendTag } from './common.tsx';
import { ACTIVE, ENGINES, type Pick } from '../quant.ts';
import { useEngines } from '../useEngines.ts';
import { sizePlan } from '../planner.ts';
import { takePaper } from '../store.ts';
import { dayWord, inr, inr0, pct } from '../fmt.ts';


export function Signals({ seg }: { seg: string }) {
  const v = seg === 'tracker' ? 'tracker' : seg === 'auto' ? 'auto' : seg === 'record' ? 'record' : seg === 'evidence' ? 'evidence' : 'picks';
  const s = useAppState();
  return <div>
    <PageBar title="Signals" sub="Paper only. Not advice." />
    <Seg label="Signals view" value={v} onChange={(x) => go(`/signals?v=${x}`)} items={[{ id: 'picks', label: 'Picks' }, { id: 'auto', label: 'Auto' }, { id: 'tracker', label: `My trades${s.paper.filter((p) => !p.closedByUser).length ? ` · ${s.paper.filter((p) => !p.closedByUser).length}` : ''}` }, { id: 'record', label: 'Record' }, { id: 'evidence', label: 'Proof' }]} />
    {v === 'picks' ? <Picks /> : v === 'auto' ? <AutoBook /> : v === 'tracker' ? <Tracker /> : v === 'record' ? <RecordView /> : <Evidence />}
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

/** The engine's evidence state, always beside its picks and paper actions. A skeleton while the study loads; a neutral chip for untested, never red. */
export function EvidenceChip({ id }: { id: string }) {
  const bt = useBacktest(); const ev = engineEvidence(id, bt.data, bt.loading);
  if (ev.state === 'loading') return <span className="sk" style={{ display: 'inline-block', height: 20, width: 96 }} aria-label="Loading the evidence" />;
  return <span className={`tag ${ev.tone === 'bad' ? 'peach' : ev.tone === 'ok' ? 'lime' : ''}`} title={ev.line}>{ev.short}</span>;
}
function Picks() {
  const { scr, out } = useEngines(); const bt = useBacktest(); const auto = useAutoBook(true); const take = usePaperTake(); const mine = useAppState().paper;
  if (scr.loading) return <Loading what="the engines" />;
  if (scr.err || !out) return <Failed what="the engines" err={scr.err ?? 'no data'} retry={scr.retry} />;
  const all = out.picks; const headline = evidenceHeadline(ACTIVE.map((e) => e.id), bt.data, bt.loading);
  const state = (p: Pick) => { if (!auto.plan) return { k: 'no' as const, text: 'The record could not be read, so the auto book cannot take it yet' }; const t = auto.plan?.taken.some((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf); if (t) return { k: 'in' as const, text: 'In the auto book' }; const r = auto.plan?.refused.find((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf); return r ? { k: 'no' as const, text: `Not taken: ${r.why}` } : { k: 'wait' as const, text: 'Taken automatically when tonight is written to the record' }; };
  return <>
    <div className="note" style={{ margin: '0 0 12px' }}><b>These are experiments, not recommendations.</b> Two engines, each a published factor idea with fixed rules, run on the close of {dayWord(scr.data!.as_of)}. {headline ? `${headline} ` : ''}The forward record is the real test. <a href="#/signals?v=evidence" style={{ textDecoration: 'underline' }}>See the evidence</a>.</div>
    {all.length > 0 && <p className="small dim" style={{ margin: '0 0 6px' }}>Every pick below is taken on paper automatically (up to 30 positions, ₹1,00,000 each). A pick the auto book refuses can be taken by hand. <a href="#/signals?v=auto" style={{ textDecoration: 'underline' }}>See the auto book</a></p>}
    {out.runs.map((run) => { const def = ENGINES.find((e) => e.id === run.id)!; return <section key={run.id} aria-label={def.name}>
      <Head aside={<span className="tag num">{run.picks.length}</span>}>{def.name}</Head>
      <div className="card"><div className="row between"><span className="dim small">{def.line}</span><EvidenceChip id={def.id} /></div>
        <p className="mute small" style={{ margin: '6px 0 0' }}>{def.theory}</p>
        <details className="ev" style={{ marginTop: 10 }}><summary>How it picks<span className="chev">▾</span></summary><div className="body"><ol style={{ margin: 0, paddingLeft: 20 }}>{def.how.map((h) => <li key={h} style={{ marginBottom: 6 }}>{h}</li>)}</ol>
          <p className="small dim" style={{ marginBottom: 0 }}>Funnel tonight: {run.funnel.universe} names → {run.funnel.eligible} eligible → {run.funnel.passed} passed every filter → {run.funnel.skippedWideStop} skipped for a stop wider than {def.maxStopPct}% → {run.funnel.picked} shown.</p></div></details></div>
      {run.picks.length ? run.picks.map((p) => <div key={p.sym} className="card">
        <div className="row between"><a href={`#/c/${p.sym}`} className="grow" style={{ minWidth: 0 }}><span className="sym">{p.rank}. {p.sym} {(() => { const r = scr.data!.rows.find((x) => x.sym === p.sym); return r ? <TrendTag r={r} /> : null; })()}</span><span className="dim small trunc" style={{ display: 'block' }}>{p.name}</span></a><span className="tag lime num" title={RANK_NOTE}>Rank {p.score} of 100</span></div>
        <div className="num small" style={{ margin: '10px 0 4px' }}>Signal close <b>{inr(p.ref)}</b> · stop <b>{inr(p.stop)}</b> ({p.stopPct}% below) · exit by session {p.horizon}</div>
        {(p.flags ?? []).map((f) => <p key={f} className="small" style={{ margin: '0 0 6px', color: 'var(--a4)' }}>⚠ {f}</p>)}
        <details className="ev"><summary>Why it qualified<span className="chev">▾</span></summary><div className="body">{p.why.map((w) => <div key={w} className="small" style={{ marginBottom: 4 }}>✓ {w}</div>)}{p.risk && <p className="small down" style={{ margin: '8px 0 0' }}>Main risk · {p.risk}</p>}<p className="small dim" style={{ margin: '8px 0 0' }}>{RANK_NOTE}</p></div></details>
        <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}><EvidenceChip id={p.engine} />{(() => { const st = state(p); const own = mine.some((x) => x.sym === p.sym && x.engine === p.engine && x.asOf === p.asOf && !x.closedByUser);
          return <><span className={`tag grow ${st.k === 'in' ? 'lime' : st.k === 'no' ? 'peach' : ''}`} style={{ whiteSpace: 'normal', justifyContent: 'center', textAlign: 'center' }}>{st.text}</span>{st.k === 'no' && <button className="btn sm" disabled={own} onClick={() => take(p)}>{own ? 'In your book' : 'Take it myself'}</button>}</>; })()}<TvButton sym={p.sym} className="btn" label="Chart" /></div></div>)
        : <Empty title="No pick tonight">{run.funnel.passed ? `${run.funnel.passed} names passed, but each needed a stop wider than the engine allows.` : 'No name passed every filter. Rules are never loosened to fill this list.'}</Empty>}
    </section>; })}
    <p className="mute small" style={{ marginTop: 14 }}>A pick is a starting point for your own research, never an instruction. Entry in the tracker is the open of the next session, so a pick published after the close is never filled at that close.</p>
  </>;
}

/** The engines' forward record: every pick of every night, taken by anyone or not. The only unbiased test of the engines. */
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
      <div className="small mute" style={{ marginTop: 4 }}>{def.retired ? `Retired ${dayWord(def.retired)}. Its record stays; it makes no new picks.` : `${idle} of ${l.days.length} night${l.days.length === 1 ? '' : 's'} with no pick.`}</div></div>; })}
    {recent.length > 0 && <><Head>Latest closed</Head><div className="card" style={{ padding: '2px 14px' }}><div className="list">{recent.map(({ p, o }) => <a key={p.id} className="li" href={`#/c/${p.sym}`}><span className="grow"><span className="sym">{p.sym}</span> <span className="tag">{p.engine}</span><span className="dim small" style={{ display: 'block' }}>{o!.reason} · {o!.sessions} session{o!.sessions === 1 ? '' : 's'} · {dayWord(o!.exitDay)}</span></span><span className={`num ${(o!.r ?? 0) > 0 ? 'up' : 'down'}`} style={{ fontWeight: 650 }}>{fmtR(o!.r)}</span></a>)}</div></div></>}
    {l.voided && Object.keys(l.voided).length > 0 && <div className="note" style={{ marginTop: 12 }}><b>{Object.keys(l.voided).length} pick{Object.keys(l.voided).length === 1 ? '' : 's'} voided.</b> They are kept in the record, left out of every total, and the reason is stated: {[...new Set(Object.values(l.voided))][0]}</div>}
    <div className="note info" style={{ marginTop: 12 }}><b>How to read this.</b> Every night, each engine's picks are written down before anyone knows how they turn out, whether or not you took them, and replayed with the same rules as your own paper trades (next-open fill, stop first, time exit, costs). It is a forward record: nothing before the first night counts, and 30 trades is a minimum, not proof. Prices come from Yahoo Finance through a nightly job; if a night's prices could not be fetched, those picks wait rather than count as zero.</div>
  </>;
}
