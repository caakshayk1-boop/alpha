// The Book's Positions view (11 Nov 2026, revamp v2): ONE departure board for the paper book. The engine book (the nightly record's picks, taken that night) and the trades you took yourself
// are listed together, each row labelled Engine or You, and a trade is never listed twice (a copy of a pick the engine book already holds is left out, as before, and counted once).
// Display only: every figure comes from useAutoBook / useLiveBook as it did on the Auto and Mine tabs; nothing here changes a rule, a cost, a fill or a stored shape.
import { useState } from 'react';
import { go, setState, useAppState, useSheets } from '../app.tsx';
import { useAutoBook, useLiveBook, type BookRow } from '../book.ts';
import { summarize } from '../tracker.ts';
import { archivePaper } from '../store.ts';
import { ENGINES } from '../quant.ts';
import { figuresOf } from '../recordview.ts';
import type { Outcome } from '../ledger.ts';
import { splitOfRow, snapshotOf, HISTORY_WARNING, buildLedgerView, bookClosedCount, bookClosedWord, resolvedObservationCount, partitionWord } from '../ledgerview.ts';
import { throughOf } from '../recordview.ts';
import { ladderInputFor } from '../ladder.ts';
import { byAttention, attention, nearWord, type AttnInput } from '../bookview.ts';
import { setCurrentSnapshotId } from '../snapid.ts';
import { useUi } from '../ui.tsx';
import { Loading } from './common.tsx';
import { TradeCard, engineName, shortEngine } from './Tracker.tsx';
import { PnlAttribution } from './attribution.tsx';
import { TrustRow, TotalRow, MovedRow, PnlTable } from './pnlstrip.tsx';
import { HitCard, ThroughPills } from '../components/index.ts';
import { dayWord, inr0 } from '../fmt.ts';

type Owner = 'engine' | 'you';
interface Item { r: BookRow; owner: Owner; outcome: Outcome | null }
type Filter = 'all' | 'stop' | 'target' | 'you' | string;

const money = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);
const Rw = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`);
const tone = (v: number | null | undefined) => ((v ?? 0) > 0 ? 'up' : (v ?? 0) < 0 ? 'down' : '');

/** The levels of a row exactly as its card draws them (after a split the bars are re-quoted, so the stop moves with them), shaped for the attention order. */
function attnOf(x: Item): AttnInput {
  const { p: p0, v } = x.r; const adj = v.adjFactor && v.adjFactor !== 1 ? v.adjFactor : null;
  const p = adj ? { ...p0, ref: v.signal ?? p0.ref, stop: Math.round(p0.stop * adj * 100) / 100 } : p0;
  const l = ladderInputFor(p, v, x.outcome);
  return { status: v.status, mark: v.mark, stop: l?.curStop ?? v.ladder?.stop ?? p.stop, t1: l?.t1 ?? null, t2: l?.t2 ?? null, t1Hit: !!l?.t1Hit, t2Hit: !!l?.t2Hit, key: `${p.sym}|${p.id}` };
}

/** Slots used in the engine book, as a dotted arc with the one big number inside: one dot per slot, so no value is drawn between two measured states. */
export function SlotGauge({ used, max }: { used: number; max: number }) {
  const R = 86, cx = 100, cy = 100; const n = Math.max(1, max);
  return <figure className="bk-gauge" data-slots={max}>
    <svg viewBox="0 0 200 112" role="img" aria-label={`${used} of ${max} engine-book positions in use`}>
      {Array.from({ length: n }, (_, i) => { const a = Math.PI - (i / (n - 1)) * Math.PI; return <circle key={i} cx={(cx + R * Math.cos(a)).toFixed(1)} cy={(cy - R * Math.sin(a)).toFixed(1)} r="3.6" className={i < used ? 'on' : 'off'} style={{ ['--i' as string]: i }} />; })}
      <text x="100" y="84" textAnchor="middle" className="g-num">{used}</text>
      <text x="100" y="104" textAnchor="middle" className="g-cap">of {max} slots</text>
    </svg>
  </figure>;
}

export function Positions() {
  const s = useAppState(); const { open } = useSheets(); const { toast } = useUi();
  const auto = useAutoBook(); const mine = useLiveBook();
  const [openId, setOpenId] = useState<string | null>(null); const [f, setF] = useState<Filter>('all'); const [allLog, setAllLog] = useState(false); const [scopeSel, setScope] = useState<'all' | 'engine' | 'mine'>('all');
  const outcomes = auto.ledger.data?.ledger.outcomes;
  // a copy of a pick the engine book already holds is the same trade at another rupee size: never listed or counted twice. Retired engines are out of every list. Both stay in the saved data.
  const isDup = (p: { sym: string; engine: string; asOf: string }) => !!auto.plan?.taken.some((t) => t.pick.sym === p.sym && t.pick.engine === p.engine && t.pick.asOf === p.asOf);
  const isGone = (p: { engine: string }) => ENGINES.some((e) => e.id === p.engine && e.retired);
  const myRows = mine.rows.filter((r) => !isDup(r.p) && !isGone(r.p));
  const dups = mine.rows.filter((r) => isDup(r.p) && !isGone(r.p)).length; const retired = mine.rows.filter((r) => isGone(r.p)).length;
  const everyItem: Item[] = [...auto.rows.map((r) => ({ r, owner: 'engine' as const, outcome: outcomes?.[r.p.id] ?? null })), ...myRows.map((r) => ({ r, owner: 'you' as const, outcome: null }))];
  /* 12 Nov 2026 (2.1): the engine book and the plans you took are two scopes, never one list under one heading. The switch appears only when you have your own positions. */
  const hasMine = myRows.length > 0; const scope = hasMine ? scopeSel : 'engine';
  const items: Item[] = everyItem.filter((x) => scope === 'all' || (scope === 'engine') === (x.owner === 'engine'));
  if (auto.ledger.loading && !auto.plan && !myRows.length) return <Loading what="the paper book" />;

  const isActive = (x: Item) => x.r.v.status === 'open' || x.r.v.status === 'pending' || x.r.v.status === 'waiting';
  const active = byAttention(items.filter(isActive), attnOf);
  const nearOf = new Map(active.map((x) => [x.r.p.id, nearWord(attention(attnOf(x)))])); const near = new Map([...nearOf].map(([k, v]) => [k, v?.kind ?? null]));
  const mineDone = byAttention(items.filter((x) => x.owner === 'you' && !isActive(x)), attnOf);
  const engineDone = items.filter((x) => x.owner === 'engine' && x.r.v.status === 'closed').length; const engineSkipped = items.filter((x) => x.owner === 'engine' && x.r.v.status === 'skipped').length;
  const openRows = active.filter((x) => x.r.v.status === 'open'); const waiting = active.length - openRows.length;
  const mineSum = summarize(myRows.map((r) => r.v));
  const led = auto.ledger.data?.ledger ?? null; const fig = led ? figuresOf(led) : null;
  const lv = led && auto.plan ? buildLedgerView(led, auto.plan, myRows) : null;   // 12 Nov 2026: every count on this page reads this one view (ledgerview.ts)
  const snap = snapshotOf(items.map((x) => ({ p: x.r.p, v: x.r.v, dayPnl: x.r.dayPnl, markT: x.r.markT, owner: x.owner })), scope === 'mine' ? mine.cost : auto.cost, led?.updated ?? null);   // ONE snapshot: the strip, the table and the moved row read it
  setCurrentSnapshotId(snap.id);
  const through = led && scope !== 'mine' ? throughOf(led, Date.now()) : null;
  /* 12 Nov 2026 (Codex on #62): the quote status and session follow the SELECTED scope, never the engine book by default. "My paper plans" reads its own quotes; "Both" shows the least fresh of the two words. */
  const WORD_ORDER = ['Live', 'Delayed', 'Last traded', 'Unavailable']; const worse = (a: string | null | undefined, b: string | null | undefined) => (a == null ? b ?? null : b == null ? a : WORD_ORDER.indexOf(b) > WORD_ORDER.indexOf(a) ? b : a);
  const fromMine = scope === 'mine' || !auto.rows.length;
  const priceWord = scope === 'mine' ? mine.priceWord : scope === 'engine' ? auto.priceWord : (auto.rows.length && myRows.length ? worse(auto.priceWord, mine.priceWord) : auto.priceWord ?? mine.priceWord);
  const session = fromMine ? mine.session : auto.session; const intra = fromMine ? mine.intra : auto.intra; const bars = fromMine ? mine.bars : auto.bars;
  const live = session.phase === 'open';
  const engines = ENGINES.filter((e) => !e.retired && active.some((x) => x.r.p.engine === e.id));
  const shown = active.filter((x) => f === 'all' ? true : f === 'stop' ? near.get(x.r.p.id) === 'stop' : f === 'target' ? near.get(x.r.p.id) === 'target' : f === 'you' ? x.owner === 'you' : x.r.p.engine === f);
  const count = (g: Filter) => active.filter((x) => g === 'stop' ? near.get(x.r.p.id) === 'stop' : g === 'target' ? near.get(x.r.p.id) === 'target' : g === 'you' ? x.owner === 'you' : x.r.p.engine === g).length;
  const chips: { id: Filter; label: string; n: number }[] = [{ id: 'all', label: 'All', n: active.length }, { id: 'stop', label: 'Near stop', n: count('stop') }, { id: 'target', label: 'Near target', n: count('target') },
    ...engines.map((e) => ({ id: e.id as Filter, label: shortEngine(e.id), n: count(e.id) })), ...(active.some((x) => x.owner === 'you') ? [{ id: 'you' as Filter, label: 'Yours', n: count('you') }] : [])];
  const toggle = (id: string) => setOpenId(openId === id ? null : id);
  /** open a row from the strip or the table: show it in the list, expand it, bring it into view */
  const focusRow = (id: string) => { setF('all'); setOpenId(id); requestAnimationFrame(() => document.querySelector(`[data-pos="${id}"]`)?.scrollIntoView({ block: 'center' })); };
  const card = (x: Item) => <TradeCard key={x.r.p.id} r={x.r} outcome={x.outcome} owner={x.owner} near={nearOf.get(x.r.p.id) ?? null} cost={x.owner === 'engine' ? auto.cost : mine.cost} expanded={openId === x.r.p.id} onToggle={() => toggle(x.r.p.id)} live={live}
    onHide={x.owner === 'you' ? () => { setState((st) => archivePaper(st, x.r.p.id)); toast('Taken off the active list. The record is kept.'); } : undefined} />;
  const log = auto.plan?.log ?? []; const shownLog = allLog ? log : log.slice(0, 25);
  const hidden = s.paper.filter((p) => p.closedByUser).length;

  return <div className="bk" data-positions>
    {auto.ledger.err && <p className="note" role="status">{auto.plan ? auto.ledger.err : `The engine book could not be read (${auto.ledger.err}). This does not mean it is empty or that positions have exited.`} <button className="btn sm" onClick={auto.ledger.retry}>Refresh record</button></p>}
    {auto.rows.some((r) => r.v.dataNote) && <p className="note" role="status" data-history-warning>{HISTORY_WARNING} Marks shown are last recorded values where the history is incomplete.</p>}

    <section className="bk-strip l4" aria-label="The paper book now" data-strip data-snapshot={snap.id}>
      <TrustRow snap={snap} scope={scope} onScope={setScope} hasMine={hasMine} throughWord={through?.outcomes.day ? through.outcomes.word : null} priceWord={items.length ? priceWord : null} />
      <TotalRow snap={snap} dayLabel={live ? 'Today' : 'Last session'} />
      <MovedRow snap={snap} onRow={focusRow} />
      {openRows.length > 0 || auto.slots > 0 ? <div className="l4-support">
        <SlotGauge used={auto.slots} max={auto.cfg.maxOpen} />
        <div className="bk-fig bk-open"><span className="k">Open positions</span><b className="num">{openRows.length}</b>{waiting ? <span className="bk-note">{waiting} awaiting entry, at the next open</span> : null}</div>
        {(lv || auto.ledger.loading) && <div className="bk-fig bk-closed"><span className="k">Closed book positions</span>{!lv ? <span className="sk" style={{ display: 'block', height: 36, width: '60%' }} aria-label="Loading the record" /> : <b className="num" data-book-closed>{bookClosedCount(lv)}</b>}</div>}
      </div> : <p className="bk-none small" data-no-open>No open positions yet{waiting ? ` · ${waiting} awaiting entry, at the next open` : ''}{lv && bookClosedCount(lv) > 0 ? ` · ${bookClosedCount(lv)} closed` : ''}</p>}
      {intra.err && <p className="small down bk-err">Live prices are unavailable: {intra.err}. {bars.data ? 'Showing the last daily bars.' : 'Nothing is estimated in their place.'}</p>}
    </section>
    <ThroughPills through={led ? throughOf(led, Date.now()) : null} />
    <HitCard hits={auto.hits} />

    {!active.length ? (auto.ledger.err && !auto.plan ? null : <div className="bk-empty"><a className="btn" href="#/signals?v=picks">See the picks</a></div>) : <>
      <div className="bk-filters" role="group" aria-label="Show positions">{chips.map((c) => <button key={c.id} type="button" className="chip bk-chip" aria-pressed={f === c.id} onClick={() => setF(c.id)} disabled={c.n === 0 && c.id !== 'all'}>{c.label} <span className="num">{c.n}</span></button>)}</div>
      <div className="bk-board ds-stagger" role="list" aria-label="Positions">{shown.map((x) => <div role="listitem" key={x.r.p.id}>{card(x)}</div>)}</div>
      {!shown.length && <p className="small dim">No position matches this filter.</p>}
    </>}

    <PnlTable snap={snap} onRow={focusRow} live={live} />

    {mineDone.length > 0 && <details className="more bk-fold"><summary>Your finished trades · {mineDone.length}</summary><div className="bk-board">{mineDone.map(card)}</div>
      {mineSum.closed > 0 && <p className="small">Closed: <b className="num">{Rw(mineSum.totalR)}</b> over {mineSum.closed} trade{mineSum.closed === 1 ? '' : 's'}.{!mineSum.enough ? <span className="dim"> Average R is withheld until 30 have closed.</span> : null}</p>}</details>}
    {(engineDone > 0 || engineSkipped > 0) && <p className="small mute">{engineDone ? <>{lv ? bookClosedWord(lv) : `${engineDone} closed book position${engineDone === 1 ? '' : 's'}`}: <a href="#/signals?v=record">the Record</a> lists the wider set of resolved observations.</> : null}{engineSkipped ? ` ${engineSkipped} pick${engineSkipped === 1 ? ' was' : 's were'} skipped at the open and never counted.` : ''}{lv ? <span data-partition> {partitionWord(lv)}</span> : null}</p>}
    {(dups + retired > 0 || hidden > 0) && <p className="small mute">{dups + retired > 0 ? `${dups + retired} older ${dups + retired === 1 ? 'entry of yours is' : 'entries of yours are'} not shown or counted: ${[dups ? `${dups} duplicate${dups === 1 ? '' : 's'} of the engine book` : '', retired ? `${retired} from a retired engine` : ''].filter(Boolean).join(', ')}. ` : ''}{hidden ? `${hidden} hidden by you. ` : ''}They stay in your backup.</p>}

    <details className="more bk-fold" data-attr-fold><summary>Where the P&L came from · by engine and position</summary>
      <PnlAttribution rows={auto.rows.map((r) => ({ id: r.p.id, sym: r.p.sym, engine: r.p.engine, status: r.v.status, pnl: r.v.pnl, r: r.v.r, split: splitOfRow(r, auto.cost) }))} nameOf={engineName} /></details>
    <details className="more bk-fold"><summary>Book log · {log.length} entr{log.length === 1 ? 'y' : 'ies'}</summary>
      {log.length ? <div className="list">{shownLog.map((e) => <div key={e.kind + e.id} className="li" style={{ alignItems: 'flex-start' }}>
        <span className={`tag ${e.kind === 'closed' ? 'lime' : e.kind === 'refused' || e.kind === 'skipped' ? 'peach' : ''}`} style={{ flex: 'none', minWidth: 60, justifyContent: 'center' }}>{dayWord(e.day).replace(/^\w+ /, '')}</span>
        <span className="grow small">{e.text}</span></div>)}
        {log.length > 25 && !allLog && <button className="btn sm" onClick={() => setAllLog(true)}>Show all {log.length} entries</button>}</div> : <p className="small dim">Nothing has happened yet.</p>}</details>
    <p className="small mute bk-about" data-method><a href="#/info?s=book">How the paper book works</a> · <button type="button" className="linkbtn" onClick={() => open({ k: 'plan' })}>Open the position sizer</button></p>
  </div>;
}
