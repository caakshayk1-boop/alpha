import { useMemo } from 'react';
import { useChart } from '../data.ts';
import { fmtMacro, macroDef, macroTv, MACRO, useMacro } from '../macro.ts';
import { trendOfCloses, TREND_WORD } from '../screen.ts';
import { Ago, LiveBadge, Spark, Tick } from '../live.tsx';
import { Icon, Empty } from '../ui.tsx';
import { PageBar, Failed } from './common.tsx';
import { PriceChart } from './PriceChart.tsx';
import { pct } from '../fmt.ts';

/** Gold, silver, oil, the rupee and ringgit crosses and Bitcoin: the home screen's second strip. Each tile opens its own chart. */
export function MacroStrip() {
  const m = useMacro();
  return <>
    <div className="strip" role="list" aria-label="Commodities, currencies and Bitcoin">
      {MACRO.map((d) => { const q = m.data?.quotes[d.key]; const ch = q ? (q.px / q.prev - 1) * 100 : null;
        return <a key={d.key} role="listitem" className="tile" href={`#/m/${d.key}`}>
          <div className="nm">{d.label}<span className="sr">, chart</span></div>
          <div className="vv num"><Tick v={q?.px}>{q ? fmtMacro(d, q.px) : '—'}</Tick></div>
          <div className={`small num ${ch == null ? 'dim' : ch >= 0 ? 'up' : 'down'}`}>{ch == null ? (m.err ? 'unavailable' : '…') : pct(ch, 2)}</div>
          <div style={{ marginTop: 4 }}>{q ? <Spark c={q.c} up={ch == null || ch >= 0} refs={[{ v: q.prev, kind: 'prev' }]} h={22} label={`${d.label} over the last session`} /> : <div className="sk" style={{ height: 22 }} />}</div></a>; })}
    </div>
    <div className="row between small mute" style={{ marginTop: 4 }}><span>{m.err ? <span className="down">prices unavailable</span> : 'Dollar prices for metals, oil and Bitcoin'}</span><span>{m.at ? <>updated <Ago at={m.at} /></> : ''}</span></div></>;
}

export function MacroPage({ k }: { k: string }) {
  const d = macroDef(k); const m = useMacro(); const chart = useChart(k);
  const tr = useMemo(() => (chart.data ? trendOfCloses(chart.data.c) : null), [chart.data]);
  if (!d) return <div><PageBar title="Not found" onBack /><Empty title="No such instrument">Tripwire follows {MACRO.map((x) => x.label).join(', ')}.</Empty></div>;
  const q = m.data?.quotes[d.key]; const ch = q ? (q.px / q.prev - 1) * 100 : null; const fmt = (v: number) => fmtMacro(d, v);
  return <div>
    <PageBar title={d.label} onBack sub={d.sub} right={<a className="icon-btn" href={macroTv(d.key)} target="_blank" rel="noopener noreferrer" title="Open on TradingView"><Icon n="chart" /><span className="sr">{d.label} on TradingView, opens in a new tab</span></a>} />
    <section className="card glass">
      <div className="row between"><LiveBadge live={!!q?.live} label={q ? (q.live ? 'LIVE' : 'Last price') : 'Loading'} /><span className="small mute">{m.at ? <>updated <Ago at={m.at} /></> : ''}</span></div>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: 8 }}>
        <div className="num" style={{ font: '600 30px/1 var(--sans)', letterSpacing: '-.8px' }}><Tick v={q?.px}>{q ? fmt(q.px) : '—'}</Tick></div>
        <div className={`num ${ch == null ? 'dim' : ch >= 0 ? 'up' : 'down'}`}>{ch == null ? '' : pct(ch, 2)} <span className="small dim">{q?.live ? 'today' : 'last session'}</span></div></div>
      {q && <div style={{ marginTop: 10 }}><Spark c={q.c} up={ch == null || ch >= 0} refs={[{ v: q.prev, kind: 'prev' }]} h={56} label={`${d.label} over the last session, with the previous close`} /></div>}
      {m.err && !q && <Failed what={d.label} err={m.err} retry={() => location.reload()} />}
      {tr?.trend ? <p className="small" style={{ margin: '12px 0 0' }}><span className={`tag ${tr.trend === 'up' ? 'lime' : tr.trend === 'down' ? 'peach' : ''}`}>{tr.trend === 'up' ? '↑' : tr.trend === 'down' ? '↓' : '→'} {TREND_WORD[tr.trend]}</span> <span className="dim">{tr.detail.replace(/^[A-Za-z]+: /, '')}</span></p> : chart.data ? <p className="small mute" style={{ margin: '12px 0 0' }}>Trend not tagged: fewer than 200 daily closes are held.</p> : null}
    </section>
    <h2 className="h">Price history<span className="rule" /></h2>
    <PriceChart sym={d.key} fmt={fmt} name={d.label} />
    <p className="mute small" style={{ marginTop: 10 }}>Prices from Yahoo Finance. Gold, silver and oil are exchange futures priced in US dollars, not the Indian MCX contracts, so a rupee price at home differs by the exchange rate, duty and dealer premium. <a href={macroTv(d.key)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>Full chart on TradingView</a>.</p>
  </div>;
}
