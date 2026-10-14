'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Async, Bar, Chg, CountUp, LazyMount, Notice, Rv, SectionHead, Skel, Spark } from '@/components/ui';
import { Confluence } from '@/components/AiTools';
import { DataStamp } from '@/components/DataStamp';
import { EngineVerdict } from '@/components/EvidenceTags';
import { breadth200 } from '@/lib/breadth';
import { useEngines, useFeed, useQuotes } from '@/lib/data';
import { ago, crore, dateLabel, heat, num, pct, quoteState, rupeeBand } from '@/lib/format';
import { PAGES } from '@/components/Shell';
import { takeaway } from '@/lib/takeaway';
import type { Quote } from '@/lib/types';
import { diffSnapshots, parseSnapshot, type Snapshot, type VisitDiff } from '@/lib/visit';

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

/** The point of the day in one sentence, then the four figures behind it. The sentence is built by lib/takeaway.ts from the data only. */
function TodayHero() {
  const bar = useFeed('barometer');
  const scr = useFeed('screen');
  const t = bar.data?.today;
  const b200 = useMemo(() => (scr.data ? breadth200(scr.data.rows) : null), [scr.data]);
  const tk = useMemo(() => {
    if (!t) return null;
    const prev = [...(bar.data?.history ?? [])].reverse().find((r) => r.date < t.nifty_date);
    return takeaway({
      score: typeof t.score === 'number' ? t.score : null, band: t.band?.t ?? null, stage: t.stage?.t ?? null, nifty: t.nifty ?? null,
      drawdownPct: t.drawdown_pct ?? null, vix: t.vix ?? null, asOf: t.nifty_date ?? null,
      above200: b200?.above ?? null, with200: b200?.withHistory ?? null, previous: prev ? { score: prev.score, date: prev.date } : null,
    });
  }, [t, bar.data, b200]);
  const [lead, ...rest] = (tk?.headline ?? '').split(', ');
  return (
    <section className="wrap today">
      <div className="today-grid">
        <div className="today-text">
          <div className="eyebrow">{t ? `Today · market data to ${dateLabel(t.nifty_date)}` : 'Today'}</div>
          {tk ? (
            <>
              <h1 className="disp today-h">{lead}{rest.length > 0 && <>, <em>{rest.join(', ')}</em></>}</h1>
              <p className="today-sub">{tk.sub}</p>
            </>
          ) : bar.error ? (
            <>
              <h1 className="disp today-h">The market read is not available right now.</h1>
              <p className="today-sub">The latest readings could not be loaded. Nothing is estimated in their place.</p>
            </>
          ) : (
            <div aria-busy="true" aria-label="Loading today's market read"><Skel h={64} w="70%" style={{ margin: '14px 0 12px' }} /><Skel h={22} w="55%" /></div>
          )}
          <div className="today-cta">
            <Link className="btn" href="/brief/">Read the five-minute brief <span aria-hidden>→</span></Link>
            <Link className="btn ghost" href="/engines/">See today&apos;s signals</Link>
          </div>
        </div>
        {tk && tk.facts.length > 0 && (
          <div className="facts" role="list">
            {tk.facts.map((f) => (
              <div className="fact" role="listitem" key={f.id}>
                <div className="k">{f.label}</div>
                <div className={`v ${f.tone === 'up' ? 'up' : f.tone === 'down' ? 'down' : ''}`}>{f.value}</div>
                <div className="n">{f.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DataStamp ids={['barometer', 'screen', 'engines']} />
    </section>
  );
}

/** The four things people come here to do, each one tap away. */
function JobTiles() {
  const scr = useFeed('screen');
  const eng = useEngines();
  const icon = (href: string) => PAGES.find((p) => p.href === href)?.icon ?? '';
  const open = (eng.data?.signals ?? []).filter((x) => x.status === 'open' || x.status === 'pending').length;
  const Tile = ({ href, title, line, live, d, onClick }: { href?: string; title: string; line: string; live?: string; d: string; onClick?: () => void }) => {
    const body = (
      <>
        <span className="ic" aria-hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg></span>
        <span className="t">{title}</span>
        <span className="l">{line}</span>
        {live && <span className="m">{live}</span>}
      </>
    );
    return href ? <Link className="job" href={href}>{body}</Link> : <button type="button" className="job" onClick={onClick}>{body}</button>;
  };
  return (
    <section className="wrap" style={{ paddingTop: 0 }}>
      <div className="eyebrow" style={{ margin: '0 0 12px' }}>What would you like to do?</div>
      <div className="jobs">
        <Tile href="/screen/" title="Find stocks" line="Filter the whole market by quality, growth, value and trend." live={scr.data ? `${num(scr.data.rows.length)} companies screened` : undefined} d={icon('/screen/')} />
        <Tile title="Look up a company" line="Search by name or symbol for its full picture." live="Press / to search from anywhere" d="M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4" onClick={() => window.dispatchEvent(new Event('alpha:search'))} />
        <Tile href="/engines/" title="See the signals" line="What the five models are watching, and how they have done." live={eng.data ? `${open} signal${open === 1 ? '' : 's'} waiting or open` : undefined} d={icon('/engines/')} />
        <Tile href="/watchlist/" title="Keep track" line="Your watchlist, and a journal of why you decided." live="Private, kept in this browser" d={icon('/watchlist/')} />
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
  if (!diff || diff.kind === 'start') return null;
  return (
    <section className="wrap" style={{ paddingTop: 0 }}>
      <div className="panel tight">
        <div className="eyebrow">Since your last visit · kept in this browser</div>
        {diff.kind === 'same' && <p className="muted" style={{ margin: '6px 0 0', fontSize: 14.5 }}>No newer data since you last looked (data through {dateLabel(diff.asOf)}).</p>}
        {diff.kind === 'changes' && <><p className="dim" style={{ margin: '6px 0 0', fontSize: 13.5 }}>Compared with data through {dateLabel(diff.since)}:</p><ul className="muted" style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.6, fontSize: 14.5 }}>{diff.lines.map((l) => <li key={l}>{l}</li>)}</ul></>}
      </div>
    </section>
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
  const newest = Math.max(0, ...(q.data?.quotes ?? []).map((x) => x.at ?? 0));
  const qs = quoteState(newest || null);
  const boardLabel = q.data ? (qs.word === 'live' ? 'Live quotes' : qs.word === 'unknown' ? 'Quotes' : `Quotes · ${qs.label}`) : 'Quotes';
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

function Breadth() {
  const p = useFeed('pulse');
  const scr = useFeed('screen');
  const b = p.data?.breadth;
  const total = b ? b.up + b.down : 0;
  const rows: [string, number, string?][] = b ? [
    ['Advancing', (b.up / total) * 100, 'up'],
    ['Declining', (b.down / total) * 100, 'down'],
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
      {b && <p className="dim" style={{ fontSize: 13.5, margin: '16px 0 0' }}>Median stock {pct(b.median)} over the last week window · {b.at_52w_high} at a 52-week high</p>}
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
  const h = useFeed('data-health');
  const own = new Set(['Stock screen', 'Markets', 'Market Intelligence', 'Fund screen']);
  const latest = h.data?.datasets?.filter((d) => own.has(d.dataset)).map((d) => d.last_successful_update).sort().pop();
  return (
    <>
      <TodayHero />
      <JobTiles />
      <SinceVisit />
      <section className="wrap section"><SectionHead eyebrow="Worth a closer look" title="Where several checks agree" href="/tools/" cta="Portfolio X-ray and more" /><LazyMount minHeight={420}><Confluence limit={6} /></LazyMount></section>
      <Teasers />
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
        <div className="grid g2"><IpoCard /><ReadCard /></div>
      </section>
    </>
  );
}
