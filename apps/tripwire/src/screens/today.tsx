import { HitCard, TargetLadder } from '../components/index.ts';
import { CaptureModule, IdentityFooter } from './capture.tsx';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { HeroLine } from './herolines.tsx';
import { heroDue } from '../hero.ts';
import { useAppState, useSheets } from '../app.tsx';
import { Failed, Loading, PageBar } from './common.tsx';
import { DataStatus } from './FreshnessPill.tsx';
import { BreadthGauge } from './pulse.tsx';
import { istDay } from '../store.ts';
import { dayWord, inr0, pct, tone } from '../fmt.ts';
import { useEngines } from '../useEngines.ts';
import { ACTIVE, ENGINES } from '../quant.ts';
import { useBacktest, usePulse } from '../data.ts';
import { evidenceHeadline } from '../evidence.ts';
import { isNewUser } from '../home.ts';
import { livePrice, useLiveSymbols } from '../quotes.ts';
import { useAutoBook, useLiveBook, type BookRow } from '../book.ts';
import { buildFeed } from '../alertsfeed.ts';
import { useMacro, MACRO, fmtMacro } from '../macro.ts';
import { LiveBadge, Observed, Spark, Tick } from '../live.tsx';
import { marksTick, quoteTick } from '../tickbasis.ts';
import { FlowLine } from './FlowCard.tsx';
import { avatarStyle } from '../widgets.tsx';
import { initials } from '../fmt.ts';
import { Icon } from '../ui.tsx';
import { sessionNow } from '../market.ts';
import { rulesFor } from '../rules.ts';
import { isLiveQuote, quoteWord } from '../stamp.ts';
import { pickFacts, factLine } from '../pickfacts.ts';
import { BASIS_NOTE, targetPrices } from '../levels.ts';
import { pickId, MIN_TRADES } from '../ledger.ts';
import { ladderInputFor } from '../ladder.ts';
import { useTrendSummary } from '../trendsummary.ts';
import { MarketNews } from '../todaynews.tsx';
import { NamesBoard, NamesEmpty } from './todayboard.tsx';
import { nearestLevels, splitNews } from '../todayboard.ts';
import { marketTakeaway } from '../takeaway.ts';
import { SampleWalkthrough } from './samplewalk.tsx';
import { useNewsBoard } from '../news.ts';
import { todayList } from '../newsview.ts';

const money = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);
const TOP = 3;

/** Today (revamp v2, 11 Nov 2026), each fact said once, in the order a person needs it: the market (a breadth gauge and one sentence, the index tape), your names (a departure
 *  board: price, change and chips per followed company, each row opening to its changes, headlines and actions), the market's own news (three stories), the paper book in one card,
 *  the last close's top picks, and one collapsed "Data status" line at the foot. How current the screen is lives in the header pill and the app banner, not again here. */
export function Today({ banner }: { banner?: ReactNode } = {}) {
  const s = useAppState(); const { open } = useSheets();
  const [firstVisit] = useState(() => heroDue());   // decided once at mount: dismissing the line does not fold the walkthrough under the reader's thumb
  const { scr, out } = useEngines();
  const rows = useMemo(() => scr.data?.rows ?? [], [scr.data]); const day = scr.data?.as_of ?? null; const today = istDay();
  const fresh = isNewUser(s);   // a new user gets the setup card and the brief; the book, picks, news and changes need something of theirs to be about
  const pulse = usePulse(true); const book = useLiveBook(!fresh); const auto = useAutoBook(!fresh); const macro = useMacro();
  const anyLive = pulse.data ? Object.values(pulse.data.quotes).some((q) => isLiveQuote(q)) : null;
  const sess = sessionNow(Date.now(), anyLive); const pw = quoteWord(pulse.obs, Date.now(), { loading: pulse.loading && !pulse.err }); const live = sess.phase === 'open' && !!anyLive;
  const t = useTrendSummary(rows, day, true);
  const chOf = (k: string) => { const q = pulse.data?.quotes[k]; return q ? (q.px / q.prev - 1) * 100 : null; };
  const take = marketTakeaway({ niftyCh: chOf('NIFTY'), vixCh: chOf('VIX'), upPct: t.upPct, downPct: t.downPct, nTrend: t.map.n, live });
  // the paper book, once: what the auto book holds and what was taken by hand. Never presented as the user's watchlist.
  const dupOf = (p: { sym: string; engine: string; asOf: string }) => !!auto.plan?.taken.some((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf);
  const ownRows = book.rows.filter((r) => !dupOf(r.p) && !ENGINES.some((e) => e.id === r.p.engine && e.retired)); const ownOpen = ownRows.filter((r) => r.v.status === 'open');
  const ownPnl = ownOpen.reduce((a, r) => a + (r.v.pnl ?? 0), 0); const showAuto = auto.rows.length > 0;
  const openN = (showAuto ? auto.sum.open : 0) + ownOpen.length; const pnl = (showAuto ? auto.sum.openPnl : 0) + ownPnl;
  const outcomes = auto.ledger.data?.ledger.outcomes;
  const inBook = useMemo(() => new Set([...auto.rows.filter((r) => ['open', 'pending', 'waiting'].includes(r.v.status)).map((r) => r.p.sym), ...s.paper.filter((p) => !p.closedByUser).map((p) => p.sym)]), [auto.rows, s.paper]);
  // the two open positions nearest a level, drawn with the book's own ladder
  const near = useMemo(() => nearestLevels([...(showAuto ? auto.rows : []), ...ownOpen].filter((r) => r.v.status === 'open').map((r: BookRow) => {
    const input = ladderInputFor(r.p, r.v, outcomes?.[r.p.id]); if (!input || input.mark == null) return null;
    return { id: r.p.id, sym: r.p.sym, mark: input.mark, stop: input.curStop ?? input.stop, target: input.reference ? null : !input.t1Hit ? input.t1 : !input.t2Hit ? input.t2 : null, input };
  }).filter((x): x is NonNullable<typeof x> => !!x), 2), [auto.rows, ownOpen, outcomes, showAuto]);
  // a position that closed in the last three days is the one paper-book change the ladder rows and the hit card do not already carry
  const closedLately = useMemo(() => buildFeed({ hits: [], rows: auto.rows, ledger: null, nowSec: Math.floor(Date.now() / 1000) }).filter((f) => f.kind === 'closed'), [auto.rows]);
  const autoState = (p: { sym: string; engine: string; asOf: string }) => dupOf(p) ? 'in' : auto.plan?.refused.find((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf)?.why ? 'no' : 'wait';
  const allPicks = (out?.runs ?? []).flatMap((r) => r.picks).sort((a, b) => b.score - a.score); const shownPicks = allPicks.slice(0, TOP);
  const pickSyms = shownPicks.map((p) => p.sym); const pickQ = useLiveSymbols(pickSyms, !fresh && pickSyms.length > 0);
  const bt = useBacktest(); const evHead = evidenceHeadline(ACTIVE.map((e) => e.id), bt.data, bt.loading);
  // news, once for the page: company stories go on their board rows, India-wide stories in Market news, and no event is listed in both (dedupe by event id)
  const lists = useMemo(() => ({ follows: s.follows, paper: [...inBook] }), [s.follows.join(), [...inBook].join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nb = useNewsBoard(lists);
  const news = useMemo(() => splitNews(nb.pool, todayList(nb.pool, 'market', lists, nb.at), s.follows, nb.at), [nb.pool, nb.at, lists, s.follows]);
  // the news and the board are drawn one frame later so opening Today paints at once; their slots are reserved so nothing below them moves
  const [late, setLate] = useState(false); useEffect(() => { const x = window.setTimeout(() => setLate(true), 60); return () => window.clearTimeout(x); }, []);
  const macroLine = ['GOLD', 'BRENT', 'USDINR'].map((k) => MACRO.find((d) => d.key === k)).filter((d): d is NonNullable<typeof d> => !!d).map((d) => { const q = macro.data?.quotes[d.key]; return q ? { k: d.label, v: fmtMacro(d, q.px), ch: (q.px / q.prev - 1) * 100 } : null; }).filter(Boolean) as { k: string; v: string; ch: number | null }[];

  return <div>
    <PageBar title="Today" />
    <div className="today t2">
      <HeroLine />
      {/* (0) targets hit in the last completed session: only when there are some, computed from the book on this page load */}
      {auto.hits.length > 0 && <HitCard hits={auto.hits} id="t-hits" />}

      {/* (a) the market: gauge + one sentence, then the index tape. The session is said here on a phone; the top bar says it on a wider screen. */}
      <section className="tsec brief card" aria-labelledby="t-brief" data-sec="brief">
        <div className="row between brief-top"><h2 id="t-brief" className="sec">Your market brief</h2><span className="row small t-sess-row"><span className={`t-sess ${sess.phase}`} data-session>{sess.label} · {sess.detail}</span><LiveBadge live={pw === 'Live'} label={pw ?? 'Checking prices'} /></span></div>
        <div className="pulse"><BreadthGauge upPct={t.upPct} downPct={t.downPct} n={t.map.n} /><p className="t-take" data-takeaway>{take ? take.text : scr.loading || pulse.loading ? <span className="sk" style={{ display: 'inline-block', height: 18, width: '85%' }} aria-label="Reading the market" /> : 'No market figures are available right now.'}</p></div>
        <div className="brief-ix num" role="list" aria-label="Indices">
          {([['Nifty 50', 'NIFTY', 2], ['Bank Nifty', 'BANKNIFTY', 0], ['India VIX', 'VIX', 2]] as const).map(([nm, k, d]) => { const q = pulse.data?.quotes[k]; const ch = chOf(k); return <a role="listitem" key={k} href="#/markets" className="bix"><span className="small dim">{nm}</span><b><Tick v={q?.px} {...quoteTick(q?.pt, Date.now())}>{q ? q.px.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'}</Tick></b><span className={`small ${k === 'VIX' ? (ch == null ? '' : ch > 0 ? 'down' : 'up') : tone(ch)}`}>{ch == null ? '—' : pct(ch, 2)}</span></a>; })}
        </div>
        <FlowLine />
        <div className="small dim brief-macro num" aria-label="Commodities and the rupee">{(macroLine.length ? macroLine : [{ k: 'Gold', v: '—', ch: null }, { k: 'Brent oil', v: '—', ch: null }, { k: 'USD / INR', v: '—', ch: null }]).map((m) => <span key={m.k}><span>{m.k}</span><b className="tx">{m.v}</b><span className={tone(m.ch)}>{m.ch == null ? '—' : pct(m.ch, 1)}</span></span>)}</div>
        <p className="small mute brief-fresh" data-brief><span className="bf-row bf-px">Prices: <Observed sec={pulse.obs} err={pulse.err} /> · times in IST</span><span className="bf-row bf-links"><a href="#/markets">Markets, indices, trend map</a></span></p>
      </section>

      {/* the stale-data banner sits directly under the brief (alarm ordering only): same words, same severity, one section lower than it was */}
      {banner}

      {/* a new user: one action. Nothing here is a count of something that does not exist yet. */}
      {fresh && <section className="tsec card setup" aria-labelledby="t-setup" data-sec="setup">
        <h2 id="t-setup" className="sec">Start with one company</h2>
        <button className="btn pri" onClick={() => open({ k: 'search' })}><Icon n="search" />Find a company</button>
      </section>}
      {fresh && <SampleWalkthrough defaultOpen={firstVisit} />}

      {/* (b) your names: the departure board */}
      {!fresh && s.follows.length === 0 && <NamesEmpty />}
      {!fresh && s.follows.length > 0 && <>
        {scr.err && <Failed what="the market data" err={scr.err} retry={scr.retry} />}
        {scr.loading && <div className="tsec board-slot" data-sec="changes"><Loading what="your names" /></div>}
        {scr.data && <NamesBoard rows={rows} day={day} today={today} newsBySym={news.bySym} inBook={inBook} />}
      </>}

      {/* (c) market news: three India-wide stories, then All news */}
      {!fresh && <div className="tsec tnews" data-sec="news"><div className="newsslot">{late && <MarketNews b={nb} market={news.market} lists={lists} />}</div></div>}

      {/* (d) the paper book, one card */}
      {!fresh && scr.data && (showAuto || ownRows.length > 0) && <section className="tsec tbook" aria-labelledby="t-book" data-sec="book">
        <div className="row between sechead"><h2 id="t-book" className="sec">Paper book</h2><a className="seclink" href="#/signals">Open Book <span aria-hidden="true">→</span></a></div>
        <div className="card bookcard">
          <dl className="bk-stats num">
            <div><dt>Open-trade P&amp;L</dt><dd className={`amt bigpnl ${tone(pnl)}`} title="Booked partial exits plus the remaining shares marked at the observed price"><Tick v={openN ? pnl : null} {...marksTick([...(showAuto ? auto.rows.filter((r) => r.v.status === 'open') : []), ...ownOpen].map((r) => r.v.markKind))}>{openN ? money(pnl) : '—'}</Tick></dd></div>
            <div><dt>Open</dt><dd>{openN}{showAuto && auto.sum.waiting ? <small> +{auto.sum.waiting} waiting</small> : null}</dd></div>
            <div><dt>Closed</dt><dd>{showAuto ? auto.sum.closed : 0}<small> of {MIN_TRADES}</small></dd></div>
          </dl>
          {near.length > 0 && <ul className="bk-near" aria-label="Positions nearest a stop or target">{near.map((x) => <li key={x.id}>
            <div className="row between bk-near-h"><a href={`#/c/${x.sym}`} className="sym">{x.sym}</a><span className={`small ${x.near === 'stop' ? 'down' : 'up'}`}>{(x.gap * 100).toFixed(1)}% from its {x.near === 'stop' ? 'stop' : 'next target'}</span></div>
            <TargetLadder sym={x.sym} input={x.input} quiet /></li>)}</ul>}
          {closedLately.length > 0 && <ul className="bk-closed small" aria-label="Closed in the last three days">{closedLately.map((f) => <li key={f.id}><a href={f.href}><span className={`dot ${f.tone === 'up' ? 'up' : 'down'}`} aria-hidden="true" />{f.text}</a></li>)}</ul>}
          <p className="small mute bk-note">Paper money only{showAuto && auto.sum.closed > 0 ? <> · realised <b className={`num amt ${tone(auto.sum.closedPnl)}`}>{money(auto.sum.closedPnl)}</b></> : null}.</p>
        </div>
      </section>}

      {/* (e) the last close's top picks */}
      {!fresh && scr.data && allPicks.length > 0 && <section className="tsec tpicks" aria-labelledby="t-picks" data-sec="picks">
        <div className="row between sechead"><h2 id="t-picks" className="sec">Picks from the close of {dayWord(day)}</h2><a className="seclink" href="#/signals">All picks <span aria-hidden="true">→</span></a></div>
        <div className="card" style={{ padding: '2px 14px' }}><div className="list">{shownPicks.map((p) => { const row = rows.find((x) => x.sym === p.sym); const q = pickQ.data?.quotes[p.sym] ?? null; const lp = row ? livePrice(row, q) : null; const st = autoState(p);
          return <a key={p.engine + p.sym} className="li pickrow" href={`#/c/${p.sym}`}>
            <span className="avatar" style={avatarStyle(p.sym)} aria-hidden="true">{initials(p.sym)}</span>
            <span className="grow" style={{ minWidth: 0 }}><span className="row" style={{ gap: 6 }}><span className="sym">{p.sym}</span><span className="br-chip" title={ENGINES.find((e) => e.id === p.engine)?.name}>{p.engine}</span><span className={`br-chip ${st === 'in' ? 'accent' : ''}`}>{st === 'in' ? 'In book' : st === 'no' ? 'Not taken' : 'Next open'}</span></span>
              <span className="small dim trunc" style={{ display: 'block' }}>{factLine(pickFacts(p.engine, row), 3)}</span>
              <span className="small mute trunc" style={{ display: 'block' }}>signal {inr0(p.ref)}{lp?.px != null && lp.fromQuote ? <> → {pct(((lp.px / p.ref) - 1) * 100)}</> : ''} · stop {inr0(p.stop)}{(() => { const o = auto.ledger.data?.ledger.outcomes[pickId(p.asOf, p.engine, p.sym)]; const x = targetPrices(p, false, o && (o.status === 'open' || o.status === 'closed') ? o.entry : null); return x ? ` · T1 ${inr0(x.t1)} · T2 ${inr0(x.t2)} (${x.ref ? 'ref' : BASIS_NOTE[x.basis]})` : ''; })()}</span></span>
            <span className="pickspark" aria-hidden="true">{q && q.c.length > 2 ? <Spark c={q.c} up={(lp?.ch ?? 0) >= 0} refs={[{ v: q.prev, kind: 'prev' }]} h={28} label={`${p.sym} today`} /> : null}</span>
            <span className="px num"><b>{lp?.px != null ? inr0(lp.px) : inr0(p.ref)}</b><span className={tone(lp?.ch)}>{lp?.ch != null ? pct(lp.ch) : '—'}</span></span></a>; })}</div>
          <p className="small mute picks-note">Experimental: {evHead ? `${evHead} ` : ''}A rank, not a chance of winning. Paper only.</p>
          <details className="more"><summary>How to read these picks</summary><div>Ranked by each engine's own rank among eligible names. "→" is the live price against the signal close. The paper book skips an entry that opens more than 2% above that close. T1 and T2 are the profit-booking prices: "at signal close" for a pick that has not entered yet (the fill sets the booked levels), "from the fill" once it has; "(ref)" means reference only, not traded. The figures on the second line are the ones this pick's own engine ranked it on. Eligibility rule version {rulesFor(day ?? '9999')}.</div></details>
        </div>
      </section>}

      {/* nothing fired is a finding, said plainly */}
      {!fresh && scr.data && allPicks.length === 0 && <section className="tsec tpicks" aria-labelledby="t-nopicks" data-sec="picks-empty">
        <div className="row between sechead"><h2 id="t-nopicks" className="sec">Fired at the last close</h2><a className="seclink" href="#/signals">Open Book <span aria-hidden="true">→</span></a></div>
        <p className="small dim card t-quiet">No rules fired at the last close. The gate is doing its job.</p>
      </section>}

      <div className="t-capture"><CaptureModule source="tripwire-today" /></div>
      {/* how current each file is, once, collapsed, at the foot: the header pill and the banner carry the headline */}
      <DataStatus extra={scr.data ? <p className="mute">{scr.data.count} companies in the screen · <a href="#/data">Data and coverage</a>{fresh ? '' : ' · picks are starting points, not recommendations.'}</p> : null} />
      <IdentityFooter />
    </div>
  </div>;
}
