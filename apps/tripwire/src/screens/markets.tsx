import { useEngines } from '../useEngines.ts';
import { usePulse } from '../data.ts';
import { isLiveQuote, quoteWord } from '../stamp.ts';
import { sessionNow } from '../market.ts';
import { dayWord } from '../fmt.ts';
import { Ago, LiveBadge, Observed } from '../live.tsx';
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
  const t = useTrendSummary(rows, day, true); const live = sess.phase === 'open' && !!anyLive;
  const chOf = (k: string) => { const q = pulse.data?.quotes[k]; return q ? (q.px / q.prev - 1) * 100 : null; };
  const take = marketTakeaway({ niftyCh: chOf('NIFTY'), vixCh: chOf('VIX'), upPct: t.upPct, downPct: t.downPct, nTrend: t.map.n, live, behind: day ? freshness(day).behind : null });
  return <div>
    <PageBar title="Markets" onBack sub={<>{sess.label} · {sess.detail}</>} />
    <section className="card mk-glance" aria-label="Indices and breadth together" data-glance>
      <p className="t-take" data-takeaway>{take ? take.text : scr.loading || pulse.loading ? <span className="sk" style={{ display: 'inline-block', height: 18, width: '85%' }} aria-label="Reading the market" /> : 'No market figures are available right now.'}</p>
      <div className="mk-chips num" role="list" aria-label="Index moves and breadth">
        {([['Nifty 50', chOf('NIFTY'), false], ['Bank Nifty', chOf('BANKNIFTY'), false], ['India VIX', chOf('VIX'), true]] as const).map(([nm, ch, vix]) => <span key={nm} role="listitem"><small>{nm}</small><b className={ch == null ? '' : vix ? (ch > 0 ? 'down' : 'up') : ch > 0 ? 'up' : ch < 0 ? 'down' : ''}>{ch == null ? '—' : pct(ch, 2)}</b></span>)}
        <span role="listitem"><small>In an uptrend</small><b>{t.upPct == null ? '—' : `${Math.round(t.upPct)}%`}</b></span>
        <span role="listitem"><small>In a downtrend</small><b>{t.downPct == null ? '—' : `${Math.round(t.downPct)}%`}</b></span>
      </div>
      <p className="small mute" style={{ margin: '8px 0 0' }}>Index moves are against the previous close; breadth is the share of {t.map.n ? t.map.n.toLocaleString('en-IN') : 'counted'} liquid names. Both are measured, neither is a forecast. VIX up shows red.</p>
    </section>
    <div className="market-grid">
      <section className="moodhero card market-indices" aria-label="Indices"><div className="row between small" style={{ marginBottom: 6 }}><b>Indices</b><span className="row" style={{ gap: 8 }}><LiveBadge live={pw === 'Live'} label={pw ?? 'Checking prices'} /><span className="mute"><Observed sec={pulse.obs} err={pulse.err} /></span></span></div>
        <IndexRows nifty={pulse.data?.quotes.NIFTY} bank={pulse.data?.quotes.BANKNIFTY} vix={pulse.data?.quotes.VIX} err={!!pulse.err} /></section>
      <section className="market-breadth">
      {scr.loading && <Loading what="the trend map" />}
      {scr.data && <><Head aside={<span className="small mute">{t.liveMap && sess.phase === 'open' ? <><i className="dot-live" aria-hidden="true" /> live · fetched <Ago at={t.breadth.at} /></> : t.liveMap ? <>last prices · fetched <Ago at={t.breadth.at} /></> : `close of ${dayWord(day)}`}</span>}>Trend map</Head>
        <TrendMap rows={rows} day={day} map={t.map} live={!!t.liveMap} liveAt={t.breadth.at} open={sess.phase === 'open'} repriced={t.liveMap ? t.liveMap.repriced : null} err={!!t.breadth.err} />
        </>}
      </section>
      {scr.data && <SectorBars sectors={t.map.sectors} rows={rows} day={day} />}
      <section className="market-macro"><Head>Commodities, currencies, Bitcoin</Head><p className="small mute">Latest session · scroll for more markets →</p><MacroStrip /></section>
    </div>
  </div>;
}
