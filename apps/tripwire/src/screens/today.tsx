import { useEffect, useMemo } from 'react';
import { go, setState, useAppState, useSheets } from '../app.tsx';
import { Empty } from '../ui.tsx';
import { Head, Loading, Failed, PageBar, CompanyRow } from './common.tsx';
import { freshness } from '../fresh.ts';
import { changesSince, istDay, recordSnap, reviewDue, current } from '../store.ts';
import { dayWord, isNum, pct } from '../fmt.ts';
import { useEngines } from '../useEngines.ts';
import { ENGINES } from '../quant.ts';
import { trendOf, TREND_WORD, type Row } from '../screen.ts';
import { useBacktest, usePulse } from '../data.ts';
import { engineEvidence } from '../evidence.ts';
import { useLiveBook } from '../book.ts';
import { Ago, LiveBadge, Spark, Tick, TvButton } from '../live.tsx';
import { tvIndexUrl } from '../tv.ts';
import { sessionNow } from '../market.ts';
import { usePaperTake } from './signals.tsx';
import { inr0 } from '../fmt.ts';

const NAMES: { k: string; label: string; invert?: boolean }[] = [{ k: 'NIFTY', label: 'Nifty 50' }, { k: 'BANKNIFTY', label: 'Bank Nifty' }, { k: 'VIX', label: 'India VIX', invert: true }];
const money = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);

export function Today() {
  const s = useAppState(); const { open } = useSheets(); const take = usePaperTake(); const bt = useBacktest();
  const { scr, out } = useEngines();
  const rows = scr.data?.rows ?? []; const day = scr.data?.as_of ?? null; const fr = freshness(day); const today = istDay();
  const pulse = usePulse(true); const book = useLiveBook(true);
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
  // trend map: how the liquid universe splits, and which sectors are most in an uptrend
  const map = useMemo(() => {
    const c = { up: 0, mixed: 0, down: 0 }; const by = new Map<string, { n: number; up: number; down: number }>();
    for (const r of rows) { if (!r.liquid) continue; const t = trendOf(r).trend; if (!t) continue; c[t]++; const k = r.sector ?? 'Other'; const e = by.get(k) ?? { n: 0, up: 0, down: 0 }; e.n++; if (t === 'up') e.up++; if (t === 'down') e.down++; by.set(k, e); }
    const n = c.up + c.mixed + c.down;
    const sectors = [...by.entries()].filter(([, e]) => e.n >= 8).map(([k, e]) => ({ k, n: e.n, up: (e.up / e.n) * 100, down: (e.down / e.n) * 100 })).sort((a, b) => b.up - a.up);
    return { c, n, sectors };
  }, [rows]);
  const total = out?.picks.length ?? 0; const bookN = book.active.length;
  const next = reviews.length ? { t: `Review ${reviews[0].sym}: your date has come.`, go: () => open({ k: 'thesis', sym: reviews[0].sym, id: reviews[0].id }), cta: 'Open review' }
    : total && !bookN ? { t: 'The engines have picks. Take one on paper and Tripwire follows it live.', go: () => go('/signals'), cta: 'See the picks' }
    : !s.entries.length ? { t: 'Write your first thesis, in seven short fields.', go: () => go('/discover'), cta: 'Pick a name' }
    : !s.follows.length ? { t: 'Follow a name so Today can tell you what changed in it.', go: () => go('/discover'), cta: 'Find a name' }
    : { t: 'Nothing is due. Check the paper book against its stops.', go: () => go('/signals?v=tracker'), cta: 'Open the tracker' };
  const openRows = book.rows.filter((r) => r.v.status === 'open');

  return <div>
    <PageBar title="Today" sub={<><span className={sess.phase === 'open' ? 'up' : ''}>{sess.label}</span> · {sess.detail}</>} />
    {/* 1. the live market strip */}
    <div className="strip" role="list" aria-label="Indices">
      {NAMES.map(({ k, label, invert }) => { const q = pulse.data?.quotes[k]; const ch = q ? (q.px / q.prev - 1) * 100 : null; const good = ch == null ? null : invert ? ch < 0 : ch >= 0;
        return <a key={k} role="listitem" className="tile" href={tvIndexUrl(k)} target="_blank" rel="noopener noreferrer" >
          <div className="nm">{label}<span className="sr"> on TradingView, opens in a new tab</span></div>
          <div className="vv num"><Tick v={q?.px}>{q ? q.px.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</Tick></div>
          <div className={`small num ${good == null ? 'dim' : good ? 'up' : 'down'}`}>{ch == null ? (pulse.err ? 'unavailable' : '…') : pct(ch)}</div>
          <div style={{ marginTop: 4 }}>{q ? <Spark c={q.c} up={good !== false} refs={[{ v: q.prev, kind: 'prev' }]} h={22} label={`${label} today`} /> : <div className="sk" style={{ height: 22 }} />}</div></a>; })}
    </div>
    <div className="row between small mute" style={{ marginTop: 4 }}><LiveBadge live={sess.phase === 'open' && !!anyLive} label={sess.phase === 'open' && anyLive ? 'LIVE · delayed about 15 min' : 'Last prices'} /><span>{pulse.err ? <span className="down">index prices unavailable</span> : pulse.at ? <>updated <Ago at={pulse.at} /></> : ''}</span></div>

    {/* 2. the paper book, live */}
    {bookN > 0 && <a className="card glass" href="#/signals?v=tracker" style={{ display: 'block', marginTop: 10 }}>
      <div className="row between"><span className="k">Paper book</span><span className="tag lime">Open tracker</span></div>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: 4 }}>
        <div className={`num ${book.sum.openPnl > 0 ? 'up' : book.sum.openPnl < 0 ? 'down' : ''}`} style={{ font: '600 28px/1.1 var(--sans)' }}><Tick v={openRows.length ? book.sum.openPnl : null}>{openRows.length ? money(book.sum.openPnl) : '—'}</Tick></div>
        <div className="small dim" style={{ textAlign: 'right' }}>{book.sum.open} open · {book.sum.waiting} waiting{book.dayTotal != null ? <> · today <b className={`num ${book.dayTotal >= 0 ? 'up' : 'down'}`}>{money(book.dayTotal)}</b></> : null}</div></div>
    </a>}

    {scr.loading && <Loading what="the market read" />}
    {scr.err && <Failed what="the market data" err={scr.err} retry={scr.retry} />}
    {scr.data && <>
      {/* 3. what the engines found tonight, swipeable */}
      <Head aside={<span className="tag num">{total}</span>}>Engine picks (experiments)</Head>
      {total ? <div className="strip" aria-label="Engine picks">{out!.runs.flatMap((r) => r.picks.slice(0, 3)).map((p) => { const row = rows.find((x) => x.sym === p.sym); const def = ENGINES.find((e) => e.id === p.engine)!; const have = s.paper.some((x) => x.sym === p.sym && !x.closedByUser);
        return <div key={p.engine + p.sym} className="tile" style={{ minWidth: 200 }}>
          <div className="nm">{def.name}</div><div style={{ margin: '3px 0' }}><span className={`tag ${engineEvidence(def.id, bt.data).tone === 'bad' ? 'peach' : ''}`} style={{ fontSize: 10 }}>{engineEvidence(def.id, bt.data).short}</span></div>
          <a href={`#/c/${p.sym}`} style={{ display: 'block' }}><div className="vv">{p.sym} <span className="tag lime num" style={{ verticalAlign: 'middle' }}>{p.score}</span></div>
            <div className="small dim trunc" style={{ maxWidth: 176 }}>{p.name}</div>
            <div className="small num" style={{ marginTop: 4 }}>{inr0(p.ref)} · stop {p.stopPct}% below{row ? <> · {TREND_WORD[trendOf(row).trend ?? 'mixed']}</> : null}</div></a>
          <div className="row" style={{ gap: 6, marginTop: 8 }}><button className={`btn sm grow ${have ? '' : 'pri'}`} disabled={have} onClick={() => take(p)}>{have ? 'In book' : 'Paper trade'}</button><TvButton sym={p.sym} className="btn sm" label="" /></div></div>; })}
        <a className="tile" href="#/signals" style={{ minWidth: 110, display: 'grid', placeItems: 'center', textAlign: 'center' }}><span className="small">All {total} picks →</span></a></div>
        : <Empty title="No pick tonight">Each engine publishes only names that pass every one of its filters. When none do, Tripwire shows none.</Empty>}

      {/* 4. the trend map: where the market is strong, by sector */}
      <Head>Trend map</Head>
      <div className="card">
        <div className="row between"><span className="small"><b className="num up">{map.n ? Math.round((map.c.up / map.n) * 100) : '—'}%</b> in an uptrend</span><span className="small dim num">{map.n ? Math.round((map.c.down / map.n) * 100) : '—'}% in a downtrend</span></div>
        <div className="rangebar" role="img" aria-label={`Of ${map.n} liquid stocks, ${map.c.up} are in an uptrend, ${map.c.mixed} mixed and ${map.c.down} in a downtrend`}><i style={{ flexGrow: map.c.up || .01, background: 'var(--lime)' }} /><i style={{ flexGrow: map.c.mixed || .01, background: 'var(--s3)' }} /><i style={{ flexGrow: map.c.down || .01, background: 'var(--peach)' }} /></div>
        <div className="small mute" style={{ margin: '6px 0 8px' }}>{map.n} liquid names at the close of {dayWord(day)}. Uptrend: price above the 50-day average, the 50-day above the 200-day.</div>
        {map.sectors.slice(0, 5).map((x) => <a key={x.k} className="contrib" href={`#/discover?sector=${encodeURIComponent(x.k)}&trend=up`} style={{ gridTemplateColumns: '1fr 80px 38px' }}><span className="trunc">{x.k}</span><span className="bar2"><i style={{ width: `${x.up}%`, left: 0, background: 'var(--lime)' }} /></span><span className="num up" style={{ textAlign: 'right' }}>{Math.round(x.up)}%<span className="sr"> of {x.n} {x.k} names are in an uptrend. Opens Discover.</span></span></a>)}
        {map.sectors.length > 5 && <details className="ev" style={{ marginTop: 8 }}><summary>Weakest sectors<span className="chev">▾</span></summary><div className="body">{[...map.sectors].reverse().slice(0, 4).map((x) => <a key={x.k} className="contrib" href={`#/discover?sector=${encodeURIComponent(x.k)}&trend=down`} style={{ gridTemplateColumns: '1fr 80px 38px' }}><span className="trunc">{x.k}</span><span className="bar2"><i style={{ width: `${x.down}%`, left: 0, background: 'var(--peach)' }} /></span><span className="num down" style={{ textAlign: 'right' }}>{Math.round(x.down)}%</span></a>)}<p className="small mute" style={{ margin: '6px 0 0' }}>Share of each sector in a downtrend.</p></div></details>}
      </div>

      <div className="card" style={{ marginTop: 10, borderColor: 'var(--line2)' }}>
        <div className="k">One thing to do</div>
        <p style={{ margin: '6px 0 10px', fontSize: 14.5 }}>{next.t}</p>
        <button className="btn pri" onClick={next.go}>{next.cta}</button>
      </div>

      <Head>Since you last looked</Head>
      {!s.follows.length ? <Empty title="You follow nothing yet">Follow a name and Tripwire will report what moved, from your second visit on.</Empty>
        : changes.length ? <div className="card"><div className="list">{changes.map((c) => <a key={c.sym} className="li" href={`#/c/${c.sym}`}><span className="avatar">{c.sym.slice(0, 2)}</span><span className="grow"><span className="sym">{c.sym}</span><span className="dim small" style={{ display: 'block' }}>{[c.crossed.join(', '), isNum(c.pxPct) ? `${pct(c.pxPct)} since ${dayWord(c.since)}` : ''].filter(Boolean).join(' · ')}</span></span></a>)}</div></div>
        : <div className="card dim">Nothing material in {s.follows.length} followed name{s.follows.length > 1 ? 's' : ''} against the last stored day. Quiet is a result.</div>}

      {(reviews.length > 0 || events.length > 0) && <><Head>Coming up</Head>
        <div className="card"><div className="list">
          {reviews.map((e) => <button key={e.id} className="li" style={{ textAlign: 'left', width: '100%' }} onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}><span className="tag peach">{reviewDue(e) === 'overdue' ? 'Overdue' : 'Today'}</span><span className="grow"><span className="sym">{e.sym}</span><span className="dim small trunc" style={{ display: 'block' }}>Review: {current(e).trigger || current(e).thesis}</span></span></button>)}
          {events.map((r) => <a key={r.sym} className="li" href={`#/c/${r.sym}`}><span className="tag">{dayWord(r.next_earnings)}</span><span className="grow"><span className="sym">{r.sym}</span><span className="dim small" style={{ display: 'block' }}>Results, estimated date</span></span></a>)}
        </div></div></>}
      <p className="mute small" style={{ marginTop: 10 }}>Screen data: close of {dayWord(day)} ({fr.word.toLowerCase()}). Picks are starting points to investigate, not recommendations.</p>
    </>}
  </div>;
}
function addDays(d: string, n: number) { return new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10); }
