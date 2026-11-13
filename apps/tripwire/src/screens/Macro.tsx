import { useMemo, type CSSProperties } from 'react';
import { useChart } from '../data.ts';
import { fmtMacro, macroDef, macroTv, MACRO, useMacro } from '../macro.ts';
import { trendOfCloses, TREND_WORD } from '../screen.ts';
import { LiveBadge, Observed, Tick } from '../live.tsx';
import { DayChart } from '../components/DayChart.tsx';
import { isLiveQuote, quoteWord } from '../stamp.ts';
import { quoteTick } from '../tickbasis.ts';
import { Icon, Empty } from '../ui.tsx';
import { PageBar, Failed } from './common.tsx';
import { PriceChart } from './PriceChart.tsx';
import { pct } from '../fmt.ts';
import { indiaLink, sectorHref } from '../charts/indialink.ts';

/** Gold, silver, oil, the rupee and ringgit crosses and Bitcoin: the home screen's second strip. Each tile opens its own chart. */
export function MacroStrip() {
  const m = useMacro();
  return <>
    <div className="strip" role="list" aria-label="Commodities, currencies and Bitcoin">
      {MACRO.map((d) => { const q = m.data?.quotes[d.key]; const ch = q ? (q.px / q.prev - 1) * 100 : null; const lk = indiaLink(d.key);
        return <a key={d.key} role="listitem" className="tile" style={{ '--tt': d.tint } as CSSProperties} href={`#/m/${d.key}`}>
          <div className="nm">{d.label}<span className="sr">, chart</span></div>
          <div className="vv num"><Tick v={q?.px} {...quoteTick(q?.pt, Date.now(), false)}>{q ? fmtMacro(d, q.px) : '—'}</Tick></div>
          <div className={`small num ${ch == null ? 'dim' : ch >= 0 ? 'up' : 'down'}`}>{ch == null ? (m.err ? 'unavailable' : '…') : pct(ch, 2)}</div>
          <div style={{ marginTop: 4 }} className="mc-spark">{q ? <DayChart q={q} size="compact" nse={false} good={ch == null || ch >= 0} label={`${d.label} over the last session`} /> : <div className="sk" style={{ height: 22 }} />}</div>
          {lk && <div className="il" data-india-link={lk.id}><span className="il-k">India link · {lk.label}</span><span className="il-t">{lk.exposed}</span><span className="il-chips" aria-hidden="true">{lk.sectors.slice(0, 3).map((x) => <span key={x} className="il-chip">{x}</span>)}</span></div>}</a>; })}
    </div>
    <div className="row between small mute" style={{ marginTop: 4 }}><span>Dollar prices for metals, oil and Bitcoin</span><span><Observed sec={m.obs} err={m.err} nse={false} /></span></div></>;
}

export function MacroPage({ k }: { k: string }) {
  const d = macroDef(k); const m = useMacro(); const chart = useChart(k);
  const tr = useMemo(() => (chart.data ? trendOfCloses(chart.data.c) : null), [chart.data]);
  if (!d) return <div><PageBar title="Not found" onBack /><Empty title="No such instrument">Tripwire follows {MACRO.map((x) => x.label).join(', ')}.</Empty></div>;
  const link = indiaLink(d.key);
  const q = m.data?.quotes[d.key]; const ch = q ? (q.px / q.prev - 1) * 100 : null; const fmt = (v: number) => fmtMacro(d, v);
  return <div>
    <PageBar title={d.label} onBack sub={d.sub} right={<a className="icon-btn" href={macroTv(d.key)} target="_blank" rel="noopener noreferrer" title="Open on TradingView"><Icon n="chart" /><span className="sr">{d.label} on TradingView, opens in a new tab</span></a>} />
    <section className="card glass">
      <div className="row between"><LiveBadge live={isLiveQuote(q, Date.now(), false)} label={quoteWord(q?.pt, Date.now(), { nse: false, loading: m.loading }) ?? 'Checking prices'} /><span className="small mute"><Observed sec={q?.pt ?? null} err={m.err} nse={false} /></span></div>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: 8 }}>
        <div className="num" style={{ font: '600 1.875rem/1 var(--sans)', letterSpacing: '-.8px' }}><Tick v={q?.px} {...quoteTick(q?.pt, Date.now(), false)}>{q ? fmt(q.px) : '—'}</Tick></div>
        <div className={`num ${ch == null ? 'dim' : ch >= 0 ? 'up' : 'down'}`}>{ch == null ? '' : pct(ch, 2)} <span className="small dim">{isLiveQuote(q, Date.now(), false) ? 'today' : 'last session'}</span></div></div>
      {q && <div style={{ marginTop: 10 }}><DayChart q={q} nse={false} good={ch == null || ch >= 0} fmt={(x) => fmtMacro(d, x)} label={`${d.label} over the last session`} /></div>}
      {m.err && !q && <Failed what={d.label} err={m.err} retry={() => location.reload()} />}
      {tr?.trend ? <p className="small" style={{ margin: '12px 0 0' }}><span className={`tag ${tr.trend === 'up' ? 'lime' : tr.trend === 'down' ? 'peach' : ''}`}>{tr.trend === 'up' ? '↑' : tr.trend === 'down' ? '↓' : '→'} {TREND_WORD[tr.trend]}</span> <span className="dim">{tr.detail.replace(/^[A-Za-z]+: /, '')}</span></p> : chart.data ? <p className="small mute" style={{ margin: '12px 0 0' }}>Trend not tagged: fewer than 200 daily closes are held.</p> : null}
    </section>
    {link && <section className="card il-card" data-india-link={link.id} aria-labelledby="il-h"><h2 id="il-h" className="sec" style={{ margin: 0 }}>India link: {link.label}</h2>
      <p className="small" style={{ margin: '6px 0 0' }}>{link.channel}</p>
      <p className="small dim" style={{ margin: '6px 0 0' }}>{link.exposed}</p>
      <ul className="il-chips il-links" aria-label="Sectors this reaches, each opens Research on that sector">{link.sectors.map((x) => <li key={x}><a className="il-chip" href={sectorHref(x)}>{x}</a></li>)}</ul>
      <p className="small mute" style={{ margin: '8px 0 0' }}>Watch: {link.watch}. A standing description of the connection, the same every day; the move above is the measured part.</p></section>}
    <h2 className="h">Price history<span className="rule" /></h2>
    <PriceChart sym={d.key} fmt={fmt} name={d.label} />
    <p className="mute small" style={{ marginTop: 10 }}>Prices from Yahoo Finance. Gold, silver and oil are exchange futures priced in US dollars, not the Indian MCX contracts, so a rupee price at home differs by the exchange rate, duty and dealer premium. <a href={macroTv(d.key)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>Full chart on TradingView</a>.</p>
  </div>;
}
