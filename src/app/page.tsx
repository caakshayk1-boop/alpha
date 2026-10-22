'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { Flash, LazyMount, Rv, SectionHead, Skel } from '@/components/ui';
import { Confluence } from '@/components/AiTools';
import { DataStamp } from '@/components/DataStamp';
import { SectorBars } from '@/components/SectorBars';
import { MarketClock } from '@/components/MarketClock';
import { dayLabel, TodayProvider, useToday } from '@/components/widgets/DayContext';
import { IndexStrip } from '@/components/widgets/IndexStrip';
import { LiveMovers } from '@/components/widgets/LiveMovers';
import { LiveWatchlist } from '@/components/widgets/LiveWatchlist';
import { useSignals, useFeed, useSummary } from '@/lib/data';
import { useBook } from '@/lib/useBook';
import { AskAI } from '@/components/Explain';
import { BriefDigest, QuickSizer, RotationWidget } from '@/components/widgets/TodayExtras';
import { dateLabel, num } from '@/lib/format';
import { useBarometer } from '@/lib/useBarometer';
import { sessionHead } from '@/lib/session';
import { istHM } from '@/lib/today';
import { takeaway, vixWord } from '@/lib/takeaway';
import { useStoredList } from '@/lib/store';

const GAUGE_LEN = Math.PI * 52;
// the semicircle path below: radius 52

/** Today's read: the headline sentence, then one ink card for the Barometer and one card for the day's breadth.
 *  Every word is built from the data (lib/takeaway.ts, /api/summary, and for breadth the one "today" rule in lib/live.ts);
 *  a missing figure drops its pill, never estimated. */
function TodayHero() {
  const baro = useBarometer();
  const sum = useSummary();
  const today = useToday();
  const v = baro.view;
  const r = v?.reading ?? null;
  const b200 = sum.data?.above200 ?? null;
  // Wait for both small feeds (or a failed summary) so the cards appear once, at their final size.
  const ready = !!v && (!!sum.data || !!sum.error);
  const prev = v?.previous ?? null;
  const tk = useMemo(() => {
    if (!v || !r || !ready) return null;
    return takeaway({
      score: r.score, band: r.band.t, stage: r.stage?.t ?? null, nifty: r.nifty,
      drawdownPct: r.drawdownPct, vix: r.vix, asOf: v.session,
      above200: b200?.above ?? null, with200: b200?.withHistory ?? null, previous: prev,
    });
  }, [v, r, ready, prev, b200]);
  const [lead, ...rest] = (tk?.headline ?? '').split(', ');
  const score = r ? r.score : null;
  const change = prev && score !== null ? (score > prev.score ? `up from ${prev.score} on ${dateLabel(prev.date)}` : score < prev.score ? `down from ${prev.score} on ${dateLabel(prev.date)}` : `unchanged since ${dateLabel(prev.date)}`) : null;
  const baroStamp = v ? (v.source === 'live' && v.at ? `live ${istHM(v.at)} IST` : `${dateLabel(v.session)} close`) : null;
  const pct200 = b200 && b200.withHistory ? Math.round((b200.above / b200.withHistory) * 100) : null;
  const day = today?.day ?? null;
  const dayStamp = dayLabel(day, today?.live.snap ?? null);
  const dayFailed = !day && !!today && !today.live.loading && !!sum.error;
  const share = (n: number) => (day && day.counted ? (n / day.counted) * 100 : 0);
  // The headline date is the NEWEST session any figure on this page describes, with the market's state beside it.
  const headDate = sessionHead(day?.session ?? v?.session ?? null, today?.live.snap ?? null);
  return (
    <section className="wrap today">
      <div className="eyebrow">{headDate ?? 'Today'}</div>
      {tk && tk.available ? (
        <h1 className="disp today-h">{lead}{rest.length > 0 && <>, <em>{rest.join(', ')}</em></>}</h1>
      ) : baro.error ? (
        <h1 className="disp today-h">The market read is not available right now.</h1>
      ) : (
        <div role="status" aria-busy="true" aria-label="Loading today's market read"><div className="today-h today-h-skel" aria-hidden><span className="skel" style={{ display: 'block', height: '100%', width: '78%' }} /></div></div>
      )}
      <DataStamp ids={['barometer', 'screen', 'engines']} />
      {/* the header hides its clock below 1240px, so the clock moves here on narrow screens */}
      <div className="today-clock"><MarketClock /></div>

      <div className="hero2">
        {tk && tk.available && r && score !== null ? (
          <section className="sky" aria-label="Market barometer">
            <div>
              <div className="eyebrow">Market barometer{baroStamp ? ` · ${baroStamp}` : ''}</div>
              <div className="sky-big">{r.band.t}{change ? `, ${change}` : ''}</div>
              <div className="sky-pills">
                {typeof r.nifty === 'number' && <span className="sky-pill">Nifty <b>{num(r.nifty, 0)}</b></span>}
                {typeof r.vix === 'number' && <span className="sky-pill">VIX {num(r.vix, 1)} · {vixWord(r.vix)}</span>}
                {pct200 !== null && <span className="sky-pill">{pct200}% above 200-day</span>}
                {r.stage?.t && <span className="sky-pill">Valuation: {r.stage.t.toLowerCase()}</span>}
              </div>
              <Link className="sky-link" href="/brief/">Read the five-minute brief →</Link>
            </div>
            <svg className="gauge" viewBox="0 0 132 92" role="img" aria-label={`Barometer ${score} of 100`}>
              <path d="M14 78 A52 52 0 0 1 118 78" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="10" strokeLinecap="round" />
              <path className="arc" d="M14 78 A52 52 0 0 1 118 78" fill="none" stroke="var(--lime)" strokeWidth="10" strokeLinecap="round" strokeDasharray={GAUGE_LEN} strokeDashoffset={GAUGE_LEN * (1 - Math.max(0, Math.min(100, score)) / 100)} style={{ ['--len' as string]: GAUGE_LEN }} />
              <text className="v" x="66" y="72" textAnchor="middle">{score}</text>
              <text className="s" x="66" y="88" textAnchor="middle">of 100</text>
            </svg>
          </section>
        ) : (
          <div className="sky" aria-hidden={!baro.error}>{baro.error ? <p style={{ margin: 0 }}>The Barometer could not be loaded. Nothing is estimated in its place.</p> : <Skel h={120} w="70%" />}</div>
        )}

        <section className="breadth2" aria-label="The day's breadth">
          <div className="eyebrow">{day && dayStamp ? `${dayStamp} · ${num(day.counted)} stocks` : 'Breadth'}</div>
          {day && day.counted ? (
            <>
              <div className="row"><div className="n up"><Flash value={day.up}>{num(day.up)}</Flash><small>rose</small></div><div className="n down"><Flash value={day.down}>{num(day.down)}</Flash><small>fell</small></div></div>
              <div className="split" aria-hidden><i className="u" style={{ width: `${share(day.up)}%` }} /><i className="f" style={{ width: `${share(day.flat)}%` }} /><i className="d" style={{ width: `${share(day.down)}%` }} /></div>
              <div className="split-key"><span className="up">▲ {Math.round(share(day.up))}% rose</span><span>{num(day.flat)} unchanged</span><span className="down">▼ {Math.round(share(day.down))}% fell</span></div>
              {b200 && <div className="foot">At the {sum.data?.as_of ? dateLabel(sum.data.as_of) : 'last'} close, {num(b200.above)} of {num(b200.withHistory)} with a 200-day history sat above their 200-day average.</div>}
            </>
          ) : dayFailed ? <p className="muted" style={{ marginTop: 12 }}>The day&apos;s breadth could not be loaded. Nothing is estimated in its place.</p> : <Skel h={100} style={{ marginTop: 14 }} />}
        </section>
      </div>
    </section>
  );
}

/** The four things people come here to do. Pastel is brand colour only: it never means up or down. */
function JobTiles() {
  const sum = useSummary();
  const eng = useSignals();
  const [watch] = useStoredList('alpha-watchlist');
  const open = (eng.data?.signals ?? []).filter((x) => x.status === 'open' || x.status === 'pending').length;
  return (
    <section className="wrap" style={{ paddingTop: 8 }} aria-labelledby="jobs-h">
      <h2 id="jobs-h" className="eyebrow" style={{ margin: '0 0 12px' }}>What would you like to do?</h2>
      <div className="jobs2">
        <Link className="job2 t-lav" href="/screen/"><span className="big">{sum.data ? num(sum.data.count) : '—'}</span><span><span className="t">Find stocks</span><span className="l">companies screened on quality, growth, value and trend</span></span></Link>
        <button type="button" className="job2 t-mint" onClick={() => window.dispatchEvent(new Event('alpha:search'))}><span className="big"><kbd>/</kbd></span><span><span className="t">Look up a company</span><span className="l">by name or symbol, from any page</span></span></button>
        {/* a bare 0 reads as an empty product: with no plan open, the card says why (Pro §29) */}
        <Link className="job2 t-lime" href="/engines/"><span className="big">{!eng.data ? '—' : open ? num(open) : <span className="big-word">{eng.data.gate.on ? 'None' : 'Gate off'}</span>}</span><span><span className="t">{open ? 'See the signals' : 'Why no signals'}</span><span className="l">{!eng.data ? 'experimental research' : open ? 'waiting or open in the Swing book · experimental research' : eng.data.gate.on ? 'no stock passed every rule at the last close' : `alerts off; the market passes ${eng.data.gate.passed} of 4 gate checks. See the checks`}</span></span></Link>
        <Link className="job2 t-peach" href={watch.length ? '/desk/' : '/watchlist/'}><span className="big">{watch.length ? num(watch.length) : <span className="big-word">Start</span>}</span><span><span className="t">{watch.length ? 'My Desk' : 'Build your watchlist'}</span><span className="l">{watch.length ? `${watch.length === 1 ? 'name' : 'names'} tracked, what needs review; kept in this browser` : 'add three companies you already follow to see what changes'}</span></span></Link>
      </div>
    </section>
  );
}

/** The book in one line: the market gate, today's R, the open count and what the rules say to do next. Detail on /trades/. */
function TradesCard() {
  const { feed, totalR, marked, todayR, todayN, open, pending, groups } = useBook();
  const n = (k: string) => groups.find((g) => g.kind === k)?.items.length ?? 0;
  const sR = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), 2)}R`);
  return (
    <Link href="/trades/" className="panel spot tcard">
      <span className="eyebrow">Signals · Swing v2</span>
      {feed ? (
        <span className="tcard-row num">
          <span><b className={feed.gate.on ? 'up' : 'down'}>{feed.gate.on ? 'Gate on' : 'Gate off'}</b> {feed.gate.passed} of 4 market checks</span>
          <span><b className={todayR > 0 ? 'up' : todayR < 0 ? 'down' : ''}>{todayN ? sR(todayR) : '—'}</b> today</span>
          <span><b className={totalR > 0 ? 'up' : totalR < 0 ? 'down' : ''}>{sR(marked ? totalR : null)}</b> open, marked</span>
          <span><b>{open.length}</b> open · {pending.length} to enter</span>
          <span><b>{n('exit')}</b> exit · <b>{n('modify')}</b> modify</span>
        </span>
      ) : <Skel h={28} w="70%" />}
      <span className="more">Live P&amp;L and next-session decisions →</span>
    </Link>
  );
}

export default function Home() {
  // the retired since-your-last-visit panel left a snapshot in browsers that saw it; Privacy no longer lists the key, so it goes
  useEffect(() => { try { localStorage.removeItem('alpha-last-visit'); } catch { /* storage blocked */ } }, []);
  return (
    <TodayProvider>
      <TodayHero />
      <JobTiles />
      <IndexStrip />
      <section className="wrap section">
        <SectorBars />
      </section>
      <section className="wrap section" aria-label="Today's movers and your watchlist">
        <div className="grid g2"><LiveMovers /><LiveWatchlist /></div>
      </section>
      <section className="wrap section"><TradesCard /><AskAI subject="market" title="Ask about today's market" compact /></section>
      <section className="wrap section" aria-label="Rotation, the week and a position sizer"><LazyMount minHeight={260}><div className="grid g3"><RotationWidget /><BriefDigest /><QuickSizer /></div></LazyMount></section>
      <section className="wrap section"><SectionHead eyebrow="Worth a closer look" title="Where several checks agree" href="/tools/" cta="Portfolio X-ray and more" /><LazyMount minHeight={420}><Confluence limit={6} /></LazyMount></section>
    </TodayProvider>
  );
}
