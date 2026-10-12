'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Async, Bar, Chg, CountUp, LazyMount, Notice, Rv, SectionHead, Skel, Spark } from '@/components/ui';
import { Confluence } from '@/components/AiTools';
import { DataStamp } from '@/components/DataStamp';
import { EngineVerdict } from '@/components/EvidenceTags';
import { breadth200 } from '@/lib/breadth';
import { useEngines, useFeed, useQuotes } from '@/lib/data';
import { ago, crore, dateLabel, heat, num, pct, quoteState } from '@/lib/format';
import { canAnimate, gsap } from '@/lib/motion';
import type { Barometer, Quote } from '@/lib/types';

function Orb({ b }: { b: Barometer['today'] | null }) {
  const arc = useRef<SVGCircleElement>(null);
  const r = 150;
  const c = 2 * Math.PI * r;
  const score = b?.score ?? null;
  useEffect(() => {
    if (!arc.current || score === null || !canAnimate()) return;
    gsap.fromTo(arc.current, { strokeDashoffset: c }, { strokeDashoffset: c * (1 - score / 100), duration: 1.8, ease: 'power3.out', delay: 0.3, immediateRender: false });
  }, [score, c]);
  const band = b?.band.t ?? '';
  const color = !b ? 'var(--accent)' : b.band.c === 'dn' ? 'var(--down)' : b.band.c === 'up' ? 'var(--up)' : 'var(--accent)';
  return (
    <div className="orb" role="img" aria-label={score === null ? 'Market barometer loading' : `Market barometer: ${score} out of 100, ${band}`}>
      <svg viewBox="0 0 400 400" aria-hidden>
        <g className="orb-ring-spin"><circle cx="200" cy="200" r="190" fill="none" stroke="var(--line-2)" strokeWidth="1" strokeDasharray="2 10" /></g>
        <g className="orb-ring-spin rev"><circle cx="200" cy="200" r="172" fill="none" stroke="var(--accent)" strokeOpacity=".35" strokeWidth="1" strokeDasharray="60 40 8 40" /></g>
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const major = i % 5 === 0;
          const r1 = 150 + (major ? -16 : -10);
          return <line key={i} x1={200 + Math.cos(a) * 128} y1={200 + Math.sin(a) * 128} x2={200 + Math.cos(a) * (major ? 112 : 118)} y2={200 + Math.sin(a) * (major ? 112 : 118)} stroke="var(--line-2)" strokeWidth={major ? 1.5 : 1} data-r={r1} />;
        })}
        <circle cx="200" cy="200" r={r} fill="none" stroke="var(--panel-3)" strokeWidth="10" />
        {score !== null && <circle ref={arc} cx="200" cy="200" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 200 200)" />}
      </svg>
      <div className="orb-core">
        <div className="eyebrow">Market barometer</div>
        <div className="big num" style={{ fontFamily: 'var(--f-display)' }}>{score === null ? '—' : String(Math.round(score))}</div>
        <div className="cap"><span className="tag" style={{ color }}>{band || 'Reading…'}</span></div>
      </div>
    </div>
  );
}

function QuoteCard({ q }: { q: Quote }) {
  const up = (q.pct ?? 0) >= 0;
  return (
    <Rv className="qcard spot">
      <div className="qrow"><span className="nm">{q.name}</span><Chg v={q.pct} /></div>
      <div className="px">{q.prefix}{num(q.price, q.dp)}</div>
      <Spark series={q.series} up={up} />
    </Rv>
  );
}

function Hero() {
  const bar = useFeed('barometer');
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => h1.current?.classList.add('go'), 60);
    return () => window.clearTimeout(t);
  }, []);
  const t = bar.data?.today;
  const scr = useFeed('screen');
  const b200 = useMemo(() => (scr.data ? breadth200(scr.data.rows) : null), [scr.data]);
  const words = ['India’s', 'market,'];
  return (
    <section className="wrap hero">
      <div>
        <div className="eyebrow">Independent research desk · Indian equities</div>
        <h1 ref={h1} className="disp" aria-label="India’s market, measured.">
          {words.map((w, i) => <span className="w" key={w} aria-hidden><i style={{ ['--i' as string]: i }}>{w}&nbsp;</i></span>)}
          <span className="w" aria-hidden><i style={{ ['--i' as string]: 2 }}><em>measured.</em></i></span>
        </h1>
        <p className="lede">
          {t ? (
            <>
              As of the {dateLabel(t.nifty_date)} session the Nifty stood at <b className="num" style={{ color: 'var(--text)' }}>{num(t.nifty, 0)}</b>, {num(t.drawdown_pct, 1)}% below its high, with India VIX at {num(t.vix, 1)}.
              {b200 && b200.pct !== null && scr.data ? <> In the screen ({dateLabel(scr.data.breadth.as_of)}), <b className="num" style={{ color: 'var(--text)' }}>{num(b200.above)} of {num(b200.withHistory)}</b> stocks with a 200-day history ({num(b200.pct, 0)}%) were above their 200-day average.</> : null}
              {' '}Every figure below is computed from filings and exchange data, with the working shown.
            </>
          ) : (
            'A live board, a screen of nearly 1,000 companies, weekly company studies, IPOs, funds and the news that touches them. Every figure computed from public data, with the working shown.'
          )}
        </p>
        <DataStamp ids={['barometer', 'screen', 'engines']} />
        <div className="hero-cta">
          <Link className="btn" href="/brief/">Read today&apos;s brief <span aria-hidden>→</span></Link>
          <Link className="btn ghost" href="/engines/">See the engines</Link>
          <Link className="btn ghost" href="/map/">Heat lab</Link>
        </div>
      </div>
      <Orb b={t ?? null} />
    </section>
  );
}

function Teasers() {
  const eng = useEngines();
  const bar = useFeed('barometer');
  const pulse = useFeed('pulse');
  const t = bar.data?.today;
  const br = pulse.data?.breadth;
  return (
    <section className="wrap section">
      <div className="grid g-7-5">
        <Rv className="panel spot">
          <div className="eyebrow">The brief</div>
          <p className="disp" style={{ fontSize: 'clamp(24px, 2.6vw, 34px)', lineHeight: 1.15, margin: '12px 0 14px' }}>
            {t && br ? <>{br.up > br.down ? 'More stocks rose than fell' : 'More stocks fell than rose'}: {br.up} up, {br.down} down. The barometer reads {Math.round(t.score)}, {t.band.t.toLowerCase()}; the market stage is “{t.stage.t.toLowerCase()}”.</> : 'Reading the market…'}
          </p>
          <Link className="btn" href="/brief/">Five-minute brief <span aria-hidden>→</span></Link>
        </Rv>
        <Rv className="panel spot">
          <div className="eyebrow">Engines · ranking skill and trading result</div>
          <div className="list" style={{ marginTop: 8 }}>
            {Object.values(eng.data?.engines ?? {}).sort((a, b) => a.id - b.id).map((e) => (
              <Link key={e.key} href="/engines/" className="li"><div><div className="t">{e.id}. {e.name}</div><div className="s">{e.signal_count} signal{e.signal_count === 1 ? '' : 's'} now</div></div><EngineVerdict e={e} compact /></Link>
            ))}
            {!eng.data && Array.from({ length: 5 }, (_, i) => <Skel key={i} h={44} style={{ margin: '8px 0' }} />)}
          </div>
        </Rv>
      </div>
    </section>
  );
}

function Ticker() {
  const q = useQuotes();
  const list = (q.data?.quotes ?? []).filter((x) => x.price !== null);
  if (!list.length) return <div className="marquee" style={{ height: 49 }} aria-hidden />;
  const items = [...list, ...list];
  return (
    <div className="marquee" role="region" aria-label="Live prices">
      <div className="marquee-track">
        {items.map((x, i) => (
          <div className="mq-item" key={`${x.id}-${i}`} aria-hidden={i >= list.length}>
            <span className="nm">{x.name}</span>
            <span className="num">{x.prefix}{num(x.price, x.dp)}</span>
            <Chg v={x.pct} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Board() {
  const q = useQuotes();
  const want = ['nifty', 'sensex', 'banknifty', 'vix', 'spx', 'gold'];
  const newest = Math.max(0, ...(q.data?.quotes ?? []).map((x) => x.at ?? 0));
  const qs = quoteState(newest || null);
  const boardLabel = q.data ? (qs.word === 'live' ? 'Live quotes' : qs.word === 'unknown' ? 'Quotes' : `Quotes · ${qs.label}`) : 'Quotes';
  return (
    <section className="wrap section">
      <SectionHead eyebrow={boardLabel} title="The board" href="/markets/" cta={`All ${q.data?.total ?? 33} instruments`} />
      <Async loading={q.loading} error={q.error} rows={2}>
        <div className="qgrid">
          {want.map((id) => q.data?.quotes.find((x) => x.id === id && x.price !== null)).filter((x): x is Quote => !!x).map((x) => <QuoteCard key={x.id} q={x} />)}
        </div>
        {q.data && <p className="dim" style={{ fontSize: 12.5, marginTop: 12 }}>Quotes from Yahoo Finance, cached up to 5 minutes{q.data.live < q.data.total ? ` · ${q.data.total - q.data.live} unavailable and omitted` : ''}. Commodities are futures contracts.</p>}
      </Async>
    </section>
  );
}

function Breadth() {
  const p = useFeed('pulse');
  const scr = useFeed('screen');
  const b200 = useMemo(() => (scr.data ? breadth200(scr.data.rows) : null), [scr.data]);
  const b = p.data?.breadth;
  const total = b ? b.up + b.down : 0;
  const rows: [string, number, string?][] = b ? [
    ['Advancing', (b.up / total) * 100, 'up'],
    ['Declining', (b.down / total) * 100, 'down'],
    ...(b200 && b200.pct !== null ? [[`Above 200-day (${num(b200.above)} of ${num(b200.withHistory)} with history)`, b200.pct] as [string, number]] : []),
  ] : [];
  return (
    <Rv className="panel spot">
      <div className="eyebrow">Breadth · {p.data?.universe ?? '—'} stocks</div>
      <div className="disp" style={{ fontSize: 44, margin: '14px 0 18px' }}>
        {b ? <>{num(b.up)} <span className="dim" style={{ fontSize: 24 }}>up</span> · {num(b.down)} <span className="dim" style={{ fontSize: 24 }}>down</span></> : <Skel h={44} />}
      </div>
      <div className="meter">
        {rows.map(([l, v, k]) => (
          <div className="meter-row" key={l}>
            <span className="lab">{l}</span>
            <Bar pct={v} kind={k as 'up' | 'down' | undefined} />
            <span className="num">{v.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      {b && <p className="dim" style={{ fontSize: 12.5, margin: '16px 0 0' }}>Median stock {pct(b.median)} over the last week window · {b.at_52w_high} at a 52-week high</p>}
    </Rv>
  );
}

function Sectors() {
  const p = useFeed('pulse');
  const list = (p.data?.sectors_day?.length ? p.data.sectors_day : p.data?.sectors) ?? [];
  const label = p.data?.sectors_day?.length ? 'Today' : 'Over the week';
  return (
    <Rv className="panel spot">
      <div className="eyebrow">Sectors · median stock · {label}</div>
      <div className="sector-strip" style={{ marginTop: 16 }}>
        {list.length === 0 && Array.from({ length: 8 }, (_, i) => <Skel key={i} h={76} />)}
        {[...list].sort((a, b) => b.median - a.median).map((s) => (
          <div className="sector-cell" key={s.name} style={{ ['--c' as string]: heat(s.median) }} title={`${s.n} stocks, ${s.up} up`}>
            <span className="n">{s.name}</span>
            <span className="v">{pct(s.median)}</span>
          </div>
        ))}
      </div>
    </Rv>
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
          <Link key={m.sym} href={`/company/?s=${m.sym}`} className="li">
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
          <div className="dim num" style={{ fontSize: 13, marginTop: 6 }}>{o.price_band} · closes {o.close_date} · {o.subscription_x ? `${o.subscription_x.toFixed(2)}× subscribed` : 'subscription pending'}</div>
        </div>
      ))}
      <Link className="more" href="/ipo/" style={{ display: 'inline-block', marginTop: 16, color: 'var(--accent-2)', fontSize: 13 }}>Open and recent listings →</Link>
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
          <div className="dim" style={{ fontSize: 13 }}>{s.sector} · {s.read_minutes} min read</div>
          <Link className="more" href="/reads/" style={{ display: 'inline-block', marginTop: 16, color: 'var(--accent-2)', fontSize: 13 }}>Read this week’s seven →</Link>
        </>
      )}
    </Rv>
  );
}

function MagicLeaders() {
  const s = useFeed('screen');
  const top = (s.data?.rows ?? []).filter((r) => typeof r.mf?.rank === 'number').sort((a, b) => (a.mf!.rank as number) - (b.mf!.rank as number)).slice(0, 5);
  return (
    <Rv className="panel">
      <div className="sec-h" style={{ marginBottom: 8, paddingBottom: 12 }}><h2 style={{ fontSize: 26 }}>Magic Formula leaders</h2><Link className="more" href="/magic/">Full ranking →</Link></div>
      <div className="list">
        {s.loading && Array.from({ length: 5 }, (_, i) => <Skel key={i} h={44} style={{ margin: '8px 0' }} />)}
        {top.map((r) => (
          <Link key={r.sym} href={`/company/?s=${r.sym}`} className="li">
            <div><div className="t">{r.sym}</div><div className="s">{r.name}</div></div>
            <div style={{ textAlign: 'right' }}><div className="num">#{r.mf!.rank as number}</div><div className="s num">ROCE {num(r.roce, 1)}%</div></div>
          </Link>
        ))}
        {!s.loading && top.length === 0 && <Notice>The ranking is rebuilt with each screen update.</Notice>}
      </div>
    </Rv>
  );
}

export default function Home() {
  const h = useFeed('data-health');
  const own = new Set(['Stock screen', 'Markets', 'Market Intelligence', 'Fund screen']);
  const latest = h.data?.datasets?.filter((d) => own.has(d.dataset)).map((d) => d.last_successful_update).sort().pop();
  return (
    <>
      <Hero />
      <Ticker />
      <Teasers />
      <section className="wrap section"><SectionHead eyebrow="Calculated insights" title="Evidence across checks" href="/tools/" cta="Portfolio X-ray and more" /><LazyMount minHeight={420}><Confluence limit={6} /></LazyMount></section>
      <Board />
      <section className="wrap section">
        <div className="grid g-7-5">
          <Breadth />
          <Sectors />
        </div>
      </section>
      <section className="wrap section">
        <SectionHead eyebrow="Today" title="What moved, and what was said" />
        <div className="grid g2"><Movers /><News /></div>
      </section>
      <section className="wrap section">
        <SectionHead eyebrow="Research" title="From the desk" href="/screen/" cta="Open the full screen" />
        <div className="grid g3"><MagicLeaders /><div className="grid"><IpoCard /><ReadCard /></div><Rv className="panel spot"><div className="eyebrow">How to read this</div><p className="lede" style={{ fontSize: 15, marginTop: 14 }}>Every score, rank and flag has its rule written beside it, and every dataset says when it last updated. Where a number cannot be computed it shows a dash, never a guess.</p><Link className="more" href="/about/" style={{ color: 'var(--accent-2)', fontSize: 13 }}>Method and sources →</Link>{latest && <p className="dim" style={{ fontSize: 12.5, marginTop: 16 }}>Data last refreshed {ago(latest)}</p>}</Rv></div>
      </section>
    </>
  );
}
