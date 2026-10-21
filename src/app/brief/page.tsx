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

const TOC: [string, string][] = [['read', 'The read'], ['valuation', 'Valuation'], ['week', 'The week'], ['screen', 'Rank changes'], ['seasonal', 'Seasonal record']];
const has = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

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

  const moved = useMemo(() => rows.filter((r) => has((r as Row & { rank_move?: number }).rank_move)).sort((a, b) => Math.abs((b as Row & { rank_move: number }).rank_move) - Math.abs((a as Row & { rank_move: number }).rank_move)).slice(0, 6), [rows]);

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
          <Rv className="panel tight">
            <div className="eyebrow">Valuation stage · from the Barometer</div>
            <div className="disp" style={{ fontSize: 34, margin: '6px 0 2px' }}>{t?.stage.t ?? '—'}</div>
            <p className="muted" style={{ margin: 0 }}>Barometer <b className="num">{typeof t?.score === 'number' ? Math.round(t.score) : '—'}</b>/100 · index {num(t?.drawdown_pct, 1)}% off its high · VIX {num(t?.vix, 1)}.</p>
          </Rv>

          <div id="week" data-sec />
          <SectionHead eyebrow={`Past week · to the ${dateLabel(screen.data?.breadth.as_of)} close`} title="What moved this week" />
          <div className="grid g2">
            <Rv className="panel tight"><div className="eyebrow">Biggest weekly gains</div><div className="list">{(pulse.data?.movers_up ?? []).slice(0, 6).map((m) => <Link key={m.sym} href={companyHref(m.sym)} className="li"><div><div className="t">{m.sym}</div><div className="s">{m.name}</div></div><Chg v={m.r1w} dp={0} /></Link>)}</div></Rv>
            <Rv className="panel tight"><div className="eyebrow">Biggest weekly falls</div><div className="list">{(pulse.data?.movers_dn ?? []).slice(0, 6).map((m) => <Link key={m.sym} href={companyHref(m.sym)} className="li"><div><div className="t">{m.sym}</div><div className="s">{m.name}</div></div><Chg v={m.r1w} dp={0} /></Link>)}</div></Rv>
          </div>

          <div id="screen" data-sec />
          <SectionHead eyebrow="Screen" title="Rank changes since the last build" />
          <Async loading={screen.loading} error={screen.error} rows={1}>
            <Rv className="panel tight">
              {moved.length === 0 ? <p className="muted" style={{ margin: 0 }}>No ranking moves recorded in the latest build.</p> : (
                <div className="list">{moved.map((r) => { const mv = (r as Row & { rank_move: number }).rank_move; return <Link key={r.sym} href={companyHref(r.sym)} className="li"><div><div className="t">{r.sym} · {r.name}</div><div className="s">Composite {num(r.comp, 0)} · {r.sector}</div></div><span className={`num ${mv > 0 ? 'up' : 'down'}`}>{mv > 0 ? `▲ up ${mv}` : `▼ down ${Math.abs(mv)}`} places</span></Link>; })}</div>
              )}
            </Rv>
          </Async>

          <div id="seasonal" data-sec />
          <SectionHead eyebrow={new Date().toLocaleString('en-IN', { month: 'long' })} title="The seasonal record" />
          <Rv className="panel tight">
            <div className="list">{seasonal.map(({ sym, rec, r }) => <Link key={sym} href={companyHref(sym)} className="li"><div><div className="t">{sym} · {r?.name}</div><div className="s">Up in {rec[0]}% of the last {rec[2]} {new Date().toLocaleString('en-IN', { month: 'long' })}s</div></div><span className="num up">median {pct(rec[1], 1)}</span></Link>)}</div>
            {seasonal.length === 0 && <p className="muted" style={{ margin: 0 }}>No vetted name clears the 75% bar this month.</p>}
          </Rv>
        </Async>
        </div>
      </section>
    </>
  );
}
