import { useRef, type KeyboardEvent as ReactKeyEvent } from 'react';
import { go, setState, useAppState } from '../app.tsx';
import { RecordScreen } from './Record.tsx';
import { Positions } from './Positions.tsx';
import { TvButton } from '../live.tsx';
import { useBacktest, useLedger } from '../data.ts';
import { engineEvidence } from '../evidence.ts';
import { RANK_NOTE } from '../decision.ts';
import { DEFAULT_COST, useAutoBook } from '../book.ts';
import { Empty, useUi } from '../ui.tsx';
import { ObservationNote } from './obsnote.tsx';
import { Failed, Loading, PageBar, TrendTag } from './common.tsx';
import { ENGINES, type Pick } from '../quant.ts';
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
import { planAutoBook } from '../autobook.ts';
import { summarizeLedger, MIN_TRADES } from '../ledger.ts';
import { bookView, type BookView } from '../bookview.ts';
import { dayWord, inr } from '../fmt.ts';

const VIEWS: { id: BookView; label: string }[] = [{ id: 'positions', label: 'Positions' }, { id: 'picks', label: 'Picks' }, { id: 'record', label: 'Record' }];
/** The Book (11 Nov 2026, revamp v2): three views where there were five. Positions is the one paper book (the engine's and yours, each row labelled), Picks the rules that fired at the last
 *  close, Record the closed outcomes with the evidence and method inside it. Every older address still opens: ?v=tracker and ?v=auto land on Positions, ?v=evidence on Record's evidence
 *  section (bookview.ts). The address is not rewritten, so the tab bar's memory of where this tab was left keeps working for an old link too. */
export function Signals({ seg }: { seg: string | null }) {
  const { view, anchor } = bookView(seg);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const i = VIEWS.findIndex((x) => x.id === view);
  const pick = (to: number) => { const n = (to + VIEWS.length) % VIEWS.length; refs.current[n]?.focus(); go(`/signals?v=${VIEWS[n].id}`); };
  const key = (e: ReactKeyEvent) => { const k = e.key; if (k === 'ArrowRight') { e.preventDefault(); pick(i + 1); } else if (k === 'ArrowLeft') { e.preventDefault(); pick(i - 1); } else if (k === 'Home') { e.preventDefault(); pick(0); } else if (k === 'End') { e.preventDefault(); pick(VIEWS.length - 1); } };
  return <div className="bk-page">
    <PageBar title="Book" sub="Paper only. Not advice." />
    <div className="seg bk-tabs" role="tablist" aria-label="Book view" onKeyDown={key}>
      <span className="thumb" style={{ width: `calc((100% - 8px) / ${VIEWS.length})`, transform: `translateX(${i * 100}%)` }} aria-hidden="true" />
      {VIEWS.map((x, n) => <button key={x.id} ref={(el) => { refs.current[n] = el; }} id={`bk-tab-${x.id}`} role="tab" aria-selected={x.id === view} aria-controls="bk-panel" tabIndex={x.id === view ? 0 : -1} onClick={() => go(`/signals?v=${x.id}`)}>{x.label}</button>)}
    </div>
    <div id="bk-panel" role="tabpanel" aria-labelledby={`bk-tab-${view}`} data-book-view={view}>
      {view === 'positions' ? <Positions /> : view === 'picks' ? <Picks /> : <RecordScreen anchor={anchor} />}
    </div>
  </div>;
}

/** Create a paper trade from a pick, sized by the planner with the user's own defaults. Returns a reason when it cannot. */
export function usePaperTake() {
  const s = useAppState(); const { toast, tick } = useUi(); const ledger = useLedger();
  return (p: Pick, quiet = false): boolean => {
    if (!(ledger.data && !ledger.err) && ledger.err !== 'not published') { if (!quiet) toast('Refresh the position record before adding an entry.'); return false; }
    if (ledger.data && planAutoBook(ledger.data.ledger).taken.some((t) => t.pick.sym === p.sym && !ledger.data!.ledger.outcomes[t.pick.id]?.final)) { if (!quiet) toast(`${p.sym} is already in the engine book.`); return false; }
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

/** Picks (11 Nov 2026): one group per engine, with ONE header that says how many of its picks have closed in the forward record and that it is experimental; then one card per pick
 *  with at most one line of why, the compact ladder, and the criteria, the model votes and the paper assumptions folded. The candidates each engine considered stay under its picks. */
function Picks() {
  const { scr, out, holdingsReady, behind } = useEngines(); const auto = useAutoBook(true); const take = usePaperTake(); const app = useAppState(); const cost = useCost(); const settings = agreementSettings(app.signalAgreement);
  const led = useLedger(); const fwd = led.data?.ledger ? summarizeLedger(led.data.ledger) : null;
  if (scr.loading) return <Loading what="the engines" />;
  if (scr.err || !out) return <Failed what="the engines" err={scr.err ?? 'no data'} retry={scr.retry} />;
  const state = (p: Pick) => { if (!auto.plan) return { k: 'no' as const, text: 'Position record unavailable' }; const t = auto.plan.taken.some((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf); if (t) return { k: 'in' as const, text: 'In the engine book' }; const r = auto.plan.refused.find((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf); return { k: 'no' as const, text: r ? `Not taken: ${r.why}` : 'Device shortlist · nightly entries use published settings' }; };
  const total = out.runs.reduce((a, r) => a + r.picks.length, 0);
  return <div className="pk">
    <p className="pk-intro small dim">{total} pick{total === 1 ? '' : 's'} from the close of <b>{dayWord(scr.data!.as_of)}</b>. Long only. A paper entry fills at the next session's open, never at that close, and is skipped if that open is more than 2% above it. Levels below are worked from the signal close; the fill sets the booked ones.</p>
    {behind && <p className="note" role="status" data-stale-banner>The next build is pending; these candidates are re-checked when it lands.</p>}
    {!holdingsReady && <p className="note" role="status">The position record is refreshing or unavailable. Candidate analysis remains visible; new manual entries wait until existing holdings can be checked.</p>}
    {!auto.plan && total > 1 && <p className="note" role="status">The record could not be read, so the engine book cannot take these picks yet.</p>}
    {out.runs.map((run) => { const def = ENGINES.find((e) => e.id === run.id)!; const fe = fwd?.engines.find((x) => x.engine === run.id); return <section key={run.id} id={`engine-${run.id}`} className="pk-eng" aria-label={def.name}>
      <header className="pk-head">
        <div className="pk-title"><h2>{def.name}</h2><span className="tag num">{run.picks.length}</span></div>
        <div className="pk-meta"><span className="tag pk-exp">Experimental</span><EvidenceChip id={def.id} /><span className="small num dim" data-sample>{fe ? `${fe.closed} of ${MIN_TRADES} observations resolved in the record` : 'record unavailable'}</span></div>
        <p className="small dim pk-line">{def.line} · {run.minimum}/3 models must agree · up to {def.horizon} sessions</p>
        <details className="ev"><summary>How it picks<span className="chev">▾</span></summary><div className="body"><p className="small mute" style={{ marginTop: 0 }}>{def.theory}</p><ol style={{ margin: 0, paddingLeft: 20 }}>{def.how.map((h) => <li key={h} style={{ marginBottom: 6 }}>{h}</li>)}</ol>
          <p className="small dim" style={{ marginBottom: 0 }}>Universe: {run.funnel.universe} · eligible: {run.funnel.eligible} · filters and agreement passed: {run.funnel.passed} · selected: {run.funnel.picked}. Stop ceiling: {def.maxStopPct}%. Original factor evidence excludes the confirmation layer.</p></div></details>
      </header>
      {run.picks.length ? run.picks.map((p) => { const row = scr.data!.rows.find((x) => x.sym === p.sym); const st = state(p); const fx = pickFacts(p.engine, row); return <article key={p.sym} className="card pickcard" data-pick={p.sym}>
        <div className="pk-top"><a href={`#/c/${p.sym}`} className="pk-id"><span className="sym">{p.rank}. {p.sym}</span>{row ? <TrendTag r={row} /> : null}</a><span className="tag lime num" title={RANK_NOTE}>Percentile {p.score}</span></div>
        {p.why[0] && <p className="pk-why small">{p.why[0]}</p>}
        <div className="num small pk-lv">Signal close <b>{inr(p.ref)}</b> · stop <b>{inr(p.stop)}</b> ({Math.round(p.stopPct * 10) / 10}% below) · exit by session {p.horizon}</div>
        <TargetLadder sym={p.sym} input={pickLadderInput(p) ?? undefined} quiet />
        {(p.flags ?? []).map((f) => <p key={f} className="small pk-flag">⚠ {f}</p>)}
        <details className="ev"><summary>Criteria · why it qualified{p.agreement ? ` · ${p.agreement.count}/3 models agree` : ''}<span className="chev">▾</span></summary><div className="body">
          {fx.length ? <div className="factstrip num" role="list" aria-label={`What ranked ${p.sym} in ${def.name}`}>{fx.map((x) => <span key={x.k} role="listitem"><small>{x.k}</small><b className={x.tone ?? ''}>{x.v}</b></span>)}</div> : null}
          {p.why.map((w) => <div key={w} className="small" style={{ marginBottom: 4 }}>✓ {w}</div>)}{p.risk && <p className="small down" style={{ margin: '8px 0 0' }}>Main risk · {p.risk}</p>}
          {p.agreement && <ModelAgreement agreement={p.agreement} />}
          <p className="small dim" style={{ margin: '8px 0 0' }}>{RANK_NOTE}</p></div></details>
        <details className="ev" data-assumptions><summary>Paper assumptions<span className="chev">▾</span></summary><div className="body"><ul className="small dim" style={{ margin: 0, paddingLeft: 18 }}>{paperAssumptions(p.horizon, cost).map((x) => <li key={x} style={{ marginBottom: 4 }}>{x}</li>)}</ul></div></details>
        <div className="pickfoot"><span className="small dim">{st.text}</span><div className="row" style={{ gap: 8 }}>{st.k !== 'in' && <button className="btn sm" disabled={!holdingsReady} onClick={() => take(p)}>Add paper trade</button>}<TvButton sym={p.sym} className="btn sm" label="Chart" /></div></div></article>; })
        : <Empty title="No new entry">Review the candidates below for filter failures, missing data, model disagreement, existing holdings and shortlist limits. Existing positions continue under their recorded exit rules.</Empty>}
      <CandidateReview candidates={run.candidates} engine={def.name} />
    </section>; })}
    <details className="more agreement-settings"><summary>Model agreement settings · independent for each engine</summary><p className="small dim">Recommended starting point: 3 of 3 for each engine, matching the existing all-confirmations approach. Select 2 for a majority, or 1 for a permissive forward test. Existing factor filters still apply. These settings affect new candidates on this device; they never change open positions.</p>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>{(['MOM', 'QLT', 'ST'] as SignalEngine[]).map((id) => <label key={id}>{id === 'MOM' ? 'Momentum' : id === 'QLT' ? 'Quality' : 'Short-Term'} <select aria-label={`${id} minimum agreement`} value={settings[id]} onChange={(e) => setState((s) => ({ ...s, signalAgreement: { ...agreementSettings(s.signalAgreement), [id]: Number(e.target.value) as 1 | 2 | 3 } }))}>{[3, 2, 1].map((n) => <option key={n} value={n}>{n} of 3</option>)}</select></label>)}</div>
      <p className="small mute">The shared nightly engine book uses published settings: Momentum {DEFAULT_AGREEMENT.MOM}/3, Quality {DEFAULT_AGREEMENT.QLT}/3, Short-Term {DEFAULT_AGREEMENT.ST}/3. Bearish outputs are diagnostic; all entries are long-only.</p>
    </details>
    <details className="more signal-method"><summary>Legacy market context · separate from engine votes</summary><GatePanel /><p className="small dim">The legacy 2-of-4 checklist and statistical alert gate belong to the earlier Swing feed. They do not close positions or block these engines.</p></details>
    <details className="more signal-method"><summary>Observation counts and paper-book rules</summary><ObservationNote parts={['observed', 'positions']} className="small dim" />
      <p className="small dim" style={{ margin: '0 0 6px' }}>Published nightly picks enter the shared paper book within its 50-position (30 before the 3 Nov night) and four-per-sector limits. Tickets: ₹25,000 for Momentum and Short-Term; ₹50,000 for Quality. Your device settings can produce a different shortlist. <a href="#/signals?v=positions">See the positions</a> · <a href="#/signals?v=evidence">Review the evidence</a></p>
    </details>
  </div>;
}
