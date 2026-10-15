'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Async, Chg, LazyMount, Rv, SectionHead, Skel, Spark } from '@/components/ui';
import { Confluence } from '@/components/AiTools';
import { DataStamp } from '@/components/DataStamp';
import { SectorBars } from '@/components/SectorBars';
import { MarketSession } from '@/components/MarketSession';
import { EngineVerdict } from '@/components/EvidenceTags';
import { useEngines, useFeed, useQuotes, useSummary } from '@/lib/data';
import { crore, dateLabel, num, pct, quoteState, rupeeBand } from '@/lib/format';
import { takeaway, vixWord } from '@/lib/takeaway';
import { useStoredList } from '@/lib/store';
import type { Quote } from '@/lib/types';
import { diffSnapshots, parseSnapshot, type Snapshot, type VisitDiff } from '@/lib/visit';
import { companyHref } from '@/lib/slug';

function QuoteCard({ q }: { q: Quote }) {
  const up = (q.pct ?? 0) >= 0;
  return (
    <Rv className="qcard spot">
      <div className="qrow"><span className="nm">{q.name}</span><Chg v={q.pct} /></div>
      <div className="px">{q.prefix}{num(q.price, q.dp)}</div>
      <Spark series={q.series} up={up} />
      <div className="qtime">{quoteState(q.at).label}</div>
    </Rv>
  );
}

const GAUGE_LEN = Math.PI * 52;   // the semicircle path below: radius 52

/** Today's read: the headline sentence, then one ink card for the Barometer and one card for the day's breadth.
 *  Every word is built from the data (lib/takeaway.ts and /api/summary); a missing figure drops its pill, never estimated. */
function TodayHero() {
  const bar = useFeed('barometer');
  const sum = useSummary();
  const t = bar.data?.today;
  const b200 = sum.data?.above200 ?? null;
  // Wait for both small feeds (or a failed summary) so the cards appear once, at their final size.
  const ready = !!t && (!!sum.data || !!sum.error);
  const prev = useMemo(() => (t ? [...(bar.data?.history ?? [])].reverse().find((r) => r.date < t.nifty_date) ?? null : null), [t, bar.data]);
  const tk = useMemo(() => {
    if (!t || !ready) return null;
    return takeaway({
      score: typeof t.score === 'number' ? t.score : null, band: t.band?.t ?? null, stage: t.stage?.t ?? null, nifty: t.nifty ?? null,
      drawdownPct: t.drawdown_pct ?? null, vix: t.vix ?? null, asOf: t.nifty_date ?? null,
      above200: b200?.above ?? null, with200: b200?.withHistory ?? null, previous: prev ? { score: prev.score, date: prev.date } : null,
    });
  }, [t, ready, prev, b200]);
  const [lead, ...rest] = (tk?.headline ?? '').split(', ');
  const score = typeof t?.score === 'number' ? Math.round(t.score) : null;
  const change = prev && score !== null ? (score > prev.score ? `up from ${prev.score} on ${dateLabel(prev.date)}` : score < prev.score ? `down from ${prev.score} on ${dateLabel(prev.date)}` : `unchanged since ${dateLabel(prev.date)}`) : null;
  const pct200 = b200 && b200.withHistory ? Math.round((b200.above / b200.withHistory) * 100) : null;
  const day = sum.data?.day;
  const share = (n: number) => (day && day.counted ? (n / day.counted) * 100 : 0);
  const weekday = t?.nifty_date ? new Date(`${t.nifty_date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : null;
  return (
    <section className="wrap today">
      <div className="eyebrow">{weekday ? `${weekday} · market close` : 'Today'}</div>
      {tk && tk.available ? (
        <h1 className="disp today-h">{lead}{rest.length > 0 && <>, <em>{rest.join(', ')}</em></>}</h1>
      ) : bar.error ? (
        <h1 className="disp today-h">The market read is not available right now.</h1>
      ) : (
        <div role="status" aria-busy="true" aria-label="Loading today's market read"><div className="today-h today-h-skel" aria-hidden><span className="skel" style={{ display: 'block', height: '100%', width: '78%' }} /></div></div>
      )}
      <div className="stamp" style={{ marginTop: 0 }}><MarketSession /></div>
      <DataStamp ids={['barometer', 'screen', 'engines']} />

      <div className="hero2">
        {tk && tk.available && t && score !== null ? (
          <section className="sky" aria-label="Market barometer">
            <div>
              <div className="eyebrow">Market barometer</div>
              <div className="sky-big">{t.band.t}{change ? `, ${change}` : ''}</div>
              <div className="sky-pills">
                {typeof t.nifty === 'number' && <span className="sky-pill">Nifty <b>{num(t.nifty, 0)}</b></span>}
                {typeof t.vix === 'number' && <span className="sky-pill">VIX {num(t.vix, 1)} · {vixWord(t.vix)}</span>}
                {pct200 !== null && <span className="sky-pill">{pct200}% above 200-day</span>}
                {t.stage?.t && <span className="sky-pill">Valuation: {t.stage.t.toLowerCase()}</span>}
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
          <div className="sky" aria-hidden={!bar.error}>{bar.error ? <p style={{ margin: 0 }}>The Barometer could not be loaded. Nothing is estimated in its place.</p> : <Skel h={120} w="70%" />}</div>
        )}

        <section className="breadth2" aria-label="The day's breadth">
          <div className="eyebrow">{sum.data ? `${dateLabel(sum.data.as_of)} · ${num(day?.counted ?? 0)} stocks` : 'Breadth'}</div>
          {day && day.counted ? (
            <>
              <div className="row"><div className="n up">{num(day.up)}<small>rose</small></div><div className="n down">{num(day.down)}<small>fell</small></div></div>
              <div className="split" aria-hidden><i className="u" style={{ width: `${share(day.up)}%` }} /><i className="f" style={{ width: `${share(day.flat)}%` }} /><i className="d" style={{ width: `${share(day.down)}%` }} /></div>
              <div className="split-key"><span className="up">▲ {Math.round(share(day.up))}% rose</span><span>{num(day.flat)} unchanged</span><span className="down">▼ {Math.round(share(day.down))}% fell</span></div>
              {b200 && <div className="foot">{num(b200.above)} of {num(b200.withHistory)} with a 200-day history sit above it.</div>}
            </>
          ) : sum.error ? <p className="muted" style={{ marginTop: 12 }}>The day&apos;s breadth could not be loaded. Nothing is estimated in its place.</p> : <Skel h={100} style={{ marginTop: 14 }} />}
        </section>
      </div>
    </section>
  );
}

/** The four things people come here to do. Pastel is brand colour only: it never means up or down. */
function JobTiles() {
  const sum = useSummary();
  const eng = useEngines();
  const [watch] = useStoredList('alpha-watchlist');
  const open = (eng.data?.signals ?? []).filter((x) => x.status === 'open' || x.status === 'pending').length;
  return (
    <section className="wrap" style={{ paddingTop: 8 }} aria-labelledby="jobs-h">
      <h2 id="jobs-h" className="eyebrow" style={{ margin: '0 0 12px' }}>What would you like to do?</h2>
      <div className="jobs2">
        <Link className="job2 t-lav" href="/screen/"><span className="big">{sum.data ? num(sum.data.count) : '—'}</span><span><span className="t">Find stocks</span><span className="l">companies screened on quality, growth, value and trend</span></span></Link>
        <button type="button" className="job2 t-mint" onClick={() => window.dispatchEvent(new Event('alpha:search'))}><span className="big"><kbd>/</kbd></span><span><span className="t">Look up a company</span><span className="l">by name or symbol, from any page</span></span></button>
        <Link className="job2 t-lime" href="/engines/"><span className="big">{eng.data ? num(open) : '—'}</span><span><span className="t">See the signals</span><span className="l">waiting or open across the five engines</span></span></Link>
        <Link className="job2 t-peach" href="/watchlist/"><span className="big">{num(watch.length)}</span><span><span className="t">Keep track</span><span className="l">{watch.length === 1 ? 'name' : 'names'} on your watchlist, kept in this browser</span></span></Link>
      </div>
    </section>
  );
}

/** What changed since this browser last saw a different data date. Kept in this browser only; with no earlier snapshot it says so instead of inventing changes. */
function SinceVisit() {
  const bar = useFeed('barometer');
  const pulse = useFeed('pulse');
  const eng = useEngines();
  const [diff, setDiff] = useState<VisitDiff | null>(null);
  const done = useRef(false);
  useEffect(() => {
    const t = bar.data?.today, br = pulse.data?.breadth;
    if (done.current || !t || !br || !eng.data || !t.nifty_date) return;
    done.current = true;
    const cur: Snapshot = { asOf: t.nifty_date, score: typeof t.score === 'number' ? t.score : null, up: br.up, down: br.down, signals: eng.data.signals.filter((x) => x.status === 'open' || x.status === 'pending').map((x) => `${x.sym}·${x.engine_name}`) };
    let prev: Snapshot | null = null;
    try { prev = parseSnapshot(localStorage.getItem('alpha-last-visit')); } catch { /* blocked: behave as a first visit */ }
    setDiff(diffSnapshots(prev, cur));
    try { if (!prev || prev.asOf !== cur.asOf) localStorage.setItem('alpha-last-visit', JSON.stringify(cur)); } catch { /* storage blocked or full */ }
  }, [bar.data, pulse.data, eng.data]);
  if (!diff) return <div className="panel" aria-hidden><Skel h={90} /></div>;
  return (
    <Rv className="panel">
      <div className="eyebrow">Since your last visit · kept in this browser</div>
      {diff.kind === 'start' && <p className="disp" style={{ fontSize: 24, lineHeight: 1.25, margin: '12px 0 0' }}>First visit from this browser. Next time, what changed since today will show here.</p>}
      {diff.kind === 'same' && <p className="disp" style={{ fontSize: 24, lineHeight: 1.25, margin: '12px 0 0' }}>No newer data since you last looked (data through {dateLabel(diff.asOf)}).</p>}
      {diff.kind === 'changes' && <><p className="dim" style={{ margin: '10px 0 0', fontSize: 13.5 }}>Compared with data through {dateLabel(diff.since)}:</p><ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.6, fontSize: 15 }}>{diff.lines.map((l) => <li key={l}>{l}</li>)}</ul></>}
    </Rv>
  );
}

function Teasers() {
  const eng = useEngines();
  const list = Object.values(eng.data?.engines ?? {}).sort((a, b) => a.id - b.id);
  const total = list.reduce((n, e) => n + e.signal_count, 0);
  return (
    <section className="wrap section">
      <SectionHead eyebrow="Signals" title="Where the five models stand" href="/engines/" cta={eng.data ? `${total} signal${total === 1 ? '' : 's'} now` : 'All engines'} />
      <Rv className="panel">
        <ul className="erows">
          {list.map((e) => (
            <li key={e.key}>
              <Link href="/engines/" className="erow">
                <span className="erow-id"><b>{e.id}. {e.name}</b><span>{e.signal_count} signal{e.signal_count === 1 ? '' : 's'} now</span></span>
                <EngineVerdict e={e} compact />
              </Link>
            </li>
          ))}
          {!eng.data && Array.from({ length: 5 }, (_, i) => <li key={i}><Skel h={52} style={{ margin: '6px 0' }} /></li>)}
        </ul>
        <p className="dim" style={{ fontSize: 13.5, margin: '12px 0 0' }}>Ranking skill and trading result are different claims, so each engine shows both. Open an engine for its plan levels and track record.</p>
      </Rv>
    </section>
  );
}

function Board() {
  const q = useQuotes();
  const want = ['sensex', 'banknifty', 'usdinr', 'spx', 'gold', 'brent'];   // Nifty 50 and India VIX are already in the headline facts
  // Markets keep different hours (Sensex shut while the S&P trades), so each card states its own last-trade time; no group label claims "live".
  const boardLabel = 'Quotes';
  return (
    <section className="wrap section">
      <SectionHead eyebrow={boardLabel} title="Other markets" href="/markets/" cta={`All ${q.data?.total ?? 33} instruments`} />
      <Async loading={q.loading} error={q.error} rows={2}>
        <div className="qgrid">
          {want.map((id) => q.data?.quotes.find((x) => x.id === id && x.price !== null)).filter((x): x is Quote => !!x).map((x) => <QuoteCard key={x.id} q={x} />)}
        </div>
        {q.data && <p className="dim" style={{ fontSize: 13.5, marginTop: 12 }}>Quotes from Yahoo Finance, cached up to 5 minutes{q.data.live < q.data.total ? ` · ${q.data.total - q.data.live} unavailable and omitted` : ''}. Commodities are futures contracts.</p>}
      </Async>
    </section>
  );
}

function Movers() {
  const p = useFeed('pulse');
  const [tab, setTab] = useState<'up' | 'dn' | 'vol'>('up');
  const list = tab === 'up' ? p.data?.movers_up : tab === 'dn' ? p.data?.movers_dn : p.data?.volume;
  return (
    <Rv className="panel">
      <div className="sec-h" style={{ marginBottom: 8, paddingBottom: 12 }}>
        <h2 style={{ fontSize: 26 }}>Movers</h2>
        <div style={{ display: 'flex', gap: 6 }} role="tablist" aria-label="Mover lists">
          {([['up', 'Gainers'], ['dn', 'Losers'], ['vol', 'Unusual volume']] as const).map(([k, l]) => (
            <button key={k} className="chip" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="list">
        {!list && Array.from({ length: 6 }, (_, i) => <Skel key={i} h={44} style={{ margin: '8px 0' }} />)}
        {list?.slice(0, 8).map((m) => (
          <Link key={m.sym} href={companyHref(m.sym)} className="li">
            <div><div className="t">{m.sym}</div><div className="s">{m.name} · {m.sector}</div></div>
            <div style={{ textAlign: 'right' }}>
              {tab === 'vol' ? <span className="num">{m.vol_spike?.toFixed(1)}× volume</span> : <Chg v={m.r1w} dp={1} />}
              <div className="s num">{tab === 'vol' ? `${crore(m.turnover_cr)} traded` : `₹${num(m.price, 2)} · week`}</div>
            </div>
          </Link>
        ))}
      </div>
    </Rv>
  );
}

function News() {
  const n = useFeed('news');
  return (
    <Rv className="panel">
      <div className="sec-h" style={{ marginBottom: 8, paddingBottom: 12 }}><h2 style={{ fontSize: 26 }}>The wire</h2><Link className="more" href="/news/">All stories →</Link></div>
      <div className="list">
        {!n.data && Array.from({ length: 5 }, (_, i) => <Skel key={i} h={44} style={{ margin: '8px 0' }} />)}
        {n.data?.slice(0, 6).map((s) => (
          <a key={s.link} href={s.link} target="_blank" rel="noopener noreferrer" className="li">
            <div><div className="t">{s.title}</div><div className="s">{s.source}</div></div>
            <span aria-hidden className="dim">↗</span>
          </a>
        ))}
      </div>
    </Rv>
  );
}

function IpoCard() {
  const i = useFeed('ipo');
  const open = i.data?.open ?? [];
  return (
    <Rv className="panel spot">
      <div className="eyebrow">IPOs · open now</div>
      {!i.data && <Skel h={90} style={{ marginTop: 14 }} />}
      {i.data && open.length === 0 && <p className="muted" style={{ marginTop: 14 }}>No mainboard issue is open. {i.data.awaiting_listing.length} closed and awaiting listing.</p>}
      {open.slice(0, 2).map((o) => (
        <div key={o.symbol} style={{ marginTop: 14 }}>
          <div className="disp" style={{ fontSize: 26 }}>{o.company}</div>
          <div className="dim num" style={{ fontSize: 14, marginTop: 6 }}>{rupeeBand(o.price_band)} · closes {dateLabel(o.close_date)} · {o.subscription_x ? `${o.subscription_x.toFixed(2)}× subscribed` : 'subscription pending'}</div>
        </div>
      ))}
      <Link className="more" href="/ipo/" style={{ display: 'inline-block', marginTop: 16, color: 'var(--accent-2)', fontSize: 14 }}>Open and recent listings →</Link>
    </Rv>
  );
}

function ReadCard() {
  const r = useFeed('weekly_reads');
  const s = r.data?.editions[0]?.studies[0];
  return (
    <Rv className="panel spot">
      <div className="eyebrow">Weekly read · {r.data?.editions[0]?.week ?? '—'}</div>
      {!s && <Skel h={90} style={{ marginTop: 14 }} />}
      {s && (
        <>
          <div className="disp" style={{ fontSize: 30, margin: '14px 0 6px' }}>{s.name}</div>
          <div className="dim" style={{ fontSize: 14 }}>{s.sector} · {s.read_minutes} min read</div>
          <Link className="more" href="/reads/" style={{ display: 'inline-block', marginTop: 16, color: 'var(--accent-2)', fontSize: 14 }}>Read this week’s seven →</Link>
        </>
      )}
    </Rv>
  );
}

export default function Home() {
  return (
    <>
      <TodayHero />
      <JobTiles />
      <section className="wrap section">
        <div className="grid g2"><SectorBars /><SinceVisit /></div>
      </section>
      <section className="wrap section"><SectionHead eyebrow="Worth a closer look" title="Where several checks agree" href="/tools/" cta="Portfolio X-ray and more" /><LazyMount minHeight={420}><Confluence limit={6} /></LazyMount></section>
      <Teasers />
      <Board />
      {/* Below the fold: these feeds (pulse 34 KB, news, IPO, weekly reads 103 KB) load only when the reader gets near them. */}
      <section className="wrap section">
        <SectionHead eyebrow="This week" title="What moved, and what was said" />
        <LazyMount minHeight={520}><div className="grid g2"><Movers /><News /></div></LazyMount>
      </section>
      <section className="wrap section">
        <SectionHead eyebrow="Research" title="From the desk" href="/screen/" cta="Open the full screen" />
        <LazyMount minHeight={260}><div className="grid g2"><IpoCard /><ReadCard /></div></LazyMount>
      </section>
    </>
  );
}
