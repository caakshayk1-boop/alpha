import { useEffect, useMemo } from 'react';
import { go, setState, useAppState, useSheets } from '../app.tsx';
import { Empty } from '../ui.tsx';
import { Head, Loading, Failed, PageBar, CompanyRow } from './common.tsx';
import { freshness } from '../fresh.ts';
import { changesSince, istDay, recordSnap, reviewDue, current } from '../store.ts';
import { dayWord, isNum, pct, tone } from '../fmt.ts';
import { useEngines } from '../useEngines.ts';
import { ENGINES } from '../quant.ts';
import { trendOf, TREND_WORD, type Row } from '../screen.ts';
import { useBreadth, usePulse } from '../data.ts';
import { livePrice, useLiveSymbols } from '../quotes.ts';
import { useAutoBook, useLiveBook } from '../book.ts';
import { MacroStrip } from './Macro.tsx';
import { TodayNews } from './News.tsx';
import { Ago, LiveBadge, Spark, Tick } from '../live.tsx';
import { Aurora } from '../aurora.tsx';
import { Heat, Ring } from '../widgets.tsx';
import { mood } from '../mood.ts';
import { Icon } from '../ui.tsx';
import { tvIndexUrl } from '../tv.ts';
import { sessionNow } from '../market.ts';
import { inr0 } from '../fmt.ts';

const money = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);

export function Today() {
  const s = useAppState(); const { open } = useSheets();
  const { scr, out } = useEngines();
  const rows = scr.data?.rows ?? []; const day = scr.data?.as_of ?? null; const fr = freshness(day); const today = istDay();
  const pulse = usePulse(true); const book = useLiveBook(true); const auto = useAutoBook(true);
  const anyLive = pulse.data ? Object.values(pulse.data.quotes).some((q) => q.live) : null;
  const sess = sessionNow(Date.now(), anyLive);
  // one snapshot per data day for each followed name: this is what makes "since you last looked" honest
  useEffect(() => {
    if (!day) return;
    for (const sym of s.follows) { const r = rows.find((x) => x.sym === sym); if (r) setState((x) => recordSnap(x, sym, { day, px: r.price ?? null, rsi: r.rsi ?? null, rs3m: r.rs3m ?? null, from_high: r.from_high ?? null })); }
  }, [day, rows, s.follows.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const changes = useMemo(() => {
    if (!day) return [];
    const now: Record<string, { day: string; px: number | null; rsi: number | null; rs3m: number | null; from_high: number | null }> = {};
    for (const sym of s.follows) { const r = rows.find((x) => x.sym === sym); if (r) now[sym] = { day, px: r.price ?? null, rsi: r.rsi ?? null, rs3m: r.rs3m ?? null, from_high: r.from_high ?? null }; }
    return changesSince(s, now);
  }, [s.follows, s.snaps, rows, day]);
  const events = s.follows.map((sym) => rows.find((r) => r.sym === sym)).filter((r): r is Row => !!r && !!r.next_earnings && r.next_earnings >= today && r.next_earnings <= addDays(today, 30)).sort((a, b) => a.next_earnings!.localeCompare(b.next_earnings!));
  const reviews = s.entries.filter((e) => ['overdue', 'today'].includes(reviewDue(e) ?? ''));
  // trend map: live from the Worker (today's prices on the names near a trend line); the published close is the fallback, and says so
  const breadth = useBreadth(true);
  const snapMap = useMemo(() => {
    const c = { up: 0, mixed: 0, down: 0 }; const by = new Map<string, { n: number; up: number; down: number }>();
    for (const r of rows) { if (!r.liquid) continue; const t = trendOf(r).trend; if (!t) continue; c[t]++; const k = r.sector ?? 'Other'; const e = by.get(k) ?? { n: 0, up: 0, down: 0 }; e.n++; if (t === 'up') e.up++; if (t === 'down') e.down++; by.set(k, e); }
    return { n: c.up + c.mixed + c.down, ...c, sectors: [...by.entries()].filter(([, e]) => e.n >= 8).map(([k, e]) => ({ k, n: e.n, up: (e.up / e.n) * 100, down: (e.down / e.n) * 100 })).sort((a, b) => b.n - a.n) };
  }, [rows]);
  const liveMap = breadth.data && breadth.data.as_of === day && breadth.data.n > 0 ? breadth.data : null;   // a breadth built on a different screen day would not match the rest of the page
  const map = liveMap ?? snapMap;
  const chOf = (k: string) => { const q = pulse.data?.quotes[k]; return q ? (q.px / q.prev - 1) * 100 : null; };
  const niftyCh = chOf('NIFTY'), bankCh = chOf('BANKNIFTY'), vixCh = chOf('VIX'); const md = mood(niftyCh, bankCh, vixCh);
  const total = out?.picks.length ?? 0;
  // one book, once: the auto book carries every engine pick; a hand-taken trade is shown only where it is NOT the same pick
  const dupOf = (p: { sym: string; engine: string; asOf: string }) => !!auto.plan?.taken.some((t) => t.pick.sym === p.sym && t.pick.engine === p.engine && t.pick.asOf === p.asOf);
  const ownRows = book.rows.filter((r) => !dupOf(r.p)); const ownOpen = ownRows.filter((r) => r.v.status === 'open');
  const ownPnl = ownOpen.reduce((a, r) => a + (r.v.pnl ?? 0), 0);
  const showAuto = auto.rows.length > 0;
  const autoState = (p: { sym: string; engine: string; asOf: string }) => dupOf(p) ? 'in' : auto.plan?.refused.find((t) => t.pick.sym === p.sym && t.pick.engine === p.engine && t.pick.asOf === p.asOf)?.why ? 'no' : 'wait';
  const pickSyms = (out?.picks ?? []).map((p) => p.sym); const pickQ = useLiveSymbols(pickSyms, pickSyms.length > 0);
  const newsSyms = [...new Set([...auto.rows.filter((r) => r.v.status === 'open' || r.v.status === 'pending' || r.v.status === 'waiting').map((r) => r.p.sym), ...ownRows.map((r) => r.p.sym), ...s.follows])];
  const needs = reviews.length > 0 || events.length > 0;
  const live = sess.phase === 'open' && !!anyLive;

  return <div>
    <PageBar title="Today" sub={<><span className={sess.phase === 'open' ? 'up' : ''}>{sess.label}</span> · {sess.detail}</>} right={<button className="icon-btn" aria-pressed={!!s.prefs.hideAmounts} aria-label={s.prefs.hideAmounts ? 'Show my amounts' : 'Hide my amounts'} onClick={() => { setState((x) => ({ ...x, prefs: { ...x.prefs, hideAmounts: !x.prefs.hideAmounts } })); }}><Icon n={s.prefs.hideAmounts ? 'eyeoff' : 'eye'} /></button>} />
    {/* the market, once: the mood, the Nifty, and the two figures that colour it, with one live label */}
    <section className="moodhero card glass" aria-label="Market mood">
      <Aurora ch={niftyCh} vix={vixCh} />
      <div className="row between"><span className="k">Market mood</span><span className="row small" style={{ gap: 8 }}><LiveBadge live={live} label={live ? 'LIVE' : 'Last prices'} /><span className="mute">{pulse.err && !pulse.data ? 'unavailable' : pulse.at ? <Ago at={pulse.at} /> : ''}</span></span></div>
      {md ? <div className="word grad-text" style={{ margin: '6px 0 2px' }}>{md.word}</div> : <div className="sk" style={{ height: 32, width: '45%', margin: '8px 0' }} />}
      <div className="big num">{pulse.data?.quotes.NIFTY ? <><Tick v={pulse.data.quotes.NIFTY.px}>{pulse.data.quotes.NIFTY.px.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Tick> <span className={tone(niftyCh)}>{pct(niftyCh)}</span> <a className="dim small" href={tvIndexUrl('NIFTY')} target="_blank" rel="noopener noreferrer">Nifty 50<span className="sr"> on TradingView, opens in a new tab</span></a></> : <span className="dim">{pulse.err ? 'Index prices unavailable' : 'Reading the market…'}</span>}</div>
      <div className="row small num" style={{ gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
        <a href={tvIndexUrl('BANKNIFTY')} target="_blank" rel="noopener noreferrer"><span className="dim">Bank Nifty </span><Tick v={pulse.data?.quotes.BANKNIFTY?.px}>{pulse.data?.quotes.BANKNIFTY ? pulse.data.quotes.BANKNIFTY.px.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}</Tick> <span className={tone(bankCh)}>{pct(bankCh)}</span><span className="sr"> on TradingView, opens in a new tab</span></a>
        <a href={tvIndexUrl('VIX')} target="_blank" rel="noopener noreferrer"><span className="dim">India VIX </span><Tick v={pulse.data?.quotes.VIX?.px}>{pulse.data?.quotes.VIX ? pulse.data.quotes.VIX.px.toFixed(2) : '—'}</Tick> <span className={vixCh == null ? '' : vixCh > 0 ? 'down' : vixCh < 0 ? 'up' : ''}>{pct(vixCh)}</span><span className="sr"> on TradingView, opens in a new tab</span></a></div>
      {pulse.data?.quotes.NIFTY && <div style={{ marginTop: 8 }}><Spark c={pulse.data.quotes.NIFTY.c} up={(niftyCh ?? 0) >= 0} refs={[{ v: pulse.data.quotes.NIFTY.prev, kind: 'prev' }]} h={34} label="Nifty 50 today" /></div>}
    </section>

    <Head>Commodities, currencies, Bitcoin</Head>
    <MacroStrip />

    {/* the paper book, once. The auto book holds every engine pick; hand-taken trades appear only where they are a different pick */}
    {showAuto ? <a className="card glass" href="#/signals?v=auto" style={{ display: 'block', marginTop: 10 }}>
      <div className="row between"><span className="k">Paper book</span><span className="tag lime">Auto · open</span></div>
      <div className="row" style={{ gap: 14, marginTop: 8 }}>
        <Ring value={auto.slots} max={auto.cfg.maxOpen} label={`${auto.slots} of ${auto.cfg.maxOpen} positions in use`} color="var(--a2)"><Tick v={auto.slots}>{String(auto.slots)}</Tick><small>of {auto.cfg.maxOpen}</small></Ring>
        <div className="grow">
          <div className={`num amt ${tone(auto.sum.openPnl)}`} style={{ font: '600 1.75rem/1.1 var(--sans)' }}><Tick v={auto.sum.open ? auto.sum.openPnl : null}>{auto.sum.open ? money(auto.sum.openPnl) : '—'}</Tick></div>
          <div className="small dim">{auto.sum.open} open · {auto.sum.waiting} waiting{auto.dayTotal != null ? <> · today <b className={`num amt ${tone(auto.dayTotal)}`}>{money(auto.dayTotal)}</b></> : null}{auto.sum.closed ? <> · realised <b className={`num amt ${tone(auto.sum.closedPnl)}`}>{money(auto.sum.closedPnl)}</b></> : null}</div></div></div>
      {ownRows.length > 0 && <div className="small dim" style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}>Plus {ownRows.length} trade{ownRows.length === 1 ? '' : 's'} you took that the auto book does not hold{ownOpen.length ? <> · <b className={`num amt ${tone(ownPnl)}`}>{money(ownPnl)}</b> open</> : null}</div>}
    </a> : ownRows.length > 0 ? <a className="card glass" href="#/signals?v=tracker" style={{ display: 'block', marginTop: 10 }}>
      <div className="row between"><span className="k">Your paper trades</span><span className="tag lime">Open tracker</span></div>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: 4 }}>
        <div className={`num amt ${tone(ownPnl)}`} style={{ font: '600 1.75rem/1.1 var(--sans)' }}><Tick v={ownOpen.length ? ownPnl : null}>{ownOpen.length ? money(ownPnl) : '—'}</Tick></div>
        <div className="small dim" style={{ textAlign: 'right' }}>{ownOpen.length} open · {ownRows.filter((r) => r.v.status === 'pending' || r.v.status === 'waiting').length} waiting</div></div>
    </a> : null}

    {scr.loading && <Loading what="the market read" />}
    {scr.err && <Failed what="the market data" err={scr.err} retry={scr.retry} />}
    {scr.data && <>
      {/* tonight's picks: names and their live move; the auto book takes them, so there is nothing to tap here */}
      {total > 0 && <><Head aside={<a className="small" href="#/signals" style={{ textDecoration: 'underline' }}>All {total}</a>}>Tonight's picks</Head>
        <div className="strip" aria-label="Engine picks">{out!.runs.flatMap((r) => r.picks).map((p) => { const row = rows.find((x) => x.sym === p.sym); const lp = row ? livePrice(row, pickQ.data?.quotes[p.sym] ?? null) : null; const st = autoState(p);
          return <a key={p.engine + p.sym} className="tile" href={`#/c/${p.sym}`} style={{ minWidth: 118 }}>
            <div className="nm">{ENGINES.find((e) => e.id === p.engine)?.name ?? p.engine}</div>
            <div className="vv">{p.sym}</div>
            <div className={`small num ${tone(lp?.ch)}`}>{lp?.ch != null ? pct(lp.ch) : '—'}</div>
            <div className="small dim">{st === 'in' ? 'In book' : st === 'no' ? 'Not taken' : 'Next open'}</div></a>; })}</div></>}

      {/* the trend map, live */}
      <Head aside={<span className="small mute">{liveMap ? <><i className="dot-live" aria-hidden="true" /> live · <Ago at={breadth.at} /></> : `close of ${dayWord(day)}`}</span>}>Trend map</Head>
      <div className="card">
        <div className="row between"><span className="small"><b className="num up">{map.n ? Math.round((map.up / map.n) * 100) : '—'}%</b> in an uptrend</span><span className="small dim num">{map.n ? Math.round((map.down / map.n) * 100) : '—'}% in a downtrend</span></div>
        <div className="rangebar" role="img" aria-label={`Of ${map.n} liquid stocks, ${map.up} are in an uptrend, ${map.mixed} sideways and ${map.down} in a downtrend`}><i style={{ flexGrow: map.up || .01, background: 'var(--up)' }} /><i style={{ flexGrow: map.mixed || .01, background: 'var(--s3)' }} /><i style={{ flexGrow: map.down || .01, background: 'var(--down)' }} /></div>
        <div className="small mute" style={{ margin: '6px 0 8px' }}>{map.n} liquid names. Uptrend: price above the 50-day average, the 50-day above the 200-day.{liveMap ? ` Today's price used for the ${liveMap.repriced} names near a trend line; the rest use the close of ${dayWord(day)}.` : breadth.err ? ' Live update unavailable; showing the close.' : ''}</div>
        {map.sectors.length > 0 && <Heat cells={map.sectors.slice(0, 9).map((x) => ({ k: x.k, n: x.n, up: x.up, down: x.down }))} href={(c) => `#/discover?sector=${encodeURIComponent(c.k)}&trend=${c.up >= c.down ? 'up' : 'down'}`} />}
      </div>

      {/* only what needs you, and only when something does */}
      {(needs || !s.entries.length) && <div className="card" style={{ marginTop: 10, borderColor: 'var(--line2)' }}>
        <div className="k">Needs you</div>
        <div className="list" style={{ marginTop: 4 }}>
          {reviews.map((e) => <button key={e.id} className="li" style={{ textAlign: 'left', width: '100%' }} onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}><span className="tag peach">{reviewDue(e) === 'overdue' ? 'Overdue' : 'Today'}</span><span className="grow"><span className="sym">{e.sym}</span><span className="dim small trunc" style={{ display: 'block' }}>Review: {current(e).trigger || current(e).thesis}</span></span></button>)}
          {events.map((r) => <a key={r.sym} className="li" href={`#/c/${r.sym}`}><span className="tag">{dayWord(r.next_earnings)}</span><span className="grow"><span className="sym">{r.sym}</span><span className="dim small" style={{ display: 'block' }}>Results, estimated date</span></span></a>)}
          {!s.entries.length && !needs && <a className="li" href="#/discover"><span className="grow">Write your first thesis, in seven short fields.</span><span className="tag lime">Pick a name</span></a>}
        </div></div>}

      {changes.length > 0 && <><Head>Since you last looked</Head>
        <div className="card"><div className="list">{changes.map((c) => <a key={c.sym} className="li" href={`#/c/${c.sym}`}><span className="avatar">{c.sym.slice(0, 2)}</span><span className="grow"><span className="sym">{c.sym}</span><span className="dim small" style={{ display: 'block' }}>{[c.crossed.join(', '), isNum(c.pxPct) ? `${pct(c.pxPct)} since ${dayWord(c.since)}` : ''].filter(Boolean).join(' · ')}</span></span></a>)}</div></div></>}
      {!s.follows.length && s.entries.length > 0 && <p className="small dim" style={{ margin: '10px 2px 0' }}>Follow a name and Today reports what changed in it. <a href="#/discover" style={{ textDecoration: 'underline' }}>Find a name</a></p>}

      <Head>News</Head>
      <TodayNews syms={newsSyms} />

      <p className="mute small" style={{ marginTop: 10 }}>Screen: close of {dayWord(day)} ({fr.word.toLowerCase()}). Picks are starting points, not recommendations.</p>
    </>}
  </div>;
}
function addDays(d: string, n: number) { return new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10); }
