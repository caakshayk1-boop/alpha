'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Async, Chg, PageHead, Rv, SectionHead, Skel, Spark } from '@/components/ui';
import { DataStamp } from '@/components/DataStamp';
import { SectorBars } from '@/components/SectorBars';
import { MarketSession } from '@/components/MarketSession';
import { EngineVerdict } from '@/components/EvidenceTags';
import { useBarometer } from '@/lib/useBarometer';
import { useEngines, useFeed, useQuotes, useSummary } from '@/lib/data';
import { dateLabel, num, pct, quoteState } from '@/lib/format';
import { plural } from '@/lib/status';
import type { Row } from '@/lib/types';
import { companyHref } from '@/lib/slug';
import { useToday } from '@/lib/useToday';
import { movers, sessionDate, sessionDay } from '@/lib/today';

const TOC: [string, string][] = [['read', 'The read'], ['quotes', 'Quotes'], ['sectors', 'Sectors'], ['moved', 'What moved'], ['screen', 'Screen changes'], ['calendar', 'Calendar'], ['seasonal', 'Seasonal record'], ['engines', 'Engines'], ['wire', 'Headlines']];
const has = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const daysUntil = (iso: string) => Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);

export default function Brief() {
  const bar = useFeed('barometer');
  const pulse = useFeed('pulse');
  const screen = useFeed('screen');
  const ipo = useFeed('ipo');
  const news = useFeed('news');
  const season = useFeed('seasonality');
  const quotes = useQuotes();
  const sum = useSummary();
  const eng = useEngines();
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

  const moved = useMemo(() => rows.filter((r) => has((r as Row & { rank_move?: number }).rank_move)).sort((a, b) => Math.abs((b as Row & { rank_move: number }).rank_move) - Math.abs((a as Row & { rank_move: number }).rank_move)).slice(0, 6), [rows]);

  const results = useMemo(() => rows
    .filter((r) => r.next_earnings && daysUntil(r.next_earnings) >= 0 && daysUntil(r.next_earnings) <= 14)
    .sort((a, b) => (a.next_earnings as string).localeCompare(b.next_earnings as string) || (b.mcap_cr ?? 0) - (a.mcap_cr ?? 0)), [rows]);
  const byDay = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of results) m.set(r.next_earnings as string, [...(m.get(r.next_earnings as string) ?? []), r]);
    return [...m.entries()].slice(0, 7);
  }, [results]);

  const month = new Date().getMonth();
  const seasonal = useMemo(() => {
    const st = season.data?.stocks ?? {};
    const idx = new Map(rows.map((r) => [r.sym, r]));
    return Object.entries(st)
      .map(([sym, d]) => ({ sym, rec: d.m[month], r: idx.get(sym) }))
      .filter((x) => x.rec && x.rec[0] >= 75 && x.rec[2] >= 8 && x.r?.vet?.s === 'cleared')
      .sort((a, b) => b.rec[0] - a.rec[0] || b.rec[1] - a.rec[1]).slice(0, 8);
  }, [season.data, rows, month]);

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
    <>
      <PageHead eyebrow={today?.source === 'live' ? `Live prices ${tv.at} IST · screen of ${dateLabel(screen.data?.breadth.as_of)}` : screen.data ? `Market data as of ${dateLabel(screen.data.breadth.as_of)}` : 'Market data'} title="The brief," em="in five minutes." lede="Where the market stands, what moved, what changes in the screen, what is on the calendar, and which engines have something to say. Built from the same feeds as every other page." />
      <section className="wrap" style={{ paddingTop: 0 }}><DataStamp ids={['screen', 'barometer', 'engines']} /></section>
      <section className="wrap readgrid">
        <nav className="toc" aria-label="Sections of the brief">
          <div className="eyebrow">In this brief</div>
          {TOC.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={here === id ? 'true' : undefined}>{label}</a>)}
        </nav>
        <div style={{ minWidth: 0 }}>
        <div id="read" data-sec className="read-ink" style={{ marginBottom: 14 }}>
            <div className="eyebrow">The read</div>
            <p>{headline || (bar.error ? 'The market read could not be loaded. Nothing is estimated in its place.' : 'Reading the market…')}</p>
            <button className="chip" onClick={copy}>{copied ? 'Copied' : 'Copy as text'}</button>
          </div>

        <Async loading={bar.loading || sum.loading} error={null} rows={2}>
          {indexQuotes.length > 0 && <div id="quotes" data-sec style={{ margin: '4px 0 10px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}><span className="eyebrow">Quotes · each card shows its own last trade</span><span className="stamp" style={{ margin: 0 }}><MarketSession /></span></div>}
          <div className="qgrid" style={{ marginBottom: 12 }}>
            {/* eight same-shape placeholders while quotes load, so the sectors below do not jump when the cards arrive */}
            {quotes.loading && Array.from({ length: 8 }, (_, i) => <div key={i} className="qcard" aria-hidden><Skel h={18} w="60%" /><Skel h={24} w="45%" /><Skel h={38} /><Skel h={14} w="50%" /></div>)}
            {indexQuotes.map((q) => (
              <Rv key={q.id} className="qcard spot"><div className="qrow"><span className="nm">{q.name}</span><Chg v={q.pct} /></div><div className="px">{q.prefix}{num(q.price, q.dp)}</div><Spark series={q.series} up={(q.pct ?? 0) >= 0} /><div className="qtime">{quoteState(q.at).label}</div></Rv>
            ))}
          </div>

          <div id="sectors" data-sec className="grid g-7-5">
            <SectorBars />
            <Rv className="panel">
              <div className="eyebrow">Valuation stage · from the Barometer</div>
              <div className="disp" style={{ fontSize: 40, margin: '10px 0 4px' }}>{t?.stage.t ?? '—'}</div>
              <p className="muted" style={{ margin: 0 }}>Barometer <b className="num">{typeof t?.score === 'number' ? Math.round(t.score) : '—'}</b>/100 · index {num(t?.drawdown_pct, 1)}% off its high · VIX {num(t?.vix, 1)}.</p>
              <Link href="/rotation/" className="more" style={{ display: 'inline-block', marginTop: 14, color: 'var(--accent-2)', fontSize: 14 }}>See how sector strength is changing →</Link>
            </Rv>
          </div>

          <div id="moved" data-sec />
          <SectionHead eyebrow={dayTag ? `Today · ${dayTag}` : 'Today'} title="What moved" />
          <div className="grid g2" style={{ marginBottom: 12 }}>
            {(['up', 'down'] as const).map((k) => (
              <Rv key={k} className="panel"><div className="eyebrow">{k === 'up' ? 'Biggest rises today' : 'Biggest falls today'}</div>
                <div className="list">
                  {!dayMoves && Array.from({ length: 6 }, (_, i) => <Skel key={i} h={36} />)}
                  {dayMoves && dayMoves[k].length === 0 && <p className="muted" style={{ margin: 0 }}>No stock {k === 'up' ? 'rose' : 'fell'}.</p>}
                  {/* NSE's widest daily price band is 20%: a bigger one-day move is shown as published but flagged, since it usually
                      means a corporate action or a wrong previous close in the source, not a real day's trading */}
                  {dayMoves?.[k].map((m) => <Link key={m.sym} href={companyHref(m.sym)} className="li"><div><div className="t">{m.sym}{Math.abs(m.v) > 20 && <span className="tag" style={{ marginLeft: 6 }} title="Beyond NSE's 20% daily band: usually a corporate action or a wrong previous close in the source. Check before relying on it.">check</span>}</div><div className="s">{m.name}</div></div><Chg v={m.v} dp={2} /></Link>)}
                </div>
              </Rv>
            ))}
          </div>
          {dayMoves && [...dayMoves.up, ...dayMoves.down].some((m) => Math.abs(m.v) > 20) && <p className="dim" style={{ fontSize: 13.5, margin: '-4px 0 12px' }}>A move marked <b>check</b> is beyond NSE&apos;s widest daily price band (20%). It is shown as the source publishes it, but it usually means a corporate action or a wrong previous close, not a real day&apos;s trading.</p>}
          <div className="eyebrow" style={{ margin: '4px 0 8px' }}>Over the past week · to the {dateLabel(screen.data?.breadth.as_of)} close</div>
          <div className="grid g2">
            <Rv className="panel"><div className="eyebrow">Biggest weekly gains</div><div className="list">{(pulse.data?.movers_up ?? []).slice(0, 6).map((m) => <Link key={m.sym} href={companyHref(m.sym)} className="li"><div><div className="t">{m.sym}</div><div className="s">{m.name}</div></div><Chg v={m.r1w} dp={0} /></Link>)}</div></Rv>
            <Rv className="panel"><div className="eyebrow">Biggest weekly falls</div><div className="list">{(pulse.data?.movers_dn ?? []).slice(0, 6).map((m) => <Link key={m.sym} href={companyHref(m.sym)} className="li"><div><div className="t">{m.sym}</div><div className="s">{m.name}</div></div><Chg v={m.r1w} dp={0} /></Link>)}</div></Rv>
          </div>

          <div id="screen" data-sec />
          <SectionHead eyebrow="Screen" title="What changed since the last build" />
          <Async loading={screen.loading} error={screen.error} rows={1}>
            <Rv className="panel">
              {moved.length === 0 ? <p className="muted">No ranking moves recorded in the latest build.</p> : (
                <div className="list">{moved.map((r) => { const mv = (r as Row & { rank_move: number }).rank_move; return <Link key={r.sym} href={companyHref(r.sym)} className="li"><div><div className="t">{r.sym} · {r.name}</div><div className="s">Composite {num(r.comp, 0)} · {r.sector}</div></div><span className={`num ${mv > 0 ? 'up' : 'down'}`}>{mv > 0 ? `▲ up ${mv}` : `▼ down ${Math.abs(mv)}`} places</span></Link>; })}</div>
              )}
              <p className="dim" style={{ fontSize: 13.5, margin: '10px 0 0' }}>Places moved in the composite ranking against the previous build. A description of the data, not a call.</p>
            </Rv>
          </Async>

          <div id="calendar" data-sec />
          <SectionHead eyebrow="Next 14 days" title="Calendar" />
          <div className="grid g2">
            <Rv className="panel">
              <div className="eyebrow">Results due</div>
              {byDay.length === 0 && <p className="muted">No results dates on file for the next two weeks.</p>}
              {byDay.map(([day, list]) => (
                <div key={day} style={{ marginTop: 12 }}>
                  <div className="num" style={{ fontSize: 13.5, color: 'var(--accent-2)' }}>{dateLabel(day)} · {daysUntil(day) === 0 ? 'today' : plural(daysUntil(day), 'day').replace(/^/, 'in ')} · {plural(list.length, 'company', 'companies')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>{list.slice(0, 10).map((r) => <Link key={r.sym} className="chip" href={companyHref(r.sym)}>{r.sym}</Link>)}{list.length > 10 && <span className="dim" style={{ fontSize: 13 }}>+{list.length - 10} more</span>}</div>
                </div>
              ))}
              <p className="dim" style={{ fontSize: 13, margin: '12px 0 0' }}>Dates come from the screen feed, which does not say whether a company has confirmed them or a vendor has estimated them. Check the exchange&apos;s <a href="https://www.nseindia.com/companies-listing/corporate-filings-board-meetings" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-2)', textDecoration: 'underline' }}>board-meeting announcements ↗</a> before relying on one.</p>
              <Link href="/calendar/" className="more" style={{ display: 'inline-block', marginTop: 8, color: 'var(--accent-2)', fontSize: 14 }}>Full results calendar →</Link>
            </Rv>
            <Rv className="panel">
              <div className="eyebrow">IPOs</div>
              {(ipo.data?.upcoming ?? []).concat(ipo.data?.open ?? [] as never[]).slice(0, 3).map((u) => <div key={u.symbol} style={{ marginTop: 12 }}><div className="t" style={{ fontWeight: 600 }}>{u.company}</div><div className="dim num" style={{ fontSize: 13.5 }}>{u.price_band} · opens {dateLabel(u.open_date)} · closes {dateLabel(u.close_date)}</div></div>)}
              {ipo.data && ipo.data.upcoming.length + ipo.data.open.length === 0 && <p className="muted">Nothing open or scheduled.</p>}
              <Link href="/ipo/" className="more" style={{ display: 'inline-block', marginTop: 14, color: 'var(--accent-2)', fontSize: 14 }}>Live book and track record →</Link>
            </Rv>
          </div>

          <div id="seasonal" data-sec />
          <SectionHead eyebrow={new Date().toLocaleString('en-IN', { month: 'long' })} title="The seasonal record" />
          <Rv className="panel">
            <div className="list">{seasonal.map(({ sym, rec, r }) => <Link key={sym} href={companyHref(sym)} className="li"><div><div className="t">{sym} · {r?.name}</div><div className="s">Up in {rec[0]}% of the last {rec[2]} {new Date().toLocaleString('en-IN', { month: 'long' })}s</div></div><span className="num up">median {pct(rec[1], 1)}</span></Link>)}</div>
            {seasonal.length === 0 && <p className="muted">No vetted name clears the 75% bar this month.</p>}
            <p className="dim" style={{ fontSize: 13.5, margin: '10px 0 0' }}>Vetted names only. A calendar month has no causal pull on a price: this is what repeatedly happened, not what will.</p>
          </Rv>

          <div id="engines" data-sec />
          <SectionHead eyebrow="Engines" title="What the models selected" href="/engines/" cta="All engines" />
          <Async loading={eng.loading} error={null} rows={1}>
            <div className="engine-cards" tabIndex={0} role="region" aria-label="Engines (scrolls sideways)">{Object.values(eng.data?.engines ?? {}).sort((a, b) => a.id - b.id).map((e) => (
              <Rv key={e.key} className="panel spot"><div className="eyebrow">Engine {e.id} · {e.name}</div><div className="disp" style={{ fontSize: 44 }}>{e.signal_count}</div><div className="dim" style={{ fontSize: 13.5 }}>signal{e.signal_count === 1 ? '' : 's'} now</div><div style={{ marginTop: 10 }}><EngineVerdict e={e} /></div></Rv>
            ))}</div>
          </Async>

          <div id="wire" data-sec />
          <SectionHead eyebrow="Wire" title="Headlines" href="/news/" cta="All stories" />
          <Rv className="panel"><div className="list">{(news.data ?? []).slice(0, 6).map((s) => <a key={s.link} href={s.link} target="_blank" rel="noopener noreferrer" className="li"><div><div className="t">{s.title}</div><div className="s">{s.source}</div></div><span aria-hidden className="dim">↗</span></a>)}</div></Rv>
          <p className="dim" style={{ fontSize: 13.5, marginTop: 16 }}>Information only, not investment advice. A brief is also sent to Telegram at 08:00 and 20:00 MYT on weekdays.</p>
        </Async>
        </div>
      </section>
    </>
  );
}
