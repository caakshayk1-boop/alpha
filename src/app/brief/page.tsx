'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Async, Chg, PageHead, Rv, SectionHead, Spark } from '@/components/ui';
import { DataStamp } from '@/components/DataStamp';
import { SectorBars } from '@/components/SectorBars';
import { MarketSession } from '@/components/MarketSession';
import { EngineVerdict } from '@/components/EvidenceTags';
import { useEngines, useFeed, useQuotes, useSummary } from '@/lib/data';
import { dateLabel, num, pct, quoteState } from '@/lib/format';
import { plural } from '@/lib/status';
import type { Row } from '@/lib/types';

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

  const t = bar.data?.today;
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

  // One day, one universe: the count, the 200-day share and the sector medians all come from the screen's own rows (/api/summary).
  const secs = sum.data?.sectors ?? [];
  const day = sum.data?.day;
  const b200 = sum.data?.above200;
  const indexQuotes = (quotes.data?.quotes ?? []).filter((q) => ['nifty', 'sensex', 'banknifty', 'vix', 'spx', 'gold', 'crude', 'usdinr'].includes(q.id) && q.price !== null);

  const headline = useMemo(() => {
    if (!t) return '';
    if (!day || !sum.data) return sum.error ? `The barometer reads ${Math.round(t.score)}/100 (${t.band.t.toLowerCase()}). The day's breadth could not be loaded, and nothing is estimated in its place.` : '';
    const tilt = day.up > day.down ? 'more stocks rose than fell' : day.up < day.down ? 'more stocks fell than rose' : 'as many stocks rose as fell';
    const share = b200 && b200.withHistory ? ` ${b200.above} of ${b200.withHistory} stocks with a 200-day history (${Math.round((b200.above / b200.withHistory) * 100)}%) sit above their 200-day average.` : '';
    return `On ${dateLabel(sum.data.as_of)}, ${tilt} (${day.up} up, ${day.down} down). The barometer reads ${Math.round(t.score)}/100 (${t.band.t.toLowerCase()}).${share}`;
  }, [t, day, b200, sum.data, sum.error]);

  const copy = async () => {
    const lines = [`alpha brief — market data as of ${dateLabel(screen.data?.breadth.as_of)}`, headline, '',
      ...indexQuotes.map((q) => `${q.name}: ${q.prefix}${num(q.price, q.dp)} (${pct(q.pct, 2)})`), '',
      secs.length ? `Sectors: ↑ ${secs.slice(0, 3).map((s) => `${s.name} ${pct(s.median)}`).join(', ')} · ↓ ${secs.slice(-3).map((s) => `${s.name} ${pct(s.median)}`).join(', ')}` : '',
      'https://alpha.askakshay.com/brief/'];
    try { await navigator.clipboard.writeText(lines.filter(Boolean).join('\n')); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked: nothing to do */ }
  };

  return (
    <>
      <PageHead eyebrow={screen.data ? `Market data as of ${dateLabel(screen.data.breadth.as_of)}` : 'Market data'} title="The brief," em="in five minutes." lede="Where the market stands, what moved, what changes in the screen, what is on the calendar, and which engines have something to say. Built from the same feeds as every other page." />
      <section className="wrap" style={{ paddingTop: 0 }}><DataStamp ids={['screen', 'barometer', 'engines']} /></section>
      <section className="wrap readgrid">
        <nav className="toc" aria-label="Sections of the brief">
          <div className="eyebrow">In this brief</div>
          {TOC.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
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
          <SectionHead eyebrow="Over the past week" title="What moved" />
          <div className="grid g2">
            <Rv className="panel"><div className="eyebrow">Biggest weekly gains</div><div className="list">{(pulse.data?.movers_up ?? []).slice(0, 6).map((m) => <Link key={m.sym} href={`/company/?s=${m.sym}`} className="li"><div><div className="t">{m.sym}</div><div className="s">{m.name}</div></div><Chg v={m.r1w} dp={0} /></Link>)}</div></Rv>
            <Rv className="panel"><div className="eyebrow">Biggest weekly falls</div><div className="list">{(pulse.data?.movers_dn ?? []).slice(0, 6).map((m) => <Link key={m.sym} href={`/company/?s=${m.sym}`} className="li"><div><div className="t">{m.sym}</div><div className="s">{m.name}</div></div><Chg v={m.r1w} dp={0} /></Link>)}</div></Rv>
          </div>

          <div id="screen" data-sec />
          <SectionHead eyebrow="Screen" title="What changed since the last build" />
          <Async loading={screen.loading} error={screen.error} rows={1}>
            <Rv className="panel">
              {moved.length === 0 ? <p className="muted">No ranking moves recorded in the latest build.</p> : (
                <div className="list">{moved.map((r) => { const mv = (r as Row & { rank_move: number }).rank_move; return <Link key={r.sym} href={`/company/?s=${r.sym}`} className="li"><div><div className="t">{r.sym} · {r.name}</div><div className="s">Composite {num(r.comp, 0)} · {r.sector}</div></div><span className={`num ${mv > 0 ? 'up' : 'down'}`}>{mv > 0 ? `▲ up ${mv}` : `▼ down ${Math.abs(mv)}`} places</span></Link>; })}</div>
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>{list.slice(0, 10).map((r) => <Link key={r.sym} className="chip" href={`/company/?s=${r.sym}`}>{r.sym}</Link>)}{list.length > 10 && <span className="dim" style={{ fontSize: 13 }}>+{list.length - 10} more</span>}</div>
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
            <div className="list">{seasonal.map(({ sym, rec, r }) => <Link key={sym} href={`/company/?s=${sym}`} className="li"><div><div className="t">{sym} · {r?.name}</div><div className="s">Up in {rec[0]}% of the last {rec[2]} {new Date().toLocaleString('en-IN', { month: 'long' })}s</div></div><span className="num up">median {pct(rec[1], 1)}</span></Link>)}</div>
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
