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
import { useAutoBook, useLiveBook } from '../book.ts';
import { MacroStrip } from './Macro.tsx';
import { TodayNews } from './News.tsx';
import { Ago, LiveBadge, Spark, Tick, TvButton } from '../live.tsx';
import { Aurora } from '../aurora.tsx';
import { Heat, Ring, Tape, type TapeItem } from '../widgets.tsx';
import { mood } from '../mood.ts';
import { MACRO, fmtMacro, useMacro } from '../macro.ts';
import { Icon } from '../ui.tsx';
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
  // trend map: how the liquid universe splits, and which sectors are most in an uptrend
  const map = useMemo(() => {
    const c = { up: 0, mixed: 0, down: 0 }; const by = new Map<string, { n: number; up: number; down: number }>();
    for (const r of rows) { if (!r.liquid) continue; const t = trendOf(r).trend; if (!t) continue; c[t]++; const k = r.sector ?? 'Other'; const e = by.get(k) ?? { n: 0, up: 0, down: 0 }; e.n++; if (t === 'up') e.up++; if (t === 'down') e.down++; by.set(k, e); }
    const n = c.up + c.mixed + c.down;
    const sectors = [...by.entries()].filter(([, e]) => e.n >= 8).map(([k, e]) => ({ k, n: e.n, up: (e.up / e.n) * 100, down: (e.down / e.n) * 100 })).sort((a, b) => b.up - a.up);
    return { c, n, sectors };
  }, [rows]);
  const chOf = (k: string) => { const q = pulse.data?.quotes[k]; return q ? (q.px / q.prev - 1) * 100 : null; };
  const niftyCh = chOf('NIFTY'), bankCh = chOf('BANKNIFTY'), vixCh = chOf('VIX'); const md = mood(niftyCh, bankCh, vixCh);
  const macro = useMacro(true);
  const tape: TapeItem[] = [
    ...NAMES.map(({ k, label }) => { const q = pulse.data?.quotes[k]; return q ? { k, label, text: q.px.toLocaleString('en-IN', { maximumFractionDigits: 2 }), ch: chOf(k) } : null; }),
    ...MACRO.map((d) => { const q = macro.data?.quotes[d.key]; return q ? { k: d.key, label: d.label, text: fmtMacro(d, q.px), ch: (q.px / q.prev - 1) * 100 } : null; }),
  ].filter((x): x is TapeItem => !!x);
  const total = out?.picks.length ?? 0; const bookN = book.active.length;
  const next = reviews.length ? { t: `Review ${reviews[0].sym}: your date has come.`, go: () => open({ k: 'thesis', sym: reviews[0].sym, id: reviews[0].id }), cta: 'Open review' }
    : total && !bookN && !auto.rows.length ? { t: 'The engines have picks. Take one on paper and Tripwire follows it live.', go: () => go('/signals'), cta: 'See the picks' }
    : !s.entries.length ? { t: 'Write your first thesis, in seven short fields.', go: () => go('/discover'), cta: 'Pick a name' }
    : !s.follows.length ? { t: 'Follow a name so Today can tell you what changed in it.', go: () => go('/discover'), cta: 'Find a name' }
    : { t: 'Nothing is due. Check the paper book against its stops.', go: () => go('/signals?v=tracker'), cta: 'Open the tracker' };
  const openRows = book.rows.filter((r) => r.v.status === 'open');
  const autoTaken = (p: { sym: string; engine: string; asOf: string }) => !!auto.plan?.taken.some((t) => t.pick.sym === p.sym && t.pick.engine === p.engine && t.pick.asOf === p.asOf);
  const autoWhy = (p: { sym: string; engine: string; asOf: string }) => auto.plan?.refused.find((t) => t.pick.sym === p.sym && t.pick.engine === p.engine && t.pick.asOf === p.asOf)?.why ?? null;
  const newsSyms = [...new Set([...auto.rows.filter((r) => r.v.status === 'open' || r.v.status === 'pending' || r.v.status === 'waiting').map((r) => r.p.sym), ...book.active.map((p) => p.sym), ...s.follows])];

  return <div>
    <PageBar title="Today" sub={<><span className={sess.phase === 'open' ? 'up' : ''}>{sess.label}</span> · {sess.detail}</>} right={<button className="icon-btn" aria-pressed={!!s.prefs.hideAmounts} aria-label={s.prefs.hideAmounts ? 'Show my amounts' : 'Hide my amounts'} onClick={() => { setState((x) => ({ ...x, prefs: { ...x.prefs, hideAmounts: !x.prefs.hideAmounts } })); }}><Icon n={s.prefs.hideAmounts ? 'eyeoff' : 'eye'} /></button>} />
    {/* 0. the market mood, on live water */}
    <section className="moodhero card glass" aria-label="Market mood">
      <Aurora ch={niftyCh} vix={vixCh} />
      <div className="row between"><span className="k">Market mood</span><LiveBadge live={sess.phase === 'open' && !!anyLive} label={sess.phase === 'open' && anyLive ? 'LIVE' : 'Last prices'} /></div>
      {md ? <div className="word grad-text" style={{ margin: '6px 0 2px' }}>{md.word}</div> : <div className="sk" style={{ height: 32, width: '45%', margin: '8px 0' }} />}
      <div className="big num">{pulse.data?.quotes.NIFTY ? <><Tick v={pulse.data.quotes.NIFTY.px}>{pulse.data.quotes.NIFTY.px.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Tick> <span className={niftyCh != null && niftyCh >= 0 ? 'up' : 'down'}>{pct(niftyCh)}</span> <span className="dim small">Nifty 50</span></> : <span className="dim">{pulse.err ? 'Index prices unavailable' : 'Reading the market…'}</span>}</div>
      <p className="small dim" style={{ margin: '6px 0 0' }}>A description of today's move in the Nifty, Bank Nifty and VIX. Not a forecast.</p>
    </section>
    <div style={{ marginTop: 10 }}><Tape items={tape} /></div>
    {/* 1. the live market strip */}
    <div className="strip" role="list" aria-label="Indices">
      {NAMES.map(({ k, label, invert }) => { const q = pulse.data?.quotes[k]; const ch = q ? (q.px / q.prev - 1) * 100 : null; const good = ch == null ? null : invert ? ch < 0 : ch >= 0;
        return <a key={k} role="listitem" className={`tile ${good == null ? '' : good ? 'upc' : 'dn'}`} href={tvIndexUrl(k)} target="_blank" rel="noopener noreferrer" >
          <div className="nm">{label}<span className="sr"> on TradingView, opens in a new tab</span></div>
          <div className="vv num"><Tick v={q?.px}>{q ? q.px.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</Tick></div>
          <div className={`small num ${good == null ? 'dim' : good ? 'up' : 'down'}`}>{ch == null ? (pulse.err ? 'unavailable' : '…') : pct(ch)}</div>
          <div style={{ marginTop: 4 }}>{q ? <Spark c={q.c} up={good !== false} refs={[{ v: q.prev, kind: 'prev' }]} h={22} label={`${label} today`} /> : <div className="sk" style={{ height: 22 }} />}</div></a>; })}
    </div>
    <div className="row between small mute" style={{ marginTop: 4 }}><LiveBadge live={sess.phase === 'open' && !!anyLive} label={sess.phase === 'open' && anyLive ? 'LIVE' : 'Last prices'} /><span>{pulse.err ? <span className="down">index prices unavailable</span> : pulse.at ? <>updated <Ago at={pulse.at} /></> : ''}</span></div>

    <Head>Commodities, currencies, Bitcoin</Head>
    <MacroStrip />

    {/* 2. the paper books, live */}
    {auto.rows.length > 0 && <a className="card glass" href="#/signals?v=auto" style={{ display: 'block', marginTop: 10 }}>
      <div className="row between"><span className="k">Auto paper book</span><span className="tag lime">Open</span></div>
      <div className="row" style={{ gap: 14, marginTop: 8 }}>
        <Ring value={auto.slots} max={auto.cfg.maxOpen} label={`${auto.slots} of ${auto.cfg.maxOpen} positions in use`} color="var(--a2)"><Tick v={auto.slots}>{String(auto.slots)}</Tick><small>of {auto.cfg.maxOpen}</small></Ring>
        <div className="grow">
          <div className={`num amt ${auto.sum.openPnl > 0 ? 'up' : auto.sum.openPnl < 0 ? 'down' : ''}`} style={{ font: '600 1.75rem/1.1 var(--sans)' }}><Tick v={auto.sum.open ? auto.sum.openPnl : null}>{auto.sum.open ? money(auto.sum.openPnl) : '—'}</Tick></div>
          <div className="small dim">{auto.sum.open} open · {auto.sum.waiting} waiting{auto.dayTotal != null ? <> · today <b className={`num amt ${auto.dayTotal >= 0 ? 'up' : 'down'}`}>{money(auto.dayTotal)}</b></> : null}{auto.sum.closed ? <> · realised <b className={`num amt ${auto.sum.closedPnl >= 0 ? 'up' : 'down'}`}>{money(auto.sum.closedPnl)}</b></> : null}</div></div></div>
    </a>}

    {/* 2b. your own paper trades */}
    {bookN > 0 && <a className="card glass" href="#/signals?v=tracker" style={{ display: 'block', marginTop: 10 }}>
      <div className="row between"><span className="k">Your paper trades</span><span className="tag lime">Open tracker</span></div>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: 4 }}>
        <div className={`num amt ${book.sum.openPnl > 0 ? 'up' : book.sum.openPnl < 0 ? 'down' : ''}`} style={{ font: '600 1.75rem/1.1 var(--sans)' }}><Tick v={openRows.length ? book.sum.openPnl : null}>{openRows.length ? money(book.sum.openPnl) : '—'}</Tick></div>
        <div className="small dim" style={{ textAlign: 'right' }}>{book.sum.open} open · {book.sum.waiting} waiting{book.dayTotal != null ? <> · today <b className={`num amt ${book.dayTotal >= 0 ? 'up' : 'down'}`}>{money(book.dayTotal)}</b></> : null}</div></div>
    </a>}

    {scr.loading && <Loading what="the market read" />}
    {scr.err && <Failed what="the market data" err={scr.err} retry={scr.retry} />}
    {scr.data && <>
      {/* 3. what the engines found tonight, swipeable */}
      <Head aside={<span className="tag num">{total}</span>}>Engine picks (experiments)</Head>
      {total ? <div className="strip" aria-label="Engine picks">{out!.runs.flatMap((r) => r.picks.slice(0, 3)).map((p) => { const row = rows.find((x) => x.sym === p.sym); const def = ENGINES.find((e) => e.id === p.engine)!; const have = s.paper.some((x) => x.sym === p.sym && !x.closedByUser);
        return <div key={p.engine + p.sym} className="tile" style={{ minWidth: 200 }}>
          <div className="nm">{def.name}</div><div style={{ margin: '3px 0' }}><span className={`tag ${engineEvidence(def.id, bt.data).tone === 'bad' ? 'peach' : ''}`} style={{ fontSize: '0.625rem' }}>{engineEvidence(def.id, bt.data).short}</span></div>
          <a href={`#/c/${p.sym}`} style={{ display: 'block' }}><div className="vv">{p.sym} <span className="tag lime num" style={{ verticalAlign: 'middle' }}>{p.score}</span></div>
            <div className="small dim trunc" style={{ maxWidth: 176 }}>{p.name}</div>
            <div className="small num" style={{ marginTop: 4 }}>{inr0(p.ref)} · stop {p.stopPct}% below{row ? <> · {TREND_WORD[trendOf(row).trend ?? 'mixed']}</> : null}</div></a>
          <div className="row" style={{ gap: 6, marginTop: 8 }}>{autoTaken(p) ? <span className="tag lime grow" style={{ justifyContent: 'center' }}>In auto book</span> : autoWhy(p) ? <span className="tag peach grow" style={{ justifyContent: 'center', whiteSpace: 'normal', textAlign: 'center' }} title={autoWhy(p)!}>Not taken</span> : <button className={`btn sm grow ${have ? '' : 'pri'}`} disabled={have} onClick={() => take(p)}>{have ? 'In book' : 'Paper trade'}</button>}<TvButton sym={p.sym} className="btn sm" label="" /></div></div>; })}
        <a className="tile" href="#/signals" style={{ minWidth: 110, display: 'grid', placeItems: 'center', textAlign: 'center' }}><span className="small">All {total} picks →</span></a></div>
        : <Empty title="No pick tonight">Each engine publishes only names that pass every one of its filters. When none do, Tripwire shows none.</Empty>}

      {/* 4. the trend map: where the market is strong, by sector */}
      <Head>Trend map</Head>
      <div className="card">
        <div className="row between"><span className="small"><b className="num up">{map.n ? Math.round((map.c.up / map.n) * 100) : '—'}%</b> in an uptrend</span><span className="small dim num">{map.n ? Math.round((map.c.down / map.n) * 100) : '—'}% in a downtrend</span></div>
        <div className="rangebar" role="img" aria-label={`Of ${map.n} liquid stocks, ${map.c.up} are in an uptrend, ${map.c.mixed} sideways and ${map.c.down} in a downtrend`}><i style={{ flexGrow: map.c.up || .01, background: 'var(--up)' }} /><i style={{ flexGrow: map.c.mixed || .01, background: 'var(--s3)' }} /><i style={{ flexGrow: map.c.down || .01, background: 'var(--down)' }} /></div>
        <div className="small mute" style={{ margin: '6px 0 8px' }}>{map.n} liquid names at the close of {dayWord(day)}. Uptrend: price above the 50-day average, the 50-day above the 200-day.</div>
        {map.sectors.length > 0 && <Heat cells={map.sectors.slice(0, 9).map((x) => ({ k: x.k, n: x.n, up: x.up, down: x.down }))} href={(c) => `#/discover?sector=${encodeURIComponent(c.k)}&trend=${c.up >= c.down ? 'up' : 'down'}`} />}
      </div>

      <div className="card" style={{ marginTop: 10, borderColor: 'var(--line2)' }}>
        <div className="k">One thing to do</div>
        <p style={{ margin: '6px 0 10px', fontSize: '0.9062rem' }}>{next.t}</p>
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
      <Head>News</Head>
      <TodayNews syms={newsSyms} />

      <p className="mute small" style={{ marginTop: 10 }}>Screen data: close of {dayWord(day)} ({fr.word.toLowerCase()}). Picks are starting points to investigate, not recommendations.</p>
    </>}
  </div>;
}
function addDays(d: string, n: number) { return new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10); }
