import { HitCard } from '../components/index.ts';
import { CaptureModule, IdentityFooter } from './capture.tsx';
import { useEffect, useMemo, useState } from 'react';
import { HeroLine } from './herolines.tsx';
import { heroDue } from '../hero.ts';
import { useAppState, useSheets } from '../app.tsx';
import { Failed, PageBar } from './common.tsx';
import { MarketStrip, type Tile } from './todaystrip.tsx';
import { useFreshness } from '../freshdata.ts';
import { pillOf } from '../freshness.ts';
import { istDay } from '../store.ts';
import { dayWord, inr0, pct, tone } from '../fmt.ts';
import { useEngines } from '../useEngines.ts';
import { ACTIVE, ENGINES } from '../quant.ts';
import { useBacktest, usePulse } from '../data.ts';
import { evidenceHeadline } from '../evidence.ts';
import { isNewUser } from '../home.ts';
import { livePrice, useLiveSymbols } from '../quotes.ts';
import { useAutoBook, useLiveBook } from '../book.ts';
import { useMacro, MACRO, fmtMacro } from '../macro.ts';
import { Spark, Tick } from '../live.tsx';
import { marksTick } from '../tickbasis.ts';
import { FlowLine } from './FlowCard.tsx';
import { Icon } from '../ui.tsx';
import { sessionNow } from '../market.ts';
import { isLiveQuote, quoteWord } from '../stamp.ts';
import { BASIS_NOTE, targetPrices } from '../levels.ts';
import { pickId, MIN_TRADES } from '../ledger.ts';
import { useTrendSummary } from '../trendsummary.ts';
import { MarketNews } from '../todaynews.tsx';
import { NamesBoard, NamesEmpty } from './todayboard.tsx';
import { splitNews } from '../todayboard.ts';
import { marketTakeaway } from '../takeaway.ts';
import { SampleWalkthrough } from './samplewalk.tsx';
import { useNewsBoard } from '../news.ts';
import { todayList } from '../newsview.ts';

const money = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);
const TOP = 3; const NEWS_TOP = 4;

/** Today (v6 home, 13 Nov 2026), in the order a person needs it, each fact said once: "Market now" (six tiles, one sentence, a breadth meter, the basis once), then your names, the last
 *  close's picks, the paper book as one slim row and the market's own news. Definitions, the data-status table and "how to read these picks" live in Info (#/info). How current the
 *  screen is is said in the strip's one basis line, the header pill and the app banner (drawn once by the shell). */
export function Today() {
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
  const inBook = useMemo(() => new Set([...auto.rows.filter((r) => ['open', 'pending', 'waiting'].includes(r.v.status)).map((r) => r.p.sym), ...s.paper.filter((p) => !p.closedByUser).map((p) => p.sym)]), [auto.rows, s.paper]);
  const autoState = (p: { sym: string; engine: string; asOf: string }) => dupOf(p) ? 'in' : auto.plan?.refused.find((x) => x.pick.sym === p.sym && x.pick.engine === p.engine && x.pick.asOf === p.asOf)?.why ? 'no' : 'wait';
  const allPicks = (out?.runs ?? []).flatMap((r) => r.picks).sort((a, b) => b.score - a.score); const shownPicks = allPicks.slice(0, TOP);
  const pickSyms = shownPicks.map((p) => p.sym); const pickQ = useLiveSymbols(pickSyms, !fresh && pickSyms.length > 0);
  const bt = useBacktest(); const evHead = evidenceHeadline(ACTIVE.map((e) => e.id), bt.data, bt.loading);
  // news, once for the page: company stories go on their board rows, India-wide stories in Market news, and no event is listed in both (dedupe by event id)
  const lists = useMemo(() => ({ follows: s.follows, paper: [...inBook] }), [s.follows.join(), [...inBook].join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nb = useNewsBoard(lists);
  const news = useMemo(() => splitNews(nb.pool, todayList(nb.pool, 'market', lists, nb.at), s.follows, nb.at, 3, NEWS_TOP), [nb.pool, nb.at, lists, s.follows]);
  // the news and the board are drawn one frame later so opening Today paints at once; their slots are reserved so nothing below them moves
  const [late, setLate] = useState(false); useEffect(() => { const x = window.setTimeout(() => setLate(true), 60); return () => window.clearTimeout(x); }, []);
  const IX = [['Nifty 50', 'NIFTY', 2], ['Bank Nifty', 'BANKNIFTY', 0], ['India VIX', 'VIX', 2]] as const;
  const mq = (k: string) => macro.data?.quotes[k] ?? null; const mch = (k: string) => { const q = mq(k); return q ? (q.px / q.prev - 1) * 100 : null; };
  const tiles: Tile[] = [
    ...IX.map(([label, key, d]) => { const q = pulse.data?.quotes[key] ?? null; return { key, label, href: '#/markets', q, value: q ? q.px.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—', ch: chOf(key), inverse: key === 'VIX', pending: pulse.loading && !pulse.err }; }),
    ...(['GOLD', 'BRENT', 'USDINR'] as const).map((key) => { const d = MACRO.find((m) => m.key === key)!; const q = mq(key); return { key, label: d.label, href: '#/markets', q, value: q ? fmtMacro(d, q.px) : '—', ch: mch(key), pending: macro.loading && !macro.err }; }),
  ];
  const fr = useFreshness(); const pill = pillOf(fr.files, fr.now);

  return <div>
    <PageBar title="Today" />
    <div className="today t2 t3">
      <HeroLine />
      {/* targets hit in the last completed session: only when there are some */}
      {auto.hits.length > 0 && <HitCard hits={auto.hits} id="t-hits" />}

      {/* (1) Market now: six tiles, the one-sentence read, the breadth meter, and the basis said once */}
      <MarketStrip tiles={tiles} take={take ? take.text : null} takeLoading={scr.loading || pulse.loading} breadth={{ up: t.upPct, down: t.downPct, n: t.map.n }} live={pw === 'Live'} wordLabel={pw ?? 'Checking prices'} obsSec={pulse.obs} obsErr={pulse.err}
        flow={<FlowLine />} dataLine={<span className="mkt-data" data-datastatus data-fresh={pill?.tone ?? 'loading'}>{pill ? pill.text : 'Checking how current the data is…'}</span>} />

      {/* a new user: one action. Nothing here is a count of something that does not exist yet. */}
      {fresh && <section className="tsec card setup" aria-labelledby="t-setup" data-sec="setup">
        <h2 id="t-setup" className="sec">Start with one company</h2>
        <button className="btn pri" onClick={() => open({ k: 'search' })}><Icon n="search" />Find a company</button>
      </section>}
      {fresh && <SampleWalkthrough defaultOpen={firstVisit} />}

      {!fresh && <div className="t-main">
        {/* (2a) your names */}
        {s.follows.length === 0 && <NamesEmpty />}
        {s.follows.length > 0 && <>
          {scr.err && <Failed what="the market data" err={scr.err} retry={scr.retry} />}
          {scr.loading && <div className="tsec board-slot" data-sec="changes" aria-busy="true"><div className="sk bs-sk" /></div>}
          {scr.data && <NamesBoard rows={rows} day={day} today={today} newsBySym={news.bySym} inBook={inBook} />}
        </>}

        {/* (2b) picks from the last close */}
        {scr.loading && !scr.err && <div className="tsec picks-slot" aria-busy="true"><div className="sk ps-sk" /></div>}
        {scr.data && allPicks.length > 0 && <section className="tsec tpicks" aria-labelledby="t-picks" data-sec="picks">
          <div className="row between sechead"><h2 id="t-picks" className="sec">Picks from the close of {dayWord(day)}</h2><a className="seclink" href="#/signals">All picks <span aria-hidden="true">→</span></a></div>
          <div className="card list-card"><div className="list">{shownPicks.map((p) => { const row = rows.find((x) => x.sym === p.sym); const q = pickQ.data?.quotes[p.sym] ?? null; const lp = row ? livePrice(row, q) : null; const st = autoState(p);
            const o = auto.ledger.data?.ledger.outcomes[pickId(p.asOf, p.engine, p.sym)]; const x = targetPrices(p, false, o && (o.status === 'open' || o.status === 'closed') ? o.entry : null);
            return <a key={p.engine + p.sym} className="li pickrow" href={`#/c/${p.sym}`}>
              <span className="pk-main"><span className="pk-top"><span className="sym">{p.sym}</span><span className="br-chip" title={ENGINES.find((e) => e.id === p.engine)?.name}>{p.engine}</span><span className={`br-chip ${st === 'in' ? 'accent' : ''}`}>{st === 'in' ? 'In book' : st === 'no' ? 'Not taken' : 'Next open'}</span></span>
                <span className="pk-lv small mute num trunc">stop {inr0(p.stop)}{x ? ` · T1 ${inr0(x.t1)}` : ''}{x ? <span className="pk-b"> · T2 {inr0(x.t2)} ({x.ref ? 'ref' : BASIS_NOTE[x.basis]})</span> : null}{lp?.px == null || !lp.fromQuote ? ` · signal ${inr0(p.ref)}` : ''}</span></span>
              <span className="pickspark" aria-hidden="true">{q && q.c.length > 2 ? <Spark c={q.c} up={(lp?.ch ?? 0) >= 0} refs={[{ v: q.prev, kind: 'prev' }]} h={24} label={`${p.sym} today`} /> : null}</span>
              <span className="px num"><b>{lp?.px != null ? inr0(lp.px) : inr0(p.ref)}</b><span className={tone(lp?.ch)}>{lp?.ch != null ? pct(lp.ch) : '—'}</span></span></a>; })}</div>
            <p className="small mute picks-note">Experimental: {evHead ? `${evHead} ` : ''}A rank, not a chance of winning. Paper only.</p>
          </div>
        </section>}
        {scr.data && allPicks.length === 0 && <section className="tsec tpicks" aria-labelledby="t-nopicks" data-sec="picks-empty">
          <div className="row between sechead"><h2 id="t-nopicks" className="sec">Fired at the last close</h2><a className="seclink" href="#/signals">Open Book <span aria-hidden="true">→</span></a></div>
          <p className="small dim card t-quiet">No rules fired at the last close. The gate is doing its job.</p>
        </section>}
      </div>}

      {!fresh && <div className="t-side">
        {/* (2c) the paper book, one slim row */}
        <section className="tsec tbook" aria-labelledby="t-book" data-sec="book">
          <h2 id="t-book" className="sr">Paper book</h2>
          <a className="bookrow card" href="#/signals">
            <span className="bk-k">Paper book</span>
            {scr.data && (showAuto || ownRows.length > 0) ? <dl className="bk-stats num">
              <div><dt>Open-trade P&amp;L</dt><dd className={`amt ${tone(pnl)}`} title="Booked partial exits plus the remaining shares marked at the observed price"><Tick v={openN ? pnl : null} {...marksTick([...(showAuto ? auto.rows.filter((r) => r.v.status === 'open') : []), ...ownOpen].map((r) => r.v.markKind))}>{openN ? money(pnl) : '—'}</Tick></dd></div>
              <div><dt>Open</dt><dd>{openN}{showAuto && auto.sum.waiting ? <small> +{auto.sum.waiting} waiting</small> : null}</dd></div>
              <div><dt>Closed</dt><dd>{showAuto ? auto.sum.closed : 0}<small> of {MIN_TRADES}</small></dd></div>
            </dl> : <span className="bk-stats small mute">{scr.data ? 'No paper trades yet' : <span className="sk" style={{ display: 'inline-block', height: 14, width: '9rem' }} aria-label="Reading the paper book" />}</span>}
            <span className="bk-go" aria-hidden="true"><Icon n="chev" /></span>
          </a>
        </section>

        {/* (2d) market news: the top four, one line each */}
        <div className="tsec tnews" data-sec="news"><div className="newsslot">{late ? <MarketNews b={nb} market={news.market} lists={lists} /> : <div className="sk ns-sk" aria-hidden="true" />}</div></div>
      </div>}

      <div className="t-capture"><CaptureModule source="tripwire-today" /></div>
      <p className="small mute t-about tfoot"><a href="#/info">About these numbers</a> · {scr.data ? `${scr.data.count} companies in the screen · ` : ''}paper only, not advice</p>
      <IdentityFooter />
    </div>
  </div>;
}
