import { useMemo, useState } from 'react';
import { useLedger } from '../data.ts';
import { useAutoBook } from '../book.ts';
import { buildLedgerView } from '../ledgerview.ts';
import { lifecycleTimeline, scoreboard, sitOutLog, traceOf, fmtR, type TraceMetric, type SitReason } from '../glassbook.ts';
import { currentSnapshotId } from '../snapid.ts';
import { dayWord } from '../fmt.ts';
import { Loading } from './common.tsx';
import { SectionHeader, EmptyState } from '../components/index.ts';
import { ShareRow } from './sharerow.tsx';

const REASON: Record<SitReason, string> = { duplicate: 'Same name already held', 'risk-cap': 'Book or sector cap', size: 'One share over the ticket', 'not-selected': 'Not selected' };
const TRACES: { id: TraceMetric; label: string }[] = [{ id: 'closed', label: 'Closed positions' }, { id: 'open', label: 'Open positions' }, { id: 'totalR', label: 'Total R' }, { id: 'realisedInr', label: 'Realised ₹' }];
const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const val = (m: TraceMetric, v: number | null) => (v == null ? '—' : m === 'totalR' ? fmtR(v) : m === 'realisedInr' ? inr(v) : String(v));
const tone = (v: number | null) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');

/** The Glass Book (4.0): the scoreboard, the traces behind each headline, every position's timeline, and the picks the book did not take. One ledger view, nothing recounted. */
export function GlassBook() {
  const feed = useLedger(); const book = useAutoBook(false); const l = feed.data?.ledger ?? null; const plan = book.plan;
  const lv = useMemo(() => (l && plan ? buildLedgerView(l, plan) : null), [l, plan]);
  const sb = useMemo(() => (l && plan && lv ? scoreboard(l, plan, lv) : null), [l, plan, lv]);
  const log = useMemo(() => (l && plan ? sitOutLog(l, plan) : null), [l, plan]);
  const [trace, setTrace] = useState<TraceMetric>(() => { const t = new URLSearchParams(location.hash.split('?')[1] ?? '').get('trace'); return TRACES.some((x) => x.id === t) ? (t as TraceMetric) : 'closed'; });
  const tr = useMemo(() => (l && plan && lv ? traceOf(l, plan, trace, lv) : null), [l, plan, lv, trace]);
  if (feed.loading && !l) return <Loading what="the Glass Book" />;
  if (!l || !plan || !lv || !sb || !log) return <EmptyState>The Glass Book has nothing to show yet: the nightly ledger has not been published, so there is nothing to trace. Missing is shown as missing.</EmptyState>;
  const snap = currentSnapshotId(); const max = Math.max(1, ...sb.bins.map((b) => b.n));
  const taken = lv.lifecycles.filter((x) => x.state !== 'skipped').slice().sort((a, b) => b.asOf.localeCompare(a.asOf));
  return <div className="gb-page" data-glass>
    <header className="gb-head">
      <p className="eyebrow">The Glass Book · paper only</p>
      <h1>Every number, traced to the event behind it.</h1>
      <p className="dim">Closed book positions, open positions and the picks the book did not take, each from the same ledger. Simulated paper trades, not investment advice. {snap ? <>Snapshot <span className="num">{snap}</span>.</> : null}</p>
    <ShareRow sym={null} />
    </header>

    <section className="rec-sec card" aria-labelledby="gb-sb" data-glass-scoreboard>
      <SectionHeader id="gb-sb" title="The honest scoreboard" description={sb.sampleLine} />
      {sb.n === 0 ? <p className="dim">No book position has closed, so there is no expectancy, win rate or drawdown. They are shown as missing, not as zero.</p> : <>
        <dl className="gb-stats">
          <div><dt>Expectancy</dt><dd className={`num ${tone(sb.expectancy)}`}>{fmtR(sb.expectancy)}</dd></div>
          <div><dt>Win rate</dt><dd className="num">{sb.winRate == null ? '—' : `${sb.winRate}%`}</dd></div>
          <div><dt>Avg win</dt><dd className="num up">{fmtR(sb.avgWin)}</dd></div>
          <div><dt>Avg loss</dt><dd className="num down">{fmtR(sb.avgLoss)}</dd></div>
          <div><dt>Total</dt><dd className={`num ${tone(sb.totalR)}`}>{fmtR(sb.totalR)}</dd></div>
          <div><dt>Largest fall</dt><dd className="num">{sb.drawdown ? fmtR(-sb.drawdown.r) : '—'}</dd></div>
        </dl>
        <div className="gb-hist" role="img" aria-label={`Closed book positions by result in R: ${sb.bins.map((b) => `${b.label} ${b.n}`).join(', ')}`}>
          {sb.bins.map((b) => <div key={b.label} className="gb-bin"><span className="gb-bar"><i style={{ height: `${(b.n / max) * 100}%` }} /></span><b className="num">{b.n}</b><small>{b.label}</small></div>)}
        </div>
        <table className="tbl"><caption className="sr">By engine</caption><thead><tr><th scope="col">Engine</th><th scope="col">Closed</th><th scope="col">Avg R</th><th scope="col">Win rate</th><th scope="col">Total R</th></tr></thead>
          <tbody>{sb.engines.map((e) => <tr key={e.engine}><th scope="row">{e.engine}</th><td className="num">{e.n}</td><td className="num">{fmtR(e.avgR)}</td><td className="num">{e.winRate == null ? '—' : `${e.winRate}%`}</td><td className={`num ${tone(e.totalR)}`}>{fmtR(e.totalR)}</td></tr>)}</tbody></table>
        <p className="small dim">{sb.drawdownBasis} A win is a result above 0R and a loss one below it; a flat result is in neither average.</p>
      </>}
    </section>

    <section className="rec-sec card" aria-labelledby="gb-tr" data-glass-trace>
      <SectionHeader id="gb-tr" title="Trace a number" description="Pick a headline. The rows below are the positions that add up to it, each with the arithmetic." />
      <div className="seg" role="group" aria-label="Headline to trace">{TRACES.map((t) => <button key={t.id} type="button" aria-pressed={trace === t.id} className={trace === t.id ? 'on' : ''} onClick={() => setTrace(t.id)}>{t.label}</button>)}</div>
      {tr && <>
        <p className="gb-sum" data-trace-sum>Headline <b className="num">{val(trace, tr.value)}</b> · rows added up again <b className="num">{val(trace, tr.recomputed)}</b> {tr.value === tr.recomputed ? <span className="up" aria-label="match">✓ they agree</span> : <span className="down">✗ they differ</span>}</p>
        {tr.rows.length === 0 ? <p className="dim">No position behind this figure yet.</p> : <div className="scroll-x" tabIndex={0} role="region" aria-label="Trace rows, scrolls sideways"><table className="tbl"><thead><tr><th scope="col">Position</th><th scope="col">Date</th><th scope="col">Adds</th><th scope="col">How</th></tr></thead>
          <tbody>{tr.rows.map((r) => <tr key={r.lifecycleId}><th scope="row">{r.sym} <small className="dim">{r.engine} · <span className="num">{r.lifecycleId}</span></small></th><td className="num">{r.day ? dayWord(r.day) : '—'}</td><td className="num">{trace === 'closed' || trace === 'open' ? '1' : val(trace, r.value)}</td><td className="small dim">{r.formula}</td></tr>)}</tbody></table></div>}
      </>}
    </section>

    <section className="rec-sec card" aria-labelledby="gb-tl" data-glass-timelines>
      <SectionHeader id="gb-tl" title="Position timelines" description="Signal, selection, entry, targets and exit, each with its date and where the fact comes from. A selection is not a fill; a fill here is simulated from completed daily bars." />
      {taken.length === 0 ? <p className="dim">The book has taken no position yet.</p> : taken.map((x) => { const t = lifecycleTimeline(l, plan, x.id, lv); if (!t) return null; return <details key={x.id} className="more gb-tl">
        <summary><b>{x.sym}</b> <small className="dim">{x.engine} · {x.state === 'closed' ? 'closed' : x.state === 'open' ? 'open' : 'awaiting entry'}</small>{x.r != null && <span className={`num ${tone(x.r)}`}> {fmtR(x.r)}</span>}</summary>
        <ol className="gb-events">{t.events.map((e, i) => <li key={`${e.kind}-${i}`} data-kind={e.kind}><span className="num gb-day">{e.day ? dayWord(e.day) : 'not yet'}</span><div><b>{e.title}</b><p className="small">{e.detail}</p><p className="small dim">{e.basis} · {e.source}</p></div></li>)}</ol>
        <p className="small dim">Position <span className="num">{x.id}</span></p>
      </details>; })}
    </section>

    <section className="rec-sec card" aria-labelledby="gb-so" data-glass-sitout>
      <SectionHeader id="gb-so" title="What we didn't buy" description={`${log.rows.length} of ${log.resolved} resolved observations were not taken by the book. Their outcomes are observation outcomes, not trades, and are in no book figure.`} />
      {log.rows.length === 0 ? <p className="dim">Every resolved observation was taken by the book.</p> : <div className="scroll-x" tabIndex={0} role="region" aria-label="Sit-out log, scrolls sideways"><table className="tbl">
        <thead><tr><th scope="col">Signal</th><th scope="col">Why not taken</th><th scope="col">What happened next (observation)</th></tr></thead>
        <tbody>{log.rows.map((r) => <tr key={r.pickId}><th scope="row">{r.sym} <small className="dim">{r.engine} · {dayWord(r.asOf)}</small></th><td><b className="small">{REASON[r.reason]}</b><p className="small dim">{r.why}</p></td><td className={`num ${tone(r.r)}`}>{fmtR(r.r)}{r.exitDay ? <small className="dim"> · {r.ended ?? 'ended'} · {dayWord(r.exitDay)}</small> : null}</td></tr>)}</tbody></table></div>}
      {log.stillRunning > 0 && <p className="small dim">{log.stillRunning} more not-taken observations have not resolved yet and are not listed.</p>}
    </section>
  </div>;
}
