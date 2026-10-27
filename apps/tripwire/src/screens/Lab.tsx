import { useEffect, useMemo, useState } from 'react';
import { PageBar, Head, Failed, Loading } from './common.tsx';
import { CondSheet } from './discover.tsx';
import { Empty } from '../ui.tsx';
import { LAB_KEYS, feature, makeCtx } from '../lab/features.ts';
import { loadPanel, type LabPanel } from '../lab/panel.ts';
import { edgeStats, isHoldout, matchesNow, runStrategy, stats, STEP, type Result, type Stats, type Strategy } from '../lab/engine.ts';
import { DEFAULT_STRATEGY, PRESETS, readLab, recordRun, writeLab, type LabState } from '../lab/store.ts';
import { HOLDOUT_FROM, judge, type Edge, type Verdict } from '../lab/verdict.ts';
import { applyConds, describeCond, metricOf, sameCond, type Cond } from '../screener.ts';
import { styleDef } from '../exits.ts';
import { styleOf } from '../exits.ts';
import type { Row } from '../screen.ts';

const ls = (): Storage | null => { try { return localStorage; } catch { return null; } };
const POS = [5, 10, 20, 30], HOR = [10, 20, 30, 60], STOP = [3, 5, 8, 12];
const p1 = (x: number | null) => (x === null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(2)}%`);
interface Out { strat: Strategy; res: Result; all: Stats; dev: Stats; hold: Stats; ctl: Stats; edge: Edge; edgeHold: Edge; verdict: Verdict; tried: number }

function Curve({ res, dates }: { res: Result; dates: string[] }) {
  const T = res.equity.length, a = res.from; const n = Math.min(260, T - a); const idx = Array.from({ length: n }, (_, k) => a + Math.round((k * (T - 1 - a)) / (n - 1)));
  const e0 = res.equity[a], b0 = res.bench[a]; const S = idx.map((i) => res.equity[i] / e0), B = idx.map((i) => res.bench[i] / b0);
  const lo = Math.min(...S, ...B), hi = Math.max(...S, ...B), W = 320, H = 120; const y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * (H - 8) - 4, x = (k: number) => (k / (n - 1)) * W;
  const path = (v: number[]) => v.map((q, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${y(q).toFixed(1)}`).join('');
  return <div className="chart" role="img" aria-label={`The strategy grew ${(S[n - 1]).toFixed(2)} times against ${(B[n - 1]).toFixed(2)} times for holding every name equally, from ${dates[a]} to ${dates[T - 1]}. Worst fall ${(res.maxDrawdown * 100).toFixed(0)}%.`}>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 140, display: 'block' }}>
      <line x1="0" x2={W} y1={y(1)} y2={y(1)} stroke="var(--line)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <path d={path(B)} fill="none" stroke="var(--mute)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" /><path d={path(S)} fill="none" stroke="var(--lime)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="row between small mute num"><span>{dates[a].slice(0, 4)}</span><span><i className="c-key" style={{ background: 'var(--lime)' }} /> this rule {S[n - 1].toFixed(2)}× · <i className="c-key" style={{ background: 'var(--mute)' }} /> every name equally {B[n - 1].toFixed(2)}×</span><span>{dates[T - 1].slice(0, 4)}</span></div></div>;
}

function Row3({ label, s }: { label: string; s: Stats }) {
  return <tr><th scope="row">{label}</th><td className="num">{s.n}</td><td className="num">{p1(s.meanNet)}</td><td className="num">{p1(s.meanExcess)}</td><td className="num">{s.t === null ? '—' : s.t.toFixed(2)}</td><td className="num">{s.win === null ? '—' : `${Math.round(s.win * 100)}%`}</td><td className="num">{s.avgR === null ? '—' : `${s.avgR >= 0 ? '+' : '−'}${Math.abs(s.avgR).toFixed(2)}R`}</td></tr>;
}

export function Lab() {
  const [panel, setPanel] = useState<LabPanel | null>(null); const [err, setErr] = useState<string | null>(null); const [nonce, setNonce] = useState(0);
  useEffect(() => { const ac = new AbortController(); setErr(null); loadPanel(ac.signal).then(setPanel, (e) => { if (!ac.signal.aborted) setErr(String(e?.message ?? e)); }); return () => ac.abort(); }, [nonce]);
  const ctx = useMemo(() => (panel ? makeCtx(panel) : null), [panel]);
  const [state, setState] = useState<LabState>(() => readLab(ls()));
  const [strat, setStrat] = useState<Strategy>(() => {
    try { const seed = sessionStorage.getItem('tripwire:lab:seed'); if (seed) { sessionStorage.removeItem('tripwire:lab:seed'); const cs = (JSON.parse(seed) as Cond[]).filter((c) => LAB_KEYS.includes(c.m)); if (cs.length) return { ...DEFAULT_STRATEGY, conds: cs, rankBy: cs[0].m }; } } catch { /* no seed */ }
    return readLab(ls()).draft ?? DEFAULT_STRATEGY;
  });
  const [sheet, setSheet] = useState(false); const [prog, setProg] = useState<number | null>(null); const [out, setOut] = useState<Out | null>(null);
  const rows = useMemo(() => (ctx && panel ? panel.syms.map((sym, j) => ({ sym, name: sym, ...Object.fromEntries(LAB_KEYS.map((k) => [k, feature(ctx, k, j, panel.T - 1)])) }) as unknown as Row) : []), [ctx, panel]);
  const set = (p: Partial<Strategy>) => { setStrat((s) => ({ ...s, ...p })); setOut(null); };
  const run = async () => {
    if (!ctx || prog !== null) return; setProg(0);
    try {
      const res = await runStrategy(ctx, strat, (d, o) => setProg(d / o * 0.8)); const control = await runStrategy(ctx, { ...strat, random: true }, (d, o) => setProg(0.8 + (d / o) * 0.2));
      const rec = recordRun(state, strat); setState(rec.state); writeLab(ls(), rec.state);
      const all = stats(res.trades), dev = stats(res.trades, (t) => !isHoldout(t)), hold = stats(res.trades, isHoldout), ctl = stats(control.trades);
      const edge = edgeStats(res.trades, control.trades), edgeHold = edgeStats(res.trades, control.trades, isHoldout);
      setOut({ strat, res, all, dev, hold, ctl, edge, edgeHold, verdict: judge(all, dev, hold, edge, edgeHold, rec.tried), tried: rec.tried });
    } finally { setProg(null); }
  };
  const now = useMemo(() => (out && ctx ? matchesNow(ctx, out.strat).slice(0, 12) : []), [out, ctx]);
  const st = styleDef(styleOf(strat.horizon));
  if (err) return <div><PageBar title="Strategy Lab" onBack /><Failed what="the price history" err={err} retry={() => setNonce((n) => n + 1)} /></div>;
  if (!panel || !ctx) return <div><PageBar title="Strategy Lab" onBack /><Loading what="ten years of closes" /></div>;
  return <div>
    <PageBar title="Strategy Lab" onBack sub={<>{panel.N} names · {panel.dates[0].slice(0, 4)} to {panel.dates[panel.T - 1]} · closes only</>} />
    <p className="small mute" style={{ margin: '0 0 10px' }}>Test a rule on ten years of closes before trusting it. A rule is called supported only when it beats holding every name equally, after costs, by more than chance allows, and still does in the years since {HOLDOUT_FROM.slice(0, 4)}. Each different rule you try makes that bar higher.</p>

    <Head>Start from</Head>
    <div className="chips wrap" role="group" aria-label="Starting points">{PRESETS.map((p) => <button key={p.id} className="chip" onClick={() => { setStrat(p.s); setOut(null); }} title={p.line}>{p.name}</button>)}</div>

    <Head>The rule</Head>
    <section className="card">
      <fieldset disabled={prog !== null} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="k">Buy a name when</div>
      <div className="chips chosen" role="group" aria-label="Entry conditions">
        {strat.conds.map((c) => <button key={`${c.m}${c.op}${c.v}`} className="chip cc on-x" onClick={() => set({ conds: strat.conds.filter((x) => !sameCond(x, c)) })} aria-label={`Remove condition: ${describeCond(c)}`}>{describeCond(c)} <span aria-hidden="true">×</span></button>)}
        <button className="chip" onClick={() => setSheet(true)}>+ Condition</button>
      </div>
      <label className="l" htmlFor="lab-rank">Take the best first, by</label>
      <div className="row" style={{ gap: 8 }}>
        <select id="lab-rank" className="field grow" value={strat.rankBy} onChange={(e) => set({ rankBy: e.target.value as Strategy['rankBy'] })}>{LAB_KEYS.map((k) => <option key={k} value={k}>{metricOf(k)?.label ?? k}</option>)}</select>
        <div className="c-bar" role="group" aria-label="Order"><button className="seg" aria-pressed={strat.rankDir === 'desc'} onClick={() => set({ rankDir: 'desc' })}>Highest</button><button className="seg" aria-pressed={strat.rankDir === 'asc'} onClick={() => set({ rankDir: 'asc' })}>Lowest</button></div>
      </div>
      <div className="k" style={{ marginTop: 12 }}>Positions at once</div>
      <div className="c-bar" role="group" aria-label="Positions at once">{POS.map((v) => <button key={v} className="seg" aria-pressed={strat.positions === v} onClick={() => set({ positions: v })}>{v}</button>)}</div>
      <div className="k" style={{ marginTop: 12 }}>Hold at most (sessions)</div>
      <div className="c-bar" role="group" aria-label="Longest hold">{HOR.map((v) => <button key={v} className="seg" aria-pressed={strat.horizon === v} onClick={() => set({ horizon: v })}>{v}</button>)}</div>
      <div className="k" style={{ marginTop: 12 }}>Stop below the fill (%)</div>
      <div className="c-bar" role="group" aria-label="Stop distance">{STOP.map((v) => <button key={v} className="seg" aria-pressed={strat.stopPct === v} onClick={() => set({ stopPct: v })}>{v}</button>)}</div>
      <p className="small mute" style={{ margin: '10px 0 0' }}>Checked every {STEP} sessions, filled at the next close with 0.1% slippage, 0.25% round-trip cost, 0.1% more on each market exit. {st.label}: half is sold at {st.t1}× the risk and the stop moves to the fill, the rest at {st.t2}×.</p>
      </fieldset>
      <button className="btn pri" style={{ width: '100%', marginTop: 12 }} disabled={prog !== null} onClick={run}>{prog === null ? 'Run the test' : `Testing… ${Math.round(prog * 100)}%`}</button>
    </section>

    {out && <>
      <Head>Result</Head>
      <section className={`card verdict ${out.verdict.word === 'supported' ? 'good' : ''}`} aria-live="polite">
        <div className="k">Verdict</div><div className="word2">{out.verdict.word}</div><p className="small" style={{ margin: '6px 0 0' }}>{out.verdict.why}</p>
        <p className="small mute" style={{ margin: '8px 0 0' }}>Different rules tried on this device: <b>{out.tried}</b>. The t needed is <b>{out.verdict.tNeeded}</b>. The count rises with every new rule and cannot be reset here, because choosing the best of many tries is how every back-test ends up looking good.</p>
      </section>
      <div className="stbl-wrap"><table className="stbl"><caption className="sr">Trades by period, and the same exits on random picks: count, mean net return, mean return above holding every name, t, win rate, average R.</caption>
        <thead><tr><th scope="col">PERIOD</th><th scope="col">TRADES</th><th scope="col">NET</th><th scope="col">VS ALL</th><th scope="col">T</th><th scope="col">WIN</th><th scope="col">AVG R</th></tr></thead>
        <tbody><Row3 label="All" s={out.all} /><Row3 label={`Before ${HOLDOUT_FROM.slice(0, 4)}`} s={out.dev} /><Row3 label={`${HOLDOUT_FROM.slice(0, 4)} on`} s={out.hold} /><Row3 label="Random picks" s={out.ctl} /></tbody></table></div>
      <p className="small mute" style={{ margin: '6px 0 0' }}>"Random picks" are the same slots, stops, holds and costs on names chosen by a fixed shuffle. Against them the rule added <b className={out.edge.mean === null ? '' : out.edge.mean >= 0 ? 'up' : 'down'}>{p1(out.edge.mean)}</b> a trade{out.edge.t === null ? '' : ` (t ${out.edge.t.toFixed(2)})`}: what choosing the names was worth.</p>
      <p className="small mute" style={{ margin: '6px 0 10px' }}>"Net" is per trade after costs; "vs all" is the same trade's return minus the equal-weight universe's over the same days. Average hold {out.all.avgDays?.toFixed(1) ?? '—'} sessions, worst fall of the whole book {(out.res.maxDrawdown * 100).toFixed(0)}%, about {Math.round(out.res.exposure * 100)}% of the book invested on average.</p>
      <section className="card"><div className="k">The book against holding every name equally</div><Curve res={out.res} dates={panel.dates} /><p className="small mute" style={{ margin: '8px 0 0' }}>Holding is a hard bar here: these are today's names, the ones that survived and, in this sample, rose. It is shown so you can see what a rule gives up by selling on stops and after a short hold.</p></section>

      <Head>Matching today</Head>
      {now.length ? <section className="card" aria-label="Names matching the rule at the latest close">{now.map((m) => <a key={m.sym} className="li" href={`#/c/${m.sym}`}><span className="grow"><b>{m.sym}</b></span><span className="num mute">{metricOf(out.strat.rankBy)?.short} {m.rank.toFixed(1)}</span></a>)}
        <p className="small mute" style={{ margin: '8px 0 0' }}>At the close of {panel.dates[panel.T - 1]}, best first, of {applyConds(rows, out.strat.conds).rows.length} that pass. A list a rule produces, not a recommendation: the test above says how rules like it have done.</p></section>
        : <Empty title="Nothing matches today">No name passes every condition at the latest close.</Empty>}
    </>}

    <Head>What this cannot tell you</Head>
    <section className="card small">
      <p style={{ margin: 0 }}>Today's names only, daily closes only, and price-only figures. Every result is an upper bound, and nothing here is a recommendation.</p>
      <details className="more"><summary>The three limits in full</summary><div>
        <p style={{ margin: '0 0 8px' }}>Today's names only (survivorship): a company that was delisted or collapsed is not in the history, so every result is an upper bound.</p>
        <p style={{ margin: '0 0 8px' }}>Daily closes only. A stop is seen only on a close beyond it, so a gap costs more than the stop says, and an intraday touch of a target that closed back inside is missed.</p>
        <p style={{ margin: '0 0 8px' }}>Price-only figures. Quality, growth and value cannot be tested here: they need point-in-time accounts this app does not hold. They are judged only on the forward record.</p>
        <p style={{ margin: 0 }}>Built {panel.built}. Paper only; nothing here places an order, and a supported rule is a candidate for the forward record, not a recommendation.</p></div></details>
    </section>
    {sheet && <CondSheet metrics={LAB_KEYS} rows={rows} count={(cs) => applyConds(rows, [...strat.conds.filter((x) => !cs.some((c) => c.m === x.m && c.op === x.op)), ...cs]).rows.length} onClose={() => setSheet(false)} onAdd={(cs) => { set({ conds: [...strat.conds.filter((x) => !cs.some((c) => c.m === x.m && c.op === x.op)), ...cs] }); setSheet(false); }} />}
  </div>;
}
