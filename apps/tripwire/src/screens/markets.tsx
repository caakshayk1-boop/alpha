import { useState } from 'react';
import { SectorHeat } from './SectorHeat.tsx';
import { useEngines } from '../useEngines.ts';
import { FlowCard } from './FlowCard.tsx';
import { DayChart } from '../components/DayChart.tsx';
import { usePulse } from '../data.ts';
import { isLiveQuote, quoteWord } from '../stamp.ts';
import { sessionNow } from '../market.ts';
import { dayWord } from '../fmt.ts';
import { Ago, Observed } from '../live.tsx';
import { useTrendSummary } from '../trendsummary.ts';
import { MacroStrip } from './Macro.tsx';
import { IndexRows } from './IndexRows.tsx';
import { TrendMap } from './TrendMap.tsx';
import { Head, PageBar } from './common.tsx';
import { Loading } from './common.tsx';
import { SectorBars } from './SectorBars.tsx';
import { marketTakeaway } from '../takeaway.ts';
import { freshness } from '../fresh.ts';
import { pct } from '../fmt.ts';

/** The detail behind Today's market line: the indices, commodities and currencies, and the trend map with its sectors. Moved here from Today on 27 Oct 2026; nothing about it changed. */
export function Markets() {
  const { scr } = useEngines(); const rows = scr.data?.rows ?? []; const day = scr.data?.as_of ?? null;
  const pulse = usePulse(true); const anyLive = pulse.data ? Object.values(pulse.data.quotes).some((q) => isLiveQuote(q)) : null; const sess = sessionNow(Date.now(), anyLive); const pw = quoteWord(pulse.obs, Date.now(), { loading: pulse.loading && !pulse.err });
  const [dayIx, setDayIx] = useState<'NIFTY' | 'BANKNIFTY' | 'VIX'>('NIFTY');
  const t = useTrendSummary(rows, day, true); const live = sess.phase === 'open' && !!anyLive;
  const chOf = (k: string) => { const q = pulse.data?.quotes[k]; return q ? (q.px / q.prev - 1) * 100 : null; };
  const take = marketTakeaway({ niftyCh: chOf('NIFTY'), vixCh: chOf('VIX'), upPct: t.upPct, downPct: t.downPct, nTrend: t.map.n, live, behind: day ? freshness(day).behind : null });
  return <div>
    <PageBar title="Markets" onBack sub={<>{sess.label} · {sess.detail}</>} />
    <section className="card mk-glance" aria-label="Market summary" data-glance>
      <p className="t-take" data-takeaway>{take ? take.text : scr.loading || pulse.loading ? <span className="sk" style={{ display: 'inline-block', height: 18, width: '85%' }} aria-label="Reading the market" /> : 'No market figures are available right now.'}</p>
      <p className="small mute" style={{ margin: '8px 0 0' }}>Index moves are against the previous close; breadth is the share of {t.map.n ? t.map.n.toLocaleString('en-IN') : 'counted'} liquid names. Both are measured, neither is a forecast.</p>
    </section>
    {pulse.data?.quotes[dayIx] && pulse.data.quotes[dayIx].c.length > 2 && <section className="card dc-card" aria-labelledby="dc-h" data-day-chart>
      <div className="row between"><h2 id="dc-h" className="sec" style={{ margin: 0 }}>Today's session</h2>
        <div className="mini-seg" role="group" aria-label="Index">{([['NIFTY', 'Nifty 50'], ['BANKNIFTY', 'Bank Nifty'], ['VIX', 'India VIX']] as const).map(([k, nm]) => <button key={k} type="button" aria-pressed={dayIx === k} onClick={() => setDayIx(k)}>{nm}</button>)}</div></div>
      <DayChart key={dayIx} q={pulse.data.quotes[dayIx]} nse good={dayIx === 'VIX' ? (chOf('VIX') ?? 0) <= 0 : (chOf(dayIx) ?? 0) >= 0} label={dayIx === 'NIFTY' ? 'Nifty 50' : dayIx === 'BANKNIFTY' ? 'Bank Nifty' : 'India VIX'} />
    </section>}
    <FlowCard />
    <div className="market-grid">
      <section className="moodhero card market-indices" aria-label="Indices"><div className="row between small" style={{ marginBottom: 6 }}><b>Indices</b><span className="row" style={{ gap: 8 }}>{pw === 'Live' && <i className="dot-live" aria-hidden="true" />}<span className="mute" data-market-status><Observed sec={pulse.obs} err={pulse.err} loading={pulse.loading} /></span></span></div>
        <IndexRows nifty={pulse.data?.quotes.NIFTY} bank={pulse.data?.quotes.BANKNIFTY} vix={pulse.data?.quotes.VIX} err={!!pulse.err} /></section>
      <section className="market-breadth">
      {scr.loading && <Loading what="the trend map" />}
      {scr.data && <><Head aside={<span className="small mute">{t.liveMap && sess.phase === 'open' ? <><i className="dot-live" aria-hidden="true" /> live · fetched <Ago at={t.breadth.at} /></> : t.liveMap ? <>last prices · fetched <Ago at={t.breadth.at} /></> : `close of ${dayWord(day)}`}</span>}>Trend map</Head>
        <TrendMap rows={rows} day={day} map={t.map} live={!!t.liveMap} liveAt={t.breadth.at} open={sess.phase === 'open'} repriced={t.liveMap ? t.liveMap.repriced : null} err={!!t.breadth.err} />
        </>}
      </section>
      {scr.data && <SectorHeat rows={rows} day={day} />}
      {scr.data && <SectorBars sectors={t.map.sectors} rows={rows} day={day} />}
      <section className="market-macro"><Head>Commodities, currencies, Bitcoin</Head><p className="small mute">Latest session · scroll for more markets →</p><MacroStrip /></section>
    </div>
  </div>;
}
