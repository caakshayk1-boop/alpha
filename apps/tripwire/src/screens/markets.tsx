import { useEngines } from '../useEngines.ts';
import { usePulse } from '../data.ts';
import { isLiveQuote } from '../stamp.ts';
import { sessionNow } from '../market.ts';
import { dayWord } from '../fmt.ts';
import { Ago, LiveBadge, Observed } from '../live.tsx';
import { useTrendSummary } from '../trendsummary.ts';
import { MacroStrip } from './Macro.tsx';
import { IndexRows } from './IndexRows.tsx';
import { TrendMap } from './TrendMap.tsx';
import { Head, PageBar } from './common.tsx';
import { Loading } from './common.tsx';

/** The detail behind Today's market line: the indices, commodities and currencies, and the trend map with its sectors. Moved here from Today on 27 Oct 2026; nothing about it changed. */
export function Markets() {
  const { scr } = useEngines(); const rows = scr.data?.rows ?? []; const day = scr.data?.as_of ?? null;
  const pulse = usePulse(true); const anyLive = pulse.data ? Object.values(pulse.data.quotes).some((q) => isLiveQuote(q)) : null; const sess = sessionNow(Date.now(), anyLive);
  const t = useTrendSummary(rows, day, true); const live = sess.phase === 'open' && !!anyLive;
  return <div>
    <PageBar title="Markets" onBack sub={<>{sess.label} · {sess.detail}</>} />
    <div className="split"><div className="col">
      <section className="moodhero card" aria-label="Indices"><div className="row between small" style={{ marginBottom: 6 }}><b>Indices</b><span className="row" style={{ gap: 8 }}><LiveBadge live={live} label={live ? 'LIVE' : sess.phase === 'open' ? 'No live print' : sess.phase === 'pre' ? 'Pre-open' : 'Market closed'} /><span className="mute"><Observed sec={pulse.obs} err={pulse.err} /></span></span></div>
        <IndexRows nifty={pulse.data?.quotes.NIFTY} bank={pulse.data?.quotes.BANKNIFTY} vix={pulse.data?.quotes.VIX} err={!!pulse.err} /></section>
      <Head>Commodities, currencies, Bitcoin</Head>
      <MacroStrip />
    </div><div className="col">
      {scr.loading && <Loading what="the trend map" />}
      {scr.data && <><Head aside={<span className="small mute">{t.liveMap && sess.phase === 'open' ? <><i className="dot-live" aria-hidden="true" /> live · <Ago at={t.breadth.at} /></> : t.liveMap ? <>last prices · <Ago at={t.breadth.at} /></> : `close of ${dayWord(day)}`}</span>}>Trend map</Head>
        <TrendMap rows={rows} day={day} map={t.map} live={!!t.liveMap} liveAt={t.breadth.at} open={sess.phase === 'open'} repriced={t.liveMap ? t.liveMap.repriced : null} err={!!t.breadth.err} /></>}
    </div></div>
  </div>;
}
