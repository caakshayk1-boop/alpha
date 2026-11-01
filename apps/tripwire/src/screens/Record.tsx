import { useMemo, useState } from 'react';
import { useLedger, useSignals } from '../data.ts';
import { useAutoBook } from '../book.ts';
import { TradeCard } from './Tracker.tsx';
import { rulesOfRecord } from '../rules.ts';
import { ENGINES } from '../quant.ts';
import { RETIRED, summarizeLedger, MIN_TRADES } from '../ledger.ts';
import { closedItems, definitionLines, figuresOf, throughOf, viewOfClosed } from '../recordview.ts';
import { dayWord, inr0 } from '../fmt.ts';
import { Empty } from '../ui.tsx';
import { Loading } from './common.tsx';
import { ObservationNote } from './obsnote.tsx';
import { basisCounts, basisLine } from '../provenance.ts';
import { EmptyState, RecordStat, RecordStats, SectionHeader, StatusPill, ThroughPills, Button } from '../components/index.ts';
import { gateLine } from '../components/gate.ts';
import type { BookRow } from '../book.ts';
import { targetsFor } from '../exits.ts';

const fmtR = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`);
const SHOWN = 6;

/** The one Record: the forward ledger and the paper book's outcomes, once. Headline numerals, how current the two stages are, every closed trade as a position card with its ladder completed,
 *  the engines, the Signals gate as a labelled section, and the one definition of R and of T2. Nothing here predicts anything. */
export function RecordScreen() {
  const feed = useLedger(); const sig = useSignals(); const book = useAutoBook(false);
  const [openId, setOpenId] = useState<string | null>(null); const [all, setAll] = useState(false);
  const l = feed.data?.ledger ?? null;
  const fig = useMemo(() => (l ? figuresOf(l) : null), [l]); const sum = useMemo(() => (l ? summarizeLedger(l) : null), [l]);
  const items = useMemo(() => (l ? closedItems(l) : []), [l]);
  if (feed.loading) return <Loading what="the record" />;
  if (feed.err || !l || !fig || !sum) return <Empty title="The record has not started" action={<button className="btn" onClick={feed.retry}>Check again</button>}>{feed.err === 'the first nightly run has not happened yet' || feed.err === 'not published' ? 'It starts with the first nightly run, which writes down every pick after each trading day. Nothing before that night counts.' : `The record could not be read (${feed.err ?? 'no data'}). Nothing is shown in its place.`}</Empty>;
  const through = throughOf(l, Date.now()); const def = definitionLines(); const g = gateLine(sig.data);
  const bookRow = (id: string): BookRow | undefined => book.rows.find((r) => r.p.id === id);
  const shown = all ? items : items.slice(0, SHOWN);
  const voided = l.voided ? Object.keys(l.voided).length : 0;
  const by: Record<string, string[]> = {}; for (const d of l.days) (by[rulesOfRecord(d.rules)] ??= []).push(d.asOf);
  return <div className="rec" data-record>
    <section className="rec-hero" aria-labelledby="rec-h">
      <SectionHeader id="rec-h" title="Forward record" description={`Every pick, every night since ${dayWord(fig.first)}, written down before anyone knew how it turned out, whether or not it was taken.`} />
      <RecordStats>
        <RecordStat value={fig.closed} label="Closed trades" note={`of ${MIN_TRADES} needed`} />
        <RecordStat value={fig.winRate == null ? null : `${fig.winRate}%`} label="Win rate" note={fig.enough ? `${fig.wins} of ${fig.closed}` : `withheld until ${MIN_TRADES} close`} />
        <RecordStat value={fig.totalR == null ? null : fmtR(fig.totalR)} label="Total R" tone={fig.totalR == null ? undefined : fig.totalR > 0 ? 'up' : fig.totalR < 0 ? 'down' : undefined} note="sum of closed trades" />
      </RecordStats>
      <div className="rec-prog" role="img" aria-label={`${fig.closed} of ${MIN_TRADES} trades closed`}>{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.floor((Math.min(fig.closed, MIN_TRADES) / MIN_TRADES) * 10) ? 'on' : ''} />)}</div>
      <p className="rec-line"><b>{fig.closed}</b> of {MIN_TRADES} trades closed · {fig.nights} night{fig.nights === 1 ? '' : 's'} recorded · {fig.picks} pick observations · {fig.open} open · {fig.skipped} skipped · {fig.pending} waiting for prices.</p>
      <ObservationNote />
      {basisLine(basisCounts(l)) && <p className="rec-line" data-basis-line>{basisLine(basisCounts(l))}</p>}
      <ThroughPills through={through} />
      <p className="rec-line">{fig.enough ? <>Average <b className="num">{fmtR(fig.avgR)}</b> a trade{sum.all.avgExcess != null ? <> · <span className="num">{sum.all.avgExcess > 0 ? '+' : '−'}{Math.abs(sum.all.avgExcess).toFixed(2)}%</span> against the Nifty over the same days</> : null}.</> : <span>Average R, win rate and the comparison with the Nifty stay hidden until {MIN_TRADES} trades have closed. Fewer than that says nothing.</span>}</p>
    </section>

    <section className="rec-sec" aria-labelledby="rec-closed">
      <SectionHeader id="rec-closed" title="Closed positions" description="Newest exit first. Each ladder is shown completed: where it entered, what was booked and when, and where it left." />
      {items.length === 0 ? <EmptyState icon="clock">Nothing has closed yet — the first positions are still open.</EmptyState> : <>
        <div className="ds-stagger">{shown.map(({ pick, outcome }) => {
          const br = bookRow(pick.id); const v = viewOfClosed(pick, outcome, br ? br.p.qty : null, br ? br.v.pnl : null);
          const row: BookRow = br ?? { p: { id: pick.id, sym: pick.sym, engine: pick.engine, asOf: pick.asOf, ref: pick.ref, stop: pick.stop, horizon: pick.horizon, qty: 0, takenAt: 0, targets: targetsFor(pick, true) }, v, q: null, dayPnl: null };
          return <TradeCard key={pick.id} r={row} outcome={outcome} cost={l.cost} expanded={openId === pick.id} onToggle={() => setOpenId(openId === pick.id ? null : pick.id)} live={false}  />;
        })}</div>
        {items.length > SHOWN && !all && <Button className="rec-more" onClick={() => setAll(true)}>Show all {items.length} closed</Button>}
      </>}
    </section>

    <section className="rec-sec" aria-labelledby="rec-eng">
      <SectionHeader id="rec-eng" title="By engine" description="The same closed trades, split by the rule that picked them." />
      <div>{sum.engines.map((e) => { const d = ENGINES.find((x) => x.id === e.engine)!; const idle = l.days.filter((x) => (x.engines[e.engine]?.picked ?? 0) === 0).length; return <div key={e.engine} className="rec-eng">
        <div className="top"><b>{d.name}</b><span className="ds-pill num">{e.picks} picks</span></div>
        <div className="fig num">{e.closed} closed · {e.open} open · {e.skipped} skipped · {e.pending} pending · total <b>{fmtR(e.closed ? e.totalR : null)}</b>{e.enough ? ` · average ${fmtR(e.avgR)}` : ''}</div>
        <div className="sub">{d.retired ? `Retired ${dayWord(d.retired)}. Its record stays; it makes no new picks.` : `${idle} of ${l.days.length} night${l.days.length === 1 ? '' : 's'} with no pick.`}</div></div>; })}</div>
    </section>

    <section className="rec-sec rec-gate" aria-labelledby="rec-gate" data-sec="gate">
      <SectionHeader id="rec-gate" title="Signals gate" description="A separate test, kept here so there is one record. No pick is promoted to an alert until the gate passes; it is off today." />
      {g && <div className="ds-card ds-gatecard"><StatusPill tone={g.on ? "up" : "neutral"} icon={g.on ? "check" : "lock"}>{g.on ? "ON" : "OFF"}</StatusPill><span className="ds-gatetext">{g.text}</span></div>}
      {g && sig.data?.gate ? <ul className="tl-notes" aria-label="The gate's checks">{sig.data.gate.checks.map((c) => <li key={c.rule}><StatusPill tone={c.ok ? 'up' : 'neutral'} icon={c.ok ? 'check' : 'x'}>{c.ok ? 'Passed' : 'Not passed'}</StatusPill> {c.rule}{c.value ? ` — ${c.value}` : ''}</li>)}</ul>
        : <p className="rec-line">The gate has not been published yet.</p>}
    </section>

    <section className="rec-sec" aria-labelledby="rec-def">
      <SectionHeader id="rec-def" title="How to read this" />
      <p className="rec-line"><b>One R.</b> {def.r}</p>
      <p className="rec-line"><b>One T2.</b> {def.targets} The same levels are drawn on every card in the Book and here.</p>
      <p className="rec-line">It is a forward record: nothing before the first night counts. Each night's picks are replayed with the same rules as your own paper trades (next-open fill, stop first, time exit, costs {l.cost}% round trip), and a closed outcome is never rewritten. {inr0(book.cfg.ticket)} is the most the paper book puts in any one position, so a rupee figure depends on size and R does not. Thirty trades is a minimum, not proof.</p>
      <p className="rec-line"><b>Original and restated.</b> A result is labelled by the rule it was produced under: <i>As filed</i> (written on or after 27 Oct 2026, under the profit-booking ladder from the start), <i>Original rule</i> (written earlier and finished under stop-and-time only, never re-evaluated) or <i>Restated rule</i> (written earlier, still open on 1 Nov 2026, so the ladder was applied to it from its entry bar). A restated position's earlier figure was never stored, so it is labelled, not shown beside an invented one.</p>
      <p className="rec-line">Eligibility rule by night: {Object.entries(by).map(([v, ds]) => `${v} (${ds.length} ${ds.length === 1 ? 'night' : 'nights'}, ${dayWord(ds[0])}${ds.length > 1 ? ` to ${dayWord(ds[ds.length - 1])}` : ''})`).join(' · ')}. A night keeps the version it was written under.</p>
      {voided > 0 && <p className="rec-line"><b>{voided} pick{voided === 1 ? '' : 's'} voided.</b> They are kept in the record, left out of every total, and the reason is stated: {[...new Set(Object.values(l.voided!))][0]}</p>}
      {RETIRED.size > 0 && <p className="rec-line">Retired engines stay in the stored record and are left out of every figure above.</p>}
    </section>
  </div>;
}
