import { SessionPill } from '../components/pills.tsx';
import { useEffect, useMemo, useState } from 'react';
import { go, setState, useAppState, useSheets } from '../app.tsx';
import { Loading, Failed, PageBar } from './common.tsx';
import { freshness } from '../fresh.ts';
import { FreshnessPill } from './FreshnessPill.tsx';
import { istDay, reviewDue, current } from '../store.ts';
import { dayWord, initials, inr, inr0, pct, tone } from '../fmt.ts';
import { useEngines } from '../useEngines.ts';
import { ACTIVE, ENGINES } from '../quant.ts';
import type { Row } from '../screen.ts';
import { useBacktest, usePulse } from '../data.ts';
import { evidenceHeadline } from '../evidence.ts';
import { isNewUser } from '../home.ts';
import { livePrice, useLiveSymbols } from '../quotes.ts';
import { useAutoBook, useLiveBook } from '../book.ts';
import { useMacro, MACRO, fmtMacro } from '../macro.ts';
import { LiveBadge, Observed, Spark, Tick } from '../live.tsx';
import { Ring, avatarStyle } from '../widgets.tsx';
import { mood } from '../mood.ts';
import { Icon } from '../ui.tsx';
import { sessionNow } from '../market.ts';
import { rulesFor } from '../rules.ts';
import { isLiveQuote } from '../stamp.ts';
import { pickFacts, factLine } from '../pickfacts.ts';
import { BASIS_NOTE, targetPrices } from '../levels.ts';
import { pickId } from '../ledger.ts';
import { alertLine, type HitAlert } from '../alerts.ts';
import { briefLines } from '../brief.ts';
import { useTrendSummary } from '../trendsummary.ts';
import { WhatMattersNowSlot } from '../todaynews.tsx';
import { SinceVisit } from './SinceVisit.tsx';

const money = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);
const TOP = 5;
const addDays = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

/** Positions whose Target 1 or Target 2 filled in the last completed session. Small and plain on purpose; nothing is sent to anyone. */
function TargetHits({ hits }: { hits: HitAlert[] }) {
  const session = hits[0].session;
  return <section className="tsec card thits" aria-labelledby="t-hits" data-sec="hits">
    <h2 id="t-hits" className="sec">Targets hit at the close of {dayWord(session)}</h2>
    <ul className="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>{hits.map((a) => <li key={`${a.id}|${a.kind}`} className="li" data-hit={a.kind}>
      <a className="grow" href={`#/c/${a.sym}`}><span className="sym">{a.sym}</span> <span className="tag">{a.engine}</span> <b className="up">{a.text}</b>
        <span className="small dim num" style={{ display: 'block' }}>{a.kind} {inr(a.level)} · filled at {inr(a.price)}</span></a></li>)}</ul>
    <p className="small mute" style={{ margin: '6px 0 0' }} title={hits.map(alertLine).join(' ')}>Paper positions only. This list is worked out from the book each time the page loads; nothing is sent to you.</p>
  </section>;
}

/** Today, in the order of what a person needs: the market in a paragraph, what matters now, what changed in the companies they follow and what is due,
 *  the paper book in one card, and the last close's picks. Detail lives behind links: Markets (indices, commodities, trend map), Signals, Live P&L. */
export function Today() {
  const s = useAppState(); const { open } = useSheets();
  const { scr, out } = useEngines();
  const rows = useMemo(() => scr.data?.rows ?? [], [scr.data]); const day = scr.data?.as_of ?? null; const fr = freshness(day); const today = istDay();
  const fresh = isNewUser(s);   // a new user gets the setup card and the brief; the book, picks, news and changes need something of theirs to be about
  const pulse = usePulse(true); const book = useLiveBook(!fresh); const auto = useAutoBook(!fresh); const macro = useMacro();
  const anyLive = pulse.data ? Object.values(pulse.data.quotes).some((q) => isLiveQuote(q)) : null;
  const sess = sessionNow(Date.now(), anyLive); const live = sess.phase === 'open' && !!anyLive;
  const t = useTrendSummary(rows, day, true);
  const chOf = (k: string) => { const q = pulse.data?.quotes[k]; return q ? (q.px / q.prev - 1) * 100 : null; };
  const niftyCh = chOf('NIFTY'), bankCh = chOf('BANKNIFTY'), vixCh = chOf('VIX'); const md = mood(niftyCh, bankCh, vixCh);
  const lines = briefLines({ niftyCh, bankCh, vixCh, upPct: t.upPct, downPct: t.downPct, nTrend: t.map.n, day, behind: fr.behind, live });
  const events = s.follows.map((sym) => rows.find((r) => r.sym === sym)).filter((r): r is Row => !!r && !!r.next_earnings && r.next_earnings >= today && r.next_earnings <= addDays(today, 30)).sort((a, b) => a.next_earnings!.localeCompare(b.next_earnings!));
  const reviews = s.entries.filter((e) => ['overdue', 'today'].includes(reviewDue(e) ?? ''));
  const needs = reviews.length > 0 || events.length > 0;
  // the paper book, once: what the auto book holds and what was taken by hand. Never presented as the user's watchlist.
  const dupOf = (p: { sym: string; engine: string; asOf: string }) => !!auto.plan?.taken.some((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf);
  const ownRows = book.rows.filter((r) => !dupOf(r.p) && !ENGINES.some((e) => e.id === r.p.engine && e.retired)); const ownOpen = ownRows.filter((r) => r.v.status === 'open');
  const ownPnl = ownOpen.reduce((a, r) => a + (r.v.pnl ?? 0), 0); const showAuto = auto.rows.length > 0;
  const openN = (showAuto ? auto.sum.open : 0) + ownOpen.length; const pnl = (showAuto ? auto.sum.openPnl : 0) + ownPnl;
  const autoState = (p: { sym: string; engine: string; asOf: string }) => dupOf(p) ? 'in' : auto.plan?.refused.find((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf)?.why ? 'no' : 'wait';
  const allPicks = (out?.runs ?? []).flatMap((r) => r.picks).sort((a, b) => b.score - a.score); const shownPicks = allPicks.slice(0, TOP);
  const pickSyms = shownPicks.map((p) => p.sym); const pickQ = useLiveSymbols(pickSyms, !fresh && pickSyms.length > 0);
  const hasChanges = s.follows.length > 0 || needs;
  const hold = !fresh && s.follows.length > 0 && scr.loading;   // what changed leads, so nothing is drawn beneath it until it can be: content that arrives above moves what is already there   // returning users read what changed before the market
  const bt = useBacktest(); const evHead = evidenceHeadline(ACTIVE.map((e) => e.id), bt.data, bt.loading);
  // the news is drawn one frame later so opening Today paints at once; its slot is reserved so nothing below it moves
  const [late, setLate] = useState(false); useEffect(() => { const x = window.setTimeout(() => setLate(true), 60); return () => window.clearTimeout(x); }, []);
  const macroLine = ['GOLD', 'BRENT', 'USDINR'].map((k) => MACRO.find((d) => d.key === k)).filter((d): d is NonNullable<typeof d> => !!d).map((d) => { const q = macro.data?.quotes[d.key]; return q ? { k: d.label, v: fmtMacro(d, q.px), ch: (q.px / q.prev - 1) * 100 } : null; }).filter(Boolean) as { k: string; v: string; ch: number | null }[];

  return <div>
    <PageBar title="Today" sub={<><span className={sess.phase === 'open' ? 'up' : ''}>{sess.label}</span> · {sess.detail}</>} right={<button className="icon-btn" aria-pressed={!!s.prefs.hideAmounts} aria-label={s.prefs.hideAmounts ? 'Show my amounts' : 'Hide my amounts'} onClick={() => { setState((x) => ({ ...x, prefs: { ...x.prefs, hideAmounts: !x.prefs.hideAmounts } })); }}><Icon n={s.prefs.hideAmounts ? 'eyeoff' : 'eye'} /></button>} />
    <div className="today">
      <FreshnessPill />
      {/* (0) target hits in the last completed session: only when there are some, and only ever a list computed from the book on this page load */}
      {auto.hits.length > 0 && <TargetHits hits={auto.hits} />}

      {/* a new user: one action. Nothing here is a count of something that does not exist yet. */}
      {fresh && <section className="tsec card setup" aria-labelledby="t-setup" data-sec="setup">
        <h2 id="t-setup" className="sec">Start with one company</h2>
        <p className="dim" style={{ margin: '6px 0 12px' }}>Search a listed company, read the case and the countercase side by side, and save a thought if you want to. Nothing is followed for you.</p>
        <button className="btn pri" onClick={() => open({ k: 'search' })}>Find a company</button>
      </section>}

      {/* the followed companies: what changed, and what is due. Rendered only when there is something it can be about. */}
      {!fresh && hasChanges && <div className="tsec tchg" data-sec="changes">
        {scr.loading && s.follows.length > 0 && <Loading what="the market read" />}
        {scr.err && <Failed what="the market data" err={scr.err} retry={scr.retry} />}
        {scr.data && s.follows.length > 0 && <SinceVisit rows={rows} day={day} today={today} />}
        {scr.data && needs && <section className="needs" aria-labelledby="t-needs"><h2 id="t-needs" className="sec">Due for review</h2><div className="card" style={{ padding: '2px 14px' }}><div className="list">
          {reviews.map((e) => <button key={e.id} className="li" style={{ textAlign: 'left', width: '100%' }} onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}><span className="tag peach">{reviewDue(e) === 'overdue' ? 'Overdue' : 'Today'}</span><span className="grow"><span className="sym">{e.sym}</span><span className="dim small trunc" style={{ display: 'block' }}>Review: {current(e).trigger || current(e).thesis}</span></span></button>)}
          {events.map((r) => <a key={r.sym} className="li" href={`#/c/${r.sym}`}><span className="tag">{dayWord(r.next_earnings)}</span><span className="grow"><span className="sym">{r.sym}</span><span className="dim small" style={{ display: 'block' }}>Results, estimated date</span></span></a>)}
        </div></div></section>}
      </div>}

      {/* (a) the market, in a paragraph of measured facts, with its freshness stated */}
      {!hold && <section className="tsec brief card" aria-labelledby="t-brief" data-sec="brief">
        <div className="row between brief-top"><h2 id="t-brief" className="sec">Your market brief</h2><span className="row small" style={{ gap: 8 }}><LiveBadge live={live} label={live ? 'LIVE' : sess.phase === 'open' ? 'No live print' : sess.phase === 'pre' ? 'Pre-open' : 'Market closed'} />{md && <span className="tag" title="A description of today's move from the Nifty, Bank Nifty and VIX. Not a forecast.">Mood {md.word}</span>}</span></div>
        <p className="brief-text" data-brief>{lines.length ? lines.join(' ') : scr.loading ? 'Reading the market…' : 'No market figures are available right now.'}</p>
        <div className="brief-ix num" role="list" aria-label="Indices">
          {([['Nifty 50', 'NIFTY', 2], ['Bank Nifty', 'BANKNIFTY', 0], ['India VIX', 'VIX', 2]] as const).map(([nm, k, d]) => { const q = pulse.data?.quotes[k]; const ch = chOf(k); return <a role="listitem" key={k} href="#/markets" className="bix"><span className="small dim">{nm}</span><b><Tick v={q?.px}>{q ? q.px.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'}</Tick></b><span className={`small ${k === 'VIX' ? (ch == null ? '' : ch > 0 ? 'down' : 'up') : tone(ch)}`}>{ch == null ? '—' : pct(ch, 2)}</span></a>; })}
        </div>
        <div className="small dim brief-macro num" aria-label="Commodities and the rupee">{(macroLine.length ? macroLine : [{ k: 'Gold', v: '—', ch: null }, { k: 'Brent oil', v: '—', ch: null }, { k: 'USD / INR', v: '—', ch: null }]).map((m) => <span key={m.k}><span>{m.k}</span><b className="tx">{m.v}</b><span className={tone(m.ch)}>{m.ch == null ? '—' : pct(m.ch, 1)}</span></span>)}</div>
        <p className="small mute brief-fresh">Prices: <Observed sec={pulse.obs} err={pulse.err} /> · Screen: close of {dayWord(day)} <SessionPill asOf={day} /> · times in IST · <a href="#/markets">Markets, indices, trend map</a>{fresh && <> · <a href="#/news">Market news</a></>} · <a href="#/data">Data and coverage</a></p>
      </section>}

      {/* (b) what matters now */}
      {!fresh && !hold && <section className="tsec tnews" aria-label="What matters now" data-sec="news">
        <div className="newsslot">{late && <WhatMattersNowSlot syms={s.follows} />}</div>
      </section>}

      {/* (d) the paper book, one card */}
      {!fresh && scr.data && (showAuto || ownRows.length > 0) && <section className="tsec tbook" aria-labelledby="t-book" data-sec="book">
        <h2 id="t-book" className="sec">Paper book</h2>
        <div className="card bookcard">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div><div className={`num amt bigpnl ${tone(pnl)}`}><Tick v={openN ? pnl : null}>{openN ? money(pnl) : '—'}</Tick></div><div className="small dim">{openN ? `open now · ${openN} position${openN === 1 ? '' : 's'}` : 'nothing open'}{showAuto && auto.sum.waiting ? ` · ${auto.sum.waiting} waiting for the next open` : ''}</div></div>
            {showAuto && <Ring value={auto.slots} max={auto.cfg.maxOpen} size={52} stroke={6} label={`${auto.slots} of ${auto.cfg.maxOpen} places in use`} color="var(--a2)"><Tick v={auto.slots}>{String(auto.slots)}</Tick></Ring>}</div>
          {showAuto && auto.sum.closed > 0 && <p className="small dim" style={{ margin: '8px 0 0' }}>Realised so far: <b className={`num amt ${tone(auto.sum.closedPnl)}`}>{money(auto.sum.closedPnl)}</b> over {auto.sum.closed} closed. Paper money only.</p>}
          <div className="row bookact"><a className="btn sm" href="#/live">Live P&amp;L</a><a className="btn sm" href="#/signals?v=auto">Signals</a></div>
        </div>
      </section>}

      {/* (e) the last close's picks, compact */}
      {!fresh && scr.data && allPicks.length > 0 && <section className="tsec tpicks" aria-labelledby="t-picks" data-sec="picks">
        <div className="row between sechead"><h2 id="t-picks" className="sec">Picks from the close of {dayWord(day)}</h2><span className="row small" style={{ gap: 6 }}><SessionPill asOf={day} /><span className="tag amber" title={evHead ?? 'Experimental'}>Experimental</span></span></div>
        <div className="card" style={{ padding: '2px 14px' }}><div className="list">{shownPicks.map((p) => { const row = rows.find((x) => x.sym === p.sym); const q = pickQ.data?.quotes[p.sym] ?? null; const lp = row ? livePrice(row, q) : null; const st = autoState(p); const up = (lp?.ch ?? 0) >= 0;
          return <a key={p.engine + p.sym} className="li pickrow" href={`#/c/${p.sym}`}>
            <span className="avatar" style={avatarStyle(p.sym)} aria-hidden="true">{initials(p.sym)}</span>
            <span className="grow" style={{ minWidth: 0 }}><span className="row" style={{ gap: 6 }}><span className="sym">{p.sym}</span><span className={`tag ${p.engine === 'MOM' ? 'amber' : 'violet'}`} style={{ fontSize: '0.625rem' }} title={ENGINES.find((e) => e.id === p.engine)?.name}>{p.engine}</span></span>
              <span className="small dim trunc" style={{ display: 'block' }}>{factLine(pickFacts(p.engine, row), 3)}</span>
              <span className="small mute trunc" style={{ display: 'block' }}>{st === 'in' ? 'In book' : st === 'no' ? 'Not taken' : 'Next open'} · signal {inr0(p.ref)}{lp?.px != null && lp.fromQuote ? <> → {pct(((lp.px / p.ref) - 1) * 100)}</> : ''} · stop {inr0(p.stop)}{(() => { const o = auto.ledger.data?.ledger.outcomes[pickId(p.asOf, p.engine, p.sym)]; const x = targetPrices(p, false, o && (o.status === 'open' || o.status === 'closed') ? o.entry : null); return x ? ` · T1 ${inr0(x.t1)} · T2 ${inr0(x.t2)} (${x.ref ? 'ref' : BASIS_NOTE[x.basis]})` : ''; })()}</span></span>
            <span className="pickspark" aria-hidden="true">{q && q.c.length > 2 ? <Spark c={q.c} up={up} refs={[{ v: q.prev, kind: 'prev' }]} h={28} label={`${p.sym} today`} /> : null}</span>
            <span className="px num"><b>{lp?.px != null ? inr0(lp.px) : inr0(p.ref)}</b><span className={tone(lp?.ch)}>{lp?.ch != null ? pct(lp.ch) : '—'}</span></span></a>; })}</div>
          <p className="small dim" style={{ margin: '4px 0 0' }}>{evHead ? `${evHead} ` : ''}Chosen on the close of {dayWord(day)}{fr.behind ? `, ${fr.behind === 1 ? 'one session' : `${fr.behind} sessions`} ago` : ''}. A rank, not a chance of winning.</p>
          <details className="more"><summary>How to read these picks</summary><div>Ranked by each engine's own rank among eligible names. "Since" is the live price against the signal close. The paper book skips an entry that opens more than 2% above that close. T1 and T2 are the profit-booking prices: "at signal close" for a pick that has not entered yet (the fill sets the booked levels), "from the fill" once it has; "(ref)" means reference only, not traded. The figures on the second line are the ones this pick's own engine ranked it on. Eligibility rule version {rulesFor(day ?? '9999')}.</div></details>
          <a className="btn sm picks-all" href="#/signals">{allPicks.length > TOP ? `All ${allPicks.length} picks in Signals` : 'Open Signals'}</a></div>
      </section>}

      {scr.data && <p className="mute small tfoot">{scr.data.count} companies in the screen · <a href="#/data" style={{ textDecoration: 'underline' }}>data and coverage</a>{fresh ? '' : '. Picks are starting points, not recommendations.'}</p>}
    </div>
  </div>;
}
