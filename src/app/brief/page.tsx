'use client';

import { stageWords } from '@/lib/barometer';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Async, Chg, PageHead, Rv, SectionHead, Skel, Spark } from '@/components/ui';
import { DataStamp } from '@/components/DataStamp';
import { SectorBars } from '@/components/SectorBars';
import { MarketSession } from '@/components/MarketSession';
import { useBarometer } from '@/lib/useBarometer';
import { useFeed, useQuotes, useSummary } from '@/lib/data';
import { dateLabel, num, pct, quoteState } from '@/lib/format';
import { plural } from '@/lib/status';
import { compositeRanks, currentMonthExcluded, rankSwing, readDelta, seasonRec } from '@/lib/support';
import type { Row } from '@/lib/types';
import { companyHref } from '@/lib/slug';
import { useToday } from '@/lib/useToday';
import { movers, sessionDate, sessionDay } from '@/lib/today';

const TOC: [string, string][] = [['read', 'The read'], ['valuation', 'Valuation'], ['week', 'The week'], ['screen', 'Rank changes'], ['seasonal', 'Seasonal record']];

export default function Brief() {
  const bar = useFeed('barometer');
  const pulse = useFeed('pulse');
  const screen = useFeed('screen');
  const season = useFeed('seasonality');
  const quotes = useQuotes();
  const sum = useSummary();
  const [copied, setCopied] = useState(false);
  // Which section is in view, for the index. Scroll position is read on a timer-coalesced scroll handler (no observer:
  // observers never fire in a background tab, and the index must still be right when the reader comes back).
  const [here, setHere] = useState('read');
  useEffect(() => {
    let t = 0;
    const read = () => {
      t = 0;
      const y = window.innerHeight * 0.3;
      let cur = TOC[0][0];
      for (const [id] of TOC) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= y) cur = id; }
      setHere(cur);
    };
    const on = () => { if (!t) t = window.setTimeout(read, 80); };
    window.addEventListener('scroll', on, { passive: true });
    read();
    return () => { window.removeEventListener('scroll', on); if (t) window.clearTimeout(t); };
  }, []);

  // The reading shown is the one the site uses everywhere: live when its session is newer than the published file.
  const baroView = useBarometer().view;
  const t = useMemo(() => (baroView ? { score: baroView.reading.score, band: baroView.reading.band, stage: baroView.reading.stage ?? { t: '—' }, nifty_date: baroView.session, drawdown_pct: baroView.reading.drawdownPct, vix: baroView.reading.vix, live: baroView.source === 'live' } : undefined), [baroView]);
  // The day (headline, movers, copied text) follows the site's one rule in lib/live.ts: live when it is a newer session.
  const { view: tv, day: today, live } = useToday(screen.data?.breadth.as_of ?? null);
  const rows = useMemo(() => screen.data?.rows ?? [], [screen.data]);

  // E07: rank swings with today's rank, the implied previous rank, the universe, the two builds compared and the factors that moved
  const ranks = useMemo(() => compositeRanks(rows as unknown as Parameters<typeof compositeRanks>[0]), [rows]);
  const moved = useMemo(() => rows
    .map((r) => ({ r, sw: rankSwing(r as unknown as Parameters<typeof rankSwing>[0], ranks.rank), d: readDelta((r as Row & { delta?: Record<string, number> }).delta) }))
    .filter((x): x is { r: Row; sw: NonNullable<typeof x.sw>; d: typeof x.d } => x.sw !== null)
    .sort((a, b) => Math.abs(b.sw.move) - Math.abs(a.sw.move)), [rows, ranks]);
  const [causeView, setCauseView] = useState<'all' | 'statements'>('all');
  const changes = (screen.data as (typeof screen.data & { changes?: { compared_with?: string; new?: number; moved?: number }; price_date?: string }) | null)?.changes ?? null;
  const priceDate = (screen.data as (typeof screen.data & { price_date?: string }) | null)?.price_date ?? screen.data?.breadth.as_of ?? null;
  const byCause = { market: moved.filter((x) => x.d.cause === 'market').length, statements: moved.filter((x) => x.d.cause === 'statements' || x.d.cause === 'mixed').length };
  const movedShown = (causeView === 'statements' ? moved.filter((x) => x.d.cause !== 'market') : moved).slice(0, 8);

  const month = new Date().getMonth();
  const monthName = new Date().toLocaleString('en-IN', { month: 'long' });
  const seasonal = useMemo(() => {
    const st = season.data?.stocks ?? {};
    const idx = new Map(rows.map((r) => [r.sym, r]));
    return Object.entries(st)
      .map(([sym, d]) => ({ sym, rec: seasonRec(d.m[month]), r: idx.get(sym) }))
      .filter((x): x is { sym: string; rec: NonNullable<ReturnType<typeof seasonRec>>; r: Row | undefined } => !!x.rec && x.rec.hit >= 75 && x.rec.n >= 8 && x.r?.vet?.s === 'cleared')
      .sort((a, b) => b.rec.hit - a.rec.hit || b.rec.median - a.rec.median).slice(0, 8);
  }, [season.data, rows, month]);
  const seasonGen = (season.data as (typeof season.data & { generated_at?: string; universe?: number; covered?: number; min_observations?: number }) | null);
  const excl = currentMonthExcluded(seasonGen?.generated_at, new Date());

  // The 200-day share and the close's sector medians come from the screen's own rows (/api/summary).
  const secs = sum.data?.sectors ?? [];
  const b200 = sum.data?.above200;
  const indexQuotes = (quotes.data?.quotes ?? []).filter((q) => ['nifty', 'sensex', 'banknifty', 'vix', 'spx', 'gold', 'crude', 'usdinr'].includes(q.id) && q.price !== null);

  const headline = useMemo(() => {
    if (!t) return '';
    // the Barometer keeps its own date: it is built from the index close, not from the day's prices
    const baro = `The barometer reads ${Math.round(t.score)}/100 (${t.band.t.toLowerCase()}) as of ${sessionDate(t.nifty_date)}${t.live ? ', computed live' : ''}.`;
    if (!today) return sum.error && live.error ? `${baro} The day's breadth could not be loaded, and nothing is estimated in its place.` : '';
    const tilt = today.up > today.down ? 'more stocks rose than fell' : today.up < today.down ? 'more stocks fell than rose' : 'as many stocks rose as fell';
    const when = today.source === 'live' ? `On ${sessionDay(today.session)} (live, ${tv.at} IST)` : `On ${dateLabel(today.session)}`;
    const flat = (today.flat ? `, ${today.flat} unchanged` : '') + (today.stale ? `; ${today.stale} with no trade this session left out` : '');
    // the 200-day share is a close figure (it needs the day's 200-day average), so it says which close when the day is live
    const share = b200 && b200.withHistory ? ` ${today.source === 'live' && sum.data ? `At the ${dateLabel(sum.data.as_of)} close, ` : ''}${b200.above} of ${b200.withHistory} stocks with a 200-day history (${Math.round((b200.above / b200.withHistory) * 100)}%) sat above their 200-day average.` : '';
    return `${when}, ${tilt} (${today.up} up, ${today.down} down${flat}). ${baro}${share}`;
  }, [t, today, tv.at, b200, sum.data, sum.error, live.error]);

  // The day's biggest moves, from the same source as the headline: the live snapshot over the whole screened universe, or the
  // screen's own one-day move at the close.
  const dayMoves = useMemo(() => {
    if (!today) return null;
    if (today.source === 'live' && live.snap && live.universe) {
      const snap = live.snap;
      return movers(live.universe.rows.map(([sym, , name]) => ({ sym, name, v: snap.pct[sym] ?? null })), 6);
    }
    if (!screen.data) return null;
    return movers(rows.map((r) => ({ sym: r.sym, name: r.name, v: tv.pct(r.sym, r.r1d) })), 6);
  }, [today, live.snap, live.universe, screen.data, rows, tv]);
  const dayTag = today?.source === 'live' ? `live, ${tv.at} IST` : today ? `${dateLabel(today.session)} close` : '';

  const copy = async () => {
    const dsecs = today?.sectors ?? secs;
    const lines = [`alpha brief — ${today?.source === 'live' ? `live prices, ${today.session} ${tv.at} IST` : `market data as of ${dateLabel(today?.session ?? screen.data?.breadth.as_of)}`}`, headline, '',
      ...indexQuotes.map((q) => `${q.name}: ${q.prefix}${num(q.price, q.dp)} (${pct(q.pct, 2)})`), '',
      dsecs.length ? `Sectors (median move, ${dayTag}): ↑ ${dsecs.slice(0, 3).map((s) => `${s.name} ${pct(s.median)}`).join(', ')} · ↓ ${dsecs.slice(-3).map((s) => `${s.name} ${pct(s.median)}`).join(', ')}` : '',
      dayMoves && dayMoves.up.length ? `Biggest rises (${dayTag}): ${dayMoves.up.slice(0, 3).map((m) => `${m.sym} ${pct(m.v, 2)}`).join(', ')}` : '',
      dayMoves && dayMoves.down.length ? `Biggest falls (${dayTag}): ${dayMoves.down.slice(0, 3).map((m) => `${m.sym} ${pct(m.v, 2)}`).join(', ')}` : '',
      'https://alpha.askakshay.com/brief/'];
    try { await navigator.clipboard.writeText(lines.filter(Boolean).join('\n')); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked: nothing to do */ }
  };

  return (
    <div className="sp">
      <PageHead eyebrow={today?.source === 'live' ? `Live prices ${tv.at} IST · screen of ${dateLabel(screen.data?.breadth.as_of)}` : screen.data ? `Market data as of ${dateLabel(screen.data.breadth.as_of)}` : 'Market data'} title="The brief," em="what the week changed." method="brief" />
      <section className="wrap" style={{ paddingTop: 0 }}><DataStamp ids={['screen', 'barometer']} /></section>
      <section className="wrap readgrid">
        <nav className="toc" aria-label="Sections of the brief">
          <div className="eyebrow">In this brief</div>
          {TOC.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={here === id ? 'true' : undefined}>{label}</a>)}
        </nav>
        <div style={{ minWidth: 0 }}>
        <div id="read" data-sec className="read-ink" style={{ marginBottom: 12 }}>
            <div className="eyebrow">The read</div>
            <p>{headline || (bar.error ? 'The market read could not be loaded. Nothing is estimated in its place.' : 'Reading the market…')}</p>
            <button className="chip" onClick={copy}>{copied ? 'Copied' : 'Copy as text'}</button>
          </div>

        <Async loading={bar.loading || sum.loading} error={null} rows={2}>
          <div id="valuation" data-sec />
          <Rv className="card tight">
            <div className="eyebrow">Price stage · from the Barometer, not a valuation measure</div>
            <div className="disp" style={{ fontSize: 34, margin: '6px 0 2px' }}>{t?.stage ? (stageWords('k' in t.stage ? t.stage.k : null) ?? t.stage.t) : '—'}</div>
            <p className="muted" style={{ margin: 0 }}>Barometer <b className="num">{typeof t?.score === 'number' ? Math.round(t.score) : '—'}</b>/100 · Nifty {num(t?.drawdown_pct, 1)}% below its 52-week high · VIX {num(t?.vix, 1)}.</p>
          </Rv>

          <div id="week" data-sec />
          <SectionHead eyebrow={`Past week · to the ${dateLabel(screen.data?.breadth.as_of)} close`} title="What moved this week" />
          <div className="grid g2">
            <Rv className="card tight"><div className="eyebrow">Biggest weekly gains</div><div className="list">{(pulse.data?.movers_up ?? []).slice(0, 6).map((m) => <Link key={m.sym} href={companyHref(m.sym)} className="li"><div><div className="t">{m.sym}</div><div className="s">{m.name}</div></div><Chg v={m.r1w} dp={0} /></Link>)}</div></Rv>
            <Rv className="card tight"><div className="eyebrow">Biggest weekly falls</div><div className="list">{(pulse.data?.movers_dn ?? []).slice(0, 6).map((m) => <Link key={m.sym} href={companyHref(m.sym)} className="li"><div><div className="t">{m.sym}</div><div className="s">{m.name}</div></div><Chg v={m.r1w} dp={0} /></Link>)}</div></Rv>
          </div>

          <div id="screen" data-sec />
          <SectionHead eyebrow="Screen" title="Rank changes between two builds" />
          <Async loading={screen.loading} error={screen.error} rows={1}>
            <section className="card br-rank">
              <p className="sp-note br-basis">Composite rank among <b className="num">{num(ranks.of)}</b> ranked companies (of {num(rows.length)} in the screen). Build of <b>{dateLabel(screen.data?.built_on ?? null)}</b>, prices to {dateLabel(priceDate)}, compared with the build of <b>{changes?.compared_with ? dateLabel(changes.compared_with) : 'a date the feed does not state'}</b>{typeof changes?.moved === 'number' ? `; ${num(changes.moved)} changed rank` : ''}{changes?.new ? `, ${num(changes.new)} new to the screen and not ranked before` : ''}.</p>
              {moved.length === 0 ? <div className="state"><b>No rank changes are recorded in the latest build.</b><p>Either the build matched the previous one or the comparison was not published.</p></div> : (
                <>
                  <div className="sp-seg br-seg" role="group" aria-label="Which rank changes">
                    <button type="button" aria-pressed={causeView === 'all'} onClick={() => setCauseView('all')}>Largest swings</button>
                    <button type="button" aria-pressed={causeView === 'statements'} onClick={() => setCauseView('statements')}>Statement-driven <span className="num">{byCause.statements}</span></button>
                  </div>
                  {movedShown.length === 0 ? <div className="state"><b>No rank change came from the statement-based scores.</b><p>Every recorded swing here moved with prices ({num(byCause.market)} of {num(moved.length)}): the technical score, RSI, P/E or the valuation score. None looks like a data correction or new results.</p></div> : (
                    <ul className="rows">
                      {movedShown.map(({ r, sw, d }) => (
                        <li key={r.sym}>
                          <Link href={companyHref(r.sym)} className="row br-row">
                            <span className="br-id"><span className="row-t">{r.sym} <span className="dim br-nm">{r.name}</span></span>
                              <span className="row-s br-why">{d.factors.slice(0, 3).map((f) => `${f.label} ${f.v > 0 ? '+' : '−'}${num(Math.abs(f.v), 1)}`).join(' · ') || 'Changed factors not in the feed'}</span>
                              <span className={`br-cause ${d.cause}`}>{d.cause === 'market' ? 'Market move: only price-based factors changed' : d.cause === 'statements' ? 'Statement change: quality or growth moved, from new results or a data revision (the feed does not say which)' : d.cause === 'mixed' ? 'Mixed: prices moved, and so did a statement-based score (new results or a data revision)' : 'Cause not detectable from the feed'}</span></span>
                            <span className="row-r"><b className={sw.move > 0 ? 'up' : 'down'}>{sw.move > 0 ? '▲' : '▼'} {Math.abs(sw.move)}</b><small className="num">#{sw.before} → #{sw.now} of {num(ranks.of)}</small></span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="card-foot">Today&apos;s rank is computed here from the published composite; the previous rank is that rank plus the recorded move. {num(byCause.market)} of {num(moved.length)} swings moved with prices alone. Only the previous-build comparison exists; a longer rank history is not stored.</p>
                </>
              )}
            </section>
          </Async>

          <div id="seasonal" data-sec />
          <SectionHead eyebrow={monthName} title="The seasonal record" />
          <section className="card br-season">
            <p className="sp-note br-basis"><b>Descriptive only: this records what happened in past {monthName}s, not what will happen in this one.</b> Vetted companies up in at least 75% of at least 8 completed {monthName}s{seasonGen?.years ? `, in a window of up to ${seasonGen.years} years` : ''}. {excl === 'before-month' ? `${monthName} ${new Date().getFullYear()} is not in the sample: the record was built on ${dateLabel(seasonGen?.generated_at?.slice(0, 10) ?? null)}, before the month began.` : excl === 'by-rule' ? `The record was built during ${monthName}; the pipeline counts completed months only, so the month now running is left out by its rule.` : 'The build date is not in the feed, so it cannot be shown that the month now running is left out.'}</p>
            {season.error ? <div className="state"><b>The seasonal record did not load.</b><p>Nothing is shown in its place.</p></div> : seasonal.length === 0 ? <div className="state"><b>No vetted company clears the 75% bar for {monthName}.</b><p>That is the rule working, not missing data.</p></div> : (
              <div className="sp-tblwrap" tabIndex={0} role="region" aria-label={`Seasonal record for ${monthName}`}>
                <table className="sp-tbl br-tbl">
                  <thead><tr><th scope="col">Company</th><th scope="col" className="r">Years up</th><th scope="col" className="r">Years down</th><th scope="col" className="r">Sample</th><th scope="col" className="r">Median {monthName}</th><th scope="col">Worst year</th></tr></thead>
                  <tbody>{seasonal.map(({ sym, rec, r }) => (
                    <tr key={sym}>
                      <td className="co"><Link href={companyHref(sym)}><b>{sym}</b></Link><span>{r?.name}</span></td>
                      <td className="r num">{rec.up} <small>{rec.hit}%</small></td>
                      <td className="r num"><span className={rec.down > 0 ? 'down' : undefined}>{rec.down}</span></td>
                      <td className="r num">{plural(rec.n, 'year')}</td>
                      <td className="r"><Chg v={rec.median} dp={1} /></td>
                      <td className="dim">not in the feed</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <p className="card-foot">{(season.data?.caveats ?? []).join(' ')} The feed publishes each month&apos;s hit rate, median and sample size, but not the individual years, so the size of the worst {monthName} cannot be shown; {seasonal.length > 0 ? 'the down-year count is how often it lost.' : ''}</p>
          </section>
        </Async>
        </div>
      </section>
    </div>
  );
}
