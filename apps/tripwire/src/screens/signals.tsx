import { go, setState, useAppState } from '../app.tsx';
import { Tracker } from './Tracker.tsx';
import { RecordScreen } from './Record.tsx';
import { AutoBook } from './AutoBook.tsx';
import { TvButton } from '../live.tsx';
import { Evidence } from './Evidence.tsx';
import { useBacktest } from '../data.ts';
import { engineEvidence, evidenceHeadline } from '../evidence.ts';
import { RANK_NOTE } from '../decision.ts';
import { DEFAULT_COST, useAutoBook } from '../book.ts';
import { Seg, Empty, Icon, useUi } from '../ui.tsx';
import { ObservationNote } from './obsnote.tsx';
import { Failed, Head, Loading, PageBar, TrendTag } from './common.tsx';
import { ACTIVE, ENGINES, type Pick } from '../quant.ts';
import { useEngines } from '../useEngines.ts';
import { sizePlan } from '../planner.ts';
import { pickFacts } from '../pickfacts.ts';
import { pickLadderInput, paperAssumptions } from '../ladder.ts';
import { TargetLadder, GatePanel } from '../components/index.ts';
import { useCost } from '../book.ts';
import { takePaper } from '../store.ts';
import { agreementSettings, DEFAULT_AGREEMENT, type SignalEngine } from '../agreement.ts';
import { targetsFor } from '../exits.ts';
import { ModelAgreement, CandidateReview } from '../components/ModelAgreement.tsx';
import { useLedger } from '../data.ts';
import { planAutoBook } from '../autobook.ts';
import { dayWord, inr, inr0, pct } from '../fmt.ts';


export function Signals({ seg }: { seg: string }) {
  const v = seg === 'tracker' ? 'tracker' : seg === 'auto' ? 'auto' : seg === 'record' ? 'record' : seg === 'evidence' ? 'evidence' : 'picks';
  const s = useAppState();
  return <div>
    <PageBar title="Signals" sub="Paper only. Not advice." />
    <Seg label="Signals view" value={v} onChange={(x) => go(`/signals?v=${x}`)} items={[{ id: 'picks', label: 'Picks' }, { id: 'auto', label: 'Auto' }, { id: 'tracker', label: 'Mine' }, { id: 'record', label: 'Record' }, { id: 'evidence', label: 'Evidence' }]} />
    {v === 'picks' ? <Picks /> : v === 'auto' ? <AutoBook /> : v === 'tracker' ? <Tracker /> : v === 'record' ? <RecordScreen /> : <Evidence />}
  </div>;
}

/** Create a paper trade from a pick, sized by the planner with the user's own defaults. Returns a reason when it cannot. */
export function usePaperTake() {
  const s = useAppState(); const { toast, tick } = useUi(); const ledger = useLedger();
  return (p: Pick, quiet = false): boolean => {
    if (!(ledger.data && !ledger.err) && ledger.err !== 'not published') { if (!quiet) toast('Refresh the position record before adding an entry.'); return false; }
    if (ledger.data && planAutoBook(ledger.data.ledger).taken.some((t) => t.pick.sym === p.sym && !ledger.data!.ledger.outcomes[t.pick.id]?.final)) { if (!quiet) toast(`${p.sym} is already in the auto book.`); return false; }
    const plan = sizePlan({ equity: s.prefs.equity, cash: s.prefs.cash, riskPct: s.prefs.riskPct, entry: p.ref, stop: p.stop, maxPositionPct: s.prefs.maxPositionPct, costRoundTripPct: DEFAULT_COST });
    if (!plan.ok) { if (!quiet) toast(`${p.sym}: ${plan.error}`); return false; }
    let ok = false;
    setState((x) => { const r = takePaper(x, { sym: p.sym, engine: p.engine, asOf: p.asOf, ref: p.ref, stop: p.stop, horizon: p.horizon, qty: plan.qty, targets: targetsFor(p), agreement: p.agreement }); ok = r.ok; return r.s; });
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
  const { scr, out, holdingsReady, behind } = useEngines(); const bt = useBacktest(); const auto = useAutoBook(true); const take = usePaperTake(); const app = useAppState(); const mine = app.paper; const cost = useCost(); const settings = agreementSettings(app.signalAgreement);
  if (scr.loading) return <Loading what="the engines" />;
  if (scr.err || !out) return <Failed what="the engines" err={scr.err ?? 'no data'} retry={scr.retry} />;
  const all = out.picks; const headline = evidenceHeadline(ACTIVE.map((e) => e.id), bt.data, bt.loading);
  const state = (p: Pick) => { if (!auto.plan) return { k: 'no' as const, text: 'Position record unavailable' }; const t = auto.plan.taken.some((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf); if (t) return { k: 'in' as const, text: 'In the auto book' }; const r = auto.plan.refused.find((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf); return { k: 'no' as const, text: r ? `Not taken: ${r.why}` : 'Device shortlist · nightly entries use published settings' }; };
  return <>
    <div className="note" style={{ margin: '12px 0' }}><b>Three engines, separate holding periods.</b> Momentum: 20 sessions · Quality: 60 · Short-Term: 10. Data through {dayWord(scr.data!.as_of)}. Each has three rule-based model outputs. The confirmation layer and Short-Term engine are new forward tests. <a href="#/signals?v=evidence" style={{ textDecoration: 'underline' }}>See the original factor evidence</a>.</div>
    <details className="more signal-method"><summary>Legacy market context · separate from engine votes</summary><GatePanel /><p className="small dim">The legacy 2-of-4 checklist and statistical alert gate belong to the earlier Swing feed. They do not close positions or block these engines.</p></details>
    <div className="card"><b>Minimum model agreement</b><p className="small dim">Recommended starting point: 3 of 3 for each engine, matching the existing all-confirmations approach. Select 2 for a majority, or 1 for a permissive forward test. Existing factor filters still apply. These settings affect new candidates on this device; they never change open positions.</p>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>{(['MOM', 'QLT', 'ST'] as SignalEngine[]).map((id) => <label key={id}>{id === 'MOM' ? 'Momentum' : id === 'QLT' ? 'Quality' : 'Short-Term'} <select aria-label={`${id} minimum agreement`} value={settings[id]} onChange={(e) => setState((s) => ({ ...s, signalAgreement: { ...agreementSettings(s.signalAgreement), [id]: Number(e.target.value) as 1 | 2 | 3 } }))}>{[3, 2, 1].map((n) => <option key={n} value={n}>{n} of 3</option>)}</select></label>)}</div>
      <p className="small mute">The shared nightly auto book uses published settings: Momentum {DEFAULT_AGREEMENT.MOM}/3, Quality {DEFAULT_AGREEMENT.QLT}/3, Short-Term {DEFAULT_AGREEMENT.ST}/3. Bearish outputs are diagnostic; all entries are long-only.</p>
    </div>
    {behind && <p className="note" role="status" data-stale-banner>These candidates use the close of {dayWord(scr.data!.as_of)}; the next build is pending. Candidates are re-checked when it lands. A paper entry you add still fills at the next session's open, and is skipped if that open is more than 2% above the signal close.</p>}
    {!holdingsReady && <p className="note" role="status">The position record is refreshing or unavailable. Candidate analysis remains visible; new manual entries wait until existing holdings can be checked.</p>}
    <details className="more signal-method"><summary>Observation counts and paper-book rules</summary><ObservationNote parts={['observed', 'positions']} className="small dim" />
    <p className="small dim" style={{ margin: '0 0 6px' }}>Published nightly picks enter the shared paper book within its 50-position (30 before the 3 Nov night) and four-per-sector limits. Tickets: ₹25,000 for Momentum and Short-Term; ₹50,000 for Quality. Your device settings can produce a different shortlist. <a href="#/signals?v=auto" style={{ textDecoration: 'underline' }}>See the auto book</a></p>
    </details>
    {!auto.plan && all.length > 1 && <p className="note" role="status" style={{ margin: '0 0 12px' }}>The record could not be read, so the auto book cannot take these picks yet.</p>}
    {out.runs.map((run) => { const def = ENGINES.find((e) => e.id === run.id)!; return <section key={run.id} aria-label={def.name}>
      <Head aside={<span className="tag num">{run.picks.length}</span>}>{def.name}</Head>
      {run.picks.length > 1 && <p className="small dim" style={{ margin: '0 0 8px' }}>Levels below are worked from the signal close; the fill at the next open sets the booked ones.</p>}
      <div className="card"><div className="row between"><span className="dim small">{def.line}</span><EvidenceChip id={def.id} /></div>
        <p className="mute small" style={{ margin: '6px 0 0' }}>{def.theory}</p>
        <details className="ev" style={{ marginTop: 10 }}><summary>How it picks<span className="chev">▾</span></summary><div className="body"><ol style={{ margin: 0, paddingLeft: 20 }}>{def.how.map((h) => <li key={h} style={{ marginBottom: 6 }}>{h}</li>)}</ol>
          <p className="small dim" style={{ marginBottom: 0 }}>Universe: {run.funnel.universe} · eligible: {run.funnel.eligible} · filters and agreement passed: {run.funnel.passed} · selected: {run.funnel.picked}. Stop ceiling: {def.maxStopPct}%. Current minimum: {run.minimum}/3 models.</p><p className="small dim">Original factor evidence excludes this new confirmation layer. No divergence signal is inferred from a single RSI reading.</p></div></details></div>
      {run.picks.length ? run.picks.map((p) => <div key={p.sym} className="card pickcard" data-pick={p.sym}>
        <div className="row between"><a href={`#/c/${p.sym}`} className="grow" style={{ minWidth: 0 }}><span className="sym">{p.rank}. {p.sym} {(() => { const r = scr.data!.rows.find((x) => x.sym === p.sym); return r ? <TrendTag r={r} /> : null; })()}</span><span className="dim small trunc" style={{ display: 'block' }}>{p.name}</span></a><span className="tag lime num" title={RANK_NOTE}>Percentile {p.score}/100</span></div>
        <div className="num small" style={{ margin: '10px 0 2px' }}>Signal close <b>{inr(p.ref)}</b> · stop <b>{inr(p.stop)}</b> ({p.stopPct}% below) · exit by session {p.horizon}</div>
        <TargetLadder sym={p.sym} input={pickLadderInput(p) ?? undefined} quiet={run.picks.length > 1} />
        {p.agreement && <details className="ev"><summary>Three model outputs · {p.agreement.count}/3 agree</summary><ModelAgreement agreement={p.agreement} /></details>}
        {(p.flags ?? []).map((f) => <p key={f} className="small" style={{ margin: '0 0 6px', color: 'var(--a4)' }}>⚠ {f}</p>)}
        <details className="ev"><summary>Why it qualified<span className="chev">▾</span></summary><div className="body">{(() => { const fx = pickFacts(p.engine, scr.data!.rows.find((x) => x.sym === p.sym)); return fx.length ? <div className="factstrip num" role="list" aria-label={`What ranked ${p.sym} in ${def.name}`}>{fx.map((x) => <span key={x.k} role="listitem"><small>{x.k}</small><b className={x.tone ?? ''}>{x.v}</b></span>)}</div> : null; })()}{p.why.map((w) => <div key={w} className="small" style={{ marginBottom: 4 }}>✓ {w}</div>)}{p.risk && <p className="small down" style={{ margin: '8px 0 0' }}>Main risk · {p.risk}</p>}<p className="small dim" style={{ margin: '8px 0 0' }}>{RANK_NOTE}</p></div></details>
        <details className="ev" data-assumptions><summary>Paper assumptions<span className="chev">▾</span></summary><div className="body"><ul className="small dim" style={{ margin: 0, paddingLeft: 18 }}>{paperAssumptions(p.horizon, cost).map((x) => <li key={x} style={{ marginBottom: 4 }}>{x}</li>)}</ul></div></details>
        <div className="pickfoot"><span className="small dim">{state(p).text}</span><div className="row" style={{ gap: 8 }}>{state(p).k !== 'in' && <button className="btn sm" disabled={!holdingsReady} onClick={() => take(p)}>Add paper trade</button>}<TvButton sym={p.sym} className="btn sm" label="Chart" /></div></div></div>)
        : <Empty title="No new entry">Review candidates below for filter failures, missing data, model disagreement, existing holdings and shortlist limits. Existing positions continue under their recorded exit rules.</Empty>}
      <CandidateReview candidates={run.candidates} engine={def.name} />
    </section>; })}
    <p className="mute small" style={{ marginTop: 14 }}>A pick is a starting point for your own research, never an instruction. Entry in the tracker is the open of the next session, so a pick published after the close is never filled at that close.</p>
  </>;
}
