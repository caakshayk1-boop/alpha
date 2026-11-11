import { useEffect, useMemo, useRef, useState } from 'react';
import { useBacktest, useLedger, useSignals } from '../data.ts';
import { useAutoBook } from '../book.ts';
import { TradeCard } from './Tracker.tsx';
import { rulesOfRecord } from '../rules.ts';
import { ACTIVE, ENGINES } from '../quant.ts';
import { RETIRED, summarizeLedger, MIN_TRADES } from '../ledger.ts';
import { closedItems, definitionLines, figuresOf, throughOf, viewOfClosed } from '../recordview.ts';
import { missingNights, missingNightsLine, rBars } from '../bookview.ts';
import { evidenceHeadline } from '../evidence.ts';
import { dayWord, inr0 } from '../fmt.ts';
import { Empty } from '../ui.tsx';
import { Loading } from './common.tsx';
import { ObservationNote } from './obsnote.tsx';
import { RealisedCurve, RecordReading } from './attribution.tsx';
import { Evidence } from './Evidence.tsx';
import { basisCounts, basisLine } from '../provenance.ts';
import { EmptyState, SectionHeader, StatusPill, ThroughPills, Button } from '../components/index.ts';
import { gateLine } from '../components/gate.ts';
import type { BookRow } from '../book.ts';
import { targetsFor } from '../exits.ts';

const fmtR = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`);
const SHOWN = 6;

/** One bar per closed trade in R, oldest exit first, above the zero line when it made R and below when it lost; the total row underneath is the sum the headline states. A table carries the same numbers. */
function RBars({ items }: { items: readonly { id: string; label: string; r: number; day?: string | null }[] }) {
  const bars = useMemo(() => rBars(items), [items]); const total = Math.round(items.reduce((a, x) => a + x.r, 0) * 100) / 100;
  return <section className="rec-sec card rec-bars" aria-labelledby="rec-attr" data-record-attr>
    <SectionHeader id="rec-attr" title="Each closed trade, in R" description="Oldest exit first. Above the line made R; below lost it." />
    <div className="rb-plot" role="img" aria-label={`${bars.length} closed trades in R: ${bars.map((b) => `${b.label} ${fmtR(b.r)}`).join(', ')}. Total ${fmtR(total)}.`}>
      {bars.map((b) => <span key={b.id} className={`rb ${b.tone}`} title={`${b.label} ${fmtR(b.r)}`}><i style={{ transform: `scaleY(${b.h / 100})` }} /></span>)}
    </div>
    <div className="rb-total num" data-contrib-total><span className="k">Total</span><b className={total > 0 ? 'up' : total < 0 ? 'down' : ''}>{fmtR(total)}</b><span className="small dim">{bars.filter((b) => b.tone === 'up').length} made R · {bars.filter((b) => b.tone === 'down').length} lost R</span></div>
    <details className="more"><summary>Table: the same numbers</summary><div className="scroll-x" tabIndex={0} role="region" aria-label="R by closed trade, scrolls sideways"><table className="tbl"><thead><tr><th scope="col">Trade</th><th scope="col">Result</th></tr></thead>
      <tbody>{bars.map((b) => <tr key={b.id}><th scope="row">{b.label}</th><td className={`num ${b.tone === 'flat' ? '' : b.tone}`}>{fmtR(b.r)}</td></tr>)}</tbody></table></div></details>
  </section>;
}

/** The one Record: the forward ledger and the paper book's outcomes, once. A big honest headline, how current the two stages are and which sessions have no night, a bar per closed trade,
 *  every closed trade as a row with its ladder completed, the engines, the evidence and the method. Nothing here predicts anything. `anchor="evidence"` opens and scrolls to the evidence. */
export function RecordScreen({ anchor = null }: { anchor?: string | null }) {
  const feed = useLedger(); const sig = useSignals(); const book = useAutoBook(false); const bt = useBacktest();
  const [openId, setOpenId] = useState<string | null>(null); const [all, setAll] = useState(false); const [ev, setEv] = useState(anchor === 'evidence');
  const evRef = useRef<HTMLElement>(null);
  const l = feed.data?.ledger ?? null;
  const fig = useMemo(() => (l ? figuresOf(l) : null), [l]); const sum = useMemo(() => (l ? summarizeLedger(l) : null), [l]);
  const items = useMemo(() => (l ? closedItems(l) : []), [l]);
  const gaps = useMemo(() => (l ? missingNights(l.days.map((d) => d.asOf)) : []), [l]);
  useEffect(() => { if (anchor === 'evidence') { setEv(true); requestAnimationFrame(() => evRef.current?.scrollIntoView({ block: 'start' })); } }, [anchor, !!l]);   // eslint-disable-line react-hooks/exhaustive-deps
  const evHead = evidenceHeadline(ACTIVE.map((e) => e.id), bt.data, bt.loading);
  const evidence = <section ref={evRef} id="evidence" className="rec-sec rec-ev" aria-labelledby="rec-ev" data-sec="evidence">
    <SectionHeader id="rec-ev" title="Evidence and method" description="What the back-tests say about each engine, separate from this forward record." />
    {evHead ? <p className="rec-line">{evHead}</p> : <span className="sk" style={{ display: 'block', height: 18, width: '80%' }} aria-label="Loading the evidence" />}
    <details className="more" open={ev} onToggle={(e) => setEv((e.target as HTMLDetailsElement).open)}><summary>Evidence: the back-tests, engine by engine</summary>{ev && <Evidence />}</details>
    <p className="rec-line"><a href="#/methodology">Methodology: how every rule was written down before its result</a></p>
  </section>;
  if (feed.loading && !l) return <Loading what="the record" />;
  if (!l || !fig || !sum) { const notStarted = feed.err === 'the first nightly run has not happened yet' || feed.err === 'not published';
    return <><Empty title={notStarted ? 'The record has not started' : 'Position record unavailable'} action={<button className="btn" onClick={feed.retry}>Check again</button>}>{notStarted ? 'It starts with the first nightly run, which writes down every pick after each trading day. Nothing before that night counts.' : `The record could not be read (${feed.err ?? 'no data'}). This does not mean positions have exited or history has been erased.`}</Empty>{evidence}</>; }
  const through = throughOf(l, Date.now()); const def = definitionLines(); const g = gateLine(sig.data);
  const bookRow = (id: string): BookRow | undefined => book.rows.find((r) => r.p.id === id);
  const shown = all ? items : items.slice(0, SHOWN);
  const voided = l.voided ? Object.keys(l.voided).length : 0;
  const by: Record<string, string[]> = {}; for (const d of l.days) (by[rulesOfRecord(d.rules)] ??= []).push(d.asOf);
  const gapLine = missingNightsLine(gaps);
  return <div className="rec" data-record>
    {feed.err && <p className="note" role="status">{feed.err} <button className="btn sm" onClick={feed.retry}>Refresh record</button></p>}
    <section className="rec-hero" aria-labelledby="rec-h">
      <SectionHeader id="rec-h" title="Forward record" description={`Every pick, every night since ${dayWord(fig.first)}, written down before anyone knew how it turned out, whether or not it was taken.`} />
      <p className="rec-big" data-record-headline><b className="num">{fig.closed}</b><span> of {MIN_TRADES} closed</span>{fig.totalR != null && <b className={`num rec-big-r ${fig.totalR > 0 ? 'up' : fig.totalR < 0 ? 'down' : ''}`}>{fmtR(fig.totalR)}</b>}</p>
      {/* 11 Nov 2026: ONE headline (closed of 30, total R) and one verdict. The three stat tiles repeated both numbers; the win rate is withheld below 30, which the pill and Reading say. */}
      <p className="rec-verdict">{fig.enough ? <StatusPill tone="neutral" icon="check">{fig.winRate}% won · average {fmtR(fig.avgR)} a trade{sum.all.avgExcess != null ? ` · ${sum.all.avgExcess > 0 ? '+' : '−'}${Math.abs(sum.all.avgExcess).toFixed(2)}% against the Nifty` : ''}</StatusPill>
        : <StatusPill tone="amber" icon="clock">Too few to judge · win rate and average R withheld until {MIN_TRADES} close</StatusPill>}</p>
      <div className="rec-prog" role="img" aria-label={`${fig.closed} of ${MIN_TRADES} trades closed`}>{Array.from({ length: MIN_TRADES }, (_, i) => <i key={i} className={i < Math.min(fig.closed, MIN_TRADES) ? 'on' : ''} />)}</div>
      <p className="rec-line">{fig.nights} night{fig.nights === 1 ? '' : 's'} recorded · {fig.picks} pick observations · {fig.open} open · {fig.skipped} skipped · {fig.pending} waiting for prices.</p>
      <ThroughPills through={through} />
      {gapLine && <p className="rec-line rec-gaps" data-missing-nights>{gapLine}</p>}
      <details className="more"><summary>What is counted</summary><ObservationNote />{basisLine(basisCounts(l)) && <p className="rec-line" data-basis-line>{basisLine(basisCounts(l))}</p>}</details>
    </section>

    {items.length > 0 && <RBars items={items.map((x) => ({ id: x.pick.id, label: x.pick.sym, r: x.outcome.r as number, day: x.outcome.exitDay }))} />}

    <RecordReading rs={items.map((x) => x.outcome.r as number)} min={MIN_TRADES} />

    <section className="rec-sec" aria-labelledby="rec-closed">
      <SectionHeader id="rec-closed" title="Closed positions" description="Newest exit first. Tap a row for where it entered, what was booked and when, and where it left." />
      {items.length === 0 ? <EmptyState icon="clock">Nothing has closed yet — the first positions are still open.</EmptyState> : <>
        <div className="bk-board ds-stagger">{shown.map(({ pick, outcome }) => {
          const br = bookRow(pick.id); const v = viewOfClosed(pick, outcome, br ? br.p.qty : null, br ? br.v.pnl : null);
          const row: BookRow = br ?? { p: { id: pick.id, sym: pick.sym, engine: pick.engine, asOf: pick.asOf, ref: pick.ref, stop: pick.stop, horizon: pick.horizon, qty: 0, takenAt: 0, targets: targetsFor(pick, true) }, v, q: null, dayPnl: null };
          return <TradeCard key={pick.id} r={row} outcome={outcome} cost={l.cost} expanded={openId === pick.id} onToggle={() => setOpenId(openId === pick.id ? null : pick.id)} live={false} />;
        })}</div>
        {items.length > SHOWN && !all && <Button className="rec-more" onClick={() => setAll(true)}>Show all {items.length} closed</Button>}
      </>}
    </section>

    <RealisedCurve items={items.map((x) => ({ id: x.pick.id, exitDay: x.outcome.exitDay, r: x.outcome.r }))} />

    <section className="rec-sec" aria-labelledby="rec-eng">
      <SectionHeader id="rec-eng" title="By engine" description="The same closed trades, split by the rule that picked them." />
      <div>{sum.engines.map((e) => { const d = ENGINES.find((x) => x.id === e.engine)!; const idle = l.days.filter((x) => (x.engines[e.engine]?.picked ?? 0) === 0).length; return <div key={e.engine} className="rec-eng">
        <div className="top"><b>{d.name}</b><span className="ds-pill num">{e.picks} picks</span></div>
        <div className="fig num">{e.closed} closed · {e.open} open · {e.skipped} skipped · {e.pending} pending · total <b>{fmtR(e.closed ? e.totalR : null)}</b>{e.enough ? ` · average ${fmtR(e.avgR)}` : ''}</div>
        <div className="sub">{d.retired ? `Retired ${dayWord(d.retired)}. Its record stays; it makes no new picks.` : `${idle} of ${l.days.length} night${l.days.length === 1 ? '' : 's'} with no pick.`}</div></div>; })}</div>
    </section>

    {evidence}

    <section className="rec-sec rec-gate" aria-labelledby="rec-gate" data-sec="gate">
      <SectionHeader id="rec-gate" title="Signals gate" description="A separate test, kept here so there is one record. No pick is promoted to an alert until the gate passes; it is off today." />
      {g && <div className="ds-card ds-gatecard"><StatusPill tone={g.on ? 'up' : 'neutral'} icon={g.on ? 'check' : 'lock'}>{g.on ? 'ON' : 'OFF'}</StatusPill><span className="ds-gatetext">{g.text}</span></div>}
      {g && sig.data?.gate ? <ul className="tl-notes" aria-label="The gate's checks">{sig.data.gate.checks.map((c) => <li key={c.rule}><StatusPill tone={c.ok ? 'up' : 'neutral'} icon={c.ok ? 'check' : 'x'}>{c.ok ? 'Passed' : 'Not passed'}</StatusPill> {c.rule}{c.value ? ` — ${c.value}` : ''}</li>)}</ul>
        : <p className="rec-line">The gate has not been published yet.</p>}
    </section>

    <section className="rec-sec" aria-labelledby="rec-def">
      <SectionHeader id="rec-def" title="How to read this" />
      <p className="rec-line"><b>One R.</b> {def.r}</p>
      <p className="rec-line"><b>One T2.</b> {def.targets} The same levels are drawn on every row in the Book and here.</p>
      <p className="rec-line">It is a forward record: nothing before the first night counts. Each night's picks are replayed with the same rules as your own paper trades (next-open fill, stop first, time exit, costs {l.cost}% round trip), and a closed outcome is never rewritten. {inr0(book.cfg.ticket)} is the most the paper book puts in any one position, so a rupee figure depends on size and R does not. Thirty trades is a minimum, not proof.</p>
      <p className="rec-line"><b>Original and restated.</b> A result is labelled by the rule it was produced under: <i>As filed</i> (written on or after 27 Oct 2026, under the profit-booking ladder from the start), <i>Original rule</i> (written earlier and finished under stop-and-time only, never re-evaluated) or <i>Restated rule</i> (written earlier, still open on 1 Nov 2026, so the ladder was applied to it from its entry bar). A restated position's earlier figure was never stored, so it is labelled, not shown beside an invented one.</p>
      <p className="rec-line">Eligibility rule by night: {Object.entries(by).map(([v, ds]) => `${v} (${ds.length} ${ds.length === 1 ? 'night' : 'nights'}, ${dayWord(ds[0])}${ds.length > 1 ? ` to ${dayWord(ds[ds.length - 1])}` : ''})`).join(' · ')}. A night keeps the version it was written under.</p>
      {voided > 0 && <p className="rec-line"><b>{voided} pick{voided === 1 ? '' : 's'} voided.</b> They are kept in the record, left out of every total, and the reason is stated: {[...new Set(Object.values(l.voided!))][0]}</p>}
      {RETIRED.size > 0 && <p className="rec-line">Retired engines stay in the stored record and are left out of every figure above.</p>}
    </section>
  </div>;
}
