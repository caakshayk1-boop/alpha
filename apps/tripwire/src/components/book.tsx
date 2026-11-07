// The paper book's components: the target ladder, the position card and the target-hit card. Styles: book.css (motion under html.fx only). Logic: ../ladder.ts (pure, unit-tested).
// Paper only. Nothing here advises, predicts or follows anything for anyone.
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Icon } from '../ui.tsx';
import { inr } from '../fmt.ts';
import { ladderModel, shortDay, type LadderInput, type LadderModel } from '../ladder.ts';
import { bookingKey, markSeen, newBookings, pageStore } from '../bookingseen.ts';
import { StatusPill, Pill, type Tone } from './pills.tsx';
import { TweenNumber } from './layout.tsx';
import type { HitAlert } from '../alerts.ts';
import type { Through } from '../recordview.ts';

const price = (x: number) => inr(x);

/** Entry, stop, T1, T2 and the price now on one horizontal rule. The levels are the booked ones (entry-based R); a hit target is filled and carries its date; after T1 the stop's move to the fill is drawn;
 *  a reference-only target says so in words. Pass `input` (see `ladderInputFor`) or a ready `model`. `isNew` names the bookings to sweep once when motion is on.
 *  `<TargetLadder sym="TCS" input={ladderInputFor(p, v, outcome)} />` */
/** `quiet`: leave out the generic "levels are worked from the signal close" note, for a list that states it once above all of its cards. The basis stays on every card in the figures' own label. */
export function TargetLadder({ sym, input, model: given, isNew, quiet }: { sym: string; input?: LadderInput; model?: LadderModel; isNew?: ReadonlySet<'t1' | 't2'>; quiet?: boolean }) {
  const m = useMemo(() => given ?? (input ? ladderModel(input) : null), [given, input]);
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = root.current; if (!el) return;
    const place = () => {
      const labels = [...el.querySelectorAll<HTMLElement>('.tl-tick .lab')].map((lab) => ({ lab, box: lab.getBoundingClientRect() })).sort((a, b) => a.box.left - b.box.left);
      const ends: number[] = []; let height = 0;
      for (const { lab, box } of labels) {
        let row = ends.findIndex((right) => box.left >= right + 8); if (row < 0) row = ends.length;
        ends[row] = box.right; height = Math.max(height, box.height);
        lab.parentElement!.style.setProperty('--label-row', String(row));
      }
      el.style.setProperty('--rows', String(Math.max(1, ends.length)));
      if (height) el.style.setProperty('--rowh', `${height + 8}px`);
    };
    place(); const ro = new ResizeObserver(place); ro.observe(el);
    el.querySelectorAll('.lab').forEach((lab) => ro.observe(lab));
    return () => ro.disconnect();
  }, [m]);
  if (!m) return null;
  const rows = m.ticks.some((t) => t.row === 1) ? 2 : 1; const dated = m.ticks.some((t) => t.hit && t.day);
  const mk = m.marker; const entryPos = m.ticks.find((t) => t.id === 'entry')?.pos ?? 0;
  const edge = (p: number) => (p < 16 ? 'l' : p > 84 ? 'r' : '');
  return <div ref={root} className={`tl ${m.reference ? 'is-ref' : ''}`} data-ladder data-basis={m.basis} data-ref={m.reference ? '1' : undefined} style={{ ['--rows' as string]: rows, ['--lines' as string]: dated ? 3 : 2 }}>
    <div className="tl-vis" role="img" aria-label={`${sym} ladder. ${m.summary}`}>
      <div className="tl-rule" />
      {m.fill && <i className={`tl-fill ${m.fill.tone} ${isNew?.size ? 'sweep' : ''}`} style={{ left: `${m.fill.from}%`, width: `${m.fill.to - m.fill.from}%` }} />}
      {m.ratchet && <i className="tl-ratchet" style={{ left: `${m.ratchet.from}%`, width: `${m.ratchet.to - m.ratchet.from}%` }} />}
      {m.ticks.map((t) => <div key={t.id} className={`tl-tick ${t.id} ${t.hit ? 'hit' : ''} ${t.ref ? 'ref' : ''} ${t.moved ? 'moved' : ''} ${t.hit && isNew?.has(t.id as 't1' | 't2') ? 'fresh' : ''} row${t.row} ${edge(t.pos)}`} style={{ left: `${t.pos}%` }}>
        <i className="pin">{t.hit && <Icon n="check" />}</i>
        <span className="lab"><b>{t.label}</b><em className="num">{price(t.px)}</em>{t.hit && t.day && <small>{shortDay(t.day)}</small>}</span>
      </div>)}
      {mk && <div className={`tl-mk-track ${edge(mk.pos)}`} style={{ ['--p' as string]: mk.pos, ['--e' as string]: entryPos }}>
        <div className={`tl-marker ${mk.kind} ${m.fill?.tone ?? ''}`} style={{ left: `${mk.pos}%` }}><span className="tip"><small>{mk.kind === 'exit' ? 'Exit' : 'Now'}</small><b className="num">{price(mk.px)}</b></span><i className="dot" /></div>
      </div>}
    </div>
    {(() => { const ns = quiet ? m.notes.filter((n) => !/^Levels are worked from the signal close/.test(n)) : m.notes; return ns.length > 0 && <ul className="tl-notes">{ns.map((n) => <li key={n}>{n}</li>)}</ul>; })()}
  </div>;
}

export interface PositionCardProps {
  id: string; sym: string; name?: string | null;
  /** quiet pills: the engine, the holding style, a trend tag */
  tags?: ReactNode;
  status: { label: string; tone: Tone };
  /** the price now (open) or the exit (closed); null while there is none */
  price: { label: string; value: number | null; sub?: ReactNode } | null;
  /** fill, for the one-line journey "₹1,961.96 → ₹2,200.00" */
  entry: number | null;
  pnl: number | null; r: number | null; pct: number | null;
  /** the ladder, or null (skipped, or levels that cannot be worked out) */
  ladder: LadderInput | null;
  /** one line under the header: shares, signal, stop, limit, or why it was skipped */
  line?: ReactNode;
  timeline?: ReactNode;
  expanded: boolean; onToggle: () => void;
  /** the details that open under the card */
  children?: ReactNode;
  /** a position that is still open or waiting is drawn live; a closed one in its completed state */
  closed?: boolean;
  tabIndexHead?: number;
}
const sgn = (v: number | null | undefined, f: (n: number) => string) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${f(Math.abs(v))}`);
const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const rFmt = (n: number) => n.toFixed(2);

/** One position, as a card: symbol and company, the entry-to-price journey, the target ladder, and P&L in rupees and R set large. The header is the one control; it opens the details passed as children.
 *  Rupee figures carry `.amt` so the privacy switch blurs them. `<PositionCard id sym name status price entry pnl r pct ladder expanded onToggle>{details}</PositionCard>` */
export function PositionCard(p: PositionCardProps) {
  const model = useMemo(() => (p.ladder ? ladderModel(p.ladder) : null), [p.ladder]);
  // bookings new since the last visit sweep once; everything shown is then remembered
  const keys = useMemo(() => (p.ladder && !p.ladder.reference ? ([['T1', p.ladder.t1Hit, p.ladder.t1Day], ['T2', p.ladder.t2Hit, p.ladder.t2Day]] as const).filter(([, h, d]) => h && d).map(([k, , d]) => ({ k, key: bookingKey(p.id, k, d as string) })) : []), [p.ladder, p.id]);
  const fresh = useRef<Set<'t1' | 't2'> | null>(null);
  if (fresh.current == null) { const st = pageStore(); const nb = st ? newBookings(keys.map((x) => x.key), st) : new Set<string>(); fresh.current = new Set(keys.filter((x) => nb.has(x.key)).map((x) => x.k.toLowerCase() as 't1' | 't2')); }
  useEffect(() => { const st = pageStore(); if (st) markSeen(keys.map((x) => x.key), st); }, [keys]);
  const up = (p.pnl ?? 0) > 0 ? 'up' : (p.pnl ?? 0) < 0 ? 'down' : '';
  /* a position the paper book never took has a result in R but no rupee figure: say so rather than print a rupee zero */
  const rOnly = p.pnl == null && p.r != null && !!p.closed; const upR = (p.r ?? 0) > 0 ? 'up' : (p.r ?? 0) < 0 ? 'down' : '';
  return <article className={`pcard ${p.closed ? 'is-closed' : ''}`} data-pos={p.id} data-status={p.status.label} aria-label={`${p.sym}${p.name ? `, ${p.name}` : ''}`}>
    <button type="button" className="tcard-head pc-head" aria-expanded={p.expanded} onClick={p.onToggle}>
      <span className="pc-top"><span className="pc-id"><span className="pc-sym">{p.sym}</span>{p.name && <span className="pc-name">{p.name}</span>}</span><StatusPill tone={p.status.tone}>{p.status.label}</StatusPill></span>
      {p.tags && <span className="pc-tags">{p.tags}</span>}
      {p.price ? <span className="pc-nums">
        <span className="pc-px"><span className="k">{p.price.label}</span><b className="num pc-big">{p.price.value != null ? price(p.price.value) : "—"}</b>
          <span className="pc-journey num">{p.entry != null && p.price.value != null ? <>Entry {price(p.entry)} <span aria-hidden="true">→</span><span className="sr"> to </span> {price(p.price.value)}</> : p.entry != null ? `Entry ${price(p.entry)}` : null}</span>
          {p.price.sub}</span>
        {rOnly ? <span className="pc-pnl"><span className="k">Result (paper)</span>
          <b className={`num pc-big ${upR}`}><TweenNumber value={p.r!} format={(n) => `${sgn(Math.round(n * 100) / 100, rFmt)}R`} /></b>
          <span className="pc-r num"><span className="dim">{p.pct == null ? '—' : `${sgn(p.pct, (n) => n.toFixed(2))}%`} · not in the paper book</span></span></span>
        : <span className="pc-pnl"><span className="k">P&L (paper)</span>
          <b className={`num amt pc-big ${up}`}>{p.pnl == null ? '—' : <TweenNumber value={p.pnl} format={(n) => sgn(Math.round(n), money)} />}</b>
          <span className={`pc-r num ${up}`}>{p.r == null ? '—' : <TweenNumber value={p.r} format={(n) => `${sgn(Math.round(n * 100) / 100, rFmt)}R`} />}<span className="dim"> · {p.pct == null ? '—' : `${sgn(p.pct, (n) => n.toFixed(2))}%`}</span></span></span>}
      </span> : null}
      {p.timeline}
      {p.line && <span className="pc-line num">{p.line}</span>}
      <Icon n="chev" className="pc-chev" />
    </button>
    {model && <TargetLadder sym={p.sym} model={model} isNew={fresh.current} />}
    {p.expanded && p.children && <div className="pc-more">{p.children}</div>}
  </article>;
}

/** A target that filled in the last completed session, as a card: the position, T1 "half booked" or T2 "position closed", the level, the fill price and the day. Paper positions only; nothing is sent to anyone.
 *  Used at the top of the Book. (Today still embeds its own list; swap it for this when that screen is restyled.) `<HitCard hits={auto.hits} />` */
export function HitCard({ hits, id = 'bk-hits' }: { hits: readonly HitAlert[]; id?: string }) {
  if (!hits.length) return null;
  const session = hits[0].session;
  return <section className="hitcard" aria-labelledby={id} data-sec="hits">
    <h2 id={id}>Targets hit at the close of {shortDay(session)}</h2>
    <ul>{hits.map((a) => <li key={`${a.id}|${a.kind}`} data-hit={a.kind}>
      <a href={`#/c/${a.sym}`}><span className="hc-top"><span className="pc-sym">{a.sym}</span><Pill>{a.engine}</Pill><StatusPill tone={a.kind === 'T2' ? 'up' : 'neutral'} icon="check">{a.text}</StatusPill></span>
        <span className="hc-fig num">{a.kind} {price(a.level)} · filled at {price(a.price)} · {shortDay(a.session)}</span></a></li>)}</ul>
    <p className="hc-note">Paper positions only. This list is worked out from the book each time the page loads; nothing is sent to you.</p>
  </section>;
}

const THROUGH_TONE: Record<string, Tone> = { current: 'up', pending: 'neutral', stale: 'amber', unknown: 'amber', missing: 'amber' };
/** "Picks through Fri 30 Oct" and "Outcomes through Fri 30 Oct": the two stages of the nightly record, each judged by the one freshness module. When the outcomes trail the picks it says so in words.
 *  Reads `throughOf(ledger, now)`; renders nothing without one. `<ThroughPills through={throughOf(ledger, Date.now())} />` */
export function ThroughPills({ through }: { through: Through | null }) {
  if (!through) return null;
  const one = (what: string, l: Through['picks']) => <StatusPill key={what} tone={THROUGH_TONE[l.status] ?? 'amber'} icon={l.status === 'current' ? 'check' : 'clock'} title={l.behind ? `${l.behind} session${l.behind === 1 ? '' : 's'} behind the last finished NSE session` : undefined}>{l.day ? `${what} through ${l.word}` : `${what}: none yet`}</StatusPill>;
  return <div className="rec-through" data-through role="group" aria-label="How current the record is">
    {one('Picks', through.picks)}{one('Outcomes', through.outcomes)}
    {!through.agree && through.lag ? <p className="rec-line" style={{ flexBasis: '100%' }}>Outcomes trail the picks by {through.lag} session{through.lag === 1 ? '' : 's'}. A position's price and any target it filled may be older than its pick.</p> : null}
  </div>;
}
